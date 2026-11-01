import type { AppDataClient, LocalDbExport } from './app-data-client'
import { parseImportedJsonDocument } from '../editor-json-import'

export type LibraryBackup = { format: 'leathercad-library'; version: 1; createdAt: string; data: LocalDbExport; browserPreferences?: { version: 1; entries: Record<string, string> } }
const MAX_BYTES = 100 * 1024 * 1024
// Explicit keys only. Never collect OIDC state, tokens, clipboard or recovery drafts.
export const LIBRARY_PREFERENCE_KEYS = [
  'leathercraft-template-repository-v1', 'leathercraft-template-repository-folders-v1', 'leathercraft-catalog-repository-v1',
  'leathercad-editor-prefs-v1', 'leathercad.interface-preferences.v1', 'leathercad.workbench.layout.v1',
  'leathercad-interface-language-v1', 'leathercad-translation-map-v1', 'leathercad.options.category.v1',
  'leathercad-stitch-auto-pitch-settings-v1', 'leathercad-stitch-simulator-settings-v1', 'leathercad-box-stitch-helper-settings-v1',
  'leathercraft-custom-pricking-irons-v2', 'leathercraft-custom-pricking-irons-v1', 'LeathercraftCAD_PrickingIronGroups',
  'leathercad-letter-stamp-font-sets-v1', 'leathercad-font-list-v1',
] as const

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function requireString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a nonempty string.`)
}
function validateDoc(value: unknown, field: string) {
  if (!record(value) || value.version !== 1 || value.units !== 'mm' || !Array.isArray(value.objects)) throw new Error(`${field} is not a version 1 millimetre document.`)
  const parsed = parseImportedJsonDocument(JSON.stringify(value), { preserveShapeIds: true }).doc
  for (const [key, entries] of Object.entries(value)) {
    if (Array.isArray(entries) && key in parsed) {
      const normalized = parsed[key as keyof typeof parsed]
      if (Array.isArray(normalized) && normalized.length !== entries.length) throw new Error(`${field}.${key} contains unsupported or malformed records. Restore was canceled.`)
    }
  }
}
function records(value: unknown, field: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${field} must be an array of at most 100,000 records.`)
  const ids = new Set<string>()
  const checked: Record<string, unknown>[] = []
  for (const item of value) {
    if (!record(item)) throw new Error(`${field} contains a malformed record.`)
    requireString(item.id, `${field}.id`)
    if (ids.has(item.id as string)) throw new Error(`${field} contains duplicate IDs.`)
    ids.add(item.id as string)
    requireString(item.name, `${field}.name`)
    checked.push(item)
  }
  return checked
}

/** Validate the entire payload before any transaction starts; never silently drop records. */
export function validateLibraryData(input: unknown): LocalDbExport {
  if (!record(input)) throw new Error('Missing library data.')
  const documents = records(input.documents, 'documents')
  for (const document of documents) {
    validateDoc(document.doc, `documents.${String(document.id)}`)
    if (![document.createdAt, document.updatedAt].every((time) => typeof time === 'number' && Number.isFinite(time) && time >= 0)) throw new Error('Project timestamps must be finite positive numbers.')
    if (document.deletedAt !== undefined) throw new Error('Backup must not contain deleted project records.')
  }
  if (!record(input.settings) || Object.values(input.settings).some((value) => typeof value !== 'string')) throw new Error('Settings must map keys to strings.')
  for (const template of records(input.templateRepository, 'templates')) {
    validateDoc(template.doc, `templates.${String(template.id)}`)
    for (const key of ['createdAt', 'updatedAt']) if (typeof template[key] !== 'string' || !Number.isFinite(Date.parse(template[key]))) throw new Error('Template timestamps must be valid dates.')
  }
  for (const shop of records(input.catalogRepository, 'catalogs')) {
    if (!Array.isArray(shop.groups) || typeof shop.shopVersion !== 'number' || !Number.isFinite(shop.shopVersion)) throw new Error('Catalog groups or version are malformed.')
    for (const group of records(shop.groups, 'catalog groups')) {
      for (const item of records(group.items, 'catalog items')) {
        if (typeof item.guid !== 'string') throw new Error('Catalog item GUID must be a string.')
      }
    }
  }
  return structuredClone(input) as LocalDbExport
}

