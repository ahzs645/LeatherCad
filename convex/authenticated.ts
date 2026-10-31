import { ConvexError } from 'convex/values'
import { customCtx, customMutation, customQuery } from 'convex-helpers/server/customFunctions'
import { mutation, query, type QueryCtx } from './_generated/server'

async function requireIdentity(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Sign in to access your cloud library')
  return { owner: identity.tokenIdentifier, author: (identity.name ?? identity.nickname ?? 'Community member').slice(0, 200) }
}
export const ownerQuery = customQuery(query, customCtx(requireIdentity))
export const ownerMutation = customMutation(mutation, customCtx(requireIdentity))
