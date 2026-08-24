/**
 * The whole read of a pattern PDF, in one call.
 *
 * Runs the four stages in order — separate the sheet into pieces, regroup each
 * outline into sides, chain the punch marks into stitch runs, pair the runs
 * that meet — and ties the results together: every run knows which sides of its
 * piece it follows, so a seam can be expressed against the geometry rather than
 * against a list of coordinates.
 */

import { pointInPolygon } from '@atelier/geometry'

import type { Point } from '../../cad/cad-types'
import type { PdfTextItem, PdfVectorPath } from './pdf-vector-paths'
import { outlineSides, type PatternSide } from './pattern-outline-sides'
import { namePiecesFromLabels } from './pattern-piece-naming'
import {
  separatePatternPaths,
  type PatternDot,
  type PatternOutline,
  type PatternSeparationOptions,
} from './pattern-separation'
import {
  detectStitchPattern,
  type DetectedStitchChain,
  type StitchDetectionOptions,
} from './stitch-pattern-detection'
import {
  matchStitchSeams,
  type ChainOnPiece,
  type SeamMatchOptions,
  type StitchSeamMatch,
} from './stitch-seam-matching'

export type PatternAnalysisOptions = {
  separation: Partial<PatternSeparationOptions>
  stitching: Partial<StitchDetectionOptions>
  seams: Partial<SeamMatchOptions>
}

/** The stretch of one outline side a stitch run covers, 0..1 along that side. */
export type StitchRunSpan = {
  sideId: string
  t0: number
  t1: number
  /** The run crosses this side against the direction the side was drawn in. */
  reversed: boolean
}

export type AnalyzedStitchRun = DetectedStitchChain & {
  pieceId: string
  /** Sides the run follows, in the order it reaches them. */
  spans: StitchRunSpan[]
  /**
   * The run as a whole travels against the outline's winding.
   *
   * A seam has to name its sides in walk order to describe one continuous
   * stretch of boundary, so a consumer reverses `spans` when this is set rather
   * than handing over a list that doubles back at every join.
   */
  spansReversed: boolean
}

export type AnalyzedHole = {
  id: string
  pieceId: string
  center: Point
  diameterMm: number
  /** Stroked marks are cut out; filled ones only mark where hardware goes. */
  cut: boolean
}

export type AnalyzedPiece = {
  id: string
  /** What the sheet calls this piece, when it says. */
  name?: string
  /** Type printed on the piece, including the lines `name` was drawn from. */
  labels: PdfTextItem[]
  outline: PatternOutline
  sides: PatternSide[]
  cutouts: PatternOutline[]
  stitchRuns: AnalyzedStitchRun[]
  /** Punches too isolated to be stitching: snap, rivet, and post holes. */
  hardwareHoles: AnalyzedHole[]
  widthMm: number
  heightMm: number
  areaMm2: number
}

export type StitchingSummary = {
  /** Hole-count-weighted mean pitch across every run on the sheet. */
  pitchMm: number
  stitchesPerInch: number
  holeDiameterMm: number
  totalHoles: number
  runCount: number
}

export type PatternPdfAnalysis = {
  page: { widthMm: number; heightMm: number }
  pieces: AnalyzedPiece[]
  seams: StitchSeamMatch[]
  stitching: StitchingSummary
  /** Paths read as artwork rather than pattern — logos, legends, clip frames. */
  ignoredPathCount: number
  /** Punch marks that landed on no piece. Usually part of a logo. */
  strayDotCount: number
  /** Type that sits on no piece: print-scale warnings, sheet titles. */
  sheetLabels: PdfTextItem[]
}

type SideProjection = {
  sideId: string
  /** Position along the side, 0..1. */
  t: number
  distanceMm: number
}

