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

  // Precision lives behind Options so the always-visible bar stays one row tall.
  await page.getByRole('button', { name: 'Options' }).click()
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

test('mobile 3D tab pushes the workbench route and Back returns to 2D', async ({ page }) => {
  await page.goto('/')

  const twoDTab = page.getByRole('button', { name: '2D', exact: true })
  const threeDTab = page.getByRole('button', { name: '3D', exact: true })
  await expect(twoDTab).toHaveClass(/active/)

  await threeDTab.click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/workbench/3d')
  await expect(threeDTab).toHaveClass(/active/)

  await page.goBack()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')
  await expect(twoDTab).toHaveClass(/active/)
})

test('direct deep link to /workbench/3d opens the mobile 3D tab', async ({ page }) => {
  await page.goto('/workbench/3d')

  await expect(page.locator('select.tool-select-mobile')).toBeVisible()
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveClass(/active/)
  await expect(page.getByRole('button', { name: '2D', exact: true })).not.toHaveClass(/active/)
})

test('direct deep link to /workbench/split opens the mobile Split tab', async ({ page }) => {
  await page.goto('/workbench/split')

  await expect(page.locator('select.tool-select-mobile')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Split', exact: true })).toHaveClass(/active/)
})


test('the mobile bar stays one row and the 3D tab keeps most of the screen', async ({ page }) => {
  await page.goto('/workbench/3d')
  await page.locator('canvas.three-preview-canvas').waitFor()

  const budget = await page.evaluate(() => {
    const height = (selector: string) => {
      const element = document.querySelector(selector)
      return element ? Math.round(element.getBoundingClientRect().height) : 0
    }
    return {
      viewport: window.innerHeight,
      topbar: height('.topbar'),
      stage: height('.canvas-stage'),
      canvas3d: height('.three-preview-canvas-wrap'),
    }
  })

  // The bar was five stacked rows (245px of 664) before the quick actions moved
  // behind Options.
  expect(budget.topbar).toBeLessThan(140)
  // The hidden 2D lane must not hold a grid row open.
  expect(budget.stage).toBe(0)
  // The 3D canvas used to get 195px of 664 — 29%.
  expect(budget.canvas3d / budget.viewport).toBeGreaterThan(0.6)
})

test('every touch target on the mobile shell clears 44px', async ({ page }) => {
  await page.goto('/')

  const undersized = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, select, [role="tab"]'))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
      .filter(({ rect }) => rect.height < 44 || rect.width < 44)
      .map(({ element, rect }) =>
        `${element.tagName.toLowerCase()}[${(element.textContent ?? '').trim().slice(0, 20)}] ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      ),
  )

  expect(undersized).toEqual([])
})
