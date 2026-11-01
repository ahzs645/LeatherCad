import { ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

export async function validateBoardImages(ctx: MutationCtx, owner: string, ids: Id<'cloudAssets'>[] = []): Promise<Id<'cloudAssets'>[]> {
  const unique = [...new Set(ids)]
  if (unique.length > 6) throw new ConvexError('A topic or reply can contain at most six images')
  let bytes = 0
  for (const id of unique) {
    const row = await ctx.db.get(id)
    if (!row || row.owner !== owner || !row.storageId || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(row.contentType)) throw new ConvexError('A discussion image is unavailable, unsupported or belongs to another account')
    bytes += row.size
  }
  if (bytes > 24 * 1024 * 1024) throw new ConvexError('Discussion images are limited to 24 MiB in total')
  return unique
}
export async function replaceBoardImageLinks(ctx: MutationCtx, owner: string, kind: 'topic' | 'post', recordId: string, revision: number, ids: Id<'cloudAssets'>[]) {
  const existing = await ctx.db.query('cloudAssetLinks').withIndex('by_kind_and_recordId_and_revision', q => q.eq('kind', kind).eq('recordId', recordId)).take(7)
  for (const row of existing) await ctx.db.delete(row._id)
  for (const assetId of ids) await ctx.db.insert('cloudAssetLinks', { owner, kind, recordId, revision, assetId })
}
