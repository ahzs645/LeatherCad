import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import type { DocFile, Layer, Shape, SketchGroup } from '../cad/cad-types'
import { uid } from '../cad/cad-geometry'
import { downloadFile } from '../editor-utils'
import { safeLocalStorageSet } from '../ops/safe-storage'
import type { MobileViewMode } from '../editor-types'

const OPEN_DOC_TRANSFER_PREFIX = 'leathercraft-open-doc-'

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
  selectedPresetId: string
  setSelectedPresetId: Dispatch<SetStateAction<string>>
  isMobileLayout: boolean
  activeLayer: Layer | null
  activeLineTypeId: string
  activeSketchGroup: SketchGroup | null
  setShapes: Dispatch<SetStateAction<Shape[]>>
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
    selectedPresetId,
    setSelectedPresetId,
    isMobileLayout,
    activeLayer,
    activeLineTypeId,
    activeSketchGroup,
    setShapes,
    setSelectedShapeIds,
    setStatus,
    setShowThreePreview,
    setMobileViewMode,
    setShowMobileMenu,
  } = params

  const handleSaveJson = () => {
    const doc = buildCurrentDocFile()
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
          `Loaded LCC (${result.summary.shapeCount} shapes, ${result.summary.stitchHoleCount} holes, ${result.summary.layerCount} layers)${warningNote}`,
        )
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
      setShapes((previous) => [
        ...previous,
        ...imported.shapes.map((shape) => ({
          ...shape,
          groupId: activeSketchGroup?.id,
        })),
      ])
      setSelectedShapeIds(imported.shapes.map((shape) => shape.id))
      if (imported.warnings.length > 0) {
        setStatus(`Imported SVG (${imported.shapes.length} shapes) with ${imported.warnings.length} warning(s)`)
      } else {
        setStatus(`Imported SVG (${imported.shapes.length} shapes)`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`SVG import failed: ${message}`)
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

    const token = uid()
    const storageKey = `${OPEN_DOC_TRANSFER_PREFIX}${token}`
    const url = new URL(window.location.href)
    url.searchParams.set('openDoc', token)
    safeLocalStorageSet(storageKey, JSON.stringify(buildCurrentDocFile()))
    const opened = window.open(url.toString(), '_blank', 'noopener,noreferrer')
    if (!opened) {
      setStatus('Could not open a new tab (popup may be blocked)')
      return
    }
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
  }
}
