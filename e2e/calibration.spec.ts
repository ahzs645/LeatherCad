import { readFile } from 'node:fs/promises'
import { expect, test, type Page, type Locator } from '@playwright/test'

async function openManufacturing(page: Page) {
  const points = [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 30 }, { x: 10, y: 30 }]
  const drawing = { version: 2, name: 'Calibration acceptance', unit_for_view: 'mm', layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main', groups: [],
    shapes: points.map((point, index) => ({ id: `edge-${index}`, type: 'line', layerId: 'main', strokeColor: '#111111', strokeDash: 'solid', x1: point.x, y1: point.y, x2: points[(index + 1) % 4].x, y2: points[(index + 1) % 4].y })) }
  await page.goto('./')
  await page.locator('svg.canvas').waitFor()
  await page.locator('input[accept*=".lcad"]').setInputFiles({ name: 'calibration.lcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(drawing)) })
  const review = page.getByRole('dialog', { name: 'Review drawing import' })
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Replace current drawing', exact: true }).click()
  await expect(page.getByText('Calibration acceptance', { exact: true })).toBeVisible()
  await page.getByTestId('ribbon-tab-output').click()
  await page.getByTestId('ribbon-command-export-stl').click()
  return page.getByRole('dialog', { name: 'STL Export' })
}
async function downloadGeometry(page: Page, dialog: Locator) {
  const ready = dialog.getByRole('button', { name: 'Download STL', exact: true })
  await expect(ready).toBeEnabled()
  const pending = page.waitForEvent('download')
  await ready.click()
  const download = await pending
  const source = await readFile(await download.path(), 'utf8')
  expect(source).toContain('vertex ')
  return { source }
}

test('printer fit gauge and checklist downloads preserve the current drawing export', async ({ page }, testInfo) => {
  const dialog = await openManufacturing(page)
  const original = await downloadGeometry(page, dialog)
  const calibration = dialog.getByRole('region', { name: 'Printer fit calibration' })
  const checklistDownload = page.waitForEvent('download')
  await calibration.getByRole('button', { name: 'Download measurement checklist', exact: true }).click()
  const checklist = await checklistDownload
  expect(checklist.suggestedFilename()).toBe('leathercad-printer-fit-checklist.txt')
  const checklistText = await readFile(await checklist.path(), 'utf8')
  expect(checklistText).toContain('70 mm; height 60 mm; thickness 5 mm')
  expect(checklistText).toContain('have NOT been performed')
  const gaugeDownload = page.waitForEvent('download')
  await calibration.getByRole('button', { name: 'Download fit gauge STL', exact: true }).click()
  const gauge = await gaugeDownload
  expect(gauge.suggestedFilename()).toBe('leathercad-printer-fit-gauge.stl')
  const source = await readFile(await gauge.path(), 'utf8')
  expect(source).toContain('solid LeatherCad_printer_fit_gauge_mm')
  const vertices = [...source.matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)].map(match => match.slice(1).map(Number))
  expect(vertices.length).toBeGreaterThan(0)
  expect(vertices.every(point => point.every(Number.isFinite))).toBe(true)
  const extents = [0, 1, 2].map(axis => Math.max(...vertices.map(point => point[axis])) - Math.min(...vertices.map(point => point[axis])))
  expect(extents).toEqual([88, 60, 8])
  await expect(calibration.getByRole('button', { name: 'Download fit gauge STL', exact: true })).toBeEnabled()
  await calibration.screenshot({ path: testInfo.outputPath('printer-fit-calibration-panel.png') })
  expect((await downloadGeometry(page, dialog)).source).toBe(original.source)
  await expect(page.getByText('Calibration acceptance', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByTestId('interface-language').first().selectOption('ja')
  await page.getByTestId('ribbon-command-export-stl').click()
  const localizedDialog = page.getByRole('dialog', { name: 'STL 書き出し' })
  await page.setViewportSize({ width: 390, height: 844 })
  const localizedPanel = localizedDialog.getByRole('region', { name: 'プリンターのはめ合い調整' })
  await localizedPanel.scrollIntoViewIfNeeded()
  await expect(localizedPanel.getByRole('button', { name: 'はめ合いゲージ STL をダウンロード', exact: true })).toBeInViewport()
  expect(await localizedPanel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await localizedPanel.screenshot({ path: testInfo.outputPath('printer-fit-calibration-japanese-phone.png') })
})
