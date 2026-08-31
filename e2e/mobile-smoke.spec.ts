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
  // The shell has to be up before the first click. An assertion would retry
  // its way through a half-rendered page; a click waits only for the button to
  // be there and hittable, and a button that is drawn but not yet wired
  // swallows it.
  await page.locator('select.tool-select-mobile').waitFor()

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

  // Scope the close to the modal: the Options toggle also reads "Close" while
  // the menu is open, and it sits behind the modal backdrop.
  await modal.getByRole('button', { name: /^Close$/ }).click()
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

  // Let the 3D workspace finish arriving before leaving it. The route flips as
  // soon as the tab is pressed, but the canvas behind it mounts after — and
  // going back mid-mount is the one racy moment in this flow, with popstate
  // landing while React is still committing the 3D tree. On a machine slow
  // enough to spread those apart (a loaded runner, software rendering) the
  // case had the whole test budget to spend on it and no reason to wait.
  await page.locator('canvas.three-preview-canvas').waitFor()

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

  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  const viewportHeight = viewport?.height ?? 0

  // The bar was five stacked rows — 245px of a 664px phone — before Precision,
  // Project Memo and Catalog moved behind Options.
  const topbar = await page.locator('.topbar').boundingBox()
  expect(topbar?.height ?? 0).toBeLessThan(140)

  // The hidden 2D lane must not hold a grid row open.
  await expect(page.locator('.canvas-stage')).toBeHidden()

  // The 3D canvas used to get 195px of 664 — 29%.
  const canvas3d = await page.locator('.three-preview-canvas-wrap').boundingBox()
  expect((canvas3d?.height ?? 0) / viewportHeight).toBeGreaterThan(0.6)
})

test('every touch target on the mobile shell clears 44px', async ({ page }) => {
  await page.goto('/')
  await page.locator('select.tool-select-mobile').waitFor()

  const controls = page.locator('button:visible, select:visible')
  const undersized: string[] = []
  for (const control of await controls.all()) {
    const box = await control.boundingBox()
    if (!box || box.width === 0 || box.height === 0) continue
    if (box.height < 44 || box.width < 44) {
      const label = (await control.textContent())?.trim().slice(0, 20) ?? ''
      undersized.push(`${label} ${Math.round(box.width)}x${Math.round(box.height)}`)
    }
  }

  expect(undersized).toEqual([])
})


test('the phone can create a pattern piece and read its seams', async ({ page }) => {
  await page.goto('/')
  await page.locator('select.tool-select-mobile').waitFor()

  await page.getByRole('button', { name: 'Options' }).click()
  await page.getByRole('button', { name: 'Pieces + Seams' }).click()

  // Every route to a pattern piece used to run through the workbench document
  // tree, which the compact shell does not render — so the Seam tool was in the
  // tool list with nothing to connect and nothing to show.
  const createPiece = page.getByRole('button', { name: 'Create Piece' })
  await expect(createPiece).toBeVisible()
  await expect(createPiece).toBeDisabled()
  await expect(page.getByText('Select a closed outline on the canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Piece' })).toBeVisible()
  await expect(page.getByText(/^Seams \(\d+\)$/)).toBeVisible()
})

test('the phone tool list offers both seam tools', async ({ page }) => {
  await page.goto('/')
  // Not decoration: allTextContents() reads whatever matches right now and
  // does not wait, so without this the empty list of a page that has not
  // rendered yet is a perfectly good answer -- and the failure it produces
  // blames the tool list rather than the timing.
  await page.locator('select.tool-select-mobile').waitFor()

  const options = await page.locator('select.tool-select-mobile option').allTextContents()

  expect(options).toContain('Tool: Seam')
  expect(options).toContain('Tool: Seam (Multi-Edge)')
})
