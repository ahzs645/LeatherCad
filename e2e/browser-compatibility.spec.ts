import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('WebKit phone imports through review and downloads the saved drawing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto('/')
  await expect(page.locator('select.tool-select-mobile')).toBeVisible()
  const corners = [[0, 0], [100, 0], [100, 40], [0, 40]]
  const doc = { version: 2, name: 'WebKit phone panel', unit_for_view: 'mm',
    layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main',
    shapes: corners.map(([x1, y1], index) => ({ id: `edge-${index}`, type: 'line', layerId: 'main',
      strokeColor: '#111111', strokeDash: 'solid', x1, y1,
      x2: corners[(index + 1) % 4][0], y2: corners[(index + 1) % 4][1] })), groups: [] }
  await page.locator('input[accept*=".lcad"]').setInputFiles({ name: 'phone.lcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) })
  const review = page.getByRole('dialog', { name: 'Review drawing import' })
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Replace current drawing', exact: true }).tap()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(4)
  await page.getByRole('button', { name: 'Options', exact: true }).tap()
  await page.getByRole('button', { name: 'File', exact: true }).tap()
  const row = page.getByRole('group', { name: 'Common file actions' })
  const downloadEvent = page.waitForEvent('download')
  await row.getByRole('button', { name: 'Save', exact: true }).tap()
  const download = await downloadEvent
  const saved = JSON.parse(await readFile(await download.path(), 'utf8')) as { objects: unknown[] }
  expect(saved.objects).toHaveLength(4)
  await page.getByRole('button', { name: 'File tools', exact: true }).tap()
  const files = page.getByRole('dialog', { name: 'File tools', exact: true })
  await expect(files).toBeVisible()
  await files.getByRole('button', { name: 'Done', exact: true }).tap()
  await expect(files).toHaveCount(0)
  expect(errors).toEqual([])
})

test('WebKit phone recovers a draft after reload and saves its recovered content', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('select.tool-select-mobile')).toBeVisible()
  await page.evaluate(() => localStorage.setItem('leathercad-autosave-v1', JSON.stringify({ version: 1, units: 'mm',
    documentName: 'WebKit recovered draft', objects: [{ id: 'recovered-edge', type: 'line', layerId: 'main', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 73, y: 19 } }],
    layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main' })))
  await page.reload()
  const recovery = page.getByRole('dialog', { name: 'Recover saved drawing' })
  await expect(recovery).toBeVisible()
  await recovery.getByRole('button', { name: 'Recover', exact: true }).tap()
  await expect(recovery).toHaveCount(0)
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(1)
  await page.getByRole('button', { name: 'Options', exact: true }).tap()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('group', { name: 'Common file actions' }).getByRole('button', { name: 'Save', exact: true }).tap()
  const download = await downloadEvent
  const saved = JSON.parse(await readFile(await download.path(), 'utf8')) as { documentName: string; objects: Array<{ id: string }> }
  expect(saved.documentName).toBe('WebKit recovered draft')
  expect(saved.objects.map(shape => shape.id)).toEqual(['recovered-edge'])
})
