import { useCallback, useSyncExternalStore } from 'react'
import { getTranslationMapSnapshot, subscribeTranslationMap, translateUiText, type TranslationMap } from '../ops/translation-ops'
import { getEditorLocale, subscribeEditorLocale } from '../ops/locale-store'

/**
 * Imported translations override the bundled language. Missing entries keep
 * their English fallback. This hook also works in reusable UI outside the full
 * editor providers; language is a browser preference, never document content.
 */
export function useTranslate() {
  const locale = useEditorLocale()
  const translationMap = useSyncExternalStore(subscribeTranslationMap, getTranslationMapSnapshot, getTranslationMapSnapshot)
  return useCallback(
    (key: string, fallback: string = key) =>
      translateUiText(locale, translationMap, key, fallback),
    [locale, translationMap],
  )
}

export function useEditorLocale() {
  return useSyncExternalStore(subscribeEditorLocale, getEditorLocale, () => 'en' as const)
}

export type Translator = (key: string, fallback?: string) => string

export type { TranslationMap }
