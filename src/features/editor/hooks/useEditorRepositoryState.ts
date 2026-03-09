import { useState } from 'react'
import {
  hasTemplateRepositoryStorage,
  loadTemplateRepository,
  type TemplateRepositoryEntry,
} from '../templates/template-repository'
import { createBuiltinTemplateRepository } from '../templates/template-builtins'
import {
  loadBundledCatalogRepository,
  loadCatalogRepository,
  type CatalogRepositoryShop,
} from '../templates/catalog-repository'

export function useEditorRepositoryState() {
  const [templateRepository, setTemplateRepository] = useState<TemplateRepositoryEntry[]>(() => {
    const saved = loadTemplateRepository()
    if (saved.length > 0 || hasTemplateRepositoryStorage()) {
      return saved
    }
    return createBuiltinTemplateRepository()
  })
  const [selectedTemplateEntryId, setSelectedTemplateEntryId] = useState<string | null>(null)
  const [catalogRepository, setCatalogRepository] = useState<CatalogRepositoryShop[]>(() => loadCatalogRepository())
  const [bundledCatalogRepository] = useState<CatalogRepositoryShop[]>(() => loadBundledCatalogRepository())
  const [selectedCatalogShopId, setSelectedCatalogShopId] = useState<string | null>(
    () => catalogRepository[0]?.id ?? bundledCatalogRepository[0]?.id ?? null,
  )

  return {
    templateRepository, setTemplateRepository,
    selectedTemplateEntryId, setSelectedTemplateEntryId,
    catalogRepository, setCatalogRepository,
    bundledCatalogRepository,
    selectedCatalogShopId, setSelectedCatalogShopId,
  }
}
