import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

const PREFS_STORAGE_KEY = 'leathercad-editor-prefs-v1'

export type EditorPreferences = {
  reverseZoomDirection: boolean
  incrementalSelection: boolean
  mentoriWithoutCtrl: boolean
  exportIncludeText: boolean
  exportIncludeTemplateMetadata: boolean
  leatherSimTextureRotationDeg: number
}

export function getDefaultEditorPreferences(): EditorPreferences {
  return {
    reverseZoomDirection: false,
    incrementalSelection: false,
    mentoriWithoutCtrl: false,
    exportIncludeText: true,
    exportIncludeTemplateMetadata: false,
    leatherSimTextureRotationDeg: 0,
  }
}

export function loadEditorPreferences(): EditorPreferences {
  if (typeof window === 'undefined') {
    return getDefaultEditorPreferences()
  }
  const raw = safeLocalStorageGet(PREFS_STORAGE_KEY)
  if (!raw) {
    return getDefaultEditorPreferences()
  }
  try {
    const parsed = JSON.parse(raw) as Partial<EditorPreferences>
    const defaults = getDefaultEditorPreferences()
    return {
      reverseZoomDirection: parsed.reverseZoomDirection === true,
      incrementalSelection: parsed.incrementalSelection === true,
      mentoriWithoutCtrl: parsed.mentoriWithoutCtrl === true,
      exportIncludeText: parsed.exportIncludeText !== false,
      exportIncludeTemplateMetadata: parsed.exportIncludeTemplateMetadata === true,
      leatherSimTextureRotationDeg:
        typeof parsed.leatherSimTextureRotationDeg === 'number' &&
        Number.isFinite(parsed.leatherSimTextureRotationDeg)
          ? ((parsed.leatherSimTextureRotationDeg % 360) + 360) % 360
          : defaults.leatherSimTextureRotationDeg,
    }
  } catch {
    return getDefaultEditorPreferences()
  }
}

export function saveEditorPreferences(prefs: EditorPreferences) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(PREFS_STORAGE_KEY, JSON.stringify(prefs))
}
