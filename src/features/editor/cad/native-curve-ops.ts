import type { CubicShape, EllipseShape, LineShape, Point, Shape } from './cad-types'

export type NativeCurve = CubicShape | EllipseShape
export type NativeCurveMatrix = [number, number, number, number, number, number]
const RAD = Math.PI / 180
const MAX_CURVE_SEGMENTS = 8192
export const isNativeCurve = (shape: Shape): shape is NativeCurve => shape.type === 'cubic' || shape.type === 'ellipse'

export function nativeCurvePointAt(shape: NativeCurve, t: number): Point {
  if (shape.type === 'cubic') {
    const u = 1 - t
    return { x: u ** 3 * shape.start.x + 3 * u * u * t * shape.control1.x + 3 * u * t * t * shape.control2.x + t ** 3 * shape.end.x, y: u ** 3 * shape.start.y + 3 * u * u * t * shape.control1.y + 3 * u * t * t * shape.control2.y + t ** 3 * shape.end.y }
  }
  const angle = ((shape.startAngleDeg % 360) + shape.sweepDeg * t) * RAD, rotation = (shape.rotationDeg % 360) * RAD
  const x = shape.radiusX * Math.cos(angle), y = shape.radiusY * Math.sin(angle)
  return { x: shape.center.x + x * Math.cos(rotation) - y * Math.sin(rotation), y: shape.center.y + x * Math.sin(rotation) + y * Math.cos(rotation) }
}

export function nativeCurveTangentAt(shape: NativeCurve, t: number): Point {
  if (shape.type === 'cubic') {
    const u = 1 - t
    return { x: 3 * u * u * (shape.control1.x - shape.start.x) + 6 * u * t * (shape.control2.x - shape.control1.x) + 3 * t * t * (shape.end.x - shape.control2.x), y: 3 * u * u * (shape.control1.y - shape.start.y) + 6 * u * t * (shape.control2.y - shape.control1.y) + 3 * t * t * (shape.end.y - shape.control2.y) }
  }
  const angle = ((shape.startAngleDeg % 360) + shape.sweepDeg * t) * RAD, rotation = (shape.rotationDeg % 360) * RAD, speed = shape.sweepDeg * RAD
  const dx = -shape.radiusX * Math.sin(angle) * speed, dy = shape.radiusY * Math.cos(angle) * speed
  return { x: dx * Math.cos(rotation) - dy * Math.sin(rotation), y: dx * Math.sin(rotation) + dy * Math.cos(rotation) }
}

export const nativeCurveEndpoints = (shape: NativeCurve) => ({ start: nativeCurvePointAt(shape, 0), end: nativeCurvePointAt(shape, 1) })

export function nativeCurvePath(shape: NativeCurve): string {
  const { start, end } = nativeCurveEndpoints(shape)
  if (shape.type === 'cubic') return `M ${start.x} ${start.y} C ${shape.control1.x} ${shape.control1.y} ${shape.control2.x} ${shape.control2.y} ${end.x} ${end.y}`
  const arc = (point: Point, sweep: number) => `A ${shape.radiusX} ${shape.radiusY} ${shape.rotationDeg % 360} ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep > 0 ? 1 : 0} ${point.x} ${point.y}`
  return Math.abs(shape.sweepDeg) >= 360 - 1e-8
    ? `M ${start.x} ${start.y} ${arc(nativeCurvePointAt(shape, 0.5), shape.sweepDeg / 2)} ${arc(end, shape.sweepDeg / 2)}`
    : `M ${start.x} ${start.y} ${arc(end, shape.sweepDeg)}`
}

function roots(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-14) return Math.abs(b) < 1e-14 ? [] : [-c / b]
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return []
  return [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)]
}

export function nativeCurveBounds(shape: NativeCurve): { minX: number; minY: number; maxX: number; maxY: number } {
  const parameters = [0, 1]
  if (shape.type === 'cubic') {
    for (const axis of ['x', 'y'] as const) parameters.push(...roots(-shape.start[axis] + 3 * shape.control1[axis] - 3 * shape.control2[axis] + shape.end[axis], 2 * (shape.start[axis] - 2 * shape.control1[axis] + shape.control2[axis]), shape.control1[axis] - shape.start[axis]).filter(t => t > 0 && t < 1))
  } else {
    const rotation = (shape.rotationDeg % 360) * RAD
    const x = Math.atan2(-shape.radiusY * Math.sin(rotation), shape.radiusX * Math.cos(rotation)) / RAD
    const y = Math.atan2(shape.radiusY * Math.cos(rotation), shape.radiusX * Math.sin(rotation)) / RAD
    for (const angle of [x, x + 180, y, y + 180]) {
      const delta = shape.sweepDeg > 0 ? ((angle - shape.startAngleDeg) % 360 + 360) % 360 : -(((shape.startAngleDeg - angle) % 360 + 360) % 360)
      const t = delta / shape.sweepDeg
      if (t >= 0 && t <= 1) parameters.push(t)
    }
  }
  const points = parameters.map(t => nativeCurvePointAt(shape, t))
  return { minX: Math.min(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)), maxX: Math.max(...points.map(p => p.x)), maxY: Math.max(...points.map(p => p.y)) }
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
function chordDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

