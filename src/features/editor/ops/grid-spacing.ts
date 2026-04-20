/**
 * Compute the "nice" grid spacing for the current zoom level.
 * Uses a 1-2-5 sequence (like engineering graph paper) so that as you zoom in,
 * the grid smoothly subdivides into finer increments.
 *
 * `baseSpacing` is the user-selected fallback (and also the snap step). The
 * adaptive major will never be coarser than `baseSpacing` — zooming out still
 * shows the user's requested spacing; zooming in reveals finer subdivisions.
 */
export function computeAdaptiveSpacing(scale: number, baseSpacing: number): { major: number; minor: number } {
  const targetScreenPx = 80
  const idealWorldSpacing = targetScreenPx / Math.max(scale, 0.0001)

  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]

  let major = baseSpacing
  let bestDiff = Infinity
  for (const step of steps) {
    if (step > baseSpacing) continue
    const diff = Math.abs(step - idealWorldSpacing)
    if (diff < bestDiff) {
      bestDiff = diff
      major = step
    }
  }

  const subdivisions = major <= 2 ? 2 : 5
  const minor = major / subdivisions

  return { major, minor }
}
