import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('saved drafts survive reload, offer backup before recovery, and require explicit discard', async ({ page }) => {
  await page.goto('/')
  await page.locator('svg.canvas').waitFor()
  const doc = { version: 1, units: 'mm', documentName: 'Recovery acceptance drawing',
    objects: [{ id: 'recovered-edge', type: 'line', layerId: 'main', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }],
    layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main' }
  await page.evaluate(document => localStorage.setItem('leathercad-autosave-v1', JSON.stringify(document)), doc)
  await page.reload()
  const dialog = page.getByRole('dialog', { name: 'Recover saved drawing' })
  await expect(dialog.getByRole('button', { name: 'Recover', exact: true })).toBeEnabled()
  const pendingDownload = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download saved draft', exact: true }).click()
  const download = await pendingDownload
  const recoveredBackup = JSON.parse(await readFile(await download.path(), 'utf8')) as { documentName: string }
  expect(recoveredBackup.documentName).toBe('Recovery acceptance drawing')
  await dialog.getByRole('button', { name: 'Recover', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Recovery acceptance drawing', { exact: true })).toBeVisible()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(1)
  await page.reload()
  await expect(dialog.getByRole('button', { name: 'Discard stored drafts', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Discard stored drafts', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('svg.canvas')).toBeVisible()
})

test('an explicitly opened drawing takes precedence over a pre-sign-in recovery draft', async ({ page }) => {
  await page.goto('/')
  await page.locator('svg.canvas').waitFor()
  const base = { version: 1, units: 'mm', objects: [], layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main' }
  await page.evaluate(document => {
    localStorage.setItem('leathercad-recovery-signin-v1', JSON.stringify({ version: 1, id: 'before-signin', savedAt: Date.now(), reason: 'signin', localDocumentId: 'named-original', serializedDoc: JSON.stringify({ ...document, documentName: 'Old sign-in draft' }) }))
    localStorage.setItem('leathercraft-open-doc-recovery-acceptance', JSON.stringify({ ...document, documentName: 'Explicit newly opened drawing' }))
  }, base)
  await page.goto('/?openDoc=recovery-acceptance')
  const dialog = page.getByRole('dialog', { name: 'Recover saved drawing' })
  await expect(dialog.getByRole('button', { name: 'Discard stored drafts', exact: true })).toBeEnabled()
  await expect(page.getByText('Explicit newly opened drawing', { exact: true })).toBeVisible()
  await expect(page.getByText('Old sign-in draft', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Discard stored drafts', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Explicit newly opened drawing', { exact: true })).toBeVisible()
})

test('a late startup demo cannot close Options after the user begins interacting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let requested = false
  await page.route('**/data/sample-doc.ts*', async route => { requested = true; await held; await route.continue() })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => requested).toBe(true)
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await expect(page.getByRole('button', { name: 'File', exact: true })).toBeVisible()
  release()
  await expect(page.getByRole('button', { name: 'File', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'File', exact: true }).click()
  await expect(page.locator('.mobile-action-row').filter({ has: page.locator('option[value="file-tools"]') })).toBeVisible()
})
