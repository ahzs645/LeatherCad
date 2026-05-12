import { useEffect, useState } from 'react'
import {
  hasTemplateRepositoryStorage,
  hasTemplateRepositoryStorageInLocalDb,
  loadTemplateRepositoryFromLocalDb,
  loadTemplateRepository,
  type TemplateRepositoryEntry,
} from '../templates/template-repository'
import { createBuiltinTemplateRepository } from '../templates/template-builtins'
import {
  loadBundledCatalogRepository,
  loadCatalogRepositoryFromLocalDb,
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
  const [localDbHydrated, setLocalDbHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function hydrateFromLocalDb() {
      const [savedTemplates, hasSavedTemplates, savedCatalog] = await Promise.all([
        loadTemplateRepositoryFromLocalDb(),
        hasTemplateRepositoryStorageInLocalDb(),
        loadCatalogRepositoryFromLocalDb(),
      ])

      if (cancelled) {
        return
      }

      if (savedTemplates.length > 0 || hasSavedTemplates) {
        setTemplateRepository(savedTemplates)
      }
      setCatalogRepository(savedCatalog)
      setSelectedCatalogShopId((previous) => previous ?? savedCatalog[0]?.id ?? bundledCatalogRepository[0]?.id ?? null)
      setLocalDbHydrated(true)
    }

    void hydrateFromLocalDb()

    return () => {
      cancelled = true
    }
  }, [bundledCatalogRepository])

  return {
    templateRepository, setTemplateRepository,
    selectedTemplateEntryId, setSelectedTemplateEntryId,
    catalogRepository, setCatalogRepository,
    bundledCatalogRepository,
    selectedCatalogShopId, setSelectedCatalogShopId,
    localDbHydrated,
  }
}
