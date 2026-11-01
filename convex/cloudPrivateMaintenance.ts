import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { releasePrivateJson } from './cloudPrivateQuota'

export const purgeDrawing = internalMutation({
  args: { documentId: v.id('cloudDocuments'), owner: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.documentId)
    if (!row || row.owner !== args.owner || !row.deletedAt || !row.purgingAt) return null
    const revisions = await ctx.db.query('cloudDocumentRevisions').withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', args.owner).eq('documentId', row._id)).take(5)
    for (const revision of revisions) {
      const links = await ctx.db.query('cloudAssetLinks').withIndex('by_kind_and_recordId_and_revision', q => q.eq('kind', 'document').eq('recordId', row._id).eq('revision', revision.revision)).take(65)
      for (const link of links) await ctx.db.delete(link._id)
      await releasePrivateJson(ctx, args.owner, `revision:${row._id}:${revision.revision}`)
      await ctx.db.delete(revision._id)
    }
    if (revisions.length === 5) await ctx.scheduler.runAfter(0, internal.cloudPrivateMaintenance.purgeDrawing, args)
    else {
      const metadata = await ctx.db.query('cloudDocumentMetadata').withIndex('by_owner_and_clientId', q => q.eq('owner', args.owner).eq('clientId', row.clientId)).unique()
      const location = await ctx.db.query('cloudDocumentLocations').withIndex('by_owner_and_documentId', q => q.eq('owner', args.owner).eq('documentId', row._id)).unique()
      if (metadata) await ctx.db.delete(metadata._id)
      if (location) await ctx.db.delete(location._id)
      await releasePrivateJson(ctx, args.owner, `drawing:${row._id}`)
      await ctx.db.delete(row._id)
    }
    return null
  },
})
