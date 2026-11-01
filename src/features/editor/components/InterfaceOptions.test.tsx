import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { changeValue, click, cleanupRender, renderForTest } from '../../../test/render'
import { setEditorLocale } from '../ops/locale-store'
import { DEFAULT_INTERFACE_PREFERENCES, getInterfacePreferences, updateInterfacePreferences } from '../ops/interface-preferences'
import { ChangeShapeSizeModal } from './ChangeShapeSizeModal'
import { OptionsNavigation, OptionsSection } from './OptionsNavigation'
import { InterfacePreferencesPanel } from './InterfacePreferencesPanel'
import { WorkbenchToolRail } from '../workbench/WorkbenchToolRail'
import { requestEvenStitchCount } from './request-even-stitch-count'

let rendered: ReturnType<typeof renderForTest> | null = null
beforeEach(() => { localStorage.clear(); setEditorLocale('en'); updateInterfacePreferences(DEFAULT_INTERFACE_PREFERENCES) })
afterEach(() => { cleanupRender(rendered); rendered = null; document.querySelectorAll('dialog').forEach(dialog => dialog.remove()) })

describe('interface options', () => {
  it('finds settings across categories, persists category and scopes reset', () => {
    const reset = vi.fn()
    const tree = () => createElement(OptionsNavigation, { onResetCategory: reset, children: [
      createElement(OptionsSection, { key: 'a', id: 'arc', category: 'drawing', children: createElement('label', null, 'Arc radius') }),
      createElement(OptionsSection, { key: 'b', id: 'print', category: 'output', children: createElement('label', null, 'Print calibration') }),
    ] })
    rendered = renderForTest(tree())
    click([...rendered.container.querySelectorAll('nav button')].find(button => button.textContent === 'Drawing')!)
    expect(rendered.container.querySelector('#options-print')?.hasAttribute('hidden')).toBe(true)
    click([...rendered.container.querySelectorAll('button')].find(button => button.textContent === 'Reset this category')!)
    expect(reset).toHaveBeenCalledExactlyOnceWith('drawing')
    changeValue(rendered.container.querySelector('input[type=search]'), 'calibration')
    expect(rendered.container.querySelector('#options-print')?.hasAttribute('hidden')).toBe(false)
    expect(rendered.container.querySelector('#options-arc')?.hasAttribute('hidden')).toBe(true)
    const resetButton = [...rendered.container.querySelectorAll('button')].find(button => button.textContent === 'Reset this category')!
    expect(resetButton.disabled).toBe(true)
    click(resetButton)
    expect(reset).toHaveBeenCalledOnce()
    expect(rendered.container.querySelector('[role=status]')?.textContent).toBe('1 settings section shown.')
    expect(rendered.container.querySelector('#options-reset-search-hint')?.textContent).toBe('Clear the search to reset this category.')
    changeValue(rendered.container.querySelector('input[type=search]'), '')
    expect(resetButton.disabled).toBe(false)
    click(resetButton)
    expect(reset).toHaveBeenLastCalledWith('drawing')
    expect(reset).toHaveBeenCalledTimes(2)
    cleanupRender(rendered); rendered = renderForTest(tree())
    expect(rendered.container.querySelector('button[aria-pressed=true]')?.textContent).toBe('Drawing')
  })
  it('changes the real tool rail order and labels from input settings', () => {
    rendered = renderForTest(createElement('div', null, createElement(InterfacePreferencesPanel), createElement(WorkbenchToolRail, { tool: 'pan', onSetActiveTool() {} })))
    const before = rendered.container.querySelector('.workbench-tool-rail button')?.getAttribute('aria-label')
    click(rendered.container.querySelector('.options-tool-order button[aria-label^="Move down"]'))
    expect(rendered.container.querySelector('.workbench-tool-rail button')?.getAttribute('aria-label')).not.toBe(before)
    click(rendered.container.querySelector('input[type=checkbox]'))
    expect(rendered.container.querySelector('.tool-rail-label')).not.toBeNull()
    changeValue(rendered.container.querySelector('select'), 'pan')
    expect(getInterfacePreferences().wheelMode).toBe('pan')
  })
  it('edits inches but delivers canonical millimetres; rejects invalid size', () => {
    updateInterfacePreferences({ displayUnit: 'in' })
    const apply = vi.fn(), line = vi.fn()
    rendered = renderForTest(createElement(ChangeShapeSizeModal, { open: true, onClose() {}, onApply: apply, currentWidth: 25.4, currentHeight: 50.8, selectedLineLengthMm: 25.4, selectedLineAngleDeg: 30, onApplyLineGeometry: line }))
    const width = rendered.container.querySelector('input')!
    expect(width.value).toBe('1')
    changeValue(width, '2')
    click([...rendered.container.querySelectorAll('button')].find(button => button.textContent === 'Apply Size')!)
    expect(apply).toHaveBeenCalledExactlyOnceWith(50.8, 50.8, false)
    changeValue(width, '')
    expect([...rendered.container.querySelectorAll('button')].find(button => button.textContent === 'Apply Size')?.disabled).toBe(true)
    expect(rendered.container.querySelector('[role=alert]')).not.toBeNull()
  })
  it('names the legacy size dialog, closes on Escape and restores the launcher', async () => {
    const launcher = document.createElement('button'); document.body.append(launcher); launcher.focus()
    const close = vi.fn()
    rendered = renderForTest(createElement(ChangeShapeSizeModal, { open: true, onClose: close, onApply() {}, currentWidth: 10, currentHeight: 10 }))
    const dialog = rendered.container.querySelector('[role=dialog]')!
    expect(dialog.getAttribute('aria-labelledby')).toBe('change-size-title')
    expect(dialog.contains(document.activeElement)).toBe(true)
    await act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(close).toHaveBeenCalledOnce()
    cleanupRender(rendered); rendered = null
    await Promise.resolve()
    expect(document.activeElement).toBe(launcher)
    launcher.remove()
  })
  it('keeps horizontal or vertical line sizing usable when one bound has zero extent', () => {
    const apply = vi.fn()
    rendered = renderForTest(createElement(ChangeShapeSizeModal, { open: true, onClose() {}, onApply: apply, currentWidth: 20, currentHeight: 0, selectedLineLengthMm: 20, selectedLineAngleDeg: 0, onApplyLineGeometry() {} }))
    changeValue(rendered.container.querySelector('input'), '40')
    const button = [...rendered.container.querySelectorAll('button')].find(button => button.textContent === 'Apply Size')!
    expect(button.disabled).toBe(false)
    click(button)
    expect(apply).toHaveBeenCalledExactlyOnceWith(40, 0, false)
  })
  it('validates even-hole counts in a modal form and preserves Cancel', async () => {
    const result = requestEvenStitchCount()
    const dialog = document.querySelector('dialog')!
    const input = dialog.querySelector('input')!
    input.value = '2.5'; input.dispatchEvent(new Event('input'))
    expect(dialog.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true)
    input.value = '12'; input.dispatchEvent(new Event('input'))
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    expect(await result).toBe(12)
    expect(document.querySelector('dialog')).toBeNull()
    const cancelled = requestEvenStitchCount()
    document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(await cancelled).toBeNull()
  })
})
