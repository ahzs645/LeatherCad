import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import type {
  DocFile,
  FoldLine,
  Layer,
  LineType,
  Shape,
  StitchHole,
} from '../cad/cad-types'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import {
  createTemplateFromDoc,
  insertTemplateDocIntoCurrent,
  parseTemplateRepositoryImport,
  serializeTemplateRepository,
  type TemplateRepositoryEntry,
} from '../templates/template-repository'
import {
  getCatalogItemCount,
  mergeCatalogShopImport,
  parseCatalogShopImport,
  type CatalogRepositoryShop,
} from '../templates/catalog-repository'
import { downloadFile } from '../editor-utils'

type UseTemplateActionsParams = {
  templateRepository: TemplateRepositoryEntry[]
  selectedTemplateEntry: TemplateRepositoryEntry | null
  selectedTemplateEntryId: string | null
  selectedCatalogShopId: string | null
  buildCurrentDocFile: () => DocFile
  applyLoadedDocument: (doc: DocFile, statusMessage: string) => void
  layers: Layer[]
  lineTypes: LineType[]
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  clearDraft: () => void
  setTemplateRepository: Dispatch<SetStateAction<TemplateRepositoryEntry[]>>
  setCatalogRepository: Dispatch<SetStateAction<CatalogRepositoryShop[]>>
  setSelectedTemplateEntryId: Dispatch<SetStateAction<string | null>>
  setSelectedCatalogShopId: Dispatch<SetStateAction<string | null>>
  setLayers: Dispatch<SetStateAction<Layer[]>>
  setLineTypes: Dispatch<SetStateAction<LineType[]>>
  setActiveLineTypeId: Dispatch<SetStateAction<string>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useTemplateActions(params: UseTemplateActionsParams) {
  const {
    templateRepository,
    selectedTemplateEntry,
    selectedTemplateEntryId,
    selectedCatalogShopId,
    buildCurrentDocFile,
    applyLoadedDocument,
    layers,
    lineTypes,
    shapes,
    foldLines,
    stitchHoles,
    clearDraft,
    setTemplateRepository,
    setCatalogRepository,
    setSelectedTemplateEntryId,
    setSelectedCatalogShopId,
    setLayers,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setSelectedShapeIds,
    setActiveLayerId,
    setStatus,
  } = params

  const handleSaveTemplateToRepository = () => {
    const defaultName = `Template ${templateRepository.length + 1}`
    const inputName = window.prompt('Template name', defaultName)?.trim()
    if (!inputName) {
      return
    }
    const entry = createTemplateFromDoc(inputName, buildCurrentDocFile())
    setTemplateRepository((previous) => [entry, ...previous])
    setSelectedTemplateEntryId(entry.id)
    setStatus(`Saved template "${entry.name}"`)
  }

  const handleDeleteTemplateFromRepository = (entryId: string) => {
    setTemplateRepository((previous) => previous.filter((entry) => entry.id !== entryId))
    if (selectedTemplateEntryId === entryId) {
      setSelectedTemplateEntryId(null)
    }
    setStatus('Template deleted')
  }

  const handleLoadTemplateAsDocument = () => {
    if (!selectedTemplateEntry) {
      setStatus('Select a template first')
      return
    }
    applyLoadedDocument(
      {
        ...selectedTemplateEntry.doc,
        documentName: selectedTemplateEntry.doc.documentName?.trim() || selectedTemplateEntry.name,
      },
      `Loaded template: ${selectedTemplateEntry.name}`,
    )
  }

  const handleInsertTemplateIntoDocument = () => {
    if (!selectedTemplateEntry) {
      setStatus('Select a template first')
      return
    }
    const inserted = insertTemplateDocIntoCurrent(
      selectedTemplateEntry.doc,
      layers,
      lineTypes,
      shapes,
      foldLines,
      stitchHoles,
    )
    setLayers(inserted.layers)
    setLineTypes(inserted.lineTypes)
    setActiveLineTypeId(inserted.activeLineTypeId)
    setShapes(inserted.shapes)
    setFoldLines(inserted.foldLines)
    setStitchHoles(normalizeStitchHoleSequences(inserted.stitchHoles))
    setSelectedShapeIds(inserted.insertedShapeIds)
    if (inserted.insertedLayerIds.length > 0) {
      setActiveLayerId(inserted.insertedLayerIds[0])
    }
    clearDraft()
    setStatus(`Inserted template: ${selectedTemplateEntry.name}`)
  }

  const handleExportTemplateRepository = () => {
    if (templateRepository.length === 0) {
      setStatus('Template repository is empty')
      return
    }
    const payload = serializeTemplateRepository(templateRepository)
    downloadFile('leathercraft-template-repository.json', payload, 'application/json;charset=utf-8')
    setStatus(`Exported ${templateRepository.length} template${templateRepository.length === 1 ? '' : 's'}`)
  }

  const handleImportTemplateRepositoryFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    try {
      const raw = await file.text()
      const importedEntries = parseTemplateRepositoryImport(raw)
      setTemplateRepository((previous) => {
        const existingById = new Map(previous.map((entry) => [entry.id, entry]))
        importedEntries.forEach((entry) => existingById.set(entry.id, entry))
        return Array.from(existingById.values()).sort((left, right) =>
          left.updatedAt > right.updatedAt ? -1 : 1,
        )
      })
      setStatus(`Imported ${importedEntries.length} template${importedEntries.length === 1 ? '' : 's'}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Template import failed: ${message}`)
    }
  }

  const handleImportCatalogFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    try {
      const raw = await file.text()
      const importedShop = parseCatalogShopImport(raw, file.name)
      const importedItemCount = getCatalogItemCount(importedShop)
      setCatalogRepository((previous) => mergeCatalogShopImport(previous, importedShop))
      setSelectedCatalogShopId(importedShop.id)
      setStatus(
        `Imported catalog "${importedShop.name}" (${importedShop.groups.length} group${
          importedShop.groups.length === 1 ? '' : 's'
        }, ${importedItemCount} item${importedItemCount === 1 ? '' : 's'})`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Catalog import failed: ${message}`)
    }
  }

  const handleDeleteCatalogShop = (shopId: string) => {
    setCatalogRepository((previous) => previous.filter((shop) => shop.id !== shopId))
    if (selectedCatalogShopId === shopId) {
      setSelectedCatalogShopId(null)
    }
    setStatus('Catalog removed')
  }

  return {
    handleSaveTemplateToRepository,
    handleDeleteTemplateFromRepository,
    handleLoadTemplateAsDocument,
    handleInsertTemplateIntoDocument,
    handleExportTemplateRepository,
    handleImportTemplateRepositoryFile,
    handleImportCatalogFile,
    handleDeleteCatalogShop,
  }
}
