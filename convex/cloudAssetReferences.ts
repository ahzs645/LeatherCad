import { ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

export const ASSET_PREFIX = 'lcad-asset:'
export function documentAssetIds(docJson: string): string[] {
  const ids = new Set<string>()
  const visit = (value: unknown, depth: number) => {
    if (depth > 80) throw new ConvexError('Drawing structure is too deep')
    if (typeof value === 'string' && value.startsWith(ASSET_PREFIX)) ids.add(value.slice(ASSET_PREFIX.length))
    else if (Array.isArray(value)) value.forEach(item => visit(item, depth + 1))
    else if (value && typeof value === 'object') Object.values(value).forEach(item => visit(item, depth + 1))
  }
  visit(JSON.parse(docJson), 0)
  if (ids.size > 64) throw new ConvexError('A cloud drawing can reference at most 64 assets')
  return [...ids]
}
export async function validateDocumentAssets(ctx: QueryCtx | MutationCtx, owner: string, docJson: string): Promise<Id<'cloudAssets'>[]> {
  const ids: Id<'cloudAssets'>[] = []
  for (const value of documentAssetIds(docJson)) {
    const id = ctx.db.normalizeId('cloudAssets', value), row = id ? await ctx.db.get(id) : null
    if (!id || !row || row.owner !== owner || !row.storageId) throw new ConvexError('A drawing asset is unavailable or belongs to another account')
    ids.push(id)
  }
  return ids
}
export async function retainDocumentAssets(ctx: MutationCtx, owner: string, docJson: string, kind: 'document' | 'pattern', recordId: string, revision: number) {
  const ids = await validateDocumentAssets(ctx, owner, docJson)
  for (const assetId of ids) await ctx.db.insert('cloudAssetLinks', { assetId, owner, kind, recordId, revision })
}
