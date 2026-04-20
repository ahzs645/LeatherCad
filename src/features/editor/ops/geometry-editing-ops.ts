import type { Point, Shape, LineShape, ArcShape, BezierShape } from '../cad/cad-types'
import { distance, uid, round } from '../cad/cad-geometry'

const TAU = Math.PI * 2

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function circleThroughThreePoints(
  p1: Point,
  p2: Point,
  p3: Point,
): { center: Point; radius: number } | null {
  const x1 = p1.x
  const y1 = p1.y
  const x2 = p2.x
  const y2 = p2.y
  const x3 = p3.x
  const y3 = p3.y

  const denominator =
    2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
  if (Math.abs(denominator) < 1e-10) return null

  const x1Sq = x1 * x1 + y1 * y1
  const x2Sq = x2 * x2 + y2 * y2
  const x3Sq = x3 * x3 + y3 * y3

  const cx =
    (x1Sq * (y2 - y3) + x2Sq * (y3 - y1) + x3Sq * (y1 - y2)) / denominator
  const cy =
    (x1Sq * (x3 - x2) + x2Sq * (x1 - x3) + x3Sq * (x2 - x1)) / denominator

  return { center: { x: cx, y: cy }, radius: distance({ x: cx, y: cy }, p1) }
}

function normalizeAngle(a: number): number {
  return ((a % TAU) + TAU) % TAU
}

function angleBetweenCcw(start: number, mid: number, end: number): boolean {
  const s = normalizeAngle(start)
  const m = normalizeAngle(mid)
  const e = normalizeAngle(end)
  if (s <= e) {
    return m >= s && m <= e
  }
  return m >= s || m <= e
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

/** Evaluate a quadratic bezier at parameter t. */
function evalQuadBezier(
  start: Point,
  control: Point,
  end: Point,
  t: number,
): Point {
  const u = 1 - t
  return {
    x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
  }
}

/** Sample a shape into an array of { point, t } pairs. */
function sampleShapeWithParams(
  shape: Shape,
  segments: number,
): Array<{ point: Point; t: number }> {
  const result: Array<{ point: Point; t: number }> = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    result.push({ point: evaluateShapeAt(shape, t), t })
  }
  return result
}

/** Evaluate any geometric shape at parameter t in [0,1]. */
function evaluateShapeAt(shape: Shape, t: number): Point {
  if (shape.type === 'line') {
    return lerpPoint(shape.start, shape.end, t)
  }
  if (shape.type === 'bezier') {
    return evalQuadBezier(shape.start, shape.control, shape.end, t)
  }
  if (shape.type === 'arc') {
    const circle = circleThroughThreePoints(shape.start, shape.mid, shape.end)
    if (!circle) return lerpPoint(shape.start, shape.end, t)

    const startAngle = Math.atan2(
      shape.start.y - circle.center.y,
      shape.start.x - circle.center.x,
    )
    const midAngle = Math.atan2(
      shape.mid.y - circle.center.y,
      shape.mid.x - circle.center.x,
    )
    const endAngle = Math.atan2(
      shape.end.y - circle.center.y,
      shape.end.x - circle.center.x,
    )

    const ccwStartEnd = ((endAngle - startAngle) % TAU + TAU) % TAU
    const ccwStartMid = ((midAngle - startAngle) % TAU + TAU) % TAU
    const isCcw = ccwStartMid <= ccwStartEnd
    const sweep = isCcw ? ccwStartEnd : -(TAU - ccwStartEnd)

    const angle = startAngle + sweep * t
    return {
      x: circle.center.x + Math.cos(angle) * circle.radius,
      y: circle.center.y + Math.sin(angle) * circle.radius,
    }
  }
  // text shapes: return start as fallback
  return lerpPoint(shape.start, shape.end, t)
}

function copyShapeProps(
  source: ArcShape | BezierShape | LineShape,
): {
  layerId: string
  lineTypeId: string
  groupId: string | undefined
} {
  return {
    layerId: source.layerId,
    lineTypeId: source.lineTypeId,
    groupId: source.groupId,
  }
}

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
// 5. lineLineIntersection
// ---------------------------------------------------------------------------

