import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { changeValue, cleanupRender, renderForTest } from '../../../test/render'
import { WorkbenchHeader } from '../workbench/WorkbenchHeader'
import { WorkbenchRibbon } from '../workbench/WorkbenchRibbon'
import { EDITOR_LOCALE_STORAGE_KEY, getEditorLocale, setEditorLocale } from '../ops/locale-store'
import { EDITOR_LANGUAGES, getLocaleCoverage } from '../ops/locale-dictionaries'
import { SHELL_DICTIONARIES, SHELL_TRANSLATION_KEYS } from '../ops/locale-shell-dictionaries'
import { parseTranslationFile, saveTranslationMap, translateUiText } from '../ops/translation-ops'
import { LanguageSelector } from './LanguageSelector'
import { SvgImportOptionsModal } from './SvgImportOptionsModal'

let rendered: ReturnType<typeof renderForTest> | null = null

beforeEach(() => {
  setEditorLocale('en')
  saveTranslationMap({})
})

afterEach(() => {
  cleanupRender(rendered)
  rendered = null
  setEditorLocale('en')
  saveTranslationMap({})
})

function renderShell() {
  return renderForTest(createElement('div', null,
    createElement(WorkbenchHeader, {
      docLabel: 'Draft', quickActions: [{ id: 'save', label: 'Save', disabled: false }],
      workspaceMode: '2d', activeRibbonTab: 'draft', themeMode: 'dark',
      onInvokeQuickAction() {}, onSetRibbonTab() {}, onSetWorkspaceMode() {}, onSetThemeMode() {},
    }),
    createElement(WorkbenchRibbon, {
      groups: [{ id: 'file', title: 'File', items: [{ id: 'save', label: 'Save' }, { id: 'dxf', label: 'Import DXF' }] }],
      onInvokeCommand() {},
    }),
  ))
}

describe('interface languages', () => {
  it('switches the actual header and ribbon, persists language, and leaves document names alone', () => {
    rendered = renderShell()
    expect(rendered.container.querySelector('[data-testid="ribbon-tab-draft"]')?.textContent?.trim()).toBe('Draft')
    changeValue(rendered.container.querySelector('select'), 'ja')
    expect(rendered.container.querySelector('[data-testid="ribbon-tab-draft"]')?.textContent?.trim()).toBe('作図')
    expect(rendered.container.querySelector('[data-testid="ribbon-command-save"]')?.textContent?.trim()).toBe('保存')
    expect(rendered.container.querySelector('[data-testid="ribbon-command-dxf"]')?.textContent?.trim()).toBe('DXF を読み込む')
    expect(rendered.container.querySelector('.workbench-doc-label strong')?.textContent).toBe('Draft')
    expect(localStorage.getItem(EDITOR_LOCALE_STORAGE_KEY)).toBe('ja')
    expect(document.documentElement.lang).toBe('ja')
    cleanupRender(rendered)
    rendered = renderForTest(createElement(LanguageSelector))
    expect(rendered.container.querySelector('select')?.value).toBe('ja')
  })

  it('applies imported TSV/JSON overrides live and restores the selected dictionary when cleared', () => {
    setEditorLocale('ja')
    rendered = renderShell()
    act(() => saveTranslationMap(parseTranslationFile('Save\t独自の保存')))
    expect(rendered.container.querySelector('[data-testid="ribbon-command-save"]')?.textContent?.trim()).toBe('独自の保存')
    act(() => saveTranslationMap({}))
    expect(rendered.container.querySelector('[data-testid="ribbon-command-save"]')?.textContent?.trim()).toBe('保存')
    expect(translateUiText('ja', parseTranslationFile('{"command.save":"My save"}'), 'command.save', 'Save')).toBe('My save')
  })

  it('updates when the persisted language changes in another browser tab', () => {
    rendered = renderShell()
    act(() => {
      localStorage.setItem(EDITOR_LOCALE_STORAGE_KEY, 'ja')
      window.dispatchEvent(new StorageEvent('storage', { key: EDITOR_LOCALE_STORAGE_KEY, newValue: 'ja' }))
    })
    expect(getEditorLocale()).toBe('ja')
    expect(rendered.container.querySelector('[data-testid="ribbon-command-save"]')?.textContent?.trim()).toBe('保存')
  })

  it('keeps English fallbacks for missing entries and never resolves inherited object properties', () => {
    expect(translateUiText('ja', {}, 'new.command', 'A new command')).toBe('A new command')
    expect(translateUiText('en', {}, 'interchange.title', 'File tools')).toBe('File tools')
    expect(translateUiText('ja', {}, 'toString')).toBe('toString')
    expect(translateUiText('ja', { Save: '' }, 'Save')).toBe('')
  })

  it('never applies custom UI translations to state classes or operation values', () => {
    saveTranslationMap({ active: 'translated class', grouped: 'translated mode' })
    rendered = renderForTest(createElement(SvgImportOptionsModal, {
      open: true, fileName: 'Drawing.svg', shapeCount: 1, warningCount: 0,
      sourceWidthMm: 40, sourceHeightMm: 20, onClose() {}, onApply() {},
    }))
    const grouped = [...rendered.container.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Grouped')
    expect(grouped?.className).toBe('active')
  })

  it.each([
    ['de', 'Speichern', 'Zeichnen'],
    ['fr', 'Enregistrer', 'Dessiner'],
    ['zh-TW', '儲存', '繪圖'],
  ] as const)('switches working file and drafting controls to %s', (locale, saveLabel, draftLabel) => {
    rendered = renderShell()
    changeValue(rendered.container.querySelector('select'), locale)
    expect(rendered.container.querySelector('[data-testid="ribbon-command-save"]')?.textContent?.trim()).toBe(saveLabel)
    expect(rendered.container.querySelector('[data-testid="ribbon-tab-draft"]')?.textContent?.trim()).toBe(draftLabel)
    expect(localStorage.getItem(EDITOR_LOCALE_STORAGE_KEY)).toBe(locale)
  })

  it('ships usable core controls for all 20 selectable languages and exposes honest coverage', () => {
    expect(EDITOR_LANGUAGES).toHaveLength(20)
    for (const { locale } of EDITOR_LANGUAGES) {
      const coverage = getLocaleCoverage(locale)
      expect(coverage.fallback).toBe('en')
      if (locale === 'en' || locale === 'ja') continue
      for (const key of SHELL_TRANSLATION_KEYS) expect(SHELL_DICTIONARIES[locale][key]?.trim().length).toBeGreaterThan(0)
      expect(coverage.scope).toBe('core-shell')
    }
    expect(getLocaleCoverage('ja').scope).toBe('shell-and-main-dialogs')
  })
})
