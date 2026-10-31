import { describe, expect, it } from 'vitest'
import { defineTestApp } from 'convex-test'
import rateLimiterTest from '@convex-dev/rate-limiter/test'
import { makeFunctionReference } from 'convex/server'
import schema from '../../../../convex/schema'
import * as cloudDocuments from '../../../../convex/cloudDocuments'
import * as cloudSettings from '../../../../convex/cloudSettings'
import * as community from '../../../../convex/community'
import type { Id } from '../../../../convex/_generated/dataModel'
import { parseImportedJsonDocument } from '../editor-json-import'
import { createConvexDataClient } from './convex-data-client'
import { createCommunityDataClient } from './community-data-client'
import type { ConvexTransport } from './convex-transport'
import { makeAttributedPatternCopy } from './cloud-sync'

const app = defineTestApp({ schema, components: { rateLimiter: rateLimiterTest } }).defineModules({ cloudDocuments, cloudSettings, community })
function makeDoc(name = 'Wallet') {
  return parseImportedJsonDocument(JSON.stringify({ documentName: name, objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })).doc
}
function setup() {
  const server = app.createTest()
  const alice = server.withIdentity({ subject: 'alice', issuer: 'https://identity.test', name: 'Alice' })
  const bob = server.withIdentity({ subject: 'bob', issuer: 'https://identity.test', name: 'Bob' })
  const transport = (actor: typeof alice): ConvexTransport => ({
    query: <T>(path: string, args: Record<string, unknown>) => actor.query(makeFunctionReference<'query', Record<string, unknown>, T>(path), args),
    mutation: <T>(path: string, args: Record<string, unknown>) => actor.mutation(makeFunctionReference<'mutation', Record<string, unknown>, T>(path), args),
  })
  return { server, alice, bob, transport, aliceClient: createConvexDataClient({ transport: transport(alice) }), bobClient: createConvexDataClient({ transport: transport(bob) }),
    aliceCommunity: createCommunityDataClient(transport(alice)), bobCommunity: createCommunityDataClient(transport(bob)) }
}

