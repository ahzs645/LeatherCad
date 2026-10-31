import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseImportedJsonDocument } from '../editor-json-import'
import { createDexieDataClient } from './dexie-data-client'
import { createLibraryBackup, parseLibraryBackup, restoreLibraryBackup, type LibraryBackup } from './library-backup'

const doc = (name: string) => parseImportedJsonDocument(JSON.stringify({ objects: [], documentName: name })).doc
const client = () => createDexieDataClient({ databaseName: `backup-${crypto.randomUUID()}` })!
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

describe('local library backup', () => {
  it('roundtrips saved projects, templates, catalog and allowed browser preferences without sign-in or recovery state', async () => {
    const source = client(), target = client()
    await source.documents.create({ id: 'p', name: 'Wallet', doc: doc('Wallet') })
    await source.settings.set('display', 'mm')
    await source.templateRepository.replaceAll([{ id: 't', name: 'Template', doc: doc('Template'), createdAt: '2026-01-01', updatedAt: '2026-01-01' }])
    localStorage.setItem('leathercraft-template-repository-folders-v1', '[{"id":"folder","name":"Wallets"}]')
    localStorage.setItem('oidc.user', 'private-token'); localStorage.setItem('leathercad-draft-recovery', 'private-draft')
    const backup = await createLibraryBackup(source)
    expect(Object.keys(backup.browserPreferences!.entries)).toEqual(['leathercraft-template-repository-folders-v1'])
    await restoreLibraryBackup(target, parseLibraryBackup(JSON.stringify(backup)), 'replace')
    expect((await target.documents.list())[0].name).toBe('Wallet')
    expect((await target.templateRepository.list())[0].id).toBe('t')
    expect(await target.settings.get('display')).toBe('mm')
    expect(localStorage.getItem('oidc.user')).toBe('private-token')
  })
  it('merges missing IDs and keys while preserving existing records and timestamps', async () => {
    const source = client(), target = client()
    await source.documents.create({ id: 'same', name: 'Incoming', doc: doc('Incoming') })
    await source.documents.create({ id: 'new', name: 'New', doc: doc('New') })
    await target.documents.create({ id: 'same', name: 'Keep', doc: doc('Keep') })
    await source.settings.set('theme', 'light'); await target.settings.set('theme', 'dark')
    const before = await target.documents.get('same')
    await restoreLibraryBackup(target, await createLibraryBackup(source, null), 'merge', null)
    expect(await target.documents.get('same')).toEqual(before)
    expect((await target.documents.get('new'))?.name).toBe('New')
    expect(await target.settings.get('theme')).toBe('dark')
  })
  it('replaces all tables and removes settings absent from the backup', async () => {
    const source = client(), target = client()
    await source.documents.create({ id: 'new', name: 'New', doc: doc('New') })
    await target.documents.create({ id: 'old', name: 'Old', doc: doc('Old') }); await target.settings.set('old', 'value')
    await restoreLibraryBackup(target, await createLibraryBackup(source, null), 'replace', null)
    expect(await target.documents.get('old')).toBeNull()
    expect(await target.settings.get('old')).toBeNull()
    expect((await target.documents.list()).map((item) => item.id)).toEqual(['new'])
  })
  it('merges browser template folders by ID while keeping preference conflicts local', async () => {
    const target = client()
    localStorage.setItem('leathercraft-template-repository-folders-v1', '[{"id":"same","name":"Keep"}]')
    localStorage.setItem('leathercad-interface-language-v1', 'en')
    const backup = await createLibraryBackup(target)
    backup.browserPreferences!.entries['leathercraft-template-repository-folders-v1'] = '[{"id":"same","name":"Incoming"},{"id":"new","name":"New"}]'
    backup.browserPreferences!.entries['leathercad-interface-language-v1'] = 'ja'
    await restoreLibraryBackup(target, backup, 'merge')
    expect(JSON.parse(localStorage.getItem('leathercraft-template-repository-folders-v1')!)).toEqual([{ id: 'same', name: 'Keep' }, { id: 'new', name: 'New' }])
    expect(localStorage.getItem('leathercad-interface-language-v1')).toBe('en')
  })
  it('rejects malformed documents, duplicate IDs, unsupported versions and private browser keys before mutation', async () => {
    const target = client()
    await target.documents.create({ id: 'keep', name: 'Keep', doc: doc('Keep') })
    const backup = await createLibraryBackup(target, null)
    expect(() => parseLibraryBackup(JSON.stringify({ ...backup, version: 2 }))).toThrow('supported')
    expect(() => parseLibraryBackup(JSON.stringify({ ...backup, data: { ...backup.data, documents: [...backup.data.documents, ...backup.data.documents] } }))).toThrow('duplicate')
    const malformed = structuredClone(backup)
    malformed.data.documents[0].doc.objects = [{ type: 'invented' }] as never
    await expect(restoreLibraryBackup(target, malformed, 'replace', null)).rejects.toThrow('Invalid shape')
    expect(() => parseLibraryBackup(JSON.stringify({ ...backup, browserPreferences: { version: 1, entries: { 'oidc.user': 'secret' } } }))).toThrow('unsupported browser')
    expect((await target.documents.list()).map((item) => item.id)).toEqual(['keep'])
  })
  it('rolls back prior table writes and browser preferences when a later write fails', async () => {
    const source = client(), target = client()
    await source.documents.create({ id: 'incoming', name: 'Incoming', doc: doc('Incoming') })
    await source.settings.set('break', 'trigger')
    await target.documents.create({ id: 'keep', name: 'Keep', doc: doc('Keep') })
    localStorage.setItem('leathercad-interface-language-v1', 'en')
    const backup = await createLibraryBackup(source)
    backup.browserPreferences!.entries['leathercad-interface-language-v1'] = 'ja'
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if ((value as { key?: string }).key === 'break') throw new DOMException('Quota exceeded', 'QuotaExceededError')
      return key === undefined ? put.call(this, value) : put.call(this, value, key)
    })
    await expect(restoreLibraryBackup(target, backup, 'replace')).rejects.toThrow()
    expect((await target.documents.list()).map((item) => item.id)).toEqual(['keep'])
    expect(localStorage.getItem('leathercad-interface-language-v1')).toBe('en')
    expect(backup.browserPreferences!.entries['leathercad-interface-language-v1']).toBe('ja')
  })
  it('does not mutate the database if browser preference writes fail', async () => {
    const target = client()
    await target.documents.create({ id: 'keep', name: 'Keep', doc: doc('Keep') })
    const backup: LibraryBackup = { format: 'leathercad-library', version: 1, createdAt: new Date().toISOString(), data: { documents: [], settings: {}, templateRepository: [], catalogRepository: [] }, browserPreferences: { version: 1, entries: { 'leathercad-interface-language-v1': 'ja' } } }
    const store = { getItem: () => null, removeItem: () => undefined, setItem: () => { throw new Error('blocked') } } as unknown as Storage
    await expect(restoreLibraryBackup(target, backup, 'replace', store)).rejects.toThrow('blocked')
    expect((await target.documents.list()).map((item) => item.id)).toEqual(['keep'])
  })
})
