/**
 * Splits a piece outline into the sides a person would name.
 *
 * Illustrator writes an outline as whatever segments the pen left behind: a
 * straight edge broken at three anchors is three collinear `l` operators, and a
 * closed path routinely starts halfway along a side. Seams are authored against
 * *sides* — "the pocket's bottom edge is sewn to the panel's left" — so the
 * segments have to be regrouped before anything can talk about the pattern.
 *
 * Two rules do it: consecutive lines pointing the same way are one side, and a
 * curve is always its own side. Corners survive because a corner is exactly
 * where the direction changes.
 */

import type { Point } from '../../cad/cad-types'
import type { PdfPathSegment } from './pdf-vector-paths'

export type PatternSideKind = 'line' | 'curve'

export type PatternSide = {
  id: string
  kind: PatternSideKind
  start: Point
  end: Point
  /** Flattened run, first and last matching `start`/`end`. */
  polyline: Point[]
  lengthMm: number
  /** The authored segments this side was built from. */
  segments: PdfPathSegment[]
}

export type OutlineSideOptions = {
  /**
   * Direction change below which two segments continue the same side, in
   * degrees: heading for a pair of lines, tangent for a pair of curves.
   */
  collinearToleranceDeg: number
  /**
   * Shortest segment worth keeping. Illustrator leaves duplicate anchors
   * behind, which arrive as hundredth-of-a-millimetre stubs that would split a
   * side in two.
   */
  minSegmentLengthMm: number
}

export const DEFAULT_OUTLINE_SIDE_OPTIONS: OutlineSideOptions = {
  collinearToleranceDeg: 1,
  minSegmentLengthMm: 0.05,
}

function segmentLength(segment: PdfPathSegment) {
  if (segment.kind === 'line') {
    return Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y)
  }
  // Control-polygon length is an upper bound and the chord a lower one; their
  // mean is within a fraction of a percent for the shallow curves in a pattern.
  const hull =
    Math.hypot(segment.c1.x - segment.from.x, segment.c1.y - segment.from.y) +
    Math.hypot(segment.c2.x - segment.c1.x, segment.c2.y - segment.c1.y) +
    Math.hypot(segment.to.x - segment.c2.x, segment.to.y - segment.c2.y)
  const chord = Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y)
  return (hull + chord) / 2
}

function headingDeg(from: Point, to: Point) {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
}

function headingDelta(a: number, b: number) {
  const raw = Math.abs(a - b) % 360
  return raw > 180 ? 360 - raw : raw
}

function cubicPoint(segment: Extract<PdfPathSegment, { kind: 'cubic' }>, t: number): Point {
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

/** Direction a segment leaves its start point in. */
function entryHeading(segment: PdfPathSegment) {
  const ahead =
    segment.kind === 'line'
      ? segment.to
      : distinctFrom(segment.from, [segment.c1, segment.c2, segment.to])
  return headingDeg(segment.from, ahead)
}

/** Direction a segment arrives at its end point along. */
function exitHeading(segment: PdfPathSegment) {
  const behind =
    segment.kind === 'line'
      ? segment.from
      : distinctFrom(segment.to, [segment.c2, segment.c1, segment.from])
  return headingDeg(behind, segment.to)
}

/**
 * First candidate that is not coincident with `anchor`.
 *
 * A cubic with its handle retracted onto the anchor has no tangent there, and
 * the next control point is what the curve actually heads towards.
 */
function distinctFrom(anchor: Point, candidates: Point[]): Point {
  for (const candidate of candidates) {
    if (Math.hypot(candidate.x - anchor.x, candidate.y - anchor.y) > 1e-9) return candidate
  }
  return candidates[candidates.length - 1]
}

/** Samples a segment run, dropping the duplicated joins between segments. */
function polylineFor(segments: PdfPathSegment[], curveSamples: number): Point[] {
  const points: Point[] = [segments[0].from]
  for (const segment of segments) {
    if (segment.kind === 'line') {
      points.push(segment.to)
      continue
    }
    for (let step = 1; step <= curveSamples; step += 1) {
      points.push(cubicPoint(segment, step / curveSamples))
    }
  }
  return points
}

/**
 * Pulls each segment's start onto its predecessor's end.
 *
 * Dropping a duplicate-anchor stub leaves a gap the width of the stub. It is
 * hundredths of a millimetre, but an outline with a gap in it is not closed,
 * and closure is what makes it a piece.
 */
function weld(segments: PdfPathSegment[]): PdfPathSegment[] {
  if (segments.length < 2) return segments
  return segments.map((segment, index) => ({
    ...segment,
    from: segments[(index - 1 + segments.length) % segments.length].to,
  }))
}

/**
 * Regroups an outline's segments into sides.
 *
 * The run is rotated so it starts at a real corner before grouping. Without
 * that, a path whose first anchor sits mid-edge — the common case, since
 * Illustrator starts wherever the pen was — reports that edge as two sides and
 * every seam authored against it covers half of what it should.
 */
export function outlineSides(
  segments: PdfPathSegment[],
  idPrefix: string,
  options: Partial<OutlineSideOptions> = {},
): PatternSide[] {
  const config = { ...DEFAULT_OUTLINE_SIDE_OPTIONS, ...options }
  const kept = weld(segments.filter((segment) => segmentLength(segment) > config.minSegmentLengthMm))
  if (kept.length === 0) return []

  // Same kind only. Corner rounds join their neighbouring lines tangentially by
  // construction, so a purely tangent-based rule would swallow every corner and
  // report the whole outline as one side.
  const continues = (previous: PdfPathSegment, next: PdfPathSegment) =>
    previous.kind === next.kind &&
    headingDelta(exitHeading(previous), entryHeading(next)) <= config.collinearToleranceDeg

  let start = 0
  for (let i = 0; i < kept.length; i += 1) {
    const previous = kept[(i - 1 + kept.length) % kept.length]
    if (!continues(previous, kept[i])) {
      start = i
      break
    }
  }
  const ordered = [...kept.slice(start), ...kept.slice(0, start)]

  const groups: PdfPathSegment[][] = []
  for (const segment of ordered) {
    const current = groups[groups.length - 1]
    if (current && continues(current[current.length - 1], segment)) {
      current.push(segment)
    } else {
      groups.push([segment])
    }
  }

  return groups.map((group, index) => {
    const kind: PatternSideKind = group[0].kind === 'line' ? 'line' : 'curve'
    const polyline = polylineFor(group, 24)
    return {
      id: `${idPrefix}-side-${index + 1}`,
      kind,
      start: group[0].from,
      end: group[group.length - 1].to,
      polyline,
      lengthMm: group.reduce((sum, segment) => sum + segmentLength(segment), 0),
      segments: group,
    }
  })
}
