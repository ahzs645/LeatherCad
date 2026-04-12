import { useEffect, useMemo } from 'react'
import type { DocFile } from '../cad/cad-types'
import { safeLocalStorageGet, safeLocalStorageRemove } from '../ops/safe-storage'
import type { CatalogRepositoryShop } from '../templates/catalog-repository'

const OPEN_DOC_TRANSFER_PREFIX = 'leathercraft-open-doc-'

type UseEditorDocumentBootstrapParams = {
  bundledCatalogRepository: CatalogRepositoryShop[]
  catalogRepository: CatalogRepositoryShop[]
  setSystemThemeMode: React.Dispatch<React.SetStateAction<'light' | 'dark'>>
  applyLoadedDocument: (doc: DocFile, statusMessage: string) => void
}

export function useEditorDocumentBootstrap({
  bundledCatalogRepository,
  catalogRepository,
  setSystemThemeMode,
  applyLoadedDocument,
}: UseEditorDocumentBootstrapParams) {
  const mergedCatalogRepository = useMemo(() => {
    if (bundledCatalogRepository.length === 0) {
      return catalogRepository
    }
    const byId = new Map<string, CatalogRepositoryShop>()
    bundledCatalogRepository.forEach((shop) => byId.set(shop.id, shop))
    catalogRepository.forEach((shop) => byId.set(shop.id, shop))
    return Array.from(byId.values()).sort((left, right) => (left.importedAt > right.importedAt ? -1 : 1))
  }, [bundledCatalogRepository, catalogRepository])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handlePreferenceChange = (event: MediaQueryListEvent) => {
      setSystemThemeMode(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handlePreferenceChange)
    return () => {
      mediaQuery.removeEventListener('change', handlePreferenceChange)
    }
  }, [setSystemThemeMode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const url = new URL(window.location.href)
    const token = url.searchParams.get('openDoc')
    if (!token) {
      return
    }

    const storageKey = `${OPEN_DOC_TRANSFER_PREFIX}${token}`
    const raw = safeLocalStorageGet(storageKey)
    if (!raw) {
      return
    }

    void import('../editor-json-import')
      .then(({ parseImportedJsonDocument }) => {
        const parsed = parseImportedJsonDocument(raw)
        applyLoadedDocument(parsed.doc, 'Loaded project from new tab transfer')
        safeLocalStorageRemove(storageKey)
        url.searchParams.delete('openDoc')
        window.history.replaceState(null, '', url.toString())
      })
      .catch((error) => {
        console.error('Open in new tab transfer failed', error)
      })
  }, [applyLoadedDocument])

  return {
    mergedCatalogRepository,
  }
}
