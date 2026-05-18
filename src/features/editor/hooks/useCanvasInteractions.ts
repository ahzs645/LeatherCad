import { useMemo, type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject, type SetStateAction } from 'react'
import type {
  DimensionLine,
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  PatternPiece,
  PieceNotch,
  Point,
  SeamConnection,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  Viewport,
} from '../cad/cad-types'
import { computeMandalaIntersectionCandidates, snapPointToContext } from '../ops/pattern-ops'
import type { ToolRuntime } from '../tools/tool-types'
import { useEditorPanelSelector } from '../state/providers/EditorPanelStateProvider'
import { useEditorToolActions, useEditorToolSelector } from '../state/providers/EditorToolStateProvider'
import { useEditorUIActions } from '../state/providers/EditorUIStateProvider'
import type { PanState } from './canvas-interactions/canvas-interaction-types'
import { useCanvasPanAndZoom } from './canvas-interactions/useCanvasPanAndZoom'
import { useCanvasSelectionInteractions } from './canvas-interactions/useCanvasSelectionInteractions'
import { useCanvasShapeDragInteractions } from './canvas-interactions/useCanvasShapeDragInteractions'
import { useCanvasToolExecution } from './canvas-interactions/useCanvasToolExecution'
import { useCanvasViewportControls } from './canvas-interactions/useCanvasViewportControls'

