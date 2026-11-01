import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineTestApp } from 'convex-test'
import rateLimiterTest from '@convex-dev/rate-limiter/test'
import schema from '../../../../convex/schema'
import * as cloudDocuments from '../../../../convex/cloudDocuments'
import * as cloudLifecycle from '../../../../convex/cloudLifecycle'
import * as cloudWorkspace from '../../../../convex/cloudWorkspace'
import * as community from '../../../../convex/community'
import * as communityBoard from '../../../../convex/communityBoard'
import * as communityModeration from '../../../../convex/communityModeration'
import * as communityNotifications from '../../../../convex/communityNotifications'
import { parseImportedJsonDocument } from '../editor-json-import'
import { createCloudLifecycleClient } from './cloud-lifecycle-client'
import { createCommunityDataClient } from './community-data-client'
import { makeFunctionReference } from 'convex/server'
import type { ConvexTransport } from './convex-transport'

const app = defineTestApp({ schema, components: { rateLimiter: rateLimiterTest } }).defineModules({ cloudDocuments, cloudLifecycle, cloudWorkspace, community, communityBoard, communityModeration, communityNotifications })
const doc = (name = 'Wallet') => ({ documentName: name, objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }] })
function setup() {
  const server = app.createTest()
  const alice = server.withIdentity({ tokenIdentifier: 'issuer|alice', subject: 'alice', issuer: 'https://identity.test' })
  const bob = server.withIdentity({ tokenIdentifier: 'issuer|bob', subject: 'bob', issuer: 'https://identity.test' })
  const moderator = server.withIdentity({ tokenIdentifier: 'issuer|moderator', subject: 'moderator', issuer: 'https://identity.test' })
  const transport = (actor: typeof alice): ConvexTransport => ({
    query: <T>(path: string, args: Record<string, unknown>) => actor.query(makeFunctionReference<'query', Record<string, unknown>, T>(path), args),
    mutation: <T>(path: string, args: Record<string, unknown>) => actor.mutation(makeFunctionReference<'mutation', Record<string, unknown>, T>(path), args),
  })
  const create = (id = 'wallet') => alice.mutation(app.api.cloudDocuments.create, { id, name: id, docJson: JSON.stringify(doc()) })
  return { server, alice, bob, moderator, create, transport, library: createCloudLifecycleClient(transport(alice)) }
}
afterEach(() => vi.unstubAllEnvs())

