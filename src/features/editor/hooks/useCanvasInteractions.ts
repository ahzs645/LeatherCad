import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from 'react'
import { clamp, getBounds } from '../cad/cad-geometry'
import type {
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
import { snapPointToContext } from '../ops/pattern-ops'
import { CanvasToolManager, getCanvasToolHint, type ToolRuntime } from '../tools/canvas-tool-manager'
import { MAX_ZOOM, MIN_ZOOM } from '../editor-constants'
import { useEditorPanelSelector } from '../state/providers/EditorPanelStateProvider'
import { useEditorToolActions, useEditorToolSelector } from '../state/providers/EditorToolStateProvider'
import { useEditorUIActions } from '../state/providers/EditorUIStateProvider'

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

export type HandlePointKey = 'start' | 'mid' | 'control' | 'end'

export type CanvasInteractionPreview =
  | {
      kind: 'move'
      shapeIds: string[]
      deltaX: number
      deltaY: number
    }
  | {
      kind: 'handle'
      shapeId: string
      pointKey: HandlePointKey
      point: Point
    }

type HandleDragState = {
  pointerId: number
  shapeId: string
  pointKey: HandlePointKey
}

type UseCanvasInteractionsParams = {
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
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
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

function getHandlePoint(shape: Shape, pointKey: HandlePointKey): Point | null {
  if (shape.type === 'line' || shape.type === 'text') {
    return pointKey === 'start' || pointKey === 'end' ? shape[pointKey] : null
  }
  if (shape.type === 'arc') {
    return pointKey === 'start' || pointKey === 'mid' || pointKey === 'end' ? shape[pointKey] : null
  }
  return pointKey === 'start' || pointKey === 'control' || pointKey === 'end' ? shape[pointKey] : null
}

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
  const { hardwarePreset, customHardwareDiameterMm, customHardwareSpacingMm } = useEditorPanelSelector((state) => ({
    hardwarePreset: state.hardwarePreset,
    customHardwareDiameterMm: state.customHardwareDiameterMm,
    customHardwareSpacingMm: state.customHardwareSpacingMm,
  }))
  const { setStatus } = useEditorUIActions()
  const { setDraftPoints, setCursorPoint, clearDraft } = useEditorToolActions()

  const toolManager = useMemo(() => new CanvasToolManager(), [])
  const referencePointRef = useRef<Point>({ x: 0, y: 0 })
  const shapeDragRef = useRef<ShapeDragState | null>(null)
  const handleDragRef = useRef<HandleDragState | null>(null)
  const [interactionPreview, setInteractionPreview] = useState<CanvasInteractionPreview | null>(null)

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

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9

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

    svg.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      svg.removeEventListener('wheel', handleWheel)
    }
  }, [setViewport, svgRef])

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
    stitchHoleDefaults,
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
    setInteractionPreview(null)
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
    setInteractionPreview(null)
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
    setInteractionPreview(null)

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
    setInteractionPreview(null)

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
      setInteractionPreview((previous) => {
        if (
          previous?.kind === 'handle' &&
          previous.shapeId === handleDragState.shapeId &&
          previous.pointKey === handleDragState.pointKey &&
          Math.abs(previous.point.x - snapped.x) < 1e-4 &&
          Math.abs(previous.point.y - snapped.y) < 1e-4
        ) {
          return previous
        }
        return {
          kind: 'handle',
          shapeId: handleDragState.shapeId,
          pointKey: handleDragState.pointKey,
          point: snapped,
        }
      })
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
      setInteractionPreview((previous) => {
        if (
          previous?.kind === 'move' &&
          previous.shapeIds === shapeDragState.shapeIds &&
          Math.abs(previous.deltaX - deltaX) < 1e-4 &&
          Math.abs(previous.deltaY - deltaY) < 1e-4
        ) {
          return previous
        }
        return {
          kind: 'move',
          shapeIds: shapeDragState.shapeIds,
          deltaX,
          deltaY,
        }
      })
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
      const preview = interactionPreview
      if (preview?.kind === 'handle' && preview.shapeId === handleDragState.shapeId && preview.pointKey === handleDragState.pointKey) {
        const targetShape = shapesById[handleDragState.shapeId]
        const originalPoint = targetShape ? getHandlePoint(targetShape, handleDragState.pointKey) : null
        if (
          targetShape &&
          originalPoint &&
          (Math.abs(originalPoint.x - preview.point.x) > 1e-4 || Math.abs(originalPoint.y - preview.point.y) > 1e-4)
        ) {
          setShapes((previous) =>
            previous.map((shape) =>
              shape.id === handleDragState.shapeId
                ? withUpdatedHandlePoint(shape, handleDragState.pointKey, preview.point)
                : shape,
            ),
          )
          setStatus('Updated shape handle')
        }
      }
      handleDragRef.current = null
    }

    const shapeDragState = shapeDragRef.current
    if (shapeDragState && !(event.pointerType === 'touch' && event.pointerId !== shapeDragState.pointerId)) {
      const preview = interactionPreview
      shapeDragRef.current = null
      if (
        preview?.kind === 'move' &&
        preview.shapeIds === shapeDragState.shapeIds &&
        (Math.abs(preview.deltaX) > 1e-4 || Math.abs(preview.deltaY) > 1e-4)
      ) {
        setShapes((previous) =>
          previous.map((shape) => {
            const initial = shapeDragState.initialShapesById.get(shape.id)
            if (!initial) {
              return shape
            }
            return translateShape(initial, preview.deltaX, preview.deltaY)
          }),
        )
      }
      if (shapeDragState.didMove) {
        setStatus(
          `Moved ${shapeDragState.shapeIds.length} shape${shapeDragState.shapeIds.length === 1 ? '' : 's'}`,
        )
      }
    }
    if (handleDragState || shapeDragState) {
      setInteractionPreview(null)
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
    interactionPreview,
    runPrecisionCommand,
    toolHint,
  }
}