export function lineLineIntersection(
  a: LineShape,
  b: LineShape,
): Point | null {
  const x1 = a.start.x
  const y1 = a.start.y
  const x2 = a.end.x
  const y2 = a.end.y
  const x3 = b.start.x
  const y3 = b.start.y
  const x4 = b.end.x
  const y4 = b.end.y

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-10) return null

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null

  return {
    x: round(x1 + t * (x2 - x1)),
    y: round(y1 + t * (y2 - y1)),
  }
}

// ---------------------------------------------------------------------------
// 6. extendLineToShape
// ---------------------------------------------------------------------------

export function extendLineToShape(
  line: LineShape,
  target: Shape,
  extend: 'start' | 'end',
): LineShape | null {
  if (target.type === 'text') return null

  const lx1 = line.start.x
  const ly1 = line.start.y
  const lx2 = line.end.x
  const ly2 = line.end.y
  const ldx = lx2 - lx1
  const ldy = ly2 - ly1

  if (target.type === 'line') {
    // Extend line to infinite and intersect with target segment
    const x3 = target.start.x
    const y3 = target.start.y
    const x4 = target.end.x
    const y4 = target.end.y

    const denom = ldx * (y3 - y4) - ldy * (x3 - x4)
    if (Math.abs(denom) < 1e-10) return null

    const t =
      ((lx1 - x3) * (y3 - y4) - (ly1 - y3) * (x3 - x4)) / denom
    const u =
      -((ldx) * (ly1 - y3) - (ldy) * (lx1 - x3)) / denom

    // u must be on the target segment
    if (u < -1e-9 || u > 1 + 1e-9) return null

    // t determines if the intersection is on the correct extension side
    if (extend === 'end' && t < -1e-9) return null
    if (extend === 'start' && t > 1 + 1e-9) return null

    const ix = round(lx1 + t * ldx)
    const iy = round(ly1 + t * ldy)

    return {
      ...line,
      start: extend === 'start' ? { x: ix, y: iy } : line.start,
      end: extend === 'end' ? { x: ix, y: iy } : line.end,
    }
  }

  // For arc/bezier: sample target and find nearest intersection with extended line
  const samples = sampleShapeWithParams(target, 100)
  let bestDist = Infinity
  let bestPoint: Point | null = null

  for (let i = 0; i < samples.length - 1; i++) {
    const p1 = samples[i].point
    const p2 = samples[i + 1].point

    const sx = p2.x - p1.x
    const sy = p2.y - p1.y

    const denom = ldx * sy - ldy * sx
    if (Math.abs(denom) < 1e-10) continue

    const t =
      ((p1.x - lx1) * sy - (p1.y - ly1) * sx) / denom
    const u =
      ((p1.x - lx1) * ldy - (p1.y - ly1) * ldx) / denom

    if (u < -0.01 || u > 1.01) continue
    if (extend === 'end' && t < -1e-9) continue
    if (extend === 'start' && t > 1 + 1e-9) continue

    const ix = lx1 + t * ldx
    const iy = ly1 + t * ldy
    const extendPt = extend === 'start' ? line.start : line.end
    const d = distance({ x: ix, y: iy }, extendPt)

    if (d < bestDist) {
      bestDist = d
      bestPoint = { x: round(ix), y: round(iy) }
    }
  }

  if (!bestPoint) return null

  return {
    ...line,
    start: extend === 'start' ? bestPoint : line.start,
    end: extend === 'end' ? bestPoint : line.end,
  }
}

// ---------------------------------------------------------------------------
// 7. trimShapeAtPoint
// ---------------------------------------------------------------------------

