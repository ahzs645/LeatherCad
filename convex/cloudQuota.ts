import { ConvexError, v } from 'convex/values'
import { ownerMutation, ownerQuery } from './authenticated'
import { ensurePrivateQuotaReady, privateQuotaLimits, privateUsage } from './cloudPrivateQuota'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'

export const status = ownerQuery({
  args: {}, returns: v.object({ bytes: v.number(), drawings: v.number(), ready: v.boolean(), maximumBytes: v.number(), maximumDrawings: v.number() }),
  handler: async ctx => {
    const usage = await privateUsage(ctx, ctx.owner)
    const limits = await privateQuotaLimits(ctx, ctx.owner)
    return { bytes: usage?.bytes ?? 0, drawings: usage?.drawings ?? 0, ready: usage?.ready ?? false, ...limits }
  },
})
export const purge = ownerMutation({
  args: { id: v.string(), expectedRevision: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    await ensurePrivateQuotaReady(ctx, ctx.owner)
    const row = await ctx.db.query('cloudDocuments').withIndex('by_owner_and_clientId', q => q.eq('owner', ctx.owner).eq('clientId', args.id)).unique()
    if (!row || !row.deletedAt) throw new ConvexError('Only a drawing in your Trash can be permanently deleted')
    if (row.revision !== args.expectedRevision) throw new ConvexError('Cloud drawing changed; refresh before permanently deleting')
    if (!row.purgingAt) {
      await ctx.db.patch(row._id, { purgingAt: Date.now() })
      await ctx.scheduler.runAfter(0, internal.cloudPrivateMaintenance.purgeDrawing, { documentId: row._id, owner: ctx.owner })
    }
    return null
  },
})

/** Operator-only recovery/configuration; no browser role can grant allowances. */
export const setAllowance = internalMutation({
  args: { owner: v.string(), maximumBytes: v.number(), maximumDrawings: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.owner || args.owner.length > 1000 || !Number.isSafeInteger(args.maximumBytes) || args.maximumBytes < 1024 * 1024 || args.maximumBytes > 4 * 1024 * 1024 * 1024 || !Number.isSafeInteger(args.maximumDrawings) || args.maximumDrawings < 1 || args.maximumDrawings > 10000) throw new ConvexError('Invalid operator quota allowance')
    const previous = await ctx.db.query('cloudQuotaAllowances').withIndex('by_owner', q => q.eq('owner', args.owner)).unique()
    const value = { ...args, updatedAt: Date.now() }
    if (previous) await ctx.db.patch(previous._id, value)
    else await ctx.db.insert('cloudQuotaAllowances', value)
    return null
  },
})
