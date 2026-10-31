import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const cloudAssetTables = {
  cloudAssets: defineTable({ owner: v.string(), name: v.string(), contentType: v.string(), size: v.number(), sha256: v.string(), createdAt: v.number(), expiresAt: v.number(), state: v.union(v.literal('pending'), v.literal('ready')), uploadingAt: v.optional(v.number()), uploadAttempt: v.optional(v.number()), storageId: v.optional(v.id('_storage')) })
    .index('by_owner', ['owner']).index('by_owner_and_sha256', ['owner', 'sha256']).index('by_storageId', ['storageId']).index('by_state_and_expiresAt', ['state', 'expiresAt']),
  cloudAssetUsage: defineTable({ owner: v.string(), bytes: v.number(), count: v.number() }).index('by_owner', ['owner']),
  cloudAssetLinks: defineTable({ assetId: v.id('cloudAssets'), owner: v.string(), kind: v.union(v.literal('document'), v.literal('pattern'), v.literal('topic'), v.literal('post')), recordId: v.string(), revision: v.number() })
    .index('by_assetId', ['assetId']).index('by_kind_and_recordId_and_revision', ['kind', 'recordId', 'revision']),
}
