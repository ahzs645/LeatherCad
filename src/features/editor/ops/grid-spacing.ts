/**
 * Compute the "nice" grid spacing for the current zoom level.
 * Uses a 1-2-5 sequence (like engineering graph paper) so zooming out
 * collapses the visible grid to coarser, readable intervals and zooming in
 * reveals finer subdivisions.
 *
 * `baseSpacing` is the user-selected drafting/snap interval. It is included in
 * the candidate sequence, but the visible grid is allowed to become coarser
 * than that interval when zoomed out.
 */
export function computeAdaptiveSpacing(scale: number, baseSpacing: number): { major: number; minor: number } {
  const targetScreenPx = 80
  const idealWorldSpacing = targetScreenPx / Math.max(scale, 0.0001)

  const major = niceRound(Math.max(idealWorldSpacing, baseSpacing / 10))
  const subdivisions = major <= 2 ? 2 : 5
  const minor = major / subdivisions

  return { major, minor }
}

function niceRound(value: number) {
  const safeValue = Math.max(value, 0.0001)
  const exponent = Math.floor(Math.log10(safeValue))
  const magnitude = 10 ** exponent
  const normalized = safeValue / magnitude

  if (normalized < 1.5) return 1 * magnitude
  if (normalized < 3.5) return 2 * magnitude
  if (normalized < 7.5) return 5 * magnitude

  return 10 * magnitude
}
