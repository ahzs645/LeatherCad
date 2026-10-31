import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'

function nativeDrawing() {
  return { version: 2, name: 'Exact curves', unit_for_view: 'mm', layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], groups: [], shapes: [
    { id: 'cubic', type: 'bezier', layerId: 'main', points: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }], locked: true, alpha: 0.4, strokeWidth: 0.25, strokeColor: '#111111' },
    { id: 'ellipse', type: 'ellipse', layerId: 'main', cx: 150, cy: 40, rx: 20, ry: 10, rotation: Math.PI / 6, alpha: 0.7, strokeColor: '#111111' },
  ] }
}

async function openNative(page: Page) {
  await page.goto('/')
  await page.locator('svg.canvas').waitFor()
  await page.locator('input[accept*=".lcad"]').setInputFiles({ name: 'curves.lcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nativeDrawing())) })
  const review = page.getByRole('dialog', { name: 'Review drawing import' })
  await expect(review.getByRole('img', { name: 'Drawing preview' })).toBeVisible()
  await review.getByRole('button', { name: 'Replace current drawing', exact: true }).click()
  await expect(page.getByText('Exact curves', { exact: true })).toBeVisible()
}

async function clickCurve(page: Page, curve: Locator) {
  const point = await curve.evaluate(element => {
    const path = element as unknown as { getTotalLength(): number; getPointAtLength(at: number): { x: number; y: number }; getScreenCTM(): { a: number; b: number; c: number; d: number; e: number; f: number } | null }
    const matrix = path.getScreenCTM()
    if (!matrix) throw new Error('Curve is not on the canvas')
    const local = path.getPointAtLength(path.getTotalLength() * 0.43)
    return { x: matrix.a * local.x + matrix.c * local.y + matrix.e, y: matrix.b * local.x + matrix.d * local.y + matrix.f }
  })
  await page.mouse.click(point.x, point.y)
}

test('native curves render, respect locks, edit analytic controls and export their parameters', async ({ page }) => {
  await openNative(page)
  const cubic = page.locator('svg.canvas .canvas-editable-geometry-layer [data-primitive="cubic"]')
  const ellipse = page.locator('svg.canvas .canvas-editable-geometry-layer [data-primitive="ellipse"]')
  await expect(cubic).toHaveCount(1)
  await expect(ellipse).toHaveCount(1)
  // The assembly workspace applies its 85% context opacity in addition to the stored 40%.
  await expect(cubic).toHaveCSS('stroke-opacity', '0.34')
  await clickCurve(page, cubic)
  const controlX = page.getByLabel('Control 1 X (mm)', { exact: true })
  await expect(controlX).toBeDisabled()
  await page.getByLabel('Lock shape', { exact: true }).uncheck()
  await expect(controlX).toBeEnabled()
  await controlX.fill('5')
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click()
  await expect(cubic).toHaveAttribute('d', /C\s+5\s+100/)
  await clickCurve(page, ellipse)
  await page.getByLabel(/Radius X/).fill('35')
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click()
  await page.getByTestId('ribbon-tab-output').click()
  const pending = page.waitForEvent('download')
  await page.getByTestId('ribbon-command-save-lcad').click()
  const download = await pending
  const exported = JSON.parse(await readFile(await download.path(), 'utf8')) as { shapes: Array<{ type: string; points?: Array<{ x: number; y: number }>; rx?: number; alpha?: number; strokeWidth?: number }> }
  expect(exported.shapes).toHaveLength(2)
  expect(exported.shapes.find(shape => shape.type === 'bezier')).toMatchObject({ points: [{ x: 0, y: 0 }, { x: 5, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }], alpha: 0.4, strokeWidth: 0.25 })
  expect(exported.shapes.find(shape => shape.type === 'ellipse')?.rx).toBe(35)
})

test('drawing tools create editable cubic and ellipse primitives', async ({ page }) => {
  await openNative(page)
  const canvas = page.locator('svg.canvas')
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Canvas has no layout')
  await page.locator('.workbench-tool-rail').getByRole('button', { name: 'Cubic curve', exact: true }).click()
  for (const [x, y] of [[70, 70], [110, 110], [180, 110], [220, 70]]) await page.mouse.click(bounds.x + x, bounds.y + y)
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer [data-primitive="cubic"]')).toHaveCount(2)
  await page.locator('.workbench-tool-rail').getByRole('button', { name: 'Ellipse', exact: true }).click()
  await page.mouse.click(bounds.x + 280, bounds.y + 170)
  await page.mouse.click(bounds.x + 350, bounds.y + 230)
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer [data-primitive="ellipse"]')).toHaveCount(2)
})
