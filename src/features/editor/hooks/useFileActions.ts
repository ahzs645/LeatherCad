import { useLayoutEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import { flushSync } from 'react-dom'
import type { DocFile, Layer, Point, Shape, SketchGroup } from '../cad/cad-types'
import { uid } from '../cad/cad-geometry'
import { downloadFile } from '../editor-utils'
import { withEditorLocalDataClient } from '../localdb/editor-local-data-client'
import { safeLocalStorageSet } from '../ops/safe-storage'
import type { MobileViewMode } from '../editor-types'
import { computeBoundsFromShapes } from '../ops/pattern-ops'
import type { SvgImportMode } from '../components/SvgImportOptionsModal'
import type { DocumentTransferReview } from '../components/DocumentTransferReviewModal'
import { MAX_IMPORT_FILE_BYTES } from '../io/import-budget'
import type { PatternPdfReview } from '../ops/pattern-pdf/pattern-pdf-review'
import { parseDocumentFile } from '../io/parse-file-import'
import { readDrawingFileText } from '../io/read-drawing-file'
import { isNativeCurve, transformNativeCurve } from '../cad/native-curve-ops'

const OPEN_DOC_TRANSFER_PREFIX = 'leathercraft-open-doc-'
type ImportSessionKey = number | readonly Shape[]

type PendingSvgImport = {
  fileName: string
  shapes: Shape[]
  warnings: string[]
  layerId: string
  widthMm: number
  heightMm: number
  minX: number
  minY: number
  sessionKey: ImportSessionKey
  isCurrent: () => boolean
}

function mapShapePoints(shape: Shape, mapPoint: (point: Point) => Point, scale = 1): Shape {
  if (isNativeCurve(shape)) {
    const origin = mapPoint({ x: 0, y: 0 }), x = mapPoint({ x: 1, y: 0 }), y = mapPoint({ x: 0, y: 1 })
    return transformNativeCurve(shape, [x.x - origin.x, x.y - origin.y, y.x - origin.x, y.y - origin.y, origin.x, origin.y])
  }
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
  /** Nonpersisted epoch advanced only by document load/new/reset. */
  documentSessionKey?: number
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
  const [pendingTransfer, setPendingTransfer] = useState<{ review: DocumentTransferReview; sessionKey: ImportSessionKey } | null>(null)
  const [pendingPatternPdfReview, setPendingPatternPdfReview] = useState<{ review: PatternPdfReview; sessionKey: ImportSessionKey; isCurrent: () => boolean } | null>(null)
  const importSessionKey = params.documentSessionKey ?? buildCurrentDocFile().objects
  const loadIntent = useRef(0)
  const latestDocumentBuilder = useRef(buildCurrentDocFile)
  useLayoutEffect(() => { latestDocumentBuilder.current = buildCurrentDocFile }, [buildCurrentDocFile])
  const lifetime = useRef({ active: false, id: 0, controller: new AbortController() })
  useLayoutEffect(() => {
    const current = lifetime.current
    current.active = true
    return () => { current.active = false; current.id++; current.controller.abort() }
  }, [importSessionKey])
  const beginImport = () => {
    loadIntent.current++
    const current = lifetime.current
    current.controller.abort()
    current.controller = new AbortController()
    const id = ++current.id
    setPendingTransfer(null)
    setPendingPatternPdfReview(null)
    setPendingSvgImport(null)
    return { signal: current.controller.signal, isCurrent: () => current.active && current.id === id }
  }
  const closeTransfer = () => { lifetime.current.id++; lifetime.current.controller.abort(); setPendingTransfer(null) }
  const stageExport = (fileName: string, text: string, warnings: string[], doc: DocFile, format: string) => {
    const requestId = lifetime.current.id
    const download = () => {
      if (!lifetime.current.active || lifetime.current.id !== requestId) return
      downloadFile(fileName, text, 'application/json;charset=utf-8'); setStatus(`${format} exported`); setPendingTransfer(null)
      lifetime.current.id++
    }
    if (!warnings.length) { download(); return }
    setPendingTransfer({ sessionKey: importSessionKey, review: { fileName, title: `Review ${format} export`, actionLabel: `Download ${format}`, summary: [{ label: 'Shapes', value: String(doc.objects.length) }, { label: 'Geometry units', value: 'mm' }], warnings, shapes: doc.objects, onClose: closeTransfer, onApply: download } })
  }

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
    const intent = loadIntent.current
    const saved = await withEditorLocalDataClient((client) =>
      client.documents.create({ name: doc.documentName?.trim() || fallbackName, doc }),
    )
    // A startup/demo save can complete after a newer file read has begun.
    // It must not re-associate that newer drawing with the old database record.
    if (!lifetime.current.active || intent !== loadIntent.current) return
    const current = latestDocumentBuilder.current()
    const sourceIds = new Set(doc.objects.map(shape => shape.id))
    if (current.documentName !== doc.documentName || current.objects.some(shape => !sourceIds.has(shape.id))) return
    setActiveLocalDocumentId(saved?.id ?? null)
  }

  const handleSaveLocalProject = async () => {
    const saved = await saveLocalProject(buildCurrentDocFile())
    setStatus(saved ? `Saved local project "${saved.name}"` : 'Local project storage is unavailable')
  }

  const handleLoadLocalProject = async (documentId: string) => {
    const work = beginImport()
    const document = await withEditorLocalDataClient((client) => client.documents.get(documentId))
    if (!work.isCurrent()) return
    if (!document) {
      setStatus('Local project could not be loaded')
      return
    }
    flushSync(() => applyLoadedDocument(document.doc, `Loaded local project "${document.name}"`))
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
    const work = beginImport()
    const doc = buildCurrentDocFile()
    void import('../io/io-lcc')
      .then(({ exportLccDocument, getLccExportWarnings }) => {
        if (!work.isCurrent()) return
        const lccContent = exportLccDocument(doc)
        stageExport('leathercraft-doc.lcc', lccContent, getLccExportWarnings(doc), doc, 'LCC')
      })
      .catch((error: unknown) => {
        setStatus(`Could not export LCC: ${error instanceof Error ? error.message : 'unknown error'}`)
      })
  }

  const handleSaveLcad = () => {
    const work = beginImport()
    const doc = buildCurrentDocFile()
    void import('../io/io-lcad')
      .then(({ exportLcadDocument }) => {
        if (!work.isCurrent()) return
        const result = exportLcadDocument(doc)
        stageExport('leathercraft-doc.lcad', result.text, result.warnings, doc, 'LCAD')
      })
      .catch((error: unknown) => setStatus(`Could not export LCAD: ${error instanceof Error ? error.message : 'unknown error'}`))
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
    if (!file) return
    const work = beginImport()
    const lowerName = file.name.toLowerCase()
    if (!(lowerName.endsWith('.lcc') || lowerName.endsWith('.lcad') || lowerName.endsWith('.json') || file.type === 'application/json')) {
      setStatus(`"${file.name}" is not a LeatherCad (.lcc, .lcad) or JSON file. Use "Import SVG" or "Import Tracing" for images.`)
      return
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) { setStatus('Could not load drawing: file exceeds the 50 MB import limit'); return }
    setStatus(`Reading "${file.name}"…`)
    try {
      const raw = await readDrawingFileText(file)
      if (!work.isCurrent()) return
      const imported = await parseDocumentFile(raw, file.name, work.signal)
      if (!work.isCurrent()) return
      const documentName = imported.doc.documentName ?? resolveDocumentNameFromFileName(file.name)
      const doc = documentName ? { ...imported.doc, documentName } : imported.doc
      const bounds = computeBoundsFromShapes(doc.objects)
      setPendingTransfer({ sessionKey: importSessionKey, review: {
        fileName: file.name, title: 'Review drawing import', actionLabel: 'Replace current drawing',
        summary: [
          { label: 'Format', value: imported.format },
          ...(imported.integrity ? [{ label: 'Format integrity', value: 'Verified sealed LCC v1' }] : []),
          { label: 'Shapes', value: String(doc.objects.length) },
          { label: 'Stitch holes', value: String(doc.stitchHoles?.length ?? 0) },
          { label: 'Dimensions', value: String(doc.dimensionLines?.length ?? 0) },
          { label: 'Layers', value: doc.layers.slice(0, 20).map(layer => layer.name).join(', ') + (doc.layers.length > 20 ? ` … (${doc.layers.length} total)` : '') },
          { label: 'Geometry units', value: 'mm' },
          { label: 'Drawing size', value: bounds ? `${(bounds.maxX - bounds.minX).toFixed(2)} × ${(bounds.maxY - bounds.minY).toFixed(2)} mm` : 'Empty drawing' },
        ],
        warnings: imported.warnings, shapes: doc.objects, onClose: closeTransfer,
        onApply: () => {
          if (!work.isCurrent()) return
          lifetime.current.id++
          setPendingTransfer(null)
          applyLoadedDocument(doc, `Loaded ${imported.format} (${doc.objects.length} shapes, ${doc.layers.length} layers)${imported.warnings.length ? ` — ${imported.warnings.join('; ')}` : ''}`)
          void createLocalProjectFromLoadedDoc(doc, file.name)
        },
      } })
      setStatus(`Review "${file.name}" before replacing the current drawing`)
    } catch (error) {
      if (!work.isCurrent()) return
      setStatus(`Could not load "${file.name}": ${error instanceof Error ? error.message : 'unknown error'}`)
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

    const work = beginImport()
    if (file.size > MAX_IMPORT_FILE_BYTES) { setStatus('SVG exceeds the 50 MB import limit'); return }
    try {
      const rawSvg = await file.text()
      if (!work.isCurrent()) return
      const { importSvgAsShapes } = await import('../io/io-svg')
      if (!work.isCurrent()) return
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
        sessionKey: importSessionKey, isCurrent: work.isCurrent,
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
      if (work.isCurrent()) setStatus(`SVG import failed: ${message}`)
    }
  }

  const handleApplyPendingSvgImport = (targetWidthMm: number, mode: SvgImportMode) => {
    if (!pendingSvgImport || !pendingSvgImport.isCurrent()) {
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

  /**
   * Open a published pattern sheet as a project.
   *
   * Distinct from tracing import, which rasterises the page into a backdrop to
   * draw over: this reads the vectors, so the pieces, stitch holes, and seams
   * arrive as geometry rather than as a picture of geometry. It replaces the
   * document for the same reason loading an LCC does — a sheet brings its own
   * pieces, layers, and seams, and merging those into an open project would
   * leave two patterns' pieces in one document.
   */
  const handleImportPatternPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    const lowerName = file.name.toLowerCase()
    if (!(lowerName.endsWith('.pdf') || file.type === 'application/pdf')) {
      setStatus(`"${file.name}" is not a PDF. Use "Load JSON / LCC" or "Import SVG" instead.`)
      return
    }

    const work = beginImport()
    if (file.size > MAX_IMPORT_FILE_BYTES) { setStatus('Pattern PDF exceeds the 50 MB import limit'); return }
    setStatus(`Reading "${file.name}"…`)
    try {
      const { preparePatternPdfReview } = await import('../ops/pattern-pdf/pattern-pdf-review')
      if (!work.isCurrent()) return
      const data = await file.arrayBuffer()
      if (!work.isCurrent()) return
      const review = await preparePatternPdfReview(data, file.name, work.signal)
      if (!work.isCurrent()) return
      setPendingPatternPdfReview({ review, sessionKey: importSessionKey, isCurrent: work.isCurrent })
      setStatus(`Review pages and inferred geometry in "${file.name}" before importing`)
    } catch (error) {
      if (!work.isCurrent()) return
      setStatus(`Could not read "${file.name}" as a pattern: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  const handleLoadPreset = async (presetId?: string, shouldApply?: () => boolean) => {
    // Startup demo is lower priority than any explicit file/project intent,
    // including a file change event before the first passive startup effect.
    if (shouldApply && (loadIntent.current > 0 || !shouldApply())) return
    const work = beginImport()
    try {
      const { DEFAULT_PRESET_ID, PRESET_DOCS } = await import('../data/sample-doc')
      if (!work.isCurrent()) return
      if (shouldApply && !shouldApply()) return
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
      // This async continuation runs outside a React event. Commit its document
      // epoch and artwork together before a later file-change event can start.
      flushSync(() => applyLoadedDocument(sample, loadedMessage))
      void createLocalProjectFromLoadedDoc(sample, preset.label)
      // Guarded startup loads only supply artwork. Keep an explicit deep link,
      // current view and open controls while its lazy sample data arrives.
      if (!shouldApply) {
        setShowThreePreview(true)
        if (isMobileLayout) {
          setMobileViewMode('editor')
          setShowMobileMenu(false)
        }
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
    reviewTransfer: (review: DocumentTransferReview) => {
      const work = beginImport()
      setPendingTransfer({ sessionKey: importSessionKey, review: { ...review,
        onClose: () => { closeTransfer(); review.onClose() },
        onApply: layerIds => { if (!work.isCurrent()) return; lifetime.current.id++; setPendingTransfer(null); review.onApply(layerIds) },
      } })
    },
    handleSaveLcc,
    handleSaveLcad,
    handleExportGarmentJson,
    handleLoadJson,
    handleImportSvg,
    handleImportPatternPdf,
    handleLoadPreset,
    handleOpenInNewTab,
    handleSaveLocalProject,
    handleLoadLocalProject,
    handleDeleteLocalProject,
    svgImportOptionsModalProps: pendingPatternPdfReview?.sessionKey === importSessionKey
      ? {
          open: true, fileName: pendingPatternPdfReview.review.fileName, shapeCount: 0, warningCount: 0,
          sourceWidthMm: 0, sourceHeightMm: 0, onClose: () => setPendingPatternPdfReview(null), onApply: () => undefined,
          patternPdfReview: {
            review: pendingPatternPdfReview.review,
            onClose: () => { lifetime.current.id++; setPendingPatternPdfReview(null) },
            onConfirm: (result: import('../ops/pattern-pdf/pattern-pdf-import').PatternPdfImport) => {
              if (!pendingPatternPdfReview.isCurrent()) return
              setPendingPatternPdfReview(null)
              applyLoadedDocument(result.doc, `Imported "${pendingPatternPdfReview.review.fileName}", page ${result.pageNumber} of ${result.pageCount} — ${result.summary}`)
              void createLocalProjectFromLoadedDoc(result.doc, pendingPatternPdfReview.review.fileName)
            },
          },
        }
      : pendingTransfer?.sessionKey === importSessionKey
      ? {
          open: true, fileName: pendingTransfer.review.fileName, shapeCount: 0, warningCount: pendingTransfer.review.warnings.length,
          sourceWidthMm: 0, sourceHeightMm: 0, onClose: closeTransfer, onApply: () => undefined,
          transferReview: pendingTransfer.review,
        }
      : pendingSvgImport?.sessionKey === importSessionKey
      ? {
          open: true,
          fileName: pendingSvgImport.fileName,
          shapeCount: pendingSvgImport.shapes.length,
          warningCount: pendingSvgImport.warnings.length,
          warnings: pendingSvgImport.warnings,
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
