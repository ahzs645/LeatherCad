/**
 * The order a project is stitched in, as stitch counts rather than as a list.
 *
 * Seams already carry a `sequence`, and the document tree and the placement
 * solver both walk them in that order — but nothing turned it into something you
 * could scrub. This lays the seams end to end on one stitch axis, so "sewn up to
 * stitch N" names a point part-way along a specific seam, and a project can be
 * watched closing one seam at a time.
 *
 * This is the counterpart of the `seamStitchRanges` / `stitchCount` pair Seamer's
 * cloth build produces to make a garment zip shut rather than snap.
 */

import type { SeamConnection } from '../cad/cad-types'
import type { StitchPair } from '../three/final-product-types'
import { seamsInSewOrder } from './seam-spans'

export type SeamStitchRange = {
  seamId: string
  /** Display name for the seam, for the scrubber's caption. */
  name: string
  /** First stitch index belonging to this seam. */
  start: number
  /** One past the last stitch index belonging to this seam. */
  end: number
}

export type SeamSewPlan = {
  ranges: SeamStitchRange[]
  /** Total stitches across every seam. The scrubber runs from 0 to this. */
  stitchCount: number
}

/** The connection id a compiled pair belongs to, or null if it carries none. */
export function connectionIdForPair(pair: StitchPair): string | null {
  return pair.left.holes[0]?.connectionId ?? pair.right.holes[0]?.connectionId ?? null
}

/**
 * Lay the seams end to end on one stitch axis, in sewing order.
 *
 * Seams with no compiled stitches — an aligned seam, or one whose sides no
 * longer resolve — take a zero-width range rather than being dropped, so the
 * caption can still name them and the indices stay stable as geometry changes.
 */
export function buildSeamSewPlan(params: {
  seamConnections: SeamConnection[]
  stitchPairs: StitchPair[]
  pieceNameById?: Map<string, string>
}): SeamSewPlan {
  const stitchesByConnection = new Map<string, number>()
  for (const pair of params.stitchPairs) {
    const connectionId = connectionIdForPair(pair)
    if (!connectionId) {
      continue
    }
    stitchesByConnection.set(
      connectionId,
      (stitchesByConnection.get(connectionId) ?? 0) + Math.min(pair.left.holes.length, pair.right.holes.length),
    )
  }

  const ranges: SeamStitchRange[] = []
  let cursor = 0
  for (const connection of seamsInSewOrder(params.seamConnections)) {
    const stitches = stitchesByConnection.get(connection.id) ?? 0
    ranges.push({
      seamId: connection.id,
      name: connection.name ?? connection.id,
      start: cursor,
      end: cursor + stitches,
    })
    cursor += stitches
  }

  return { ranges, stitchCount: cursor }
}

export type SewProgress = {
  /** Stitches sewn so far, clamped into the plan. */
  sewnStitchCount: number
  /** The seam currently under the needle, or null when finished or not started. */
  activeSeam: SeamStitchRange | null
  /** How far through the active seam, 0..1. */
  activeSeamProgress: number
  /** Seams fully sewn. */
  completedSeamIds: string[]
}

/** Where a given stitch count falls in the plan. */
export function resolveSewProgress(plan: SeamSewPlan, sewnStitchCount: number): SewProgress {
  const sewn = Math.min(Math.max(Math.round(sewnStitchCount), 0), plan.stitchCount)
  const completedSeamIds: string[] = []
  let activeSeam: SeamStitchRange | null = null
  let activeSeamProgress = 0

  for (const range of plan.ranges) {
    if (range.end <= sewn) {
      // A zero-width seam is not something you can be part-way through, but it
      // is finished the moment the needle reaches it.
      completedSeamIds.push(range.seamId)
      continue
    }
    if (range.start < sewn && activeSeam === null) {
      activeSeam = range
      const span = range.end - range.start
      activeSeamProgress = span <= 0 ? 1 : (sewn - range.start) / span
    }
  }

  return { sewnStitchCount: sewn, activeSeam, activeSeamProgress, completedSeamIds }
}

/**
 * How much of one seam is sewn at a given stitch count, as 0..1.
 *
 * Renderers use this to clip a seam's stitching: 0 draws nothing, 1 draws the
 * whole run, and anything between draws the leading portion so the seam closes
 * progressively rather than appearing all at once.
 */
export function sewnFractionForSeam(
  plan: SeamSewPlan,
  seamId: string,
  sewnStitchCount: number | null | undefined,
): number {
  if (sewnStitchCount === null || sewnStitchCount === undefined) {
    // No scrubber in play: everything is sewn.
    return 1
  }
  const range = plan.ranges.find((entry) => entry.seamId === seamId)
  if (!range) {
    return 1
  }
  const sewn = Math.min(Math.max(sewnStitchCount, 0), plan.stitchCount)
  if (sewn >= range.end) {
    return 1
  }
  if (sewn <= range.start) {
    return 0
  }
  const span = range.end - range.start
  return span <= 0 ? 1 : (sewn - range.start) / span
}
