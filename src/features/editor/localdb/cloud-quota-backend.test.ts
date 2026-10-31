import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineTestApp } from 'convex-test'
import rateLimiterTest from '@convex-dev/rate-limiter/test'
import schema from '../../../../convex/schema'
import * as cloudDocuments from '../../../../convex/cloudDocuments'
import * as cloudSettings from '../../../../convex/cloudSettings'
import * as cloudLifecycle from '../../../../convex/cloudLifecycle'
import * as cloudQuota from '../../../../convex/cloudQuota'
import * as cloudPrivateMaintenance from '../../../../convex/cloudPrivateMaintenance'
import * as community from '../../../../convex/community'
import * as communityBoard from '../../../../convex/communityBoard'
import * as cloudAssets from '../../../../convex/cloudAssets'
import * as cloudPublicationMaintenance from '../../../../convex/cloudPublicationMaintenance'
import { createHash } from 'node:crypto'
import { PRIVATE_DRAWING_QUOTA, PRIVATE_JSON_QUOTA_BYTES, privateJsonBytes, privateStoredBytes } from '../../../../convex/cloudPrivateQuota'
import type { Doc } from '../../../../convex/_generated/dataModel'

const app = defineTestApp({ schema, components: { rateLimiter: rateLimiterTest } }).defineModules({ cloudDocuments, cloudSettings, cloudLifecycle, cloudQuota, cloudPrivateMaintenance, community, communityBoard, cloudAssets, cloudPublicationMaintenance })
const owner = 'issuer|alice', otherOwner = 'issuer|bob'
const drawing = (memo = '縫い目 🧵') => JSON.stringify({ documentName: 'Wallet', projectMemo: memo, objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })
function setup() {
  const server = app.createTest(), alice = server.withIdentity({ tokenIdentifier: owner, subject: 'alice' }), bob = server.withIdentity({ tokenIdentifier: otherOwner, subject: 'bob' })
  const create = (id = 'wallet', docJson = drawing()) => alice.mutation(app.api.cloudDocuments.create, { id, name: id, docJson })
  const status = () => alice.query(app.api.cloudQuota.status, {})
  return { server, alice, bob, create, status }
}
type TestServer = ReturnType<typeof setup>['server']
/** Capacity fixtures represent unrelated, already-accounted JSON without
 * allocating128MiB in each test. Ledger and aggregate totals remain consistent. */
