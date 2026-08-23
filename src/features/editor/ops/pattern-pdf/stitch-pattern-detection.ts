/**
 * Reads the stitching pattern out of a piece's punch marks.
 *
 * The PDF says only "there is a 1.1 mm disc here", ninety-odd times. What a
 * sewist needs is the run: *this* row of holes, in this order, at this pitch,
 * turning these corners. Recovering it is the whole problem — pitch is what
 * pairs a pocket edge with the panel edge it is sewn to, and order is what a
 * stitch simulator plays back.
 *
 * The walk is nearest-neighbour with a turn limit. Distance alone would join
 * two rows that pass close at a corner; the turn limit is what keeps a chain
 * going straight through instead of hopping the gap, and the pitch estimate is
 * what tells a 4 mm step along a row from a 9 mm jump across one.
 */

import type { Point } from '../../cad/cad-types'
import type { PatternDot } from './pattern-separation'

export type StitchDetectionOptions = {
  /**
   * How far a gap may stray from the estimated pitch and still be a step along
   * the same row, as a fraction of that pitch.
   */
  pitchTolerance: number
  /** Sharpest turn a chain may take between consecutive holes, in degrees. */
  maxTurnDeg: number
  /** Fewest holes that count as a stitch run rather than a stray mark. */
  minChainHoles: number
}

export const DEFAULT_STITCH_DETECTION_OPTIONS: StitchDetectionOptions = {
  pitchTolerance: 0.6,
  maxTurnDeg: 100,
  minChainHoles: 3,
}

export type DetectedStitchChain = {
  id: string
  /** Holes in sewing order. */
  dots: PatternDot[]
  holeCount: number
  /** Mean gap between consecutive holes. */
  pitchMm: number
  /** Largest departure from that mean, so a caller can spot a ragged run. */
  pitchSpreadMm: number
  /** Stitches per inch, the unit the craft actually quotes. */
  stitchesPerInch: number
  /** Summed gaps, i.e. thread path length across the run. */
  lengthMm: number
  /** Mean punch diameter across the run. */
  holeDiameterMm: number
  /** True when the run comes back to its first hole at the same pitch. */
  closed: boolean
  /** Turns sharper than 30°, i.e. how many corners the run rounds. */
  cornerCount: number
}