export function trimShapeAtPoint(
  shape: Shape,
  cutPoint: Point,
  keepSide: 'start' | 'end',
): Shape {
  if (shape.type === 'text') return { ...shape }

  if (shape.type === 'line') {
    if (keepSide === 'start') {
      return { ...shape, end: { x: round(cutPoint.x), y: round(cutPoint.y) } }
    }
    return { ...shape, start: { x: round(cutPoint.x), y: round(cutPoint.y) } }
  }

  // For bezier and arc: find parameter t closest to cutPoint
  const segments = 200
  let bestT = 0
  let bestDist = Infinity

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const pt = evaluateShapeAt(shape, t)
    const d = distance(pt, cutPoint)
    if (d < bestDist) {
      bestDist = d
      bestT = t
    }
  }

  if (shape.type === 'bezier') {
    // De Casteljau subdivision at bestT
    const { start, control, end } = shape
    const m0 = lerpPoint(start, control, bestT)
    const m1 = lerpPoint(control, end, bestT)
    const split = lerpPoint(m0, m1, bestT)
    const splitRounded: Point = { x: round(split.x), y: round(split.y) }

    if (keepSide === 'start') {
      return {
        ...shape,
        start: { ...shape.start },
        control: { x: round(m0.x), y: round(m0.y) },
        end: splitRounded,
      }
    }
    return {
      ...shape,
      start: splitRounded,
      control: { x: round(m1.x), y: round(m1.y) },
      end: { ...shape.end },
    }
  }

  // Arc subdivision at bestT
  const circle = circleThroughThreePoints(shape.start, shape.mid, shape.end)
  if (!circle) {
    // Fallback: treat as line-like
    if (keepSide === 'start') {
      return { ...shape, end: { x: round(cutPoint.x), y: round(cutPoint.y) } }
    }
    return { ...shape, start: { x: round(cutPoint.x), y: round(cutPoint.y) } }
  }

  const splitPt = evaluateShapeAt(shape, bestT)
  const splitRounded: Point = { x: round(splitPt.x), y: round(splitPt.y) }

  if (keepSide === 'start') {
    const midT = bestT / 2
    const newMid = evaluateShapeAt(shape, midT)
    return {
      ...shape,
      mid: { x: round(newMid.x), y: round(newMid.y) },
      end: splitRounded,
    }
  }
  const midT = (1 + bestT) / 2
  const newMid = evaluateShapeAt(shape, midT)
  return {
    ...shape,
    start: splitRounded,
    mid: { x: round(newMid.x), y: round(newMid.y) },
  }
}

// ---------------------------------------------------------------------------
// 8. mirrorPoint
// ---------------------------------------------------------------------------

export function mirrorPoint(
  point: Point,
  axisStart: Point,
  axisEnd: Point,
): Point {
  const dx = axisEnd.x - axisStart.x
  const dy = axisEnd.y - axisStart.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-10) return { ...point }

  // Project point onto the axis line
  const t =
    ((point.x - axisStart.x) * dx + (point.y - axisStart.y) * dy) / lenSq
  const projX = axisStart.x + t * dx
  const projY = axisStart.y + t * dy

  return {
    x: round(2 * projX - point.x),
    y: round(2 * projY - point.y),
  }
}

// ---------------------------------------------------------------------------
// 9. mirrorShape
// ---------------------------------------------------------------------------

export function mirrorShape(
  shape: Shape,
  axisStart: Point,
  axisEnd: Point,
): Shape {
  if (shape.type === 'line') {
    return {
      ...shape,
      id: uid(),
      type: 'line',
      start: mirrorPoint(shape.start, axisStart, axisEnd),
      end: mirrorPoint(shape.end, axisStart, axisEnd),
    }
  }

  if (shape.type === 'arc') {
    return {
      ...shape,
      id: uid(),
      type: 'arc',
      start: mirrorPoint(shape.start, axisStart, axisEnd),
      mid: mirrorPoint(shape.mid, axisStart, axisEnd),
      end: mirrorPoint(shape.end, axisStart, axisEnd),
    }
  }

  if (shape.type === 'bezier') {
    return {
      ...shape,
      id: uid(),
      type: 'bezier',
      start: mirrorPoint(shape.start, axisStart, axisEnd),
      control: mirrorPoint(shape.control, axisStart, axisEnd),
      end: mirrorPoint(shape.end, axisStart, axisEnd),
    }
  }

  // text
  return {
    ...shape,
    id: uid(),
    type: 'text',
    start: mirrorPoint(shape.start, axisStart, axisEnd),
    end: mirrorPoint(shape.end, axisStart, axisEnd),
  }
}