describe('cloud lifecycle, recovery and concurrency', () => {
  it('lists bounded metadata without drawing bodies and protects stale rename/delete', async () => {
    const { alice, bob, create, library } = setup()
    for (let n = 0; n < 27; n++) await create(`wallet-${n}`)
    const first = await library.listPage()
    expect(first.page).toHaveLength(25)
    expect(first.page[0]).not.toHaveProperty('docJson')
    expect((await library.listPage(false, first.continueCursor)).page).toHaveLength(2)
    const selected = first.page[0]
    await alice.mutation(app.api.cloudDocuments.save, { id: selected.id, name: 'Newer', docJson: JSON.stringify(doc('Newer')), expectedRevision: selected.revision })
    await expect(library.rename(selected, 'Stale')).rejects.toThrow('changed')
    await expect(library.remove(selected)).rejects.toThrow('changed')
    expect((await bob.query(app.api.cloudLifecycle.list, { trash: false, cursor: null })).page).toEqual([])
    await expect(bob.mutation(app.api.cloudLifecycle.rename, { id: selected.id, name: 'Stolen', expectedRevision: 2 })).rejects.toThrow('not available')
  })
  it('renames, trashes and restores as new revisions without erasing the saved history', async () => {
    const { create, library, alice } = setup()
    await create()
    const selected = (await library.listPage()).page[0]
    const renamed = await library.rename(selected, 'Renamed')
    expect((await library.get(selected.id))?.doc.documentName).toBe('Renamed')
    await library.remove(renamed)
    expect((await library.listPage()).page).toEqual([])
    const trash = (await library.listPage(true)).page[0]
    expect(trash.revision).toBe(3)
    const restored = await library.restore(trash)
    expect(restored.revision).toBe(4)
    expect((await library.listPage(true)).page).toEqual([])
    expect((await alice.query(app.api.cloudWorkspace.listHistory, { id: selected.id, cursor: null })).page.map(row => row.kind)).toEqual(['restore', 'delete', 'save', 'save'])
    await expect(library.restore(trash)).rejects.toThrow('changed')
  })
  it('rejects stale pattern visibility changes even when no content version changed', async () => {
    const { alice, transport } = setup()
    const a = createCommunityDataClient(transport(alice)), b = createCommunityDataClient(transport(alice))
    const pattern = await a.publish({ title: 'Wallet', description: '', license: 'CC-BY-4.0', attribution: 'Alice', visibility: 'private', doc: parseImportedJsonDocument(JSON.stringify(doc())).doc })
    await b.listMine()
    await a.setVisibility(pattern.id, 'public')
    await expect(b.setVisibility(pattern.id, 'public')).rejects.toThrow('visibility changed')
    await b.listMine()
    await b.setVisibility(pattern.id, 'private')
    await expect(a.setVisibility(pattern.id, 'private')).rejects.toThrow('visibility changed')
  })
  it('indexes legacy drawing metadata in owner-scoped bounded batches', async () => {
    const { server, alice, library, bob } = setup()
    const owner = await alice.run(async ctx => (await ctx.auth.getUserIdentity())!.tokenIdentifier)
    await server.run(ctx => ctx.db.insert('cloudDocuments', { owner, clientId: 'legacy', name: 'Legacy', revision: 4, docJson: JSON.stringify(doc()), createdAt: 1, updatedAt: 2 }))
    expect((await library.listPage()).page).toEqual([])
    expect(await library.indexLegacyPage()).toMatchObject({ indexed: 1, isDone: false })
    while (!(await library.indexLegacyPage()).isDone) { /* bounded migration */ }
    expect((await library.listPage()).page[0]).toMatchObject({ id: 'legacy', revision: 4 })
    expect((await bob.query(app.api.cloudLifecycle.list, { trash: false, cursor: null })).page).toEqual([])
    expect((await alice.mutation(app.api.cloudLifecycle.indexLegacyPage, { cursor: null })).indexed).toBe(0)
  })
  it('accepts native cubic and ellipse geometry while rejecting invalid radii and controls', async () => {
    const { alice } = setup()
    const base = { id: 'curve', layerId: 'main', lineTypeId: 'cut', locked: true, opacity: 0.5 }
    const ellipse = { ...base, type: 'ellipse', center: { x: 2, y: 3 }, radiusX: 5, radiusY: 2, rotationDeg: 30, startAngleDeg: 0, sweepDeg: 360 }
    const cubic = { ...base, id: 'cubic', type: 'cubic', start: { x: 0, y: 0 }, control1: { x: 1, y: 3 }, control2: { x: 4, y: 2 }, end: { x: 5, y: 0 } }
    const create = (id: string, objects: unknown[]) => alice.mutation(app.api.cloudDocuments.create, { id, name: id, docJson: JSON.stringify({ ...doc(), objects }) })
    await expect(create('valid', [ellipse, cubic])).resolves.toHaveProperty('revision', 1)
    await expect(create('bad-radius', [{ ...ellipse, radiusX: -1 }])).rejects.toThrow('invalid, unsupported')
    await expect(create('bad-control', [{ ...cubic, control2: null }])).rejects.toThrow('invalid, unsupported')
  })

  it('retains the newest 100 private drawing revisions with bounded cleanup', async () => {
    const { create, alice, server } = setup()
    await create()
    for (let revision = 1; revision <= 104; revision++) await alice.mutation(app.api.cloudDocuments.save, { id: 'wallet', name: `Rev ${revision + 1}`, docJson: JSON.stringify(doc()), expectedRevision: revision })
    const retained = await server.run(ctx => ctx.db.query('cloudDocumentRevisions').take(110))
    expect(retained).toHaveLength(100)
    expect(Math.min(...retained.map(row => row.revision))).toBe(6)
    expect(await alice.query(app.api.cloudWorkspace.readRevision, { id: 'wallet', revision: 5 })).toBeNull()
  })
})

