import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { ConvexError } from 'convex/values'
import { components } from './_generated/api'
import type { MutationCtx } from './_generated/server'

const limiter = new RateLimiter(components.rateLimiter, {
  cloudWrites: { kind: 'token bucket', rate: 120, period: MINUTE, capacity: 300 },
  communityWrites: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 60 },
  assetTransfers: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 128 },
  assetUploads: { kind: 'token bucket', rate: 10, period: MINUTE, capacity: 64 },
})
export async function limitResource(ctx: MutationCtx, owner: string, resource: 'cloudWrites' | 'communityWrites' | 'assetUploads' | 'assetTransfers') {
  const status = await limiter.limit(ctx, resource, { key: owner })
  if (!status.ok) throw new ConvexError(`Too many requests. Try again in ${Math.max(1, Math.ceil(status.retryAfter / 1000))} seconds.`)
}
