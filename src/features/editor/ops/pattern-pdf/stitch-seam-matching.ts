/**
 * Pairs stitch runs that get sewn to each other.
 *
 * A template sheet draws each piece flat and separate, and never says which
 * edge meets which. The holes do say it: a maker punches both sides of a seam
 * with the same chisel in the same passes, so the two runs come out with the
 * same hole count, the same length, and the same sequence of turns. Three
 * matching signals is enough to pair them, and enough to tell which end of one
 * run meets which end of the other.
 *
 * Two runs on the *same* piece that match this way are a fold: a tab doubled
 * over and sewn to itself. Same test, different meaning, so both come back
 * labelled rather than merged.
 */

import type { Point } from '../../cad/cad-types'
import type { DetectedStitchChain } from './stitch-pattern-detection'

export type SeamMatchOptions = {
  /** How far two run lengths may differ and still pair, as a fraction. */
  lengthTolerance: number
  /** Mean per-hole turn disagreement allowed between the two runs, in degrees. */
  maxTurnMismatchDeg: number
  /** Fewest holes a pairing is worth reporting. */
  minHoles: number
}

export const DEFAULT_SEAM_MATCH_OPTIONS: SeamMatchOptions = {
  lengthTolerance: 0.05,
  maxTurnMismatchDeg: 12,
  minHoles: 3,
}

export type StitchSeamMatch = {
  id: string
  from: { pieceId: string; chainId: string }
  to: { pieceId: string; chainId: string }
  /** `to` runs against `from` end-to-start. */
  reversed: boolean
  holeCount: number
  /** Mean of the two run lengths. */
  lengthMm: number
  /** Difference between them — the ease one side has to absorb. */
  lengthDeltaMm: number
  pitchMm: number
  /** Mean per-hole turn disagreement; 0 is a perfect shape match. */
  turnMismatchDeg: number
  /** Same piece on both sides: the piece folds and is sewn to itself. */
  fold: boolean
}

export type ChainOnPiece = {
  pieceId: string
  chain: DetectedStitchChain
}

/**
 * Signed turn at each interior hole, in degrees.
 *
 * Signed rather than absolute so a left-hand corner never matches a right-hand
 * one: two runs with mirrored corners have the same lengths and hole counts and
 * cannot be sewn together.
 */
function turnProfile(points: Point[]): number[] {
  const turns: number[] = []
  for (let i = 1; i < points.length - 1; i += 1) {
    const ax = points[i].x - points[i - 1].x
    const ay = points[i].y - points[i - 1].y
    const bx = points[i + 1].x - points[i].x
    const by = points[i + 1].y - points[i].y
    const cross = ax * by - ay * bx
    const dot = ax * bx + ay * by
    turns.push((Math.atan2(cross, dot) * 180) / Math.PI)
  }
  return turns
}

/**
 * Mean per-hole disagreement between two turn profiles.
 *
 * Reversing a run reverses its turns and flips their sign, and the two sides of
 * a seam are laid face to face, so a real pair matches either directly or under
 * that transform — never both, unless the run is straight.
 */
function turnMismatch(a: number[], b: number[], reversed: boolean) {
  if (a.length !== b.length) return Infinity
  if (a.length === 0) return 0
  let total = 0
  for (let i = 0; i < a.length; i += 1) {
    const other = reversed ? -b[b.length - 1 - i] : b[i]
    total += Math.abs(a[i] - other)
  }
  return total / a.length
}

/**
 * Finds the seams among a set of stitch runs.
 *
 * Every pair is scored and the best non-conflicting ones are taken first, so a
 * run that could plausibly meet two others goes to the one it fits best rather
 * than to whichever was considered first.
 */
export function matchStitchSeams(
  chains: ChainOnPiece[],
  options: Partial<SeamMatchOptions> = {},
): StitchSeamMatch[] {
  const config = { ...DEFAULT_SEAM_MATCH_OPTIONS, ...options }
  const profiles = chains.map((entry) => turnProfile(entry.chain.dots.map((dot) => dot.center)))

  type Scored = { i: number; j: number; reversed: boolean; mismatch: number; lengthDeltaMm: number }
  const scored: Scored[] = []
  for (let i = 0; i < chains.length; i += 1) {
    for (let j = i + 1; j < chains.length; j += 1) {
      const left = chains[i].chain
      const right = chains[j].chain
      if (left.holeCount !== right.holeCount) continue
      if (left.holeCount < config.minHoles) continue
      const lengthDeltaMm = Math.abs(left.lengthMm - right.lengthMm)
      const longest = Math.max(left.lengthMm, right.lengthMm)
      if (longest <= 0 || lengthDeltaMm / longest > config.lengthTolerance) continue
      const direct = turnMismatch(profiles[i], profiles[j], false)
      const flipped = turnMismatch(profiles[i], profiles[j], true)
      const reversed = flipped < direct
      const mismatch = Math.min(direct, flipped)
      if (mismatch > config.maxTurnMismatchDeg) continue
      scored.push({ i, j, reversed, mismatch, lengthDeltaMm })
    }
  }

  scored.sort((a, b) => a.mismatch - b.mismatch || a.lengthDeltaMm - b.lengthDeltaMm)
  const taken = new Set<number>()
  const matches: StitchSeamMatch[] = []
  for (const candidate of scored) {
    if (taken.has(candidate.i) || taken.has(candidate.j)) continue
    taken.add(candidate.i)
    taken.add(candidate.j)
    const left = chains[candidate.i]
    const right = chains[candidate.j]
    matches.push({
      id: `seam-${matches.length + 1}`,
      from: { pieceId: left.pieceId, chainId: left.chain.id },
      to: { pieceId: right.pieceId, chainId: right.chain.id },
      reversed: candidate.reversed,
      holeCount: left.chain.holeCount,
      lengthMm: (left.chain.lengthMm + right.chain.lengthMm) / 2,
      lengthDeltaMm: candidate.lengthDeltaMm,
      pitchMm: (left.chain.pitchMm + right.chain.pitchMm) / 2,
      turnMismatchDeg: candidate.mismatch,
      fold: left.pieceId === right.pieceId,
    })
  }
  return matches
}