export type StitchPattern = {
  chains: DetectedStitchChain[]
  /** Dots left out of every chain: rivet, snap, and setting marks. */
  looseDots: PatternDot[]
  /** Pitch estimate the walk ran on, before per-chain refinement. */
  estimatedPitchMm: number
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * The pitch of the densest run on the piece, as the median nearest-neighbour
 * distance.
 *
 * The median is doing real work: a sheet is mostly stitch holes, so the middle
 * of the distribution is the stitch pitch even when a handful of isolated
 * hardware marks sit tens of millimetres from anything.
 */
function estimatePitch(dots: PatternDot[]) {
  const nearest: number[] = []
  for (let i = 0; i < dots.length; i += 1) {
    let best = Infinity
    for (let j = 0; j < dots.length; j += 1) {
      if (i === j) continue
      best = Math.min(best, distance(dots[i].center, dots[j].center))
    }
    if (Number.isFinite(best)) nearest.push(best)
  }
  return median(nearest)
}

function turnDegrees(from: Point, via: Point, to: Point) {
  const ax = via.x - from.x
  const ay = via.y - from.y
  const bx = to.x - via.x
  const by = to.y - via.y
  const na = Math.hypot(ax, ay)
  const nb = Math.hypot(bx, by)
  if (na <= 1e-9 || nb <= 1e-9) return 0
  const cos = Math.min(1, Math.max(-1, (ax * bx + ay * by) / (na * nb)))
  return (Math.acos(cos) * 180) / Math.PI
}

type Walker = {
  neighbours: number[][]
  dots: PatternDot[]
  maxTurnDeg: number
}

/**
 * Extends a run one hole at a time, preferring the straightest continuation.
 *
 * Straightest rather than nearest: at a rounded corner the hole across the
 * corner is often marginally closer than the next hole along the row, and
 * following distance alone cuts the corner and strands the holes it skipped.
 */
function walkFrom(walker: Walker, start: number, visited: Set<number>): number[] {
  const run = [start]
  visited.add(start)
  let previous: Point | null = null
  let current = start
  for (;;) {
    let best: number | null = null
    let bestScore = Infinity
    for (const candidate of walker.neighbours[current]) {
      if (visited.has(candidate)) continue
      const turn = previous
        ? turnDegrees(previous, walker.dots[current].center, walker.dots[candidate].center)
        : 0
      if (turn > walker.maxTurnDeg) continue
      // Turn dominates; distance only breaks ties between equally straight
      // continuations.
      const score = turn * 10 + distance(walker.dots[current].center, walker.dots[candidate].center)
      if (score < bestScore) {
        bestScore = score
        best = candidate
      }
    }
    if (best === null) return run
    visited.add(best)
    previous = walker.dots[current].center
    run.push(best)
    current = best
  }
}

function summarise(id: string, dots: PatternDot[], pitchTolerance: number): DetectedStitchChain {
  const gaps: number[] = []
  for (let i = 1; i < dots.length; i += 1) {
    gaps.push(distance(dots[i - 1].center, dots[i].center))
  }
  const lengthMm = gaps.reduce((sum, gap) => sum + gap, 0)
  const pitchMm = gaps.length > 0 ? lengthMm / gaps.length : 0
  const pitchSpreadMm = gaps.reduce((worst, gap) => Math.max(worst, Math.abs(gap - pitchMm)), 0)
  const closingGap = distance(dots[dots.length - 1].center, dots[0].center)
  let cornerCount = 0
  for (let i = 1; i < dots.length - 1; i += 1) {
    if (turnDegrees(dots[i - 1].center, dots[i].center, dots[i + 1].center) > 30) cornerCount += 1
  }
  return {
    id,
    dots,
    holeCount: dots.length,
    pitchMm,
    pitchSpreadMm,
    stitchesPerInch: pitchMm > 0 ? 25.4 / pitchMm : 0,
    lengthMm,
    holeDiameterMm: dots.reduce((sum, dot) => sum + dot.diameterMm, 0) / dots.length,
    closed: dots.length > 2 && Math.abs(closingGap - pitchMm) <= pitchMm * pitchTolerance,
    cornerCount,
  }
}

/**
 * Groups a piece's punch marks into stitch runs.
 *
 * `idPrefix` names the chains, so a caller can keep runs from different pieces
 * apart in one flat list.
 */
export function detectStitchPattern(
  dots: PatternDot[],
  idPrefix = 'chain',
  options: Partial<StitchDetectionOptions> = {},
): StitchPattern {
  const config = { ...DEFAULT_STITCH_DETECTION_OPTIONS, ...options }
  if (dots.length < config.minChainHoles) {
    return { chains: [], looseDots: [...dots], estimatedPitchMm: 0 }
  }

  const estimatedPitchMm = estimatePitch(dots)
  const linkMax = estimatedPitchMm * (1 + config.pitchTolerance)
  const neighbours: number[][] = dots.map(() => [])
  for (let i = 0; i < dots.length; i += 1) {
    for (let j = i + 1; j < dots.length; j += 1) {
      if (distance(dots[i].center, dots[j].center) <= linkMax) {
        neighbours[i].push(j)
        neighbours[j].push(i)
      }
    }
  }

  const walker: Walker = { neighbours, dots, maxTurnDeg: config.maxTurnDeg }
  const visited = new Set<number>()
  const runs: number[][] = []
  // Ends first: starting mid-row would split one run into two half-runs.
  const order = dots
    .map((_, index) => index)
    .sort((a, b) => neighbours[a].length - neighbours[b].length)
  for (const index of order) {
    if (visited.has(index)) continue
    if (neighbours[index].length === 0) continue
    runs.push(walkFrom(walker, index, visited))
  }

  const chains: DetectedStitchChain[] = []
  const looseDots: PatternDot[] = []
  for (let index = 0; index < dots.length; index += 1) {
    if (!visited.has(index)) looseDots.push(dots[index])
  }
  let sequence = 0
  for (const run of runs) {
    const runDots = run.map((index) => dots[index])
    if (runDots.length < config.minChainHoles) {
      looseDots.push(...runDots)
      continue
    }
    sequence += 1
    chains.push(summarise(`${idPrefix}-${sequence}`, runDots, config.pitchTolerance))
  }
  // Longest run first: that is the seam a reader cares about.
  chains.sort((a, b) => b.holeCount - a.holeCount)
  return { chains, looseDots, estimatedPitchMm }
}
