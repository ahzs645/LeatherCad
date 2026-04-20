import { uid } from '../cad/cad-geometry'
import type { Shape } from '../cad/cad-types'

type StampGridParams = {
  rows: number
  cols: number
  pitchXMm: number
  pitchYMm: number
}

/**
 * "Stamp simulator" — tiles a set of shapes in a grid, producing rows×cols
 * duplicates offset by the given pitch. Skips the (0,0) slot since the
 * originals are already in place. Returns the new duplicated shapes.
 */
export function tileSelectionAsStamp(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  params: StampGridParams,
): Shape[] {
  const selected = shapes.filter((shape) => selectedShapeIds.has(shape.id))
  if (selected.length === 0) return []
  const { rows, cols, pitchXMm, pitchYMm } = params
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) return []

  const stamps: Shape[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row === 0 && col === 0) continue
      const dx = col * pitchXMm
      const dy = row * pitchYMm
      for (const shape of selected) {
        stamps.push(offsetShape(shape, dx, dy))
      }
    }
  }
  return stamps
}

function offsetShape(shape: Shape, dx: number, dy: number): Shape {
  const freshId = uid()
  if (shape.type === 'line' || shape.type === 'text') {
    return {
      ...shape,
      id: freshId,
      start: { x: shape.start.x + dx, y: shape.start.y + dy },
      end: { x: shape.end.x + dx, y: shape.end.y + dy },
    }
  }
  if (shape.type === 'arc') {
    return {
      ...shape,
      id: freshId,
      start: { x: shape.start.x + dx, y: shape.start.y + dy },
      mid: { x: shape.mid.x + dx, y: shape.mid.y + dy },
      end: { x: shape.end.x + dx, y: shape.end.y + dy },
    }
  }
  return {
    ...shape,
    id: freshId,
    start: { x: shape.start.x + dx, y: shape.start.y + dy },
    control: { x: shape.control.x + dx, y: shape.control.y + dy },
    end: { x: shape.end.x + dx, y: shape.end.y + dy },
  }
}
