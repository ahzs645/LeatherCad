import type { Point, Shape } from '../cad/cad-types'
import { isShapeLike } from '../cad/cad-geometry'
import { isNativeCurve, nativeCurveEndpoints, nativeCurveTangentAt, transformNativeCurve, type NativeCurveMatrix } from '../cad/native-curve-ops'
import { circleThroughThreePoints } from '../ops/geometry/path-core'

export const magnitude = (p: Point): number => Math.hypot(p.x, p.y)
export const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
export const separation = (a: Point, b: Point): number => magnitude(subtract(a, b))
export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export const endpoints = (shape: Shape): { start: Point; end: Point } => isNativeCurve(shape) ? nativeCurveEndpoints(shape) : shape

/** Affine updates retain analytic primitives and all document attributes. */
export function transformConstraintShape(shape: Shape, matrix: NativeCurveMatrix): Shape {
  const [a, b, c, d, e, f] = matrix
  const point = (p: Point): Point => ({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f })
  const updated: Shape = isNativeCurve(shape) ? transformNativeCurve(shape, matrix)
    : shape.type === 'arc' ? { ...shape, start: point(shape.start), mid: point(shape.mid), end: point(shape.end) }
      : shape.type === 'bezier' ? { ...shape, start: point(shape.start), control: point(shape.control), end: point(shape.end) }
        : { ...shape, start: point(shape.start), end: point(shape.end) }
  if (!isShapeLike(updated)) throw new Error('Constraint transform exceeds valid geometry bounds')
  return updated
}

export const translateConstraintShape = (shape: Shape, dx: number, dy: number): Shape => transformConstraintShape(shape, [1, 0, 0, 1, dx, dy])

export function rotateConstraintShape(shape: Shape, angle: number, center: Point): Shape {
  const c = Math.cos(angle), s = Math.sin(angle)
  return transformConstraintShape(shape, [c, s, -s, c, center.x - c * center.x + s * center.y, center.y - s * center.x - c * center.y])
}

export function scaleConstraintShape(shape: Shape, scale: number, center: Point): Shape {
  if (!(scale > 0 && Number.isFinite(scale))) throw new Error('Equal length cannot collapse or inflate a zero-length curve')
  return transformConstraintShape(shape, [scale, 0, 0, scale, center.x * (1 - scale), center.y * (1 - scale)])
}

/** Open curves use their chord. A closed noncircular ellipse uses its major axis. */
export function constraintDirection(shape: Shape): Point {
  if (shape.type === 'ellipse' && Math.abs(shape.sweepDeg) >= 360 - 1e-8) {
    if (Math.abs(shape.radiusX - shape.radiusY) <= 1e-10 * Math.max(shape.radiusX, shape.radiusY)) throw new Error('A closed circle has no unique direction')
    const angle = (shape.rotationDeg + (shape.radiusX < shape.radiusY ? 90 : 0)) * Math.PI / 180
    return { x: Math.cos(angle), y: Math.sin(angle) }
  }
  const points = endpoints(shape), direction = subtract(points.end, points.start)
  if (magnitude(direction) < 1e-10) throw new Error('A zero-chord curve has no unique direction')
  return direction
}

function circularArc(shape: Extract<Shape, { type: 'arc' }>) {
  const circle = circleThroughThreePoints(shape.start, shape.mid, shape.end)
  if (!circle) return null
  const angle = (p: Point) => Math.atan2(p.y - circle.center.y, p.x - circle.center.x)
  const start = angle(shape.start), end = angle(shape.end), mid = angle(shape.mid)
  const positive = (value: number) => (value % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  const span = positive(end - start)
  return { ...circle, start, sweep: positive(mid - start) <= span ? span : span - 2 * Math.PI }
}

function derivative(shape: Shape, t: number): Point {
  if (isNativeCurve(shape)) return nativeCurveTangentAt(shape, t)
  if (shape.type === 'bezier') return {
    x: 2 * ((1 - t) * (shape.control.x - shape.start.x) + t * (shape.end.x - shape.control.x)),
    y: 2 * ((1 - t) * (shape.control.y - shape.start.y) + t * (shape.end.y - shape.control.y)),
  }
  if (shape.type === 'arc') {
    const arc = circularArc(shape)
    if (arc) return { x: -arc.radius * arc.sweep * Math.sin(arc.start + t * arc.sweep), y: arc.radius * arc.sweep * Math.cos(arc.start + t * arc.sweep) }
  }
  return subtract(shape.end, shape.start)
}

/** Endpoint limiting tangent, including repeated Bezier endpoint controls. */
export function constraintTangent(shape: Shape, anchor: 'start' | 'end'): Point {
  if (shape.type === 'text') throw new Error('Text has no curve tangent')
  const tangent = derivative(shape, anchor === 'start' ? 0 : 1)
  if (magnitude(tangent) > 1e-10) return tangent
  const controls = shape.type === 'cubic' ? [shape.start, shape.control1, shape.control2, shape.end]
    : shape.type === 'bezier' ? [shape.start, shape.control, shape.end] : []
  if (anchor === 'end') controls.reverse()
  for (const point of controls.slice(1)) {
    const direction = subtract(point, controls[0])
    if (magnitude(direction) > 1e-10) return anchor === 'start' ? direction : { x: -direction.x, y: -direction.y }
  }
  throw new Error('A collapsed curve has no tangent')
}

/** Bounded adaptive quadrature of analytic speed; no editable polyline conversion. */
export function constraintCurveLength(shape: Shape, accuracy = 1e-7): number {
  if (shape.type === 'line' || shape.type === 'text') return separation(shape.start, shape.end)
  if (shape.type === 'arc') {
    const arc = circularArc(shape)
    return arc ? arc.radius * Math.abs(arc.sweep) : separation(shape.start, shape.end)
  }
  let budget = 16384
  const speed = (t: number) => {
    if (--budget < 0) throw new Error('Curve length exceeds the integration budget')
    return magnitude(derivative(shape, t))
  }
  const simpson = (a: number, b: number, fa: number, fm: number, fb: number) => (b - a) * (fa + 4 * fm + fb) / 6
  const integrate = (a: number, b: number, fa: number, fm: number, fb: number, estimate: number, error: number, depth: number): number => {
    const m = (a + b) / 2, fl = speed((a + m) / 2), fr = speed((m + b) / 2)
    const left = simpson(a, m, fa, fl, fm), right = simpson(m, b, fm, fr, fb), delta = left + right - estimate
    if (Math.abs(delta) <= 15 * error) return left + right + delta / 15
    if (!depth) throw new Error('Curve length cannot meet the requested accuracy')
    return integrate(a, m, fa, fl, fm, left, error / 2, depth - 1) + integrate(m, b, fm, fr, fb, right, error / 2, depth - 1)
  }
  let length = 0
  for (let index = 0; index < 8; index++) {
    const a = index / 8, b = (index + 1) / 8, fa = speed(a), fm = speed((a + b) / 2), fb = speed(b)
    length += integrate(a, b, fa, fm, fb, simpson(a, b, fa, fm, fb), accuracy / 8, 22)
  }
  return length
}
