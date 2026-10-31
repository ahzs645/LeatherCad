import { limitResource } from './resourcePolicy'
import { ConvexError, v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'

const reservation = v.object({ owner: v.string(), size: v.number(), contentType: v.string(), sha256: v.string(), storageId: v.union(v.id('_storage'), v.null()), attempt: v.number() })
export const inspect = internalQuery({
  args: { id: v.id('cloudAssets'), owner: v.string() }, returns: v.union(reservation, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    return row?.owner === args.owner ? { owner: row.owner, size: row.size, contentType: row.contentType, sha256: row.sha256, storageId: row.storageId ?? null, attempt: row.uploadAttempt ?? 0 } : null
  },
})
export const claim = internalMutation({
  args: { id: v.id('cloudAssets'), owner: v.string() }, returns: reservation,
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== args.owner) throw new ConvexError('Upload reservation is not available')
    if (!row.storageId && row.expiresAt <= Date.now()) throw new ConvexError('Upload reservation expired')
    if (!row.storageId && typeof row.uploadingAt === 'number' && row.uploadingAt > Date.now() - 120_000) throw new ConvexError('This upload is already in progress; retry in two minutes')
    if (!row.storageId) await limitResource(ctx, args.owner, 'assetTransfers')
    const attempt = (row.uploadAttempt ?? 0) + 1
    if (!row.storageId) await ctx.db.patch(row._id, { uploadingAt: Date.now(), uploadAttempt: attempt })
    return { owner: row.owner, size: row.size, contentType: row.contentType, sha256: row.sha256, storageId: row.storageId ?? null, attempt }
  },
})
export const finish = internalMutation({
  args: { id: v.id('cloudAssets'), owner: v.string(), storageId: v.id('_storage'), attempt: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== args.owner || row.storageId || row.uploadAttempt !== args.attempt || row.expiresAt <= Date.now()) throw new ConvexError('Upload reservation changed; retry the upload')
    // The authenticated HTTP action verified the exact bytes before storage.store.
    await ctx.db.patch(row._id, { storageId: args.storageId, state: 'ready', expiresAt: Date.now() + 24 * 60 * 60_000, uploadingAt: undefined })
    return null
  },
})
export const release = internalMutation({
  args: { id: v.id('cloudAssets'), owner: v.string(), attempt: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (row?.owner === args.owner && !row.storageId && row.uploadAttempt === args.attempt) await ctx.db.patch(row._id, { uploadingAt: undefined })
    return null
  },
})
