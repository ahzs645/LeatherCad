import { act, createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import { useStartupDemoGuard } from './useStartupDemoGuard'

let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null })
function mount() {
  let begin!: ReturnType<typeof useStartupDemoGuard>
  function Harness({ name }: { name: string }) {
    begin = useStartupDemoGuard(() => ({ documentName: name }))
    return createElement('button', null, 'Options')
  }
  rendered = renderForTest(createElement(Harness, { name: 'Initial' }))
  return { begin: () => begin(), rerender: () => rendered?.rerender(createElement(Harness, { name: 'Opened file' })) }
}
describe('background startup demo precedence', () => {
  it('allows unchanged startup work and cancels after the user starts opening a dialog', () => {
    const view = mount(), shouldApply = view.begin()
    expect(shouldApply()).toBe(true)
    act(() => { rendered?.container.querySelector('button')?.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(shouldApply()).toBe(false)
  })
  it('cancels after a late document load or keyboard interaction', () => {
    const view = mount(), shouldApply = view.begin()
    view.rerender()
    expect(shouldApply()).toBe(false)
    const another = view.begin()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })) })
    expect(another()).toBe(false)
  })
})
