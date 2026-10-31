import { act, createElement, useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../test/render'
import { useModalDialogFocus } from './useModalDialogFocus'

type DialogProps = { id: string; open?: boolean; onClose?: () => void; closeOnEscape?: boolean; empty?: boolean }

function Dialog({ id, open = true, onClose = () => {}, closeOnEscape = true, empty = false }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open, onClose, closeOnEscape })
  return open ? createElement('div', { ref: dialogRef, role: 'dialog', 'aria-modal': true, tabIndex: -1, id },
    empty ? null : [
      createElement('button', { key: 'disabled', disabled: true }, 'Disabled'),
      createElement('button', { key: 'hidden', style: { display: 'none' } }, 'Hidden'),
      createElement('button', { key: 'first', id: `${id}-first` }, 'First'),
      createElement('button', { key: 'last', id: `${id}-last` }, 'Last'),
    ],
  ) : null
}

let rendered: ReturnType<typeof renderForTest> | null = null
let launcher: HTMLButtonElement | null = null

afterEach(async () => {
  cleanupRender(rendered)
  rendered = null
  await Promise.resolve()
  launcher?.remove()
  launcher = null
})

function focusLauncher() {
  launcher = document.createElement('button')
  launcher.textContent = 'Open tool'
  document.body.appendChild(launcher)
  launcher.focus()
}

function key(key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  act(() => { (document.activeElement ?? document).dispatchEvent(event) })
  return event
}

describe('modal dialog keyboard focus', () => {
  it('focuses the first visible enabled control and wraps Tab in both directions', () => {
    focusLauncher()
    rendered = renderForTest(createElement(Dialog, { id: 'test' }))
    expect(document.activeElement?.id).toBe('test-first')
    key('Tab', true)
    expect(document.activeElement?.id).toBe('test-last')
    key('Tab')
    expect(document.activeElement?.id).toBe('test-first')
    act(() => launcher!.focus())
    expect(document.activeElement?.id).toBe('test-first')
  })

  it('uses the dialog itself when no interactive controls exist', () => {
    focusLauncher()
    rendered = renderForTest(createElement(Dialog, { id: 'empty', empty: true }))
    expect(document.activeElement?.id).toBe('empty')
    expect(key('Tab').defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('empty')
  })

  it('consumes Escape, respects busy state, and uses the latest close callback', () => {
    const firstClose = vi.fn(), nextClose = vi.fn()
    rendered = renderForTest(createElement(Dialog, { id: 'test', onClose: firstClose, closeOnEscape: false }))
    expect(key('Escape').defaultPrevented).toBe(true)
    expect(firstClose).not.toHaveBeenCalled()
    rendered.rerender(createElement(Dialog, { id: 'test', onClose: nextClose }))
    key('Escape')
    expect(firstClose).not.toHaveBeenCalled()
    expect(nextClose).toHaveBeenCalledOnce()
  })

  it('restores the launcher after the modal closes', async () => {
    focusLauncher()
    rendered = renderForTest(createElement(Dialog, { id: 'test' }))
    rendered.rerender(createElement(Dialog, { id: 'test', open: false }))
    await act(async () => { await Promise.resolve() })
    expect(document.activeElement).toBe(launcher)
  })

  it('does not restore behind a newly opened replacement modal and keeps the original launcher', async () => {
    focusLauncher()
    rendered = renderForTest(createElement(Dialog, { key: 'files', id: 'files' }))
    rendered.rerender(createElement(Dialog, { key: 'stl', id: 'stl' }))
    await act(async () => { await Promise.resolve() })
    expect(document.activeElement?.id).toBe('stl-first')
    rendered.rerender(createElement(Dialog, { key: 'stl', id: 'stl', open: false }))
    await act(async () => { await Promise.resolve() })
    expect(document.activeElement).toBe(launcher)
  })

  it('handles keyboard events only in the frontmost modal', () => {
    const backClose = vi.fn(), frontClose = vi.fn()
    rendered = renderForTest(createElement('div', null,
      createElement(Dialog, { id: 'back', onClose: backClose }),
      createElement(Dialog, { id: 'front', onClose: frontClose }),
    ))
    expect(document.activeElement?.id).toBe('front-first')
    key('Escape')
    expect(frontClose).toHaveBeenCalledOnce()
    expect(backClose).not.toHaveBeenCalled()
  })
})
