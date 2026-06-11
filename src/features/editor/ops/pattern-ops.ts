import { distance, round, sampleShapePoints } from '../cad/cad-geometry'
import type {
  ConstraintAnchor,
  FoldLine,
  HardwareMarker,
  Layer,
  ParametricConstraint,
  Point,
  Shape,
  SnapSettings,
} from '../cad/cad-types'

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
  customSnapPoints?: Point[]
  mandalaIntersections?: Point[]
  /** Draft anchor — when set, tangent-to-circle snap candidates are computed relative to it. */
  draftAnchor?: Point
  /** Source-app `chkTangentCircleMode` — emit perimeter samples per circle for tangent-snap. */
  tangentCircleMode?: boolean
  /** How many evenly-spaced tangent points to sample per circle when the mode is on. */
  tangentCircleDispStep?: number
}

/**
 * Derive Mandala-style intersection candidates: where a straight line that
 * passes through an arc's center crosses that arc's underlying circle. Mirrors
 * source-app v2.0.0 behaviour: division-line ↔ circle-guide intersections
 * become snap points. The math also works for any radial line through any arc.
 */
export function computeMandalaIntersectionCandidates(shapes: Shape[]): Point[] {
  const TOLERANCE_MM = 0.5
  const arcs: Array<{ center: Point; radius: number }> = []
  for (const shape of shapes) {
    if (shape.type !== 'arc') continue
    const circle = circleThroughThreePoints(shape.start, shape.mid, shape.end)
    if (!circle) continue
    arcs.push(circle)
  }
  if (arcs.length === 0) return []
  const candidates: Point[] = []
  for (const shape of shapes) {
    if (shape.type !== 'line') continue
    const dx = shape.end.x - shape.start.x
    const dy = shape.end.y - shape.start.y
    const lineLen = Math.hypot(dx, dy)
    if (lineLen < 1e-6) continue
    const ux = dx / lineLen
    const uy = dy / lineLen
    for (const { center, radius } of arcs) {
      const t =
        ((center.x - shape.start.x) * dx + (center.y - shape.start.y) * dy) / (lineLen * lineLen)
      const projX = shape.start.x + t * dx
      const projY = shape.start.y + t * dy
      const distToLine = Math.hypot(projX - center.x, projY - center.y)
      if (distToLine > TOLERANCE_MM) continue
      candidates.push({
        x: round(center.x + ux * radius),
        y: round(center.y + uy * radius),
      })
      candidates.push({
        x: round(center.x - ux * radius),
        y: round(center.y - uy * radius),
      })
    }
  }
  return candidates
}

