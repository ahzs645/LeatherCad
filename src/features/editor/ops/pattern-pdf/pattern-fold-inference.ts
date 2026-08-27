/**
 * Works out where an imported piece folds.
 *
 * A template sheet almost never draws its fold lines — the maker knows where
 * the wallet bends — so a straight import produces pieces that lie flat and an
 * assembly that never closes. Two things in the geometry do give it away, and
 * neither is a guess about intent:
 *
 * - Two stitch runs *on the same piece* that pair hole for hole can only meet
 *   if the piece folds, and the axis they meet across is the fold. A keychain
 *   tab doubled around a ring is the small case; a gusset creased down its
 *   middle is the same shape of evidence.
 * - A run that stops before it closes leaves everything past its open ends
 *   unsewn. If that leftover is a real part of the piece rather than a seam
 *   allowance, it is a flap, and it hinges across the line joining those ends.
 *
 * The second test is the one that needs a threshold, so it measures area rather
 * than counting vertices: a 3 mm strip outside a pocket's stitch line and a
 * 60 mm wallet flap both sit "past the ends", and only one of them bends.
 *
 * Where the evidence sits and where the leather bends are not quite the same
 * line, and only the flap test has to reconcile them — the line joining a run's
 * open ends runs through two of its holes, and no maker punches a hole through
 * a fold. Two runs pairing put their axis between the pairs instead, which is
 * already clear of both.
 */

import type { FoldLine, Point } from '../../cad/cad-types'
import type { AnalyzedPiece, PatternPdfAnalysis } from './pattern-pdf-analysis'
import { polygonArea } from '../polygon-ops'

export type FoldInferenceOptions = {
  /**
   * Share of a piece that must lie past a run's open ends before the leftover
   * counts as a flap rather than as seam allowance.
   */
  minFlapAreaRatio: number
}

export const DEFAULT_FOLD_INFERENCE_OPTIONS: FoldInferenceOptions = {
  minFlapAreaRatio: 0.15,
}

export type InferredFold = {
  fold: FoldLine
  /** `mirror` came from two runs pairing; `flap` from a run's open ends. */
  evidence: 'mirror' | 'flap'
}

type Line = { point: Point; direction: Point }

function normalise(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y)
  return length <= 1e-9 ? { x: 1, y: 0 } : { x: vector.x / length, y: vector.y / length }
}

function signedDistance(point: Point, line: Line) {
  // Positive on the left of `direction`.
  return (point.x - line.point.x) * line.direction.y - (point.y - line.point.y) * line.direction.x
}

/** Half-plane clip, keeping the part where `signedDistance` is positive. */
function clipToHalfPlane(polygon: Point[], line: Line): Point[] {
  const output: Point[] = []
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i]
    const next = polygon[(i + 1) % polygon.length]
    const currentInside = signedDistance(current, line) >= 0
    const nextInside = signedDistance(next, line) >= 0
    if (currentInside) output.push(current)
    if (currentInside !== nextInside) {
      const a = signedDistance(current, line)
      const b = signedDistance(next, line)
      const t = a / (a - b)
      output.push({ x: current.x + (next.x - current.x) * t, y: current.y + (next.y - current.y) * t })
    }
  }
  return output
}

/** Extends a line across the piece and returns the crossing points. */
function clipLineToPolygon(line: Line, polygon: Point[]): { start: Point; end: Point } | null {
  const hits: Point[] = []
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const da = signedDistance(a, line)
    const db = signedDistance(b, line)
    if (da === 0) hits.push(a)
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db)
      hits.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  if (hits.length < 2) return null
  let best: { start: Point; end: Point; span: number } | null = null
  for (let i = 0; i < hits.length; i += 1) {
    for (let j = i + 1; j < hits.length; j += 1) {
      const span = Math.hypot(hits[j].x - hits[i].x, hits[j].y - hits[i].y)
      if (!best || span > best.span) best = { start: hits[i], end: hits[j], span }
    }
  }
  return best && best.span > 1e-6 ? { start: best.start, end: best.end } : null
}

/** Least-squares line through a set of points, as a point and a unit direction. */
function fitLine(points: Point[]): Line | null {
  if (points.length < 2) return null
  const centre = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 },
  )
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const point of points) {
    const dx = point.x - centre.x
    const dy = point.y - centre.y
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  // Principal axis of the scatter: the eigenvector of the larger eigenvalue.
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  return { point: centre, direction: { x: Math.cos(angle), y: Math.sin(angle) } }
}

function foldFrom(
  id: string,
  name: string,
  pieceId: string,
  line: Line,
  polygon: Point[],
): FoldLine | null {
  const clipped = clipLineToPolygon(line, polygon)
  if (!clipped) return null
  return {
    id,
    name,
    start: clipped.start,
    end: clipped.end,
    pieceId,
    angleDeg: 0,
    maxAngleDeg: 180,
    // Nothing on the sheet says which way it bends. Valley is the convention
    // the editor opens with, and the user flips it in one click.
    direction: 'valley',
  }
}

