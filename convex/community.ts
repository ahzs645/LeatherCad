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
    version: row.version, publishedAt: row.publishedAt,
  }
}
const summaryPage = v.object({ page: v.array(patternSummary), continueCursor: v.string(), isDone: v.boolean() })
export const listPublic = query({
  args: { cursor }, returns: summaryPage,
  handler: async (ctx, args) => {
    const result = await ctx.db.query('publishedPatterns').withIndex('by_visibility', q => q.eq('visibility', 'public')).order('desc').paginate({ numItems: 20, cursor: args.cursor })
    return { page: result.page.map(summary), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const listMine = ownerQuery({
  args: { cursor }, returns: summaryPage,
  handler: async (ctx, args) => {
    const result = await ctx.db.query('publishedPatterns').withIndex('by_owner', q => q.eq('owner', ctx.owner)).order('desc').paginate({ numItems: 20, cursor: args.cursor })
    return { page: result.page.map(summary), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const get = query({
  args: { id: v.id('publishedPatterns'), version: v.union(v.number(), v.null()) }, returns: v.union(patternDetail, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row) return null
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
    attribution: v.string(), visibility, docJson: v.string(), expectedVersion: v.union(v.number(), v.null()),
  },
  returns: patternSummary,
  handler: async (ctx, args) => {
    validateDocumentJson(args.docJson)
    const title = boundedText(args.title, 'Title')
    const attribution = await validatePublicationProvenance(ctx, args.docJson, args.license, boundedText(args.attribution, 'Attribution', 64_000))
    if (args.description.length > 2_000) throw new ConvexError('Description must be at most 2000 characters')
    const now = Date.now(), old = args.id ? await ctx.db.get(args.id) : null
    if (args.id && (!old || old.owner !== ctx.owner)) throw new ConvexError('Pattern is not available for editing')
    if (old && args.expectedVersion !== old.version) throw new ConvexError('This pattern has a newer version; refresh before publishing')
    const version = (old?.version ?? 0) + 1
    const row = {
      owner: ctx.owner, author: ctx.author, title, description: args.description.trim(), license: args.license,
      attribution, visibility: args.visibility, docJson: args.docJson, version, publishedAt: now,
    }
    let patternId = old?._id
    if (old) await ctx.db.patch(old._id, row)
    else patternId = await ctx.db.insert('publishedPatterns', row)
    if (!patternId) throw new ConvexError('Pattern was not saved')
    await ctx.db.insert('publishedVersions', {
      patternId, version, title, description: row.description, author: ctx.author, license: row.license,
      attribution, visibility: args.visibility, docJson: args.docJson, publishedAt: now,
    })
    return { id: String(patternId), title, description: row.description, author: ctx.author, license: row.license, attribution, visibility: row.visibility, version, publishedAt: now }
  },
})
export const setVisibility = ownerMutation({
  args: { id: v.id('publishedPatterns'), visibility }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner) throw new ConvexError('Pattern is not available for editing')
    await ctx.db.patch(row._id, { visibility: args.visibility })
    const currentVersion = await ctx.db.query('publishedVersions').withIndex('by_patternId_and_version', q => q.eq('patternId', row._id).eq('version', row.version)).unique()
    if (currentVersion) await ctx.db.patch(currentVersion._id, { visibility: args.visibility })
    return null
  },
})
