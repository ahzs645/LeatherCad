import { safeLocalStorageGet } from '../ops/safe-storage'

export function isEngineV2Enabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('engine') === 'v2') return true
    return safeLocalStorageGet('leathercad_engine_v2') === '1'
  } catch {
    return false
  }
}
