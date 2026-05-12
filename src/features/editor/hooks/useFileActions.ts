import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import type { DocFile, Layer, Point, Shape, SketchGroup } from '../cad/cad-types'
import { uid } from '../cad/cad-geometry'
import { downloadFile } from '../editor-utils'
import { withEditorLocalDataClient } from '../localdb/editor-local-data-client'
import { safeLocalStorageSet } from '../ops/safe-storage'
import type { MobileViewMode } from '../editor-types'
import { computeBoundsFromShapes } from '../ops/pattern-ops'
import type { SvgImportMode } from '../components/SvgImportOptionsModal'

const OPEN_DOC_TRANSFER_PREFIX = 'leathercraft-open-doc-'

type PendingSvgImport = {
  fileName: string
  shapes: Shape[]
  warnings: string[]
  layerId: string
  widthMm: number
  heightMm: number
  minX: number
  minY: number
}

function mapShapePoints(shape: Shape, mapPoint: (point: Point) => Point, scale = 1): Shape {
  if (shape.type === 'line') {
    return { ...shape, start: mapPoint(shape.start), end: mapPoint(shape.end) }
  }
  if (shape.type === 'arc') {
    return { ...shape, start: mapPoint(shape.start), mid: mapPoint(shape.mid), end: mapPoint(shape.end) }
  }
  if (shape.type === 'bezier') {
    return { ...shape, start: mapPoint(shape.start), control: mapPoint(shape.control), end: mapPoint(shape.end) }
  }
  return {
    ...shape,
    start: mapPoint(shape.start),
    end: mapPoint(shape.end),
    fontSizeMm: Math.max(0.1, shape.fontSizeMm * scale),
    radiusMm: Math.max(0.1, shape.radiusMm * scale),
  }
}

export function resolveDocumentNameFromFileName(fileName: string): string | null {
  const trimmed = fileName.trim()
  if (trimmed.length === 0) {
    return null
  }

  const withoutExtension = trimmed.replace(/\.[^.]+$/, '').trim()
  return withoutExtension.length > 0 ? withoutExtension : trimmed
}

type UseFileActionsParams = {
  buildCurrentDocFile: () => DocFile
  applyLoadedDocument: (doc: DocFile, statusMessage: string) => void
  activeLocalDocumentId: string | null
  setActiveLocalDocumentId: Dispatch<SetStateAction<string | null>>
  selectedPresetId: string
  setSelectedPresetId: Dispatch<SetStateAction<string>>
  isMobileLayout: boolean
  activeLayer: Layer | null
  activeLineTypeId: string
  activeSketchGroup: SketchGroup | null
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setActiveSketchGroupId: Dispatch<SetStateAction<string | null>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setStatus: Dispatch<SetStateAction<string>>
  setShowThreePreview: Dispatch<SetStateAction<boolean>>
  setMobileViewMode: Dispatch<SetStateAction<MobileViewMode>>
  setShowMobileMenu: Dispatch<SetStateAction<boolean>>
}

