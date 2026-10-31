import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test, type Page, type Locator } from '@playwright/test'

function referenceDrawing(overlap = false, text = false) {
  const rectangle = (x: number, y: number, w: number, h: number, prefix: string) => {
    const points = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]
    return points.map((p, i) => ({ id: `${prefix}${i}`, type: 'line', layerId: 'main', strokeColor: '#111111', strokeDash: 'solid', x1: p.x, y1: p.y, x2: points[(i + 1) % 4].x, y2: points[(i + 1) % 4].y }))
  }
  return { version: 2, name: 'Manufacturing acceptance', unit_for_view: 'mm', layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main', shapes: [
    ...rectangle(10, 10, overlap ? 20 : 40, 20, 'a'), ...(overlap ? rectangle(20, 10, 20, 20, 'b') : []),
    ...(text ? [{ id: 'text', type: 'text', layerId: 'main', x: 15, y: 25, content: 'O', fontFamily: 'LeatherCad Test', fontSize: 8, rotation: 0 }] : []),
  ], groups: [] }
}
async function openManufacturing(page: Page, overlap = false, text = false) {
  await page.goto('/')
  await page.locator('svg.canvas').waitFor()
  await page.locator('input[accept*=".lcad"]').setInputFiles({ name: 'manufacturing.lcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(referenceDrawing(overlap, text))) })
  const review = page.getByRole('dialog', { name: 'Review drawing import' })
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Replace current drawing', exact: true }).click()
  await expect(page.getByText('Manufacturing acceptance', { exact: true })).toBeVisible()
  await page.getByTestId('ribbon-tab-output').click()
  await page.getByTestId('ribbon-command-export-stl').click()
  const dialog = page.getByRole('dialog', { name: 'STL Export' })
  await expect(dialog.getByRole('button', { name: 'Download STL', exact: true })).toBeEnabled()
  return dialog
}
async function downloadGeometry(page: Page, dialog: Locator) {
  const ready = dialog.getByRole('button', { name: 'Download STL', exact: true })
  await expect(ready).toBeEnabled()
  const pending = page.waitForEvent('download')
  await ready.click()
  const download = await pending
  const source = await readFile(await download.path(), 'utf8')
  const vertices = [...source.matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)].map((match) => match.slice(1).map(Number))
  expect(vertices.length).toBeGreaterThan(0)
  expect(vertices.every((p) => p.every(Number.isFinite))).toBe(true)
  const extent = (axis: number) => Math.max(...vertices.map((p) => p[axis])) - Math.min(...vertices.map((p) => p[axis]))
  return { source, vertices, extent }
}

test('manufacturing worker exports finished patterns and jigs and persists document settings', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let dialog = await openManufacturing(page)
  await dialog.getByLabel('Thickness (mm)', { exact: true }).fill('4')
  await dialog.getByLabel('Edge finish', { exact: true }).selectOption('chamfer')
  await dialog.getByLabel('Edge size (mm)', { exact: true }).fill('0.5')
  const chamfer = await downloadGeometry(page, dialog)
  expect([chamfer.extent(0), chamfer.extent(1), chamfer.extent(2)]).toEqual([40, 20, 4])
  const normals = [...chamfer.source.matchAll(/facet normal\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)].map((match) => match.slice(1).map(Number))
  expect(normals.some((normal) => Math.abs(normal[2]) > 0.1 && Math.hypot(normal[0], normal[1]) > 0.1)).toBe(true)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByTestId('ribbon-command-export-stl').click()
  dialog = page.getByRole('dialog', { name: 'STL Export' })
  await expect(dialog.getByLabel('Thickness (mm)', { exact: true })).toHaveValue('4')
  await expect(dialog.getByLabel('Edge finish', { exact: true })).toHaveValue('chamfer')
  await dialog.getByLabel('Preview material', { exact: true }).selectOption('metal')
  await dialog.getByLabel('Preview color', { exact: true }).fill('#112233')
  expect((await downloadGeometry(page, dialog)).source).toBe(chamfer.source)
  await dialog.getByLabel('Mode', { exact: true }).selectOption('jig')
  await dialog.getByLabel('Outside shape', { exact: true }).selectOption('dimensions')
  await dialog.getByLabel('Jig width (mm)', { exact: true }).fill('60')
  await dialog.getByLabel('Jig height (mm)', { exact: true }).fill('40')
  await dialog.getByLabel('Pocket clearance (mm)', { exact: true }).fill('-0.2')
  await dialog.getByText('Finger holes (0)', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Add finger hole', exact: true }).click()
  await dialog.getByLabel('X (mm)', { exact: true }).fill('30')
  await dialog.getByLabel('Y (mm)', { exact: true }).fill('20')
  await dialog.getByLabel('Diameter (mm)', { exact: true }).fill('5')
  const jig = await downloadGeometry(page, dialog)
  expect([jig.extent(0), jig.extent(1), jig.extent(2)]).toEqual([60, 40, 5])
  await expect(dialog.getByText(/Negative pocket clearance/)).toBeVisible()
  expect(errors).toEqual([])
})

test('manufacturing face depths and through cuts change exported geometry', async ({ page }) => {
  const dialog = await openManufacturing(page, true)
  const region = dialog.getByLabel('Manufacturing region', { exact: true })
  await expect(region.locator('option')).toHaveCount(3)
  await region.selectOption({ index: 0 })
  await dialog.getByLabel('Region thickness (mm)', { exact: true }).fill('1')
  await expect(dialog.getByRole('button', { name: 'Download STL', exact: true })).toBeEnabled()
  await region.selectOption({ index: 1 })
  await dialog.getByLabel('Through region', { exact: true }).check()
  const result = await downloadGeometry(page, dialog)
  expect(result.extent(2)).toBe(2)
  expect(new Set(result.vertices.map((p) => p[2])).has(1)).toBe(true)
  await dialog.getByRole('button', { name: 'Reset all region overrides', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Download STL', exact: true })).toBeEnabled()
})

test('uploaded font engraving exports top and bottom recesses and rejects incompatible finishing', async ({ page }) => {
  let dialog = await openManufacturing(page, false, true)
  await dialog.getByLabel('Engraving face', { exact: true }).selectOption('top')
  await expect(dialog.getByRole('alert')).toContainText('Load the exact')
  const boundedFontName = 'x'.repeat(200)
  await dialog.getByLabel('Engraving font (.ttf/.otf)', { exact: true }).setInputFiles({ name: `${'x'.repeat(205)}.ttf`, mimeType: 'font/ttf', buffer: await readFile(resolve('src/features/editor/io/manufacturing/fixtures/engraving-test.ttf')) })
  const top = await downloadGeometry(page, dialog)
  expect(new Set(top.vertices.map((p) => p[2])).has(1.5)).toBe(true)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByTestId('ribbon-command-export-stl').click()
  dialog = page.getByRole('dialog', { name: 'STL Export' })
  await expect(dialog.getByText(boundedFontName, { exact: true })).toBeVisible()
  expect((await downloadGeometry(page, dialog)).source).toBe(top.source)
  await dialog.getByLabel('Engraving face', { exact: true }).selectOption('bottom')
  const bottom = await downloadGeometry(page, dialog)
  expect(new Set(bottom.vertices.map((p) => p[2])).has(0.5)).toBe(true)
  await dialog.getByLabel('Edge finish', { exact: true }).selectOption('chamfer')
  await expect(dialog.getByRole('alert')).toContainText('uniform pattern thickness without engraving')
  await expect(dialog.getByRole('button', { name: 'Download STL', exact: true })).toBeDisabled()
  await dialog.getByLabel('Edge finish', { exact: true }).selectOption('none')
  await expect(dialog.getByRole('button', { name: 'Download STL', exact: true })).toBeEnabled()
})

test('replacing the drawing resets manufacturing settings and cancels the previous session', async ({ page }) => {
  let dialog = await openManufacturing(page)
  await dialog.getByLabel('Thickness (mm)', { exact: true }).fill('4')
  await expect(dialog.getByRole('button', { name: 'Download STL', exact: true })).toBeEnabled()
  const points = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }]
  const replacement = { version: 1, units: 'mm', documentName: 'Replacement manufacturing', layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main', lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', style: 'solid', color: '#000000', visible: true }], activeLineTypeId: 'cut', objects: points.map((start, index) => ({ id: `replacement-${index}`, type: 'line', layerId: 'main', lineTypeId: 'cut', start, end: points[(index + 1) % points.length] })), foldLines: [], manufacturing: { version: 1, thicknessMm: 7 } }
  await page.locator('input[accept*=".lcad"]').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) })
  const review = page.getByRole('dialog', { name: 'Review drawing import' })
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Replace current drawing', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'STL Export' })
  await expect(dialog.getByLabel('Thickness (mm)', { exact: true })).toHaveValue('7')
  await expect(dialog.getByLabel('Engraving face', { exact: true })).toHaveValue('none')
  const geometry = await downloadGeometry(page, dialog)
  expect([geometry.extent(0), geometry.extent(1), geometry.extent(2)]).toEqual([20, 10, 7])
})