export type UseCanvasInteractionsParams = {
  svgRef: RefObject<SVGSVGElement | null>
  panRef: RefObject<PanState | null>
  viewport: Viewport
  activeLayerId: string
  activeLineTypeId: string
  activeSketchGroup: SketchGroup | null
  snapSettings: SnapSettings
  foldLines: FoldLine[]
  displayShapes: Shape[]
  snapShapes: Shape[]
  customSnapPoint: Point | null
  reverseZoomDirection?: boolean
  incrementalSelection?: boolean
  lineToolConstraint?: 'none' | 'horizontal' | 'vertical' | 'relative-angle'
  relativeAngleStepDeg?: number
  lastLineAngleRad?: number | null
  reduceOneBlade?: boolean
  tangentCircleMode?: boolean
  tangentCircleDispStep?: number
  dimensionLineTypeId?: string | null
  arcDrawMode?: 'three-point' | 'radius' | 'half-moon'
  arcRadiusMm?: number
  arcHalfMoonRatio?: number
  setLastLineAngleRad?: (value: number | null) => void
  onWheelRotateSelection?: (deltaDeg: number) => void
  onWheelScaleSelection?: (factor: number) => void
  onWheelAdjustThickness?: (deltaSteps: number) => void
  onPickLineTypeFromShape?: (shapeId: string) => void
  onBezierSplitAtPoint?: (shapeId: string, worldPoint: Point) => void
  stitchTargetShapes: Shape[]
  visibleHardwareMarkers: HardwareMarker[]
  lineTypesById: Record<string, LineType>
  shapesById: Record<string, Shape>
  layers: Layer[]
  stitchHoles: StitchHole[]
  patternPieces: PatternPiece[]
  pieceNotches: PieceNotch[]
  seamConnections: SeamConnection[]
  hardwareMarkers: HardwareMarker[]
  selectedShapeIds: string[]
  selectedStitchHoleId: string | null
  selectedHardwareMarkerId: string | null
  setViewport: Dispatch<SetStateAction<Viewport>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setPieceNotches: Dispatch<SetStateAction<PieceNotch[]>>
  setSeamConnections: Dispatch<SetStateAction<SeamConnection[]>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
  setDimensionLines: Dispatch<SetStateAction<DimensionLine[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  ensureActiveLayerWritable: () => boolean
  ensureActiveLineTypeWritable: () => boolean
}

export type { HandlePointKey } from './canvas-interactions/useCanvasShapeDragInteractions'
export type { CanvasInteractionPreview } from './canvas-interactions/canvas-interaction-types'

export function useCanvasInteractions(params: UseCanvasInteractionsParams) {
  const {
    svgRef,
    panRef,
    viewport,
    activeLayerId,
    activeLineTypeId,
    activeSketchGroup,
    snapSettings,
    foldLines,
    displayShapes,
    snapShapes,
    customSnapPoint,
    reverseZoomDirection,
    incrementalSelection,
    lineToolConstraint = 'none',
    relativeAngleStepDeg = 15,
    lastLineAngleRad = null,
    reduceOneBlade = false,
    tangentCircleMode = false,
    tangentCircleDispStep = 12,
    dimensionLineTypeId = null,
    arcDrawMode = 'three-point',
    arcRadiusMm = 20,
    arcHalfMoonRatio = 0.5,
    setLastLineAngleRad,
    onWheelRotateSelection,
    onWheelScaleSelection,
    onWheelAdjustThickness,
    onPickLineTypeFromShape,
    onBezierSplitAtPoint,
    stitchTargetShapes,
    visibleHardwareMarkers,
    lineTypesById,
    shapesById,
    layers,
    stitchHoles,
    patternPieces,
    pieceNotches,
    seamConnections,
    hardwareMarkers,
    selectedShapeIds,
    selectedStitchHoleId,
    selectedHardwareMarkerId,
    setViewport,
    setShapes,
    setStitchHoles,
    setSelectedStitchHoleId,
    setPieceNotches,
    setSeamConnections,
    setHardwareMarkers,
    setSelectedHardwareMarkerId,
    setFoldLines,
    setDimensionLines,
    setSelectedShapeIds,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
  } = params

  const {
    tool,
    draftPoints,
    stitchHoleDefaults,
    textDraftValue,
    textFontFamily,
    textFontSizeMm,
    textTransformMode,
    textRadiusMm,
    textSweepDeg,
  } = useEditorToolSelector((state) => ({
    tool: state.tool,
    draftPoints: state.draftPoints,
    stitchHoleDefaults: state.stitchHoleDefaults,
    textDraftValue: state.textDraftValue,
    textFontFamily: state.textFontFamily,
    textFontSizeMm: state.textFontSizeMm,
    textTransformMode: state.textTransformMode,
    textRadiusMm: state.textRadiusMm,
    textSweepDeg: state.textSweepDeg,
  }))
  const { hardwarePreset, customHardwareDiameterMm, customHardwareSpacingMm, dimensionDefaults } = useEditorPanelSelector(
    (state) => ({
      hardwarePreset: state.hardwarePreset,
      customHardwareDiameterMm: state.customHardwareDiameterMm,
      customHardwareSpacingMm: state.customHardwareSpacingMm,
      dimensionDefaults: state.dimensionDefaults,
    }),
  )
  const { setStatus } = useEditorUIActions()
  const { setDraftPoints, setCursorPoint, setSnapIndicator, clearDraft } = useEditorToolActions()

  const toWorldPoint = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current
    if (!svg) {
      return null
    }

    const rect = svg.getBoundingClientRect()
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
    }
  }

  const mandalaIntersections = useMemo(
    () => computeMandalaIntersectionCandidates(snapShapes),
    [snapShapes],
  )

  const getSnappedPoint = (point: Point) =>
    snapPointToContext(point, snapSettings, {
      shapes: snapShapes,
      foldLines,
      hardwareMarkers: visibleHardwareMarkers,
      viewportScale: viewport.scale,
      customSnapPoints: customSnapPoint ? [customSnapPoint] : undefined,
      mandalaIntersections: mandalaIntersections.length > 0 ? mandalaIntersections : undefined,
      draftAnchor: draftPoints.length > 0 ? draftPoints[0] : undefined,
      tangentCircleMode,
      tangentCircleDispStep,
    })

  const { handleZoomStep, handleResetView, handleFitView } = useCanvasViewportControls({
    svgRef,
    displayShapes,
    setViewport,
    setStatus,
  })

  const { beginPan, handlePanPointerMove, handlePanPointerUp } = useCanvasPanAndZoom({
    svgRef,
    panRef,
    viewport,
    setViewport,
    reverseZoomDirection,
    onWheelRotateSelection,
    onWheelScaleSelection,
    onWheelAdjustThickness,
  })

  const { handleStitchHolePointerDown, handleHardwarePointerDown } = useCanvasSelectionInteractions({
    tool,
    stitchHoles,
    hardwareMarkers,
    selectedStitchHoleId,
    selectedHardwareMarkerId,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setStatus,
  })

  const {
    interactionPreview,
    handleShapePointerDown,
    handleShapeHandlePointerDown,
    handleDragPointerMove,
    handleDragPointerUp,
  } = useCanvasShapeDragInteractions({
    tool,
    selectedShapeIds,
    shapesById,
    setShapes,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setCursorPoint,
    setStatus,
    toWorldPoint,
    getSnappedPoint,
    incrementalSelection,
    onPickLineTypeFromShape,
    onBezierSplitAtPoint,
  })

  let toolSessionRef: ToolRuntime['toolSession'] | null = null
  const createToolRuntime = (): ToolRuntime => {
    if (!toolSessionRef) {
      throw new Error('Tool session not initialized')
    }
    return {
      draftPoints,
      activeLayerId,
      activeLineTypeId,
      activeSketchGroup,
      viewportScale: viewport.scale,
      lineToolConstraint,
      relativeAngleStepDeg,
      lastLineAngleRad,
      tangentCircleMode,
      dimensionLineTypeId,
      arcDrawMode,
      arcRadiusMm,
      arcHalfMoonRatio,
      setLastLineAngleRad,
      stitchHoleDefaults: reduceOneBlade
        ? { ...stitchHoleDefaults, reduceOneBlade: true }
        : stitchHoleDefaults,
      hardwarePreset,
      customHardwareDiameterMm,
      customHardwareSpacingMm,
      textDraftValue,
      textFontFamily,
      textFontSizeMm,
      textTransformMode,
      textRadiusMm,
      textSweepDeg,
      stitchTargetShapes,
      patternPieces,
      lineTypesById,
      shapesById,
      layers,
      stitchHoles,
      pieceNotches,
      seamConnections,
      dimensionDefaults,
      setDraftPoints,
      clearDraft,
      setStatus,
      setShapes,
      setFoldLines,
      setDimensionLines,
      setStitchHoles,
      setSelectedStitchHoleId,
      setPieceNotches,
      setSeamConnections,
      setHardwareMarkers,
      setSelectedHardwareMarkerId,
      ensureActiveLayerWritable,
      ensureActiveLineTypeWritable,
      toolSession: toolSessionRef,
    }
  }

  const { toolSession, handleToolPointerDown, runPrecisionCommand, getToolHint: resolveToolHint } = useCanvasToolExecution({
    tool,
    createToolRuntime,
    setStatus,
  })
  toolSessionRef = toolSession

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0 && !(event.button === 1 || event.button === 2)) {
      return
    }

    if (event.pointerType === 'touch' && panRef.current && panRef.current.pointerId !== event.pointerId) {
      return
    }

    if (tool === 'pan' || event.button === 1 || event.button === 2) {
      event.preventDefault()
      beginPan(event.clientX, event.clientY, event.pointerId)
      if (event.pointerType !== 'touch') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Touch browsers can throw here; pan still works without capture.
        }
      }
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const rawPoint = toWorldPoint(event.clientX, event.clientY)
    if (!rawPoint) {
      return
    }
    const snap = getSnappedPoint(rawPoint)
    setCursorPoint(snap.point)
    setSnapIndicator(snap.reason ? { point: snap.point, reason: snap.reason } : null)
    handleToolPointerDown(snap.point)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (handlePanPointerMove(event.clientX, event.clientY, event.pointerId, event.pointerType)) {
      return
    }
    if (handleDragPointerMove(event)) {
      return
    }

    if (draftPoints.length === 0 && tool !== 'hardware') {
      return
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (point) {
      const snap = getSnappedPoint(point)
      setCursorPoint(snap.point)
      setSnapIndicator(snap.reason ? { point: snap.point, reason: snap.reason } : null)
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    handlePanPointerUp(event.pointerId, event.pointerType)
    handleDragPointerUp(event)

    if (event.pointerType !== 'touch') {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      } catch {
        // Safe no-op for browsers that fail pointer capture checks.
      }
    }
  }

  const toolHint = resolveToolHint(draftPoints)

  return {
    handleZoomStep,
    handleResetView,
    handleFitView,
    handlePointerDown,
    handleShapePointerDown,
    handleShapeHandlePointerDown,
    handleStitchHolePointerDown,
    handleHardwarePointerDown,
    handlePointerMove,
    handlePointerUp,
    interactionPreview,
    runPrecisionCommand,
    toolHint,
  }
}
