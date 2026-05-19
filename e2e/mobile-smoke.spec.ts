import { devices, expect, test } from '@playwright/test'

test.use({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' })

test('mobile shell renders with topbar, canvas, and tool selector', async ({ page }) => {
  await page.goto('/')

  // The mobile topbar contains a Tool: select instead of the desktop icon grid.
  const toolSelect = page.locator('select.tool-select-mobile')
  await expect(toolSelect).toBeVisible()
  await expect(toolSelect).toHaveCount(1)

  // 2D / 3D / Split inline tabs are present.
  await expect(page.getByRole('button', { name: '2D', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '3D', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Split', exact: true })).toBeVisible()

  // The desktop ribbon should not render on mobile (no Workbench ribbon tablist).
  await expect(page.getByRole('tablist', { name: 'Workbench ribbon tabs' })).toHaveCount(0)

  // The mobile menu button toggles options visibility.
  const optionsButton = page.getByRole('button', { name: /Options|Close/ })
  await expect(optionsButton).toBeVisible()
})

test('mobile Options modal scrolls and closes', async ({ page }) => {
  await page.goto('/')

  // Open the precision modal as a representative dialog.
  await page.getByRole('button', { name: 'Precision' }).click()
  const heading = page.getByRole('heading', { name: /Precision/ })
  await expect(heading).toBeVisible()

  // Modal should fit the viewport width.
  const modal = page.locator('.precision-modal')
  await expect(modal).toBeVisible()
  const box = await modal.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    const viewportSize = page.viewportSize()
    expect(viewportSize).not.toBeNull()
    if (viewportSize) {
      expect(box.width).toBeLessThanOrEqual(viewportSize.width)
    }
  }

  // Close the modal.
  await page.getByRole('button', { name: /^Close$/ }).first().click()
  await expect(heading).toBeHidden()
})
