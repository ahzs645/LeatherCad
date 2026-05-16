import { sampleShapePoints } from '../cad/cad-geometry'
import type { LineShape, Point, Shape } from '../cad/cad-types'
import { computeBoundsFromShapes, translateShape } from './pattern-ops'
import {
  getSelectionCenter,
  rotatePointAround,
  scalePointFrom,
} from './shape-selection-ops'

export type AlignEdge = 'left' | 'right' | 'top' | 'bottom' | 'middleH' | 'middleV'

function mapShapePoints(shape: Shape, mapPoint: (point: Point) => Point): Shape {
  if (shape.type === 'line') {
    return { ...shape, start: mapPoint(shape.start), end: mapPoint(shape.end) }
  }
  if (shape.type === 'arc') {
    return {
      ...shape,
      start: mapPoint(shape.start),
      mid: mapPoint(shape.mid),
      end: mapPoint(shape.end),
    }
  }
  if (shape.type === 'bezier') {
    return {
      ...shape,
      start: mapPoint(shape.start),
      control: mapPoint(shape.control),
      end: mapPoint(shape.end),
    }
  }
  return { ...shape, start: mapPoint(shape.start), end: mapPoint(shape.end) }
}

function shapeBounds(shape: Shape) {
  const samples = sampleShapePoints(shape, 24)
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of samples) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Align every selected shape to an edge (or centerline) of the selection's combined bbox.
 * `middleH` centers selection horizontally (equal x); `middleV` centers vertically (equal y).
 */
export function alignSelectionToEdge(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  edge: AlignEdge,
): Shape[] {
  const selected = shapes.filter((shape) => selectedShapeIds.has(shape.id))
  if (selected.length < 2) {
    return shapes
  }
  const bounds = computeBoundsFromShapes(selected)
  if (!bounds) {
    return shapes
  }

  const updateById = new Map<string, Shape>()
  for (const shape of selected) {
    const local = shapeBounds(shape)
    let dx = 0
    let dy = 0
    switch (edge) {
      case 'left':
        dx = bounds.minX - local.minX
        break
      case 'right':
        dx = bounds.maxX - local.maxX
        break
      case 'top':
        dy = bounds.minY - local.minY
        break
      case 'bottom':
        dy = bounds.maxY - local.maxY
        break
      case 'middleH': {
        const refCenter = (bounds.minX + bounds.maxX) / 2
        const localCenter = (local.minX + local.maxX) / 2
        dx = refCenter - localCenter
        break
      }
      case 'middleV': {
        const refCenter = (bounds.minY + bounds.maxY) / 2
        const localCenter = (local.minY + local.maxY) / 2
        dy = refCenter - localCenter
        break
      }
    }
    if (dx !== 0 || dy !== 0) {
      updateById.set(shape.id, translateShape(shape, dx, dy))
    }
  }
  if (updateById.size === 0) {
    return shapes
  }
  return shapes.map((shape) => updateById.get(shape.id) ?? shape)
}

/**
 * Mirror the selection across its combined-bbox center. `horizontal` flips the X axis
 * (left-right mirror); `vertical` flips the Y axis (top-bottom mirror).
 */
export function flipSelection(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  axis: 'horizontal' | 'vertical',
): Shape[] {
  const selected = shapes.filter((shape) => selectedShapeIds.has(shape.id))
  if (selected.length === 0) {
    return shapes
  }
  const bounds = computeBoundsFromShapes(selected)
  if (!bounds) {
    return shapes
  }
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2

  return shapes.map((shape) => {
    if (!selectedShapeIds.has(shape.id)) {
      return shape
    }
    return mapShapePoints(shape, (point) => ({
      x: axis === 'horizontal' ? 2 * cx - point.x : point.x,
      y: axis === 'vertical' ? 2 * cy - point.y : point.y,
    }))
  })
}

/**
 * Mirror selected shapes across an arbitrary line through `pivot` at `axisAngleDeg`.
 * Matches the source app's `actMirrorMandalaItem` action — useful for mirroring across a
 * mandala radial spoke at any angle (not just horizontal/vertical).
 */
