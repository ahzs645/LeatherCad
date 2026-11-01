import { Children, createContext, isValidElement, useContext, useState, type ReactNode } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import { safeLocalStorageGet, safeLocalStorageSet } from '../ops/safe-storage'
import './OptionsNavigation.css'

export const OPTIONS_CATEGORIES = [
  ['all', 'All settings'], ['workspace', 'Workspace'], ['input', 'Input'], ['drawing', 'Drawing'],
  ['stitch', 'Stitching'], ['output', 'Output / Print'], ['language', 'Language'],
] as const
export type OptionsCategory = typeof OPTIONS_CATEGORIES[number][0]
const STORAGE_KEY = 'leathercad.options.category.v1'
const CategoryContext = createContext<{ category: OptionsCategory; query: string }>({ category: 'all', query: '' })
function textContent(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child)
    if (isValidElement<{ children?: ReactNode }>(child)) return textContent(child.props.children)
    return ''
  }).join(' ')
}
type SectionProps = { id: string; category: OptionsCategory; scope?: string; searchTerms?: string; children: ReactNode }
function sectionMatches(props: SectionProps, category: OptionsCategory, query: string) {
  const term = query.trim().toLocaleLowerCase()
  return term ? `${props.id} ${props.searchTerms ?? ''} ${textContent(props.children)}`.toLocaleLowerCase().includes(term) : category === 'all' || category === props.category
}
export function OptionsNavigation({ children, onResetCategory }: { children: ReactNode; onResetCategory: (category: OptionsCategory) => void }) {
  const t = useTranslate()
  const [category, setCategory] = useState<OptionsCategory>(() => {
    const stored = safeLocalStorageGet(STORAGE_KEY)
    return OPTIONS_CATEGORIES.find(([id]) => id === stored)?.[0] ?? 'all'
  })
  const [query, setQuery] = useState('')
  const searchingAllCategories = query.trim().length > 0
  const matchingCount = Children.toArray(children).filter(child => isValidElement<SectionProps>(child) && sectionMatches(child.props, category, query)).length
  return <CategoryContext.Provider value={{ category, query }}>
    <div className="options-navigation">
      <label className="field-row"><span>{t('Search settings')}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Find a setting…')} /></label>
      <nav aria-label={t('Settings categories')}>{OPTIONS_CATEGORIES.map(([id, label]) => <button type="button" key={id} aria-pressed={category === id} onClick={() => { setCategory(id); safeLocalStorageSet(STORAGE_KEY, id); setQuery('') }}>{t(label)}</button>)}</nav>
      <p>{t('Changes apply immediately. Each section states where its settings are saved.')}</p>
      {category !== 'all' && category !== 'language' && <>
        <button type="button" disabled={searchingAllCategories} aria-describedby={searchingAllCategories ? 'options-reset-search-hint' : undefined} onClick={() => { if (!searchingAllCategories) onResetCategory(category) }}>{t('Reset this category')}</button>
        {searchingAllCategories && <p id="options-reset-search-hint" className="options-reset-hint">{t('Clear the search to reset this category.')}</p>}
      </>}
    </div>
    <p role="status">{matchingCount === 0 ? t('No matching settings. Try another search.') : matchingCount === 1 ? t('1 settings section shown.') : t('{count} settings sections shown.').replace('{count}', String(matchingCount))}</p>
    <div className="options-sections">{children}</div>
  </CategoryContext.Provider>
}
export function OptionsSection({ id, category, scope = 'Browser preference', searchTerms = '', children }: SectionProps) {
  const t = useTranslate()
  const filter = useContext(CategoryContext)
  const visible = sectionMatches({ id, category, searchTerms, children }, filter.category, filter.query)
  return <section id={`options-${id}`} data-settings-id={id} className="help-section" hidden={!visible}>
    <p className="options-scope">{t(scope)}</p>{children}
  </section>
}
