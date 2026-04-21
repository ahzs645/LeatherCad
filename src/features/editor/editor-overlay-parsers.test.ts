import { describe, expect, it } from 'vitest'
import { parseTracingOverlay } from './editor-overlay-parsers'

describe('parseTracingOverlay', () => {
  it('preserves embedded PDF tracing payload metadata', () => {
    const overlay = parseTracingOverlay({
      id: 'trace-1',
      name: 'Pattern.pdf',
      kind: 'pdf',
      sourceUrl: 'data:image/png;base64,AA==',
      pdfSourceUrl: 'data:application/pdf;base64,AA==',
      pdfPageNumber: 2,
      pdfPageCount: 6,
      visible: true,
      locked: true,
      opacity: 0.6,
      scale: 1,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      width: 100,
      height: 200,
      dpi: 144,
      isObjectUrl: false,
    })

    expect(overlay?.sourceUrl).toBe('data:image/png;base64,AA==')
    expect(overlay?.pdfSourceUrl).toBe('data:application/pdf;base64,AA==')
    expect(overlay?.pdfPageNumber).toBe(2)
    expect(overlay?.pdfPageCount).toBe(6)
    expect(overlay?.dpi).toBe(144)
    expect(overlay?.isObjectUrl).toBe(false)
  })
})
