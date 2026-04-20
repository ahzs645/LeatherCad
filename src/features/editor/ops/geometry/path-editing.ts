import type { Point, Shape, LineShape, ArcShape, BezierShape } from '../../cad/cad-types'
import { distance, uid, round } from '../../cad/cad-geometry'
import {
  TAU,
  angleBetweenCcw,
  circleThroughThreePoints,
  copyShapeProps,
  evalQuadBezier,
  evaluateShapeAt,
} from './path-core'

// ---------------------------------------------------------------------------
// 1. convertArcToBezier
// ---------------------------------------------------------------------------

export function convertArcToBezier(arc: ArcShape): BezierShape[] {
  const circle = circleThroughThreePoints(arc.start, arc.mid, arc.end)
  if (!circle) {
    // Degenerate arc – return a single bezier with mid as control
    return [
      {
        id: uid(),
        type: 'bezier',
        ...copyShapeProps(arc),
        start: { ...arc.start },
        control: { ...arc.mid },
        end: { ...arc.end },
      },
    ]
  }

  const { center, radius } = circle

  const startAngle = Math.atan2(
    arc.start.y - center.y,
    arc.start.x - center.x,
  )
  const midAngle = Math.atan2(arc.mid.y - center.y, arc.mid.x - center.x)
  const endAngle = Math.atan2(arc.end.y - center.y, arc.end.x - center.x)

  // Determine sweep direction
  const isCcw = angleBetweenCcw(startAngle, midAngle, endAngle)
  const ccwDelta = ((endAngle - startAngle) % TAU + TAU) % TAU
  const totalSweep = isCcw ? ccwDelta : -(TAU - ccwDelta)
  const absSweep = Math.abs(totalSweep)

  // Decide number of segments: <=90° → 1, <=180° → 2, <=270° → 3, else 4
  let segCount: number
  if (absSweep <= Math.PI / 2 + 1e-9) segCount = 1
  else if (absSweep <= Math.PI + 1e-9) segCount = 2
  else if (absSweep <= (3 * Math.PI) / 2 + 1e-9) segCount = 3
  else segCount = 4

  const segSweep = totalSweep / segCount
  const results: BezierShape[] = []

  for (let i = 0; i < segCount; i++) {
    const a0 = startAngle + segSweep * i
    const a1 = startAngle + segSweep * (i + 1)

    const segStart: Point = {
      x: round(center.x + Math.cos(a0) * radius),
      y: round(center.y + Math.sin(a0) * radius),
    }
    const segEnd: Point = {
      x: round(center.x + Math.cos(a1) * radius),
      y: round(center.y + Math.sin(a1) * radius),
    }

    // Control point for quadratic bezier approximation of circular arc:
    // intersection of tangent lines at start and end of the sub-arc.
    // For a quadratic bezier: control = intersection of tangents.
    // Tangent at angle a on circle is perpendicular to the radius.
    // The control point lies at distance r / cos(halfAngle) from center
    // along the angle bisector.
    const halfAngle = (a1 - a0) / 2
    const midA = (a0 + a1) / 2
    const controlDist = radius / Math.cos(halfAngle)

    const controlPoint: Point = {
      x: round(center.x + Math.cos(midA) * controlDist),
      y: round(center.y + Math.sin(midA) * controlDist),
    }

    results.push({
      id: uid(),
      type: 'bezier',
      ...copyShapeProps(arc),
      start: segStart,
      control: controlPoint,
      end: segEnd,
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// 2. makeBezierCpFlat
// ---------------------------------------------------------------------------

export function makeBezierCpFlat(
  bezier: BezierShape,
  adjacentBezier: BezierShape,
  sharedPoint: 'start' | 'end',
): BezierShape {
  // The shared endpoint on adjacentBezier
  const shared =
    sharedPoint === 'start' ? adjacentBezier.start : adjacentBezier.end
  // The opposite endpoint on the reference bezier that connects at the shared point
  const oppositeOnBezier =
    sharedPoint === 'start' ? bezier.end : bezier.start
  // The control point we want to adjust on adjacentBezier
  const currentCp = adjacentBezier.control
  const cpDist = distance(shared, currentCp)

  // Direction from oppositeOnBezier through shared
  const dx = shared.x - oppositeOnBezier.x
  const dy = shared.y - oppositeOnBezier.y
  const dirLen = Math.hypot(dx, dy)
  if (dirLen < 1e-10) return { ...adjacentBezier }

  const nx = dx / dirLen
  const ny = dy / dirLen

  const newCp: Point = {
    x: round(shared.x + nx * cpDist),
    y: round(shared.y + ny * cpDist),
  }

  return { ...adjacentBezier, control: newCp }
}

// ---------------------------------------------------------------------------
// 3. makeBezierCpSameLength
// ---------------------------------------------------------------------------

export function makeBezierCpSameLength(
  bezier: BezierShape,
  adjacentBezier: BezierShape,
  sharedPoint: 'start' | 'end',
): BezierShape {
  const shared =
    sharedPoint === 'start' ? adjacentBezier.start : adjacentBezier.end
  const oppositeOnBezier =
    sharedPoint === 'start' ? bezier.end : bezier.start
  // Use bezier's control point distance from the shared point
  const bezierCp = bezier.control
  const targetDist = distance(shared, bezierCp)

  const dx = shared.x - oppositeOnBezier.x
  const dy = shared.y - oppositeOnBezier.y
  const dirLen = Math.hypot(dx, dy)
  if (dirLen < 1e-10) return { ...adjacentBezier }

  const nx = dx / dirLen
  const ny = dy / dirLen

  const newCp: Point = {
    x: round(shared.x + nx * targetDist),
    y: round(shared.y + ny * targetDist),
  }

  return { ...adjacentBezier, control: newCp }
}

// ---------------------------------------------------------------------------
// 4. makeBezierCpSymmetric
// ---------------------------------------------------------------------------

export function makeBezierCpSymmetric(
  bezier: BezierShape,
  adjacentBezier: BezierShape,
  sharedPoint: 'start' | 'end',
): BezierShape {
  const shared =
    sharedPoint === 'start' ? adjacentBezier.start : adjacentBezier.end
  const bezierCp = bezier.control

  // Mirror bezier's control point through the shared point
  const newCp: Point = {
    x: round(2 * shared.x - bezierCp.x),
    y: round(2 * shared.y - bezierCp.y),
  }

  return { ...adjacentBezier, control: newCp }
}

// ---------------------------------------------------------------------------
// Split a bezier at parameter t using de Casteljau's algorithm
// ---------------------------------------------------------------------------

/**
 * Split a quadratic Bezier at parameter t∈(0,1) using de Casteljau's algorithm.
 * Returns two new BezierShapes that together reproduce the original curve.
 */
export function splitBezierAtT(bezier: BezierShape, t: number): [BezierShape, BezierShape] | null {
  if (!Number.isFinite(t) || t <= 1e-6 || t >= 1 - 1e-6) return null
  const P0 = bezier.start
  const P1 = bezier.control
  const P2 = bezier.end
  const Q0 = { x: P0.x + (P1.x - P0.x) * t, y: P0.y + (P1.y - P0.y) * t }
  const Q1 = { x: P1.x + (P2.x - P1.x) * t, y: P1.y + (P2.y - P1.y) * t }
  const R = { x: Q0.x + (Q1.x - Q0.x) * t, y: Q0.y + (Q1.y - Q0.y) * t }
  const roundPoint = (p: Point): Point => ({ x: round(p.x), y: round(p.y) })
  return [
    {
      ...bezier,
      id: uid(),
      start: roundPoint(P0),
      control: roundPoint(Q0),
      end: roundPoint(R),
    },
    {
      ...bezier,
      id: uid(),
      start: roundPoint(R),
      control: roundPoint(Q1),
      end: roundPoint(P2),
    },
  ]
}

/**
 * Find the parameter t on a bezier closest to the given world point, within
 * optional tolerance in mm.
 */
export function findBezierTNearestPoint(bezier: BezierShape, point: Point, samples = 200): number {
  let bestT = 0
  let bestDist = Number.POSITIVE_INFINITY
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const p = evalQuadBezier(bezier.start, bezier.control, bezier.end, t)
    const d = Math.hypot(p.x - point.x, p.y - point.y)
    if (d < bestDist) {
      bestDist = d
      bestT = t
    }
  }
  return bestT
}

// ---------------------------------------------------------------------------
// Notching (Kama) — stamp a V-notch at a point along the shape
// ---------------------------------------------------------------------------

/**
 * Build a V-notch at parameter t on the supplied shape. The V is two LineShapes
 * that meet at an apex perpendicular to the path, pointing "outward" in the
 * normal direction. Depth and width are in mm.
 */
export function buildNotchOnShape(
  shape: Shape,
  t: number,
  depthMm: number,
  widthMm: number,
  props: { layerId: string; lineTypeId: string; groupId?: string },
): LineShape[] {
  if (shape.type === 'text') return []
  const clampedT = Math.max(0.01, Math.min(0.99, t))
  const center = evaluateShapeAt(shape, clampedT)
  const eps = 0.005
  const before = evaluateShapeAt(shape, Math.max(0, clampedT - eps))
  const after = evaluateShapeAt(shape, Math.min(1, clampedT + eps))
  const dx = after.x - before.x
  const dy = after.y - before.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-8) return []
  const tangent = { x: dx / len, y: dy / len }
  const normal = { x: -tangent.y, y: tangent.x }
  const halfWidth = Math.max(0.2, widthMm / 2)
  const depth = Math.max(0.1, depthMm)
  const leftBase = { x: center.x - tangent.x * halfWidth, y: center.y - tangent.y * halfWidth }
  const rightBase = { x: center.x + tangent.x * halfWidth, y: center.y + tangent.y * halfWidth }
  const apex = { x: center.x + normal.x * depth, y: center.y + normal.y * depth }

  return [
    {
      id: uid(),
      type: 'line',
      layerId: props.layerId,
      lineTypeId: props.lineTypeId,
      groupId: props.groupId,
      start: { x: round(leftBase.x), y: round(leftBase.y) },
      end: { x: round(apex.x), y: round(apex.y) },
    },
    {
      id: uid(),
      type: 'line',
      layerId: props.layerId,
      lineTypeId: props.lineTypeId,
      groupId: props.groupId,
      start: { x: round(apex.x), y: round(apex.y) },
      end: { x: round(rightBase.x), y: round(rightBase.y) },
    },
  ]
}

// ---------------------------------------------------------------------------
// Convert to Path (actConvertToPath / actConvertACopyToPath)
// ---------------------------------------------------------------------------

/**
 * Convert a shape into one or more Bezier curves. Lines become a single
 * degenerate Bezier whose control is the segment midpoint. Arcs use the
 * existing arc→bezier converter. Text shapes are returned unchanged.
 */
export function convertShapeToPathBeziers(shape: Shape): Shape[] {
  if (shape.type === 'bezier') return [shape]
  if (shape.type === 'arc') return convertArcToBezier(shape)
  if (shape.type === 'line') {
    const midpoint: Point = {
      x: (shape.start.x + shape.end.x) / 2,
      y: (shape.start.y + shape.end.y) / 2,
    }
    return [
      {
        id: uid(),
        type: 'bezier',
        layerId: shape.layerId,
        lineTypeId: shape.lineTypeId,
        groupId: shape.groupId,
        start: { x: shape.start.x, y: shape.start.y },
        control: midpoint,
        end: { x: shape.end.x, y: shape.end.y },
      },
    ]
  }
  return [shape]
}

// ---------------------------------------------------------------------------
// Distance Marking (actDistMarking — stamp ticks along a path)
// ---------------------------------------------------------------------------

/** Approximate arc length of a shape from t=0 to t=tEnd using simple chord sums. */
function shapeArcLengthToT(shape: Shape, tEnd: number, samples = 200): number {
  if (shape.type === 'line' || shape.type === 'text') {
    return distance(shape.start, shape.end) * Math.max(0, Math.min(1, tEnd))
  }
  const steps = Math.max(4, Math.floor(samples * Math.max(0.05, tEnd)))
  let total = 0
  let previous = evaluateShapeAt(shape, 0)
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * tEnd
    const current = evaluateShapeAt(shape, t)
    total += distance(previous, current)
    previous = current
  }
  return total
}

function shapeTotalArcLength(shape: Shape): number {
  return shapeArcLengthToT(shape, 1)
}

function findTForArcLength(shape: Shape, targetLengthMm: number, samples = 400): number {
  if (shape.type === 'line' || shape.type === 'text') {
    const total = distance(shape.start, shape.end)
    if (total < 1e-8) return 0
    return Math.max(0, Math.min(1, targetLengthMm / total))
  }
  let accumulated = 0
  let previous = evaluateShapeAt(shape, 0)
  for (let i = 1; i <= samples; i++) {
    const t = i / samples
    const current = evaluateShapeAt(shape, t)
    const segLen = distance(previous, current)
    if (accumulated + segLen >= targetLengthMm) {
      const needed = targetLengthMm - accumulated
      const tPrev = (i - 1) / samples
      const ratio = segLen > 1e-8 ? needed / segLen : 0
      return tPrev + (t - tPrev) * ratio
    }
    accumulated += segLen
    previous = current
  }
  return 1
}

/** Estimate tangent direction at parameter t on a shape. */
function shapeTangentAt(shape: Shape, t: number): { x: number; y: number } {
  const eps = 1e-3
  const t1 = Math.max(0, t - eps)
  const t2 = Math.min(1, t + eps)
  const p1 = evaluateShapeAt(shape, t1)
  const p2 = evaluateShapeAt(shape, t2)
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-8) return { x: 1, y: 0 }
  return { x: dx / len, y: dy / len }
}

