import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { license, visibility } from './validators'
import { cloudWorkspaceTables } from './cloudWorkspaceSchema'
import { communityBoardTables } from './communityBoardSchema'

export default defineSchema({
  ...cloudWorkspaceTables,
  ...communityBoardTables,
  cloudDocuments: defineTable({
    owner: v.string(), clientId: v.string(), name: v.string(), docJson: v.string(),
    createdAt: v.number(), updatedAt: v.number(), revision: v.number(), deletedAt: v.optional(v.number()),
  }).index('by_owner', ['owner']).index('by_owner_and_clientId', ['owner', 'clientId']),
  cloudSettings: defineTable({ owner: v.string(), key: v.string(), value: v.string() })
    .index('by_owner', ['owner']).index('by_owner_and_key', ['owner', 'key']),
  publishedPatterns: defineTable({
    owner: v.string(), author: v.string(), title: v.string(), description: v.string(),
    license, attribution: v.string(), visibility, docJson: v.string(), version: v.number(), publishedAt: v.number(),
  }).index('by_owner', ['owner']).index('by_visibility', ['visibility']),
  publishedVersions: defineTable({
    patternId: v.id('publishedPatterns'), version: v.number(), title: v.string(), description: v.string(), author: v.string(),
    license, attribution: v.string(), visibility, docJson: v.string(), publishedAt: v.number(),
  }).index('by_patternId_and_version', ['patternId', 'version']),
})
