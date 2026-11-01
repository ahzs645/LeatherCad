import { describe, expect, it, vi } from 'vitest'
// Node uses pdf.js's adjacent fake worker; the browser URL is covered by the built-bundle gate.
vi.mock('../pdf-worker', () => ({}))
import { preparePatternPdfReview } from './pattern-pdf-review'
import { buildPatternPdfImportFromPage } from './pattern-pdf-import'

function pdf(streams: string[]) {
  const objects = ['<</Type/Catalog/Pages 2 0 R>>', `<</Type/Pages/Kids[${streams.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}]/Count ${streams.length}>>`]
  for (const stream of streams) objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents ${objects.length + 2} 0 R>>`, `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`)
  let source = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => { const offset = source.length; source += `${index + 1} 0 obj\n${object}\nendobj\n`; return offset })
  const xref = source.length
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`
  return Uint8Array.from(source, (character) => character.charCodeAt(0))
}
const outline = '100 100 m 384 100 l 384 384 l 100 384 l h S'
const disc = (y: number) => `q 1 0 0 1 110 ${y} cm 0 1 m .55 1 1 .55 1 0 c 1 -.55 .55 -1 0 -1 c -.55 -1 -1 -.55 -1 0 c -1 .55 -.55 1 0 1 c f Q`

describe('pattern PDF review', () => {
  it('scans beyond instruction pages and suggests the parts on page 4', async () => {
    const review = await preparePatternPdfReview(pdf(['10 10 m 20 10 l S', '', '', outline]), 'four-pages.pdf')
    expect(review.pages).toHaveLength(4)
    expect(review.pages[0].result?.analysis.pieces).toHaveLength(0)
    expect(review.pages[0].issues.join(' ')).toContain('instruction')
    expect(review.suggestedPageNumber).toBe(4)
    expect(review.pages[3].result?.analysis.pieces).toHaveLength(1)
    expect(review.pages[3].result?.doc.patternPieces?.[0].name).toBeTruthy()
  })
  it('surfaces false-pitch uncertainty and lets the maker remove inferred stitching', async () => {
    const review = await preparePatternPdfReview(pdf([[outline, ...[0, 10, 20, 35, 45, 55, 65].map((offset) => disc(110 + offset))].join('\n')]), 'irregular.pdf')
    const page = review.pages[0]
    expect(page.result?.analysis.stitching.totalHoles).toBeGreaterThan(0)
    expect(page.issues.join(' ')).toContain('irregular spacing')
    expect(page.confidence).toBe('low')
    const without = buildPatternPdfImportFromPage(page.page!, {}, false)
    expect(without.doc.stitchHoles).toHaveLength(0)
    expect(without.doc.seamConnections).toHaveLength(0)
    expect(without.doc.patternPieces).toHaveLength(1)
  })
  it('rejects an over-limit input before loading a worker', async () => {
    await expect(preparePatternPdfReview(new Uint8Array(50 * 1024 * 1024 + 1), 'large.pdf')).rejects.toThrow('50 MB')
  })
})
