import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

export const AUTOSAVE_STORAGE_KEY = 'leathercad-autosave-v1'
const AUTOSAVE_PREF_KEY = 'leathercad-autosave-enabled-v1'

export function loadAutoSaveEnabled(defaultValue = false): boolean {
  if (typeof window === 'undefined') {
    return defaultValue
  }
  const raw = safeLocalStorageGet(AUTOSAVE_PREF_KEY)
  if (raw === null) {
    return defaultValue
  }
  return raw === 'true'
}

export function saveAutoSaveEnabled(enabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(AUTOSAVE_PREF_KEY, enabled ? 'true' : 'false')
}

export function writeAutoSaveSnapshot(serializedDoc: string) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(AUTOSAVE_STORAGE_KEY, serializedDoc)
}

export function readAutoSaveSnapshot(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return safeLocalStorageGet(AUTOSAVE_STORAGE_KEY)
}

export function clearAutoSaveSnapshot() {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(AUTOSAVE_STORAGE_KEY, '')
}
