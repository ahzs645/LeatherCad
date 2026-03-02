import { uid } from './cad-geometry'
import type { ArcShape, BezierShape, Shape, StitchHole } from './cad-types'

export type ClipboardPayload = {
  shapes: Shape[]
  stitchHoles: StitchHole[]
}

function cloneShape(shape: Shape): Shape {
  if (shape.type === 'line') {
    return {
      ...shape,
      start: { ...shape.start },
      end: { ...shape.end },
    }
  }

  if (shape.type === 'arc') {
    return {
      ...shape,
      start: { ...shape.start },
      mid: { ...shape.mid },
      end: { ...shape.end },
    }
  }

  const bezier = shape as BezierShape
  return {
    ...bezier,
    start: { ...bezier.start },
    control: { ...bezier.control },
    end: { ...bezier.end },
  }
}

export function copySelectionToClipboard(
  shapes: Shape[],
  stitchHoles: StitchHole[],
  selectedShapeIds: Set<string>,
): ClipboardPayload {
  return {
    shapes: shapes.filter((shape) => selectedShapeIds.has(shape.id)).map(cloneShape),
    stitchHoles: stitchHoles
      .filter((stitchHole) => selectedShapeIds.has(stitchHole.shapeId))
      .map((stitchHole) => ({
        ...stitchHole,
        point: { ...stitchHole.point },
      })),
  }
}

function shiftShape(shape: Shape, dx: number, dy: number): Shape {
  if (shape.type === 'line') {
    return {
      ...shape,
      start: { x: shape.start.x + dx, y: shape.start.y + dy },
      end: { x: shape.end.x + dx, y: shape.end.y + dy },
    }
  }

  if (shape.type === 'arc') {
    const arc = shape as ArcShape
    return {
      ...arc,
      start: { x: arc.start.x + dx, y: arc.start.y + dy },
      mid: { x: arc.mid.x + dx, y: arc.mid.y + dy },
      end: { x: arc.end.x + dx, y: arc.end.y + dy },
    }
  }

  const bezier = shape as BezierShape
  return {
    ...bezier,
    start: { x: bezier.start.x + dx, y: bezier.start.y + dy },
    control: { x: bezier.control.x + dx, y: bezier.control.y + dy },
    end: { x: bezier.end.x + dx, y: bezier.end.y + dy },
  }
}

export function pasteClipboardPayload(
  payload: ClipboardPayload,
  offset: { x: number; y: number },
  fallbackLayerId: string | null,
): {
  shapes: Shape[]
  stitchHoles: StitchHole[]
  shapeIds: string[]
} {
  const idMap = new Map<string, string>()
  const nextShapes = payload.shapes.map((shape) => {
    const cloned = shiftShape(cloneShape(shape), offset.x, offset.y)
    const nextId = uid()
    idMap.set(shape.id, nextId)
    return {
      ...cloned,
      id: nextId,
      layerId: fallbackLayerId ?? cloned.layerId,
    }
  })

  const nextHoles = payload.stitchHoles
    .map((hole) => {
      const mappedShapeId = idMap.get(hole.shapeId)
      if (!mappedShapeId) {
        return null
      }
      return {
        ...hole,
        id: uid(),
        shapeId: mappedShapeId,
        point: {
          x: hole.point.x + offset.x,
          y: hole.point.y + offset.y,
        },
      }
    })
    .filter((hole): hole is StitchHole => hole !== null)

  return {
    shapes: nextShapes,
    stitchHoles: nextHoles,
    shapeIds: nextShapes.map((shape) => shape.id),
  }
}

export function moveSelectionByOneStep(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  direction: 'forward' | 'backward',
): Shape[] {
  if (selectedShapeIds.size === 0 || shapes.length < 2) {
    return shapes
  }

  const next = [...shapes]
  if (direction === 'forward') {
    for (let index = next.length - 2; index >= 0; index -= 1) {
      if (selectedShapeIds.has(next[index].id) && !selectedShapeIds.has(next[index + 1].id)) {
        ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      }
    }
    return next
  }

  for (let index = 1; index < next.length; index += 1) {
    if (selectedShapeIds.has(next[index].id) && !selectedShapeIds.has(next[index - 1].id)) {
      ;[next[index], next[index - 1]] = [next[index - 1], next[index]]
    }
  }
  return next
}

export function moveSelectionToEdge(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  edge: 'front' | 'back',
): Shape[] {
  if (selectedShapeIds.size === 0 || shapes.length < 2) {
    return shapes
  }
  const selected = shapes.filter((shape) => selectedShapeIds.has(shape.id))
  if (selected.length === 0) {
    return shapes
  }
  const unselected = shapes.filter((shape) => !selectedShapeIds.has(shape.id))
  return edge === 'front' ? [...unselected, ...selected] : [...selected, ...unselected]
}
