import { releasePrivateJson } from './cloudPrivateQuota'
import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'

export const RETAINED_DOCUMENT_REVISIONS = 100
/** Indexed revision range keeps each cleanup read below five 512 KiB rows. */
export async function pruneDocumentHistory(ctx: MutationCtx, row: Pick<Doc<'cloudDocuments'>, '_id' | 'owner' | 'revision'>) {
  const expired = await ctx.db.query('cloudDocumentRevisions').withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', row.owner).eq('documentId', row._id).lt('revision', row.revision - RETAINED_DOCUMENT_REVISIONS + 1)).take(5)
  for (const revision of expired) {
    const links = await ctx.db.query('cloudAssetLinks').withIndex('by_kind_and_recordId_and_revision', q => q.eq('kind', 'document').eq('recordId', row._id).eq('revision', revision.revision)).take(65)
    for (const link of links) await ctx.db.delete(link._id)
    await releasePrivateJson(ctx, row.owner, `revision:${row._id}:${revision.revision}`)
    await ctx.db.delete(revision._id)
  }
}
