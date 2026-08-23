/**
 * Turns an imported outline side into editable LeatherCad shapes.
 *
 * The document has lines, three-point arcs, and quadratic beziers; a PDF has
 * cubics. Rather than force every cubic through a quadratic — which visibly
 * flattens a corner round — each one is fitted with an arc and only subdivided
 * where an arc will not hold it. A rounded corner drawn the way Illustrator
 * draws one *is* a quarter circle, so it comes back as a single arc a user can
 * grab and re-radius, and the wavy edge on a pocket comes back as a short chain
 * of arcs instead of a hundred chords.
 */

import type { ArcShape, LineShape, Point, Shape } from '../../cad/cad-types'
import type { PdfPathSegment } from './pdf-vector-paths'
import type { PatternSide } from './pattern-outline-sides'

export type ShapeEmitOptions = {
  /** Largest gap allowed between the fitted shape and the original curve. */
  toleranceMm: number
  /** How many times a stubborn cubic may be halved before giving up. */
  maxSubdivisions: number
}

export const DEFAULT_SHAPE_EMIT_OPTIONS: ShapeEmitOptions = {
  toleranceMm: 0.05,
  maxSubdivisions: 5,
}

type Cubic = Extract<PdfPathSegment, { kind: 'cubic' }>

function cubicPoint(segment: Cubic, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * segment.from.x + b * segment.c1.x + c * segment.c2.x + d * segment.to.x,
    y: a * segment.from.y + b * segment.c1.y + c * segment.c2.y + d * segment.to.y,
  }
}

function splitCubic(segment: Cubic): [Cubic, Cubic] {
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const p01 = mid(segment.from, segment.c1)
  const p12 = mid(segment.c1, segment.c2)
  const p23 = mid(segment.c2, segment.to)
  const p012 = mid(p01, p12)
  const p123 = mid(p12, p23)
  const apex = mid(p012, p123)
  return [
    { kind: 'cubic', from: segment.from, c1: p01, c2: p012, to: apex },
    { kind: 'cubic', from: apex, c1: p123, c2: p23, to: segment.to },
  ]
}

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 1e-12) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t))
}

/** Centre of the circle through three points, or null when they are collinear. */
function circumcentre(a: Point, b: Point, c: Point): Point | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (Math.abs(d) < 1e-12) return null
  const aSq = a.x * a.x + a.y * a.y
  const bSq = b.x * b.x + b.y * b.y
  const cSq = c.x * c.x + c.y * c.y
  return {
    x: (aSq * (b.y - c.y) + bSq * (c.y - a.y) + cSq * (a.y - b.y)) / d,
    y: (aSq * (c.x - b.x) + bSq * (a.x - c.x) + cSq * (b.x - a.x)) / d,
  }
}

const FIT_SAMPLES = 12

/** Worst distance from the cubic to the circle through its ends and midpoint. */
function arcFitError(segment: Cubic, midpoint: Point) {
  const centre = circumcentre(segment.from, midpoint, segment.to)
  if (!centre) return Infinity
  const radius = Math.hypot(segment.from.x - centre.x, segment.from.y - centre.y)
  let worst = 0
  for (let i = 1; i < FIT_SAMPLES; i += 1) {
    const point = cubicPoint(segment, i / FIT_SAMPLES)
    worst = Math.max(worst, Math.abs(Math.hypot(point.x - centre.x, point.y - centre.y) - radius))
  }
  return worst
}

/** Worst distance from the cubic to its own chord. */
function straightnessError(segment: Cubic) {
  let worst = 0
  for (let i = 1; i < FIT_SAMPLES; i += 1) {
    worst = Math.max(
      worst,
      distanceToSegment(cubicPoint(segment, i / FIT_SAMPLES), segment.from, segment.to),
    )
  }
  return worst
}

function emitCubic(
  segment: Cubic,
  make: (kind: 'line' | 'arc', points: { start: Point; mid: Point; end: Point }) => Shape,
  config: ShapeEmitOptions,
  depth: number,
): Shape[] {
  const midpoint = cubicPoint(segment, 0.5)
  if (straightnessError(segment) <= config.toleranceMm) {
    return [make('line', { start: segment.from, mid: midpoint, end: segment.to })]
  }
  if (arcFitError(segment, midpoint) <= config.toleranceMm || depth >= config.maxSubdivisions) {
    return [make('arc', { start: segment.from, mid: midpoint, end: segment.to })]
  }
  const [left, right] = splitCubic(segment)
  return [...emitCubic(left, make, config, depth + 1), ...emitCubic(right, make, config, depth + 1)]
}

/**
 * Emits the shapes for one side.
 *
 * Ids are `${idPrefix}-${n}` so a caller can point a seam at the side by
 * looking up the shapes it produced.
 */
export function sideToShapes(
  side: PatternSide,
  params: { idPrefix: string; layerId: string; lineTypeId: string },
  options: Partial<ShapeEmitOptions> = {},
): Shape[] {
  const config = { ...DEFAULT_SHAPE_EMIT_OPTIONS, ...options }
  const shapes: Shape[] = []
  // A counter rather than `shapes.length`: subdivision builds its shapes before
  // any of them is pushed, so length would hand the whole run the same id.
  let emitted = 0
  const make = (
    kind: 'line' | 'arc',
    points: { start: Point; mid: Point; end: Point },
  ): Shape => {
    emitted += 1
    const id = `${params.idPrefix}-${emitted}`
    const base = { id, layerId: params.layerId, lineTypeId: params.lineTypeId }
    return kind === 'line'
      ? ({ ...base, type: 'line', start: points.start, end: points.end } satisfies LineShape)
      : ({ ...base, type: 'arc', start: points.start, mid: points.mid, end: points.end } satisfies ArcShape)
  }

  // Consecutive lines on one side are collinear by construction, so they
  // collapse to a single shape. Keeping them separate would leave a straight
  // edge as two or three shapes purely because of where the pen started, and a
  // seam covering part of that edge could then only name whole shapes.
  let run: Extract<PdfPathSegment, { kind: 'line' }>[] = []
  const flushRun = () => {
    if (run.length === 0) return
    const from = run[0].from
    const to = run[run.length - 1].to
    shapes.push(make('line', { start: from, mid: from, end: to }))
    run = []
  }
  for (const segment of side.segments) {
    if (segment.kind === 'line') {
      run.push(segment)
      continue
    }
    flushRun()
    shapes.push(...emitCubic(segment, make, config, 0))
  }
  flushRun()
  return shapes
}
