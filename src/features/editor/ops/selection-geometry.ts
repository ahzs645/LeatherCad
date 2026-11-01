import type { LineShape, Point, Shape } from '../cad/cad-types'
import { shapeBounds } from '../components/canvas/canvas-geometry'
import { scaleSelectionNonUniform } from './transform-ops'
import { translateSelection } from './shape-selection-ops'

export type SelectionBox = { minX: number; minY: number; maxX: number; maxY: number }
export type BoxTarget = { minX: number; minY: number; width: number; height: number }

export function selectionBox(shapes: Shape[], selectedIds: Set<string>): SelectionBox | null {
  let box: SelectionBox | null = null
  for (const shape of shapes) {
    if (!selectedIds.has(shape.id)) continue
    const next = shapeBounds(shape)
    if (![next.minX, next.minY, next.maxX, next.maxY].every(Number.isFinite)) continue
    box = box
      ? { minX: Math.min(box.minX, next.minX), minY: Math.min(box.minY, next.minY), maxX: Math.max(box.maxX, next.maxX), maxY: Math.max(box.maxY, next.maxY) }
      : { ...next }
  }
  return box
}

/**
 * Point map that takes `current` onto `target`: scale from the box's min
 * corner, then move the corner. A zero-size axis keeps its size (a horizontal
 * line has no height to scale).
 */
export function boxToBoxMapper(current: SelectionBox, target: BoxTarget) {
  const width = current.maxX - current.minX
  const height = current.maxY - current.minY
  const factorX = width > 1e-9 && target.width > 0 ? target.width / width : 1
  const factorY = height > 1e-9 && target.height > 0 ? target.height / height : 1
  const dx = target.minX - current.minX
  const dy = target.minY - current.minY
  return {
    factorX,
    factorY,
    dx,
    dy,
    map: (point: Point): Point => ({
      x: current.minX + (point.x - current.minX) * factorX + dx,
      y: current.minY + (point.y - current.minY) * factorY + dy,
    }),
  }
}

/** Selected shapes moved/scaled so their combined bounds become `target`, as one change. */
export function fitSelectionToBox(shapes: Shape[], selectedIds: Set<string>, target: BoxTarget): Shape[] {
  const current = selectionBox(shapes, selectedIds)
  if (!current) return shapes
  const { factorX, factorY, dx, dy } = boxToBoxMapper(current, target)
  const scaled = scaleSelectionNonUniform(shapes, selectedIds, factorX, factorY, { x: current.minX, y: current.minY })
  return translateSelection(scaled, selectedIds, dx, dy)
}

/** Length and on-screen angle (degrees, counter-clockwise from +X; world Y points down). */
export function lineLengthAngle(line: Pick<LineShape, 'start' | 'end'>) {
  const dx = line.end.x - line.start.x
  const dy = line.end.y - line.start.y
  const angle = (Math.atan2(-dy, dx) * 180) / Math.PI
  return { length: Math.hypot(dx, dy), angleDeg: Math.abs(angle) < 1e-9 ? 0 : angle }
}

/** New end point keeping the start, for a given length and on-screen angle. */
export function lineEndFor(start: Point, length: number, angleDeg: number): Point {
  const radians = (angleDeg * Math.PI) / 180
  return { x: start.x + Math.cos(radians) * length, y: start.y - Math.sin(radians) * length }
}
