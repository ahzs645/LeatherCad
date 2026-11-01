import { ensurePrivateQuotaReady, chargePrivateJson, privateStoredBytes } from './cloudPrivateQuota'
import { validateBoardImages, replaceBoardImageLinks } from './boardAssetReferences'
import { ConvexError, v } from 'convex/values'
import { query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { limitResource } from './resourcePolicy'
import { ownerMutation, ownerQuery } from './authenticated'
import { boundedText, cursor } from './validators'

const editableStatus = v.union(v.literal('draft'), v.literal('published'))
const topicSummary = v.object({
  id: v.id('communityBoardTopics'), authorId: v.id('communityBoardAuthors'), author: v.string(), title: v.string(),
  excerpt: v.string(), status: editableStatus, revision: v.number(), createdAt: v.number(), updatedAt: v.number(),
  attachments: v.array(v.id('cloudAssets')), replyCount: v.number(), likeCount: v.number(), likedByMe: v.boolean(), isMine: v.boolean(),
})
const topicDetail = v.object({
  id: v.id('communityBoardTopics'), authorId: v.id('communityBoardAuthors'), author: v.string(), title: v.string(), body: v.string(),
  excerpt: v.string(), status: editableStatus, revision: v.number(), createdAt: v.number(), updatedAt: v.number(),
  attachments: v.array(v.id('cloudAssets')), replyCount: v.number(), likeCount: v.number(), likedByMe: v.boolean(), isMine: v.boolean(),
})
const postSummary = v.object({
  id: v.id('communityBoardPosts'), topicId: v.id('communityBoardTopics'), authorId: v.id('communityBoardAuthors'), author: v.string(),
  body: v.string(), attachments: v.array(v.id('cloudAssets')), revision: v.number(), createdAt: v.number(), updatedAt: v.number(), likeCount: v.number(), likedByMe: v.boolean(), isMine: v.boolean(),
})
const topicPage = v.object({ page: v.array(topicSummary), continueCursor: v.string(), isDone: v.boolean() })
const postPage = v.object({ page: v.array(postSummary), continueCursor: v.string(), isDone: v.boolean() })
const likeResult = v.object({ likeCount: v.number(), likedByMe: v.boolean() })
const unavailable = () => new ConvexError('This discussion is not available')

async function viewerOwner(ctx: QueryCtx) {
  return (await ctx.auth.getUserIdentity())?.tokenIdentifier ?? null
}
function authorName(id: Id<'communityBoardAuthors'>) {
  // Public board identity is stable and does not expose an email or auth subject.
  return `Member ${String(id).slice(-10)}`
}
async function authorId(ctx: MutationCtx, owner: string) {
  const old = await ctx.db.query('communityBoardAuthors').withIndex('by_owner', q => q.eq('owner', owner)).unique()
  return old?._id ?? ctx.db.insert('communityBoardAuthors', { owner })
}
async function likedBy(ctx: QueryCtx, targetId: Id<'communityBoardTopics'> | Id<'communityBoardPosts'>, owner: string | null) {
  return owner !== null && await ctx.db.query('communityBoardLikes')
    .withIndex('by_targetId_and_owner', q => q.eq('targetId', targetId).eq('owner', owner)).unique() !== null
}
async function summary(ctx: QueryCtx, row: Doc<'communityBoardTopics'>, owner: string | null) {
  if (row.status === 'removed') throw unavailable()
  return {
    id: row._id, authorId: row.authorId, author: authorName(row.authorId), title: row.title, excerpt: row.body.slice(0, 180),
    attachments: row.attachments ?? [], status: row.status, revision: row.revision, createdAt: row.createdAt, updatedAt: row.updatedAt, replyCount: row.replyCount,
    likeCount: row.likeCount, likedByMe: await likedBy(ctx, row._id, owner), isMine: owner === row.owner,
  }
}
async function readableTopic(ctx: QueryCtx, id: Id<'communityBoardTopics'>, owner: string | null) {
  const row = await ctx.db.get(id)
  return row && row.status !== 'removed' && (row.status === 'published' || row.owner === owner) ? row : null
}
async function postView(ctx: QueryCtx, row: Doc<'communityBoardPosts'>, owner: string | null) {
  return {
    id: row._id, topicId: row.topicId, authorId: row.authorId, author: authorName(row.authorId), body: row.body, attachments: row.attachments ?? [],
    revision: row.revision, createdAt: row.createdAt, updatedAt: row.updatedAt, likeCount: row.likeCount,
    likedByMe: await likedBy(ctx, row._id, owner), isMine: owner === row.owner,
  }
}

export const listPublicTopics = query({
  args: { cursor }, returns: topicPage,
  handler: async (ctx, args) => {
    const owner = await viewerOwner(ctx)
    const result = await ctx.db.query('communityBoardTopics')
      .withIndex('by_status_and_updatedAt', q => q.eq('status', 'published')).order('desc').paginate({ numItems: 20, cursor: args.cursor })
    return { page: await Promise.all(result.page.map(row => summary(ctx, row, owner))), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const searchPublicTopics = query({
  args: { cursor, search: v.string() }, returns: topicPage,
  handler: async (ctx, args) => {
    const owner = await viewerOwner(ctx)
    const result = await ctx.db.query('communityBoardTopics').withSearchIndex('search_public_title', q => q.search('title', boundedText(args.search, 'Search', 160)).eq('status', 'published')).paginate({ numItems: 20, cursor: args.cursor })
    return { page: await Promise.all(result.page.map(row => summary(ctx, row, owner))), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const listMyDrafts = ownerQuery({
  args: { cursor }, returns: topicPage,
  handler: async (ctx, args) => {
    const result = await ctx.db.query('communityBoardTopics')
      .withIndex('by_owner_and_status', q => q.eq('owner', ctx.owner).eq('status', 'draft')).order('desc').paginate({ numItems: 20, cursor: args.cursor })
    return { page: await Promise.all(result.page.map(row => summary(ctx, row, ctx.owner))), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const getTopic = query({
  args: { id: v.id('communityBoardTopics') }, returns: v.union(topicDetail, v.null()),
  handler: async (ctx, args) => {
    const owner = await viewerOwner(ctx), row = await readableTopic(ctx, args.id, owner)
    return row ? { ...await summary(ctx, row, owner), body: row.body } : null
  },
})
export const listPosts = query({
  args: { topicId: v.id('communityBoardTopics'), cursor }, returns: postPage,
  handler: async (ctx, args) => {
    const owner = await viewerOwner(ctx)
    if (!await readableTopic(ctx, args.topicId, owner)) return { page: [], continueCursor: '', isDone: true }
    const result = await ctx.db.query('communityBoardPosts')
      .withIndex('by_topicId_and_status', q => q.eq('topicId', args.topicId).eq('status', 'published')).order('asc').paginate({ numItems: 20, cursor: args.cursor })
    return { page: await Promise.all(result.page.map(row => postView(ctx, row, owner))), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const createTopic = ownerMutation({
  args: { title: v.string(), body: v.string(), status: editableStatus, attachments: v.optional(v.array(v.id('cloudAssets'))) }, returns: topicDetail,
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    await ensurePrivateQuotaReady(ctx, ctx.owner)
    const attachments = await validateBoardImages(ctx, ctx.owner, args.attachments)
    const now = Date.now()
    const id = await ctx.db.insert('communityBoardTopics', {
      owner: ctx.owner, authorId: await authorId(ctx, ctx.owner), title: boundedText(args.title, 'Topic title', 160),
      body: boundedText(args.body, 'Topic text', 5000), attachments, status: args.status, revision: 1, createdAt: now, updatedAt: now, replyCount: 0, likeCount: 0,
    })
    const row = await ctx.db.get(id)
    if (!row) throw unavailable()
    await chargePrivateJson(ctx, ctx.owner, `community:topic:${id}`, 'community', privateStoredBytes(row))
    await replaceBoardImageLinks(ctx, ctx.owner, 'topic', id, 1, attachments)
    return { ...await summary(ctx, row, ctx.owner), body: row.body }
  },
})
export const updateTopic = ownerMutation({
  args: { id: v.id('communityBoardTopics'), title: v.string(), body: v.string(), status: editableStatus, expectedRevision: v.number(), attachments: v.optional(v.array(v.id('cloudAssets'))) }, returns: topicDetail,
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner || row.status === 'removed') throw unavailable()
    if (args.expectedRevision !== row.revision) throw new ConvexError('This topic changed; refresh before editing')
    await ensurePrivateQuotaReady(ctx, ctx.owner)
    const attachments = await validateBoardImages(ctx, ctx.owner, args.attachments ?? row.attachments)
    await replaceBoardImageLinks(ctx, ctx.owner, 'topic', row._id, row.revision + 1, attachments)
    await ctx.db.patch(row._id, { attachments, title: boundedText(args.title, 'Topic title', 160), body: boundedText(args.body, 'Topic text', 5000), status: args.status, revision: row.revision + 1, updatedAt: Date.now() })
    const updated = await ctx.db.get(row._id)
    if (!updated) throw unavailable()
    await chargePrivateJson(ctx, ctx.owner, `community:topic:${updated._id}`, 'community', privateStoredBytes(updated))
    return { ...await summary(ctx, updated, ctx.owner), body: updated.body }
  },
})
export const removeTopic = ownerMutation({
  args: { id: v.id('communityBoardTopics'), expectedRevision: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner) throw unavailable()
    if (row.status === 'removed') return null
    if (args.expectedRevision !== row.revision) throw new ConvexError('This topic changed; refresh before removing it')
    await chargePrivateJson(ctx, ctx.owner, `community:topic:${row._id}`, 'community', privateStoredBytes({ ...row, attachments: [], status: 'removed', title: '', body: '' }), false)
    await replaceBoardImageLinks(ctx, ctx.owner, 'topic', row._id, row.revision + 1, [])
    await ctx.db.patch(row._id, { attachments: [], status: 'removed', title: '', body: '', revision: row.revision + 1, updatedAt: Date.now() })
    return null
  },
})
export const createPost = ownerMutation({
  args: { topicId: v.id('communityBoardTopics'), body: v.string(), attachments: v.optional(v.array(v.id('cloudAssets'))) }, returns: postSummary,
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    const topic = await ctx.db.get(args.topicId)
    if (!topic || topic.status !== 'published') throw unavailable()
    await ensurePrivateQuotaReady(ctx, ctx.owner)
    const attachments = await validateBoardImages(ctx, ctx.owner, args.attachments)
    const now = Date.now()
    const id = await ctx.db.insert('communityBoardPosts', {
      owner: ctx.owner, authorId: await authorId(ctx, ctx.owner), topicId: topic._id, body: boundedText(args.body, 'Reply', 4000),
      attachments, status: 'published', revision: 1, createdAt: now, updatedAt: now, likeCount: 0,
    })
    await ctx.db.patch(topic._id, { replyCount: topic.replyCount + 1, updatedAt: now })
    if (topic.owner !== ctx.owner) {
      await ctx.db.insert('communityNotifications', { owner: topic.owner, topicId: topic._id, createdAt: now })
      const retained = await ctx.db.query('communityNotifications').withIndex('by_owner', q => q.eq('owner', topic.owner)).order('desc').take(1001)
      for (const old of retained.slice(1000)) await ctx.db.delete(old._id)
    }
    const row = await ctx.db.get(id)
    if (!row) throw unavailable()
    await chargePrivateJson(ctx, ctx.owner, `community:post:${id}`, 'community', privateStoredBytes(row))
    await replaceBoardImageLinks(ctx, ctx.owner, 'post', id, 1, attachments)
    return postView(ctx, row, ctx.owner)
  },
})
export const editPost = ownerMutation({
  args: { id: v.id('communityBoardPosts'), body: v.string(), expectedRevision: v.number(), attachments: v.optional(v.array(v.id('cloudAssets'))) }, returns: postSummary,
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner || row.status === 'removed') throw unavailable()
    if (args.expectedRevision !== row.revision) throw new ConvexError('This reply changed; refresh before editing')
    await ensurePrivateQuotaReady(ctx, ctx.owner)
    const attachments = await validateBoardImages(ctx, ctx.owner, args.attachments ?? row.attachments)
    await replaceBoardImageLinks(ctx, ctx.owner, 'post', row._id, row.revision + 1, attachments)
    await ctx.db.patch(row._id, { attachments, body: boundedText(args.body, 'Reply', 4000), revision: row.revision + 1, updatedAt: Date.now() })
    const updated = await ctx.db.get(row._id)
    if (!updated) throw unavailable()
    await chargePrivateJson(ctx, ctx.owner, `community:post:${updated._id}`, 'community', privateStoredBytes(updated))
    return postView(ctx, updated, ctx.owner)
  },
})
export const removePost = ownerMutation({
  args: { id: v.id('communityBoardPosts'), expectedRevision: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner) throw unavailable()
    if (row.status === 'removed') return null
    if (args.expectedRevision !== row.revision) throw new ConvexError('This reply changed; refresh before removing it')
    await chargePrivateJson(ctx, ctx.owner, `community:post:${row._id}`, 'community', privateStoredBytes({ ...row, attachments: [], status: 'removed', body: '' }), false)
    await replaceBoardImageLinks(ctx, ctx.owner, 'post', row._id, row.revision + 1, [])
    await ctx.db.patch(row._id, { attachments: [], status: 'removed', body: '', revision: row.revision + 1, updatedAt: Date.now() })
    const topic = await ctx.db.get(row.topicId)
    if (topic) await ctx.db.patch(topic._id, { replyCount: Math.max(0, topic.replyCount - 1) })
    return null
  },
})
export const setLike = ownerMutation({
  args: {
    target: v.union(v.object({ kind: v.literal('topic'), id: v.id('communityBoardTopics') }), v.object({ kind: v.literal('post'), id: v.id('communityBoardPosts') })),
    liked: v.boolean(),
  }, returns: likeResult,
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    const row = await ctx.db.get(args.target.id)
    if (!row || row.status !== 'published') throw unavailable()
    if (args.target.kind === 'post') {
      const post = await ctx.db.get(args.target.id)
      const topic = post ? await ctx.db.get(post.topicId) : null
      if (!topic || topic.status !== 'published') throw unavailable()
    }
    const old = await ctx.db.query('communityBoardLikes')
      .withIndex('by_targetId_and_owner', q => q.eq('targetId', args.target.id).eq('owner', ctx.owner)).unique()
    if (args.liked === Boolean(old)) return { likeCount: row.likeCount, likedByMe: args.liked }
    if (args.liked) await ctx.db.insert('communityBoardLikes', { owner: ctx.owner, targetId: args.target.id })
    else if (old) await ctx.db.delete(old._id)
    const count = Math.max(0, row.likeCount + (args.liked ? 1 : -1))
    await ctx.db.patch(row._id, { likeCount: count })
    return { likeCount: count, likedByMe: args.liked }
  },
})
