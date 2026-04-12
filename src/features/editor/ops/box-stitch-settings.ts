import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

export type BoxStitchHelperSettings = {
  distanceMm: number
  stretchCompensationPercent: number
}

const BOX_STITCH_HELPER_SETTINGS_KEY = 'leathercad-box-stitch-helper-settings-v1'
const LEGACY_BOX_STITCH_DISTANCE_KEY = 'leathercad-box-stitch-distance-v1'
const DEFAULT_BOX_STITCH_DISTANCE_MM = 6
const DEFAULT_STRETCH_COMPENSATION_PERCENT = 100

export function getDefaultBoxStitchHelperSettings(): BoxStitchHelperSettings {
  return {
    distanceMm: DEFAULT_BOX_STITCH_DISTANCE_MM,
    stretchCompensationPercent: DEFAULT_STRETCH_COMPENSATION_PERCENT,
  }
}

export function loadBoxStitchHelperSettings() {
  const defaults = getDefaultBoxStitchHelperSettings()
  if (typeof window === 'undefined') {
    return defaults
  }

  const raw = safeLocalStorageGet(BOX_STITCH_HELPER_SETTINGS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<BoxStitchHelperSettings>
      return {
        distanceMm:
          Number.isFinite(parsed.distanceMm) && (parsed.distanceMm ?? 0) > 0
            ? parsed.distanceMm ?? defaults.distanceMm
            : defaults.distanceMm,
        stretchCompensationPercent:
          Number.isFinite(parsed.stretchCompensationPercent) && (parsed.stretchCompensationPercent ?? 0) > 0
            ? parsed.stretchCompensationPercent ?? defaults.stretchCompensationPercent
            : defaults.stretchCompensationPercent,
      }
    } catch {
      return defaults
    }
  }

  const legacyDistance = safeLocalStorageGet(LEGACY_BOX_STITCH_DISTANCE_KEY)
  if (!legacyDistance) {
    return defaults
  }

  const value = Number(legacyDistance)
  if (!Number.isFinite(value) || value <= 0) {
    return defaults
  }

  return {
    ...defaults,
    distanceMm: value,
  }
}

export function saveBoxStitchHelperSettings(settings: BoxStitchHelperSettings) {
  if (typeof window === 'undefined') {
    return
  }

  safeLocalStorageSet(
    BOX_STITCH_HELPER_SETTINGS_KEY,
    JSON.stringify({
      distanceMm: settings.distanceMm,
      stretchCompensationPercent: settings.stretchCompensationPercent,
    }),
  )
}

export function loadBoxStitchDistanceMm() {
  return loadBoxStitchHelperSettings().distanceMm
}

export function saveBoxStitchDistanceMm(distanceMm: number) {
  if (!Number.isFinite(distanceMm) || distanceMm <= 0) {
    return
  }

  const settings = loadBoxStitchHelperSettings()
  saveBoxStitchHelperSettings({
    ...settings,
    distanceMm,
  })
}
