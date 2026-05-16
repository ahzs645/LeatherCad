import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { FoldLine, Shape, StitchHole } from '../cad/cad-types'
import { findConnectedShapeIds } from '../ops/shape-selection-ops'
import { tileSelectionAsStamp } from '../ops/stamp-simulator-ops'

export type CreateEditorTopbarCommandHandlersParams = {
  tracingInputRef: RefObject<HTMLInputElement | null>
  translationInputRef: RefObject<HTMLInputElement | null>
  setShowBackdropModal: Dispatch<SetStateAction<boolean>>
  shapes: Shape[]
  stitchHoles: StitchHole[]
  foldLines: FoldLine[]
  selectedShapeIds: string[]
  selectedShapeIdSet: Set<string>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setStatus: Dispatch<SetStateAction<string>>
  resetDocument: () => void
  setShowFontListModal: Dispatch<SetStateAction<boolean>>
  setShowWizardModal: Dispatch<SetStateAction<boolean>>
  setShowOptionsModal: Dispatch<SetStateAction<boolean>>
  setShowLengthAdjustModal: Dispatch<SetStateAction<boolean>>
  setShowDimensionInspectorModal: Dispatch<SetStateAction<boolean>>
  handleEditSelectedLineAngle: (angleDeg: number) => void
  handleDeleteDuplicates: () => void
  handleSplitIntoN: (count: number) => void
  handleFilletSelectedCorner: (radiusMm: number) => void
  handleDistanceMarkSelectedPath: (distancesMm: number[]) => void
  handleConvertSelectionToPath: (copy: boolean) => void
  handleNotchSelectedShape: (depthMm: number, widthMm: number) => void
}

