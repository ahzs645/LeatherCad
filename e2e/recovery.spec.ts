import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('an unread recovery store preserves its draft without blocking import review actions', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const blocker = await context.newPage()
  await blocker.route('**/recovery-storage-blocker', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Storage upgrade blocker</title>' }))
  await blocker.goto('./recovery-storage-blocker')
  const unreadDocument = { version: 1, units: 'mm', documentName: 'Previously unread recovery drawing', objects: [],
    layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main', foldLines: [] }
  const stored = { version: 1, id: 'unread-before-import', savedAt: Date.now(), reason: 'autosave', localDocumentId: null, serializedDoc: JSON.stringify(unreadDocument) }
  try {
    // Hold an older native IndexedDB connection open. Dexie's real schema
    // upgrade cannot finish, so recovery must report unread storage instead
    // of treating it as empty. No browser API mocks or arbitrary delays.
    await blocker.evaluate(snapshot => new Promise<void>((resolve, reject) => {
      localStorage.setItem('leathercad-autosave-enabled-v1', 'true')
      const request = indexedDB.open('leathercad-local-v1', 1)
      request.onupgradeneeded = () => { request.result.createObjectStore('settings', { keyPath: 'key' }) }
      request.onerror = () => reject(new Error(request.error?.message ?? 'Could not open the blocked-store fixture'))
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => { /* Deliberately block the app's upgrade until explicit release. */ }
        ;(window as unknown as Window & { releaseRecoveryStore: () => void }).releaseRecoveryStore = () => db.close()
        const transaction = db.transaction('settings', 'readwrite')
        transaction.objectStore('settings').put({ key: 'leathercad-recovery-autosave-v2', value: JSON.stringify(snapshot), updatedAt: Date.now() })
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(new Error(transaction.error?.message ?? 'Could not seed the blocked-store fixture'))
      }
    }), stored)
    await page.goto('./', { waitUntil: 'domcontentloaded' })
    await page.locator('svg.canvas').waitFor()
    const warning = page.locator('aside.draft-recovery-failure')
    // Both current slots and the legacy store must finish their own bounded
    // checks before an unread result is shown. Wait for that observable result.
    await warning.waitFor()
    await expect(warning).toContainText('Automatic saving and sign-in are paused')
    await expect(warning.getByRole('button', { name: 'Dismiss', exact: true })).toHaveCount(0)
    const points = [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 30 }, { x: 10, y: 30 }]
    const imported = { version: 2, name: 'Explicit import while recovery store is unread', unit_for_view: 'mm',
      layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main', groups: [],
      shapes: points.map((point, index) => ({ id: `imported-${index}`, type: 'line', layerId: 'main', strokeColor: '#111111', strokeDash: 'solid',
        x1: point.x, y1: point.y, x2: points[(index + 1) % points.length].x, y2: points[(index + 1) % points.length].y })) }
    const input = page.locator('input[accept*=".lcad"]')
    const upload = () => input.setInputFiles({ name: 'storage-unread-import.lcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) })
    const review = page.getByRole('dialog', { name: 'Review drawing import' })
    await upload()
    await expect(review).toBeVisible()
    await review.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(review).toHaveCount(0)
    await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(0)
    await expect(warning).toContainText('Automatic saving and sign-in are paused')
    await upload()
    await review.getByRole('button', { name: 'Replace current drawing', exact: true }).click()
    await expect(review).toHaveCount(0)
    await expect(page.getByText(imported.name, { exact: true })).toBeVisible()
    await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(4)
    await expect(warning).toContainText('Automatic saving and sign-in are paused')
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    expect(await page.evaluate(() => localStorage.getItem('leathercad-recovery-autosave-v2'))).toBeNull()

    // Once the blocked database becomes readable, Retry must expose the old
    // stored draft rather than acknowledge an empty store or silently replace
    // the explicitly imported drawing.
    await blocker.evaluate(() => (window as unknown as Window & { releaseRecoveryStore: () => void }).releaseRecoveryStore())
    await warning.getByRole('button', { name: 'Check stored drafts again', exact: true }).click()
    const recovery = page.getByRole('dialog', { name: 'Recover saved drawing' })
    await expect(recovery.getByRole('button', { name: 'Download saved draft', exact: true })).toBeEnabled()
    await expect(warning).toHaveCount(0)
    const pending = page.waitForEvent('download')
    await recovery.getByRole('button', { name: 'Download saved draft', exact: true }).click()
    const backup = JSON.parse(await readFile(await (await pending).path(), 'utf8')) as { documentName: string }
    expect(backup.documentName).toBe(unreadDocument.documentName)
    await expect(page.getByText(imported.name, { exact: true })).toBeVisible()
    await recovery.getByRole('button', { name: 'Discard stored drafts', exact: true }).click()
    await expect(recovery).toHaveCount(0)
    await expect(page.getByText(imported.name, { exact: true })).toBeVisible()
  } finally { await blocker.close() }
})

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
