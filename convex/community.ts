import { retainDocumentAssets, validateDocumentAssets } from './cloudAssetReferences'
import { internal } from './_generated/api'
import { ensurePrivateQuotaReady, chargePrivateJson, privateStoredBytes } from './cloudPrivateQuota'
import { limitResource } from './resourcePolicy'
import { ConvexError, v } from 'convex/values'
import { query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { ownerMutation, ownerQuery } from './authenticated'
import { boundedText, cursor, license, patternDetail, patternSummary, validateDocumentJson, visibility } from './validators'
import { validatePublicationProvenance } from './publicationProvenance'

function summary(row: Doc<'publishedPatterns'>) {
  return {
    id: String(row._id), title: row.title, description: row.description, author: row.author,
    license: row.license, attribution: row.attribution, visibility: row.visibility,
    version: row.version, publishedAt: row.publishedAt, visibilityRevision: row.visibilityRevision ?? 0, retired: Boolean(row.retiredAt || row.retiringAt),
  }
}
const summaryPage = v.object({ page: v.array(patternSummary), continueCursor: v.string(), isDone: v.boolean() })
export const listPublic = query({
  args: { cursor }, returns: summaryPage,
  handler: async (ctx, args) => {
    const result = await ctx.db.query('publishedPatterns').withIndex('by_visibility', q => q.eq('visibility', 'public')).order('desc').paginate({ numItems: 5, cursor: args.cursor })
    return { page: result.page.map(summary), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})

export const searchPublic = query({
  args: { cursor, search: v.string() }, returns: summaryPage,
  handler: async (ctx, args) => {
    const search = boundedText(args.search, 'Search', 160)
    const result = await ctx.db.query('publishedPatterns').withSearchIndex('search_public_title', q => q.search('title', search).eq('visibility', 'public')).paginate({ numItems: 5, cursor: args.cursor })
    return { page: result.page.map(summary), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})

export const listMine = ownerQuery({
  args: { cursor }, returns: summaryPage,
  handler: async (ctx, args) => {
    const result = await ctx.db.query('publishedPatterns').withIndex('by_owner', q => q.eq('owner', ctx.owner)).order('desc').paginate({ numItems: 5, cursor: args.cursor })
    return { page: result.page.map(summary), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const get = query({
  args: { id: v.id('publishedPatterns'), version: v.union(v.number(), v.null()) }, returns: v.union(patternDetail, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row || row.retiredAt || row.retiringAt) return null
    const identity = await ctx.auth.getUserIdentity()
    if (row.visibility !== 'public' && identity?.tokenIdentifier !== row.owner) return null
    if (args.version === null || args.version === row.version) return { ...summary(row), docJson: row.docJson }
    if (!Number.isInteger(args.version) || args.version < 1 || args.version > row.version) return null
    const previous = await ctx.db.query('publishedVersions').withIndex('by_patternId_and_version', q => q.eq('patternId', args.id).eq('version', args.version!)).unique()
    if (previous && previous.visibility !== 'public' && identity?.tokenIdentifier !== row.owner) return null
    return previous ? {
      ...summary(row), title: previous.title, description: previous.description, author: previous.author, license: previous.license,
      attribution: previous.attribution, version: previous.version, publishedAt: previous.publishedAt, docJson: previous.docJson,
    } : null
  },
})
export const publish = ownerMutation({
  args: {
    id: v.union(v.id('publishedPatterns'), v.null()), title: v.string(), description: v.string(), license,
    attribution: v.string(), visibility, docJson: v.string(), expectedVersion: v.union(v.number(), v.null()), expectedVisibilityRevision: v.optional(v.number()),
  },
  returns: patternSummary,
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    await ensurePrivateQuotaReady(ctx, ctx.owner)
    validateDocumentJson(args.docJson)
    await validateDocumentAssets(ctx, ctx.owner, args.docJson)
    const title = boundedText(args.title, 'Title')
    const attribution = await validatePublicationProvenance(ctx, args.docJson, args.license, boundedText(args.attribution, 'Attribution', 64_000))
    if (args.description.length > 2_000) throw new ConvexError('Description must be at most 2000 characters')
    const now = Date.now(), old = args.id ? await ctx.db.get(args.id) : null
    if (args.id && (!old || old.owner !== ctx.owner)) throw new ConvexError('Pattern is not available for editing')
    if (old?.retiredAt || old?.retiringAt) throw new ConvexError('This publication content has been retired; create a new pattern instead')
    if (old?.moderatedAt) throw new ConvexError('This pattern was removed by a moderator')
    if (old && args.expectedVersion !== old.version) throw new ConvexError('This pattern has a newer version; refresh before publishing')
    if (old && (old.visibilityRevision ?? 0) !== args.expectedVisibilityRevision) throw new ConvexError('Pattern visibility changed; refresh before publishing')
    const version = (old?.version ?? 0) + 1
    const row = {
      owner: ctx.owner, author: ctx.author, title, description: args.description.trim(), license: args.license,
      attribution, visibility: args.visibility, docJson: args.docJson, version, publishedAt: now, visibilityRevision: (old?.visibilityRevision ?? 0) + 1,
    }
    let patternId = old?._id
    if (old) await ctx.db.patch(old._id, row)
    else patternId = await ctx.db.insert('publishedPatterns', row)
    if (!patternId) throw new ConvexError('Pattern was not saved')
    const versionRow = {
      patternId, version, title, description: row.description, author: ctx.author, license: row.license,
      attribution, visibility: args.visibility, docJson: args.docJson, publishedAt: now,
    }
    const versionId = await ctx.db.insert('publishedVersions', versionRow)
    await chargePrivateJson(ctx, ctx.owner, `publication:current:${patternId}`, 'publication', privateStoredBytes(row))
    await chargePrivateJson(ctx, ctx.owner, `publication:version:${versionId}`, 'publication', privateStoredBytes(versionRow))
    await retainDocumentAssets(ctx, ctx.owner, args.docJson, 'pattern', patternId, version)
    return { id: String(patternId), title, description: row.description, author: ctx.author, license: row.license, attribution, visibility: row.visibility, version, publishedAt: now, visibilityRevision: row.visibilityRevision, retired: false }
  },
})
export const setVisibility = ownerMutation({
  args: { id: v.id('publishedPatterns'), visibility, expectedVersion: v.union(v.number(), v.null()), expectedVisibilityRevision: v.union(v.number(), v.null()) }, returns: v.null(),
  handler: async (ctx, args) => {
    await limitResource(ctx, ctx.owner, 'communityWrites')
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner) throw new ConvexError('Pattern is not available for editing')
    if (row.retiredAt || row.retiringAt) throw new ConvexError('This publication content has been retired')
    if (row.moderatedAt) throw new ConvexError('This pattern was removed by a moderator')
    if (row.version !== args.expectedVersion || (row.visibilityRevision ?? 0) !== args.expectedVisibilityRevision) throw new ConvexError('Pattern visibility changed; refresh before updating')
    await ctx.db.patch(row._id, { visibility: args.visibility, visibilityRevision: (row.visibilityRevision ?? 0) + 1 })
    const currentVersion = await ctx.db.query('publishedVersions').withIndex('by_patternId_and_version', q => q.eq('patternId', row._id).eq('version', row.version)).unique()
    if (currentVersion) {
      await ctx.db.patch(currentVersion._id, { visibility: args.visibility })
      await chargePrivateJson(ctx, ctx.owner, `publication:version:${currentVersion._id}`, 'publication', privateStoredBytes({ ...currentVersion, visibility: args.visibility }), false)
    }
    await chargePrivateJson(ctx, ctx.owner, `publication:current:${row._id}`, 'publication', privateStoredBytes({ ...row, visibility: args.visibility }), false)
    return null
  },
})

export const retire = ownerMutation({
  args: { id: v.id('publishedPatterns'), expectedVersion: v.number(), expectedVisibilityRevision: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner) throw new ConvexError('Pattern is not available for editing')
    if (row.retiredAt || row.retiringAt) return null
    if (row.version !== args.expectedVersion || (row.visibilityRevision ?? 0) !== args.expectedVisibilityRevision) throw new ConvexError('Pattern changed; refresh before retiring its content')
    await ensurePrivateQuotaReady(ctx, ctx.owner)
    await ctx.db.patch(row._id, { visibility: 'private', retiringAt: Date.now(), visibilityRevision: (row.visibilityRevision ?? 0) + 1 })
    await ctx.scheduler.runAfter(0, internal.cloudPublicationMaintenance.retirePayloads, { id: row._id, owner: ctx.owner, cursor: null })
    return null
  },
})
