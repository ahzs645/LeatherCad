import Dexie, { type Table } from 'dexie'
import type { AppDataClient, AppId, LocalDbExport, StoredEditorDocument } from './app-data-client'
import type { CatalogRepositoryShop } from '../templates/catalog-repository'
import type { TemplateRepositoryEntry } from '../templates/template-repository'
import { uid } from '../cad/cad-geometry'

const DATABASE_NAME = 'leathercad-local-v1'
const AUTOSAVE_DOCUMENT_ID = 'autosave-current'

type SettingRecord = {
  key: string
  value: string
  updatedAt: number
}

class LeatherCadDexieDb extends Dexie {
  documents!: Table<StoredEditorDocument, string>
  settings!: Table<SettingRecord, string>
  templateRepository!: Table<TemplateRepositoryEntry, string>
  catalogRepository!: Table<CatalogRepositoryShop, string>

  constructor(databaseName = DATABASE_NAME) {
    super(databaseName)
    this.version(1).stores({
      documents: 'id, updatedAt, deletedAt',
      settings: 'key, updatedAt',
      templateRepository: 'id, updatedAt',
      catalogRepository: 'id, importedAt',
    })
  }
}

function cloneJson<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function isIndexedDbAvailable() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}

function cloneStoredDocument(document: StoredEditorDocument): StoredEditorDocument {
  return cloneJson(document)
}

function resolveDocumentName(name: string | undefined, doc: StoredEditorDocument['doc']) {
  const trimmedName = name?.trim()
  if (trimmedName) {
    return trimmedName
  }
  const docName = doc.documentName?.trim()
  return docName || 'Untitled project'
}

export type DexieDataClientOptions = {
  databaseName?: string
}

export function createDexieDataClient(options: DexieDataClientOptions = {}): AppDataClient | null {
  if (!isIndexedDbAvailable()) {
    return null
  }

  const db = new LeatherCadDexieDb(options.databaseName)

  return {
    documents: {
      async list() {
        const records = await db.documents
          .filter((document) => document.id !== AUTOSAVE_DOCUMENT_ID && !document.deletedAt)
          .sortBy('updatedAt')
        return records.reverse().map(cloneStoredDocument)
      },

      async get(id: AppId) {
        const record = await db.documents.get(id)
        if (!record || record.deletedAt || record.id === AUTOSAVE_DOCUMENT_ID) {
          return null
        }
        return cloneStoredDocument(record)
      },

      async create(input) {
        const now = Date.now()
        const document: StoredEditorDocument = {
          id: input.id ?? uid(),
          name: resolveDocumentName(input.name, input.doc),
          doc: cloneJson(input.doc),
          createdAt: now,
          updatedAt: now,
        }
        await db.documents.add(document)
        return cloneStoredDocument(document)
      },

      async save(input) {
        const now = Date.now()
        const existing = await db.documents.get(input.id)
        const document: StoredEditorDocument = {
          id: input.id,
          name: resolveDocumentName(input.name ?? existing?.name, input.doc),
          doc: cloneJson(input.doc),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        await db.documents.put(document)
        return cloneStoredDocument(document)
      },

      async delete(id) {
        const existing = await db.documents.get(id)
        if (!existing || existing.id === AUTOSAVE_DOCUMENT_ID) {
          return
        }
        await db.documents.put({
          ...existing,
          updatedAt: Date.now(),
          deletedAt: Date.now(),
        })
      },

      async getAutoSaveSnapshot() {
        const record = await db.documents.get(AUTOSAVE_DOCUMENT_ID)
        if (!record || record.deletedAt) {
          return null
        }
        return JSON.stringify(record.doc)
      },

      async writeAutoSaveSnapshot(serializedDoc) {
        const now = Date.now()
        const parsed = JSON.parse(serializedDoc) as StoredEditorDocument['doc']
        const existing = await db.documents.get(AUTOSAVE_DOCUMENT_ID)
        await db.documents.put({
          id: AUTOSAVE_DOCUMENT_ID,
          name: parsed.documentName?.trim() || 'Autosaved draft',
          doc: parsed,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        })
      },

      async clearAutoSaveSnapshot() {
        const existing = await db.documents.get(AUTOSAVE_DOCUMENT_ID)
        if (!existing) {
          return
        }
        await db.documents.put({
          ...existing,
          updatedAt: Date.now(),
          deletedAt: Date.now(),
        })
      },
    },

    settings: {
      async get(key) {
        return (await db.settings.get(key))?.value ?? null
      },

      async set(key, value) {
        await db.settings.put({ key, value, updatedAt: Date.now() })
      },
    },

    templateRepository: {
      async list() {
        const entries = await db.templateRepository.orderBy('updatedAt').reverse().toArray()
        return cloneJson(entries)
      },

      async replaceAll(entries) {
        await db.transaction('rw', db.templateRepository, async () => {
          await db.templateRepository.clear()
          if (entries.length > 0) {
            await db.templateRepository.bulkPut(cloneJson(entries))
          }
        })
      },

      async hasSavedEntries() {
        return (await db.templateRepository.count()) > 0
      },
    },

    catalogRepository: {
      async list() {
        const shops = await db.catalogRepository.orderBy('importedAt').reverse().toArray()
        return cloneJson(shops)
      },

      async replaceAll(shops) {
        await db.transaction('rw', db.catalogRepository, async () => {
          await db.catalogRepository.clear()
          if (shops.length > 0) {
            await db.catalogRepository.bulkPut(cloneJson(shops))
          }
        })
      },
    },

    async exportAll(): Promise<LocalDbExport> {
      const [documents, settings, templateRepository, catalogRepository] = await Promise.all([
        db.documents.filter((document) => !document.deletedAt).toArray(),
        db.settings.toArray(),
        db.templateRepository.toArray(),
        db.catalogRepository.toArray(),
      ])
      return {
        documents: cloneJson(documents),
        settings: Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
        templateRepository: cloneJson(templateRepository),
        catalogRepository: cloneJson(catalogRepository),
      }
    },
  }
}
