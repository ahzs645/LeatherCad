import { chargePrivateJson, privateStoredBytes } from './cloudPrivateQuota'
import { mirrorDocumentMetadata } from './cloudDocumentMetadata'
import { pruneDocumentHistory } from './cloudRetention'
import { retainDocumentAssets } from './cloudAssetReferences'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

type RevisionSource = Pick<Doc<'cloudDocuments'>, '_id' | 'owner' | 'clientId' | 'name' | 'docJson' | 'revision' | 'updatedAt' | 'deletedAt'>

/** Called in the same transaction as a content save. Snapshots are never patched. */
export async function recordDocumentRevision(
  ctx: MutationCtx,
  row: RevisionSource,
  kind: 'save' | 'restore' | 'delete' = 'save',
  restoredFromRevision?: number,
) {
  await pruneDocumentHistory(ctx, row)
  await mirrorDocumentMetadata(ctx, row, kind !== 'delete')
  const existing = await ctx.db.query('cloudDocumentRevisions')
    .withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', row.owner).eq('documentId', row._id).eq('revision', row.revision))
    .unique()
  const snapshot = existing ?? {
    owner: row.owner, documentId: row._id, revision: row.revision, name: row.name,
    docJson: row.docJson, kind, savedAt: Date.now(),
    ...(restoredFromRevision === undefined ? {} : { restoredFromRevision }),
  }
  await chargePrivateJson(ctx, row.owner, `revision:${row._id}:${row.revision}`, 'revision', privateStoredBytes(snapshot), kind !== 'delete')
  if (!existing) {
    await retainDocumentAssets(ctx, row.owner, row.docJson, 'document', row._id, row.revision)
    await ctx.db.insert('cloudDocumentRevisions', snapshot)
  }
  const location = await ctx.db.query('cloudDocumentLocations')
    .withIndex('by_owner_and_documentId', q => q.eq('owner', row.owner).eq('documentId', row._id)).unique()
  if (kind === 'delete') {
    if (location) await ctx.db.delete(location._id)
  } else if (!location) {
    await ctx.db.insert('cloudDocumentLocations', { owner: row.owner, documentId: row._id, folderId: null, revision: 1, updatedAt: Date.now() })
  }
}
