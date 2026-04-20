import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

const TRANSLATION_STORAGE_KEY = 'leathercad-translation-map-v1'

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

export function saveTranslationMap(map: TranslationMap) {
  if (typeof window === 'undefined') return
  safeLocalStorageSet(TRANSLATION_STORAGE_KEY, JSON.stringify(map))
}

export function translate(map: TranslationMap, key: string, fallback: string = key): string {
  return map[key] ?? fallback
}
