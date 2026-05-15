import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

export const LETTER_STAMP_FONT_SET_STORAGE_KEY = 'leathercad-letter-stamp-font-sets-v1'

export type LetterStampFontSet = {
  id: string
  name: string
  fontFamily: string
  stampSizeMm: number
  spacingMm: number
  lineSpacingMm: number
}

function clampPositive(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback
}

export function parseLetterStampFontSet(value: unknown): LetterStampFontSet | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<LetterStampFontSet>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    return null
  }
  if (typeof candidate.fontFamily !== 'string' || candidate.fontFamily.trim().length === 0) {
    return null
  }
  return {
    id: candidate.id,
    name: candidate.name.trim(),
    fontFamily: candidate.fontFamily.trim(),
    stampSizeMm: clampPositive(candidate.stampSizeMm, 10, 1, 100),
    spacingMm: clampPositive(candidate.spacingMm, 2, 0, 100),
    lineSpacingMm: clampPositive(candidate.lineSpacingMm, 4, 0, 100),
  }
}

export function loadLetterStampFontSets(storageKey = LETTER_STAMP_FONT_SET_STORAGE_KEY): LetterStampFontSet[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = safeLocalStorageGet(storageKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .map(parseLetterStampFontSet)
      .filter((entry): entry is LetterStampFontSet => entry !== null)
  } catch {
    return []
  }
}

export function saveLetterStampFontSets(
  fontSets: LetterStampFontSet[],
  storageKey = LETTER_STAMP_FONT_SET_STORAGE_KEY,
) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(storageKey, JSON.stringify(fontSets))
}

export function createLetterStampFontSet(params: Omit<LetterStampFontSet, 'id'>): LetterStampFontSet {
  return {
    id: `letter-font-set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...params,
  }
}

export function serializeLetterStampFontSets(fontSets: LetterStampFontSet[]): string {
  return JSON.stringify({ fontSets }, null, 2)
}

export function parseLetterStampFontSets(raw: string): LetterStampFontSet[] {
  const parsed = JSON.parse(raw) as unknown
  const entries = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { fontSets?: unknown }).fontSets)
      ? (parsed as { fontSets: unknown[] }).fontSets
      : []
  return entries
    .map(parseLetterStampFontSet)
    .filter((entry): entry is LetterStampFontSet => entry !== null)
}
