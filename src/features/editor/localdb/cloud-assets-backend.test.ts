import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash, webcrypto } from 'node:crypto'
import { defineTestApp } from 'convex-test'
import rateLimiterTest from '@convex-dev/rate-limiter/test'
import { makeFunctionReference } from 'convex/server'
import schema from '../../../../convex/schema'
import * as cloudAssets from '../../../../convex/cloudAssets'
import * as cloudAssetMaintenance from '../../../../convex/cloudAssetMaintenance'
import * as cloudAssetUpload from '../../../../convex/cloudAssetUpload'
import * as http from '../../../../convex/http'
import * as communityBoard from '../../../../convex/communityBoard'
import * as cloudDocuments from '../../../../convex/cloudDocuments'
import * as community from '../../../../convex/community'
import { hydrateCloudDocument, serializeCloudDocument } from './cloud-asset-client'
import type { ConvexTransport } from './convex-transport'

const app = defineTestApp({ schema, components: { rateLimiter: rateLimiterTest } }).defineModules({ cloudAssets, cloudAssetMaintenance, cloudAssetUpload, http, cloudDocuments, community, communityBoard })
const doc = () => ({ objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })
function setup() {
  vi.stubEnv('CONVEX_SITE_URL', 'https://test.convex.site')
  const server = app.createTest(), alice = server.withIdentity({ subject: 'alice' }), bob = server.withIdentity({ subject: 'bob' })
  const transport = (actor: typeof alice): ConvexTransport => ({
    query: <T>(path: string, args: Record<string, unknown>) => actor.query(makeFunctionReference<'query', Record<string, unknown>, T>(path), args),
    uploadAsset: async (_url, id, blob, progress) => {
      progress?.(0)
      const response = await actor.fetch('/cloud-assets/upload', { method: 'POST', headers: { 'X-LeatherCad-Asset': id, 'Content-Type': blob.type }, body: blob })
      if (!response.ok) throw new Error(await response.text())
      progress?.(100)
    },
    mutation: <T>(path: string, args: Record<string, unknown>) => actor.mutation(makeFunctionReference<'mutation', Record<string, unknown>, T>(path), args),
  })
  const upload = async (bytes = new Uint8Array([1, 2, 3])) => {
    const reservation = await alice.mutation(app.api.cloudAssets.beginUpload, { name: 'Tracing', contentType: 'image/png', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    const storageId = await server.run(ctx => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type: 'image/png' })))
    await alice.mutation(app.api.cloudAssets.finishUpload, { id: reservation.id, storageId })
    return { id: reservation.id, storageId, bytes }
  }
  return { server, alice, bob, transport, upload }
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

