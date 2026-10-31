import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { license, visibility } from './validators'
import { communityOperationsTables } from './communityOperationsSchema'
import { cloudAssetTables } from './cloudAssetSchema'
import { cloudWorkspaceTables } from './cloudWorkspaceSchema'
import { communityBoardTables } from './communityBoardSchema'

export default defineSchema({
  ...cloudWorkspaceTables,
  ...cloudAssetTables,
  ...communityOperationsTables,
  ...communityBoardTables,
  cloudDocuments: defineTable({
    owner: v.string(), clientId: v.string(), name: v.string(), docJson: v.string(),
    createdAt: v.number(), updatedAt: v.number(), revision: v.number(), deletedAt: v.optional(v.number()), purgingAt: v.optional(v.number()),
  }).index('by_owner', ['owner']).index('by_owner_and_clientId', ['owner', 'clientId']),
  cloudQuotaAllowances: defineTable({ owner: v.string(), maximumBytes: v.number(), maximumDrawings: v.number(), updatedAt: v.number() }).index('by_owner', ['owner']),
  cloudPrivateUsage: defineTable({ owner: v.string(), bytes: v.number(), drawings: v.number(), ready: v.boolean(), phase: v.optional(v.union(v.literal('drawings'), v.literal('revisions'), v.literal('settings'), v.literal('patterns'), v.literal('topics'), v.literal('posts'))), cursor: v.optional(v.union(v.string(), v.null())), patternId: v.optional(v.id('publishedPatterns')), patternCursor: v.optional(v.union(v.string(), v.null())), patternsDone: v.optional(v.boolean()) }).index('by_owner', ['owner']),
  cloudPrivateLedger: defineTable({ owner: v.string(), key: v.string(), kind: v.union(v.literal('drawing'), v.literal('revision'), v.literal('setting'), v.literal('publication'), v.literal('community')), bytes: v.number() }).index('by_owner_and_key', ['owner', 'key']),
  cloudDocumentMetadata: defineTable({ owner: v.string(), clientId: v.string(), documentId: v.id('cloudDocuments'), name: v.string(), revision: v.number(), updatedAt: v.number(), deletedAt: v.optional(v.number()) }).index('by_owner', ['owner']).index('by_owner_and_clientId', ['owner', 'clientId']),
  cloudSettings: defineTable({ owner: v.string(), key: v.string(), value: v.string() })
    .index('by_owner', ['owner']).index('by_owner_and_key', ['owner', 'key']),
  publishedPatterns: defineTable({
    owner: v.string(), author: v.string(), title: v.string(), description: v.string(),
    license, attribution: v.string(), visibility, docJson: v.string(), version: v.number(), publishedAt: v.number(), visibilityRevision: v.optional(v.number()), moderatedAt: v.optional(v.number()), retiredAt: v.optional(v.number()), retiringAt: v.optional(v.number()),
  }).index('by_owner', ['owner']).index('by_visibility', ['visibility']).searchIndex('search_public_title', { searchField: 'title', filterFields: ['visibility'] }),
  publishedVersions: defineTable({
    patternId: v.id('publishedPatterns'), version: v.number(), title: v.string(), description: v.string(), author: v.string(),
    license, attribution: v.string(), visibility, docJson: v.string(), publishedAt: v.number(), retiredAt: v.optional(v.number()),
  }).index('by_patternId_and_version', ['patternId', 'version']),
})
