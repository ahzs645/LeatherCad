import type { ArcShape, BezierShape, LineShape, Point, Shape } from '../../cad/cad-types'
import { distance, round } from '../../cad/cad-geometry'

export const TAU = Math.PI * 2

export function circleThroughThreePoints(
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

export function normalizeAngle(angle: number): number {
  return ((angle % TAU) + TAU) % TAU
}

export function angleBetweenCcw(start: number, mid: number, end: number): boolean {
  const s = normalizeAngle(start)
  const m = normalizeAngle(mid)
  const e = normalizeAngle(end)
  if (s <= e) {
    return m >= s && m <= e
  }
  return m >= s || m <= e
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

export function evalQuadBezier(
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

export function evaluateShapeAt(shape: Shape, t: number): Point {
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
  return lerpPoint(shape.start, shape.end, t)
}

export function sampleShapeWithParams(
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

export function copyShapeProps(
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

export function roundPoint(point: Point): Point {
  return { x: round(point.x), y: round(point.y) }
}