function circleThroughThreePoints(p1: Point, p2: Point, p3: Point): { center: Point; radius: number } | null {
  const ax = p2.x - p1.x
  const ay = p2.y - p1.y
  const bx = p3.x - p1.x
  const by = p3.y - p1.y
  const d = 2 * (ax * by - ay * bx)
  if (Math.abs(d) < 1e-9) return null
  const ax2ay2 = ax * ax + ay * ay
  const bx2by2 = bx * bx + by * by
  const ux = (by * ax2ay2 - ay * bx2by2) / d
  const uy = (ax * bx2by2 - bx * ax2ay2) / d
  return {
    center: { x: p1.x + ux, y: p1.y + uy },
    radius: Math.hypot(ux, uy),
  }
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
    if (shape.type === 'bezier') {
      return { ...shape.control }
    }
    return {
      x: (shape.start.x + shape.end.x) / 2,
      y: (shape.start.y + shape.end.y) / 2,
    }
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
  const safeScale = Math.max(0.1, context.viewportScale)
  const threshold = SNAP_PIXEL_THRESHOLD / safeScale

  // Source-app v2.4.2: "Reduced the number of snap points when zoomed out,
  // making small shapes easier to view and manipulate." Below ~0.5x zoom we
  // suppress dense candidates (mid/quarter/control/tangent) and below ~0.2x
  // we also drop endpoints of shapes whose screen-space size is too small to
  // be usefully picked.
  const suppressDenseCandidates = safeScale < 0.5
  const aggressiveSmallShapeFilter = safeScale < 0.2
  const minScreenSizePx = 8
  const shapeIsTooSmall = (shape: Shape): boolean => {
    if (!aggressiveSmallShapeFilter) return false
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const considerPoint = (p: Point) => {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    considerPoint(shape.start)
    considerPoint(shape.end)
    if (shape.type === 'arc') considerPoint(shape.mid)
    if (shape.type === 'bezier') considerPoint(shape.control)
    const widthScreen = (maxX - minX) * safeScale
    const heightScreen = (maxY - minY) * safeScale
    return Math.max(widthScreen, heightScreen) < minScreenSizePx
  }

  const registerCandidate = (candidate: Point, reason: string) => {
    const nextDistance = distance(point, candidate)
    if (nextDistance <= threshold && nextDistance < best.distance) {
      best = { point: candidate, distance: nextDistance, reason }
    }
  }

  if (settings.endpoints) {
    for (const shape of context.shapes) {
      if (shapeIsTooSmall(shape)) continue
      registerCandidate(shape.start, 'endpoint')
      registerCandidate(shape.end, 'endpoint')
    }
  }

  if (!suppressDenseCandidates && (settings.midpoints || settings.quarterPoints)) {
    for (const shape of context.shapes) {
      if (shapeIsTooSmall(shape)) continue
      if (shape.type === 'line') {
        const mid = {
          x: (shape.start.x + shape.end.x) / 2,
          y: (shape.start.y + shape.end.y) / 2,
        }
        if (settings.midpoints) {
          registerCandidate(mid, 'midpoint')
        }
        if (settings.quarterPoints) {
          registerCandidate(
            { x: (shape.start.x + mid.x) / 2, y: (shape.start.y + mid.y) / 2 },
            'quarter',
          )
          registerCandidate(
            { x: (shape.end.x + mid.x) / 2, y: (shape.end.y + mid.y) / 2 },
            'quarter',
          )
        }
      } else if (shape.type === 'arc') {
        if (settings.midpoints) {
          registerCandidate(shape.mid, 'midpoint')
        }
      } else if (shape.type === 'bezier') {
        const t50 = {
          x: 0.25 * shape.start.x + 0.5 * shape.control.x + 0.25 * shape.end.x,
          y: 0.25 * shape.start.y + 0.5 * shape.control.y + 0.25 * shape.end.y,
        }
        if (settings.midpoints) {
          registerCandidate(t50, 'midpoint')
          registerCandidate(shape.control, 'control')
        }
        if (settings.quarterPoints) {
          const t25 = {
            x: 0.5625 * shape.start.x + 0.375 * shape.control.x + 0.0625 * shape.end.x,
            y: 0.5625 * shape.start.y + 0.375 * shape.control.y + 0.0625 * shape.end.y,
          }
          const t75 = {
            x: 0.0625 * shape.start.x + 0.375 * shape.control.x + 0.5625 * shape.end.x,
            y: 0.0625 * shape.start.y + 0.375 * shape.control.y + 0.5625 * shape.end.y,
          }
          registerCandidate(t25, 'quarter')
          registerCandidate(t75, 'quarter')
        }
      } else if (settings.midpoints) {
        registerCandidate(
          {
            x: (shape.start.x + shape.end.x) / 2,
            y: (shape.start.y + shape.end.y) / 2,
          },
          'midpoint',
        )
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

  if (context.customSnapPoints) {
    for (const custom of context.customSnapPoints) {
      registerCandidate(custom, 'custom')
    }
  }

  if (context.mandalaIntersections) {
    for (const candidate of context.mandalaIntersections) {
      registerCandidate(candidate, 'mandala')
    }
  }

  // Source `chkTangentCircleMode` — when on, scatter perimeter samples around
  // every arc as snap candidates so the line/circle tool naturally lands on
  // common tangent positions.
  if (!suppressDenseCandidates && context.tangentCircleMode) {
    const dispStep = Math.max(2, Math.min(64, context.tangentCircleDispStep ?? 6))
    for (const shape of context.shapes) {
      if (shape.type !== 'arc') continue
      const circle = circleFromArc(shape)
      if (!circle) continue
      for (let index = 0; index < dispStep; index += 1) {
        const theta = (index / dispStep) * Math.PI * 2
        registerCandidate(
          {
            x: circle.center.x + circle.radius * Math.cos(theta),
            y: circle.center.y + circle.radius * Math.sin(theta),
          },
          'tangent-circle',
        )
      }
    }
  }

  if (!suppressDenseCandidates && settings.endpoints && context.draftAnchor) {
    const anchor = context.draftAnchor
    for (const shape of context.shapes) {
      if (shape.type !== 'arc') continue
      const circle = circleFromArc(shape)
      if (!circle) continue
      const dx = circle.center.x - anchor.x
      const dy = circle.center.y - anchor.y
      const d = Math.hypot(dx, dy)
      if (d <= circle.radius + 1e-6) continue
      const phi = Math.atan2(dy, dx)
      const alpha = Math.acos(circle.radius / d)
      for (const sign of [1, -1] as const) {
        const theta = phi + sign * (Math.PI - alpha)
        registerCandidate(
          {
            x: circle.center.x + circle.radius * Math.cos(theta),
            y: circle.center.y + circle.radius * Math.sin(theta),
          },
          'tangent',
        )
      }
    }
  }

  if (!best.reason && settings.grid) {
    const safeStep = Math.max(0.1, settings.gridStep)
    registerCandidate(
      {
        x: Math.round(point.x / safeStep) * safeStep,
        y: Math.round(point.y / safeStep) * safeStep,
      },
      'grid',
    )
  }

  return {
    point: best.point,
    reason: best.reason,
  }
}

function circleFromArc(arc: { start: Point; mid: Point; end: Point }) {
  const x1 = arc.start.x
  const y1 = arc.start.y
  const x2 = arc.mid.x
  const y2 = arc.mid.y
  const x3 = arc.end.x
  const y3 = arc.end.y
  const denom = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
  if (Math.abs(denom) < 1e-10) return null
  const x1Sq = x1 * x1 + y1 * y1
  const x2Sq = x2 * x2 + y2 * y2
  const x3Sq = x3 * x3 + y3 * y3
  const cx = (x1Sq * (y2 - y3) + x2Sq * (y3 - y1) + x3Sq * (y1 - y2)) / denom
  const cy = (x1Sq * (x3 - x2) + x2Sq * (x1 - x3) + x3Sq * (x2 - x1)) / denom
  const radius = Math.hypot(x1 - cx, y1 - cy)
  return { center: { x: cx, y: cy }, radius }
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
