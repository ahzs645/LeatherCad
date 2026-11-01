import { useEffect } from 'react'
import { useEditorLocale, useTranslate } from '../hooks/useTranslate'
import { EDITOR_LANGUAGES, type EditorLocale } from '../ops/locale-dictionaries'
import { setEditorLocale } from '../ops/locale-store'
import './LanguageSelector.css'

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const locale = useEditorLocale()
  const t = useTranslate()
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return (
    <label className={compact ? 'editor-language-selector editor-language-selector-compact' : 'field-row editor-language-selector'}>
      {!compact && <span>{t('Language')}</span>}
      <select
        className="action-select"
        data-testid="interface-language"
        aria-label={t('Interface language')}
        value={locale}
        onChange={(event) => setEditorLocale(event.target.value as EditorLocale)}
      >
        {EDITOR_LANGUAGES.map((language) => <option key={language.locale} value={language.locale}>{language.label}</option>)}
      </select>
    </label>
  )
}