export function createEditorTopbarCommandHandlers({
  translationInputRef,
  setShowBackdropModal,
  shapes,
  stitchHoles,
  foldLines,
  selectedShapeIds,
  selectedShapeIdSet,
  setShapes,
  setStitchHoles,
  setFoldLines,
  setSelectedShapeIds,
  setSelectedStitchHoleId,
  setStatus,
  resetDocument,
  setShowFontListModal,
  setShowWizardModal,
  setShowOptionsModal,
  setShowLengthAdjustModal,
  setShowDimensionInspectorModal,
  handleEditSelectedLineAngle,
  handleDeleteDuplicates,
  handleSplitIntoN,
  handleFilletSelectedCorner,
  handleDistanceMarkSelectedPath,
  handleConvertSelectionToPath,
  handleNotchSelectedShape,
}: CreateEditorTopbarCommandHandlersParams) {
  return {
    handleEditSelectedLineAnglePrompt: () => {
      const raw = window.prompt('Enter new line angle (degrees, CCW from +X)', '0')
      if (raw === null) {
        setStatus('Edit angle cancelled')
        return
      }
      const angle = Number(raw)
      if (!Number.isFinite(angle)) {
        setStatus('Invalid angle')
        return
      }
      handleEditSelectedLineAngle(angle)
    },
    handleDeleteDuplicatesSelection: () => handleDeleteDuplicates(),
    handleSplitIntoNPrompt: () => {
      const raw = window.prompt('Split into how many equal segments?', '2')
      if (raw === null) {
        setStatus('Split cancelled')
        return
      }
      const count = Number(raw)
      if (!Number.isInteger(count) || count < 2) {
        setStatus('Segment count must be an integer ≥ 2')
        return
      }
      handleSplitIntoN(count)
    },
    handleAddBackdrop: () => {
      setShowBackdropModal(true)
    },
    handleOpenFontListModal: () => setShowFontListModal(true),
    handleCloseProject: () => {
      const confirmed = window.confirm(
        'Close the current project? Unsaved changes will be lost unless you save first.',
      )
      if (confirmed) {
        resetDocument()
      }
    },
    handleOpenSecretFeatures: () => setShowWizardModal(true),
    handleImportTranslation: () => translationInputRef.current?.click(),
    handleClearAll: () => {
      if (shapes.length === 0 && stitchHoles.length === 0 && foldLines.length === 0) {
        setStatus('Canvas already empty')
        return
      }
      const confirmed = window.confirm(
        'Clear all shapes, stitch holes, and fold lines? Layers and line types stay put.',
      )
      if (!confirmed) return
      setShapes([])
      setStitchHoles([])
      setFoldLines([])
      setSelectedShapeIds([])
      setSelectedStitchHoleId(null)
      setStatus('Canvas cleared')
    },
    handleSelectConnectedChain: () => {
      if (selectedShapeIds.length !== 1) {
        setStatus('Select one shape first to expand to its connected chain')
        return
      }
      const chain = findConnectedShapeIds(shapes, selectedShapeIds[0])
      setSelectedShapeIds(chain)
      setStatus(`Selected connected chain: ${chain.length} shape${chain.length === 1 ? '' : 's'}`)
    },
    handleStampSimulator: () => {
      if (selectedShapeIdSet.size === 0) {
        setStatus('Select one or more shapes to stamp')
        return
      }
      const rowsRaw = window.prompt('Stamp rows?', '3')
      if (rowsRaw === null) {
        setStatus('Stamp cancelled')
        return
      }
      const colsRaw = window.prompt('Stamp columns?', '3')
      if (colsRaw === null) {
        setStatus('Stamp cancelled')
        return
      }
      const pitchXRaw = window.prompt('X pitch (mm)?', '20')
      if (pitchXRaw === null) {
        setStatus('Stamp cancelled')
        return
      }
      const pitchYRaw = window.prompt('Y pitch (mm)?', '20')
      if (pitchYRaw === null) {
        setStatus('Stamp cancelled')
        return
      }
      const rows = Number(rowsRaw)
      const cols = Number(colsRaw)
      const pitchXMm = Number(pitchXRaw)
      const pitchYMm = Number(pitchYRaw)
      if (
        !Number.isInteger(rows) || rows < 1 ||
        !Number.isInteger(cols) || cols < 1 ||
        !Number.isFinite(pitchXMm) || !Number.isFinite(pitchYMm)
      ) {
        setStatus('Invalid stamp parameters')
        return
      }
      const stamps = tileSelectionAsStamp(shapes, selectedShapeIdSet, {
        rows,
        cols,
        pitchXMm,
        pitchYMm,
      })
      if (stamps.length === 0) {
        setStatus('No stamps produced')
        return
      }
      setShapes((prev) => [...prev, ...stamps])
      setStatus(`Stamped ${stamps.length} shape${stamps.length === 1 ? '' : 's'} in ${rows}×${cols} grid`)
    },
    handleOpenOptionsModal: () => setShowOptionsModal(true),
    handleOpenLengthAdjustModal: () => setShowLengthAdjustModal(true),
    handleOpenDimensionInspectorModal: () => setShowDimensionInspectorModal(true),
    handleFilletSelectedCornerPrompt: () => {
      const raw = window.prompt('Fillet (chamfer) radius in mm?', '2')
      if (raw === null) {
        setStatus('Fillet cancelled')
        return
      }
      const radius = Number(raw)
      if (!Number.isFinite(radius) || radius <= 0) {
        setStatus('Fillet radius must be positive')
        return
      }
      handleFilletSelectedCorner(radius)
    },
    handleDistanceMarkSelectedPathPrompt: () => {
      const raw = window.prompt(
        'Distance(s) in mm from the start of the selected path (comma-separated):',
        '10, 30',
      )
      if (raw === null) {
        setStatus('Distance marking cancelled')
        return
      }
      const parsed = raw
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isFinite(entry) && entry >= 0)
      if (parsed.length === 0) {
        setStatus('No valid distances provided')
        return
      }
      handleDistanceMarkSelectedPath(parsed)
    },
    handleConvertSelectionToPath: () => handleConvertSelectionToPath(false),
    handleConvertACopyToPath: () => handleConvertSelectionToPath(true),
    handleNotchSelectedShapePrompt: () => {
      const depthRaw = window.prompt('Notch depth (mm)?', '3')
      if (depthRaw === null) {
        setStatus('Notch cancelled')
        return
      }
      const widthRaw = window.prompt('Notch width (mm)?', '2')
      if (widthRaw === null) {
        setStatus('Notch cancelled')
        return
      }
      const depth = Number(depthRaw)
      const width = Number(widthRaw)
      if (!Number.isFinite(depth) || depth <= 0 || !Number.isFinite(width) || width <= 0) {
        setStatus('Notch depth and width must be positive')
        return
      }
      handleNotchSelectedShape(depth, width)
    },
    handleAutoPlaceEvenlySpacedStitchHolesPrompt: (handleAutoPlaceEvenlySpacedStitchHoles: (count: number) => void) => {
      const raw = window.prompt('How many holes to place evenly on the selected path?', '10')
      if (raw === null) {
        setStatus('Even placement cancelled')
        return
      }
      const count = Number(raw)
      if (!Number.isInteger(count) || count < 2) {
        setStatus('Hole count must be an integer ≥ 2')
        return
      }
      handleAutoPlaceEvenlySpacedStitchHoles(count)
    },
  }
}
