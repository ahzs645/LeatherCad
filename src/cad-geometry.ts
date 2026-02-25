import type { Point, Shape } from './cad-types'

const TAU = Math.PI * 2

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function round(value: number) {
  return Number(value.toFixed(3))
}

export function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function distance(a: Point, b: Point) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function deltaCcw(start: number, end: number) {
  return ((end - start) % TAU + TAU) % TAU
}

function circleThroughPoints(p1: Point, p2: Point, p3: Point) {
  const x1 = p1.x
  const y1 = p1.y
  const x2 = p2.x
  const y2 = p2.y
  const x3 = p3.x
  const y3 = p3.y

  const denominator = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
  if (Math.abs(denominator) < 1e-6) {
    return null
  }

  const x1SqY1Sq = x1 * x1 + y1 * y1
  const x2SqY2Sq = x2 * x2 + y2 * y2
  const x3SqY3Sq = x3 * x3 + y3 * y3

  const cx =
    (x1SqY1Sq * (y2 - y3) + x2SqY2Sq * (y3 - y1) + x3SqY3Sq * (y1 - y2)) /
    denominator
  const cy =
    (x1SqY1Sq * (x3 - x2) + x2SqY2Sq * (x1 - x3) + x3SqY3Sq * (x2 - x1)) /
    denominator

  return {
    center: { x: cx, y: cy },
    radius: distance({ x: cx, y: cy }, p1),
  }
}

export function arcPath(start: Point, mid: Point, end: Point) {
  const circle = circleThroughPoints(start, mid, end)
  if (!circle || circle.radius < 1e-6) {
    return `M ${round(start.x)} ${round(start.y)} Q ${round(mid.x)} ${round(mid.y)} ${round(end.x)} ${round(end.y)}`
  }

  const angleAt = (point: Point) => Math.atan2(-(point.y - circle.center.y), point.x - circle.center.x)

  const startAngle = angleAt(start)
  const midAngle = angleAt(mid)
  const endAngle = angleAt(end)

  const startToEndCcw = deltaCcw(startAngle, endAngle)
  const startToMidCcw = deltaCcw(startAngle, midAngle)

  const isCcw = startToMidCcw <= startToEndCcw
  const arcAngle = isCcw ? startToEndCcw : TAU - startToEndCcw

  const largeArcFlag = arcAngle > Math.PI ? 1 : 0
  const sweepFlag = isCcw ? 0 : 1

  return [
    `M ${round(start.x)} ${round(start.y)}`,
    `A ${round(circle.radius)} ${round(circle.radius)} 0 ${largeArcFlag} ${sweepFlag} ${round(end.x)} ${round(end.y)}`,
  ].join(' ')
}

export function shapeToSvg(shape: Shape) {
  if (shape.type === 'line') {
    return `<line x1="${round(shape.start.x)}" y1="${round(shape.start.y)}" x2="${round(shape.end.x)}" y2="${round(shape.end.y)}" stroke="#0f172a" stroke-width="2" fill="none" />`
  }

  if (shape.type === 'arc') {
    return `<path d="${arcPath(shape.start, shape.mid, shape.end)}" stroke="#0f172a" stroke-width="2" fill="none" />`
  }

  return `<path d="M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(shape.end.x)} ${round(shape.end.y)}" stroke="#0f172a" stroke-width="2" fill="none" />`
}

export function getShapePoints(shape: Shape) {
  if (shape.type === 'line') {
    return [shape.start, shape.end]
  }
  if (shape.type === 'arc') {
    return [shape.start, shape.mid, shape.end]
  }
  return [shape.start, shape.control, shape.end]
}

export function getBounds(shapes: Shape[]) {
  if (shapes.length === 0) {
    return {
      minX: -500,
      minY: -500,
      width: 1000,
      height: 1000,
    }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const shape of shapes) {
    for (const point of getShapePoints(shape)) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  const padding = 100
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: Math.max(100, maxX - minX + padding * 2),
    height: Math.max(100, maxY - minY + padding * 2),
  }
}

export function sampleShapePoints(shape: Shape, segments = 20) {
  if (shape.type === 'line') {
    return [shape.start, shape.end]
  }

  if (shape.type === 'bezier') {
    const points: Point[] = []
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments
      const x =
        (1 - t) * (1 - t) * shape.start.x +
        2 * (1 - t) * t * shape.control.x +
        t * t * shape.end.x
      const y =
        (1 - t) * (1 - t) * shape.start.y +
        2 * (1 - t) * t * shape.control.y +
        t * t * shape.end.y
      points.push({ x, y })
    }
    return points
  }

  const circle = circleThroughPoints(shape.start, shape.mid, shape.end)
  if (!circle || circle.radius < 1e-6) {
    return [shape.start, shape.mid, shape.end]
  }

  const startAngle = Math.atan2(shape.start.y - circle.center.y, shape.start.x - circle.center.x)
  const midAngle = Math.atan2(shape.mid.y - circle.center.y, shape.mid.x - circle.center.x)
  const endAngle = Math.atan2(shape.end.y - circle.center.y, shape.end.x - circle.center.x)

  const startToEndCcw = deltaCcw(startAngle, endAngle)
  const startToMidCcw = deltaCcw(startAngle, midAngle)
  const isCcw = startToMidCcw <= startToEndCcw
  const arcAngle = isCcw ? startToEndCcw : TAU - startToEndCcw
  const signedArc = isCcw ? arcAngle : -arcAngle

  const points: Point[] = []
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const angle = startAngle + signedArc * t
    points.push({
      x: circle.center.x + Math.cos(angle) * circle.radius,
      y: circle.center.y + Math.sin(angle) * circle.radius,
    })
  }

  return points
}

export function isPointLike(value: unknown): value is Point {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    typeof (value as { x: unknown }).x === 'number' &&
    typeof (value as { y: unknown }).y === 'number'
  )
}

export function isShapeLike(value: unknown): value is Shape {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false
  }

  const shape = value as { type: unknown; start?: unknown; end?: unknown; mid?: unknown; control?: unknown }
  if (shape.type === 'line') {
    return isPointLike(shape.start) && isPointLike(shape.end)
  }
  if (shape.type === 'arc') {
    return isPointLike(shape.start) && isPointLike(shape.mid) && isPointLike(shape.end)
  }
  if (shape.type === 'bezier') {
    return isPointLike(shape.start) && isPointLike(shape.control) && isPointLike(shape.end)
  }
  return false
}
