import type { CubicShape, EllipseShape, LineShape, Point } from '../../cad/cad-types'
import { nativeCurvePointAt } from '../../cad/native-curve-ops'

type Native = CubicShape | EllipseShape
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

function splitCubic(shape: CubicShape, t: number): [CubicShape, CubicShape] {
  const a = lerp(shape.start, shape.control1, t), b = lerp(shape.control1, shape.control2, t), c = lerp(shape.control2, shape.end, t)
  const d = lerp(a, b, t), e = lerp(b, c, t), point = lerp(d, e, t)
  return [{ ...shape, start: { ...shape.start }, control1: a, control2: d, end: point }, { ...shape, start: point, control1: e, control2: c, end: { ...shape.end } }]
}

/** Exact parameter interval, preserving native controls/radii and common attributes. */
export function nativeCurveSubsegment(shape: Native, t0: number, t1: number): Native {
  if (![t0, t1].every(Number.isFinite) || t0 < 0 || t1 > 1 || t1 < t0) throw new Error('Native curve interval must satisfy 0 ≤ start ≤ end ≤ 1.')
  if (shape.type === 'ellipse') return { ...shape, center: { ...shape.center }, startAngleDeg: shape.startAngleDeg + shape.sweepDeg * t0, sweepDeg: shape.sweepDeg * (t1 - t0) }
  if (t0 === 0 && t1 === 1) return { ...shape, start: { ...shape.start }, control1: { ...shape.control1 }, control2: { ...shape.control2 }, end: { ...shape.end } }
  const left = t1 === 1 ? shape : splitCubic(shape, t1)[0]
  return t0 === 0 ? left : splitCubic(left, t1 <= 0 ? 0 : t0 / t1)[1]
}

/** Coarse global search followed by local refinement, including both endpoints. */
export function nearestNativeCurveParameter(shape: Native, point: Point): number {
  const squared = (t: number) => { const p = nativeCurvePointAt(shape, t); return (p.x - point.x) ** 2 + (p.y - point.y) ** 2 }
  const samples = 256
  let best = 0
  for (let index = 1; index <= samples; index++) if (squared(index / samples) < squared(best)) best = index / samples
  let low = Math.max(0, best - 1 / samples), high = Math.min(1, best + 1 / samples)
  for (let iteration = 0; iteration < 32; iteration++) {
    const a = low + (high - low) / 3, b = high - (high - low) / 3
    if (squared(a) < squared(b)) high = b; else low = a
  }
  const refined = (low + high) / 2
  return squared(refined) < squared(best) ? refined : best
}

/** Analytic ellipse roots and bracketed cubic polynomial roots, including tangencies. */
export function nativeCurveLineIntersections(shape: Native, line: LineShape): Point[] {
  const dx = line.end.x - line.start.x, dy = line.end.y - line.start.y
  if (Math.hypot(dx, dy) < 1e-12) return []
  const cross = (point: Point) => dx * (point.y - line.start.y) - dy * (point.x - line.start.x)
  const parameters: number[] = []
  if (shape.type === 'ellipse') {
    const rotation = shape.rotationDeg * Math.PI / 180
    const a = shape.radiusX * (dx * Math.sin(rotation) - dy * Math.cos(rotation))
    const b = shape.radiusY * (dx * Math.cos(rotation) + dy * Math.sin(rotation))
    const radius = Math.hypot(a, b), c = cross(shape.center)
    if (radius < 1e-15 || Math.abs(c) > radius + 1e-10) return []
    const phase = Math.atan2(b, a), offset = Math.acos(Math.max(-1, Math.min(1, -c / radius)))
    for (const angle of [phase + offset, phase - offset]) {
      const degrees = angle * 180 / Math.PI
      const delta = shape.sweepDeg > 0 ? ((degrees - shape.startAngleDeg) % 360 + 360) % 360 : -(((shape.startAngleDeg - degrees) % 360 + 360) % 360)
      const t = delta / shape.sweepDeg
      if (t >= -1e-10 && t <= 1 + 1e-10) parameters.push(Math.max(0, Math.min(1, t)))
    }
  } else {
    const p0 = cross(shape.start), p1 = cross(shape.control1), p2 = cross(shape.control2), p3 = cross(shape.end)
    const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 3 * p0 - 6 * p1 + 3 * p2, c = -3 * p0 + 3 * p1, d = p0
    const evaluate = (t: number) => ((a * t + b) * t + c) * t + d
    const critical = [0, 1]
    if (Math.abs(a) < 1e-15) { if (Math.abs(b) > 1e-15) critical.push(-c / (2 * b)) }
    else {
      const discriminant = 4 * b * b - 12 * a * c
      if (discriminant >= 0) critical.push((-2 * b - Math.sqrt(discriminant)) / (6 * a), (-2 * b + Math.sqrt(discriminant)) / (6 * a))
    }
    const cuts = critical.filter((t) => t >= 0 && t <= 1).sort((left, right) => left - right)
    const epsilon = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d)) * 1e-12
    for (const t of cuts) if (Math.abs(evaluate(t)) <= epsilon) parameters.push(t)
    for (let index = 1; index < cuts.length; index++) {
      let low = cuts[index - 1], high = cuts[index]
      if (evaluate(low) * evaluate(high) >= 0) continue
      for (let iteration = 0; iteration < 56; iteration++) {
        const mid = (low + high) / 2
        if (evaluate(low) * evaluate(mid) <= 0) high = mid; else low = mid
      }
      parameters.push((low + high) / 2)
    }
  }
  return parameters.map((t) => nativeCurvePointAt(shape, t)).filter((point, index, points) => !points.slice(0, index).some((prior) => Math.hypot(prior.x - point.x, prior.y - point.y) < 1e-8))
}
