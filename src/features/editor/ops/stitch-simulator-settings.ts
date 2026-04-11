import type { StitchSimulatorSettings } from './stitch-simulator-ops'
import { getDefaultStitchSimulatorSettings } from './stitch-simulator-ops'
import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

const STITCH_SIMULATOR_SETTINGS_KEY = 'leathercad-stitch-simulator-settings-v1'

export function loadStitchSimulatorSettings() {
  if (typeof window === 'undefined') {
    return getDefaultStitchSimulatorSettings()
  }

  const raw = safeLocalStorageGet(STITCH_SIMULATOR_SETTINGS_KEY)
  if (!raw) {
    return getDefaultStitchSimulatorSettings()
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StitchSimulatorSettings>
    const defaults = getDefaultStitchSimulatorSettings()
    return {
      ...defaults,
      ...parsed,
    }
  } catch {
    return getDefaultStitchSimulatorSettings()
  }
}

export function saveStitchSimulatorSettings(settings: StitchSimulatorSettings) {
  if (typeof window === 'undefined') {
    return
  }

  safeLocalStorageSet(STITCH_SIMULATOR_SETTINGS_KEY, JSON.stringify(settings))
}