/**
 * The hinge, stepped off the two holes the evidence was read from.
 *
 * The line joining a run's open ends is where the reading is, not where the
 * leather turns: it passes through the run's last hole at either end, by
 * construction. A hole punched through a fold is the weakest place on a piece —
 * the bend distorts it and the thread saws at it as the flap works — so a maker
 * stops the run short of the crease, and those two holes are the last ones
 * *before* the bend rather than the first ones in it.
 *
 * Half a pitch is how far short. A run's stitching does not end at its last
 * hole; it ends about half a pitch past it, which is the same half-pitch
 * `spansForRun` grows a seam's spans by so both sides of it come back the same
 * length. That is where the sewn part of the piece stops and the flap begins,
 * so that is where the hinge goes. The step comes off the run's own spacing:
 * a sheet punched at 3 mm stops that much shorter than one punched at 5.
 */
function clearOfTheEndHoles(line: Line, sewnSide: Point, pitchMm: number): Line {
  // `signedDistance` grows along (direction.y, −direction.x), so shifting the
  // line's own point that way carries the line the other way — towards the
  // unsewn side, which is the flap.
  const step = signedDistance(sewnSide, line) >= 0 ? -pitchMm / 2 : pitchMm / 2
  return {
    direction: line.direction,
    point: {
      x: line.point.x + line.direction.y * step,
      y: line.point.y - line.direction.x * step,
    },
  }
}

/**
 * The share of `piece` lying on the far side of `line` from `reference`.
 */
function areaRatioBeyond(piece: AnalyzedPiece, line: Line, reference: Point) {
  const total = Math.abs(polygonArea(piece.outline.polygon))
  if (total <= 0) return 0
  const away: Line = signedDistance(reference, line) >= 0
    ? { point: line.point, direction: { x: -line.direction.x, y: -line.direction.y } }
    : line
  const beyond = clipToHalfPlane(piece.outline.polygon, away)
  return beyond.length < 3 ? 0 : Math.abs(polygonArea(beyond)) / total
}

/** Derives the fold lines an analysed sheet implies. */
export function inferFoldLines(
  analysis: PatternPdfAnalysis,
  options: Partial<FoldInferenceOptions> = {},
): InferredFold[] {
  const config = { ...DEFAULT_FOLD_INFERENCE_OPTIONS, ...options }
  const pieceById = new Map(analysis.pieces.map((piece) => [piece.id, piece]))
  const runById = new Map(
    analysis.pieces.flatMap((piece) => piece.stitchRuns.map((run) => [run.id, run] as const)),
  )
  const folds: InferredFold[] = []
  const foldedRunIds = new Set<string>()

  for (const seam of analysis.seams) {
    if (!seam.fold) continue
    const piece = pieceById.get(seam.from.pieceId)
    const fromRun = runById.get(seam.from.chainId)
    const toRun = runById.get(seam.to.chainId)
    if (!piece || !fromRun || !toRun) continue
    const midpoints = fromRun.dots.map((dot, index) => {
      const mate = toRun.dots[seam.reversed ? toRun.dots.length - 1 - index : index]
      return { x: (dot.center.x + mate.center.x) / 2, y: (dot.center.y + mate.center.y) / 2 }
    })
    const line = fitLine(midpoints)
    if (!line) continue
    const fold = foldFrom(
      `${seam.id}-fold`,
      `Fold — ${seam.holeCount} holes meet across it`,
      piece.id,
      line,
      piece.outline.polygon,
    )
    if (!fold) continue
    foldedRunIds.add(fromRun.id)
    foldedRunIds.add(toRun.id)
    folds.push({ fold, evidence: 'mirror' })
  }

  for (const piece of analysis.pieces) {
    for (const run of piece.stitchRuns) {
      if (run.closed || foldedRunIds.has(run.id)) continue
      const first = run.dots[0].center
      const last = run.dots[run.dots.length - 1].center
      const chord = Math.hypot(last.x - first.x, last.y - first.y)
      if (chord < run.pitchMm * 2) continue
      const ends: Line = { point: first, direction: normalise({ x: last.x - first.x, y: last.y - first.y }) }
      // The middle of the run is squarely on the sewn side of its own ends,
      // which is what tells the two sides of the line apart.
      const sewnSide = run.dots[Math.floor(run.dots.length / 2)].center
      // Measured against the ends themselves: how much leather is left over is
      // a fact about the run, and it should not move with where the hinge lands.
      if (areaRatioBeyond(piece, ends, sewnSide) < config.minFlapAreaRatio) continue
      const fold = foldFrom(
        `${run.id}-fold`,
        `Fold — flap above ${run.holeCount}-hole seam`,
        piece.id,
        clearOfTheEndHoles(ends, sewnSide, run.pitchMm),
        piece.outline.polygon,
      )
      if (fold) folds.push({ fold, evidence: 'flap' })
    }
  }

  return folds
}