describe('owner-authorized Convex persistence', () => {
  it('rejects anonymous private reads and writes and isolates documents by identity', async () => {
    const { server, aliceClient, bobClient } = setup()
    await expect(server.query(app.api.cloudDocuments.list, { cursor: null })).rejects.toThrow('Sign in')
    await expect(server.mutation(app.api.cloudDocuments.create, { id: 'x', name: 'X', docJson: JSON.stringify(makeDoc()) })).rejects.toThrow('Sign in')
    await aliceClient.documents.create({ id: 'wallet', name: 'Wallet', doc: makeDoc() })
    expect(await bobClient.documents.get('wallet')).toBeNull()
    expect(await bobClient.documents.list()).toEqual([])
    await bobClient.documents.delete('wallet')
    expect((await aliceClient.documents.get('wallet'))?.name).toBe('Wallet')
  })
  it('paginates the full library, preserves create time, detects stale writes and soft-deletes', async () => {
    const { alice, aliceClient } = setup()
    for (let n = 0; n < 7; n += 1) await aliceClient.documents.create({ id: `doc-${n}`, name: `Doc ${n}`, doc: makeDoc(`Doc ${n}`) })
    expect(await aliceClient.documents.list()).toHaveLength(7)
    const old = await aliceClient.documents.get('doc-0')
    await alice.mutation(app.api.cloudDocuments.save, { id: 'doc-0', name: 'Other device', docJson: JSON.stringify(makeDoc()), expectedRevision: 1 })
    await aliceClient.documents.list()
    await expect(aliceClient.documents.save({ id: 'doc-0', name: 'Stale', doc: makeDoc() })).rejects.toThrow('changed')
    await aliceClient.documents.get('doc-0')
    const saved = await aliceClient.documents.save({ id: 'doc-0', name: 'Updated', doc: makeDoc() })
    expect(saved.createdAt).toBe(old?.createdAt)
    expect(saved.name).toBe('Updated')
    await aliceClient.documents.delete('doc-0')
    expect(await aliceClient.documents.get('doc-0')).toBeNull()
    expect(await aliceClient.documents.list()).toHaveLength(6)
  })
  it('preserves shape IDs across cloud reads and reports unchanged nonempty documents', async () => {
    const { aliceClient } = setup()
    const document = makeDoc()
    document.objects.push({ id: 'original-line', type: 'line', layerId: 'main', lineTypeId: document.activeLineTypeId, start: { x: 0, y: 0 }, end: { x: 5, y: 0 } })
    await aliceClient.documents.create({ id: 'stable', name: 'Stable', doc: document })
    expect((await aliceClient.documents.get('stable'))?.doc.objects[0].id).toBe('original-line')
    expect((await aliceClient.documents.list())[0].doc.objects[0].id).toBe('original-line')
    const duplicate = { ...document, objects: [document.objects[0], document.objects[0]] }
    expect(() => parseImportedJsonDocument(JSON.stringify(duplicate), { preserveShapeIds: true })).toThrow('duplicate')
  })
  it('holds the listed snapshot revision and refuses a save after another device changes the drawing', async () => {
    const { alice, aliceClient, transport } = setup()
    await aliceClient.documents.create({ id: 'listed', name: 'Listed', doc: makeDoc() })
    const anotherClient = createConvexDataClient({ transport: transport(alice) })
    await anotherClient.documents.list()
    await aliceClient.documents.save({ id: 'listed', name: 'Newer', doc: makeDoc('Newer') })
    await expect(anotherClient.documents.save({ id: 'listed', name: 'Stale', doc: makeDoc() })).rejects.toThrow('changed')
  })
  it('stores snapshots, settings and repositories independently for each user', async () => {
    const { aliceClient, bobClient } = setup()
    await aliceClient.documents.writeAutoSaveSnapshot(JSON.stringify(makeDoc()))
    await aliceClient.settings.set('units', 'mm')
    await aliceClient.templateRepository.replaceAll([{ id: 't1', name: 'Wallet', doc: makeDoc(), createdAt: '2026-01-01', updatedAt: '2026-01-01' }])
    await aliceClient.catalogRepository.replaceAll([])
    expect(await aliceClient.templateRepository.hasSavedEntries()).toBe(true)
    const all = await aliceClient.exportAll()
    expect(all.settings).toEqual({ units: 'mm' })
    expect(all.templateRepository).toHaveLength(1)
    expect(await bobClient.documents.getAutoSaveSnapshot()).toBeNull()
    expect(await bobClient.settings.get('units')).toBeNull()
    expect(await bobClient.templateRepository.list()).toEqual([])
    await aliceClient.documents.clearAutoSaveSnapshot()
    expect(await aliceClient.documents.getAutoSaveSnapshot()).toBeNull()
  })
  it('rejects malformed or oversized documents before storage', async () => {
    const { alice } = setup()
    await expect(alice.mutation(app.api.cloudDocuments.create, { id: 'bad', name: 'Bad', docJson: '{}' })).rejects.toThrow('objects and layers')
    const invalidShape = { ...makeDoc(), objects: [null] }
    await expect(alice.mutation(app.api.cloudDocuments.create, { id: 'invalid', name: 'Invalid', docJson: JSON.stringify(invalidShape) })).rejects.toThrow('invalid, unsupported')
    const invalidPoint = { ...makeDoc(), objects: [{ id: 'bad-point', type: 'line', layerId: 'main', lineTypeId: 'cut', start: { x: null, y: 0 }, end: { x: 1, y: 1 } }] }
    await expect(alice.mutation(app.api.cloudDocuments.create, { id: 'invalid-point', name: 'Invalid', docJson: JSON.stringify(invalidPoint) })).rejects.toThrow('invalid, unsupported')
    await expect(alice.mutation(app.api.cloudDocuments.create, { id: 'large', name: 'Large', docJson: JSON.stringify({ objects: [], layers: [], memo: 'a'.repeat(600 * 1024) }) })).rejects.toThrow('too large')
    expect((await alice.query(app.api.cloudDocuments.list, { cursor: null })).page).toEqual([])
  })
})

