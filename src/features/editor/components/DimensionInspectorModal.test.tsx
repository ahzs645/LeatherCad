import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { changeValue, cleanupRender, click, renderForTest } from '../../../test/render'
import { DimensionInspectorModal } from './DimensionInspectorModal'
import type { DimensionLine } from '../cad/cad-types'

function makeDimension(id: string, overrides: Partial<DimensionLine> = {}): DimensionLine {
  return {
    id,
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    offsetMm: 10,
    layerId: 'layer-1',
    lineTypeId: 'dim',
    ...overrides,
  }
}

describe('DimensionInspectorModal', () => {
  let rendered: ReturnType<typeof renderForTest> | null = null

  afterEach(() => {
    cleanupRender(rendered)
    rendered = null
  })

  it('returns null when closed', () => {
    rendered = renderForTest(
      createElement(DimensionInspectorModal, {
        open: false,
        dimensions: [makeDimension('d1')],
        onClose: () => {},
        onUpdateDimension: () => {},
      }),
    )
    expect(rendered.container.querySelector('.modal-overlay')).toBeNull()
  })

  it('renders an empty-state message when there are no dimensions', () => {
    rendered = renderForTest(
      createElement(DimensionInspectorModal, {
        open: true,
        dimensions: [],
        onClose: () => {},
        onUpdateDimension: () => {},
      }),
    )
    expect(rendered.container.textContent).toContain('No dimension lines')
  })

  it('toggling arrowOnly updates the selected dimension via callback', () => {
    const onUpdateDimension = vi.fn()
    rendered = renderForTest(
      createElement(DimensionInspectorModal, {
        open: true,
        dimensions: [makeDimension('d1', { arrowOnly: false })],
        onClose: () => {},
        onUpdateDimension,
      }),
    )
    const arrowOnlyCheckbox = Array.from(rendered.container.querySelectorAll('input[type="checkbox"]')).find(
      (input) => input.parentElement?.textContent?.includes('Arrow only'),
    ) as HTMLInputElement | undefined
    expect(arrowOnlyCheckbox).toBeTruthy()
    if (!arrowOnlyCheckbox) return
    click(arrowOnlyCheckbox)
    expect(onUpdateDimension).toHaveBeenCalledWith('d1', { arrowOnly: true })
  })

  it('changing precision propagates the integer value', () => {
    const onUpdateDimension = vi.fn()
    rendered = renderForTest(
      createElement(DimensionInspectorModal, {
        open: true,
        dimensions: [makeDimension('d1', { precision: 1 })],
        onClose: () => {},
        onUpdateDimension,
      }),
    )
    const precisionInput = Array.from(rendered.container.querySelectorAll('input[type="number"]')).find(
      (input) => input.previousElementSibling?.textContent?.includes('Precision'),
    ) as HTMLInputElement | undefined
    expect(precisionInput).toBeTruthy()
    if (!precisionInput) return
    changeValue(precisionInput, '3')
    expect(onUpdateDimension).toHaveBeenLastCalledWith('d1', { precision: 3 })
  })
})
