/**
 * The built bundle, loaded.
 *
 * Every other spec runs against the dev server, which serves modules
 * unbundled and so cannot show a chunking fault; the build step that follows
 * compiles the app but never opens it. Two bugs lived in that gap at once — a
 * chunk cycle that threw before the first element rendered, and a pdf.js build
 * whose page reader threw on every current browser — and neither was visible
 * to a green CI run.
 */

import { expect, test } from '@playwright/test'

/** A one-page PDF around a content stream, byte offsets and xref included. */
function buildPdf(contentStream: string): Buffer {
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
  return Buffer.from(pdf, 'latin1')
}

/** A 100 × 100 mm panel with a row of stitch holes down one side. */
function panelSheet() {
  const disc = (x: number, y: number) =>
    [
      `q 1 0 0 1 ${x} ${y} cm`,
      '0 1.62 m',
      '0.894 1.62 1.62 0.894 1.62 0 c',
      '1.62 -0.894 0.894 -1.62 0 -1.62 c',
      '-0.894 -1.62 -1.62 -0.894 -1.62 0 c',
      '-1.62 0.894 -0.894 1.62 0 1.62 c',
      'f',
      'Q',
    ].join('\n')
  const holes = Array.from({ length: 12 }, (_, index) => disc(110, 110 + index * 14.17))
  return buildPdf(
    ['0 0 0 RG', '100 100 m', '384 100 l', '384 384 l', '100 384 l', 'h', 'S', ...holes].join('\n'),
  )
}

test('the built bundle boots with no runtime error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))

  await page.goto('/')

  await expect(page.getByRole('tablist', { name: 'Workbench ribbon tabs' })).toBeVisible()
  // A chunk boundary drawn through an import cycle builds cleanly and then
  // throws `Cannot access '…' before initialization` here, before React mounts.
  expect(errors).toEqual([])
})

test('a pattern PDF imports in the built bundle', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))

  await page.goto('/')
  await page.getByRole('tab', { name: 'Output' }).click()

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Pattern PDF' }).click(),
  ])
  // Exercises the whole path in the shipped bundle: pdf.js's worker and build,
  // the vector reader, the analysis, and the document swap.
  await chooser.setFiles({ name: 'panel.pdf', mimeType: 'application/pdf', buffer: panelSheet() })

  // The document swaps to the imported sheet, and the panel comes through as a
  // piece with its stitching read off it.
  await expect(page.getByTestId('browser-node-piece:piece-a')).toBeVisible({ timeout: 30_000 })
  // 284pt square, so the millimetres prove the page box was read, not guessed.
  await expect(page.getByTestId('browser-node-piece:piece-a')).toContainText('100.2 × 100.2 mm')
  expect(errors).toEqual([])
})
