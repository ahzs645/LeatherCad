/**
 * Turning a measured pattern into a shopping list.
 *
 * This is the arithmetic a leatherworker does on paper before cutting: how
 * much hide the pieces need once nesting waste is allowed for, how many hides
 * that is, what it costs, and how much thread the stitch runs will eat. It is
 * pure so it can be tested, and so the agent-facing tool is a thin wrapper
 * over it rather than the place the maths lives.
 *
 * Leather is sold by area, in square feet in most of the English-speaking
 * trade and in square decimetres elsewhere, so both come back in the answer.
 */

import type { PieceMeasurement } from './webmcp-measure'

export const MM2_PER_SQFT = 92903.04
export const MM2_PER_DM2 = 10000

/**
 * Fraction of a hide that ends up in pieces. A hide is an irregular shape with
 * thin, stretchy belly and neck that most patterns will not take, so even good
 * nesting leaves a lot behind — 0.65 is a common working figure for firm
 * bag and wallet work and is the default here. Callers who nest onto
 * rectangular panel stock should raise it.
 */
export const DEFAULT_NESTING_EFFICIENCY = 0.65

/**
 * Saddle stitching runs two needles from one length of thread, and the thread
 * has to be long enough to hold and to finish back-stitches at both ends. The
 * trade rule of thumb is between three and four times the seam; 3.5 is the
 * midpoint and the default here.
 */
export const DEFAULT_THREAD_MULTIPLIER = 3.5

export type MaterialEstimateOptions = {
  hideAreaMm2: number | null
  nestingEfficiency: number
  pricePerSqft: number | null
  pricePerHide: number | null
  threadMultiplier: number
  stitchRunMm: number
}

export type MaterialEstimate = {
  pieceCount: number
  totalCutPieces: number
  netAreaMm2: number
  netAreaSqft: number
  netAreaDm2: number
  nestingEfficiency: number
  grossAreaMm2: number
  grossAreaSqft: number
  grossAreaDm2: number
  wasteAreaSqft: number
  hidesRequired: number | null
  estimatedCost: number | null
  costCurrencyNote: string | null
  threadLengthMm: number
  threadLengthM: number
  largestPiece: { name: string; widthMm: number; heightMm: number } | null
  notes: string[]
}

export function sqft(areaMm2: number): number {
  return areaMm2 / MM2_PER_SQFT
}

export function dm2(areaMm2: number): number {
  return areaMm2 / MM2_PER_DM2
}

export function estimateMaterial(
  pieces: PieceMeasurement[],
  options: MaterialEstimateOptions,
): MaterialEstimate {
  const efficiency = Math.min(Math.max(options.nestingEfficiency, 0.05), 1)
  const netAreaMm2 = pieces.reduce(
    (sum, piece) => sum + piece.cutAreaMm2 * Math.max(1, piece.quantity),
    0,
  )
  const grossAreaMm2 = efficiency > 0 ? netAreaMm2 / efficiency : 0
  const totalCutPieces = pieces.reduce((sum, piece) => sum + Math.max(1, piece.quantity), 0)

  const notes: string[] = []
  if (pieces.length === 0) {
    notes.push('The document has no pattern pieces, so there is nothing to cut yet.')
  }
  const unresolved = pieces.filter((piece) => piece.perimeterMm === 0)
  if (unresolved.length > 0) {
    notes.push(
      `${unresolved.length} piece(s) have no closed boundary and contribute no area: ${unresolved
        .map((piece) => piece.name)
        .join(', ')}.`,
    )
  }

  let hidesRequired: number | null = null
  if (options.hideAreaMm2 !== null && options.hideAreaMm2 > 0) {
    hidesRequired = grossAreaMm2 > 0 ? Math.ceil(grossAreaMm2 / options.hideAreaMm2) : 0
    const largest = pieces.reduce<PieceMeasurement | null>(
      (best, piece) => (best === null || piece.cutAreaMm2 > best.cutAreaMm2 ? piece : best),
      null,
    )
    if (largest && largest.cutAreaMm2 > options.hideAreaMm2) {
      notes.push(
        `"${largest.name}" alone is larger than one hide, so it cannot be cut from the stock given.`,
      )
    }
  }

  let estimatedCost: number | null = null
  let costCurrencyNote: string | null = null
  if (options.pricePerHide !== null && hidesRequired !== null) {
    estimatedCost = hidesRequired * options.pricePerHide
    costCurrencyNote = 'Cost is hides required x price_per_hide, in whatever currency was supplied.'
  } else if (options.pricePerSqft !== null) {
    estimatedCost = sqft(grossAreaMm2) * options.pricePerSqft
    costCurrencyNote =
      'Cost is gross area x price_per_sqft, in whatever currency was supplied. It assumes leather can be bought by the foot rather than by the whole hide.'
  }

  const threadLengthMm = options.stitchRunMm * options.threadMultiplier
  if (options.stitchRunMm === 0) {
    notes.push('No stitch holes are placed yet, so the thread estimate is zero.')
  }

  const largestPiece = pieces.reduce<PieceMeasurement | null>(
    (best, piece) =>
      best === null || piece.widthMm * piece.heightMm > best.widthMm * best.heightMm ? piece : best,
    null,
  )

  return {
    pieceCount: pieces.length,
    totalCutPieces,
    netAreaMm2,
    netAreaSqft: sqft(netAreaMm2),
    netAreaDm2: dm2(netAreaMm2),
    nestingEfficiency: efficiency,
    grossAreaMm2,
    grossAreaSqft: sqft(grossAreaMm2),
    grossAreaDm2: dm2(grossAreaMm2),
    wasteAreaSqft: sqft(Math.max(0, grossAreaMm2 - netAreaMm2)),
    hidesRequired,
    estimatedCost,
    costCurrencyNote,
    threadLengthMm,
    threadLengthM: threadLengthMm / 1000,
    largestPiece: largestPiece
      ? {
          name: largestPiece.name,
          widthMm: largestPiece.widthMm,
          heightMm: largestPiece.heightMm,
        }
      : null,
    notes,
  }
}
