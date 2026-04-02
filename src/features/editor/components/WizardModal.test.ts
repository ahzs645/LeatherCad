import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { changeValue, cleanupRender, click, getByText, renderForTest } from '../../../test/render'
import { WizardModal } from './WizardModal'

let lastRender: ReturnType<typeof renderForTest> | null = null

afterEach(() => {
  cleanupRender(lastRender)
  lastRender = null
})

describe('WizardModal', () => {
  it('prevents rapid duplicate generation from the Generate button', () => {
    const onGenerate = vi.fn()

    lastRender = renderForTest(
      createElement(WizardModal, {
        open: true,
        onClose: () => undefined,
        onGenerate,
        defaultLayerId: 'layer-1',
        defaultLineTypeId: 'line-1',
      }),
    )

    const generateButton = getByText<HTMLButtonElement>(lastRender.container, 'button', 'Generate')
    click(generateButton)
    click(generateButton)

    expect(onGenerate).toHaveBeenCalledTimes(1)
    expect(generateButton.disabled).toBe(true)
    expect(generateButton.textContent).toBe('Generating…')
  })

  it('submits the rounded watch strap option with the expected tip shape value', () => {
    const onGenerate = vi.fn()

    lastRender = renderForTest(
      createElement(WizardModal, {
        open: true,
        onClose: () => undefined,
        onGenerate,
        defaultLayerId: 'layer-1',
        defaultLineTypeId: 'line-1',
      }),
    )

    const tipShapeSelect = Array.from(lastRender.container.querySelectorAll('select')).at(0) ?? null
    changeValue(tipShapeSelect, 'round')
    click(getByText(lastRender.container, 'button', 'Generate'))

    expect(onGenerate).toHaveBeenCalledWith(
      'watch-strap',
      expect.objectContaining({
        tipShape: 'round',
      }),
    )
  })
})
