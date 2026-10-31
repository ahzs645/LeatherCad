import { ConvexError } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'

export const PRIVATE_JSON_QUOTA_BYTES = 128 * 1024 * 1024
export const PRIVATE_DRAWING_QUOTA = 256
const managedFields = new Set(['_id', '_creationTime', 'owner', 'createdAt', 'updatedAt', 'publishedAt', 'savedAt', 'revision', 'visibilityRevision', 'replyCount', 'likeCount', 'deletedAt', 'purgingAt', 'moderatedAt', 'retiredAt', 'retiringAt'])
/** Canonical complete content payload; a minimum also bounds empty/tiny row counts.
 * Volatile server counters/timestamps are covered by the fixed per-row allowance. */
export function privateStoredBytes(value: Record<string, unknown>): number {
  return Math.max(256, new TextEncoder().encode(JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => !managedFields.has(key))))).length)
}
export const privateJsonBytes = (value: string) => new TextEncoder().encode(value).length
export const privateUsage = (ctx: QueryCtx | MutationCtx, owner: string) => ctx.db.query('cloudPrivateUsage').withIndex('by_owner', q => q.eq('owner', owner)).unique()
export async function privateQuotaLimits(ctx: QueryCtx | MutationCtx, owner: string) {
  const override = await ctx.db.query('cloudQuotaAllowances').withIndex('by_owner', q => q.eq('owner', owner)).unique()
  return { maximumBytes: override?.maximumBytes ?? PRIVATE_JSON_QUOTA_BYTES, maximumDrawings: override?.maximumDrawings ?? PRIVATE_DRAWING_QUOTA }
}
export async function ensurePrivateQuotaReady(ctx: MutationCtx, owner: string) {
  const usage = await privateUsage(ctx, owner)
  if (usage?.ready) return
  if (usage) throw new ConvexError('Index older cloud drawings before changing cloud content')
  const [documents, revisions, settings, patterns, topics, posts] = await Promise.all([
    ctx.db.query('cloudDocuments').withIndex('by_owner', q => q.eq('owner', owner)).take(1),
    ctx.db.query('cloudDocumentRevisions').withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', owner)).take(1),
    ctx.db.query('cloudSettings').withIndex('by_owner', q => q.eq('owner', owner)).take(1),
    ctx.db.query('publishedPatterns').withIndex('by_owner', q => q.eq('owner', owner)).take(1),
    ctx.db.query('communityBoardTopics').withIndex('by_owner_and_status', q => q.eq('owner', owner)).take(1),
    ctx.db.query('communityBoardPosts').withIndex('by_owner', q => q.eq('owner', owner)).take(1),
  ])
  if (documents.length || revisions.length || settings.length || patterns.length || topics.length || posts.length) throw new ConvexError('Index older cloud drawings before changing cloud content')
  await ctx.db.insert('cloudPrivateUsage', { owner, bytes: 0, drawings: 0, ready: true })
}
export async function chargePrivateJson(ctx: MutationCtx, owner: string, key: string, kind: 'drawing' | 'revision' | 'setting' | 'publication' | 'community', bytes: number, enforce = true) {
  const previous = await ctx.db.query('cloudPrivateLedger').withIndex('by_owner_and_key', q => q.eq('owner', owner).eq('key', key)).unique()
  const usage = await privateUsage(ctx, owner)
  if (!usage) throw new ConvexError('Cloud storage usage must be indexed first')
  const limits = await privateQuotaLimits(ctx, owner)
  const delta = bytes - (previous?.bytes ?? 0), drawings = usage.drawings + (kind === 'drawing' && !previous ? 1 : 0)
  if (enforce && ((delta > 0 && usage.bytes + delta > limits.maximumBytes) || (kind === 'drawing' && !previous && drawings > limits.maximumDrawings))) throw new ConvexError(`Cloud JSON quota reached (${limits.maximumBytes / 1024 / 1024} MiB or ${limits.maximumDrawings} drawings). Permanently delete unused drawings from Trash, clear unused library entries, or retire publication content to free space. Retained license metadata may require an operator allowance increase.`)
  if (previous) await ctx.db.patch(previous._id, { bytes })
  else await ctx.db.insert('cloudPrivateLedger', { owner, key, kind, bytes })
  await ctx.db.patch(usage._id, { bytes: usage.bytes + delta, drawings })
}
export async function releasePrivateJson(ctx: MutationCtx, owner: string, key: string) {
  const previous = await ctx.db.query('cloudPrivateLedger').withIndex('by_owner_and_key', q => q.eq('owner', owner).eq('key', key)).unique()
  if (!previous) return
  const usage = await privateUsage(ctx, owner)
  if (usage) await ctx.db.patch(usage._id, { bytes: Math.max(0, usage.bytes - previous.bytes), drawings: Math.max(0, usage.drawings - (previous.kind === 'drawing' ? 1 : 0)) })
  await ctx.db.delete(previous._id)
}
