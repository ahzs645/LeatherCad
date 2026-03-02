import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import type { DocFile, Layer, Shape, SketchGroup } from '../cad/cad-types'
import { importSvgAsShapes } from '../io/io-svg'
import { DEFAULT_PRESET_ID, PRESET_DOCS } from '../data/sample-doc'
import { parseImportedJsonDocument } from '../editor-json-import'
import { downloadFile } from '../editor-utils'
import type { MobileViewMode } from '../editor-types'

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

  const handleLoadJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const imported = parseImportedJsonDocument(raw)
      applyLoadedDocument(
        imported.doc,
        `Loaded JSON (${imported.summary.shapeCount} shapes, ${imported.summary.foldCount} folds, ${imported.summary.stitchHoleCount} holes, ${imported.summary.layerCount} layers, ${imported.summary.hardwareMarkerCount} hardware markers)`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setStatus(`Load failed: ${message}`)
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

  const handleLoadPreset = (presetId = selectedPresetId || DEFAULT_PRESET_ID) => {
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
  }

  return {
    handleSaveJson,
    handleLoadJson,
    handleImportSvg,
    handleLoadPreset,
  }
}
