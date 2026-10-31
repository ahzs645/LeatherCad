import type { Point, Shape } from '../../cad/cad-types'

const MAX_POINTS = 10_000
function circleThroughPoints(a: Point, b: Point, c: Point) {
  const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y
  const determinant = 2 * (bx * cy - by * cx)
  if (Math.abs(determinant) < 1e-12) return null
  const bb = bx * bx + by * by, cc = cx * cx + cy * cy
  const center = { x: a.x + (cy * bb - by * cc) / determinant, y: a.y + (bx * cc - cx * bb) / determinant }
  return { center, radius: Math.hypot(a.x - center.x, a.y - center.y) }
}
function midpoint(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

/** Convex-hull subdivision bounds the complete polynomial curve, rather than checking a few samples. */
export function flattenBezier(points: Point[], toleranceMm: number): Point[] {
  const output: Point[] = [points[0]]
  const visit = (controls: Point[], depth: number) => {
    if (output.length > MAX_POINTS || depth > 24) throw new Error('Curve tolerance requires too many manufacturing vertices. Increase tolerance or simplify the curve.')
    if (controls.slice(1, -1).every((point) => distanceToSegment(point, controls[0], controls[controls.length - 1]) <= toleranceMm)) {
      output.push(controls[controls.length - 1]); return
    }
    const levels = [controls]
    while (levels[levels.length - 1].length > 1) levels.push(levels[levels.length - 1].slice(1).map((point, i) => midpoint(levels[levels.length - 1][i], point)))
    visit(levels.map((row) => row[0]), depth + 1)
    visit(levels.map((row) => row[row.length - 1]).reverse(), depth + 1)
  }
  visit(points, 0)
  return output
}

export function manufacturingCircle(center: Point, radius: number, toleranceMm: number): Point[] {
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - toleranceMm / radius)))
  const count = Math.max(24, Math.ceil(2 * Math.PI / Math.max(angle, 1e-9)))
  if (count > MAX_POINTS) throw new Error('Circular hole exceeds the manufacturing vertex budget.')
  return Array.from({ length: count }, (_, i) => ({ x: center.x + radius * Math.cos(i * 2 * Math.PI / count), y: center.y + radius * Math.sin(i * 2 * Math.PI / count) }))
}

export function flattenManufacturingShape(shape: Shape, toleranceMm: number): Point[] {
  if (shape.type === 'text') return []
  if (shape.type === 'line') return [shape.start, shape.end]
  if (shape.type === 'bezier') return flattenBezier([shape.start, shape.control, shape.end], toleranceMm)
  if (shape.type === 'cubic') return flattenBezier([shape.start, shape.control1, shape.control2, shape.end], toleranceMm)
  if (shape.type === 'ellipse') {
    const radius = Math.max(shape.radiusX, shape.radiusY)
    if (!(Math.min(shape.radiusX, shape.radiusY) > 0) || !Number.isFinite(radius) || ![shape.sweepDeg, shape.startAngleDeg, shape.rotationDeg].every(Number.isFinite)) throw new Error('Manufacturing ellipse radii and angles must be finite and radii must be positive.')
    const sweep = shape.sweepDeg * Math.PI / 180, start = shape.startAngleDeg * Math.PI / 180, rotation = shape.rotationDeg * Math.PI / 180
    const angle = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - toleranceMm / radius)))
    const count = Math.max(4, Math.ceil(Math.abs(sweep) / Math.max(angle, 1e-9)))
    if (count > MAX_POINTS) throw new Error('Ellipse tolerance requires too many manufacturing vertices.')
    return Array.from({ length: count + 1 }, (_, i) => {
      const a = start + sweep * i / count, x = shape.radiusX * Math.cos(a), y = shape.radiusY * Math.sin(a)
      return { x: shape.center.x + x * Math.cos(rotation) - y * Math.sin(rotation), y: shape.center.y + x * Math.sin(rotation) + y * Math.cos(rotation) }
    })
  }
  const circle = circleThroughPoints(shape.start, shape.mid, shape.end)
  if (!circle) return [shape.start, shape.mid, shape.end]
  const tau = Math.PI * 2
  const delta = (a: number, b: number) => ((b - a) % tau + tau) % tau
  const start = Math.atan2(shape.start.y - circle.center.y, shape.start.x - circle.center.x)
  const middle = Math.atan2(shape.mid.y - circle.center.y, shape.mid.x - circle.center.x)
  const end = Math.atan2(shape.end.y - circle.center.y, shape.end.x - circle.center.x)
  const sweep = delta(start, middle) <= delta(start, end) ? delta(start, end) : delta(start, end) - tau
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - toleranceMm / circle.radius)))
  const count = Math.max(2, Math.ceil(Math.abs(sweep) / Math.max(angle, 1e-9)))
  if (count > MAX_POINTS) throw new Error('Arc tolerance requires too many manufacturing vertices.')
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = start + sweep * i / count
    return { x: circle.center.x + circle.radius * Math.cos(a), y: circle.center.y + circle.radius * Math.sin(a) }
  })
}
