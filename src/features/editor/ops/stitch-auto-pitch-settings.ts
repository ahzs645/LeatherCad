import type { StitchAutoPitchSettings } from '../editor-types'
import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

export const STITCH_AUTO_PITCH_SETTINGS_STORAGE_KEY = 'leathercad-stitch-auto-pitch-settings-v1'

export function getDefaultStitchAutoPitchSettings(): StitchAutoPitchSettings {
  return {
    defaultMode: 'fixed',
    forceFitLastHole: false,
    solverSteps: 6,
    precisionMm: 0.1,
    stopGapMm: 1,
    continueFromSelectedHole: false,
  }
}

export function parseStitchAutoPitchSettings(value: unknown): StitchAutoPitchSettings | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<StitchAutoPitchSettings>
  return {
    defaultMode: candidate.defaultMode === 'variable' ? 'variable' : 'fixed',
    forceFitLastHole: candidate.forceFitLastHole === true,
    solverSteps:
      typeof candidate.solverSteps === 'number' && Number.isFinite(candidate.solverSteps)
        ? Math.min(24, Math.max(2, Math.round(candidate.solverSteps)))
        : 6,
    precisionMm:
      typeof candidate.precisionMm === 'number' && Number.isFinite(candidate.precisionMm)
        ? Math.min(5, Math.max(0.01, candidate.precisionMm))
        : 0.1,
    stopGapMm:
      typeof candidate.stopGapMm === 'number' && Number.isFinite(candidate.stopGapMm)
        ? Math.min(25, Math.max(0.1, candidate.stopGapMm))
        : 1,
    continueFromSelectedHole: candidate.continueFromSelectedHole === true,
  }
}

export function loadStitchAutoPitchSettings(
  storageKey = STITCH_AUTO_PITCH_SETTINGS_STORAGE_KEY,
): StitchAutoPitchSettings {
  if (typeof window === 'undefined') {
    return getDefaultStitchAutoPitchSettings()
  }

  try {
    const raw = safeLocalStorageGet(storageKey)
    if (!raw) {
      return getDefaultStitchAutoPitchSettings()
    }
    const parsed = parseStitchAutoPitchSettings(JSON.parse(raw))
    return parsed ?? getDefaultStitchAutoPitchSettings()
  } catch {
    return getDefaultStitchAutoPitchSettings()
  }
}

export function saveStitchAutoPitchSettings(
  settings: StitchAutoPitchSettings,
  storageKey = STITCH_AUTO_PITCH_SETTINGS_STORAGE_KEY,
) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(storageKey, JSON.stringify(settings))
}
