import { expect, test } from '@playwright/test'

// The editor's mobile layout breakpoint is `max-width: 1100px`, so a 1024px
// tablet viewport should fall on the mobile side of the split. This guards
// against regressions where the mobile shell stops rendering for tablets.
test('tablet viewport renders the mobile shell, not the desktop ribbon', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('select.tool-select-mobile')).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Workbench ribbon tabs' })).toHaveCount(0)
})
