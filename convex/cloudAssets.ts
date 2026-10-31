import { ConvexError, v } from 'convex/values'
import { ownerMutation, ownerQuery } from './authenticated'
import { query } from './_generated/server'
import { boundedText, cursor } from './validators'
import { limitResource } from './resourcePolicy'
import { documentAssetIds } from './cloudAssetReferences'

export const MAX_ASSET_BYTES = 8 * 1024 * 1024
export const MAX_ACCOUNT_ASSET_BYTES = 64 * 1024 * 1024
function digestMatches(stored: string, expectedHex: string): boolean {
  // Current system metadata uses base64; older SDK metadata used hex.
  if (stored === expectedHex) return true
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes = expectedHex.match(/../g)!.map(value => Number.parseInt(value, 16))
  let encoded = ''
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const value = (bytes[offset] << 16) | ((bytes[offset + 1] ?? 0) << 8) | (bytes[offset + 2] ?? 0)
    encoded += alphabet[(value >>> 18) & 63] + alphabet[(value >>> 12) & 63] + (offset + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : '=') + (offset + 2 < bytes.length ? alphabet[value & 63] : '=')
  }
  return stored === encoded
}
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'font/ttf', 'font/otf'])
export const beginUpload = ownerMutation({
  args: { name: v.string(), contentType: v.string(), size: v.number(), sha256: v.string() },
  returns: v.object({ id: v.id('cloudAssets'), uploadUrl: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.size) || args.size < 1 || args.size > MAX_ASSET_BYTES) throw new ConvexError('Each cloud asset must be between 1 byte and 8 MiB')
    if (args.contentType.startsWith('font/') && args.size > 4 * 1024 * 1024) throw new ConvexError('Manufacturing fonts are limited to 4 MiB')
    if (!allowedTypes.has(args.contentType) || !/^[a-f0-9]{64}$/.test(args.sha256)) throw new ConvexError('Unsupported cloud asset type or digest')
    const same = await ctx.db.query('cloudAssets').withIndex('by_owner_and_sha256', q => q.eq('owner', ctx.owner).eq('sha256', args.sha256)).take(129)
    const ready = same.find(row => row.storageId && row.size === args.size && row.contentType === args.contentType)
    if (ready) return { id: ready._id, uploadUrl: null }
    await limitResource(ctx, ctx.owner, 'assetUploads')
    const usage = await ctx.db.query('cloudAssetUsage').withIndex('by_owner', q => q.eq('owner', ctx.owner)).unique()
    if ((usage?.bytes ?? 0) + args.size > MAX_ACCOUNT_ASSET_BYTES || (usage?.count ?? 0) >= 128) throw new ConvexError('Cloud asset quota reached (64 MiB or 128 files). Remove unused assets first.')
    const next = { owner: ctx.owner, bytes: (usage?.bytes ?? 0) + args.size, count: (usage?.count ?? 0) + 1 }
    if (usage) await ctx.db.patch(usage._id, next)
    else await ctx.db.insert('cloudAssetUsage', next)
    const id = await ctx.db.insert('cloudAssets', { owner: ctx.owner, name: boundedText(args.name, 'Asset name'), contentType: args.contentType, size: args.size, sha256: args.sha256, createdAt: Date.now(), expiresAt: Date.now() + 60 * 60_000, state: 'pending' })
    let site: URL
    try {
      site = new URL(process.env.CONVEX_SITE_URL ?? '')
      const local = site.hostname === 'localhost' || site.hostname === '127.0.0.1'
      if ((site.protocol !== 'https:' && !(local && site.protocol === 'http:')) || site.username || site.password || site.search || site.hash || site.pathname !== '/') throw new Error('Invalid upload origin')
    } catch { throw new ConvexError('Cloud upload endpoint is not configured') }
    return { id, uploadUrl: `${site.origin}/cloud-assets/upload` }
  },
})
export const finishUpload = ownerMutation({
  args: { id: v.id('cloudAssets'), storageId: v.id('_storage') }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner) throw new ConvexError('Asset is not available')
    if (row.storageId) { if (row.storageId === args.storageId) return null; throw new ConvexError('This upload is already complete') }
    if (row.expiresAt < Date.now()) throw new ConvexError('Upload reservation expired. Remove it and try again.')
    const existing = await ctx.db.query('cloudAssets').withIndex('by_storageId', q => q.eq('storageId', args.storageId)).unique()
    if (existing) throw new ConvexError('That stored file is already assigned to an asset')
    const metadata = await ctx.db.system.get(args.storageId)
    if (!metadata || metadata.size !== row.size || metadata.contentType !== row.contentType || !digestMatches(metadata.sha256, row.sha256)) throw new ConvexError('Uploaded file size, type or digest does not match its reservation')
    await ctx.db.patch(row._id, { storageId: args.storageId, state: 'ready', expiresAt: Date.now() + 24 * 60 * 60_000 })
    return null
  },
})
export const resolve = query({
  args: { id: v.id('cloudAssets'), patternId: v.union(v.id('publishedPatterns'), v.null()), version: v.union(v.number(), v.null()), board: v.optional(v.union(v.object({ kind: v.literal('topic'), id: v.id('communityBoardTopics') }), v.object({ kind: v.literal('post'), id: v.id('communityBoardPosts') }))) },
  returns: v.union(v.object({ url: v.string(), size: v.number(), contentType: v.string(), sha256: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row?.storageId) return null
    const identity = await ctx.auth.getUserIdentity()
    if (identity?.tokenIdentifier !== row.owner) {
      if (args.board) {
        if (args.board.kind === 'topic') {
          const topic = await ctx.db.get(args.board.id)
          if (!topic || topic.status !== 'published' || !topic.attachments?.includes(args.id)) return null
        } else {
          const post = await ctx.db.get(args.board.id), topic = post ? await ctx.db.get(post.topicId) : null
          if (!post || post.status !== 'published' || !topic || topic.status !== 'published' || !post.attachments?.includes(args.id)) return null
        }
      } else {
        if (!args.patternId || args.version === null) return null
        const pattern = await ctx.db.get(args.patternId)
        const version = await ctx.db.query('publishedVersions').withIndex('by_patternId_and_version', q => q.eq('patternId', args.patternId!).eq('version', args.version!)).unique()
        if (!pattern || pattern.visibility !== 'public' || !version || version.visibility !== 'public' || !documentAssetIds(version.docJson).includes(args.id)) return null
      }
    }
    const url = await ctx.storage.getUrl(row.storageId)
    return url ? { url, size: row.size, contentType: row.contentType, sha256: row.sha256 } : null
  },
})
export const list = ownerQuery({
  args: { cursor }, returns: v.object({ page: v.array(v.object({ id: v.id('cloudAssets'), name: v.string(), size: v.number(), ready: v.boolean(), createdAt: v.number() })), continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query('cloudAssets').withIndex('by_owner', q => q.eq('owner', ctx.owner)).paginate({ numItems: 25, cursor: args.cursor })
    return { page: result.page.map(row => ({ id: row._id, name: row.name, size: row.size, ready: Boolean(row.storageId), createdAt: row.createdAt })), continueCursor: result.continueCursor, isDone: result.isDone }
  },
})
export const remove = ownerMutation({
  args: { id: v.id('cloudAssets') }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id)
    if (!row || row.owner !== ctx.owner) throw new ConvexError('Asset is not available')
    if ((await ctx.db.query('cloudAssetLinks').withIndex('by_assetId', q => q.eq('assetId', row._id)).take(1)).length) throw new ConvexError('This asset is retained by a drawing revision or publication')
    if (row.storageId) await ctx.storage.delete(row.storageId)
    const usage = await ctx.db.query('cloudAssetUsage').withIndex('by_owner', q => q.eq('owner', ctx.owner)).unique()
    if (usage) await ctx.db.patch(usage._id, { bytes: Math.max(0, usage.bytes - row.size), count: Math.max(0, usage.count - 1) })
    await ctx.db.delete(row._id)
    return null
  },
})
