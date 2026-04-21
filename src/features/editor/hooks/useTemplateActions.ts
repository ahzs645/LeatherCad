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
  moveTemplateRepositoryEntry,
  parseTemplateRepositoryImport,
  serializeTemplateRepository,
  sortTemplateRepository,
  type TemplateRepositoryMoveDirection,
  type TemplateRepositoryEntry,
  type TemplateRepositorySortKey,
} from '../templates/template-repository'
import {
  getCatalogItemCount,
  mergeCatalogShopImport,
  moveCatalogRepositoryShop,
  parseCatalogShopImport,
  serializeCatalogShop,
  sortCatalogRepository,
  type CatalogRepositoryMoveDirection,
  type CatalogRepositoryShop,
  type CatalogRepositorySortKey,
} from '../templates/catalog-repository'
import { downloadFile } from '../editor-utils'

type UseTemplateActionsParams = {
  templateRepository: TemplateRepositoryEntry[]
  catalogRepository: CatalogRepositoryShop[]
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
    catalogRepository,
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
    const fillColorInput = window
      .prompt('Fill color for closed shapes (hex, or blank to skip):', '')
      ?.trim()
    const fillColor = fillColorInput && /^#[0-9a-fA-F]{6}$/.test(fillColorInput) ? fillColorInput : null

    const doc = buildCurrentDocFile()
    const shapesWithFill = fillColor
      ? doc.objects?.map((shape) =>
          shape.type === 'line' || shape.type === 'text' ? shape : { ...shape, fillColor },
        )
      : doc.objects

    const entry = createTemplateFromDoc(
      inputName,
      shapesWithFill === doc.objects ? doc : { ...doc, objects: shapesWithFill },
    )
    setTemplateRepository((previous) => [entry, ...previous])
    setSelectedTemplateEntryId(entry.id)
    setStatus(
      fillColor
        ? `Saved template "${entry.name}" with painted fill ${fillColor}`
        : `Saved template "${entry.name}"`,
    )
  }

  const handleDeleteTemplateFromRepository = (entryId: string) => {
    setTemplateRepository((previous) => previous.filter((entry) => entry.id !== entryId))
    if (selectedTemplateEntryId === entryId) {
      setSelectedTemplateEntryId(null)
    }
    setStatus('Template deleted')
  }

  const handleMoveTemplateEntry = (entryId: string, direction: TemplateRepositoryMoveDirection) => {
    setTemplateRepository((previous) => moveTemplateRepositoryEntry(previous, entryId, direction))
    setStatus('Template order updated')
  }

  const handleSortTemplates = (sortKey: TemplateRepositorySortKey) => {
    setTemplateRepository((previous) => sortTemplateRepository(previous, sortKey))
    setStatus(sortKey === 'name' ? 'Templates sorted by name' : 'Templates sorted by update time')
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
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const isZip =
        bytes.length >= 4 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
        (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)

      let importedEntries
      let skippedSummary = ''
      if (isZip) {
        const { importRepositoryZip } = await import('../io/io-repository-zip')
        const result = await importRepositoryZip(bytes)
        importedEntries = result.entries
        if (result.skipped.length > 0) {
          skippedSummary = ` (${result.skipped.length} unsupported entr${result.skipped.length === 1 ? 'y' : 'ies'} skipped)`
        }
      } else {
        const raw = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '')
        importedEntries = parseTemplateRepositoryImport(raw)
      }

      setTemplateRepository((previous) => {
        const existingById = new Map(previous.map((entry) => [entry.id, entry]))
        importedEntries.forEach((entry) => existingById.set(entry.id, entry))
        return Array.from(existingById.values()).sort((left, right) =>
          left.updatedAt > right.updatedAt ? -1 : 1,
        )
      })
      setStatus(
        `Imported ${importedEntries.length} template${importedEntries.length === 1 ? '' : 's'}${skippedSummary}`,
      )
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

  const handleExportCatalogShop = (shopId: string) => {
    const shop = catalogRepository.find((entry) => entry.id === shopId)
    if (!shop) {
      setStatus('Select a catalog to export')
      return
    }
    if (shop.groups.length === 0) {
      setStatus('Import the source catalog before exporting; summary-only catalogs do not include item data')
      return
    }

    const fileBase = (shop.sourceFileName || `${shop.name}.ctlg`)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/(^-|-$)/g, '') || 'leathercraft-catalog'
    downloadFile(`${fileBase}.ctlg`, serializeCatalogShop(shop), 'application/json;charset=utf-8')
    setStatus(`Exported catalog "${shop.name}"`)
  }

  const handleMoveCatalogShop = (shopId: string, direction: CatalogRepositoryMoveDirection) => {
    setCatalogRepository((previous) => moveCatalogRepositoryShop(previous, shopId, direction))
    setStatus('Catalog order updated')
  }

  const handleSortCatalogShops = (sortKey: CatalogRepositorySortKey) => {
    setCatalogRepository((previous) => sortCatalogRepository(previous, sortKey))
    setStatus(sortKey === 'name' ? 'Catalogs sorted by name' : 'Catalogs sorted by import time')
  }

  return {
    handleSaveTemplateToRepository,
    handleDeleteTemplateFromRepository,
    handleMoveTemplateEntry,
    handleSortTemplates,
    handleLoadTemplateAsDocument,
    handleInsertTemplateIntoDocument,
    handleExportTemplateRepository,
    handleImportTemplateRepositoryFile,
    handleImportCatalogFile,
    handleDeleteCatalogShop,
    handleExportCatalogShop,
    handleMoveCatalogShop,
    handleSortCatalogShops,
  }
}
