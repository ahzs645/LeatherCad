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


test('the split route opens both surfaces side by side, not just the model', async ({ page }) => {
  await page.goto('/workbench/split')
  await page.locator('canvas.three-preview-canvas').waitFor()

  const twoD = await page.locator('.workbench-2d-surface').boundingBox()
  const threeD = await page.locator('.workbench-3d-surface').boundingBox()

  // Both lanes are real, and roughly even — the second surface used to be a
  // 360px peek, and before that the route degraded to the 3D workspace alone.
  expect(twoD?.width ?? 0).toBeGreaterThan(300)
  expect(threeD?.width ?? 0).toBeGreaterThan(300)
  const ratio = (twoD?.width ?? 1) / (threeD?.width ?? 1)
  expect(ratio).toBeGreaterThan(0.6)
  expect(ratio).toBeLessThan(1.7)
})

test('one control selects the workspace mode', async ({ page }) => {
  await page.goto('/')

  const modes = page.locator('.workbench-mode-toggle button')
  await expect(modes).toHaveText(['2D Draft', 'Both', '3D Assembly'])

  // The separate Open 3D Workspace / Peek 2D button did the same job from the
  // other end, leaving no single place to read the current state from.
  await expect(page.getByTestId('workbench-peek-toggle')).toHaveCount(0)

  await page.getByTestId('workspace-mode-both').click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/workbench/split')
  await expect(page.getByTestId('workspace-mode-both')).toHaveAttribute('aria-pressed', 'true')
})
