import { ConvexError, v } from 'convex/values'
import { ownerMutation, ownerQuery } from './authenticated'
import { cursor } from './validators'

export const list = ownerQuery({
  args: { cursor }, returns: v.object({ page: v.array(v.object({ id: v.id('communityNotifications'), topicId: v.id('communityBoardTopics'), title: v.string(), createdAt: v.number(), read: v.boolean(), available: v.boolean() })), continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query('communityNotifications').withIndex('by_owner', q => q.eq('owner', ctx.owner)).order('desc').paginate({ numItems: 20, cursor: args.cursor })
    const page = await Promise.all(result.page.map(async row => {
      const topic = await ctx.db.get(row.topicId), available = Boolean(topic && topic.status !== 'removed' && (topic.status === 'published' || topic.owner === ctx.owner))
      return { id: row._id, topicId: row.topicId, title: available ? topic!.title : 'Discussion no longer available', createdAt: row.createdAt, read: Boolean(row.readAt), available }
    }))
    return { page, continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const markRead = ownerMutation({
  args: { id: v.id('communityNotifications') }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner) throw new ConvexError('Notification is not available')
    if (!row.readAt) await ctx.db.patch(row._id, { readAt: Date.now() })
    return null
  },
})
