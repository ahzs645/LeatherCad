import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'
import { withEditorLocalDataClient } from '../localdb/editor-local-data-client'

export const AUTOSAVE_STORAGE_KEY = 'leathercad-autosave-v1'
export const AUTOSAVE_PREF_KEY = 'leathercad-autosave-enabled-v1'

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
  void withEditorLocalDataClient((client) => client.settings.set(AUTOSAVE_PREF_KEY, enabled ? 'true' : 'false'))
}

export function writeAutoSaveSnapshot(serializedDoc: string) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(AUTOSAVE_STORAGE_KEY, serializedDoc)
  void withEditorLocalDataClient((client) => client.documents.writeAutoSaveSnapshot(serializedDoc))
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
  void withEditorLocalDataClient((client) => client.documents.clearAutoSaveSnapshot())
}

export async function loadAutoSaveEnabledFromLocalDb(defaultValue = false): Promise<boolean> {
  const stored = await withEditorLocalDataClient((client) => client.settings.get(AUTOSAVE_PREF_KEY))
  if (stored === 'true') {
    return true
  }
  if (stored === 'false') {
    return false
  }
  return loadAutoSaveEnabled(defaultValue)
}

export async function readAutoSaveSnapshotFromLocalDb(): Promise<string | null> {
  return (await withEditorLocalDataClient((client) => client.documents.getAutoSaveSnapshot())) ?? readAutoSaveSnapshot()
}