describe('owner-authorized cloud asset storage', () => {
  it('checks upload reservations, digest/type/size and storage ownership', async () => {
    const { server, alice, bob, upload } = setup()
    await expect(server.mutation(app.api.cloudAssets.beginUpload, { name: 'X', contentType: 'image/png', size: 1, sha256: '0'.repeat(64) })).rejects.toThrow('Sign in')
    const asset = await upload()
    await expect(bob.mutation(app.api.cloudAssets.finishUpload, { id: asset.id, storageId: asset.storageId })).rejects.toThrow('not available')
    expect(await bob.query(app.api.cloudAssets.resolve, { id: asset.id, patternId: null, version: null })).toBeNull()
    expect(await alice.query(app.api.cloudAssets.resolve, { id: asset.id, patternId: null, version: null })).toMatchObject({ size: 3, contentType: 'image/png' })
    const other = await alice.mutation(app.api.cloudAssets.beginUpload, { name: 'Different', contentType: 'image/png', size: 4, sha256: '0'.repeat(64) })
    await expect(alice.mutation(app.api.cloudAssets.finishUpload, { id: other.id, storageId: asset.storageId })).rejects.toThrow('already assigned')
    const wrongFile = await server.run(ctx => ctx.storage.store(new Blob(['wrong'], { type: 'image/png' })))
    await expect(alice.mutation(app.api.cloudAssets.finishUpload, { id: other.id, storageId: wrongFile })).rejects.toThrow('does not match')
  })
  it('enforces quotas on reservations and releases unused files without touching retained assets', async () => {
    const { alice, server, upload } = setup()
    const asset = await upload()
    const drawing = { ...doc(), tracingOverlays: [{ sourceUrl: `lcad-asset:${asset.id}` }] }
    await alice.mutation(app.api.cloudDocuments.create, { id: 'drawing', name: 'Drawing', docJson: JSON.stringify(drawing) })
    await expect(alice.mutation(app.api.cloudAssets.remove, { id: asset.id })).rejects.toThrow('retained')
    await expect(alice.mutation(app.api.cloudAssets.beginUpload, { name: 'Too large', contentType: 'image/png', size: 9 * 1024 * 1024, sha256: '0'.repeat(64) })).rejects.toThrow('8 MiB')
    const reservations = []
    for (let n = 0; n < 7; n++) reservations.push(await alice.mutation(app.api.cloudAssets.beginUpload, { name: 'Reserved', contentType: 'image/png', size: 8 * 1024 * 1024, sha256: String(n).repeat(64) }))
    await expect(alice.mutation(app.api.cloudAssets.beginUpload, { name: 'Quota', contentType: 'image/png', size: 8 * 1024 * 1024, sha256: '9'.repeat(64) })).rejects.toThrow('quota')
    await alice.mutation(app.api.cloudAssets.remove, { id: reservations[0].id })
    await expect(alice.mutation(app.api.cloudAssets.beginUpload, { name: 'Released', contentType: 'image/png', size: 8 * 1024 * 1024, sha256: 'a'.repeat(64) })).resolves.toHaveProperty('uploadUrl')
    expect(await server.run(async ctx => (await ctx.storage.get(asset.storageId)) !== null)).toBe(true)
  })
  it('resolves only assets from the permitted public version and prevents cross-owner linking', async () => {
    const { server, alice, bob, upload } = setup()
    const asset = await upload(), drawing = { ...doc(), tracingOverlays: [{ sourceUrl: `lcad-asset:${asset.id}` }] }
    await expect(bob.mutation(app.api.cloudDocuments.create, { id: 'theft', name: 'Theft', docJson: JSON.stringify(drawing) })).rejects.toThrow('belongs to another')
    const published = await alice.mutation(app.api.community.publish, { id: null, expectedVersion: null, title: 'Pattern', description: '', attribution: 'Alice', license: 'CC-BY-4.0', visibility: 'private', docJson: JSON.stringify(drawing) })
    const args = { id: asset.id, patternId: published.id as never, version: 1 }
    expect(await server.query(app.api.cloudAssets.resolve, args)).toBeNull()
    await alice.mutation(app.api.community.setVisibility, { id: published.id as never, visibility: 'public', expectedVersion: 1, expectedVisibilityRevision: published.visibilityRevision })
    expect(await server.query(app.api.cloudAssets.resolve, args)).toMatchObject({ size: 3 })
    await alice.mutation(app.api.community.publish, { id: published.id as never, expectedVersion: 1, expectedVisibilityRevision: published.visibilityRevision + 1, title: 'Pattern', description: '', attribution: 'Alice', license: 'CC-BY-4.0', visibility: 'public', docJson: JSON.stringify(doc()) })
    expect(await server.query(app.api.cloudAssets.resolve, { ...args, version: 2 })).toBeNull()
    await expect(alice.mutation(app.api.cloudAssets.remove, { id: asset.id })).rejects.toThrow('retained')
  })
})