// ---------------------------------------------------------------------------
// 10. getBezierOffsetSupportLines
// ---------------------------------------------------------------------------

export function getBezierOffsetSupportLines(
  bezier: BezierShape,
): Array<{ start: Point; end: Point }> {
  return [
    { start: { ...bezier.start }, end: { ...bezier.control } },
    { start: { ...bezier.control }, end: { ...bezier.end } },
  ]
}

// ---------------------------------------------------------------------------
// 11. resizeShapeToDimensions
// ---------------------------------------------------------------------------

export function resizeShapeToDimensions(
  shape: Shape,
  newWidth: number,
  newHeight: number,
): Shape {
  // Collect all mutable points from the shape
  const points = getShapePointRefs(shape)
  if (points.length === 0) return { ...shape }

  // Compute current bounding box
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  const currentWidth = maxX - minX
  const currentHeight = maxY - minY
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  const scaleX = currentWidth > 1e-10 ? newWidth / currentWidth : 1
  const scaleY = currentHeight > 1e-10 ? newHeight / currentHeight : 1

  function scalePoint(p: Point): Point {
    return {
      x: round(centerX + (p.x - centerX) * scaleX),
      y: round(centerY + (p.y - centerY) * scaleY),
    }
  }

  if (shape.type === 'line') {
    return {
      ...shape,
      start: scalePoint(shape.start),
      end: scalePoint(shape.end),
    }
  }

  if (shape.type === 'arc') {
    return {
      ...shape,
      start: scalePoint(shape.start),
      mid: scalePoint(shape.mid),
      end: scalePoint(shape.end),
    }
  }

  if (shape.type === 'bezier') {
    return {
      ...shape,
      start: scalePoint(shape.start),
      control: scalePoint(shape.control),
      end: scalePoint(shape.end),
    }
  }

  // text
  return {
    ...shape,
    start: scalePoint(shape.start),
    end: scalePoint(shape.end),
  }
}

function getShapePointRefs(shape: Shape): Point[] {
  if (shape.type === 'line') return [shape.start, shape.end]
  if (shape.type === 'arc') return [shape.start, shape.mid, shape.end]
  if (shape.type === 'bezier') return [shape.start, shape.control, shape.end]
  return [shape.start, shape.end]
}

// ---------------------------------------------------------------------------
// 12. findNearestIntersection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Center-line between two lines/paths (actCenterLine)
// ---------------------------------------------------------------------------

function midpointOfShape(shape: Shape): Point {
  if (shape.type === 'arc') {
    return { x: shape.mid.x, y: shape.mid.y }
  }
  if (shape.type === 'bezier') {
    return evalQuadBezier(shape.start, shape.control, shape.end, 0.5)
  }
  return { x: (shape.start.x + shape.end.x) / 2, y: (shape.start.y + shape.end.y) / 2 }
}

/**
 * Construct a line between the midpoints of two input shapes. Caller provides the
 * layer and line-type context; the returned shape is a new LineShape with a fresh id.
 */
export function buildCenterLineBetween(
  first: Shape,
  second: Shape,
  props: { layerId: string; lineTypeId: string; groupId?: string },
): LineShape {
  const start = midpointOfShape(first)
  const end = midpointOfShape(second)
  return {
    id: uid(),
    type: 'line',
    layerId: props.layerId,
    lineTypeId: props.lineTypeId,
    groupId: props.groupId,
    start: { x: round(start.x), y: round(start.y) },
    end: { x: round(end.x), y: round(end.y) },
  }
}

// ---------------------------------------------------------------------------
// Edit line angle (actEditLineAngle)
// ---------------------------------------------------------------------------

/**
 * Rotate a line's endpoint so its direction matches the given angle (degrees,
 * CCW from +X). Start is held fixed; length is preserved.
 */
