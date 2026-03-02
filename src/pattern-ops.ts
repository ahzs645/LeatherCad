import { distance, round, sampleShapePoints } from './cad-geometry'
import type {
  ConstraintAnchor,
  FoldLine,
  HardwareMarker,
  Layer,
  ParametricConstraint,
  Point,
  Shape,
  SnapSettings,
} from './cad-types'

type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type SnapContext = {
  shapes: Shape[]
  foldLines: FoldLine[]
  hardwareMarkers: HardwareMarker[]
  viewportScale: number
}

export type SnapResult = {
  point: Point
  reason: string | null
}

const SNAP_PIXEL_THRESHOLD = 14

export function getShapeAnchorPoint(shape: Shape, anchor: ConstraintAnchor): Point {
  if (anchor === 'start') {
    return { ...shape.start }
  }

  if (anchor === 'end') {
    return { ...shape.end }
  }

  if (anchor === 'mid') {
    if (shape.type === 'line') {
      return {
        x: (shape.start.x + shape.end.x) / 2,
        y: (shape.start.y + shape.end.y) / 2,
      }
    }
    if (shape.type === 'arc') {
      return { ...shape.mid }
    }
    return { ...shape.control }
  }

  const sampled = sampleShapePoints(shape, 24)
  if (sampled.length === 0) {
    return { ...shape.start }
  }

  const sum = sampled.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 },
  )

  return {
    x: sum.x / sampled.length,
    y: sum.y / sampled.length,
  }
}

export function translateShape(shape: Shape, dx: number, dy: number): Shape {
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

  return {
    ...shape,
    start: { x: shape.start.x + dx, y: shape.start.y + dy },
    control: { x: shape.control.x + dx, y: shape.control.y + dy },
    end: { x: shape.end.x + dx, y: shape.end.y + dy },
  }
}

