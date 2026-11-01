import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const nullableFolderId = v.union(v.id('cloudFolders'), v.null())
export const revisionKind = v.union(v.literal('save'), v.literal('restore'), v.literal('delete'))

export const cloudWorkspaceTables = {
  cloudFolders: defineTable({
    owner: v.string(), name: v.string(), nameKey: v.string(), parentId: nullableFolderId,
    revision: v.number(), createdAt: v.number(), updatedAt: v.number(),
  }).index('by_owner_and_parentId', ['owner', 'parentId'])
    .index('by_owner_and_parentId_and_nameKey', ['owner', 'parentId', 'nameKey']),
  cloudDocumentLocations: defineTable({
    owner: v.string(), documentId: v.id('cloudDocuments'), folderId: nullableFolderId,
    revision: v.number(), updatedAt: v.number(),
  }).index('by_owner_and_documentId', ['owner', 'documentId'])
    .index('by_owner_and_folderId', ['owner', 'folderId']),
  cloudDocumentRevisions: defineTable({
    owner: v.string(), documentId: v.id('cloudDocuments'), revision: v.number(),
    name: v.string(), docJson: v.string(), savedAt: v.number(), kind: revisionKind,
    restoredFromRevision: v.optional(v.number()),
  }).index('by_owner_and_documentId_and_revision', ['owner', 'documentId', 'revision']),
}

export const workspaceFolder = v.object({
  id: v.id('cloudFolders'), name: v.string(), parentId: nullableFolderId,
  revision: v.number(), createdAt: v.number(), updatedAt: v.number(),
})
export const workspaceDocument = v.object({
  id: v.string(), name: v.string(), revision: v.number(), updatedAt: v.number(),
  folderId: nullableFolderId, locationRevision: v.union(v.number(), v.null()),
})
export const workspaceRevision = v.object({
  revision: v.number(), name: v.string(), savedAt: v.number(), kind: revisionKind,
  restoredFromRevision: v.union(v.number(), v.null()),
})
