import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

function referenceRectangle() {
  const corners = [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 30 }, { x: 10, y: 30 }]
  return {
    version: 2,
    name: 'Interchange rectangle',
    unit_for_view: 'mm',
    layers: [{ id: 'main', name: 'Main', visible: true, locked: false }],
    activeLayerId: 'main',
    shapes: corners.map((point, index) => ({
      id: `edge-${index}`, type: 'line', layerId: 'main',
      strokeColor: '#111111', strokeDash: 'solid',
      x1: point.x, y1: point.y, x2: corners[(index + 1) % 4].x, y2: corners[(index + 1) % 4].y,
    })),
    groups: [],
  }
}

async function importRectangle(page: Page) {
  await page.goto('./')
  await page.locator('svg.canvas').waitFor()
  await page.locator('input[accept*=".lcad"]').setInputFiles({
    name: 'rectangle.lcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(referenceRectangle())),
  })
  const review = page.getByRole('dialog', { name: 'Review drawing import' })
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Replace current drawing', exact: true }).click()
  await expect(page.getByText('Interchange rectangle', { exact: true })).toBeVisible()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(4)
  await page.getByTestId('ribbon-tab-output').click()
  await expect(page.getByTestId('ribbon-tab-output')).toHaveAttribute('aria-selected', 'true')
}

test('native LCAD import/export keeps a rectangle and sealed LCC rejection preserves it', async ({ page }) => {
  await importRectangle(page)
  const pending = page.waitForEvent('download')
  await page.getByTestId('ribbon-command-save-lcad').click()
  const download = await pending
  expect(download.suggestedFilename()).toMatch(/\.lcad$/)
  const exported = JSON.parse(await readFile(await download.path(), 'utf8')) as { shapes: Array<{ type: string }> }
  expect(exported.shapes).toHaveLength(4)
  expect(exported.shapes.every((shape: { type: string }) => shape.type === 'line')).toBe(true)

  await page.locator('input[accept*=".lcad"]').setInputFiles({
    name: 'sealed.lcc', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ meta: { file_type: 'LeathercraftCAD_Sealed' }, sealed: { ver: 1, enc: 'zlib+base64', data: '', mac: '' }, shapes: [] })),
  })
  await expect(page.locator('.workbench-statusbar [role="status"]')).toContainText(/sealed/i)
  await expect(page.getByText('Interchange rectangle', { exact: true })).toBeVisible()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(4)
})

test('genuine sealed LCC uses the browser worker, reviews real geometry, and preserves the document on cancel or corruption', async ({ page }) => {
  const workers: string[] = []
  page.on('worker', worker => workers.push(worker.url()))
  await importRectangle(page)
  const workerCount = workers.length
  const raw = await readFile(new URL('../docs/fixtures/interchange/reference-sealed-rectangle.lcc', import.meta.url), 'utf8')
  const input = page.locator('input[accept*=".lcad"]')
  const upload = async (text: string, name = 'Verified rectangle.lcc') => input.setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) })
  await upload(raw)
  const review = page.getByRole('dialog', { name: 'Review drawing import' })
  await expect(review).toBeVisible()
  await expect(review.getByText('Verified sealed LCC v1', { exact: true })).toBeVisible()
  await expect(review.getByText('24.00 × 16.00 mm', { exact: true })).toBeVisible()
  await expect(review.locator('svg polyline')).toHaveCount(4)
  expect(workers.slice(workerCount).some(url => /document-import\.worker/.test(url))).toBe(true)
  await review.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByText('Interchange rectangle', { exact: true })).toBeVisible()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(4)

  await upload(raw)
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Replace current drawing', exact: true }).click()
  await expect(page.getByText('Verified rectangle', { exact: true })).toBeVisible()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(4)
  await page.getByTestId('ribbon-tab-output').click()
  const pending = page.waitForEvent('download')
  await page.getByTestId('ribbon-command-save-json').click()
  const saved = JSON.parse(await readFile(await (await pending).path(), 'utf8')) as { objects: Array<{ type: string; start: { x: number; y: number }; end: { x: number; y: number } }> }
  expect(saved.objects).toHaveLength(4)
  expect(saved.objects.every(shape => shape.type === 'line')).toBe(true)
  const points = saved.objects.flatMap(shape => [shape.start, shape.end])
  expect(Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x))).toBe(24)
  expect(Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y))).toBe(16)

  for (const kind of ['MAC', 'data', 'version', 'encoding']) {
    const outer = JSON.parse(raw.replace(/^\uFEFF/, '')) as { sealed: { ver: number; enc: string; data: string; mac: string } }
    if (kind === 'MAC') outer.sealed.mac = '0'.repeat(64)
    if (kind === 'data') outer.sealed.data = (outer.sealed.data[0] === 'A' ? 'B' : 'A') + outer.sealed.data.slice(1)
    if (kind === 'version') outer.sealed.ver = 2
    if (kind === 'encoding') outer.sealed.enc = 'gzip+base64'
    await upload(JSON.stringify(outer), `invalid-${kind}.lcc`)
    await expect(page.locator('.workbench-statusbar [role="status"]')).toContainText(/Could not load.*Sealed LCC files/)
    await expect(review).toHaveCount(0)
    await expect(page.getByText('Verified rectangle', { exact: true })).toBeVisible()
    await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(4)
  }
})

