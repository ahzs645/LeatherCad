/**
 * The seam between pdf.js and the geometry walk, over a real PDF.
 *
 * `pdf-vector-paths.test.ts` feeds the walk hand-built operator lists, which
 * says nothing about whether pdf.js still hands them over in that shape. This
 * builds a genuine little PDF — byte offsets, xref table and all — and reads it
 * the way the app does, so a pdf.js release that renumbers its path opcodes or
 * changes `constructPath`'s arguments fails here rather than in the browser.
 */

import { describe, expect, it } from 'vitest'
import { loadPdfVectorPage } from './pdf-vector-source'
import { PT_TO_MM } from './pdf-vector-paths'

/** Assembles a one-page PDF around a content stream, offsets and all. */
function buildPdf(contentStream: string): Uint8Array {
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>',
    `<</Length ${contentStream.length}>>\nstream\n${contentStream}\nendstream`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Uint8Array.from(pdf, (character) => character.charCodeAt(0))
}

describe('loadPdfVectorPage', () => {
  it('reads a stroked square as millimetres, measured from the page top', async () => {
    // A 72pt square with its lower-left corner one inch in from the page's.
    const page = await loadPdfVectorPage(
      buildPdf('1 0 0 RG\n72 72 m\n144 72 l\n144 144 l\n72 144 l\nh\nS'),
    )

    expect(page.pageCount).toBe(1)
    expect(page.widthMm).toBeCloseTo(612 * PT_TO_MM, 6)
    expect(page.heightMm).toBeCloseTo(792 * PT_TO_MM, 6)

    const stroked = page.paths.filter((path) => path.paint === 'stroke')
    expect(stroked).toHaveLength(1)
    const [subpath] = stroked[0].subpaths
    expect(subpath.closed).toBe(true)
    // Four sides, all 25.4 mm, and y measured down from the top of the sheet.
    expect(subpath.segments).toHaveLength(4)
    expect(subpath.polyline[0]).toEqual({ x: 72 * PT_TO_MM, y: (792 - 72) * PT_TO_MM })
    expect(subpath.polyline[1].x - subpath.polyline[0].x).toBeCloseTo(25.4, 6)
  })

  it('closes a filled disc the author left open, and keeps its curves', async () => {
    // How Illustrator writes a stitch hole: four cubics, `f`, and no `h`.
    const page = await loadPdfVectorPage(
      buildPdf(
        [
          'q 1 0 0 1 300 400 cm',
          '0 1.62 m',
          '0.894 1.62 1.62 0.894 1.62 0 c',
          '1.62 -0.894 0.894 -1.62 0 -1.62 c',
          '-0.894 -1.62 -1.62 -0.894 -1.62 0 c',
          '-1.62 0.894 -0.894 1.62 0 1.62 c',
          'f',
          'Q',
        ].join('\n'),
      ),
    )

    const filled = page.paths.filter((path) => path.paint === 'fill')
    expect(filled).toHaveLength(1)
    const [subpath] = filled[0].subpaths
    expect(subpath.closed).toBe(true)
    expect(subpath.segments.every((segment) => segment.kind === 'cubic')).toBe(true)
    // The transform is baked in: a 3.24pt disc centred at (300, 400).
    const xs = subpath.polyline.map((point) => point.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(3.24 * PT_TO_MM, 3)
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(300 * PT_TO_MM, 3)
  })
})
