import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'
import { withEditorLocalDataClient } from '../localdb/editor-local-data-client'
import { createDraftSnapshot, discardRecoveryDrafts, DRAFT_KEYS, persistDraftSnapshot, readRecoveryDrafts, type DraftWriteResult } from './draft-recovery'

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

export function writeAutoSaveSnapshot(serializedDoc: string, localDocumentId: string | null = null): Promise<DraftWriteResult> {
  return persistDraftSnapshot(createDraftSnapshot(serializedDoc, 'autosave', localDocumentId))
}

export function readAutoSaveSnapshot(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const snapshot = JSON.parse(safeLocalStorageGet(DRAFT_KEYS.autosave) ?? 'null') as { serializedDoc?: unknown } | null
    if (typeof snapshot?.serializedDoc === 'string') return snapshot.serializedDoc
  } catch { /* Legacy snapshots remain readable. */ }
  return safeLocalStorageGet(AUTOSAVE_STORAGE_KEY)
}

export function clearAutoSaveSnapshot(): Promise<void> {
  return discardRecoveryDrafts(['autosave'])
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
  return (await readRecoveryDrafts()).find(draft => draft.snapshot?.reason === 'autosave')?.snapshot?.serializedDoc ?? null
}