/** Projects a point onto a side and reports where it lands and how far off it is. */
function projectOntoSide(point: Point, side: PatternSide): SideProjection {
  let travelled = 0
  let bestDistance = Infinity
  let bestTravel = 0
  for (let i = 1; i < side.polyline.length; i += 1) {
    const a = side.polyline[i - 1]
    const b = side.polyline[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq <= 1e-12 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
    const closest = { x: a.x + dx * t, y: a.y + dy * t }
    const distance = Math.hypot(point.x - closest.x, point.y - closest.y)
    if (distance < bestDistance) {
      bestDistance = distance
      bestTravel = travelled + Math.sqrt(lengthSq) * t
    }
    travelled += Math.sqrt(lengthSq)
  }
  return {
    sideId: side.id,
    t: travelled <= 0 ? 0 : bestTravel / travelled,
    distanceMm: bestDistance,
  }
}

function nearestSide(point: Point, sides: PatternSide[]): SideProjection | null {
  let best: SideProjection | null = null
  for (const side of sides) {
    const projection = projectOntoSide(point, side)
    if (!best || projection.distanceMm < best.distanceMm) best = projection
  }
  return best
}

/**
 * Works out which sides a run follows and how much of each it covers.
 *
 * Holes mark the middle of the stitching, not its ends: the first hole of a run
 * sits about half a pitch inside where the sewn edge begins. So each span is
 * grown by half a pitch at both ends, and one that then reaches within half a
 * pitch of the side's end is snapped to it. Without both, the two sides of a
 * seam come back with different lengths purely because one piece's run happens
 * to start closer to its corner than the other's.
 */
function spansForRun(
  run: DetectedStitchChain,
  sides: PatternSide[],
): { spans: StitchRunSpan[]; spansReversed: boolean } {
  const sideById = new Map(sides.map((side) => [side.id, side]))
  const order: string[] = []
  const extent = new Map<string, { t0: number; t1: number; first: number; last: number; count: number }>()
  for (const dot of run.dots) {
    const projection = nearestSide(dot.center, sides)
    if (!projection) continue
    const current = extent.get(projection.sideId)
    if (!current) {
      order.push(projection.sideId)
      extent.set(projection.sideId, {
        t0: projection.t,
        t1: projection.t,
        first: projection.t,
        last: projection.t,
        count: 1,
      })
    } else {
      current.t0 = Math.min(current.t0, projection.t)
      current.t1 = Math.max(current.t1, projection.t)
      current.last = projection.t
      current.count += 1
    }
  }

  // Whether the run runs with or against the outline's winding, voted on by
  // hole count: a side carrying one hole says nothing about direction, and a
  // side carrying twenty says it clearly.
  let againstVotes = 0
  let withVotes = 0
  for (const sideId of order) {
    const entry = extent.get(sideId)
    if (!entry || entry.count < 2) continue
    if (entry.last < entry.first) againstVotes += entry.count
    else withVotes += entry.count
  }
  const spansReversed = againstVotes > withVotes

  const spans = order.map((sideId) => {
    const side = sideById.get(sideId)
    const entry = extent.get(sideId) ?? { t0: 0, t1: 1, first: 0, last: 1, count: 0 }
    const reach = side && side.lengthMm > 0 ? run.pitchMm / 2 / side.lengthMm : 0
    const t0 = entry.t0 - reach
    const t1 = entry.t1 + reach
    return {
      sideId,
      t0: t0 <= reach ? 0 : t0,
      t1: t1 >= 1 - reach ? 1 : t1,
      reversed: entry.count >= 2 ? entry.last < entry.first : spansReversed,
    }
  })
  return { spans, spansReversed }
}

/**
 * Tells a hardware hole from a stitch hole among the marks left unchained.
 *
 * Chaining already caught everything punched in a row, so what is left is
 * isolated by definition. A stroked circle is cut; a filled disc that big is
 * where a snap goes, and only the setter goes through it.
 */
function toHardwareHole(dot: PatternDot, pieceId: string): AnalyzedHole {
  return {
    id: dot.id,
    pieceId,
    center: dot.center,
    diameterMm: dot.diameterMm,
    cut: dot.paint !== 'fill',
  }
}

/** Reads a page of pattern paths into pieces, stitch runs, and the seams. */
export function analyzePatternPaths(
  paths: PdfVectorPath[],
  page: { widthMm: number; heightMm: number },
  options: Partial<PatternAnalysisOptions> = {},
  text: PdfTextItem[] = [],
): PatternPdfAnalysis {
  const separation = separatePatternPaths(paths, options.separation)
  const pieces: AnalyzedPiece[] = []
  const chains: ChainOnPiece[] = []

  // Type is filed by where it sits. A label over a piece describes that piece;
  // anything else is the sheet talking to whoever printed it.
  const labelsByPieceId = new Map<string, PdfTextItem[]>()
  const sheetLabels: PdfTextItem[] = []
  for (const item of text) {
    const host = separation.pieces.find((piece) => pointInPolygon(item.position, piece.outline.polygon))
    if (!host) {
      sheetLabels.push(item)
      continue
    }
    labelsByPieceId.set(host.id, [...(labelsByPieceId.get(host.id) ?? []), item])
  }
  const namesByPieceId = namePiecesFromLabels(labelsByPieceId)

  for (const piece of separation.pieces) {
    const sides = outlineSides(piece.outline.segments, piece.id)
    const pattern = detectStitchPattern(piece.dots, piece.id, options.stitching)
    const stitchRuns = pattern.chains.map((chain) => ({
      ...chain,
      pieceId: piece.id,
      ...spansForRun(chain, sides),
    }))
    for (const chain of pattern.chains) {
      chains.push({ pieceId: piece.id, chain })
    }
    pieces.push({
      id: piece.id,
      name: namesByPieceId.get(piece.id),
      labels: labelsByPieceId.get(piece.id) ?? [],
      outline: piece.outline,
      sides,
      cutouts: piece.cutouts,
      stitchRuns,
      hardwareHoles: pattern.looseDots.map((dot) => toHardwareHole(dot, piece.id)),
      widthMm: piece.outline.bounds.width,
      heightMm: piece.outline.bounds.height,
      areaMm2: piece.outline.areaMm2,
    })
  }

  const allRuns = pieces.flatMap((piece) => piece.stitchRuns)
  const totalHoles = allRuns.reduce((sum, run) => sum + run.holeCount, 0)
  const weighted = (pick: (run: AnalyzedStitchRun) => number) =>
    totalHoles === 0 ? 0 : allRuns.reduce((sum, run) => sum + pick(run) * run.holeCount, 0) / totalHoles
  const pitchMm = weighted((run) => run.pitchMm)

  return {
    page,
    pieces,
    seams: matchStitchSeams(chains, options.seams),
    stitching: {
      pitchMm,
      stitchesPerInch: pitchMm > 0 ? 25.4 / pitchMm : 0,
      holeDiameterMm: weighted((run) => run.holeDiameterMm),
      totalHoles,
      runCount: allRuns.length,
    },
    ignoredPathCount: separation.ignored.length,
    strayDotCount: separation.strayDots.length,
    sheetLabels,
  }
}
