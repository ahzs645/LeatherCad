import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'

/** App storage is used only by cloudAssets. Never expose this maintenance operation publicly. */
export const collectOrphans = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), pendingOnly: v.optional(v.boolean()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const pending = await ctx.db.query('cloudAssets').withIndex('by_state_and_expiresAt', q => q.eq('state', 'pending').lt('expiresAt', Date.now())).take(25)
    for (const row of pending) {
      const usage = await ctx.db.query('cloudAssetUsage').withIndex('by_owner', q => q.eq('owner', row.owner)).unique()
      if (usage) await ctx.db.patch(usage._id, { bytes: Math.max(0, usage.bytes - row.size), count: Math.max(0, usage.count - 1) })
      await ctx.db.delete(row._id)
    }
    const unused = await ctx.db.query('cloudAssets').withIndex('by_state_and_expiresAt', q => q.eq('state', 'ready').lt('expiresAt', Date.now())).take(25)
    for (const row of unused) {
      const retained = await ctx.db.query('cloudAssetLinks').withIndex('by_assetId', q => q.eq('assetId', row._id)).take(1)
      if (retained.length) await ctx.db.patch(row._id, { expiresAt: Date.now() + 24 * 60 * 60_000 })
      else {
        if (row.storageId) await ctx.storage.delete(row.storageId)
        const usage = await ctx.db.query('cloudAssetUsage').withIndex('by_owner', q => q.eq('owner', row.owner)).unique()
        if (usage) await ctx.db.patch(usage._id, { bytes: Math.max(0, usage.bytes - row.size), count: Math.max(0, usage.count - 1) })
        await ctx.db.delete(row._id)
      }
    }
    if (!args.pendingOnly) {
      const files = await ctx.db.system.query('_storage').paginate({ numItems: 25, cursor: args.cursor })
      for (const file of files.page) {
        if (file._creationTime >= Date.now() - 24 * 60 * 60_000) continue
        const asset = await ctx.db.query('cloudAssets').withIndex('by_storageId', q => q.eq('storageId', file._id)).unique()
        if (!asset) await ctx.storage.delete(file._id)
      }
      if (!files.isDone) await ctx.scheduler.runAfter(0, internal.cloudAssetMaintenance.collectOrphans, { cursor: files.continueCursor })
    }
    if (pending.length === 25 || unused.length === 25) await ctx.scheduler.runAfter(0, internal.cloudAssetMaintenance.collectOrphans, { cursor: null, pendingOnly: true })
    return null
  },
})