describe('bounded authenticated HTTP upload and discussion access', () => {
  it('rejects anonymous, cross-owner and oversized uploads before storing any bytes', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const { server, alice, bob } = setup()
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const reservation = await alice.mutation(app.api.cloudAssets.beginUpload, { name: 'Bounded.png', contentType: 'image/png', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    expect(reservation.uploadUrl).toBe('https://test.convex.site/cloud-assets/upload')
    const headers = { 'X-LeatherCad-Asset': reservation.id, 'Content-Type': 'image/png' }
    expect((await server.fetch('/cloud-assets/upload', { method: 'POST', headers, body: bytes })).status).toBe(401)
    expect((await bob.fetch('/cloud-assets/upload', { method: 'POST', headers, body: bytes })).ok).toBe(false)
    expect((await alice.fetch('/cloud-assets/upload', { method: 'POST', headers, body: new Uint8Array(9 * 1024 * 1024) })).ok).toBe(false)
    expect(await server.run(ctx => ctx.db.system.query('_storage').take(1))).toEqual([])
    expect((await alice.fetch('/cloud-assets/upload', { method: 'POST', headers, body: bytes })).ok).toBe(true)
    expect((await server.run(ctx => ctx.db.system.query('_storage').take(2)))).toHaveLength(1)
    expect((await alice.fetch('/cloud-assets/upload', { method: 'POST', headers, body: bytes })).ok).toBe(true)
    expect((await server.run(ctx => ctx.db.system.query('_storage').take(2)))).toHaveLength(1)
  })
  it('keeps draft images private, follows parent visibility, and rejects cross-owner attachments', async () => {
    const { server, alice, bob, upload } = setup()
    const asset = await upload()
    const topic = await alice.mutation(app.api.communityBoard.createTopic, { title: 'Image draft', body: 'A drawing', status: 'draft', attachments: [asset.id] })
    const resolve = { id: asset.id, patternId: null, version: null, board: { kind: 'topic' as const, id: topic.id } }
    expect(await server.query(app.api.cloudAssets.resolve, resolve)).toBeNull()
    expect(await bob.query(app.api.cloudAssets.resolve, resolve)).toBeNull()
    await expect(bob.mutation(app.api.communityBoard.createTopic, { title: 'Theft', body: 'Not my image', status: 'published', attachments: [asset.id] })).rejects.toThrow('belongs to another')
    const published = await alice.mutation(app.api.communityBoard.updateTopic, { id: topic.id, title: topic.title, body: topic.body, status: 'published', expectedRevision: topic.revision, attachments: [asset.id] })
    expect(await server.query(app.api.cloudAssets.resolve, resolve)).toMatchObject({ size: 3 })
    const reply = await alice.mutation(app.api.communityBoard.createPost, { topicId: topic.id, body: 'Reply image', attachments: [asset.id] })
    const replyResolve = { ...resolve, board: { kind: 'post' as const, id: reply.id } }
    expect(await server.query(app.api.cloudAssets.resolve, replyResolve)).toMatchObject({ size: 3 })
    await expect(alice.mutation(app.api.cloudAssets.remove, { id: asset.id })).rejects.toThrow('retained')
    await alice.mutation(app.api.communityBoard.updateTopic, { id: topic.id, title: topic.title, body: topic.body, status: 'draft', expectedRevision: published.revision })
    expect(await server.query(app.api.cloudAssets.resolve, replyResolve)).toBeNull()
    expect(await server.query(app.api.cloudAssets.resolve, resolve)).toBeNull()
  })
})

describe('cloud upload maintenance', () => {
  it('releases expired reservations and removes only unregistered old files', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T00:00:00Z'))
    const { server, alice, upload } = setup()
    const retained = await upload()
    await alice.mutation(app.api.cloudDocuments.create, { id: 'retained-image', name: 'Retained', docJson: JSON.stringify({ ...doc(), tracingOverlays: [{ sourceUrl: `lcad-asset:${retained.id}` }] }) })
    const reservation = await alice.mutation(app.api.cloudAssets.beginUpload, { name: 'Abandoned', contentType: 'image/png', size: 100, sha256: 'f'.repeat(64) })
    const orphan = await server.run(ctx => ctx.storage.store(new Blob(['orphan'], { type: 'image/png' })))
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'))
    await server.mutation(app.internal.cloudAssetMaintenance.collectOrphans, { cursor: null })
    expect(await server.run(async ctx => (await ctx.storage.get(orphan)) === null)).toBe(true)
    expect(await server.run(async ctx => (await ctx.storage.get(retained.storageId)) !== null)).toBe(true)
    expect(await server.run(ctx => ctx.db.get(reservation.id))).toBeNull()
    const usage = await server.run(ctx => ctx.db.query('cloudAssetUsage').take(1))
    expect(usage[0]).toMatchObject({ bytes: 3, count: 1 })
  })
})

describe('cloud image serialization and integrity', () => {
  it('offloads embedded assets, hydrates portable data URLs, and rejects corrupt bytes', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const { server, alice, transport } = setup(), client = transport(alice)
    const bytes = new Uint8Array(600 * 1024).fill(7)
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
    const dataUrl = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const sourceUrl = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
      const buffer = await server.run(async ctx => {
        const files = await ctx.db.system.query('_storage').take(129)
        const metadata = files.find(file => sourceUrl.endsWith(file.sha256))
        if (!metadata) throw new Error('Unknown storage URL')
        const blob = await ctx.storage.get(metadata._id)
        if (!blob) throw new Error('Missing storage bytes')
        return blob.arrayBuffer()
      })
      return new Response(buffer)
    })
    vi.stubGlobal('fetch', fetcher)
    const serialized = await serializeCloudDocument({ ...doc(), tracingOverlays: [{ sourceUrl: dataUrl }] }, client)
    expect(serialized).not.toContain(dataUrl)
    expect(serialized).toContain('lcad-asset:')
    const hydrated = JSON.parse(await hydrateCloudDocument(serialized, client)) as { tracingOverlays: { sourceUrl: string }[] }
    expect(hydrated.tracingOverlays[0].sourceUrl).toBe(dataUrl)
    const fontBytes = new Uint8Array(bytes); fontBytes.set([0, 1, 0, 0])
    const fontData = `data:font/ttf;base64,${Buffer.from(fontBytes).toString('base64')}`
    const fontSerialized = await serializeCloudDocument({ ...doc(), manufacturing: { engravingFont: { name: 'Uploaded.ttf', dataUrl: fontData } } }, client)
    const fontHydrated = JSON.parse(await hydrateCloudDocument(fontSerialized, client)) as { manufacturing: { engravingFont: { name: string; dataUrl: string } } }
    expect(fontHydrated.manufacturing.engravingFont).toEqual({ name: 'Uploaded.ttf', dataUrl: fontData })
    fetcher.mockImplementation(async () => new Response(new Uint8Array(bytes.length).fill(8)))
    await expect(hydrateCloudDocument(serialized, client)).rejects.toThrow('integrity')
  })
})
