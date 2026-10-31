import { ConvexError, v } from 'convex/values'
import { ownerMutation, ownerQuery } from './authenticated'
import { boundedText, cursor } from './validators'
import type { MutationCtx, QueryCtx } from './_generated/server'

async function find(ctx: QueryCtx | MutationCtx, owner: string, key: string) {
  return ctx.db.query('cloudSettings').withIndex('by_owner_and_key', q => q.eq('owner', owner).eq('key', key)).unique()
}
export const get = ownerQuery({
  args: { key: v.string() }, returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => (await find(ctx, ctx.owner, args.key))?.value ?? null,
})
export const list = ownerQuery({
  args: { cursor }, returns: v.object({ page: v.array(v.object({ key: v.string(), value: v.string() })), continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query('cloudSettings').withIndex('by_owner', q => q.eq('owner', ctx.owner)).paginate({ numItems: 5, cursor: args.cursor })
    return { page: result.page.map(({ key, value }) => ({ key, value })), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const set = ownerMutation({
  args: { key: v.string(), value: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const key = boundedText(args.key, 'Setting key')
    if (new TextEncoder().encode(args.value).length > 512 * 1024) throw new ConvexError('Library entry is too large for cloud sync (512 KiB)')
    const row = await find(ctx, ctx.owner, key)
    if (row) await ctx.db.patch(row._id, { value: args.value })
    else await ctx.db.insert('cloudSettings', { owner: ctx.owner, key, value: args.value })
    return null
  },
})
export const remove = ownerMutation({
  args: { key: v.string() }, returns: v.null(),
  handler: async (ctx, args) => { const row = await find(ctx, ctx.owner, args.key); if (row) await ctx.db.delete(row._id); return null },
})
