import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { chargePrivateJson, privateStoredBytes } from './cloudPrivateQuota'

export const retirePayloads = internalMutation({
  args: { id: v.id('publishedPatterns'), owner: v.string(), cursor: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const pattern = await ctx.db.get(args.id)
    if (!pattern || pattern.owner !== args.owner || !pattern.retiringAt) return null
    const versions = await ctx.db.query('publishedVersions').withIndex('by_patternId_and_version', q => q.eq('patternId', args.id)).paginate({ numItems: 5, cursor: args.cursor })
    for (const version of versions.page) {
      const update = { docJson: '', visibility: 'private' as const, retiredAt: pattern.retiringAt }
      await ctx.db.patch(version._id, update)
      await chargePrivateJson(ctx, args.owner, `publication:version:${version._id}`, 'publication', privateStoredBytes({ ...version, ...update }), false)
      const links = await ctx.db.query('cloudAssetLinks').withIndex('by_kind_and_recordId_and_revision', q => q.eq('kind', 'pattern').eq('recordId', args.id).eq('revision', version.version)).take(65)
      for (const link of links) await ctx.db.delete(link._id)
    }
    if (!versions.isDone) await ctx.scheduler.runAfter(0, internal.cloudPublicationMaintenance.retirePayloads, { ...args, cursor: versions.continueCursor })
    else {
      const update = { docJson: '', visibility: 'private' as const, retiredAt: pattern.retiringAt, retiringAt: undefined }
      await ctx.db.patch(pattern._id, update)
      await chargePrivateJson(ctx, args.owner, `publication:current:${pattern._id}`, 'publication', privateStoredBytes({ ...pattern, ...update }), false)
    }
    return null
  },
})
