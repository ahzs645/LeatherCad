import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import type {
  DocFile,
  FoldLine,
  Layer,
  LineType,
  Shape,
  SketchGroup,
  StitchHole,
} from '../cad/cad-types'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import {
  createTemplateFromDoc,
  flipTemplateEntryShapes,
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
  updateCatalogGroup,
  updateCatalogItem,
  updateCatalogShop,
  type CatalogGroupPatch,
  type CatalogItemPatch,
  type CatalogRepositoryMoveDirection,
  type CatalogRepositoryShop,
  type CatalogRepositorySortKey,
  type CatalogShopPatch,
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
  sketchGroups: SketchGroup[]
  selectedShapeIdSet: Set<string>
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
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  setStatus: Dispatch<SetStateAction<string>>
}

const TEMPLATE_GROUP_ANNOTATION_PREFIX = 'Template: '

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
    sketchGroups,
    selectedShapeIdSet,
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
    setSketchGroups,
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

  const handleFlipTemplate = (entryId: string, axis: 'horizontal' | 'vertical') => {
    setTemplateRepository((previous) =>
      previous.map((entry) => (entry.id === entryId ? flipTemplateEntryShapes(entry, axis) : entry)),
    )
    setStatus(`Template flipped ${axis === 'horizontal' ? 'horizontally' : 'vertically'}`)
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

    const templateGroupId = uid()
    const templateGroupLayerId =
      inserted.insertedLayerIds[0] ?? inserted.layers[0]?.id ?? layers[0]?.id ?? ''
    const insertedShapeIdSet = new Set(inserted.insertedShapeIds)
    const taggedShapes = inserted.shapes.map((shape) =>
      insertedShapeIdSet.has(shape.id) ? { ...shape, groupId: templateGroupId } : shape,
    )
    const templateGroup: SketchGroup = {
      id: templateGroupId,
      name: `${selectedTemplateEntry.name} (template)`,
      layerId: templateGroupLayerId,
      visible: true,
      locked: false,
      annotation: `${TEMPLATE_GROUP_ANNOTATION_PREFIX}${selectedTemplateEntry.name}`,
    }

    setLayers(inserted.layers)
    setLineTypes(inserted.lineTypes)
    setActiveLineTypeId(inserted.activeLineTypeId)
    setShapes(taggedShapes)
    setFoldLines(inserted.foldLines)
    setStitchHoles(normalizeStitchHoleSequences(inserted.stitchHoles))
    setSketchGroups((previous) =>
      inserted.insertedShapeIds.length > 0 ? [...previous, templateGroup] : previous,
    )
    setSelectedShapeIds(inserted.insertedShapeIds)
    if (inserted.insertedLayerIds.length > 0) {
      setActiveLayerId(inserted.insertedLayerIds[0])
    }
    clearDraft()
    setStatus(`Inserted template: ${selectedTemplateEntry.name}`)
  }

  const handleSeparateTemplateIntoShapes = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select shapes from an inserted template to separate')
      return
    }
    const templateGroups = sketchGroups.filter(
      (group) => typeof group.annotation === 'string' && group.annotation.startsWith(TEMPLATE_GROUP_ANNOTATION_PREFIX),
    )
    if (templateGroups.length === 0) {
      setStatus('No inserted template groups found in the document')
      return
    }
    const affectedGroupIds = new Set<string>()
    for (const shape of shapes) {
      if (!selectedShapeIdSet.has(shape.id) || !shape.groupId) continue
      if (templateGroups.some((group) => group.id === shape.groupId)) {
        affectedGroupIds.add(shape.groupId)
      }
    }
    if (affectedGroupIds.size === 0) {
      setStatus('Selection is not part of an inserted template')
      return
    }
    setShapes((previous) =>
      previous.map((shape) =>
        shape.groupId && affectedGroupIds.has(shape.groupId)
          ? { ...shape, groupId: undefined }
          : shape,
      ),
    )
    setSketchGroups((previous) => previous.filter((group) => !affectedGroupIds.has(group.id)))
    setStatus(
      `Separated ${affectedGroupIds.size} template instance${affectedGroupIds.size === 1 ? '' : 's'} into shapes`,
    )
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

  const handleUpdateCatalogShop = (shopId: string, patch: CatalogShopPatch) => {
    setCatalogRepository((previous) => updateCatalogShop(previous, shopId, patch))
    setStatus('Catalog shop updated')
  }

  const handleUpdateCatalogGroup = (shopId: string, groupId: string, patch: CatalogGroupPatch) => {
    setCatalogRepository((previous) => updateCatalogGroup(previous, shopId, groupId, patch))
    setStatus('Catalog group updated')
  }

  const handleUpdateCatalogItem = (shopId: string, groupId: string, itemId: string, patch: CatalogItemPatch) => {
    setCatalogRepository((previous) => updateCatalogItem(previous, shopId, groupId, itemId, patch))
    setStatus('Catalog item updated')
  }

  return {
    handleSaveTemplateToRepository,
    handleDeleteTemplateFromRepository,
    handleMoveTemplateEntry,
    handleSortTemplates,
    handleFlipTemplate,
    handleLoadTemplateAsDocument,
    handleInsertTemplateIntoDocument,
    handleSeparateTemplateIntoShapes,
    handleExportTemplateRepository,
    handleImportTemplateRepositoryFile,
    handleImportCatalogFile,
    handleDeleteCatalogShop,
    handleExportCatalogShop,
    handleMoveCatalogShop,
    handleSortCatalogShops,
    handleUpdateCatalogShop,
    handleUpdateCatalogGroup,
    handleUpdateCatalogItem,
  }
}
