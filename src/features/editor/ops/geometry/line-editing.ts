import type { Point, Shape, LineShape } from '../../cad/cad-types'
import { distance, uid, round } from '../../cad/cad-geometry'
import {
  circleThroughThreePoints,
  evalQuadBezier,
  evaluateShapeAt,
  lerpPoint,
  sampleShapeWithParams,
} from './path-core'

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

/**
 * Source `nbNumDividingCenter` — produce N evenly-spaced parallel lines
 * connecting matched lengthwise interpolation points between the two shapes.
 * `divisions === 1` reproduces the single midline.
 */
export function buildCenterLinesBetween(
  first: Shape,
  second: Shape,
  divisions: number,
  props: { layerId: string; lineTypeId: string; groupId?: string },
): LineShape[] {
  const safeDivisions = Math.max(1, Math.round(divisions))
  if (safeDivisions === 1) {
    return [buildCenterLineBetween(first, second, props)]
  }
  const lines: LineShape[] = []
  for (let index = 0; index < safeDivisions; index += 1) {
    const t = (index + 1) / (safeDivisions + 1)
    const start = {
      x: round(first.start.x * (1 - t) + first.end.x * t),
      y: round(first.start.y * (1 - t) + first.end.y * t),
    }
    const end = {
      x: round(second.start.x * (1 - t) + second.end.x * t),
      y: round(second.start.y * (1 - t) + second.end.y * t),
    }
    lines.push({
      id: uid(),
      type: 'line',
      layerId: props.layerId,
      lineTypeId: props.lineTypeId,
      groupId: props.groupId,
      start,
      end,
    })
  }
  return lines
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
