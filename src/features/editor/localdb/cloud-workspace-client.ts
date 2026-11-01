import { hydrateCloudDocument } from './cloud-asset-client'
import { parseImportedJsonDocument } from '../editor-json-import'
import type { DocFile } from '../cad/cad-types'
import { readAllCloudPages } from './convex-data-client'
import { checkedCloudPage, type CloudPage } from './cloud-types'
import type { ConvexTransport } from './convex-transport'

export type CloudFolder = { id: string; name: string; parentId: string | null; revision: number; createdAt: number; updatedAt: number }
export type CloudWorkspaceDocument = { id: string; name: string; revision: number; updatedAt: number; folderId: string | null; locationRevision: number | null }
export type CloudDocumentRevision = { revision: number; name: string; savedAt: number; kind: 'save' | 'restore' | 'delete'; restoredFromRevision: number | null }
export type CloudRevisionDocument = { id: string; name: string; doc: DocFile; revision: number; createdAt: number; updatedAt: number }
type RemoteRevisionDocument = Omit<CloudRevisionDocument, 'doc'> & { docJson: string }

async function decode(record: RemoteRevisionDocument, transport: ConvexTransport): Promise<CloudRevisionDocument> {
  if (!record || typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.docJson !== 'string'
    || !Number.isSafeInteger(record.revision) || record.revision < 1) throw new Error('Cloud revision metadata is invalid')
  const { docJson, ...metadata } = record
  return { ...metadata, doc: parseImportedJsonDocument(await hydrateCloudDocument(docJson, transport), { preserveShapeIds: true }).doc }
}

export function createCloudWorkspaceClient(transport: ConvexTransport) {
  return {
    folders: {
      listPage: async (parentId: string | null = null, cursor: string | null = null) => checkedCloudPage(await transport.query<CloudPage<CloudFolder>>('cloudWorkspace:listFolders', { parentId, cursor })),
      listAllPage: async (cursor: string | null = null) => checkedCloudPage(await transport.query<CloudPage<CloudFolder>>('cloudWorkspace:listAllFolders', { cursor })),
      list: (parentId: string | null = null) => readAllCloudPages<CloudFolder>(cursor => transport.query('cloudWorkspace:listFolders', { parentId, cursor })),
      listAll: () => readAllCloudPages<CloudFolder>(cursor => transport.query('cloudWorkspace:listAllFolders', { cursor })),
      get: (id: string) => transport.query<CloudFolder | null>('cloudWorkspace:getFolder', { id }),
      create: (name: string, parentId: string | null = null) => transport.mutation<CloudFolder>('cloudWorkspace:createFolder', { name, parentId }),
      rename: (folder: CloudFolder, name: string) => transport.mutation<CloudFolder>('cloudWorkspace:renameFolder', { id: folder.id, name, expectedRevision: folder.revision }),
      move: (folder: CloudFolder, parentId: string | null) => transport.mutation<CloudFolder>('cloudWorkspace:moveFolder', { id: folder.id, parentId, expectedRevision: folder.revision }),
      remove: async (folder: CloudFolder) => { await transport.mutation('cloudWorkspace:removeFolder', { id: folder.id, expectedRevision: folder.revision }) },
    },
    documents: {
      listPage: async (folderId: string | null = null, cursor: string | null = null) => checkedCloudPage(await transport.query<CloudPage<CloudWorkspaceDocument>>('cloudWorkspace:listDocuments', { folderId, cursor })),
      historyPage: async (id: string, cursor: string | null = null) => checkedCloudPage(await transport.query<CloudPage<CloudDocumentRevision>>('cloudWorkspace:listHistory', { id, cursor })),
      list: (folderId: string | null = null) => readAllCloudPages<CloudWorkspaceDocument>(cursor => transport.query('cloudWorkspace:listDocuments', { folderId, cursor })),
      move: (doc: CloudWorkspaceDocument, folderId: string | null) => transport.mutation<CloudWorkspaceDocument>('cloudWorkspace:moveDocument', {
        id: doc.id, folderId, expectedRevision: doc.revision, expectedLocationRevision: doc.locationRevision,
      }),
      history: (id: string) => readAllCloudPages<CloudDocumentRevision>(cursor => transport.query('cloudWorkspace:listHistory', { id, cursor })),
      readRevision: async (id: string, revision: number): Promise<CloudRevisionDocument | null> => {
        const record = await transport.query<RemoteRevisionDocument | null>('cloudWorkspace:readRevision', { id, revision })
        return record ? decode(record, transport) : null
      },
      restore: async (doc: CloudWorkspaceDocument, revision: number) => decode(await transport.mutation<RemoteRevisionDocument>('cloudWorkspace:restoreRevision', { id: doc.id, revision, expectedRevision: doc.revision }), transport),
    },
  }
}
export type CloudWorkspaceClient = ReturnType<typeof createCloudWorkspaceClient>
