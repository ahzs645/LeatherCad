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

export function renameFontInList(fonts: string[], oldFontFamily: string, newFontFamily: string): string[] {
  const trimmed = newFontFamily.trim()
  if (!trimmed) {
    return fonts
  }
  return fonts.map((entry) => (entry === oldFontFamily ? trimmed : entry)).filter((entry, index, all) => all.indexOf(entry) === index)
}

export function duplicateFontInList(fonts: string[], fontFamily: string): string[] {
  const next = `${fontFamily} Copy`
  return addFontToList(fonts, next)
}

export function serializeFontList(fonts: string[]): string {
  return JSON.stringify({ fileType: 'LeatherCad_FontList', fonts }, null, 2)
}

export function parseFontListImport(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown
  const fonts = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { fonts?: unknown[] }).fonts)
      ? (parsed as { fonts: unknown[] }).fonts
      : []
  return fonts.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}
