import type { ArcShape, BezierShape, LineShape, Point, Shape } from '../../cad/cad-types'

export type LcadRecord = Record<string, unknown>
export type ShapeBase = Pick<LineShape, 'id' | 'layerId' | 'lineTypeId' | 'groupId' | 'arrowStart' | 'arrowEnd' | 'strokeWidthOverride' | 'locked' | 'opacity'>
export const LCAD_CURVE_TOLERANCE_MM = 0.01

/** Exact degree elevation, shared by both modern and legacy adapters. */
export function quadraticToCubicPoints(start: Point, control: Point, end: Point): Point[] {
  return [start, { x: start.x + (2 * (control.x - start.x)) / 3, y: start.y + (2 * (control.y - start.y)) / 3 }, { x: end.x + (2 * (control.x - end.x)) / 3, y: end.y + (2 * (control.y - end.y)) / 3 }, end]
}

export function numberField(record: LcadRecord, key: string, fallback?: number): number {
  const value = record[key] ?? fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid .lcad ${key}: expected a finite number`)
  return value
}

export function recordValue(value: unknown, label: string): LcadRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid .lcad ${label}`)
  return value as LcadRecord
}

export function pointValue(value: unknown): Point {
  const point = recordValue(value, 'point')
  return { x: numberField(point, 'x'), y: numberField(point, 'y') }
}

export function linePoints(points: Point[], closed: boolean, base: ShapeBase): LineShape[] {
  const result: LineShape[] = []
  for (let index = 1; index < points.length; index += 1) {
    result.push({ ...base, id: `${base.id}:${index - 1}`, type: 'line', start: points[index - 1], end: points[index] })
  }
  if (closed && points.length > 2) result.push({ ...base, id: `${base.id}:close`, type: 'line', start: points[points.length - 1], end: points[0] })
  return result
}

export function circularArcs(cx: number, cy: number, radius: number, start: number, sweep: number, base: ShapeBase): ArcShape[] {
  if (!(radius > 0) || Math.abs(sweep) > Math.PI * 2 + 1e-8) throw new Error('Invalid .lcad circle/arc radius or sweep')
  const count = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-10))
  const at = (t: number) => ({ x: cx + radius * Math.cos(t), y: cy + radius * Math.sin(t) })
  return Array.from({ length: count }, (_, index) => {
    const a = start + (sweep * index) / count
    const b = start + (sweep * (index + 1)) / count
    return { ...base, id: `${base.id}:${index}`, arrowStart: index === 0 ? base.arrowStart : undefined, arrowEnd: index === count - 1 ? base.arrowEnd : undefined, type: 'arc', start: at(a), mid: at((a + b) / 2), end: at(b) }
  })
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Degree reduction with a convex-hull error bound, subdividing until <= 0.01 mm. */
export function cubicToQuadratics(points: Point[], base: ShapeBase): BezierShape[] {
  if (points.length < 4 || (points.length - 1) % 3 !== 0) throw new Error('Invalid .lcad cubic Bézier point chain')
  const result: BezierShape[] = []
  const append = (a: Point, b: Point, c: Point, d: Point, depth = 0) => {
    const control = { x: (3 * b.x + 3 * c.x - a.x - d.x) / 4, y: (3 * b.y + 3 * c.y - a.y - d.y) / 4 }
    const error = Math.max(
      Math.hypot(b.x - (a.x + 2 * control.x) / 3, b.y - (a.y + 2 * control.y) / 3),
      Math.hypot(c.x - (d.x + 2 * control.x) / 3, c.y - (d.y + 2 * control.y) / 3),
    )
    if (error <= LCAD_CURVE_TOLERANCE_MM) {
      result.push({ ...base, id: `${base.id}:${result.length}`, type: 'bezier', start: a, control, end: d })
      return
    }
    if (depth >= 12 || result.length >= 8192) throw new Error('.lcad curve exceeds the supported precision/complexity limit')
    const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d)
    const abc = midpoint(ab, bc), bcd = midpoint(bc, cd), center = midpoint(abc, bcd)
    append(a, ab, abc, center, depth + 1)
    append(center, bcd, cd, d, depth + 1)
  }
  for (let index = 0; index + 3 < points.length; index += 3) append(points[index], points[index + 1], points[index + 2], points[index + 3])
  for (let index = 0; index < result.length; index++) {
    result[index].arrowStart = index === 0 ? base.arrowStart : undefined
    result[index].arrowEnd = index === result.length - 1 ? base.arrowEnd : undefined
  }
  return result
}