describe('community operations are authorized and bounded', () => {
  it('deduplicates reports, restricts moderators, preserves audit decisions and hides reply trees', async () => {
    vi.stubEnv('COMMUNITY_MODERATORS', JSON.stringify(['issuer|moderator']))
    const { alice, bob, moderator, server } = setup()
    const topic = await alice.mutation(app.api.communityBoard.createTopic, { title: 'Discuss', body: 'Public content', status: 'published' })
    await bob.mutation(app.api.communityBoard.createPost, { topicId: topic.id, body: 'A reply' })
    const input = { target: { kind: 'topic' as const, id: topic.id }, reason: 'Needs moderator review' }
    await bob.mutation(app.api.communityModeration.report, input)
    await bob.mutation(app.api.communityModeration.report, input)
    await expect(bob.query(app.api.communityModeration.list, { cursor: null })).rejects.toThrow('Moderator')
    const queue = await moderator.query(app.api.communityModeration.list, { cursor: null })
    expect(queue.page).toHaveLength(1)
    expect(queue.page[0]).not.toHaveProperty('reporter')
    const report = queue.page[0]
    await alice.mutation(app.api.communityBoard.updateTopic, { id: topic.id, title: 'Changed', body: 'New content', status: 'published', expectedRevision: 1 })
    await expect(moderator.mutation(app.api.communityModeration.resolve, { id: report.id, action: 'hide', reason: 'Policy decision', expectedRevision: report.revision, expectedVisibilityRevision: 0 })).rejects.toThrow('changed')
    const latest = (await moderator.query(app.api.communityModeration.list, { cursor: null })).page[0]
    await moderator.mutation(app.api.communityModeration.resolve, { id: report.id, action: 'hide', reason: 'Policy decision', expectedRevision: latest.revision, expectedVisibilityRevision: 0 })
    expect(await server.query(app.api.communityBoard.getTopic, { id: topic.id })).toBeNull()
    expect((await server.query(app.api.communityBoard.listPosts, { topicId: topic.id, cursor: null })).page).toEqual([])
    expect((await moderator.query(app.api.communityModeration.audit, { cursor: null })).page[0]).toMatchObject({ action: 'hide', reason: 'Policy decision' })
    await expect(alice.query(app.api.communityModeration.audit, { cursor: null })).rejects.toThrow('Moderator')
  })
  it('does not reveal a newly private draft through an older public report', async () => {
    vi.stubEnv('COMMUNITY_MODERATORS', JSON.stringify(['issuer|moderator']))
    const { alice, bob, moderator } = setup()
    const topic = await alice.mutation(app.api.communityBoard.createTopic, { title: 'Public title', body: 'Public body', status: 'published' })
    await bob.mutation(app.api.communityModeration.report, { target: { kind: 'topic', id: topic.id }, reason: 'Review public content' })
    await alice.mutation(app.api.communityBoard.updateTopic, { id: topic.id, title: 'Private draft title', body: 'Private draft body', status: 'draft', expectedRevision: topic.revision })
    const result = await moderator.query(app.api.communityModeration.list, { cursor: null })
    expect(JSON.stringify(result)).not.toContain('Private draft')
    expect(result.page[0]).toMatchObject({ available: false, excerpt: '', revision: 2 })
  })

  it('delivers reply notifications only to the topic owner and restricts read markers', async () => {
    const { alice, bob, server } = setup()
    const topic = await alice.mutation(app.api.communityBoard.createTopic, { title: 'Question', body: 'Help', status: 'published' })
    await bob.mutation(app.api.communityBoard.createPost, { topicId: topic.id, body: 'Answer' })
    const notification = (await alice.query(app.api.communityNotifications.list, { cursor: null })).page[0]
    expect(notification).toMatchObject({ title: 'Question', read: false })
    expect((await bob.query(app.api.communityNotifications.list, { cursor: null })).page).toEqual([])
    await expect(bob.mutation(app.api.communityNotifications.markRead, { id: notification.id })).rejects.toThrow('not available')
    await alice.mutation(app.api.communityNotifications.markRead, { id: notification.id })
    expect((await alice.query(app.api.communityNotifications.list, { cursor: null })).page[0].read).toBe(true)
    await expect(server.query(app.api.communityNotifications.list, { cursor: null })).rejects.toThrow('Sign in')
  })
  it('uses indexed public title search without returning private drafts or patterns', async () => {
    const { alice, server } = setup()
    await alice.mutation(app.api.communityBoard.createTopic, { title: 'Wallet public', body: 'Visible', status: 'published' })
    await alice.mutation(app.api.communityBoard.createTopic, { title: 'Wallet secret', body: 'Hidden', status: 'draft' })
    expect((await server.query(app.api.communityBoard.searchPublicTopics, { search: 'Wallet', cursor: null })).page.map(row => row.title)).toEqual(['Wallet public'])
    for (const visibility of ['public', 'private'] as const) await alice.mutation(app.api.community.publish, { id: null, expectedVersion: null, title: `Wallet ${visibility}`, description: '', attribution: 'Alice', license: 'CC-BY-4.0', visibility, docJson: JSON.stringify(doc()) })
    expect((await server.query(app.api.community.searchPublic, { search: 'Wallet', cursor: null })).page.map(row => row.title)).toEqual(['Wallet public'])
  })
  it('enforces the transactional per-member community rate limit', async () => {
    const { alice, bob } = setup()
    for (let n = 0; n < 60; n++) await alice.mutation(app.api.communityBoard.createTopic, { title: 'Topic', body: 'Body', status: 'draft' })
    await expect(alice.mutation(app.api.communityBoard.createTopic, { title: 'Too fast', body: 'Body', status: 'draft' })).rejects.toThrow('Too many requests')
    await expect(bob.mutation(app.api.communityBoard.createTopic, { title: 'Independent budget', body: 'Body', status: 'draft' })).resolves.toMatchObject({ title: 'Independent budget' })
  })
})
