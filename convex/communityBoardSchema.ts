import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const boardTopicStatus = v.union(v.literal('draft'), v.literal('published'), v.literal('removed'))
export const boardPostStatus = v.union(v.literal('published'), v.literal('removed'))

export const communityBoardTables = {
  communityBoardAuthors: defineTable({ owner: v.string() }).index('by_owner', ['owner']),
  communityBoardTopics: defineTable({
    owner: v.string(), authorId: v.id('communityBoardAuthors'), title: v.string(), body: v.string(),
    attachments: v.optional(v.array(v.id('cloudAssets'))), status: boardTopicStatus, revision: v.number(), createdAt: v.number(), updatedAt: v.number(), replyCount: v.number(), likeCount: v.number(),
  }).index('by_status_and_updatedAt', ['status', 'updatedAt'])
    .index('by_owner_and_status', ['owner', 'status']).searchIndex('search_public_title', { searchField: 'title', filterFields: ['status'] }),
  communityBoardPosts: defineTable({
    owner: v.string(), authorId: v.id('communityBoardAuthors'), topicId: v.id('communityBoardTopics'),
    body: v.string(), attachments: v.optional(v.array(v.id('cloudAssets'))), status: boardPostStatus, revision: v.number(), createdAt: v.number(), updatedAt: v.number(), likeCount: v.number(),
  }).index('by_topicId_and_status', ['topicId', 'status']).index('by_owner', ['owner']),
  communityBoardLikes: defineTable({
    owner: v.string(), targetId: v.union(v.id('communityBoardTopics'), v.id('communityBoardPosts')),
  }).index('by_targetId_and_owner', ['targetId', 'owner']),
}
