import { ensurePrivateQuotaReady, chargePrivateJson, privateUsage, privateStoredBytes } from './cloudPrivateQuota'
import { ConvexError, v } from 'convex/values'
import { ownerMutation, ownerQuery } from './authenticated'
import { boundedText, cursor } from './validators'
import { mirrorDocumentMetadata } from './cloudDocumentMetadata'
import { recordDocumentRevision } from './cloudWorkspaceHistory'

const summary = v.object({ id: v.string(), name: v.string(), revision: v.number(), updatedAt: v.number(), deletedAt: v.union(v.number(), v.null()) })
export const list = ownerQuery({
  args: { cursor, trash: v.boolean() },
  returns: v.object({ page: v.array(summary), continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    // Pages are bounded even when legacy rows have no explicit status field.
    const result = await ctx.db.query('cloudDocumentMetadata').withIndex('by_owner', q => q.eq('owner', ctx.owner)).order('desc').paginate({ numItems: 25, cursor: args.cursor })
    return { page: result.page.filter(row => Boolean(row.deletedAt) === args.trash).map(row => ({ id: row.clientId, name: row.name, revision: row.revision, updatedAt: row.updatedAt, deletedAt: row.deletedAt ?? null })), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const rename = ownerMutation({
  args: { id: v.string(), name: v.string(), expectedRevision: v.number() }, returns: summary,
  handler: async (ctx, args) => {
    await ensurePrivateQuotaReady(ctx, ctx.owner)
    const row = await ctx.db.query('cloudDocuments').withIndex('by_owner_and_clientId', q => q.eq('owner', ctx.owner).eq('clientId', args.id)).unique()
    if (!row || row.deletedAt) throw new ConvexError('Drawing is not available')
    if (row.revision !== args.expectedRevision) throw new ConvexError('Cloud drawing changed; refresh before renaming')
    const name = boundedText(args.name, 'Drawing name'), doc = JSON.parse(row.docJson) as Record<string, unknown>
    await recordDocumentRevision(ctx, row)
    const update = { name, docJson: JSON.stringify({ ...doc, documentName: name }), revision: row.revision + 1, updatedAt: Date.now() }
    await ctx.db.patch(row._id, update)
    await recordDocumentRevision(ctx, { ...row, ...update })
    return { id: row.clientId, name, revision: update.revision, updatedAt: update.updatedAt, deletedAt: null }
  },
})

/** Server cursor makes quota backfill bounded, resumable and idempotent. */
export const indexLegacyPage = ownerMutation({
  args: { cursor }, returns: v.object({ continueCursor: v.string(), isDone: v.boolean(), indexed: v.number() }),
  handler: async (ctx) => {
    let usage = await privateUsage(ctx, ctx.owner)
    if (usage?.ready) return { continueCursor: '', isDone: true, indexed: 0 }
    if (!usage) {
      const id = await ctx.db.insert('cloudPrivateUsage', { owner: ctx.owner, bytes: 0, drawings: 0, ready: false, phase: 'drawings', cursor: null })
      usage = (await ctx.db.get(id))!
    }
    const phase = usage.phase ?? 'drawings'
    let result: { continueCursor: string; isDone: boolean }, indexed = 0
    if (phase === 'drawings') {
      const page = await ctx.db.query('cloudDocuments').withIndex('by_owner', q => q.eq('owner', ctx.owner)).paginate({ numItems: 5, cursor: usage.cursor ?? null })
      for (const row of page.page) await mirrorDocumentMetadata(ctx, row, false)
      result = page; indexed = page.page.length
    } else if (phase === 'revisions') {
      const page = await ctx.db.query('cloudDocumentRevisions').withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', ctx.owner)).paginate({ numItems: 5, cursor: usage.cursor ?? null })
      for (const row of page.page) await chargePrivateJson(ctx, ctx.owner, `revision:${row.documentId}:${row.revision}`, 'revision', privateStoredBytes(row), false)
      result = page
    } else if (phase === 'settings') {
      const page = await ctx.db.query('cloudSettings').withIndex('by_owner', q => q.eq('owner', ctx.owner)).paginate({ numItems: 5, cursor: usage.cursor ?? null })
      for (const row of page.page) await chargePrivateJson(ctx, ctx.owner, `setting:${row.key}`, 'setting', privateStoredBytes(row), false)
      result = page
    } else if (phase === 'patterns') {
      if (!usage.patternId) {
        const page = await ctx.db.query('publishedPatterns').withIndex('by_owner', q => q.eq('owner', ctx.owner)).paginate({ numItems: 1, cursor: usage.cursor ?? null })
        const pattern = page.page[0]
        if (pattern) {
          await chargePrivateJson(ctx, ctx.owner, `publication:current:${pattern._id}`, 'publication', privateStoredBytes(pattern), false)
          await ctx.db.patch(usage._id, { patternId: pattern._id, patternCursor: null, patternsDone: page.isDone, cursor: page.continueCursor })
          return { indexed: 0, isDone: false, continueCursor: `pattern:${pattern._id}:start` }
        }
        result = page
      } else {
        const page = await ctx.db.query('publishedVersions').withIndex('by_patternId_and_version', q => q.eq('patternId', usage.patternId!)).paginate({ numItems: 5, cursor: usage.patternCursor ?? null })
        for (const row of page.page) await chargePrivateJson(ctx, ctx.owner, `publication:version:${row._id}`, 'publication', privateStoredBytes(row), false)
        if (!page.isDone) {
          await ctx.db.patch(usage._id, { patternCursor: page.continueCursor })
          return { indexed: 0, isDone: false, continueCursor: `pattern:${usage.patternId}:${page.continueCursor}` }
        }
        await ctx.db.patch(usage._id, { patternId: undefined, patternCursor: undefined })
        if (!usage.patternsDone) return { indexed: 0, isDone: false, continueCursor: `pattern-next:${usage.cursor}` }
        result = { continueCursor: '', isDone: true }
      }
    } else if (phase === 'topics') {
      const page = await ctx.db.query('communityBoardTopics').withIndex('by_owner_and_status', q => q.eq('owner', ctx.owner)).paginate({ numItems: 25, cursor: usage.cursor ?? null })
      for (const row of page.page) await chargePrivateJson(ctx, ctx.owner, `community:topic:${row._id}`, 'community', privateStoredBytes(row), false)
      result = page
    } else {
      const page = await ctx.db.query('communityBoardPosts').withIndex('by_owner', q => q.eq('owner', ctx.owner)).paginate({ numItems: 25, cursor: usage.cursor ?? null })
      for (const row of page.page) await chargePrivateJson(ctx, ctx.owner, `community:post:${row._id}`, 'community', privateStoredBytes(row), false)
      result = page
    }
    const nextPhase = phase === 'drawings' ? 'revisions' : phase === 'revisions' ? 'settings' : phase === 'settings' ? 'patterns' : phase === 'patterns' ? 'topics' : phase === 'topics' ? 'posts' : undefined
    const ready = result.isDone && !nextPhase
    await ctx.db.patch(usage._id, { ready, phase: result.isDone ? nextPhase : phase, cursor: result.isDone ? null : result.continueCursor })
    return { indexed, isDone: ready, continueCursor: ready ? '' : `${result.isDone ? nextPhase : phase}:${result.isDone ? '' : result.continueCursor}` }
  },
})