export function setLineAngle(line: LineShape, angleDeg: number): LineShape {
  const length = distance(line.start, line.end)
  const radians = (angleDeg * Math.PI) / 180
  return {
    ...line,
    end: {
      x: round(line.start.x + Math.cos(radians) * length),
      y: round(line.start.y + Math.sin(radians) * length),
    },
  }
}

export function getLineAngleDeg(line: LineShape): number {
  return (Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x) * 180) / Math.PI
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

// ---------------------------------------------------------------------------
// Chamfer / Fillet corner (actMentori — corner beveling)
// ---------------------------------------------------------------------------

function normalizeVector(vx: number, vy: number): { x: number; y: number } | null {
  const len = Math.hypot(vx, vy)
  if (len < 1e-9) return null
  return { x: vx / len, y: vy / len }
}

/**
 * Intersection of two infinite lines (no segment bounds). Returns null when the
 * lines are parallel.
 */
export function infiniteLineIntersection(a: LineShape, b: LineShape): Point | null {
  const x1 = a.start.x
  const y1 = a.start.y
  const x2 = a.end.x
  const y2 = a.end.y
  const x3 = b.start.x
  const y3 = b.start.y
  const x4 = b.end.x
  const y4 = b.end.y
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-10) return null
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }
}

export type FilletResult = {
  trimmedA: LineShape
  trimmedB: LineShape
  arc: ArcShape
}

/**
 * Round the corner where two lines meet (or would meet if extended) with a
 * tangent arc of the given radius. Returns null when the lines are parallel or
 * the radius is too large for the available line lengths.
 */
export function filletCorner(
  lineA: LineShape,
  lineB: LineShape,
  radiusMm: number,
): FilletResult | null {
  if (!Number.isFinite(radiusMm) || radiusMm <= 0) return null

  const corner = infiniteLineIntersection(lineA, lineB)
  if (!corner) return null

  // Pick the "near" endpoint on each line (closer to the corner) as the one to trim.
  const distAStart = distance(lineA.start, corner)
  const distAEnd = distance(lineA.end, corner)
  const awayA = distAStart >= distAEnd ? lineA.start : lineA.end
  const distBStart = distance(lineB.start, corner)
  const distBEnd = distance(lineB.end, corner)
  const awayB = distBStart >= distBEnd ? lineB.start : lineB.end

  const v1 = normalizeVector(awayA.x - corner.x, awayA.y - corner.y)
  const v2 = normalizeVector(awayB.x - corner.x, awayB.y - corner.y)
  if (!v1 || !v2) return null

  const dotProduct = v1.x * v2.x + v1.y * v2.y
  const clampedDot = Math.max(-1, Math.min(1, dotProduct))
  const angle = Math.acos(clampedDot)
  if (angle < 1e-3 || Math.abs(Math.PI - angle) < 1e-3) return null

  const trimDist = radiusMm / Math.tan(angle / 2)
  const maxTrim = Math.min(distance(awayA, corner), distance(awayB, corner))
  if (trimDist >= maxTrim - 1e-6) return null

  const trimA = { x: corner.x + v1.x * trimDist, y: corner.y + v1.y * trimDist }
  const trimB = { x: corner.x + v2.x * trimDist, y: corner.y + v2.y * trimDist }

  const bisector = normalizeVector(v1.x + v2.x, v1.y + v2.y)
  if (!bisector) return null
  const centerDist = radiusMm / Math.sin(angle / 2)
  const arcCenter = {
    x: corner.x + bisector.x * centerDist,
    y: corner.y + bisector.y * centerDist,
  }
  const arcMid = {
    x: arcCenter.x - bisector.x * radiusMm,
    y: arcCenter.y - bisector.y * radiusMm,
  }

  const roundPoint = (point: Point): Point => ({ x: round(point.x), y: round(point.y) })
  return {
    trimmedA: { ...lineA, start: roundPoint(awayA), end: roundPoint(trimA) },
    trimmedB: { ...lineB, start: roundPoint(awayB), end: roundPoint(trimB) },
    arc: {
      id: uid(),
      type: 'arc',
      layerId: lineA.layerId,
      lineTypeId: lineA.lineTypeId,
      groupId: lineA.groupId,
      start: roundPoint(trimA),
      mid: roundPoint(arcMid),
      end: roundPoint(trimB),
    },
  }
}