/** Deliberate conversion for operations that cannot preserve an analytic curve. */
export function nativeCurveToEditable(shape: NativeCurve, toleranceMm = 0.01): LineShape[] {
  if (!Number.isFinite(toleranceMm) || toleranceMm <= 0) throw new Error('Curve tolerance must be a positive mm value')
  const points = [nativeCurvePointAt(shape, 0)]
  if (shape.type === 'ellipse') {
    const count = Math.max(1, Math.ceil(Math.abs(shape.sweepDeg) * RAD * Math.sqrt(Math.max(shape.radiusX, shape.radiusY) / (8 * toleranceMm))))
    if (count > MAX_CURVE_SEGMENTS) throw new Error('Ellipse exceeds the curve conversion budget')
    for (let index = 1; index <= count; index++) points.push(nativeCurvePointAt(shape, index / count))
  } else {
    const visit = (a: Point, b: Point, c: Point, d: Point, depth: number) => {
      if (points.length > MAX_CURVE_SEGMENTS || depth > 24) throw new Error('Cubic curve exceeds the conversion budget')
      if (Math.max(chordDistance(b, a, d), chordDistance(c, a, d)) <= toleranceMm) { points.push(d); return }
      const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d), abc = midpoint(ab, bc), bcd = midpoint(bc, cd), center = midpoint(abc, bcd)
      visit(a, ab, abc, center, depth + 1); visit(center, bcd, cd, d, depth + 1)
    }
    visit(shape.start, shape.control1, shape.control2, shape.end, 0)
  }
  return points.slice(1).map((end, index) => ({ id: `${shape.id}:part-${index}`, type: 'line', layerId: shape.layerId, lineTypeId: shape.lineTypeId, groupId: shape.groupId, locked: shape.locked, opacity: shape.opacity, strokeWidthOverride: shape.strokeWidthOverride, arrowStart: index === 0 ? shape.arrowStart : undefined, arrowEnd: index === points.length - 2 ? shape.arrowEnd : undefined, start: points[index], end }))
}

/** Exact affine transform; the ellipse basis is recovered by a 2×2 SVD. */
export function transformNativeCurve(shape: NativeCurve, matrix: NativeCurveMatrix): NativeCurve {
  const [a, b, c, d, e, f] = matrix
  if (!matrix.every(Number.isFinite)) throw new Error('Invalid curve transform')
  const map = (p: Point): Point => ({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f })
  if (shape.type === 'cubic') return { ...shape, start: map(shape.start), control1: map(shape.control1), control2: map(shape.control2), end: map(shape.end) }
  const angle = (shape.rotationDeg % 360) * RAD, cosine = Math.cos(angle), sine = Math.sin(angle)
  const ux = shape.radiusX * (a * cosine + c * sine), uy = shape.radiusX * (b * cosine + d * sine)
  const vx = shape.radiusY * (-a * sine + c * cosine), vy = shape.radiusY * (-b * sine + d * cosine)
  const xx = ux * ux + vx * vx, yy = uy * uy + vy * vy, xy = ux * uy + vx * vy
  const rotation = Math.atan2(2 * xy, xx - yy) / 2
  const radiusX = Math.sqrt((xx + yy + Math.hypot(xx - yy, 2 * xy)) / 2), determinant = a * d - b * c
  const radiusY = Math.abs(ux * vy - uy * vx) / radiusX
  if (!(radiusX > 1e-10 && radiusY > 1e-10)) throw new Error('Transform collapses the ellipse; use a nonzero scale')
  const center = map(shape.center), start = map(nativeCurvePointAt(shape, 0)), dx = start.x - center.x, dy = start.y - center.y
  const parameter = Math.atan2((-dx * Math.sin(rotation) + dy * Math.cos(rotation)) / radiusY, (dx * Math.cos(rotation) + dy * Math.sin(rotation)) / radiusX)
  return { ...shape, center, radiusX, radiusY, rotationDeg: rotation / RAD, startAngleDeg: parameter / RAD, sweepDeg: Math.sign(determinant) * shape.sweepDeg }
}
