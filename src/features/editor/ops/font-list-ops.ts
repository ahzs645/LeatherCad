import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

const FONT_LIST_STORAGE_KEY = 'leathercad-font-list-v1'

const DEFAULT_FONTS = [
  'Georgia, serif',
  'Helvetica, Arial, sans-serif',
  'Times New Roman, serif',
  'Courier New, monospace',
]

export function loadFontList(): string[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_FONTS]
  }
  try {
    const raw = safeLocalStorageGet(FONT_LIST_STORAGE_KEY)
    if (!raw) {
      return [...DEFAULT_FONTS]
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_FONTS]
    }
    return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
  } catch {
    return [...DEFAULT_FONTS]
  }
}

export function saveFontList(fonts: string[]) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(FONT_LIST_STORAGE_KEY, JSON.stringify(fonts))
}

export function addFontToList(fonts: string[], fontFamily: string): string[] {
  const trimmed = fontFamily.trim()
  if (!trimmed || fonts.includes(trimmed)) {
    return fonts
  }
  return [...fonts, trimmed]
}

export function removeFontFromList(fonts: string[], fontFamily: string): string[] {
  return fonts.filter((entry) => entry !== fontFamily)
}