// ---------------------------------------------------------------------------
// Adjust length (actLengthAdjust — TfrmLengthAdjustDialog)
// ---------------------------------------------------------------------------

export function getLineLengthMm(line: LineShape): number {
  return distance(line.start, line.end)
}

/**
 * Rescale a line so its new length is `targetLengthMm`, holding `start` fixed.
 * Direction is preserved.
 */
export function setLineLength(line: LineShape, targetLengthMm: number): LineShape {
  if (!Number.isFinite(targetLengthMm) || targetLengthMm <= 0) {
    return line
  }
  const currentLength = getLineLengthMm(line)
  if (currentLength < 1e-8) {
    return line
  }
  const ratio = targetLengthMm / currentLength
  return {
    ...line,
    end: {
      x: round(line.start.x + (line.end.x - line.start.x) * ratio),
      y: round(line.start.y + (line.end.y - line.start.y) * ratio),
    },
  }
}

/**
 * Scale a line's length by a ratio (1.0 = unchanged), holding `start` fixed.
 */
export function scaleLineLengthByRatio(line: LineShape, ratio: number): LineShape {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return line
  }
  return {
    ...line,
    end: {
      x: round(line.start.x + (line.end.x - line.start.x) * ratio),
      y: round(line.start.y + (line.end.y - line.start.y) * ratio),
    },
  }
}

// ---------------------------------------------------------------------------
// Delete duplicates (actDeleteDuplicates)
// ---------------------------------------------------------------------------

function pointsCoincide(a: Point, b: Point, tolerance: number) {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance
}

/** True when two shapes have the same type and identical anchor points (within tolerance). */
export function shapesCoincide(a: Shape, b: Shape, tolerance = 0.01): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'line' && b.type === 'line') {
    const forward = pointsCoincide(a.start, b.start, tolerance) && pointsCoincide(a.end, b.end, tolerance)
    const reverse = pointsCoincide(a.start, b.end, tolerance) && pointsCoincide(a.end, b.start, tolerance)
    return forward || reverse
  }
  if (a.type === 'arc' && b.type === 'arc') {
    return (
      pointsCoincide(a.start, b.start, tolerance) &&
      pointsCoincide(a.mid, b.mid, tolerance) &&
      pointsCoincide(a.end, b.end, tolerance)
    )
  }
  if (a.type === 'bezier' && b.type === 'bezier') {
    return (
      pointsCoincide(a.start, b.start, tolerance) &&
      pointsCoincide(a.control, b.control, tolerance) &&
      pointsCoincide(a.end, b.end, tolerance)
    )
  }
  return false
}

/**
 * Remove shapes that coincide with earlier shapes in the array (keep the first,
 * drop subsequent duplicates). Returns { shapes, removedIds }.
 */
export function removeDuplicateShapes(
  shapes: Shape[],
  tolerance = 0.01,
): { shapes: Shape[]; removedIds: string[] } {
  const kept: Shape[] = []
  const removedIds: string[] = []
  for (const shape of shapes) {
    if (shape.type === 'text') {
      kept.push(shape)
      continue
    }
    const duplicate = kept.find((k) => shapesCoincide(shape, k, tolerance))
    if (duplicate) {
      removedIds.push(shape.id)
    } else {
      kept.push(shape)
    }
  }
  return { shapes: kept, removedIds }
}

// ---------------------------------------------------------------------------
// Split into N (actSplitIntoN)
// ---------------------------------------------------------------------------

/**
 * Split a shape into `count` sub-shapes at equal parameter spacing. Lines and
 * beziers yield lines/beziers accordingly; arcs are split into arc sub-shapes
 * that share the parent arc's circle. Text shapes are returned unchanged.
 */
