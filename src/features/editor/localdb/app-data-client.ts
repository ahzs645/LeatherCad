import type { DocFile } from '../cad/cad-types'
import type { CatalogRepositoryShop } from '../templates/catalog-repository'
import type { TemplateRepositoryEntry } from '../templates/template-repository'

export type AppId = string

export type StoredEditorDocument = {
  id: AppId
  name: string
  doc: DocFile
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export type CreateEditorDocumentInput = {
  id?: AppId
  name: string
  doc: DocFile
}

export type SaveEditorDocumentInput = {
  id: AppId
  name?: string
  doc: DocFile
}

export type LocalDbExport = {
  documents: StoredEditorDocument[]
  settings: Record<string, string>
  templateRepository: TemplateRepositoryEntry[]
  catalogRepository: CatalogRepositoryShop[]
}

export interface AppDataClient {
  documents: {
    list(): Promise<StoredEditorDocument[]>
    get(id: AppId): Promise<StoredEditorDocument | null>
    create(input: CreateEditorDocumentInput): Promise<StoredEditorDocument>
    save(input: SaveEditorDocumentInput): Promise<StoredEditorDocument>
    delete(id: AppId): Promise<void>
    getAutoSaveSnapshot(): Promise<string | null>
    writeAutoSaveSnapshot(serializedDoc: string): Promise<void>
    clearAutoSaveSnapshot(): Promise<void>
  }

  settings: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
  }

  templateRepository: {
    list(): Promise<TemplateRepositoryEntry[]>
    replaceAll(entries: TemplateRepositoryEntry[]): Promise<void>
    hasSavedEntries(): Promise<boolean>
  }

  catalogRepository: {
    list(): Promise<CatalogRepositoryShop[]>
    replaceAll(shops: CatalogRepositoryShop[]): Promise<void>
  }

  exportAll(): Promise<LocalDbExport>
}
