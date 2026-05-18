import { useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react'
import type { BezierShape, Point, Shape } from '../../cad/cad-types'
import { distance as pointDistance } from '../../cad/cad-geometry'
import type {
  CanvasInteractionPreview,
  HandleDragState,
  HandlePointKey,
  ShapeDragState,
} from './canvas-interaction-types'

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
      return { ...shape, [pointKey]: point }
    }
    return shape
  }
  if (shape.type === 'arc') {
    if (pointKey === 'start' || pointKey === 'mid' || pointKey === 'end') {
      return { ...shape, [pointKey]: point }
    }
    return shape
  }
  if (pointKey === 'start' || pointKey === 'control' || pointKey === 'end') {
    return { ...shape, [pointKey]: point }
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

type UseCanvasShapeDragInteractionsParams = {
  tool: string
  selectedShapeIds: string[]
  shapesById: Record<string, Shape>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setCursorPoint: (point: Point) => void
  setStatus: (status: string) => void
  toWorldPoint: (clientX: number, clientY: number) => Point | null
  getSnappedPoint: (point: Point) => { point: Point }
  incrementalSelection?: boolean
  onPickLineTypeFromShape?: (shapeId: string) => void
  onBezierSplitAtPoint?: (shapeId: string, worldPoint: Point) => void
}

export function useCanvasShapeDragInteractions({
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
  incrementalSelection = false,
  onPickLineTypeFromShape,
  onBezierSplitAtPoint,
}: UseCanvasShapeDragInteractionsParams) {
  const shapeDragRef = useRef<ShapeDragState | null>(null)
  const handleDragRef = useRef<HandleDragState | null>(null)
  const [interactionPreview, setInteractionPreview] = useState<CanvasInteractionPreview | null>(null)

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

    // Ctrl+Alt+Click (Cmd+Option+Click on Mac) picks the clicked shape's line type.
    if ((event.ctrlKey || event.metaKey) && event.altKey && onPickLineTypeFromShape) {
      onPickLineTypeFromShape(shapeId)
      return
    }

    // Alt+Click on a selected bezier splits it at the clicked point.
    if (event.altKey && !event.ctrlKey && !event.metaKey && onBezierSplitAtPoint) {
      const targetShape = shapesById[shapeId]
      if (targetShape?.type === 'bezier' && selectedShapeIds.includes(shapeId)) {
        onBezierSplitAtPoint(shapeId, point)
        return
      }
    }

    setSelectedHardwareMarkerId(null)

    const isAlreadySelected = selectedShapeIds.includes(shapeId)
    let nextSelection = selectedShapeIds
    const additive = event.shiftKey || incrementalSelection

    if (additive) {
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

    if (additive || nextSelection.length === 0) {
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

  const handleDragPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const handleDragState = handleDragRef.current
    if (handleDragState) {
      if (event.pointerType === 'touch' && event.pointerId !== handleDragState.pointerId) {
        return true
      }

      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) {
        return true
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
      return true
    }

    const shapeDragState = shapeDragRef.current
    if (!shapeDragState) {
      return false
    }
    if (event.pointerType === 'touch' && event.pointerId !== shapeDragState.pointerId) {
      return true
    }

    const point = toWorldPoint(event.clientX, event.clientY)
    if (!point) {
      return true
    }
    const rawDeltaX = point.x - shapeDragState.start.x
    const rawDeltaY = point.y - shapeDragState.start.y
    // Shift held → lock drag to the dominant axis (source-app behavior).
    const [deltaX, deltaY] = event.shiftKey
      ? Math.abs(rawDeltaX) >= Math.abs(rawDeltaY)
        ? [rawDeltaX, 0]
        : [0, rawDeltaY]
      : [rawDeltaX, rawDeltaY]
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
    return true
  }

  const handleDragPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
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
          // Shift+drag on a bezier CP also mirrors the move into the adjacent
          // jointed bezier's CP so the joint stays smooth (source-app v1.7.0).
          const isBezierCpJointSync =
            event.shiftKey && targetShape.type === 'bezier' && handleDragState.pointKey === 'control'
          let jointSyncPatch:
            | { shapeId: string; nextControl: Point }
            | null = null
          if (isBezierCpJointSync && targetShape.type === 'bezier') {
            const targetBezier: BezierShape = targetShape
            const tolerance = 1e-6
            for (const candidate of Object.values(shapesById)) {
              if (!candidate || candidate.id === targetBezier.id) continue
              if (candidate.type !== 'bezier') continue
              const matchStart =
                pointDistance(candidate.start, targetBezier.start) < tolerance ||
                pointDistance(candidate.start, targetBezier.end) < tolerance
              const matchEnd =
                pointDistance(candidate.end, targetBezier.start) < tolerance ||
                pointDistance(candidate.end, targetBezier.end) < tolerance
              if (!matchStart && !matchEnd) continue
              const joint = matchStart ? candidate.start : candidate.end
              const nextControl: Point = {
                x: 2 * joint.x - preview.point.x,
                y: 2 * joint.y - preview.point.y,
              }
              jointSyncPatch = { shapeId: candidate.id, nextControl }
              break
            }
          }
          // Source v1.5.4: when dragging a bezier endpoint without Shift, the
          // nearest control point follows by the same delta. Shift held keeps
          // the control point fixed.
          const isBezierEndpointFollow =
            !event.shiftKey &&
            targetShape.type === 'bezier' &&
            (handleDragState.pointKey === 'start' || handleDragState.pointKey === 'end')
          const followDelta = isBezierEndpointFollow
            ? { dx: preview.point.x - originalPoint.x, dy: preview.point.y - originalPoint.y }
            : null
          setShapes((previous) =>
            previous.map((shape) => {
              if (shape.id === handleDragState.shapeId) {
                let next = withUpdatedHandlePoint(shape, handleDragState.pointKey, preview.point)
                if (followDelta && next.type === 'bezier') {
                  next = {
                    ...next,
                    control: {
                      x: next.control.x + followDelta.dx,
                      y: next.control.y + followDelta.dy,
                    },
                  }
                }
                return next
              }
              if (jointSyncPatch && shape.id === jointSyncPatch.shapeId && shape.type === 'bezier') {
                return { ...shape, control: jointSyncPatch.nextControl }
              }
              return shape
            }),
          )
          setStatus(
            jointSyncPatch
              ? 'Updated handle (joint symmetric)'
              : followDelta
                ? 'Updated bezier endpoint (CP followed)'
                : 'Updated shape handle',
          )
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
        setStatus(`Moved ${shapeDragState.shapeIds.length} shape${shapeDragState.shapeIds.length === 1 ? '' : 's'}`)
      }
    }

    if (handleDragState || shapeDragState) {
      setInteractionPreview(null)
      return true
    }

    return false
  }

  return {
    interactionPreview,
    handleShapePointerDown,
    handleShapeHandlePointerDown,
    handleDragPointerMove,
    handleDragPointerUp,
  }
}

export type { HandlePointKey }
