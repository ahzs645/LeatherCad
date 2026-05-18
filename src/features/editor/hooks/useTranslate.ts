import { useCallback } from 'react'
import { useEditorUISelector } from '../state/providers/EditorUIStateProvider'
import { translate, type TranslationMap } from '../ops/translation-ops'

/**
 * Hook that returns a memoized `t(key, fallback)` function bound to the current
 * `translationMap`. When no translation is loaded, every call returns the
 * fallback (or key) unchanged — keeping the English UI working out of the box.
 * Source-app v0.9.13 added i18n via per-language TSV files; the web rebuild
 * uses the same lookup model.
 */
export function useTranslate() {
  const translationMap = useEditorUISelector((state) => state.translationMap)
  return useCallback(
    (key: string, fallback: string = key) => translate(translationMap, key, fallback),
    [translationMap],
  )
}

export type Translator = (key: string, fallback?: string) => string

export type { TranslationMap }
