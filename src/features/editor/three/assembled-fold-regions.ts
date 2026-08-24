/**
 * Splits a piece at its fold lines, so the assembled view can hinge it.
 *
 * The assembled view places whole pieces from the seams that join them, which
 * is right for where a piece sits and says nothing about a piece that bends. A
 * wallet body is one piece of leather with a flap: the seams hold the flap's
 * root against the pocket, and the flap itself folds over. Without a split
 * there is nothing to rotate, so the assembly lies open however far the fold is
 * dialled.
 *
 * A fold cuts the piece in two. One part stays where the seams put it and the
 * other swings about the fold line, and a second fold cuts whichever part it
 * crosses, so an accordion comes out as a chain of hinges rather than a tree of
 * special cases. Which part stays is decided by area: the larger side is the
 * body of the piece and the smaller is the flap that moves. That is a rule, not
 * a certainty — a piece folded exactly down its middle could go either way —
 * so it is stated here rather than buried in the renderer.
 */

import { Vector2 } from 'three'

import type { FoldLine, Point } from '../cad/cad-types'
import { clipPolygonByLine, sideOfLine } from './bridge/geometry-utils'

/** Smallest area worth treating as a region rather than a clipping artefact. */
const MIN_REGION_AREA_MM2 = 0.5
/** How far off the line a vertex must be to count as being on one side of it. */
const ON_LINE_EPSILON = 1e-6

export type FoldHingeStep = {
  foldLineId: string
  /** The axis, in the piece's flat frame. */
  start: Point
  end: Point
  /** Signed rotation about that axis, in degrees. */
  angleDeg: number
  /** Radius the mid-surface turns through, from the fold line's own setting. */
  bendRadiusMm: number
}

export type AssembledFoldRegion = {
  polygon: Point[]
  /**
   * Hinges to apply, outermost first: a region past two folds swings about the
   * first, then about the second in the frame the first left it in.
   */
  hinges: FoldHingeStep[]
}

function toVectors(polygon: Point[]) {
  return polygon.map((point) => new Vector2(point.x, point.y))
}

function toPoints(vectors: Vector2[]): Point[] {
  return vectors.map((vector) => ({ x: vector.x, y: vector.y }))
}

function area(polygon: Point[]) {
  if (polygon.length < 3) return 0
  let sum = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    sum += current.x * next.y - next.x * current.y
  }
  return Math.abs(sum) / 2
}

/** True when the line actually cuts the polygon rather than passing outside it. */
function lineCrosses(polygon: Point[], start: Vector2, end: Vector2) {
  let positive = false
  let negative = false
  for (const point of polygon) {
    const side = sideOfLine(new Vector2(point.x, point.y), start, end)
    if (side > ON_LINE_EPSILON) positive = true
    if (side < -ON_LINE_EPSILON) negative = true
    if (positive && negative) return true
  }
  return false
}

/**
 * Which way a fold turns.
 *
 * A mountain fold lifts the flap towards the viewer and a valley drops it away;
 * the two are the same rotation with opposite signs, and the document names one
 * of them per fold line.
 */
function signedAngleDeg(fold: FoldLine) {
  const magnitude = Math.abs(fold.angleDeg)
  return fold.direction === 'mountain' ? -magnitude : magnitude
}

/**
 * The regions a piece's outline falls into once its folds are applied.
 *
 * A piece with no folds — or none that reach it — comes back as a single
 * region with no hinges, which is the shape the caller already knew how to
 * draw.
 */
export function splitPieceByFolds(outer: Point[], foldLines: FoldLine[]): AssembledFoldRegion[] {
  let regions: AssembledFoldRegion[] = [{ polygon: outer, hinges: [] }]
  if (outer.length < 3) return regions

  for (const fold of foldLines) {
    const start = new Vector2(fold.start.x, fold.start.y)
    const end = new Vector2(fold.end.x, fold.end.y)
    if (start.distanceTo(end) <= ON_LINE_EPSILON) continue

    const next: AssembledFoldRegion[] = []
    for (const region of regions) {
      if (!lineCrosses(region.polygon, start, end)) {
        next.push(region)
        continue
      }
      const vectors = toVectors(region.polygon)
      const positive = toPoints(clipPolygonByLine(vectors, start, end, true))
      const negative = toPoints(clipPolygonByLine(vectors, start, end, false))
      if (area(positive) < MIN_REGION_AREA_MM2 || area(negative) < MIN_REGION_AREA_MM2) {
        // The line grazes an edge rather than dividing the region.
        next.push(region)
        continue
      }

      // The larger side is the body of the piece; the smaller is what moves.
      const [stays, swings] = area(positive) >= area(negative) ? [positive, negative] : [negative, positive]
      const hinge: FoldHingeStep = {
        foldLineId: fold.id,
        start: fold.start,
        end: fold.end,
        angleDeg: signedAngleDeg(fold),
        bendRadiusMm: Math.max(0, fold.radiusMm ?? 0),
      }
      next.push({ polygon: stays, hinges: region.hinges })
      next.push({ polygon: swings, hinges: [...region.hinges, hinge] })
    }
    regions = next
  }

  return regions
}

/** Whether a point falls in a region, for handing stitch holes to the part they sit on. */
export function regionContains(region: AssembledFoldRegion, point: Point) {
  const polygon = region.polygon
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside
    }
  }
  return inside
}