export function computeBoundsFromShapes(shapes: Shape[]): Bounds | null {
  if (shapes.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const shape of shapes) {
    const sampled = sampleShapePoints(shape, 24)
    for (const point of sampled) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  return { minX, minY, maxX, maxY }
}

function computeLayerBounds(shapes: Shape[], layerId: string): Bounds | null {
  return computeBoundsFromShapes(shapes.filter((shape) => shape.layerId === layerId))
}

function replaceShapeAtIndex(shapes: Shape[], index: number, nextShape: Shape): Shape[] {
  if (index < 0 || index >= shapes.length) {
    return shapes
  }

  const next = [...shapes]
  next[index] = nextShape
  return next
}

function applyEdgeOffsetConstraint(
  shapes: Shape[],
  indexById: Map<string, number>,
  constraint: Extract<ParametricConstraint, { type: 'edge-offset' }>,
): Shape[] {
  const shapeIndex = indexById.get(constraint.shapeId)
  if (shapeIndex === undefined) {
    return shapes
  }

  const target = shapes[shapeIndex]
  const layerBounds = computeLayerBounds(shapes, constraint.referenceLayerId)
  if (!layerBounds) {
    return shapes
  }

  const anchorPoint = getShapeAnchorPoint(target, constraint.anchor)
  let desiredX = anchorPoint.x
  let desiredY = anchorPoint.y

  if (constraint.edge === 'left') {
    desiredX = layerBounds.minX + constraint.offsetMm
  } else if (constraint.edge === 'right') {
    desiredX = layerBounds.maxX - constraint.offsetMm
  } else if (constraint.edge === 'top') {
    desiredY = layerBounds.minY + constraint.offsetMm
  } else {
    desiredY = layerBounds.maxY - constraint.offsetMm
  }

  const moved = translateShape(target, desiredX - anchorPoint.x, desiredY - anchorPoint.y)
  return replaceShapeAtIndex(shapes, shapeIndex, moved)
}

function applyAlignConstraint(
  shapes: Shape[],
  indexById: Map<string, number>,
  constraint: Extract<ParametricConstraint, { type: 'align' }>,
): Shape[] {
  const shapeIndex = indexById.get(constraint.shapeId)
  const referenceIndex = indexById.get(constraint.referenceShapeId)
  if (shapeIndex === undefined || referenceIndex === undefined) {
    return shapes
  }

  const target = shapes[shapeIndex]
  const reference = shapes[referenceIndex]
  const targetAnchor = getShapeAnchorPoint(target, constraint.anchor)
  const referenceAnchor = getShapeAnchorPoint(reference, constraint.referenceAnchor)

  const deltaX = constraint.axis === 'y' ? 0 : referenceAnchor.x - targetAnchor.x
  const deltaY = constraint.axis === 'x' ? 0 : referenceAnchor.y - targetAnchor.y

  const moved = translateShape(target, deltaX, deltaY)
  return replaceShapeAtIndex(shapes, shapeIndex, moved)
}

export function applyParametricConstraints(
  shapes: Shape[],
  layers: Layer[],
  constraints: ParametricConstraint[],
): Shape[] {
  if (shapes.length === 0 || constraints.length === 0 || layers.length === 0) {
    return shapes
  }

  let nextShapes = [...shapes]
  const validLayerIds = new Set(layers.map((layer) => layer.id))

  for (const constraint of constraints) {
    if (!constraint.enabled) {
      continue
    }

    const indexById = new Map(nextShapes.map((shape, index) => [shape.id, index]))

    if (constraint.type === 'edge-offset') {
      if (!validLayerIds.has(constraint.referenceLayerId)) {
        continue
      }
      nextShapes = applyEdgeOffsetConstraint(nextShapes, indexById, constraint)
      continue
    }

    nextShapes = applyAlignConstraint(nextShapes, indexById, constraint)
  }

  return nextShapes
}

function projectToSegment(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const segmentLengthSq = dx * dx + dy * dy
  if (segmentLengthSq < 1e-6) {
    return { ...start }
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSq
  const clamped = Math.min(1, Math.max(0, t))

  return {
    x: start.x + dx * clamped,
    y: start.y + dy * clamped,
  }
}

export function snapPointToContext(point: Point, settings: SnapSettings, context: SnapContext): SnapResult {
  if (!settings.enabled) {
    return { point, reason: null }
  }

  let best = { point, distance: Number.POSITIVE_INFINITY, reason: null as string | null }
  const threshold = SNAP_PIXEL_THRESHOLD / Math.max(0.1, context.viewportScale)

  const registerCandidate = (candidate: Point, reason: string) => {
    const nextDistance = distance(point, candidate)
    if (nextDistance <= threshold && nextDistance < best.distance) {
      best = { point: candidate, distance: nextDistance, reason }
    }
  }

  if (settings.grid) {
    const safeStep = Math.max(0.1, settings.gridStep)
    registerCandidate(
      {
        x: Math.round(point.x / safeStep) * safeStep,
        y: Math.round(point.y / safeStep) * safeStep,
      },
      'grid',
    )
  }

  if (settings.endpoints) {
    for (const shape of context.shapes) {
      registerCandidate(shape.start, 'endpoint')
      registerCandidate(shape.end, 'endpoint')
    }
  }

  if (settings.midpoints) {
    for (const shape of context.shapes) {
      if (shape.type === 'line') {
        registerCandidate(
          {
            x: (shape.start.x + shape.end.x) / 2,
            y: (shape.start.y + shape.end.y) / 2,
          },
          'midpoint',
        )
      } else if (shape.type === 'arc') {
        registerCandidate(shape.mid, 'midpoint')
      } else {
        registerCandidate(shape.control, 'midpoint')
      }
    }
  }

  if (settings.guides) {
    for (const foldLine of context.foldLines) {
      registerCandidate(projectToSegment(point, foldLine.start, foldLine.end), 'guide')
    }
  }

  if (settings.hardware) {
    for (const marker of context.hardwareMarkers) {
      registerCandidate(marker.point, 'hardware')
    }
  }

  return {
    point: best.point,
    reason: best.reason,
  }
}

export function buildSeamAllowancePath(shape: Shape, offsetMm: number): string | null {
  if (!Number.isFinite(offsetMm) || Math.abs(offsetMm) < 0.001) {
    return null
  }

  const sampled = sampleShapePoints(shape, 36)
  if (sampled.length < 2) {
    return null
  }

  const shifted: Point[] = []
  for (let index = 0; index < sampled.length; index += 1) {
    const previous = sampled[Math.max(0, index - 1)]
    const current = sampled[index]
    const next = sampled[Math.min(sampled.length - 1, index + 1)]
    const tangent = {
      x: next.x - previous.x,
      y: next.y - previous.y,
    }
    const tangentLength = Math.hypot(tangent.x, tangent.y)
    if (tangentLength < 1e-6) {
      shifted.push({ ...current })
      continue
    }

    const normal = {
      x: -tangent.y / tangentLength,
      y: tangent.x / tangentLength,
    }

    shifted.push({
      x: current.x + normal.x * offsetMm,
      y: current.y + normal.y * offsetMm,
    })
  }

  const commands = shifted.map((entry, index) => `${index === 0 ? 'M' : 'L'} ${round(entry.x)} ${round(entry.y)}`)
  return commands.join(' ')
}

export function alignSelectedShapes(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  axis: 'x' | 'y' | 'both',
): Shape[] {
  const selected = shapes.filter((shape) => selectedShapeIds.has(shape.id))
  if (selected.length < 2) {
    return shapes
  }

  const reference = selected[0]
  const referenceCenter = getShapeAnchorPoint(reference, 'center')
  const updateById = new Map<string, Shape>()

  for (const shape of selected.slice(1)) {
    const center = getShapeAnchorPoint(shape, 'center')
    const dx = axis === 'y' ? 0 : referenceCenter.x - center.x
    const dy = axis === 'x' ? 0 : referenceCenter.y - center.y
    updateById.set(shape.id, translateShape(shape, dx, dy))
  }

  return shapes.map((shape) => updateById.get(shape.id) ?? shape)
}

export function alignSelectedShapesToGrid(shapes: Shape[], selectedShapeIds: Set<string>, gridStep: number): Shape[] {
  const safeStep = Math.max(0.1, gridStep)
  const updateById = new Map<string, Shape>()

  for (const shape of shapes) {
    if (!selectedShapeIds.has(shape.id)) {
      continue
    }

    const center = getShapeAnchorPoint(shape, 'center')
    const snapped = {
      x: Math.round(center.x / safeStep) * safeStep,
      y: Math.round(center.y / safeStep) * safeStep,
    }

    updateById.set(shape.id, translateShape(shape, snapped.x - center.x, snapped.y - center.y))
  }

  if (updateById.size === 0) {
    return shapes
  }

  return shapes.map((shape) => updateById.get(shape.id) ?? shape)
}
