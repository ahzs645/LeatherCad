import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

const BOX_STITCH_DISTANCE_KEY = 'leathercad-box-stitch-distance-v1'
const DEFAULT_BOX_STITCH_DISTANCE_MM = 6

export function loadBoxStitchDistanceMm() {
  if (typeof window === 'undefined') {
    return DEFAULT_BOX_STITCH_DISTANCE_MM
  }

  const raw = safeLocalStorageGet(BOX_STITCH_DISTANCE_KEY)
  if (!raw) {
    return DEFAULT_BOX_STITCH_DISTANCE_MM
  }

  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_BOX_STITCH_DISTANCE_MM
  }

  return value
}

export function saveBoxStitchDistanceMm(distanceMm: number) {
  if (typeof window === 'undefined' || !Number.isFinite(distanceMm) || distanceMm <= 0) {
    return
  }

  safeLocalStorageSet(BOX_STITCH_DISTANCE_KEY, String(distanceMm))
}
