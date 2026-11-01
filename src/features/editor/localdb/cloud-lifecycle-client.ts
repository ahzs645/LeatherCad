import { hydrateCloudDocument, serializeCloudDocument } from './cloud-asset-client'
import type { DocFile } from '../cad/cad-types'
import { parseImportedJsonDocument } from '../editor-json-import'
import { checkedCloudPage, type CloudPage } from './cloud-types'
import type { ConvexTransport } from './convex-transport'

export type CloudDrawingSummary = { id: string; name: string; revision: number; updatedAt: number; deletedAt: number | null }
type RemoteDrawing = { id: string; name: string; revision: number; docJson: string; createdAt: number; updatedAt: number }
export function createCloudLifecycleClient(transport: ConvexTransport) {
  const decode = async (row: RemoteDrawing) => {
    if (!row || typeof row.docJson !== 'string' || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error('Cloud drawing metadata is invalid')
    return { ...row, doc: parseImportedJsonDocument(await hydrateCloudDocument(row.docJson, transport), { preserveShapeIds: true }).doc }
  }
  return {
    listPage: async (trash = false, cursor: string | null = null) => checkedCloudPage(await transport.query<CloudPage<CloudDrawingSummary>>('cloudLifecycle:list', { trash, cursor })),
    indexLegacyPage: (cursor: string | null = null) => transport.mutation<{ continueCursor: string; isDone: boolean; indexed: number }>('cloudLifecycle:indexLegacyPage', { cursor }),
    get: async (id: string) => {
      const row = await transport.query<RemoteDrawing | null>('cloudDocuments:get', { id })
      return row ? decode(row) : null
    },
    update: async (snapshot: CloudDrawingSummary, doc: DocFile) => decode(await transport.mutation<RemoteDrawing>('cloudDocuments:save', {
      id: snapshot.id, name: doc.documentName ?? snapshot.name, docJson: await serializeCloudDocument(doc, transport), expectedRevision: snapshot.revision,
    })),
    rename: (snapshot: CloudDrawingSummary, name: string) => transport.mutation<CloudDrawingSummary>('cloudLifecycle:rename', { id: snapshot.id, name, expectedRevision: snapshot.revision }),
    remove: async (snapshot: CloudDrawingSummary) => { await transport.mutation('cloudDocuments:remove', { id: snapshot.id, expectedRevision: snapshot.revision }) },
    purge: async (snapshot: CloudDrawingSummary) => { await transport.mutation('cloudQuota:purge', { id: snapshot.id, expectedRevision: snapshot.revision }) },
    restore: async (snapshot: CloudDrawingSummary) => decode(await transport.mutation<RemoteDrawing>('cloudWorkspace:restoreRevision', {
      id: snapshot.id, revision: snapshot.revision, expectedRevision: snapshot.revision,
    })),
  }
}
