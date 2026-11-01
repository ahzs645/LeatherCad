import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'
import { getBuiltinTranslation, type EditorLocale } from './locale-dictionaries'

const TRANSLATION_STORAGE_KEY = 'leathercad-translation-map-v1'
const translationListeners = new Set<() => void>()
let cachedTranslationRaw: string | null | undefined
let cachedTranslationMap: TranslationMap = {}
let listeningForTranslationStorage = false

function handleTranslationStorage(event: StorageEvent) {
  if (event.key === TRANSLATION_STORAGE_KEY || event.key === null) {
    cachedTranslationRaw = undefined
    for (const listener of translationListeners) listener()
  }
}

export type TranslationMap = Record<string, string>

/**
 * Parse a translation file. Supports two formats:
 * - TSV: `key\ttranslation` per line (the source app's native format)
 * - JSON: `{ "key": "translation" }` object
 */
export function parseTranslationFile(raw: string): TranslationMap {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return {}

  // JSON
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const result: TranslationMap = {}
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof key === 'string' && typeof value === 'string') {
            result[key] = value
          }
        }
        return result
      }
    } catch {
      // fall through to TSV parse
    }
  }

  // TSV: each non-empty, non-comment line → key \t translation
  const map: TranslationMap = {}
  for (const line of trimmed.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const tabIndex = line.indexOf('\t')
    if (tabIndex < 0) continue
    const key = line.slice(0, tabIndex).trim()
    const value = line.slice(tabIndex + 1).trim()
    if (key && value) {
      map[key] = value
    }
  }
  return map
}

export function loadTranslationMap(): TranslationMap {
  if (typeof window === 'undefined') return {}
  const raw = safeLocalStorageGet(TRANSLATION_STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result: TranslationMap = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') result[key] = value
      }
      return result
    }
    return {}
  } catch {
    return {}
  }
}

/** Stable snapshots let UI consumers observe imported overrides without owning
 * document state or requiring the editor provider in reusable UI components. */
export function getTranslationMapSnapshot(): TranslationMap {
  const raw = typeof window === 'undefined' ? null : safeLocalStorageGet(TRANSLATION_STORAGE_KEY)
  if (raw !== cachedTranslationRaw) {
    cachedTranslationRaw = raw
    cachedTranslationMap = loadTranslationMap()
  }
  return cachedTranslationMap
}

export function subscribeTranslationMap(listener: () => void) {
  translationListeners.add(listener)
  if (!listeningForTranslationStorage && typeof window !== 'undefined') {
    window.addEventListener('storage', handleTranslationStorage)
    listeningForTranslationStorage = true
  }
  return () => {
    translationListeners.delete(listener)
    if (translationListeners.size === 0 && listeningForTranslationStorage) {
      window.removeEventListener('storage', handleTranslationStorage)
      listeningForTranslationStorage = false
    }
  }
}

export function saveTranslationMap(map: TranslationMap) {
  if (typeof window === 'undefined') return
  safeLocalStorageSet(TRANSLATION_STORAGE_KEY, JSON.stringify(map))
  cachedTranslationRaw = undefined
  for (const listener of translationListeners) listener()
}

export function translate(map: TranslationMap, key: string, fallback: string = key): string {
  return Object.hasOwn(map, key) ? map[key] : fallback
}

export function translateUiText(locale: EditorLocale, map: TranslationMap, key: string, fallback: string = key): string {
  if (Object.hasOwn(map, key)) return map[key]
  if (Object.hasOwn(map, fallback)) return map[fallback]
  return getBuiltinTranslation(locale, key) ?? getBuiltinTranslation(locale, fallback) ?? fallback
}