async function fillRemaining(server: TestServer, remaining = 0) {
  return server.run(async ctx => {
    const usage = await ctx.db.query('cloudPrivateUsage').withIndex('by_owner', q => q.eq('owner', owner)).unique()
    if (!usage) throw new Error('Initialize usage before adding capacity pressure')
    const added = PRIVATE_JSON_QUOTA_BYTES - remaining - usage.bytes
    await ctx.db.insert('cloudPrivateLedger', { owner, key: 'setting:unrelated-accounted-json', kind: 'setting', bytes: added })
    await ctx.db.patch(usage._id, { bytes: usage.bytes + added })
    return added
  })
}
async function totals(server: TestServer) {
  return server.run(async ctx => {
    const ledger = await ctx.db.query('cloudPrivateLedger').withIndex('by_owner_and_key', q => q.eq('owner', owner)).take(2000)
    return { bytes: ledger.reduce((sum, row) => sum + row.bytes, 0), drawings: ledger.filter(row => row.kind === 'drawing').length, rows: ledger.length }
  })
}
async function storedBytes(server: TestServer) {
  return server.run(async ctx => {
    const [drawings, revisions, settings, patterns, topics, posts] = await Promise.all([
      ctx.db.query('cloudDocuments').withIndex('by_owner', q => q.eq('owner', owner)).take(300),
      ctx.db.query('cloudDocumentRevisions').withIndex('by_owner_and_documentId_and_revision', q => q.eq('owner', owner)).take(110),
      ctx.db.query('cloudSettings').withIndex('by_owner', q => q.eq('owner', owner)).take(30),
      ctx.db.query('publishedPatterns').withIndex('by_owner', q => q.eq('owner', owner)).take(10),
      ctx.db.query('communityBoardTopics').withIndex('by_owner_and_status', q => q.eq('owner', owner)).take(30),
      ctx.db.query('communityBoardPosts').withIndex('by_owner', q => q.eq('owner', owner)).take(30),
    ])
    const versions: Doc<'publishedVersions'>[] = []
    for (const pattern of patterns) versions.push(...await ctx.db.query('publishedVersions').withIndex('by_patternId_and_version', q => q.eq('patternId', pattern._id)).take(20))
    return [...drawings, ...revisions, ...settings, ...patterns, ...versions, ...topics, ...posts].reduce((sum, row) => sum + privateStoredBytes(row), 0)
  })
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('transactional cloud JSON accounting', () => {
  it('charges UTF-8 bodies and immutable snapshots once, including settings replacements and removals', async () => {
    const { server, alice, create, status } = setup(), first = drawing(), second = drawing('新しい縫い目 🧵🧵')
    await create('wallet', first)
    expect(await status()).toMatchObject({ ready: true, drawings: 1, bytes: await storedBytes(server) })
    const initialBytes = (await status()).bytes
    expect(initialBytes).toBeGreaterThanOrEqual(2 * privateJsonBytes(first))
    await alice.mutation(app.api.cloudSettings.set, { key: 'locale', value: '日'.repeat(4000) })
    const unicodeBytes = (await status()).bytes
    expect(unicodeBytes).toBe(await storedBytes(server))
    await alice.mutation(app.api.cloudSettings.set, { key: 'locale', value: 'x'.repeat(4000) })
    expect(unicodeBytes - (await status()).bytes).toBe(8000)
    expect((await status()).bytes).toBe(await storedBytes(server))
    await alice.mutation(app.api.cloudSettings.remove, { key: 'locale' })
    await alice.mutation(app.api.cloudDocuments.save, { id: 'wallet', name: 'Wallet', docJson: second, expectedRevision: 1 })
    expect((await status()).bytes).toBe(await storedBytes(server))
    const before = await status()
    await expect(alice.mutation(app.api.cloudDocuments.save, { id: 'wallet', name: 'Stale', docJson: drawing('stale'), expectedRevision: 1 })).rejects.toThrow('changed')
    expect(await status()).toEqual(before)
    expect(await totals(server)).toMatchObject({ bytes: before.bytes, drawings: 1, rows: 3 })
  })

  it('rolls back every document/index/history/ledger write when capacity rejects a create or setting', async () => {
    const { server, alice, create, status } = setup()
    await create(); await fillRemaining(server, 1)
    const before = await status(), priorLedger = await totals(server)
    await expect(create('would-overflow')).rejects.toThrow('quota')
    await expect(alice.mutation(app.api.cloudSettings.set, { key: 'overflows', value: 'xx' })).rejects.toThrow('quota')
    expect(await status()).toEqual(before)
    expect(await totals(server)).toEqual(priorLedger)
    expect(await server.run(async ctx => ({
      documents: (await ctx.db.query('cloudDocuments').take(10)).length,
      history: (await ctx.db.query('cloudDocumentRevisions').take(10)).length,
      metadata: (await ctx.db.query('cloudDocumentMetadata').take(10)).length,
      locations: (await ctx.db.query('cloudDocumentLocations').take(10)).length,
      settings: (await ctx.db.query('cloudSettings').take(10)).length,
    }))).toEqual({ documents: 1, history: 1, metadata: 1, locations: 1, settings: 0 })
  })

  it('does not oversubscribe the final byte when competing transactions write concurrently', async () => {
    const { server, alice, create, status } = setup()
    await create(); await fillRemaining(server, privateStoredBytes({ owner, key: 'one', value: 'x' }))
    const results = await Promise.allSettled(['one', 'two'].map(key => alice.mutation(app.api.cloudSettings.set, { key, value: 'x' })))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect((await status()).bytes).toBe(PRIVATE_JSON_QUOTA_BYTES)
    expect((await totals(server)).bytes).toBe(PRIVATE_JSON_QUOTA_BYTES)
    expect(await server.run(async ctx => (await ctx.db.query('cloudSettings').take(10)).length)).toBe(1)
  })

  it('retains exactly100 newest revisions at full capacity without requiring spare bytes', async () => {
    const { server, alice, create, status } = setup(), body = drawing()
    await create('wallet', drawing('Older retained payload ' + 'x'.repeat(4096)))
    for (let revision = 1; revision < 100; revision++) await alice.mutation(app.api.cloudDocuments.save, { id: 'wallet', name: 'Wallet', docJson: body, expectedRevision: revision })
    const unrelated = await fillRemaining(server)
    await alice.mutation(app.api.cloudDocuments.save, { id: 'wallet', name: 'Wallet', docJson: body, expectedRevision: 100 })
    expect((await status()).bytes).toBeLessThanOrEqual(PRIVATE_JSON_QUOTA_BYTES)
    expect((await status()).bytes).toBe(unrelated + await storedBytes(server))
    const history = await server.run(ctx => ctx.db.query('cloudDocumentRevisions').take(110))
    expect(history).toHaveLength(100)
    expect(Math.min(...history.map(row => row.revision))).toBe(2)
    expect(Math.max(...history.map(row => row.revision))).toBe(101)
    expect((await totals(server)).bytes).toBe((await status()).bytes)
  })

  it('permits a bounded delete tombstone at capacity, then authorized batched purge releases all drawing charges', async () => {
    vi.useFakeTimers()
    const { server, alice, bob, create, status } = setup(), body = drawing()
    await create('wallet', body)
    for (let revision = 1; revision < 8; revision++) await alice.mutation(app.api.cloudDocuments.save, { id: 'wallet', name: 'Wallet', docJson: body, expectedRevision: revision })
    const unrelated = await fillRemaining(server)
    await expect(alice.mutation(app.api.cloudQuota.purge, { id: 'wallet', expectedRevision: 8 })).rejects.toThrow('Trash')
    await alice.mutation(app.api.cloudDocuments.remove, { id: 'wallet', expectedRevision: 8 })
    const deleted = await status()
    expect(deleted.bytes).toBe(unrelated + await storedBytes(server))
    expect(deleted.bytes).toBeGreaterThan(PRIVATE_JSON_QUOTA_BYTES)
    await alice.mutation(app.api.cloudDocuments.remove, { id: 'wallet', expectedRevision: 8 })
    expect(await status()).toEqual(deleted)
    await expect(bob.mutation(app.api.cloudQuota.purge, { id: 'wallet', expectedRevision: 9 })).rejects.toThrow('Trash')
    await expect(alice.mutation(app.api.cloudQuota.purge, { id: 'wallet', expectedRevision: 8 })).rejects.toThrow('changed')
    await alice.mutation(app.api.cloudQuota.purge, { id: 'wallet', expectedRevision: 9 })
    await server.finishAllScheduledFunctions(() => { vi.runAllTimers() })
    expect(await status()).toMatchObject({ bytes: unrelated, drawings: 0 })
    expect(await totals(server)).toMatchObject({ bytes: unrelated, drawings: 0, rows: 1 })
    expect(await server.run(async ctx => ({ drawings: (await ctx.db.query('cloudDocuments').take(1)).length,
      history: (await ctx.db.query('cloudDocumentRevisions').take(1)).length,
      metadata: (await ctx.db.query('cloudDocumentMetadata').take(1)).length,
    }))).toEqual({ drawings: 0, history: 0, metadata: 0 })
  })

  it('enforces256 live-or-trashed drawings and leaves no257th row after rejection', async () => {
    const { server, create, status } = setup()
    for (let index = 0; index < PRIVATE_DRAWING_QUOTA; index++) await create(`drawing-${index}`)
    await expect(create('drawing-257')).rejects.toThrow('quota')
    expect((await status()).drawings).toBe(PRIVATE_DRAWING_QUOTA)
    expect(await server.run(async ctx => (await ctx.db.query('cloudDocuments').take(300)).length)).toBe(PRIVATE_DRAWING_QUOTA)
    expect((await totals(server)).drawings).toBe(PRIVATE_DRAWING_QUOTA)
  })
})

describe('quota migration and publication boundaries', () => {
  it('retires publication payloads in bounded batches while retaining credits/license and releasing their asset references', async () => {
    vi.useFakeTimers(); vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site')
    const { server, alice, bob, status } = setup()
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])
    const reservation = await alice.mutation(app.api.cloudAssets.beginUpload, { name: 'Published tracing', contentType: 'image/png', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    const storageId = await server.run(ctx => ctx.storage.store(new Blob([bytes], { type: 'image/png' })))
    await alice.mutation(app.api.cloudAssets.finishUpload, { id: reservation.id, storageId })
    const body = JSON.stringify({ ...JSON.parse(drawing('x'.repeat(4096))) as Record<string, unknown>, tracingOverlays: [{ sourceUrl: `lcad-asset:${reservation.id}` }] })
    const input = { title: 'Retired wallet', description: 'A licensed source', attribution: 'Alice original credit', license: 'CC-BY-4.0' as const, visibility: 'public' as const, docJson: body }
    let pattern = await alice.mutation(app.api.community.publish, { ...input, id: null, expectedVersion: null })
    const original = pattern
    for (let version = 1; version < 7; version++) pattern = await alice.mutation(app.api.community.publish, { ...input, id: pattern.id as never, expectedVersion: pattern.version, expectedVisibilityRevision: pattern.visibilityRevision })
    const before = await status(), latestId = pattern.id as never
    await expect(alice.mutation(app.api.cloudAssets.remove, { id: reservation.id })).rejects.toThrow('retained')
    await expect(bob.mutation(app.api.community.retire, { id: latestId, expectedVersion: pattern.version, expectedVisibilityRevision: pattern.visibilityRevision })).rejects.toThrow('not available')
    await expect(alice.mutation(app.api.community.retire, { id: latestId, expectedVersion: pattern.version - 1, expectedVisibilityRevision: pattern.visibilityRevision })).rejects.toThrow('changed')
    await alice.mutation(app.api.community.retire, { id: latestId, expectedVersion: pattern.version, expectedVisibilityRevision: pattern.visibilityRevision })
    expect(await server.query(app.api.community.get, { id: latestId, version: 1 })).toBeNull()
    expect(await server.query(app.api.cloudAssets.resolve, { id: reservation.id, patternId: latestId, version: 1 })).toBeNull()
    await server.finishAllScheduledFunctions(() => { vi.runAllTimers() })
    const retained = await server.run(ctx => ctx.db.query('publishedVersions').take(10))
    expect(retained).toHaveLength(7)
    expect(retained.every(row => row.docJson === '' && row.license === original.license && row.attribution === original.attribution && row.retiredAt)).toBe(true)
    expect((await status()).bytes).toBeLessThan(before.bytes)
    expect((await status()).bytes).toBe(await storedBytes(server))
    await alice.mutation(app.api.cloudAssets.remove, { id: reservation.id })
    expect(await server.run(async ctx => (await ctx.storage.get(storageId)) === null)).toBe(true)
    const source = { kind: 'community-pattern', patternId: original.id, version: 1, title: original.title, author: original.author, attribution: original.attribution, license: original.license }
    const derivative = JSON.stringify({ ...JSON.parse(drawing()) as Record<string, unknown>, communityProvenance: [source] })
    await expect(bob.mutation(app.api.community.publish, { ...input, id: null, expectedVersion: null, docJson: derivative, attribution: 'Bob derivative', license: 'CC0-1.0' })).rejects.toThrow('attribution license')
    await expect(bob.mutation(app.api.community.publish, { ...input, id: null, expectedVersion: null, docJson: derivative, attribution: 'Bob derivative' })).resolves.toMatchObject({ license: 'CC-BY-4.0' })
  })

  it('charges long publication credits and empty setting rows instead of allowing zero-cost stored content', async () => {
    const { server, alice, create, status } = setup(), body = drawing()
    await create()
    const before = (await status()).bytes, credit = '貢献者'.repeat(10_000)
    await alice.mutation(app.api.community.publish, { id: null, expectedVersion: null, title: 'Wallet', description: '', attribution: credit, license: 'CC-BY-4.0', visibility: 'private', docJson: body })
    expect((await status()).bytes - before).toBeGreaterThanOrEqual(2 * (privateJsonBytes(body) + privateJsonBytes(credit)))
    const beforeEmpty = (await status()).bytes
    await alice.mutation(app.api.cloudSettings.set, { key: 'empty-setting-with-a-persistent-key', value: '' })
    expect((await status()).bytes - beforeEmpty).toBeGreaterThanOrEqual(256)
    expect((await status()).bytes).toBe(await storedBytes(server))
  })

  it('backfills legacy bodies/history/settings/publications/board text in resumable owner-scoped phases without double charging', async () => {
    const { server, alice, bob, status } = setup(), body = drawing()
    await server.run(async ctx => {
      for (let index = 0; index < 2; index++) {
        const id = await ctx.db.insert('cloudDocuments', { owner, clientId: `legacy-${index}`, name: 'Legacy', docJson: body, revision: 3, createdAt: 1, updatedAt: 3 })
        for (let revision = 1; revision <= 3; revision++) await ctx.db.insert('cloudDocumentRevisions', { owner, documentId: id, revision, name: 'Legacy', docJson: body, savedAt: revision, kind: 'save' })
      }
      await ctx.db.insert('cloudDocuments', { owner: otherOwner, clientId: 'not-alice', name: 'Other account', docJson: body, revision: 1, createdAt: 1, updatedAt: 1 })
      await ctx.db.insert('cloudSettings', { owner, key: 'language', value: '日本語' })
      const pattern = await ctx.db.insert('publishedPatterns', { owner, author: 'Alice', title: 'Legacy pattern', description: '', license: 'CC-BY-4.0', attribution: 'Alice', visibility: 'private', docJson: body, version: 7, publishedAt: 7 })
      for (let version = 1; version <= 7; version++) await ctx.db.insert('publishedVersions', { patternId: pattern, version, title: 'Legacy pattern', description: '', author: 'Alice', license: 'CC-BY-4.0', attribution: 'Alice', visibility: 'private', docJson: body, publishedAt: version })
      const authorId = await ctx.db.insert('communityBoardAuthors', { owner })
      const topicId = await ctx.db.insert('communityBoardTopics', { owner, authorId, title: 'Topic', body: 'Body', status: 'draft', revision: 1, createdAt: 1, updatedAt: 1, replyCount: 1, likeCount: 0 })
      await ctx.db.insert('communityBoardPosts', { owner, authorId, topicId, body: 'Reply', status: 'published', revision: 1, createdAt: 1, updatedAt: 1, likeCount: 0 })
    })
    await expect(alice.mutation(app.api.cloudSettings.set, { key: 'blocked-during-migration', value: 'x' })).rejects.toThrow('Index older')
    let done = false, pages = 0
    while (!done && pages < 30) {
      const page = await alice.mutation(app.api.cloudLifecycle.indexLegacyPage, { cursor: pages === 0 ? 'ignored-client-cursor' : null })
      done = page.isDone; pages++
      if (!done) expect((await status()).ready).toBe(false)
    }
    expect(done).toBe(true)
    expect(pages).toBeGreaterThan(7)
    const expected = await storedBytes(server)
    expect(expected).toBeGreaterThanOrEqual(16 * privateJsonBytes(body) + 9 + privateJsonBytes('TopicBodyReply'))
    expect(await status()).toMatchObject({ ready: true, bytes: expected, drawings: 2 })
    expect((await totals(server)).bytes).toBe(expected)
    await alice.mutation(app.api.cloudLifecycle.indexLegacyPage, { cursor: 'replay-stale-cursor' })
    expect((await status()).bytes).toBe(expected)
    expect((await bob.query(app.api.cloudQuota.status, {})).bytes).toBe(0)
    expect((await alice.query(app.api.cloudLifecycle.list, { trash: false, cursor: null })).page.map(row => row.id).sort()).toEqual(['legacy-0', 'legacy-1'])
  })

  it('charges publication snapshots and board text against the same budget and rolls back when full', async () => {
    const { server, alice, create, status } = setup(), body = drawing()
    await create('wallet', body)
    await alice.mutation(app.api.community.publish, { id: null, expectedVersion: null, title: 'Wallet', description: '', attribution: 'Alice', license: 'CC-BY-4.0', visibility: 'private', docJson: body })
    await alice.mutation(app.api.communityBoard.createTopic, { title: 'Topic', body: 'Body', status: 'draft' })
    expect((await status()).bytes).toBe(await storedBytes(server))
    await fillRemaining(server)
    await expect(alice.mutation(app.api.community.publish, { id: null, expectedVersion: null, title: 'Overflow', description: '', attribution: 'Alice', license: 'CC-BY-4.0', visibility: 'public', docJson: body })).rejects.toThrow('quota')
    await expect(alice.mutation(app.api.communityBoard.createTopic, { title: 'Overflow', body: 'Text', status: 'published' })).rejects.toThrow('quota')
    expect(await server.run(async ctx => ({ patterns: (await ctx.db.query('publishedPatterns').take(5)).length,
      versions: (await ctx.db.query('publishedVersions').take(5)).length, topics: (await ctx.db.query('communityBoardTopics').take(5)).length,
    }))).toEqual({ patterns: 1, versions: 1, topics: 1 })
    expect((await totals(server)).bytes).toBe(PRIVATE_JSON_QUOTA_BYTES)
  })
})
