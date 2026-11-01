import { chargePrivateJson, privateStoredBytes } from './cloudPrivateQuota'
import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'

type MetadataSource = Pick<Doc<'cloudDocuments'>, '_id' | 'owner' | 'clientId' | 'name' | 'revision' | 'updatedAt' | 'deletedAt' | 'docJson'>
export async function mirrorDocumentMetadata(ctx: MutationCtx, row: MetadataSource, enforce = true) {
  await chargePrivateJson(ctx, row.owner, `drawing:${row._id}`, 'drawing', privateStoredBytes(row), enforce)
  const previous = await ctx.db.query('cloudDocumentMetadata').withIndex('by_owner_and_clientId', q => q.eq('owner', row.owner).eq('clientId', row.clientId)).unique()
  const update = { owner: row.owner, clientId: row.clientId, documentId: row._id, name: row.name, revision: row.revision, updatedAt: row.updatedAt, deletedAt: row.deletedAt }
  if (previous) await ctx.db.patch(previous._id, update)
  else await ctx.db.insert('cloudDocumentMetadata', update)
}