export function mirrorSelectionAcrossAxis(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  pivot: Point,
  axisAngleDeg: number,
): Shape[] {
  if (selectedShapeIds.size === 0) {
    return shapes
  }
  const rad = (axisAngleDeg * Math.PI) / 180
  const cos2 = Math.cos(2 * rad)
  const sin2 = Math.sin(2 * rad)
  return shapes.map((shape) => {
    if (!selectedShapeIds.has(shape.id)) {
      return shape
    }
    return mapShapePoints(shape, (point) => {
      const dx = point.x - pivot.x
      const dy = point.y - pivot.y
      return {
        x: pivot.x + dx * cos2 + dy * sin2,
        y: pivot.y + dx * sin2 - dy * cos2,
      }
    })
  })
}

/**
 * Reverse a path's point ordering. For line/bezier/text: swap start and end.
 * For arc: swap start/end (mid is unchanged — still lies on the curve).
 */
export function reverseShapePath(shape: Shape): Shape {
  if (shape.type === 'line' || shape.type === 'text') {
    return { ...shape, start: shape.end, end: shape.start }
  }
  if (shape.type === 'arc') {
    return { ...shape, start: shape.end, end: shape.start }
  }
  return { ...shape, start: shape.end, end: shape.start }
}

export function reverseSelectedPaths(shapes: Shape[], selectedShapeIds: Set<string>): Shape[] {
  if (selectedShapeIds.size === 0) {
    return shapes
  }
  return shapes.map((shape) => (selectedShapeIds.has(shape.id) ? reverseShapePath(shape) : shape))
}

/**
 * Rotate selection about an explicit pivot.
 */
export function rotateSelectionAround(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  angleDeg: number,
  center: Point,
): Shape[] {
  if (!Number.isFinite(angleDeg) || Math.abs(angleDeg) < 1e-8) {
    return shapes
  }
  const radians = (angleDeg * Math.PI) / 180
  return shapes.map((shape) =>
    selectedShapeIds.has(shape.id)
      ? mapShapePoints(shape, (point) => rotatePointAround(point, center, radians))
      : shape,
  )
}

/**
 * Non-uniform scale around an explicit pivot (defaults to selection center).
 */
export function scaleSelectionNonUniform(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  factorX: number,
  factorY: number,
  pivot?: Point,
): Shape[] {
  if (!Number.isFinite(factorX) || !Number.isFinite(factorY)) {
    return shapes
  }
  if (factorX <= 0 || factorY <= 0) {
    return shapes
  }
  if (Math.abs(factorX - 1) < 1e-8 && Math.abs(factorY - 1) < 1e-8) {
    return shapes
  }
  const center = pivot ?? getSelectionCenter(shapes, selectedShapeIds)
  if (!center) {
    return shapes
  }
  return shapes.map((shape) => {
    if (!selectedShapeIds.has(shape.id)) {
      return shape
    }
    return mapShapePoints(shape, (point) => ({
      x: center.x + (point.x - center.x) * factorX,
      y: center.y + (point.y - center.y) * factorY,
    }))
  })
}

/**
 * Snap a line's end to match its start on the given axis, producing a perfectly
 * horizontal or vertical line. Non-line shapes are returned unchanged.
 */
export function makeLineAxisAligned(shape: Shape, axis: 'horizontal' | 'vertical'): Shape {
  if (shape.type !== 'line') {
    return shape
  }
  const line: LineShape = shape
  if (axis === 'horizontal') {
    return { ...line, end: { x: line.end.x, y: line.start.y } }
  }
  return { ...line, end: { x: line.start.x, y: line.end.y } }
}

export function makeSelectedLinesAxisAligned(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  axis: 'horizontal' | 'vertical',
): Shape[] {
  if (selectedShapeIds.size === 0) {
    return shapes
  }
  return shapes.map((shape) =>
    selectedShapeIds.has(shape.id) && shape.type === 'line' ? makeLineAxisAligned(shape, axis) : shape,
  )
}

export function parseNumericEntry(raw: string | null, fallback: number): number | null {
  if (raw === null) {
    return null
  }
  const trimmed = raw.trim()
  if (trimmed === '') {
    return null
  }
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : fallback
}

export { scalePointFrom }