export function useFileActions(params: UseFileActionsParams) {
  const {
    buildCurrentDocFile,
    applyLoadedDocument,
    activeLocalDocumentId,
    setActiveLocalDocumentId,
    selectedPresetId,
    setSelectedPresetId,
    isMobileLayout,
    activeLayer,
    activeLineTypeId,
    activeSketchGroup,
    setShapes,
    setSketchGroups,
    setActiveSketchGroupId,
    setSelectedShapeIds,
    setStatus,
    setShowThreePreview,
    setMobileViewMode,
    setShowMobileMenu,
  } = params
  const [pendingSvgImport, setPendingSvgImport] = useState<PendingSvgImport | null>(null)

  const saveLocalProject = async (doc: DocFile, fallbackName = 'Untitled project') => {
    const name = doc.documentName?.trim() || fallbackName
    const saved = await withEditorLocalDataClient((client) =>
      activeLocalDocumentId
        ? client.documents.save({ id: activeLocalDocumentId, name, doc })
        : client.documents.create({ name, doc }),
    )
    if (saved) {
      setActiveLocalDocumentId(saved.id)
    }
    return saved
  }

  const createLocalProjectFromLoadedDoc = async (doc: DocFile, fallbackName: string) => {
    const saved = await withEditorLocalDataClient((client) =>
      client.documents.create({ name: doc.documentName?.trim() || fallbackName, doc }),
    )
    setActiveLocalDocumentId(saved?.id ?? null)
  }

  const handleSaveLocalProject = async () => {
    const saved = await saveLocalProject(buildCurrentDocFile())
    setStatus(saved ? `Saved local project "${saved.name}"` : 'Local project storage is unavailable')
  }

  const handleLoadLocalProject = async (documentId: string) => {
    const document = await withEditorLocalDataClient((client) => client.documents.get(documentId))
    if (!document) {
      setStatus('Local project could not be loaded')
      return
    }
    applyLoadedDocument(document.doc, `Loaded local project "${document.name}"`)
    setActiveLocalDocumentId(document.id)
  }

  const handleDeleteLocalProject = async (documentId: string) => {
    await withEditorLocalDataClient((client) => client.documents.delete(documentId))
    if (activeLocalDocumentId === documentId) {
      setActiveLocalDocumentId(null)
    }
    setStatus('Local project deleted')
  }

  const handleSaveJson = () => {
    const doc = buildCurrentDocFile()
    void saveLocalProject(doc).then((saved) => {
      if (saved) {
        setStatus(`Saved local project "${saved.name}"`)
      }
    })
    downloadFile('leathercraft-doc.json', JSON.stringify(doc, null, 2), 'application/json;charset=utf-8')
    setStatus('Document JSON saved')
  }

  const handleSaveLcc = () => {
    const doc = buildCurrentDocFile()
    void import('../io/io-lcc')
      .then(({ exportLccDocument }) => {
        const lccContent = exportLccDocument(doc)
        downloadFile('leathercraft-doc.lcc', lccContent, 'application/json;charset=utf-8')
        setStatus('Document saved as LCC')
      })
      .catch(() => {
        setStatus('LCC export tools failed to load')
      })
  }

  const handleExportGarmentJson = () => {
    const doc = buildCurrentDocFile()
    void import('../io/io-garment')
      .then(({ exportGarmentInterchangeDocument }) => {
        const garment = exportGarmentInterchangeDocument(doc)
        downloadFile('leathercraft-garment.json', JSON.stringify(garment, null, 2), 'application/json;charset=utf-8')
        setStatus('Garment interchange JSON exported')
      })
      .catch(() => {
        setStatus('Garment export tools failed to load')
      })
  }

  const handleLoadJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    const lowerName = file.name.toLowerCase()
    const looksLikeLccOrJson =
      lowerName.endsWith('.lcc') || lowerName.endsWith('.json') || file.type === 'application/json'
    if (!looksLikeLccOrJson) {
      setStatus(
        `"${file.name}" is not a LeatherCad (.lcc) or JSON file. Use "Import SVG" or "Import Tracing" for images.`,
      )
      return
    }

    try {
      const raw = await file.text()
      const trimmed = raw.trim()
      if (trimmed.length === 0) {
        setStatus(`"${file.name}" is empty — nothing to load`)
        return
      }
      const isLcc = lowerName.endsWith('.lcc')

      if (isLcc) {
        const { importLccDocument } = await import('../io/io-lcc')
        const result = importLccDocument(raw)
        const documentName = result.doc.documentName ?? resolveDocumentNameFromFileName(file.name)
        const warningNote = result.warnings.length > 0 ? ` (${result.warnings.length} warning(s))` : ''
        applyLoadedDocument(
          documentName ? { ...result.doc, documentName } : result.doc,
          `Loaded LCC (${result.summary.shapeCount} shapes, ${result.summary.foldCount} folds, ${result.summary.stitchHoleCount} holes, ${result.summary.layerCount} layers)${warningNote}`,
        )
        void createLocalProjectFromLoadedDoc(documentName ? { ...result.doc, documentName } : result.doc, file.name)
        return
      }

      if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
        setStatus(`"${file.name}" does not look like valid JSON — skipped`)
        return
      }

      const { parseImportedJsonDocument } = await import('../editor-json-import')
      const imported = parseImportedJsonDocument(raw)
      const documentName = imported.doc.documentName ?? resolveDocumentNameFromFileName(file.name)
      applyLoadedDocument(
        documentName ? { ...imported.doc, documentName } : imported.doc,
        `Loaded JSON (${imported.summary.shapeCount} shapes, ${imported.summary.foldCount} folds, ${imported.summary.stitchHoleCount} holes, ${imported.summary.layerCount} layers, ${imported.summary.hardwareMarkerCount} hardware markers)`,
      )
      void createLocalProjectFromLoadedDoc(documentName ? { ...imported.doc, documentName } : imported.doc, file.name)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Could not load "${file.name}": ${message}`)
    }
  }

  const handleImportSvg = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    if (!activeLayer) {
      setStatus('No active layer to import into')
      return
    }

    try {
      const rawSvg = await file.text()
      const { importSvgAsShapes } = await import('../io/io-svg')
      const imported = importSvgAsShapes(rawSvg, {
        layerId: activeLayer.id,
        lineTypeId: activeLineTypeId,
      })
      if (imported.shapes.length === 0) {
        setStatus('SVG import produced no drawable shapes')
        return
      }
      const bounds = computeBoundsFromShapes(imported.shapes)
      if (!bounds) {
        setStatus('SVG import produced no measurable geometry')
        return
      }
      setPendingSvgImport({
        fileName: file.name,
        shapes: imported.shapes,
        warnings: imported.warnings,
        layerId: activeLayer.id,
        widthMm: Math.max(0.01, bounds.maxX - bounds.minX),
        heightMm: Math.max(0.01, bounds.maxY - bounds.minY),
        minX: bounds.minX,
        minY: bounds.minY,
      })
      setStatus(`Review SVG import options for "${file.name}"`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`SVG import failed: ${message}`)
    }
  }

  const handleApplyPendingSvgImport = (targetWidthMm: number, mode: SvgImportMode) => {
    if (!pendingSvgImport) {
      setStatus('No SVG import is pending')
      return
    }
    if (!Number.isFinite(targetWidthMm) || targetWidthMm <= 0) {
      setStatus('SVG import width must be positive')
      return
    }

    const scale = targetWidthMm / pendingSvgImport.widthMm
    const mapPoint = (point: Point): Point => ({
      x: pendingSvgImport.minX + (point.x - pendingSvgImport.minX) * scale,
      y: pendingSvgImport.minY + (point.y - pendingSvgImport.minY) * scale,
    })
    let importGroupId: string | undefined
    let createdGroup: SketchGroup | null = null
    if (mode === 'grouped') {
      importGroupId = activeSketchGroup?.id
      if (!importGroupId) {
        const groupName = resolveDocumentNameFromFileName(pendingSvgImport.fileName) ?? 'SVG Import'
        importGroupId = uid()
        createdGroup = {
          id: importGroupId,
          name: groupName,
          layerId: pendingSvgImport.layerId,
          visible: true,
          locked: false,
        }
      }
    }

    const importedShapes = pendingSvgImport.shapes.map((shape) => ({
      ...mapShapePoints(shape, mapPoint, scale),
      groupId: importGroupId,
    }))

    if (createdGroup) {
      setSketchGroups((previous) => [...previous, createdGroup])
      setActiveSketchGroupId(createdGroup.id)
    }
    setShapes((previous) => [...previous, ...importedShapes])
    setSelectedShapeIds(importedShapes.map((shape) => shape.id))
    setPendingSvgImport(null)
    if (isMobileLayout) {
      setShowThreePreview(false)
      setMobileViewMode('editor')
      setShowMobileMenu(false)
    }
    if (pendingSvgImport.warnings.length > 0) {
      setStatus(`Imported SVG (${importedShapes.length} shapes) with ${pendingSvgImport.warnings.length} warning(s)`)
    } else {
      setStatus(`Imported SVG (${importedShapes.length} shapes)`)
    }
  }

  const handleLoadPreset = async (presetId?: string) => {
    try {
      const { DEFAULT_PRESET_ID, PRESET_DOCS } = await import('../data/sample-doc')
      const requestedPresetId = presetId || selectedPresetId || DEFAULT_PRESET_ID
      const preset =
        PRESET_DOCS.find((entry) => entry.id === requestedPresetId) ??
        PRESET_DOCS.find((entry) => entry.id === selectedPresetId) ??
        PRESET_DOCS.find((entry) => entry.id === DEFAULT_PRESET_ID) ??
        PRESET_DOCS[0]
      if (!preset) {
        setStatus('No presets available')
        return
      }

      if (preset.id !== selectedPresetId) {
        setSelectedPresetId(preset.id)
      }

      const sample =
        typeof structuredClone === 'function'
          ? structuredClone(preset.doc)
          : (JSON.parse(JSON.stringify(preset.doc)) as DocFile)
      sample.documentName = sample.documentName?.trim() || preset.label

      const loadedMessage =
        preset.id === requestedPresetId
          ? `Loaded preset: ${preset.label} (${sample.objects.length} shapes, ${sample.foldLines.length} folds)`
          : `Requested preset was unavailable. Loaded preset: ${preset.label} (${sample.objects.length} shapes, ${sample.foldLines.length} folds)`
      applyLoadedDocument(sample, loadedMessage)
      void createLocalProjectFromLoadedDoc(sample, preset.label)
      setShowThreePreview(true)
      if (isMobileLayout) {
        setMobileViewMode('editor')
        setShowMobileMenu(false)
      }
    } catch {
      setStatus('Preset library failed to load')
    }
  }

  const handleOpenInNewTab = () => {
    if (typeof window === 'undefined') {
      return
    }

    const opened = window.open('about:blank', '_blank', 'noopener,noreferrer')
    if (!opened) {
      setStatus('Could not open a new tab (popup may be blocked)')
      return
    }

    const url = new URL(window.location.href)
    const doc = buildCurrentDocFile()
    void saveLocalProject(doc)
      .then((saved) => {
        if (saved) {
          url.searchParams.set('openLocalDoc', saved.id)
        } else {
          const token = uid()
          const storageKey = `${OPEN_DOC_TRANSFER_PREFIX}${token}`
          url.searchParams.set('openDoc', token)
          safeLocalStorageSet(storageKey, JSON.stringify(doc))
        }
        opened.location.href = url.toString()
      })
      .catch(() => {
        const token = uid()
        const storageKey = `${OPEN_DOC_TRANSFER_PREFIX}${token}`
        url.searchParams.set('openDoc', token)
        safeLocalStorageSet(storageKey, JSON.stringify(doc))
        opened.location.href = url.toString()
      })
    setStatus('Opened current project in a new tab')
  }

  return {
    handleSaveJson,
    handleSaveLcc,
    handleExportGarmentJson,
    handleLoadJson,
    handleImportSvg,
    handleLoadPreset,
    handleOpenInNewTab,
    handleSaveLocalProject,
    handleLoadLocalProject,
    handleDeleteLocalProject,
    svgImportOptionsModalProps: pendingSvgImport
      ? {
          open: true,
          fileName: pendingSvgImport.fileName,
          shapeCount: pendingSvgImport.shapes.length,
          warningCount: pendingSvgImport.warnings.length,
          sourceWidthMm: pendingSvgImport.widthMm,
          sourceHeightMm: pendingSvgImport.heightMm,
          onClose: () => setPendingSvgImport(null),
          onApply: handleApplyPendingSvgImport,
        }
      : {
          open: false,
          fileName: '',
          shapeCount: 0,
          warningCount: 0,
          sourceWidthMm: 0,
          sourceHeightMm: 0,
          onClose: () => undefined,
          onApply: () => undefined,
        },
  }
}
