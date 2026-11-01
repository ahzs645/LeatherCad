import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { reviewPatternPdfPage, type PatternPdfReview } from '../ops/pattern-pdf/pattern-pdf-review'
import { PatternPdfReviewModal } from './PatternPdfReviewModal'

let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null })
describe('pattern PDF review dialog', () => {
  it('keeps document application behind explicit review and cancel never confirms', () => {
    const confirm = vi.fn(), close = vi.fn()
    const page = reviewPatternPdfPage({ pageNumber: 1, pageCount: 1, widthMm: 210, heightMm: 297, paths: [], text: [] }, 'Instructions')
    const review: PatternPdfReview = { fileName: 'instructions.pdf', pages: [page], suggestedPageNumber: 1 }
    rendered = renderForTest(createElement(PatternPdfReviewModal, { review, onConfirm: confirm, onClose: close }))
    expect(rendered.container.querySelector('[role="dialog"]')).not.toBeNull()
    const buttons = [...rendered.container.querySelectorAll('button')]
    expect(buttons.find((button) => button.textContent === 'Import reviewed page')?.disabled).toBe(true)
    click(buttons.find((button) => button.textContent === 'Cancel')!)
    expect(close).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
  })
})
