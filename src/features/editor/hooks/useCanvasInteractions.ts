import { useMemo, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject, type SetStateAction } from 'react'
import { sampleShapePoints } from '../cad/cad-geometry'
import type {
  DimensionLine,
  FoldLine,
  HardwareMarker,
  Layer,
  LineShape,
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
import { resolveExtendPreview, resolveTrimPreview } from '../ops/geometry/line-editing'
import { computeMandalaIntersectionCandidates, snapPointToContext } from '../ops/pattern-ops'
import type { ToolRuntime } from '../tools/tool-types'
import { useEditorPanelSelector } from '../state/providers/EditorPanelStateProvider'
import { useEditorToolActions, useEditorToolSelector } from '../state/providers/EditorToolStateProvider'
import { useEditorUIActions } from '../state/providers/EditorUIStateProvider'
import type { CanvasInteractionPreview, PanState } from './canvas-interactions/canvas-interaction-types'
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
    cadCommandMode,
    cursorPoint,
    draftPoints,
    markedSnapPoints,
    stitchHoleDefaults,
    textDraftValue,
    textFontFamily,
    textFontSizeMm,
    textTransformMode,
    textRadiusMm,
    textSweepDeg,
  } = useEditorToolSelector((state) => ({
    tool: state.tool,
    cadCommandMode: state.cadCommandMode,
    cursorPoint: state.cursorPoint,
    draftPoints: state.draftPoints,
    markedSnapPoints: state.markedSnapPoints,
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
  const {
    setActiveTool,
    setAngleGuideLines,
    setCadCommandMode,
    setCommandPreviewShapes,
    setDraftPoints,
    setCursorPoint,
    setMarkedSnapPoints,
    setSnapIndicator,
    clearDraft,
  } = useEditorToolActions()
  const selectionBoxRef = useRef<{ pointerId: number; start: Point; current: Point; didMove: boolean; additive: boolean } | null>(null)
  const [selectionBoxPreview, setSelectionBoxPreview] = useState<CanvasInteractionPreview | null>(null)
  const lastSnapRef = useRef<{ key: string; firstSeen: number } | null>(null)

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
      customSnapPoints: [
        ...(customSnapPoint ? [customSnapPoint] : []),
        ...markedSnapPoints.map((entry) => entry.point),
      ],
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
      cursorPoint,
      toolSession: toolSessionRef,
      selectedShapeIds,
      setSelectedShapeIds,
      setActiveTool,
      cadCommandMode,
      setCadCommandMode,
    }
  }

  const { toolSession, handleToolPointerDown, runPrecisionCommand, getToolHint: resolveToolHint } = useCanvasToolExecution({
    tool,
    createToolRuntime,
    setStatus,
  })
  toolSessionRef = toolSession

  const updateSnapGuides = (snap: ReturnType<typeof getSnappedPoint>, now = performance.now()) => {
    if (!snap.reason || snap.reason === 'grid') {
      lastSnapRef.current = null
      return
    }
    const key = `${snap.reason}:${snap.point.x.toFixed(3)}:${snap.point.y.toFixed(3)}`
    const previous = lastSnapRef.current
    if (!previous || previous.key !== key) {
      lastSnapRef.current = { key, firstSeen: now }
      return
    }
    if (now - previous.firstSeen < 320) {
      return
    }

    setMarkedSnapPoints((entries) => {
      if (entries.some((entry) => Math.hypot(entry.point.x - snap.point.x, entry.point.y - snap.point.y) < 0.001)) {
        return entries
      }
      return [{ point: snap.point, reason: snap.reason ?? 'snap', markedAt: now }, ...entries].slice(0, 3)
    })
  }

  const updateAngleGuides = (point: Point | null) => {
    if (!point || (markedSnapPoints.length === 0 && draftPoints.length === 0)) {
      setAngleGuideLines([])
      return
    }
    const anchors = [
      ...draftPoints.slice(-1),
      ...markedSnapPoints.map((entry) => entry.point),
    ].slice(0, 4)
    const stepDeg = Math.max(15, relativeAngleStepDeg || 45)
    const guideLength = Math.max(5000, 2200 / Math.max(0.1, viewport.scale))
    const lines = anchors.flatMap((anchor, anchorIndex) => {
      const angleToCursor = Math.atan2(point.y - anchor.y, point.x - anchor.x)
      const stepRad = (stepDeg * Math.PI) / 180
      const snappedAngle = Math.round(angleToCursor / stepRad) * stepRad
      return [{
        id: `guide-${anchorIndex}-${snappedAngle.toFixed(4)}`,
        start: {
          x: anchor.x - Math.cos(snappedAngle) * guideLength,
          y: anchor.y - Math.sin(snappedAngle) * guideLength,
        },
        end: {
          x: anchor.x + Math.cos(snappedAngle) * guideLength,
          y: anchor.y + Math.sin(snappedAngle) * guideLength,
        },
      }]
    })
    setAngleGuideLines(lines)
  }

  const shapeIntersectsBox = (shape: Shape, minX: number, minY: number, maxX: number, maxY: number, contained: boolean) => {
    const samples = sampleShapePoints(shape, 24)
    if (samples.length === 0) {
      return false
    }
    if (contained) {
      return samples.every((point) => point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY)
    }
    if (samples.some((point) => point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY)) {
      return true
    }
    const shapeMinX = Math.min(...samples.map((point) => point.x))
    const shapeMinY = Math.min(...samples.map((point) => point.y))
    const shapeMaxX = Math.max(...samples.map((point) => point.x))
    const shapeMaxY = Math.max(...samples.map((point) => point.y))
    return shapeMaxX >= minX && shapeMinX <= maxX && shapeMaxY >= minY && shapeMinY <= maxY
  }

  const buildCadCommandPreview = (point: Point): Shape[] => {
    const selectedShapes = selectedShapeIds.map((id) => shapesById[id]).filter((shape): shape is Shape => Boolean(shape))
    const candidateShapes = selectedShapes.length > 0 ? selectedShapes : displayShapes
    if (cadCommandMode === 'trim') {
      const trimPreview = resolveTrimPreview(candidateShapes, point)
      return trimPreview ? [trimPreview.preview] : []
    }
    if (cadCommandMode === 'extend') {
      const selectedLineCandidates = selectedShapes.filter((shape): shape is LineShape => shape.type === 'line')
      const lineCandidates = selectedLineCandidates.length > 0
        ? selectedLineCandidates
        : displayShapes.filter((shape): shape is LineShape => shape.type === 'line')
      const targetCandidates = selectedShapes.length > 0 && (selectedLineCandidates.length === 0 || selectedShapes.length > 1)
        ? selectedShapes
        : displayShapes
      const extendPreview = resolveExtendPreview(lineCandidates, targetCandidates, point)
      return extendPreview ? [extendPreview.preview] : []
    }
    return []
  }

  const updateCadCommandPreview = (point: Point) => {
    if (!cadCommandMode) {
      return
    }
    setCommandPreviewShapes(buildCadCommandPreview(point))
  }

  const commitCadCommandPreview = (point: Point) => {
    if (!cadCommandMode) {
      return false
    }
    const previews = buildCadCommandPreview(point)
    if (previews.length === 0) {
      setStatus(cadCommandMode === 'trim' ? 'Trim: no preview to commit' : 'Extend: no preview to commit')
      return true
    }
    const updatesById = new Map(previews.map((shape) => [shape.id, shape]))
    setShapes((previous) => previous.map((shape) => updatesById.get(shape.id) ?? shape))
    setSelectedShapeIds(previews.map((shape) => shape.id))
    setCommandPreviewShapes([])
    setCadCommandMode(null)
    setStatus(cadCommandMode === 'trim' ? 'Trim committed' : 'Extend committed')
    return true
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0 && !(event.button === 1 || event.button === 2)) {
      return
    }

    if (event.pointerType === 'touch' && panRef.current && panRef.current.pointerId !== event.pointerId) {
      return
    }

    if (tool === 'pan' && event.button === 0) {
      const rawPoint = toWorldPoint(event.clientX, event.clientY)
      if (!rawPoint) {
        return
      }
      const snap = getSnappedPoint(rawPoint)
      if (commitCadCommandPreview(snap.point)) {
        event.preventDefault()
        return
      }
      selectionBoxRef.current = {
        pointerId: event.pointerId,
        start: rawPoint,
        current: rawPoint,
        didMove: false,
        additive: event.shiftKey || incrementalSelection === true,
      }
      setSelectionBoxPreview({
        kind: 'selection-box',
        start: rawPoint,
        end: rawPoint,
        mode: 'contained',
      })
      event.preventDefault()
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Safe no-op for browsers that fail pointer capture checks.
      }
      return
    }

    if (event.button === 1 || event.button === 2) {
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
    updateSnapGuides(snap)
    updateAngleGuides(snap.point)
    handleToolPointerDown(snap.point)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (handlePanPointerMove(event.clientX, event.clientY, event.pointerId, event.pointerType)) {
      return
    }
    if (handleDragPointerMove(event)) {
      return
    }

    const selectionBox = selectionBoxRef.current
    if (selectionBox) {
      if (event.pointerType === 'touch' && event.pointerId !== selectionBox.pointerId) {
        return
      }
      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) {
        return
      }
      selectionBox.current = point
      selectionBox.didMove = selectionBox.didMove || Math.hypot(point.x - selectionBox.start.x, point.y - selectionBox.start.y) > 1 / Math.max(0.1, viewport.scale)
      setSelectionBoxPreview({
        kind: 'selection-box',
        start: selectionBox.start,
        end: point,
        mode: point.x >= selectionBox.start.x ? 'contained' : 'crossing',
      })
      return
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (point) {
      const snap = getSnappedPoint(point)
      setCursorPoint(snap.point)
      setSnapIndicator(snap.reason ? { point: snap.point, reason: snap.reason } : null)
      updateSnapGuides(snap)
      updateAngleGuides(snap.point)
      updateCadCommandPreview(snap.point)
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const selectionBox = selectionBoxRef.current
    if (selectionBox && !(event.pointerType === 'touch' && event.pointerId !== selectionBox.pointerId)) {
      selectionBoxRef.current = null
      setSelectionBoxPreview(null)
      if (!selectionBox.didMove) {
        if (!selectionBox.additive) {
          setSelectedShapeIds([])
          setStatus('Shape selection cleared')
        }
      } else {
        const minX = Math.min(selectionBox.start.x, selectionBox.current.x)
        const minY = Math.min(selectionBox.start.y, selectionBox.current.y)
        const maxX = Math.max(selectionBox.start.x, selectionBox.current.x)
        const maxY = Math.max(selectionBox.start.y, selectionBox.current.y)
        const contained = selectionBox.current.x >= selectionBox.start.x
        const picked = displayShapes
          .filter((shape) => shapeIntersectsBox(shape, minX, minY, maxX, maxY, contained))
          .map((shape) => shape.id)
        const nextSelection = selectionBox.additive ? Array.from(new Set([...selectedShapeIds, ...picked])) : picked
        setSelectedShapeIds(nextSelection)
        setStatus(`${contained ? 'Contained' : 'Crossing'} selected ${picked.length} shape${picked.length === 1 ? '' : 's'}`)
      }
    }
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
    interactionPreview: selectionBoxPreview ?? interactionPreview,
    runPrecisionCommand,
    toolHint,
  }
}
