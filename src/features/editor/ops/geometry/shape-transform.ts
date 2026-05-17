import type { Point, Shape, LineShape, BezierShape } from '../../cad/cad-types'
import { uid, round } from '../../cad/cad-geometry'
import { copyShapeProps, evaluateShapeAt } from './path-core'

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
 * points from the supplied shapes. Uses a convex hull by default. When
 * `marginMm` is positive, the hull is offset outward by that distance
 * (source-app v1.3.7 "specify a margin when drawing boundary").
 */
export function buildBoundaryLines(
  shapes: Shape[],
  props: { layerId: string; lineTypeId: string; groupId?: string; marginMm?: number },
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

  const margin = typeof props.marginMm === 'number' && Number.isFinite(props.marginMm) ? props.marginMm : 0
  let outline = hull
  if (margin > 0) {
    // Approximate an outward offset by pushing each vertex along the average
    // outward normal of its two adjacent hull edges (sufficient for convex
    // polygons since interior angles are <= 180°).
    const n = hull.length
    const offsetVertices: Point[] = []
    for (let i = 0; i < n; i++) {
      const prev = hull[(i - 1 + n) % n]
      const curr = hull[i]
      const next = hull[(i + 1) % n]
      const e1x = curr.x - prev.x
      const e1y = curr.y - prev.y
      const e2x = next.x - curr.x
      const e2y = next.y - curr.y
      // Outward normal for a CCW hull: rotate edge +90° (perpendicular).
      const n1x = -e1y
      const n1y = e1x
      const n2x = -e2y
      const n2y = e2x
      const len1 = Math.hypot(n1x, n1y) || 1
      const len2 = Math.hypot(n2x, n2y) || 1
      const avgX = n1x / len1 + n2x / len2
      const avgY = n1y / len1 + n2y / len2
      const avgLen = Math.hypot(avgX, avgY) || 1
      offsetVertices.push({
        x: curr.x + (avgX / avgLen) * margin,
        y: curr.y + (avgY / avgLen) * margin,
      })
    }
    outline = offsetVertices
  }

  const lines: LineShape[] = []
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % outline.length]
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
