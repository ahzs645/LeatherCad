import { uid } from '../cad/cad-geometry'
import type { ArcShape, BezierShape, Shape, StitchHole } from '../cad/cad-types'

export type ClipboardPayload = {
  shapes: Shape[]
  stitchHoles: StitchHole[]
}

type ClipboardEnvelope = {
  kind: 'leathercraft-shape-clipboard'
  version: 1
  payload: ClipboardPayload
}

type Point = { x: number; y: number }

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

  if (shape.type === 'text') {
    return {
      ...shape,
      start: { ...shape.start },
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

export function serializeClipboardPayload(payload: ClipboardPayload): string {
  const envelope: ClipboardEnvelope = {
    kind: 'leathercraft-shape-clipboard',
    version: 1,
    payload,
  }
  return JSON.stringify(envelope)
}

export function parseClipboardPayload(raw: string): ClipboardPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ClipboardEnvelope>
    if (parsed.kind !== 'leathercraft-shape-clipboard' || parsed.version !== 1 || !parsed.payload) {
      return null
    }
    if (!Array.isArray(parsed.payload.shapes) || !Array.isArray(parsed.payload.stitchHoles)) {
      return null
    }
    return {
      shapes: parsed.payload.shapes.map((shape) => cloneShape(shape)),
      stitchHoles: parsed.payload.stitchHoles.map((stitchHole) => ({
        ...stitchHole,
        point: { ...stitchHole.point },
      })),
    }
  } catch {
    return null
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

  if (shape.type === 'text') {
    return {
      ...shape,
      start: { x: shape.start.x + dx, y: shape.start.y + dy },
      end: { x: shape.end.x + dx, y: shape.end.y + dy },
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

function shapeCenter(shape: Shape): Point {
  if (shape.type === 'line' || shape.type === 'text') {
    return {
      x: (shape.start.x + shape.end.x) / 2,
      y: (shape.start.y + shape.end.y) / 2,
    }
  }
  if (shape.type === 'arc') {
    return {
      x: (shape.start.x + shape.mid.x + shape.end.x) / 3,
      y: (shape.start.y + shape.mid.y + shape.end.y) / 3,
    }
  }
  return {
    x: (shape.start.x + shape.control.x + shape.end.x) / 3,
    y: (shape.start.y + shape.control.y + shape.end.y) / 3,
  }
}

export function getSelectionCenter(shapes: Shape[], selectedShapeIds: Set<string>): Point | null {
  let sumX = 0
  let sumY = 0
  let count = 0
  for (const shape of shapes) {
    if (!selectedShapeIds.has(shape.id)) {
      continue
    }
    const center = shapeCenter(shape)
    sumX += center.x
    sumY += center.y
    count += 1
  }
  if (count === 0) {
    return null
  }
  return { x: sumX / count, y: sumY / count }
}

function mapShapePoints(shape: Shape, mapPoint: (point: Point) => Point): Shape {
  if (shape.type === 'line') {
    return {
      ...shape,
      start: mapPoint(shape.start),
      end: mapPoint(shape.end),
    }
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
  return {
    ...shape,
    start: mapPoint(shape.start),
    end: mapPoint(shape.end),
  }
}

export function rotatePointAround(point: Point, center: Point, radians: number): Point {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export function scalePointFrom(point: Point, center: Point, factor: number): Point {
  return {
    x: center.x + (point.x - center.x) * factor,
    y: center.y + (point.y - center.y) * factor,
  }
}

export function translateSelection(shapes: Shape[], selectedShapeIds: Set<string>, dx: number, dy: number): Shape[] {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (Math.abs(dx) < 1e-8 && Math.abs(dy) < 1e-8)) {
    return shapes
  }
  return shapes.map((shape) =>
    selectedShapeIds.has(shape.id)
      ? mapShapePoints(shape, (point) => ({
          x: point.x + dx,
          y: point.y + dy,
        }))
      : shape,
  )
}

export function rotateSelection(shapes: Shape[], selectedShapeIds: Set<string>, angleDeg: number): Shape[] {
  if (!Number.isFinite(angleDeg) || Math.abs(angleDeg) < 1e-8) {
    return shapes
  }
  const center = getSelectionCenter(shapes, selectedShapeIds)
  if (!center) {
    return shapes
  }
  const radians = (angleDeg * Math.PI) / 180
  return shapes.map((shape) =>
    selectedShapeIds.has(shape.id) ? mapShapePoints(shape, (point) => rotatePointAround(point, center, radians)) : shape,
  )
}

export function scaleSelection(shapes: Shape[], selectedShapeIds: Set<string>, factor: number): Shape[] {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-8) {
    return shapes
  }
  const center = getSelectionCenter(shapes, selectedShapeIds)
  if (!center) {
    return shapes
  }
  return shapes.map((shape) =>
    selectedShapeIds.has(shape.id) ? mapShapePoints(shape, (point) => scalePointFrom(point, center, factor)) : shape,
  )
}

export function transformSelectedStitchHoles(
  stitchHoles: StitchHole[],
  selectedShapeIds: Set<string>,
  transformPoint: (point: Point) => Point,
): StitchHole[] {
  return stitchHoles.map((stitchHole) =>
    selectedShapeIds.has(stitchHole.shapeId)
      ? {
          ...stitchHole,
          point: transformPoint(stitchHole.point),
        }
      : stitchHole,
  )
}

export function groupSelection(shapes: Shape[], selectedShapeIds: Set<string>, groupId: string): Shape[] {
  return shapes.map((shape) =>
    selectedShapeIds.has(shape.id)
      ? {
          ...shape,
          groupId,
        }
      : shape,
  )
}

export function ungroupSelection(shapes: Shape[], selectedShapeIds: Set<string>): Shape[] {
  return shapes.map((shape) =>
    selectedShapeIds.has(shape.id)
      ? {
          ...shape,
          groupId: undefined,
        }
      : shape,
  )
}
