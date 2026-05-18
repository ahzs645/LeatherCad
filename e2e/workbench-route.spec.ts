import { expect, test } from '@playwright/test'

test('workspace mode toggle pushes the 3d workbench path and back', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('tablist', { name: 'Workbench ribbon tabs' })).toBeVisible()

  const threeButton = page.getByTestId('workspace-mode-3d')
  const twoButton = page.getByTestId('workspace-mode-2d')

  await threeButton.click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/workbench/3d')
  await expect(threeButton).toHaveAttribute('aria-pressed', 'true')

  await twoButton.click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')
  await expect(twoButton).toHaveAttribute('aria-pressed', 'true')
})

test('direct deep link to /workbench/3d loads the 3D assembly workspace', async ({ page }) => {
  await page.goto('/workbench/3d')

  await expect(page.getByRole('tablist', { name: 'Workbench ribbon tabs' })).toBeVisible()
  await expect(page.getByTestId('workspace-mode-3d')).toHaveAttribute('aria-pressed', 'true')
})
