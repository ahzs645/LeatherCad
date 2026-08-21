import { clamp, distance, uid } from '../cad/cad-geometry'
import type { Point, Shape } from '../cad/cad-types'
import {
  EDGE_PICK_RADIUS_COARSE_PX,
  EDGE_PICK_RADIUS_PX,
  type EdgePickOptions,
} from '../ops/pattern-piece-ops'
import type { ToolRuntime } from './tool-types'

export const MIN_SHAPE_DISTANCE = 0.001

function hasCoarsePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(pointer: coarse)').matches
}

/**
 * Pick options for the tools that select a pattern piece edge. The radius is a
 * screen-space constant, widened for touch: a fingertip covers roughly 9mm of
 * glass, so a mouse-sized target is not reachable with a thumb.
 */
export function edgePickOptions(runtime: ToolRuntime): EdgePickOptions {
  return {
    viewportScale: runtime.viewportScale,
    pickRadiusPx: hasCoarsePointer() ? EDGE_PICK_RADIUS_COARSE_PX : EDGE_PICK_RADIUS_PX,
  }
}

export function withWritableShapeTarget(runtime: ToolRuntime) {
  if (!runtime.ensureActiveLayerWritable() || !runtime.ensureActiveLineTypeWritable()) {
    return false
  }
  return true
}

export function pickToolPoint(runtime: ToolRuntime, point: Point) {
  runtime.toolSession.setReferencePoint(point)
}

export function addLineShape(
  runtime: ToolRuntime,
  start: Point,
  end: Point,
  overrides?: Partial<Pick<Shape, 'layerId' | 'lineTypeId' | 'groupId'>>,
) {
  runtime.setShapes((previous) => [
    ...previous,
    {
      id: uid(),
      type: 'line',
      layerId: overrides?.layerId ?? runtime.activeLayerId,
      lineTypeId: overrides?.lineTypeId ?? runtime.activeLineTypeId,
      groupId: overrides?.groupId ?? runtime.activeSketchGroup?.id,
      start,
      end,
    },
  ])
}

export function ellipsePolylinePoints(center: Point, radiusX: number, radiusY: number) {
  const safeRadiusX = Math.max(0, Math.abs(radiusX))
  const safeRadiusY = Math.max(0, Math.abs(radiusY))
  if (safeRadiusX < MIN_SHAPE_DISTANCE || safeRadiusY < MIN_SHAPE_DISTANCE) {
    return [] as Point[]
  }

  const circumference = 2 * Math.PI * Math.sqrt((safeRadiusX * safeRadiusX + safeRadiusY * safeRadiusY) / 2)
  const segments = Math.max(24, Math.min(180, Math.round(circumference / 6)))
  const points: Point[] = []
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2
    points.push({
      x: center.x + Math.cos(angle) * safeRadiusX,
      y: center.y + Math.sin(angle) * safeRadiusY,
    })
  }
  return points
}

export function createPolylineAsLines(runtime: ToolRuntime, points: Point[]) {
  if (points.length < 2) {
    return 0
  }

  runtime.setShapes((previous) => {
    const created: Shape[] = []
    for (let index = 1; index < points.length; index += 1) {
      created.push({
        id: uid(),
        type: 'line',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: points[index - 1],
        end: points[index],
      })
    }

    if (points.length > 2) {
      created.push({
        id: uid(),
        type: 'line',
        layerId: runtime.activeLayerId,
        lineTypeId: runtime.activeLineTypeId,
        groupId: runtime.activeSketchGroup?.id,
        start: points[points.length - 1],
        end: points[0],
      })
    }

    return [...previous, ...created]
  })

  return points.length
}

export function createTextShapeLength(text: string, fontSizeMm: number) {
  const safeFontSize = clamp(fontSizeMm || 12, 2, 120)
  const safeText = text.trim().length > 0 ? text.trim() : 'Text'
  return {
    safeText,
    safeFontSize,
    baseLength: Math.max(safeFontSize * 0.8, safeText.length * safeFontSize * 0.62),
  }
}

export { clamp, distance, uid }
