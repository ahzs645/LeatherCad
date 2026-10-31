import type { Doc } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

type RevisionSource = Pick<Doc<'cloudDocuments'>, '_id' | 'owner' | 'name' | 'docJson' | 'revision'>

/** Called in the same transaction as a content save. Snapshots are never patched. */
export async function recordDocumentRevision(
  ctx: MutationCtx,
  row: RevisionSource,
  kind: 'save' | 'restore' | 'delete' = 'save',
  restoredFromRevision?: number,
) {
  const existing = await ctx.db.query('cloudDocumentRevisions')
    .withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', row.owner).eq('documentId', row._id).eq('revision', row.revision))
    .unique()
  if (!existing) {
    await ctx.db.insert('cloudDocumentRevisions', {
      owner: row.owner, documentId: row._id, revision: row.revision, name: row.name,
      docJson: row.docJson, kind, savedAt: Date.now(),
      ...(restoredFromRevision === undefined ? {} : { restoredFromRevision }),
    })
  }
  const location = await ctx.db.query('cloudDocumentLocations')
    .withIndex('by_owner_and_documentId', q => q.eq('owner', row.owner).eq('documentId', row._id)).unique()
  if (kind === 'delete') {
    if (location) await ctx.db.delete(location._id)
  } else if (!location) {
    await ctx.db.insert('cloudDocumentLocations', { owner: row.owner, documentId: row._id, folderId: null, revision: 1, updatedAt: Date.now() })
  }
}
