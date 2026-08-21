import { expect, test } from '@playwright/test'

// A 1024px tablet sits in the medium density band (768px - 1100px): it keeps the
// workbench, with the docks folded to edge sheets. It used to fall on the phone
// side of a hard fork at 1100px, which cost it the ribbon, the document tree and
// every inspector — and with them the only route to pattern pieces and seams.
test('tablet viewport keeps the workbench rather than falling back to the phone shell', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('select.tool-select-mobile')).toHaveCount(0)
  await expect(page.getByRole('tablist', { name: 'Workbench ribbon tabs' })).toBeVisible()
})

test('tablet can reach pattern pieces and seams', async ({ page }) => {
  await page.goto('/')

  // The document tree is what carries pieces and seams; on the phone shell it
  // does not exist at all.
  await expect(page.getByText('Pieces', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Seams', { exact: false }).first()).toBeVisible()
})

test('the canvas still gets most of the tablet width', async ({ page }) => {
  await page.goto('/')
  await page.locator('.canvas-pane').waitFor()

  const viewport = page.viewportSize()
  const canvas = await page.locator('.canvas-pane').boundingBox()

  // Docks float over the canvas at this width instead of taking columns from it.
  expect((canvas?.width ?? 0) / (viewport?.width ?? 1)).toBeGreaterThan(0.7)
})
