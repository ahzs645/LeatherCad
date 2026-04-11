import { expect, test } from '@playwright/test'

test('stitch and export controls render in the desktop UI', async ({ page }) => {
  await page.goto('/')

  const ribbonTabs = page.getByRole('tablist', { name: 'Workbench ribbon tabs' })
  await expect(ribbonTabs).toBeVisible()

  await ribbonTabs.getByRole('tab', { name: 'Stitch' }).click()
  await expect(page.getByRole('button', { name: 'Fixed' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Var' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Simulate' })).toBeVisible()
  await expect(page.getByTestId('ribbon-command-box-stitch')).toBeVisible()
  await page.getByRole('button', { name: 'Simulate' }).click()
  await expect(page.getByText('Show stitch pattern')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use Selected Hole' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  await ribbonTabs.getByRole('tab', { name: 'Output' }).click()
  await expect(page.getByRole('button', { name: 'SVG', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'DXF', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeVisible()
})
