import { describe, expect, it } from 'vitest'
import { defineTestApp } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import schema from '../../../../convex/schema'
import * as cloudDocuments from '../../../../convex/cloudDocuments'
import * as cloudWorkspace from '../../../../convex/cloudWorkspace'
import { parseImportedJsonDocument } from '../editor-json-import'
import { createCloudWorkspaceClient } from './cloud-workspace-client'
import type { ConvexTransport } from './convex-transport'

const app = defineTestApp({ schema }).defineModules({ cloudDocuments, cloudWorkspace })
function drawing(name = 'Original') {
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
  const create = (id = 'drawing', name = 'Original') => alice.mutation(app.api.cloudDocuments.create, { id, name, docJson: JSON.stringify(drawing(name)) })
  const save = (revision: number, name: string, id = 'drawing') => alice.mutation(app.api.cloudDocuments.save, { id, name, docJson: JSON.stringify(drawing(name)), expectedRevision: revision })
  return { server, alice, bob, create, save, workspace: createCloudWorkspaceClient(transport(alice)), other: createCloudWorkspaceClient(transport(bob)) }
}

describe('private cloud workspace folders and revisions', () => {
  it('rejects anonymous access and isolates folders and history from other users', async () => {
    const { server, workspace, other, create } = setup()
    await expect(server.query(app.api.cloudWorkspace.listAllFolders, { cursor: null })).rejects.toThrow('Sign in')
    await expect(server.mutation(app.api.cloudWorkspace.createFolder, { name: 'Private', parentId: null })).rejects.toThrow('Sign in')
    const folder = await workspace.folders.create('Private')
    await create()
    expect(await other.folders.listAll()).toEqual([])
    expect(await other.folders.get(folder.id)).toBeNull()
    await expect(other.folders.create('Inside stolen folder', folder.id)).rejects.toThrow('not available')
    await expect(other.folders.rename(folder, 'Stolen')).rejects.toThrow('not available')
    await expect(other.folders.move(folder, null)).rejects.toThrow('not available')
    await expect(other.folders.remove(folder)).rejects.toThrow('not available')
    expect(await other.documents.list()).toEqual([])
    expect(await other.documents.history('drawing')).toEqual([])
    expect(await other.documents.readRevision('drawing', 1)).toBeNull()
    await expect(other.documents.restore({ id: 'drawing', name: 'Fake', revision: 1, locationRevision: null, folderId: null, updatedAt: 0 }, 1)).rejects.toThrow('not available')
    expect((await workspace.documents.readRevision('drawing', 1))?.doc.documentName).toBe('Original')
  })

  it('creates, renames, moves and deletes folders with name, cycle and version safeguards', async () => {
    const { workspace } = setup()
    const first = await workspace.folders.create('  Wallets  ')
    expect(first.name).toBe('Wallets')
    await expect(workspace.folders.create('wallets')).rejects.toThrow('already exists')
    const child = await workspace.folders.create('Front panels', first.id)
    await expect(workspace.folders.move(first, child.id)).rejects.toThrow('descendants')
    await expect(workspace.folders.move(first, first.id)).rejects.toThrow('itself')
    await expect(workspace.folders.remove(first)).rejects.toThrow('child folders')
    const renamed = await workspace.folders.rename(first, 'Bags')
    await expect(workspace.folders.rename(first, 'Stale name')).rejects.toThrow('changed')
    const moved = await workspace.folders.move(child, null)
    expect(moved.parentId).toBeNull()
    await workspace.folders.remove(renamed)
    expect(await workspace.folders.get(first.id)).toBeNull()
    expect((await workspace.folders.list()).map(folder => folder.name)).toEqual(['Front panels'])
  })

  it('keeps folder ownership and both drawing/location optimistic revisions on moves', async () => {
    const { workspace, other, create, save } = setup()
    const ownFolder = await workspace.folders.create('My folder')
    const foreignFolder = await other.folders.create('Other owner')
    await create()
    const rootDoc = (await workspace.documents.list())[0]
    await expect(workspace.documents.move(rootDoc, foreignFolder.id)).rejects.toThrow('not available')
    const moved = await workspace.documents.move(rootDoc, ownFolder.id)
    expect(await workspace.documents.list()).toEqual([])
    expect((await workspace.documents.list(ownFolder.id))[0].id).toBe('drawing')
    await expect(workspace.folders.remove(ownFolder)).rejects.toThrow('drawings')
    await expect(workspace.documents.move(rootDoc, null)).rejects.toThrow('location changed')
    await save(1, 'New content')
    await expect(workspace.documents.move(moved, null)).rejects.toThrow('Drawing changed')
    const latest = (await workspace.documents.list(ownFolder.id))[0]
    await workspace.documents.move(latest, null)
    await workspace.folders.remove(ownFolder)
    expect((await workspace.documents.list())[0].name).toBe('New content')
  })

  it('records immutable content snapshots and restores older content as a new revision', async () => {
    const { workspace, create, save } = setup()
    await create()
    await save(1, 'Second')
    await save(2, 'Third')
    expect((await workspace.documents.history('drawing')).map(item => item.revision)).toEqual([3, 2, 1])
    const previous = await workspace.documents.readRevision('drawing', 2)
    expect(previous?.doc.documentName).toBe('Second')
    const current = (await workspace.documents.list())[0]
    const restored = await workspace.documents.restore(current, 1)
    expect(restored.revision).toBe(4)
    expect(restored.doc.documentName).toBe('Original')
    expect((await workspace.documents.readRevision('drawing', 2))?.doc.documentName).toBe('Second')
    expect((await workspace.documents.readRevision('drawing', 3))?.doc.documentName).toBe('Third')
    const history = await workspace.documents.history('drawing')
    expect(history.map(item => item.revision)).toEqual([4, 3, 2, 1])
    expect(history[0]).toMatchObject({ kind: 'restore', restoredFromRevision: 1 })
    await expect(workspace.documents.restore(current, 2)).rejects.toThrow('changed')
    expect((await workspace.documents.history('drawing')).length).toBe(4)
  })

  it('retains history across soft deletion and restores a deleted drawing without erasing history', async () => {
    const { alice, workspace, create } = setup()
    const folder = await workspace.folders.create('Temporary')
    await create()
    await workspace.documents.move((await workspace.documents.list())[0], folder.id)
    await alice.mutation(app.api.cloudDocuments.remove, { id: 'drawing' })
    expect(await workspace.documents.list(folder.id)).toEqual([])
    await workspace.folders.remove(folder)
    const history = await workspace.documents.history('drawing')
    expect(history.map(item => item.kind)).toEqual(['delete', 'save'])
    const restored = await workspace.documents.restore({ id: 'drawing', name: 'Deleted', revision: 2, locationRevision: null, folderId: null, updatedAt: 0 }, 1)
    expect(restored.revision).toBe(3)
    expect((await workspace.documents.list())[0].id).toBe('drawing')
    expect((await workspace.documents.history('drawing')).map(item => item.kind)).toEqual(['restore', 'delete', 'save'])
  })

  it('keeps legacy drawings at root and records their baseline on the next save', async () => {
    const { server, alice, workspace } = setup()
    const identity = await alice.run(ctx => ctx.auth.getUserIdentity())
    await server.run(ctx => ctx.db.insert('cloudDocuments', { owner: identity!.tokenIdentifier, clientId: 'legacy', name: 'Legacy', docJson: JSON.stringify(drawing('Legacy')), revision: 7, createdAt: 1, updatedAt: 2 }))
    const legacy = (await workspace.documents.list())[0]
    expect(legacy.locationRevision).toBeNull()
    expect(await workspace.documents.history('legacy')).toEqual([])
    const folder = await workspace.folders.create('Archive')
    await workspace.documents.move(legacy, folder.id)
    await alice.mutation(app.api.cloudDocuments.save, { id: 'legacy', name: 'Updated legacy', docJson: JSON.stringify(drawing('Updated legacy')), expectedRevision: 7 })
    expect((await workspace.documents.history('legacy')).map(item => item.revision)).toEqual([8, 7])
    expect((await workspace.documents.list(folder.id))[0].name).toBe('Updated legacy')
    expect(await workspace.documents.list()).toEqual([])
  })

  it('paginates folders, private drawing metadata and history without dropping pages', async () => {
    const { workspace, create, save } = setup()
    for (let index = 0; index < 28; index++) {
      await workspace.folders.create(`Folder ${index}`)
      await create(`doc-${index}`, `Drawing ${index}`)
    }
    expect(await workspace.folders.listAll()).toHaveLength(28)
    expect(await workspace.folders.list()).toHaveLength(28)
    expect(await workspace.documents.list()).toHaveLength(28)
    for (let revision = 1; revision < 28; revision++) await save(revision, `Revision ${revision + 1}`, 'doc-0')
    const history = await workspace.documents.history('doc-0')
    expect(history).toHaveLength(28)
    expect(history[0].revision).toBe(28)
    expect(history.at(-1)?.revision).toBe(1)
  })

  it('enforces maximum tree depth when creating and when moving an existing subtree', async () => {
    const { workspace } = setup()
    let parent: string | null = null
    for (let depth = 1; depth <= 31; depth++) parent = (await workspace.folders.create(`Depth ${depth}`, parent)).id
    const branch = await workspace.folders.create('Branch')
    await workspace.folders.create('Branch child', branch.id)
    await expect(workspace.folders.move(branch, parent)).rejects.toThrow('nesting limit')
    const last = await workspace.folders.create('Depth 32', parent)
    await expect(workspace.folders.create('Depth 33', last.id)).rejects.toThrow('32 levels')
    expect((await workspace.folders.get(branch.id))?.parentId).toBeNull()
  })
})
