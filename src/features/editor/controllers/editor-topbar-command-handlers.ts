import type { Dispatch, RefObject, SetStateAction } from 'react'
import type {
  AssemblyConnection,
  Backdrop,
  DimensionLine,
  FoldLine,
  HardwareMarker,
  ParametricConstraint,
  PatternPiece,
  PieceGrainline,
  PieceInterface,
  PieceLabel,
  PieceNotch,
  PiecePlacement3D,
  PiecePlacementLabel,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
  SketchGroup,
  StitchHole,
  TracingOverlay,
} from '../cad/cad-types'
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
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setDimensionLines: Dispatch<SetStateAction<DimensionLine[]>>
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setActiveSketchGroupId: Dispatch<SetStateAction<string | null>>
  setPatternPieces: Dispatch<SetStateAction<PatternPiece[]>>
  setPieceInterfaces: Dispatch<SetStateAction<PieceInterface[]>>
  setAssemblyConnections: Dispatch<SetStateAction<AssemblyConnection[]>>
  setPieceGrainlines: Dispatch<SetStateAction<PieceGrainline[]>>
  setPieceLabels: Dispatch<SetStateAction<PieceLabel[]>>
  setPiecePlacementLabels: Dispatch<SetStateAction<PiecePlacementLabel[]>>
  setPiecePlacements3d: Dispatch<SetStateAction<PiecePlacement3D[]>>
  setSeamConnections: Dispatch<SetStateAction<SeamConnection[]>>
  setSeamAllowances: Dispatch<SetStateAction<PieceSeamAllowance[]>>
  setPieceNotches: Dispatch<SetStateAction<PieceNotch[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setBackdrops: Dispatch<SetStateAction<Backdrop[]>>
  setActiveBackdropId: Dispatch<SetStateAction<string | null>>
  setTracingOverlays: Dispatch<SetStateAction<TracingOverlay[]>>
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
  continuousDistanceMarking?: boolean
  notchAngleDeg?: number
  notchDepthMm?: number
  markingDistanceMm?: number
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
  setSelectedHardwareMarkerId,
  setHardwareMarkers,
  setDimensionLines,
  setSketchGroups,
  setActiveSketchGroupId,
  setPatternPieces,
  setPieceInterfaces,
  setAssemblyConnections,
  setPieceGrainlines,
  setPieceLabels,
  setPiecePlacementLabels,
  setPiecePlacements3d,
  setSeamConnections,
  setSeamAllowances,
  setPieceNotches,
  setConstraints,
  setBackdrops,
  setActiveBackdropId,
  setTracingOverlays,
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
  continuousDistanceMarking = false,
  notchAngleDeg = 60,
  notchDepthMm = 3,
  markingDistanceMm = 10,
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
        'Clear all canvas content (shapes, stitch holes, fold lines, dimensions, hardware, backdrops, tracing)? Layers, line types, and options stay put.',
      )
      if (!confirmed) return
      setShapes([])
      setStitchHoles([])
      setFoldLines([])
      setHardwareMarkers([])
      setDimensionLines([])
      setSketchGroups([])
      setActiveSketchGroupId(null)
      setPatternPieces([])
      setPieceInterfaces([])
      setAssemblyConnections([])
      setPieceGrainlines([])
      setPieceLabels([])
      setPiecePlacementLabels([])
      setPiecePlacements3d([])
      setSeamConnections([])
      setSeamAllowances([])
      setPieceNotches([])
      setConstraints([])
      setBackdrops([])
      setActiveBackdropId(null)
      setTracingOverlays([])
      setSelectedShapeIds([])
      setSelectedStitchHoleId(null)
      setSelectedHardwareMarkerId(null)
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
      if (continuousDistanceMarking) {
        // Source v? continuous-mode workflow — re-prompt after each placement
        // until the user cancels. Keeps the selected path active throughout.
        const placeOne = () => {
          const raw = window.prompt(
            'Distance in mm from the start of the selected path (blank to stop):',
            markingDistanceMm.toFixed(2),
          )
          if (raw === null || raw.trim() === '') {
            setStatus('Continuous distance marking ended')
            return
          }
          const value = Number(raw.trim())
          if (!Number.isFinite(value) || value < 0) {
            setStatus('Invalid distance — continuous marking ended')
            return
          }
          handleDistanceMarkSelectedPath([value])
          placeOne()
        }
        placeOne()
        return
      }
      const raw = window.prompt(
        'Distance(s) in mm from the start of the selected path (comma-separated):',
        `${markingDistanceMm.toFixed(2)}, ${(markingDistanceMm * 3).toFixed(2)}`,
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
      // Defaults come from Options → Notch (Kama) defaults so the user can
      // configure depth + angle once and accept on each invocation.
      const defaultWidth = 2 * notchDepthMm * Math.tan((notchAngleDeg * Math.PI) / 360)
      const depthRaw = window.prompt('Notch depth (mm)?', notchDepthMm.toFixed(2))
      if (depthRaw === null) {
        setStatus('Notch cancelled')
        return
      }
      const widthRaw = window.prompt('Notch width (mm)?', defaultWidth.toFixed(2))
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