/**
 * Build small perpendicular tick marks at specified distances along a shape.
 * Returns an empty array when any distance is out of range.
 */
export function buildDistanceMarks(
  shape: Shape,
  distancesMm: number[],
  props: { layerId: string; lineTypeId: string; tickLengthMm?: number; groupId?: string },
): LineShape[] {
  if (shape.type === 'text') return []
  const totalLength = shapeTotalArcLength(shape)
  if (totalLength < 1e-6) return []
  const tickLength = Math.max(0.5, props.tickLengthMm ?? 3)
  const marks: LineShape[] = []
  for (const d of distancesMm) {
    if (!Number.isFinite(d) || d < 0 || d > totalLength + 1e-6) {
      continue
    }
    const t = findTForArcLength(shape, d)
    const point = evaluateShapeAt(shape, t)
    const tangent = shapeTangentAt(shape, t)
    const normal = { x: -tangent.y, y: tangent.x }
    const half = tickLength / 2
    marks.push({
      id: uid(),
      type: 'line',
      layerId: props.layerId,
      lineTypeId: props.lineTypeId,
      groupId: props.groupId,
      start: { x: round(point.x - normal.x * half), y: round(point.y - normal.y * half) },
      end: { x: round(point.x + normal.x * half), y: round(point.y + normal.y * half) },
    })
  }
  return marks
}

export { shapeTotalArcLength }