export function primitiveShapes(source: LcadRecord, base: ShapeBase): Shape[] {
  const n = (key: string, fallback?: number) => numberField(source, key, fallback)
  if (['line', 'centerline', 'distance', 'stitch'].includes(String(source.type))) {
    return [{ ...base, type: 'line', start: { x: n('x1'), y: n('y1') }, end: { x: n('x2'), y: n('y2') } }]
  }
  if (source.type === 'rect') {
    const x = n('x'), y = n('y'), w = n('w'), h = n('h')
    return linePoints([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true, base)
  }
  if (source.type === 'circle') return circularArcs(n('cx'), n('cy'), n('r'), 0, Math.PI * 2, base)
  if (source.type === 'arc') {
    const start = n('startAngle'), end = n('endAngle')
    let sweep = (end - start) % (Math.PI * 2)
    if (source.ccw === true) { if (sweep >= 0) sweep -= Math.PI * 2 } else if (sweep <= 0) sweep += Math.PI * 2
    return circularArcs(n('cx'), n('cy'), n('r'), start, sweep, base)
  }
  if (source.type === 'ellipse') {
    const cx = n('cx'), cy = n('cy'), rx = n('rx'), ry = n('ry'), angle = n('rotation', 0)
    if (!(rx > 0 && ry > 0)) throw new Error('Invalid .lcad ellipse size')
    return [{ ...base, type: 'ellipse', center: { x: cx, y: cy }, radiusX: rx, radiusY: ry, rotationDeg: angle * 180 / Math.PI, startAngleDeg: 0, sweepDeg: 360 }]
  }
  if (source.type === 'bezier') {
    if (!Array.isArray(source.points)) throw new Error('Invalid .lcad Bézier points')
    const points = source.points.map(pointValue)
    if (points.length < 4 || (points.length - 1) % 3 !== 0) throw new Error('Invalid .lcad cubic Bézier point chain')
    const curves: Shape[] = []
    for (let index = 0; index + 3 < points.length; index += 3) curves.push({ ...base, id: `${base.id}:${index / 3}`, type: 'cubic', start: points[index], control1: points[index + 1], control2: points[index + 2], end: points[index + 3], arrowStart: index === 0 ? base.arrowStart : undefined, arrowEnd: index + 4 === points.length ? base.arrowEnd : undefined })
    if (source.closed === true && points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) > 1e-8) {
      curves.push({ ...base, id: `${base.id}:close`, type: 'bezier', start: points[points.length - 1], control: midpoint(points[points.length - 1], points[0]), end: points[0] })
    }
    return curves
  }
  if (source.type === 'text') {
    const x = n('x'), y = n('y'), size = n('fontSize', 5), angle = n('rotation', 0)
    if (!(size > 0)) throw new Error('Invalid .lcad text size')
    const text = typeof source.content === 'string' ? source.content : ''
    const length = Math.max(size, size * text.length * 0.6)
    return [{ ...base, type: 'text', start: { x, y }, end: { x: x + Math.cos(angle) * length, y: y + Math.sin(angle) * length }, text, fontFamily: typeof source.fontFamily === 'string' ? source.fontFamily : 'sans-serif', fontSizeMm: size, transform: 'none', radiusMm: 20, sweepDeg: 180, trackingMm: n('letterSpacing', 0) }]
  }
  throw new Error(`Unsupported .lcad shape type: ${String(source.type)}. Keep the original file or export plain SVG from the source app.`)
}