export function parseLibraryBackup(raw: string): LibraryBackup {
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error('Library backup exceeds the 100 MB limit.')
  const value: unknown = JSON.parse(raw)
  if (!record(value) || value.format !== 'leathercad-library' || value.version !== 1 || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) throw new Error('Not a supported LeatherCad library backup.')
  let browserPreferences: LibraryBackup['browserPreferences']
  if (value.browserPreferences !== undefined) {
    const prefs = value.browserPreferences
    if (!record(prefs) || prefs.version !== 1 || !record(prefs.entries)) throw new Error('Unsupported browser preferences envelope.')
    for (const [key, entry] of Object.entries(prefs.entries)) {
      if (!(LIBRARY_PREFERENCE_KEYS as readonly string[]).includes(key) || typeof entry !== 'string') throw new Error('Backup contains an unsupported browser preference key.')
      if (key === 'leathercraft-template-repository-v1') for (const template of records(JSON.parse(entry), 'browser templates')) validateDoc(template.doc, `browser templates.${String(template.id)}`)
      if (key === 'leathercraft-template-repository-folders-v1') records(JSON.parse(entry), 'template folders')
      if (key === 'leathercraft-catalog-repository-v1') { const shops: unknown = JSON.parse(entry); validateLibraryData({ documents: [], settings: {}, templateRepository: [], catalogRepository: shops }) }
    }
    browserPreferences = { version: 1, entries: { ...prefs.entries } as Record<string, string> }
  }
  return { format: 'leathercad-library', version: 1, createdAt: value.createdAt, data: validateLibraryData(value.data), ...(browserPreferences ? { browserPreferences } : {}) }
}

function browserStore(): Storage | null { return typeof window !== 'undefined' ? window.localStorage : null }
function readPreferences(storage: Storage): Record<string, string> {
  return Object.fromEntries(LIBRARY_PREFERENCE_KEYS.flatMap((key) => { const value = storage.getItem(key); return value === null ? [] : [[key, value]] }))
}

export async function createLibraryBackup(client: AppDataClient, storage: Storage | null = browserStore()): Promise<LibraryBackup> {
  const backup: LibraryBackup = { format: 'leathercad-library', version: 1, createdAt: new Date().toISOString(), data: validateLibraryData(await client.exportAll()), ...(storage ? { browserPreferences: { version: 1, entries: readPreferences(storage) } } : {}) }
  return parseLibraryBackup(JSON.stringify(backup))
}

export async function restoreLibraryBackup(client: AppDataClient, backup: LibraryBackup, mode: 'merge' | 'replace', storage: Storage | null = browserStore()) {
  const checked = parseLibraryBackup(JSON.stringify(backup))
  if (!client.restoreAll) throw new Error('This storage provider cannot restore libraries atomically. Use the local library.')
  if (mode !== 'merge' && mode !== 'replace') throw new Error('Unknown library restore mode.')
  if (checked.browserPreferences && !storage) throw new Error('Browser preferences storage is unavailable. Restore was canceled.')
  const previous = storage && checked.browserPreferences ? readPreferences(storage) : null
  const applyPreferences = (entries: Record<string, string>, replace: boolean) => {
    if (!storage) return
    if (replace) for (const key of LIBRARY_PREFERENCE_KEYS) storage.removeItem(key)
    for (const [key, value] of Object.entries(entries)) {
      const existing = storage.getItem(key)
      if (replace || existing === null) storage.setItem(key, value)
      else if (['leathercraft-template-repository-v1', 'leathercraft-template-repository-folders-v1', 'leathercraft-catalog-repository-v1'].includes(key)) {
        const current = records(JSON.parse(existing), key)
        const incoming = records(JSON.parse(value), key)
        const ids = new Set(current.map((item) => item.id))
        storage.setItem(key, JSON.stringify([...current, ...incoming.filter((item) => !ids.has(item.id))]))
      }
    }
  }
  try {
    if (checked.browserPreferences) applyPreferences(checked.browserPreferences.entries, mode === 'replace')
    await client.restoreAll(checked.data, mode)
  } catch (error) {
    if (previous) {
      try { applyPreferences(previous, true) } catch { throw new Error('Restore failed and browser preferences could not be rolled back. The database transaction was canceled; retain your backup and retry when storage is available.') }
    }
    throw error
  }
  if (typeof window !== 'undefined' && checked.browserPreferences) window.dispatchEvent(new StorageEvent('storage', { key: null }))
}
