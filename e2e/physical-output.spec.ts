/// <reference lib="dom" />
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const cases = [
  { name: 'a4', file: 'xy-100mm-a4', x: 1, y: 1, width: 210 },
  { name: 'letter', file: 'xy-100mm-letter', x: 1, y: 1, width: 215.9 },
  { name: 'calibrated portrait', file: 'automated/xy-100mm-a4-calibrated-portrait', x: 1.1, y: 0.9, width: 210 },
  { name: 'calibrated landscape', file: 'automated/xy-100mm-a4-calibrated-landscape', x: 0.9, y: 1.1, width: 297 },
]
for (const sample of cases) {
  test(`printed ${sample.name} keeps physical axis lengths and pitch`, async ({ page }) => {
    await page.setContent(readFileSync(new URL(`../docs/fixtures/physical-calibration/${sample.file}.html`, import.meta.url), 'utf8'))
    const measurement = await page.locator('.print-svg').evaluate(svg => {
      const outer = svg as unknown as SVGSVGElement
      const lengths = Array.from(outer.querySelectorAll<SVGLineElement>('line')).map(line => {
        const matrix = line.getScreenCTM()!
        const start = new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(matrix)
        const end = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(matrix)
        return { x: start.x, y: start.y, dx: end.x - start.x, dy: end.y - start.y }
      })
      return { lengths, pageWidth: outer.getBoundingClientRect().width }
    })
    const pixelsPerMm = 96 / 25.4
    const [x, y] = measurement.lengths
    expect(x.dx / pixelsPerMm).toBeCloseTo(100 * sample.x, 2)
    expect(y.dy / pixelsPerMm).toBeCloseTo(100 * sample.y, 2)
    const pitchMarks = measurement.lengths.filter(line => Math.abs(line.dy / pixelsPerMm - 5 * sample.y) < 0.001)
    expect(pitchMarks).toHaveLength(11)
    expect((pitchMarks[10].x - pitchMarks[0].x) / pixelsPerMm).toBeCloseTo(40 * sample.x, 2)
    expect(measurement.pageWidth / pixelsPerMm).toBeCloseTo(sample.width, 1)
  })
}

for (const sample of [{ name: '100%', file: 'asymmetric-tiled-a4', x: 1, y: 1, pages: 2 },
  { name: '110% portrait', file: 'automated/asymmetric-tiled-a4-calibrated-portrait', x: 1.1, y: 0.9, pages: 2 },
  { name: '90% landscape', file: 'automated/asymmetric-tiled-a4-calibrated-landscape', x: 0.9, y: 1.1, pages: 4 }]) {
test(`tiled pages at ${sample.name} preserve scale and 10mm shared overlap`, async ({ page }) => {
  await page.setContent(readFileSync(new URL(`../docs/fixtures/physical-calibration/${sample.file}.html`, import.meta.url), 'utf8'))
  const tiles = await page.locator('.print-svg > svg').evaluateAll(elements => elements.map(element => {
    const svg = element as unknown as SVGSVGElement
    return { minX: svg.viewBox.baseVal.x, minY: svg.viewBox.baseVal.y, width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height, physicalWidth: svg.width.baseVal.value }
  }))
  expect(tiles).toHaveLength(sample.pages)
  // SVG DOM lengths use browser float precision; physical overlap is checked
  // within 0.0005mm, independently of the planner's double-precision tests.
  expect(tiles[0].width / tiles[0].physicalWidth).toBeCloseTo(1 / sample.x, 6)
  expect(tiles[1].width / tiles[1].physicalWidth).toBeCloseTo(1 / sample.x, 6)
  expect((tiles[0].minX + tiles[0].width - tiles[1].minX) * sample.x).toBeCloseTo(10, 3)
  if (sample.pages === 4) expect((tiles[0].minY + tiles[0].height - tiles[2].minY) * sample.y).toBeCloseTo(10, 3)
})
}

test('Print opens populated calibrated pages with the editor opener detached', async ({ page }) => {
  await page.goto('./')
  await page.locator('svg.canvas').waitFor()
  const drawing = readFileSync(new URL('../docs/fixtures/physical-calibration/xy-100mm.json', import.meta.url), 'utf8')
  await page.evaluate(raw => localStorage.setItem('leathercraft-open-doc-print-acceptance', raw), drawing)
  await page.goto('./?openDoc=print-acceptance')
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(16)
  await page.getByTestId('ribbon-tab-output').click()
  await page.getByTestId('ribbon-command-print-preview').click()
  const dialog = page.getByRole('dialog', { name: 'Print Preview + Tiling', exact: true })
  await dialog.getByLabel('Paper', { exact: true }).selectOption('a4')
  await dialog.getByLabel('Calibration X (%)', { exact: true }).fill('110')
  await dialog.getByLabel('Calibration Y (%)', { exact: true }).fill('90')
  const event = page.waitForEvent('popup')
  await dialog.getByRole('button', { name: 'Open Printable Tiles', exact: true }).click()
  const popup = await event
  await expect(popup.locator('.print-page')).toHaveCount(1)
  await expect(popup.getByRole('button', { name: 'Print', exact: true })).toBeVisible()
  expect(await popup.evaluate(() => window.opener === null)).toBe(true)
  const size = await popup.locator('.print-svg line').first().evaluate(element => {
    const line = element as unknown as SVGLineElement
    const matrix = line.getScreenCTM()!
    const a = new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(matrix)
    const b = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(matrix)
    return Math.hypot(b.x - a.x, b.y - a.y) * 25.4 / 96
  })
  expect(size).toBeCloseTo(110, 2)
  await popup.close()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(16)
})