export function splitShapeIntoN(
  shape: Shape,
  count: number,
): Shape[] {
  if (count < 2) return [shape]
  if (shape.type === 'text') return [shape]

  const segments: Shape[] = []
  const props = copyShapeProps(shape)
  for (let i = 0; i < count; i++) {
    const tStart = i / count
    const tEnd = (i + 1) / count
    const startPoint = evaluateShapeAt(shape, tStart)
    const endPoint = evaluateShapeAt(shape, tEnd)
    if (shape.type === 'line') {
      segments.push({
        id: uid(),
        type: 'line',
        layerId: props.layerId,
        lineTypeId: props.lineTypeId,
        groupId: props.groupId,
        start: { x: round(startPoint.x), y: round(startPoint.y) },
        end: { x: round(endPoint.x), y: round(endPoint.y) },
      })
    } else if (shape.type === 'arc') {
      const midPoint = evaluateShapeAt(shape, (tStart + tEnd) / 2)
      segments.push({
        id: uid(),
        type: 'arc',
        layerId: props.layerId,
        lineTypeId: props.lineTypeId,
        groupId: props.groupId,
        start: { x: round(startPoint.x), y: round(startPoint.y) },
        mid: { x: round(midPoint.x), y: round(midPoint.y) },
        end: { x: round(endPoint.x), y: round(endPoint.y) },
      })
    } else if (shape.type === 'bezier') {
      const midPoint = evaluateShapeAt(shape, (tStart + tEnd) / 2)
      segments.push({
        id: uid(),
        type: 'bezier',
        layerId: props.layerId,
        lineTypeId: props.lineTypeId,
        groupId: props.groupId,
        start: { x: round(startPoint.x), y: round(startPoint.y) },
        control: { x: round(midPoint.x), y: round(midPoint.y) },
        end: { x: round(endPoint.x), y: round(endPoint.y) },
      })
    }
  }
  return segments
}

// ---------------------------------------------------------------------------
// Boundary / convex hull (actDrawBoundary)
// ---------------------------------------------------------------------------

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/** Andrew's monotone-chain convex hull. Returns vertices in CCW order. */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 2) return points.slice()
  const sorted = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))

  const lower: Point[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: Point[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/**
 * Build a boundary polyline (as N connected LineShapes) around all sample
 * points from the supplied shapes. Uses a convex hull by default.
 */
export function buildBoundaryLines(
  shapes: Shape[],
  props: { layerId: string; lineTypeId: string; groupId?: string },
  samplesPerShape = 24,
): LineShape[] {
  const points: Point[] = []
  for (const shape of shapes) {
    for (let i = 0; i <= samplesPerShape; i++) {
      points.push(evaluateShapeAt(shape, i / samplesPerShape))
    }
  }
  const hull = convexHull(points)
  if (hull.length < 2) return []
  const lines: LineShape[] = []
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    lines.push({
      id: uid(),
      type: 'line',
      layerId: props.layerId,
      lineTypeId: props.lineTypeId,
      groupId: props.groupId,
      start: { x: round(a.x), y: round(a.y) },
      end: { x: round(b.x), y: round(b.y) },
    })
  }
  return lines
}

export function findNearestIntersection(
  shape: Shape,
  targets: Shape[],
): { point: Point; targetId: string; t: number } | null {
  if (shape.type === 'text') return null

  const SAMPLE_COUNT = 100
  const TOLERANCE = 0.5 // mm

  const shapeSamples = sampleShapeWithParams(shape, SAMPLE_COUNT)

  let bestResult: { point: Point; targetId: string; t: number } | null = null
  let bestDist = Infinity

  for (const target of targets) {
    if (target.type === 'text') continue

    const targetSamples = sampleShapeWithParams(target, SAMPLE_COUNT)

    for (const sSample of shapeSamples) {
      for (const tSample of targetSamples) {
        const d = distance(sSample.point, tSample.point)
        if (d < TOLERANCE && d < bestDist) {
          bestDist = d
          bestResult = {
            point: {
              x: round((sSample.point.x + tSample.point.x) / 2),
              y: round((sSample.point.y + tSample.point.y) / 2),
            },
            targetId: target.id,
            t: sSample.t,
          }
        }
      }
    }
  }

  return bestResult
}
