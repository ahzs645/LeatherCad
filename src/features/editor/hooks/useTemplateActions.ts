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
import { shapeTotalArcLength, stampTemplateAlongShape } from '../ops/geometry/path-editing'
import {
  createTemplateFromDoc,
  createTemplateFolder,
  deleteTemplateFolder,
  flipTemplateEntryShapes,
  insertTemplateDocIntoCurrent,
  moveTemplateEntryToFolder,
  moveTemplateFolderToFolder,
  moveTemplateRepositoryEntry,
  parseTemplateRepositoryImport,
  renameTemplateFolder,
  serializeTemplateRepository,
  sortTemplateRepository,
  type TemplateRepositoryMoveDirection,
  type TemplateRepositoryEntry,
  type TemplateRepositoryFolder,
  type TemplateRepositorySortKey,
} from '../templates/template-repository'
import {
  addCatalogGroup,
  addCatalogItem,
  createCatalogShop,
  deleteCatalogGroup,
  deleteCatalogItem,
  duplicateCatalogGroup,
  duplicateCatalogItem,
  getCatalogItemCount,
  mergeCatalogShopImport,
  moveCatalogItemToGroup,
  moveCatalogGroup,
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
  templateRepositoryFolders: TemplateRepositoryFolder[]
  catalogRepository: CatalogRepositoryShop[]
  selectedTemplateEntry: TemplateRepositoryEntry | null
  selectedTemplateEntryId: string | null
  selectedTemplateFolderId: string | null
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
  setTemplateRepositoryFolders: Dispatch<SetStateAction<TemplateRepositoryFolder[]>>
  setSelectedTemplateFolderId: Dispatch<SetStateAction<string | null>>
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
    templateRepositoryFolders,
    catalogRepository,
    selectedTemplateEntry,
    selectedTemplateEntryId,
    selectedTemplateFolderId,
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
    setTemplateRepositoryFolders,
    setSelectedTemplateFolderId,
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
    const entryInFolder = { ...entry, parentFolderId: selectedTemplateFolderId }
    setTemplateRepository((previous) => [entryInFolder, ...previous])
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

  const handleCreateTemplateFolder = () => {
    const name = window.prompt('Folder name', `Folder ${templateRepositoryFolders.length + 1}`)?.trim()
    if (!name) {
      return
    }
    const folder = createTemplateFolder(name, selectedTemplateFolderId)
    setTemplateRepositoryFolders((previous) => [...previous, folder])
    setSelectedTemplateFolderId(folder.id)
    setStatus(`Created folder "${folder.name}"`)
  }

  const handleRenameTemplateFolder = (folderId: string) => {
    const folder = templateRepositoryFolders.find((entry) => entry.id === folderId)
    if (!folder) {
      setStatus('Select a folder to rename')
      return
    }
    const name = window.prompt('Folder name', folder.name)?.trim()
    if (!name) {
      return
    }
    setTemplateRepositoryFolders((previous) => renameTemplateFolder(previous, folderId, name))
    setStatus(`Renamed folder to "${name}"`)
  }

  const handleDeleteTemplateFolder = (folderId: string) => {
    const folder = templateRepositoryFolders.find((entry) => entry.id === folderId)
    if (!folder) {
      setStatus('Select a folder to delete')
      return
    }
    if (!window.confirm(`Delete folder "${folder.name}"? Templates in it will move to the repository root.`)) {
      return
    }
    const result = deleteTemplateFolder(templateRepositoryFolders, templateRepository, folderId)
    setTemplateRepositoryFolders(result.folders)
    setTemplateRepository(result.entries)
    setSelectedTemplateFolderId((previous) => (previous === folderId ? null : previous))
    setStatus(`Deleted folder "${folder.name}"`)
  }

  const handleMoveTemplateToFolder = (entryId: string, folderId: string | null) => {
    setTemplateRepository((previous) => moveTemplateEntryToFolder(previous, entryId, folderId))
    setStatus(folderId ? 'Template moved to folder' : 'Template moved to repository root')
  }

  const handleMoveTemplateFolderToFolder = (folderId: string, parentFolderId: string | null) => {
    setTemplateRepositoryFolders((previous) => moveTemplateFolderToFolder(previous, folderId, parentFolderId))
    setStatus(parentFolderId ? 'Folder moved' : 'Folder moved to repository root')
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

  const handleCreateCatalogShop = () => {
    const name = window.prompt('Catalog shop name', `Catalog ${catalogRepository.length + 1}`)?.trim()
    if (!name) {
      return
    }
    const shop = createCatalogShop(name)
    setCatalogRepository((previous) => [shop, ...previous])
    setSelectedCatalogShopId(shop.id)
    setStatus(`Created catalog "${shop.name}"`)
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

  const handleCreateCatalogGroup = (shopId: string) => {
    const shop = catalogRepository.find((entry) => entry.id === shopId)
    if (!shop || shop.isBundled) {
      setStatus('Select an editable catalog first')
      return
    }
    const name = window.prompt('Catalog group name', `Group ${shop.groups.length + 1}`)?.trim()
    if (!name) {
      return
    }
    setCatalogRepository((previous) => addCatalogGroup(previous, shopId, name))
    setStatus(`Created catalog group "${name}"`)
  }

  const handleDeleteCatalogGroup = (shopId: string, groupId: string) => {
    const shop = catalogRepository.find((entry) => entry.id === shopId)
    const group = shop?.groups.find((entry) => entry.id === groupId)
    if (!shop || !group || shop.isBundled) {
      setStatus('Select an editable catalog group first')
      return
    }
    if (shop.groups.length <= 1) {
      setStatus('A catalog must keep at least one group')
      return
    }
    if (!window.confirm(`Delete group "${group.name}" and its ${group.items.length} item${group.items.length === 1 ? '' : 's'}?`)) {
      return
    }
    setCatalogRepository((previous) => deleteCatalogGroup(previous, shopId, groupId))
    setStatus(`Deleted catalog group "${group.name}"`)
  }

  const handleDuplicateCatalogGroup = (shopId: string, groupId: string) => {
    setCatalogRepository((previous) => duplicateCatalogGroup(previous, shopId, groupId))
    setStatus('Catalog group duplicated')
  }

  const handleMoveCatalogGroup = (shopId: string, groupId: string, direction: CatalogRepositoryMoveDirection) => {
    setCatalogRepository((previous) => moveCatalogGroup(previous, shopId, groupId, direction))
    setStatus('Catalog group moved')
  }

  const handleCreateCatalogItem = (shopId: string, groupId: string) => {
    const shop = catalogRepository.find((entry) => entry.id === shopId)
    const group = shop?.groups.find((entry) => entry.id === groupId)
    if (!shop || !group || shop.isBundled) {
      setStatus('Select an editable catalog group first')
      return
    }
    const name = window.prompt('Catalog item name', `Item ${group.items.length + 1}`)?.trim()
    if (!name) {
      return
    }
    setCatalogRepository((previous) => addCatalogItem(previous, shopId, groupId, name))
    setStatus(`Created catalog item "${name}"`)
  }

  const handleDuplicateCatalogItem = (shopId: string, groupId: string, itemId: string) => {
    setCatalogRepository((previous) => duplicateCatalogItem(previous, shopId, groupId, itemId))
    setStatus('Catalog item duplicated')
  }

  const handleDeleteCatalogItem = (shopId: string, groupId: string, itemId: string) => {
    const shop = catalogRepository.find((entry) => entry.id === shopId)
    const group = shop?.groups.find((entry) => entry.id === groupId)
    const item = group?.items.find((entry) => entry.id === itemId)
    if (!shop || !group || !item || shop.isBundled) {
      setStatus('Select an editable catalog item first')
      return
    }
    if (!window.confirm(`Delete catalog item "${item.name}"?`)) {
      return
    }
    setCatalogRepository((previous) => deleteCatalogItem(previous, shopId, groupId, itemId))
    setStatus(`Deleted catalog item "${item.name}"`)
  }

  const handleMoveCatalogItemToGroup = (
    shopId: string,
    sourceGroupId: string,
    itemId: string,
    targetGroupId: string,
  ) => {
    setCatalogRepository((previous) => moveCatalogItemToGroup(previous, shopId, sourceGroupId, itemId, targetGroupId))
    setStatus('Catalog item moved')
  }

  // Source v2.0.0 [Distance Marking] — stamp the selected repository template
  // along the currently selected host shape at user-specified pitch, with each
  // instance rotated to the host's tangent at the stamp location.
  const handleStampTemplateAlongSelectedShape = () => {
    if (!selectedTemplateEntry) {
      setStatus('Select a template first')
      return
    }
    if (selectedShapeIdSet.size !== 1) {
      setStatus('Select exactly one host shape to stamp the template along')
      return
    }
    const hostShape = shapes.find((shape) => selectedShapeIdSet.has(shape.id))
    if (!hostShape) {
      setStatus('Could not find the selected host shape')
      return
    }
    if (hostShape.type === 'text') {
      setStatus('Cannot stamp templates along a text shape')
      return
    }
    const totalLength = shapeTotalArcLength(hostShape)
    if (totalLength < 1e-6) {
      setStatus('Selected host shape has zero length')
      return
    }
    const pitchInput = window.prompt(
      `Distance between stamps in mm (host length ${totalLength.toFixed(1)} mm)`,
      '20',
    )?.trim()
    if (!pitchInput) return
    const pitchMm = Number.parseFloat(pitchInput)
    if (!Number.isFinite(pitchMm) || pitchMm <= 0) {
      setStatus('Pitch must be a positive number')
      return
    }
    const distances: number[] = []
    for (let d = pitchMm; d <= totalLength + 1e-6; d += pitchMm) {
      distances.push(d)
    }
    if (distances.length === 0) {
      setStatus('Pitch larger than host shape length — no stamps placed')
      return
    }
    const templateShapes = selectedTemplateEntry.doc.objects ?? []
    if (templateShapes.length === 0) {
      setStatus('Selected template has no shapes to stamp')
      return
    }
    const targetLayerId = hostShape.layerId ?? layers[0]?.id ?? ''
    const targetLineTypeId = hostShape.lineTypeId ?? lineTypes[0]?.id ?? ''
    const stampGroupId = uid()
    const stamped = stampTemplateAlongShape(hostShape, templateShapes, distances, {
      layerId: targetLayerId,
      lineTypeId: targetLineTypeId,
      groupId: stampGroupId,
    })
    if (stamped.length === 0) {
      setStatus('Could not stamp template along the selected shape')
      return
    }
    setShapes((previous) => [...previous, ...stamped])
    setStatus(
      `Stamped "${selectedTemplateEntry.name}" ${distances.length} time${distances.length === 1 ? '' : 's'} along selected shape`,
    )
  }

  return {
    handleSaveTemplateToRepository,
    handleDeleteTemplateFromRepository,
    handleMoveTemplateEntry,
    handleSortTemplates,
    handleCreateTemplateFolder,
    handleRenameTemplateFolder,
    handleDeleteTemplateFolder,
    handleMoveTemplateToFolder,
    handleMoveTemplateFolderToFolder,
    handleFlipTemplate,
    handleLoadTemplateAsDocument,
    handleInsertTemplateIntoDocument,
    handleSeparateTemplateIntoShapes,
    handleStampTemplateAlongSelectedShape,
    handleExportTemplateRepository,
    handleImportTemplateRepositoryFile,
    handleImportCatalogFile,
    handleCreateCatalogShop,
    handleDeleteCatalogShop,
    handleExportCatalogShop,
    handleMoveCatalogShop,
    handleSortCatalogShops,
    handleUpdateCatalogShop,
    handleUpdateCatalogGroup,
    handleUpdateCatalogItem,
    handleCreateCatalogGroup,
    handleDeleteCatalogGroup,
    handleDuplicateCatalogGroup,
    handleMoveCatalogGroup,
    handleCreateCatalogItem,
    handleDuplicateCatalogItem,
    handleDeleteCatalogItem,
    handleMoveCatalogItemToGroup,
  }
}
