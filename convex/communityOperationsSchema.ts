import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const moderationTarget = v.union(v.object({ kind: v.literal('topic'), id: v.id('communityBoardTopics') }), v.object({ kind: v.literal('post'), id: v.id('communityBoardPosts') }), v.object({ kind: v.literal('pattern'), id: v.id('publishedPatterns') }))
export const communityOperationsTables = {
  communityReports: defineTable({ reporter: v.string(), target: moderationTarget, targetKey: v.string(), reason: v.string(), status: v.union(v.literal('open'), v.literal('resolved')), createdAt: v.number() })
    .index('by_status', ['status']).index('by_reporter_and_targetKey_and_status', ['reporter', 'targetKey', 'status']),
  communityModerationAudit: defineTable({ moderator: v.string(), target: moderationTarget, action: v.union(v.literal('hide'), v.literal('dismiss')), reason: v.string(), targetRevision: v.number(), createdAt: v.number() })
    .index('by_createdAt', ['createdAt']),
  communityNotifications: defineTable({ owner: v.string(), topicId: v.id('communityBoardTopics'), createdAt: v.number(), readAt: v.optional(v.number()) })
    .index('by_owner', ['owner']),
}
