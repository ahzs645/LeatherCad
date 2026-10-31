import { chargePrivateJson, privateStoredBytes, privateUsage } from './cloudPrivateQuota'
import { replaceBoardImageLinks } from './boardAssetReferences'
import { ConvexError, v } from 'convex/values'
import { ownerMutation, ownerQuery } from './authenticated'
import { moderationTarget } from './communityOperationsSchema'
import { boundedText, cursor } from './validators'
import { limitResource } from './resourcePolicy'
import type { QueryCtx } from './_generated/server'
import type { Infer } from 'convex/values'

type Target = Infer<typeof moderationTarget>
function canModerate(owner: string): boolean {
  try {
    const configured: unknown = JSON.parse(process.env.COMMUNITY_MODERATORS ?? '[]')
    return Array.isArray(configured) && configured.length <= 100 && configured.every(item => typeof item === 'string') && configured.includes(owner)
  } catch { return false }
}
function requireModerator(owner: string) { if (!canModerate(owner)) throw new ConvexError('Moderator access is required') }
async function context(ctx: QueryCtx, target: Target) {
  if (target.kind === 'pattern') {
    const row = await ctx.db.get(target.id)
    return row ? { title: row.title, excerpt: row.description, revision: row.version, public: row.visibility === 'public', visibilityRevision: row.visibilityRevision ?? 0 } : null
  }
  if (target.kind === 'topic') {
    const row = await ctx.db.get(target.id)
    return row ? { title: row.title, excerpt: row.body.slice(0, 1000), revision: row.revision, public: row.status === 'published', visibilityRevision: 0 } : null
  }
  const row = await ctx.db.get(target.id), topic = row ? await ctx.db.get(row.topicId) : null
  return row && topic ? { title: topic.title, excerpt: row.body.slice(0, 1000), revision: row.revision, public: row.status === 'published' && topic.status === 'published', visibilityRevision: 0 } : null
}
export const capabilities = ownerQuery({ args: {}, returns: v.object({ moderator: v.boolean() }), handler: async ctx => ({ moderator: canModerate(ctx.owner) }) })
export const report = ownerMutation({
  args: { target: moderationTarget, reason: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    const content = await context(ctx, args.target)
    if (!content?.public) throw new ConvexError('This public content is not available')
    const reason = boundedText(args.reason, 'Report reason', 1000), targetKey = `${args.target.kind}:${args.target.id}`
    const old = await ctx.db.query('communityReports').withIndex('by_reporter_and_targetKey_and_status', q => q.eq('reporter', ctx.owner).eq('targetKey', targetKey).eq('status', 'open')).unique()
    if (!old) await ctx.db.insert('communityReports', { reporter: ctx.owner, target: args.target, targetKey, reason, status: 'open', createdAt: Date.now() })
    return null
  },
})
const queueItem = v.object({ id: v.id('communityReports'), target: moderationTarget, reason: v.string(), createdAt: v.number(), title: v.string(), excerpt: v.string(), revision: v.number(), visibilityRevision: v.number(), available: v.boolean() })
export const list = ownerQuery({
  args: { cursor }, returns: v.object({ page: v.array(queueItem), continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    requireModerator(ctx.owner)
    const result = await ctx.db.query('communityReports').withIndex('by_status', q => q.eq('status', 'open')).paginate({ numItems: 5, cursor: args.cursor })
    const page = await Promise.all(result.page.map(async row => {
      const content = await context(ctx, row.target)
      return { id: row._id, target: row.target, reason: row.reason, createdAt: row.createdAt, title: content?.public ? content.title : 'Content no longer public', excerpt: content?.public ? content.excerpt : '', revision: content?.revision ?? 0, visibilityRevision: content?.visibilityRevision ?? 0, available: Boolean(content?.public) }
    }))
    return { page, continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const resolve = ownerMutation({
  args: { id: v.id('communityReports'), action: v.union(v.literal('hide'), v.literal('dismiss')), reason: v.string(), expectedRevision: v.number(), expectedVisibilityRevision: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    requireModerator(ctx.owner)
    const report = await ctx.db.get(args.id)
    if (!report || report.status !== 'open') throw new ConvexError('Report is no longer open')
    const reason = boundedText(args.reason, 'Decision reason', 1000), content = await context(ctx, report.target)
    if ((content?.revision ?? 0) !== args.expectedRevision || (content?.visibilityRevision ?? 0) !== args.expectedVisibilityRevision) throw new ConvexError('Reported content changed; refresh before moderating')
    if (args.action === 'hide' && content?.public) {
      const target = report.target
      if (target.kind === 'pattern') {
        const pattern = await ctx.db.get(target.id)
        await ctx.db.patch(target.id, { visibility: 'private', moderatedAt: Date.now(), visibilityRevision: content.visibilityRevision + 1 })
        if (pattern && await privateUsage(ctx, pattern.owner)) await chargePrivateJson(ctx, pattern.owner, `publication:current:${pattern._id}`, 'publication', privateStoredBytes({ ...pattern, visibility: 'private' }), false)
      }
      else if (target.kind === 'topic') {
        const topic = await ctx.db.get(target.id)
        if (topic) { if (await privateUsage(ctx, topic.owner)) await chargePrivateJson(ctx, topic.owner, `community:topic:${topic._id}`, 'community', privateStoredBytes({ ...topic, attachments: [], status: 'removed', title: '', body: '' }), false); await replaceBoardImageLinks(ctx, topic.owner, 'topic', topic._id, topic.revision + 1, []) }
        await ctx.db.patch(target.id, { attachments: [], status: 'removed', title: '', body: '', revision: content.revision + 1, updatedAt: Date.now() })
      }
      else {
        const post = await ctx.db.get(target.id)
        if (post) {
          if (await privateUsage(ctx, post.owner)) await chargePrivateJson(ctx, post.owner, `community:post:${post._id}`, 'community', privateStoredBytes({ ...post, attachments: [], status: 'removed', body: '' }), false)
          await replaceBoardImageLinks(ctx, post.owner, 'post', post._id, post.revision + 1, [])
          await ctx.db.patch(post._id, { attachments: [], status: 'removed', body: '', revision: post.revision + 1, updatedAt: Date.now() })
          const topic = await ctx.db.get(post.topicId)
          if (topic) await ctx.db.patch(topic._id, { replyCount: Math.max(0, topic.replyCount - 1) })
        }
      }
    }
    await ctx.db.patch(report._id, { status: 'resolved' })
    await ctx.db.insert('communityModerationAudit', { moderator: ctx.owner, target: report.target, action: args.action, reason, targetRevision: content?.revision ?? 0, createdAt: Date.now() })
    return null
  },
})
export const audit = ownerQuery({
  args: { cursor }, returns: v.object({ page: v.array(v.object({ id: v.id('communityModerationAudit'), target: moderationTarget, action: v.union(v.literal('hide'), v.literal('dismiss')), reason: v.string(), targetRevision: v.number(), createdAt: v.number() })), continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    requireModerator(ctx.owner)
    const result = await ctx.db.query('communityModerationAudit').withIndex('by_createdAt').order('desc').paginate({ numItems: 20, cursor: args.cursor })
    return { page: result.page.map(({ _id, target, action, reason, targetRevision, createdAt }) => ({ id: _id, target, action, reason, targetRevision, createdAt })), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
