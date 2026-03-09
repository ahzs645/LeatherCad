import { useEffect, useMemo, useRef } from 'react'
import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
  WheelEvent as ReactWheelEvent,
} from 'react'
import { clamp, getBounds } from '../cad/cad-geometry'
import type {
  FoldLine,
  HardwareKind,
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
  StitchHoleType,
  TextTransformMode,
  Tool,
  Viewport,
} from '../cad/cad-types'
import { snapPointToContext } from '../ops/pattern-ops'
import { CanvasToolManager, getCanvasToolHint, type ToolRuntime } from '../tools/canvas-tool-manager'
import { MAX_ZOOM, MIN_ZOOM } from '../editor-constants'

type PanState = {
  startX: number
  startY: number
  originX: number
  originY: number
  pointerId: number
}

type ShapeDragState = {
  pointerId: number
  start: Point
  shapeIds: string[]
  initialShapesById: Map<string, Shape>
  didMove: boolean
}

type HandlePointKey = 'start' | 'mid' | 'control' | 'end'

type HandleDragState = {
  pointerId: number
  shapeId: string
  pointKey: HandlePointKey
}

type UseCanvasInteractionsParams = {
  svgRef: RefObject<SVGSVGElement | null>
  panRef: RefObject<PanState | null>
  tool: Tool
  draftPoints: Point[]
  viewport: Viewport
  activeLayerId: string
  activeLineTypeId: string
  activeSketchGroup: SketchGroup | null
  snapSettings: SnapSettings
  foldLines: FoldLine[]
  displayShapes: Shape[]
  snapShapes: Shape[]
  stitchTargetShapes: Shape[]
  visibleHardwareMarkers: HardwareMarker[]
  lineTypesById: Record<string, LineType>
  shapesById: Record<string, Shape>
  layers: Layer[]
  hardwarePreset: HardwareKind
  customHardwareDiameterMm: number
  customHardwareSpacingMm: number
  stitchHoleType: StitchHoleType
  textDraftValue: string
  textFontFamily: string
  textFontSizeMm: number
  textTransformMode: TextTransformMode
  textRadiusMm: number
  textSweepDeg: number
  stitchHoles: StitchHole[]
  patternPieces: PatternPiece[]
  pieceNotches: PieceNotch[]
  seamConnections: SeamConnection[]
  hardwareMarkers: HardwareMarker[]
  selectedShapeIds: string[]
  selectedStitchHoleId: string | null
  selectedHardwareMarkerId: string | null
  setStatus: Dispatch<SetStateAction<string>>
  setViewport: Dispatch<SetStateAction<Viewport>>
  setDraftPoints: Dispatch<SetStateAction<Point[]>>
  setCursorPoint: Dispatch<SetStateAction<Point | null>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setPieceNotches: Dispatch<SetStateAction<PieceNotch[]>>
  setSeamConnections: Dispatch<SetStateAction<SeamConnection[]>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setFoldLines: Dispatch<SetStateAction<FoldLine[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  clearDraft: () => void
  ensureActiveLayerWritable: () => boolean
  ensureActiveLineTypeWritable: () => boolean
}

function translateShape(shape: Shape, dx: number, dy: number): Shape {
  if (shape.type === 'line') {
    return {
      ...shape,
      start: { x: shape.start.x + dx, y: shape.start.y + dy },
      end: { x: shape.end.x + dx, y: shape.end.y + dy },
    }
  }
  if (shape.type === 'arc') {
    return {
      ...shape,
      start: { x: shape.start.x + dx, y: shape.start.y + dy },
      mid: { x: shape.mid.x + dx, y: shape.mid.y + dy },
      end: { x: shape.end.x + dx, y: shape.end.y + dy },
    }
  }
  if (shape.type === 'bezier') {
    return {
      ...shape,
      start: { x: shape.start.x + dx, y: shape.start.y + dy },
      control: { x: shape.control.x + dx, y: shape.control.y + dy },
      end: { x: shape.end.x + dx, y: shape.end.y + dy },
    }
  }
  return {
    ...shape,
    start: { x: shape.start.x + dx, y: shape.start.y + dy },
    end: { x: shape.end.x + dx, y: shape.end.y + dy },
  }
}

function withUpdatedHandlePoint(shape: Shape, pointKey: HandlePointKey, point: Point): Shape {
  if (shape.type === 'line' || shape.type === 'text') {
    if (pointKey === 'start' || pointKey === 'end') {
      return {
        ...shape,
        [pointKey]: point,
      }
    }
    return shape
  }
  if (shape.type === 'arc') {
    if (pointKey === 'start' || pointKey === 'mid' || pointKey === 'end') {
      return {
        ...shape,
        [pointKey]: point,
      }
    }
    return shape
  }
  if (pointKey === 'start' || pointKey === 'control' || pointKey === 'end') {
    return {
      ...shape,
      [pointKey]: point,
    }
  }
  return shape
}

export function useCanvasInteractions(params: UseCanvasInteractionsParams) {
  const {
    svgRef,
    panRef,
    tool,
    draftPoints,
    viewport,
    activeLayerId,
    activeLineTypeId,
    activeSketchGroup,
    snapSettings,
    foldLines,
    displayShapes,
    snapShapes,
    stitchTargetShapes,
    visibleHardwareMarkers,
    lineTypesById,
    shapesById,
    layers,
    hardwarePreset,
    customHardwareDiameterMm,
    customHardwareSpacingMm,
    stitchHoleType,
    textDraftValue,
    textFontFamily,
    textFontSizeMm,
    textTransformMode,
    textRadiusMm,
    textSweepDeg,
    stitchHoles,
    patternPieces,
    pieceNotches,
    seamConnections,
    hardwareMarkers,
    selectedShapeIds,
    selectedStitchHoleId,
    selectedHardwareMarkerId,
    setStatus,
    setViewport,
    setDraftPoints,
    setCursorPoint,
    setShapes,
    setStitchHoles,
    setSelectedStitchHoleId,
    setPieceNotches,
    setSeamConnections,
    setHardwareMarkers,
    setSelectedHardwareMarkerId,
    setFoldLines,
    setSelectedShapeIds,
    clearDraft,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
  } = params

  const toolManager = useMemo(() => new CanvasToolManager(), [])
  const referencePointRef = useRef<Point>({ x: 0, y: 0 })
  const shapeDragRef = useRef<ShapeDragState | null>(null)
  const handleDragRef = useRef<HandleDragState | null>(null)

  useEffect(() => {
    toolManager.resetTransientState(tool)
  }, [tool, toolManager])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    // Safari/macOS pinch emits gesture events that can zoom the full page unless explicitly cancelled.
    const preventGestureDefault = (event: Event) => {
      event.preventDefault()
    }
    const preventMultiTouchDefault = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault()
      }
    }

    svg.addEventListener('gesturestart', preventGestureDefault, { passive: false })
    svg.addEventListener('gesturechange', preventGestureDefault, { passive: false })
    svg.addEventListener('gestureend', preventGestureDefault, { passive: false })
    svg.addEventListener('touchstart', preventMultiTouchDefault, { passive: false })
    svg.addEventListener('touchmove', preventMultiTouchDefault, { passive: false })

    return () => {
      svg.removeEventListener('gesturestart', preventGestureDefault)
      svg.removeEventListener('gesturechange', preventGestureDefault)
      svg.removeEventListener('gestureend', preventGestureDefault)
      svg.removeEventListener('touchstart', preventMultiTouchDefault)
      svg.removeEventListener('touchmove', preventMultiTouchDefault)
    }
  }, [svgRef])

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

  const getSnappedPoint = (point: Point) =>
    snapPointToContext(point, snapSettings, {
      shapes: snapShapes,
      foldLines,
      hardwareMarkers: visibleHardwareMarkers,
      viewportScale: viewport.scale,
    })

  const createToolRuntime = (): ToolRuntime => ({
    draftPoints,
    activeLayerId,
    activeLineTypeId,
    activeSketchGroup,
    viewportScale: viewport.scale,
    stitchHoleType,
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
    setDraftPoints,
    clearDraft,
    setStatus,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setSelectedStitchHoleId,
    setPieceNotches,
    setSeamConnections,
    setHardwareMarkers,
    setSelectedHardwareMarkerId,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
    toolManager,
    pointPicked: (point) => {
      referencePointRef.current = point
      setCursorPoint(point)
    },
  })

  const zoomAtScreenPoint = (screenX: number, screenY: number, zoomFactor: number) => {
    setViewport((previous) => {
      const nextScale = clamp(previous.scale * zoomFactor, MIN_ZOOM, MAX_ZOOM)
      const worldX = (screenX - previous.x) / previous.scale
      const worldY = (screenY - previous.y) / previous.scale
      return {
        x: screenX - worldX * nextScale,
        y: screenY - worldY * nextScale,
        scale: nextScale,
      }
    })
  }

  const handleZoomStep = (zoomFactor: number) => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    zoomAtScreenPoint(rect.width / 2, rect.height / 2, zoomFactor)
  }

  const handleResetView = () => {
    setViewport({ x: 560, y: 360, scale: 1 })
    setStatus('View reset')
  }

  const handleFitView = () => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    if (displayShapes.length === 0) {
      handleResetView()
      return
    }

    const rect = svg.getBoundingClientRect()
    const bounds = getBounds(displayShapes)
    const margin = 40
    const fitScale = clamp(
      Math.min((rect.width - margin * 2) / bounds.width, (rect.height - margin * 2) / bounds.height),
      MIN_ZOOM,
      MAX_ZOOM,
    )

    setViewport({
      scale: fitScale,
      x: rect.width / 2 - (bounds.minX + bounds.width / 2) * fitScale,
      y: rect.height / 2 - (bounds.minY + bounds.height / 2) * fitScale,
    })
    setStatus('View fit to current sketch view')
  }

  const beginPan = (clientX: number, clientY: number, pointerId: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: viewport.x,
      originY: viewport.y,
      pointerId,
    }
  }

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
    const point = getSnappedPoint(rawPoint).point
    setCursorPoint(point)

    toolManager.pointerDown(tool, point, createToolRuntime())
  }

  const handleShapePointerDown = (event: ReactPointerEvent<SVGElement>, shapeId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (!point) {
      return
    }

    event.stopPropagation()
    setSelectedHardwareMarkerId(null)

    const isAlreadySelected = selectedShapeIds.includes(shapeId)
    let nextSelection = selectedShapeIds

    if (event.shiftKey) {
      nextSelection = isAlreadySelected
        ? selectedShapeIds.filter((entry) => entry !== shapeId)
        : [...selectedShapeIds, shapeId]
    } else if (!isAlreadySelected) {
      nextSelection = [shapeId]
    }

    setSelectedShapeIds(nextSelection)
    setStatus(
      nextSelection.length === 0
        ? 'Shape selection cleared'
        : `${nextSelection.length} shape${nextSelection.length === 1 ? '' : 's'} selected`,
    )

    if (event.shiftKey || nextSelection.length === 0) {
      return
    }

    const initialShapesById = new Map<string, Shape>()
    for (const id of nextSelection) {
      const shape = shapesById[id]
      if (shape) {
        initialShapesById.set(id, shape)
      }
    }
    if (initialShapesById.size === 0) {
      return
    }

    shapeDragRef.current = {
      pointerId: event.pointerId,
      start: point,
      shapeIds: Array.from(initialShapesById.keys()),
      initialShapesById,
      didMove: false,
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Safe no-op on browsers that do not support capture for SVG child nodes.
    }
  }

  const handleShapeHandlePointerDown = (
    event: ReactPointerEvent<SVGCircleElement>,
    shapeId: string,
    pointKey: HandlePointKey,
  ) => {
    if (tool !== 'pan') {
      return
    }
    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    event.stopPropagation()
    setSelectedShapeIds([shapeId])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
    handleDragRef.current = {
      pointerId: event.pointerId,
      shapeId,
      pointKey,
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Safe no-op on browsers that do not support capture for SVG child nodes.
    }
  }

  const handleStitchHolePointerDown = (event: ReactPointerEvent<SVGElement>, stitchHoleId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const stitchHole = stitchHoles.find((entry) => entry.id === stitchHoleId)
    if (!stitchHole) {
      return
    }

    event.stopPropagation()
    setSelectedShapeIds([])
    const nextId = selectedStitchHoleId === stitchHoleId ? null : stitchHoleId
    setSelectedStitchHoleId(nextId)
    setStatus(nextId ? `Stitch hole ${stitchHole.sequence + 1} selected` : 'Stitch-hole selection cleared')
  }

  const handleHardwarePointerDown = (event: ReactPointerEvent<SVGGElement>, markerId: string) => {
    if (tool !== 'pan') {
      return
    }

    if (event.pointerType !== 'touch' && event.button !== 0) {
      return
    }

    const marker = hardwareMarkers.find((entry) => entry.id === markerId)
    if (!marker) {
      return
    }

    event.stopPropagation()
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    const nextId = selectedHardwareMarkerId === markerId ? null : markerId
    setSelectedHardwareMarkerId(nextId)
    setStatus(nextId ? `Hardware marker selected: ${marker.label}` : 'Hardware marker selection cleared')
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const panState = panRef.current
    if (panState) {
      if (event.pointerType === 'touch' && event.pointerId !== panState.pointerId) {
        return
      }

      const deltaX = event.clientX - panState.startX
      const deltaY = event.clientY - panState.startY
      setViewport((previous) => ({
        ...previous,
        x: panState.originX + deltaX,
        y: panState.originY + deltaY,
      }))
      return
    }

    const handleDragState = handleDragRef.current
    if (handleDragState) {
      if (event.pointerType === 'touch' && event.pointerId !== handleDragState.pointerId) {
        return
      }

      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) {
        return
      }
      const snapped = getSnappedPoint(point).point
      setCursorPoint(snapped)
      setShapes((previous) =>
        previous.map((shape) =>
          shape.id === handleDragState.shapeId ? withUpdatedHandlePoint(shape, handleDragState.pointKey, snapped) : shape,
        ),
      )
      return
    }

    const shapeDragState = shapeDragRef.current
    if (shapeDragState) {
      if (event.pointerType === 'touch' && event.pointerId !== shapeDragState.pointerId) {
        return
      }

      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) {
        return
      }
      const deltaX = point.x - shapeDragState.start.x
      const deltaY = point.y - shapeDragState.start.y
      if (!shapeDragState.didMove && (Math.abs(deltaX) > 1e-4 || Math.abs(deltaY) > 1e-4)) {
        shapeDragState.didMove = true
      }
      setCursorPoint(point)
      setShapes((previous) =>
        previous.map((shape) => {
          const initial = shapeDragState.initialShapesById.get(shape.id)
          if (!initial) {
            return shape
          }
          return translateShape(initial, deltaX, deltaY)
        }),
      )
      return
    }

    if (draftPoints.length === 0 && tool !== 'hardware') {
      return
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (point) {
      setCursorPoint(getSnappedPoint(point).point)
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const panState = panRef.current
    if (panState && !(event.pointerType === 'touch' && event.pointerId !== panState.pointerId)) {
      panRef.current = null
    }

    const handleDragState = handleDragRef.current
    if (handleDragState && !(event.pointerType === 'touch' && event.pointerId !== handleDragState.pointerId)) {
      handleDragRef.current = null
    }

    const shapeDragState = shapeDragRef.current
    if (shapeDragState && !(event.pointerType === 'touch' && event.pointerId !== shapeDragState.pointerId)) {
      shapeDragRef.current = null
      if (shapeDragState.didMove) {
        setStatus(
          `Moved ${shapeDragState.shapeIds.length} shape${shapeDragState.shapeIds.length === 1 ? '' : 's'}`,
        )
      }
    }

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

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    const screenX = event.clientX - rect.left
    const screenY = event.clientY - rect.top
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
    zoomAtScreenPoint(screenX, screenY, zoomFactor)
  }

  const runPrecisionCommand = (command: string) => {
    const message = toolManager.processCommand(command, {
      tool,
      runtime: createToolRuntime(),
      referencePoint: referencePointRef.current,
    })
    setStatus(message)
    return message
  }

  const toolHint = getCanvasToolHint(tool, draftPoints)

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
    handleWheel,
    runPrecisionCommand,
    toolHint,
  }
}