test('STL export produces finite millimetre geometry for the imported pattern and jig', async ({ page }, testInfo) => {
  await importRectangle(page)
  await page.getByTestId('ribbon-command-export-stl').click()
  const dialog = page.getByRole('dialog', { name: 'STL Export' })
  await expect(dialog.getByRole('button', { name: 'Download STL' })).toBeEnabled()
  for (const mode of ['pattern', 'jig']) {
    await dialog.getByLabel('Mode', { exact: true }).selectOption(mode)
    const pending = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Download STL' }).click()
    const download = await pending
    expect(download.suggestedFilename()).toContain(`-${mode}.stl`)
    const text = await readFile(await download.path(), 'utf8')
    const vertices = [...text.matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)].map(match => match.slice(1).map(Number))
    expect(vertices.length).toBeGreaterThanOrEqual(36)
    expect(vertices.every(point => point.every(Number.isFinite))).toBe(true)
    const extent = (axis: number) => Math.max(...vertices.map(point => point[axis])) - Math.min(...vertices.map(point => point[axis]))
    expect(extent(0)).toBeCloseTo(mode === 'pattern' ? 40 : 50, 2)
    expect(extent(1)).toBeCloseTo(mode === 'pattern' ? 20 : 30, 2)
    expect(extent(2)).toBeCloseTo(mode === 'pattern' ? 2 : 5, 2)
    const preview = dialog.getByRole('img', { name: 'STL mesh preview' })
    await expect(preview).toBeVisible()
    await expect.poll(async () => Number(await preview.getAttribute('width'))).toBeGreaterThan(100)
    await preview.screenshot({ path: testInfo.outputPath(`stl-${mode}-preview.png`) })
  }
})

test('DXF imports append geometry and cloud setup is explicit', async ({ page }) => {
  await importRectangle(page)
  await page.getByTestId('ribbon-command-import-dxf').click()
  const dialog = page.getByRole('dialog', { name: 'File tools' })
  await expect(dialog.getByRole('button', { name: 'Import DXF', exact: true })).toBeVisible()
  const dxf = ['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES','0','LINE','8','Imported DXF','10','100','20','0','11','120','21','0','0','ENDSEC','0','EOF',''].join('\n')
  await dialog.locator('input[accept*=".dxf"]').setInputFiles({ name: 'line.dxf', mimeType: 'application/dxf', buffer: Buffer.from(dxf) })
  await page.getByRole('dialog', { name: 'Review DXF import' }).getByRole('button', { name: 'Append selected layers', exact: true }).click()
  await expect(page.locator('.workbench-statusbar [role="status"]')).toContainText('Imported 1 DXF shapes')
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(5)
  await page.getByTestId('ribbon-command-cloud-community').click()
  const cloud = page.getByRole('dialog', { name: 'Cloud & Community' })
  await expect(cloud).toBeVisible()
  await expect(cloud.getByText(/Cloud sharing is not available/).or(cloud.getByRole('button', { name: 'Sign in', exact: true }))).toBeVisible()
})

test('a failed tool download can be closed without reloading the drawing', async ({ page }) => {
  await importRectangle(page)
  await page.route('**/*StlExportModal*', route => route.abort())
  await page.getByTestId('ribbon-command-export-stl').click()
  const failedTool = page.getByRole('alertdialog', { name: 'Tool unavailable' })
  await expect(failedTool).toBeVisible()
  await failedTool.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(failedTool).toHaveCount(0)
  await expect(page.getByText('Interchange rectangle', { exact: true })).toBeVisible()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(4)
})

test('phone file tools keep touch targets and keyboard focus inside the dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await page.locator('select.tool-select-mobile').waitFor()
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await page.getByRole('button', { name: 'File', exact: true }).click()
  const row = page.locator('.mobile-action-row').filter({ has: page.locator('option[value="file-tools"]') })
  await row.locator('select').selectOption('file-tools')
  const launcher = row.getByRole('button', { name: 'Apply', exact: true })
  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'File tools' })
  await expect(dialog.getByRole('button', { name: 'Import DXF', exact: true })).toBeVisible()
  const targets = await dialog.locator('button, select').all()
  const measurements = await Promise.all(targets.map(async target => ({ box: await target.boundingBox(), text: await target.textContent() })))
  const smallTargets = measurements.filter(({ box }) => box && box.width > 0 && box.height < 44).map(({ text }) => text)
  expect(smallTargets).toEqual([])
  await dialog.getByRole('button', { name: 'Done', exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect.poll(() => dialog.evaluate(element => {
    const target = element as unknown as { contains(node: unknown): boolean; ownerDocument: { activeElement: unknown } }
    return target.contains(target.ownerDocument.activeElement)
  })).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(launcher).toBeFocused()
})
