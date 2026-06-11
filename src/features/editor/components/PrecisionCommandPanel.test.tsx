import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { changeValue, cleanupRender, renderForTest } from '../../../test/render'
import { PrecisionCommandPanel } from './PrecisionCommandPanel'

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

function submit(container: ParentNode) {
  const form = container.querySelector('form')
  if (!form) {
    throw new Error('Missing command form')
  }
  act(() => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

function press(input: HTMLInputElement, key: string) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

function renderStrip(onRunCommand = vi.fn((command: string) => `ran ${command}`), onClose = vi.fn()) {
  lastRender = renderForTest(
    createElement(PrecisionCommandPanel, {
      open: true,
      onClose,
      toolHint: null,
      onRunCommand,
      variant: 'strip',
    }),
  )
  const input = lastRender.container.querySelector<HTMLInputElement>('input[aria-label="CAD command input"]')
  if (!input) {
    throw new Error('Missing CAD command input')
  }
  return { input, onClose, onRunCommand }
}

describe('PrecisionCommandPanel', () => {
  it('keeps command history navigable with ArrowUp and ArrowDown', () => {
    const { input, onRunCommand } = renderStrip()

    changeValue(input, 'line')
    submit(lastRender!.container)
    changeValue(input, 'rect')
    submit(lastRender!.container)

    press(input, 'ArrowUp')
    expect(input.value).toBe('rect')
    press(input, 'ArrowUp')
    expect(input.value).toBe('line')
    press(input, 'ArrowDown')
    expect(input.value).toBe('rect')
    press(input, 'ArrowDown')
    expect(input.value).toBe('')
    expect(onRunCommand).toHaveBeenNthCalledWith(1, 'line')
    expect(onRunCommand).toHaveBeenNthCalledWith(2, 'rect')
  })

  it('repeats the last command when submitting an empty input', () => {
    const { input, onRunCommand } = renderStrip()

    submit(lastRender!.container)
    expect(onRunCommand).not.toHaveBeenCalled()

    changeValue(input, 'trim')
    submit(lastRender!.container)
    submit(lastRender!.container)

    expect(onRunCommand).toHaveBeenNthCalledWith(1, 'trim')
    expect(onRunCommand).toHaveBeenNthCalledWith(2, 'trim')
  })

  it('clears input first on Escape, then runs finish without closing the strip', () => {
    const { input, onClose, onRunCommand } = renderStrip()

    changeValue(input, 'offset 3')
    press(input, 'Escape')

    expect(input.value).toBe('')
    expect(onRunCommand).not.toHaveBeenCalled()

    press(input, 'Escape')

    expect(onRunCommand).toHaveBeenCalledWith('finish')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes an open modal from the window Escape listener', () => {
    const onClose = vi.fn()
    lastRender = renderForTest(
      createElement(PrecisionCommandPanel, {
        open: true,
        onClose,
        toolHint: null,
        onRunCommand: vi.fn(),
      }),
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })

    expect(onClose).toHaveBeenCalledOnce()
  })
})