describe('versioned community publication authorization', () => {
  it('keeps private patterns hidden and prevents another user from changing visibility or publishing versions', async () => {
    const { server, aliceCommunity, bobCommunity } = setup()
    const first = await aliceCommunity.publish({ title: 'Wallet', description: '', attribution: 'Alice', license: 'CC-BY-4.0', visibility: 'private', doc: makeDoc() })
    expect(await bobCommunity.get(first.id)).toBeNull()
    expect(await aliceCommunity.listPublic()).toEqual([])
    expect(await bobCommunity.listMine()).toEqual([])
    await expect(bobCommunity.setVisibility(first.id, 'public')).rejects.toThrow('not available')
    await expect(bobCommunity.publish({ id: first.id, expectedVersion: 1, title: 'Stolen', description: '', attribution: 'Bob', license: 'CC0-1.0', visibility: 'public', doc: makeDoc() })).rejects.toThrow('not available')
    await aliceCommunity.setVisibility(first.id, 'public')
    expect((await server.query(app.api.community.listPublic, { cursor: null })).page[0]).toMatchObject({ author: 'Alice', title: 'Wallet', version: 1 })
    expect(await bobCommunity.get(first.id)).toMatchObject({ author: 'Alice', attribution: 'Alice', license: 'CC-BY-4.0' })
  })
  it('preserves earlier version content/license and enforces optimistic publishing', async () => {
    const { aliceCommunity, bobCommunity } = setup()
    const base = { title: 'Wallet', description: 'Original', attribution: 'Alice', license: 'CC-BY-4.0' as const, visibility: 'public' as const, doc: makeDoc('Original') }
    const first = await aliceCommunity.publish(base)
    const second = await aliceCommunity.publish({ ...base, id: first.id, expectedVersion: 1, description: 'Revised', doc: makeDoc('Revised') })
    expect(second.version).toBe(2)
    expect((await bobCommunity.get(first.id, 1))?.doc.documentName).toBe('Original')
    expect((await bobCommunity.get(first.id))?.doc.documentName).toBe('Revised')
    await expect(aliceCommunity.publish({ ...base, id: first.id, expectedVersion: 1 })).rejects.toThrow('newer version')
    await aliceCommunity.setVisibility(first.id, 'private')
    expect(await bobCommunity.get(first.id, 1)).toBeNull()
  })
  it('never exposes a private historical version when a later version becomes public', async () => {
    const { server, aliceCommunity, bobCommunity } = setup()
    const base = { title: 'Wallet', description: '', attribution: 'Alice', license: 'CC-BY-4.0' as const, visibility: 'private' as const, doc: makeDoc('Private notes') }
    const first = await aliceCommunity.publish(base)
    await aliceCommunity.publish({ ...base, id: first.id, expectedVersion: 1, visibility: 'public', doc: makeDoc('Sanitized public version') })
    expect(await bobCommunity.get(first.id, 1)).toBeNull()
    expect(await server.query(app.api.community.get, { id: first.id as Id<'publishedPatterns'>, version: 1 })).toBeNull()
    expect((await aliceCommunity.get(first.id, 1))?.doc.documentName).toBe('Private notes')
    expect((await bobCommunity.get(first.id, 2))?.doc.documentName).toBe('Sanitized public version')
  })
  it('preserves known source credit and refuses to weaken inherited noncommercial licensing', async () => {
    const { aliceCommunity, bobCommunity } = setup()
    const original = await aliceCommunity.publish({ title: 'Source wallet', description: '', attribution: 'Credit Alice', license: 'CC-BY-NC-4.0', visibility: 'public', doc: makeDoc() })
    const source = await bobCommunity.get(original.id)
    if (!source) throw new Error('Expected source pattern')
    const copy = makeAttributedPatternCopy(source)
    const input = { title: 'Adapted wallet', description: '', attribution: 'Adaptation by Bob', visibility: 'public' as const, doc: copy }
    await expect(bobCommunity.publish({ ...input, license: 'CC0-1.0' })).rejects.toThrow('noncommercial')
    await expect(bobCommunity.publish({ ...input, license: 'CC-BY-4.0' })).rejects.toThrow('noncommercial')
    const derivative = await bobCommunity.publish({ ...input, license: 'CC-BY-NC-4.0' })
    expect(derivative.attribution).toContain('Credit Alice')
    expect(derivative.attribution).toContain('Adaptation by Bob')
    const forged = structuredClone(copy)
    if (forged.communityProvenance) forged.communityProvenance[0].license = 'CC0-1.0'
    await expect(bobCommunity.publish({ ...input, doc: forged, license: 'CC0-1.0' })).rejects.toThrow('does not match')
  })
})
