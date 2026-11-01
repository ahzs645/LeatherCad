import { expect, test, type Page } from '@playwright/test'

// Drafting-surface and interaction behaviour adopted from the Leathercraft CAD
// web editor: edge rulers, tool keys, typed sizes, Escape cascade, numeric
// selection geometry, a selection-aware menu and status-bar toggles.

async function boot(page: Page) {
  await page.goto('/')
  await page.getByTestId('tool-options-bar').waitFor()
  await page.locator('svg.canvas').waitFor()
  // The startup document loads after the shell; wait until it is counted.
  await expect(page.locator('.workbench-inspector-dock')).toContainText(/[1-9]\d* shapes across/)
}

/** Screen pixels per millimetre (the status bar shows scale × 100 as a percentage). */
async function pixelsPerMm(page: Page) {
  const text = await page.locator('.workbench-statusbar').innerText()
  return Number(/(\d+)%/.exec(text)?.[1] ?? '100') / 100
}

async function shapeCount(page: Page) {
  const text = await page.locator('.workbench-inspector-dock').innerText()
  return Number(/(\d+) shapes across/.exec(text)?.[1] ?? Number.NaN)
}

async function canvasPoint(page: Page, fx: number, fy: number) {
  const box = await page.locator('svg.canvas').boundingBox()
  if (!box) throw new Error('canvas not laid out')
  return { x: box.x + box.width * fx, y: box.y + box.height * fy }
}

async function drawRectangle(page: Page, width: string, height: string) {
  const at = await canvasPoint(page, 0.18, 0.22)
  await page.mouse.move(at.x + 200, at.y + 200)
  await page.keyboard.press('r')
  await page.getByTestId('tool-option-width').fill(width)
  await page.getByTestId('tool-option-width').press('Enter')
  await page.getByTestId('tool-option-height').fill(height)
  await page.getByTestId('tool-option-height').press('Enter')
  await page.mouse.click(at.x, at.y)
  return at
}

test('the drafting surface has edge rulers and a tool hint', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('canvas-edge-rulers')).toBeVisible()
  // The drafting surface follows the app theme: light here, dark with a dark system theme.
  await expect(page.locator('.canvas-pane')).toHaveClass(/canvas-surface-light/)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('.canvas-pane')).toHaveClass(/canvas-surface-dark/)
  await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.getByTestId('canvas-tool-hint')).toContainText('Move')
  const corner = page.locator('.canvas-edge-ruler-corner')
  await expect(corner).toHaveAttribute('aria-pressed', 'false')
  await corner.click()
  await expect(corner).toHaveAttribute('aria-pressed', 'true')
  // S toggles the rulers.
  await page.keyboard.press('s')
  await expect(page.getByTestId('canvas-edge-rulers')).toHaveCount(0)
  await page.keyboard.press('s')
  await expect(page.getByTestId('canvas-edge-rulers')).toBeVisible()
})

test('single-key tools, typed sizes and the Escape cascade', async ({ page }) => {
  await boot(page)
  const before = await shapeCount(page)
  await drawRectangle(page, '40', '100/4')
  await page.keyboard.press('Escape')
  await expect(page.locator('.workbench-statusbar')).toContainText('Tool Move')
  expect(await shapeCount(page)).toBe(before + 4)

  await page.keyboard.press('v')
  await expect(page.locator('.workbench-statusbar')).toContainText('Tool Arc')
  await page.keyboard.press('t')
  await expect(page.locator('.workbench-statusbar')).toContainText('Tool Text')
  // Escape returns to Select; a second Escape with nothing selected returns to Text.
  await page.keyboard.press('Escape')
  await expect(page.locator('.workbench-statusbar')).toContainText('Tool Move')
  await page.keyboard.press('Escape')
  await expect(page.locator('.workbench-statusbar')).toContainText('Tool Text')
  await expect(page.getByRole('button', { name: 'Rect', exact: true })).toHaveAttribute('aria-keyshortcuts', 'R')
})

test('selection geometry, selection-aware menu and redo', async ({ page }) => {
  await boot(page)
  const corner = await drawRectangle(page, '40', '20')
  await page.keyboard.press('Escape')
  const before = await shapeCount(page)

  const scale = await pixelsPerMm(page)
  await page.mouse.move(corner.x - 10, corner.y - 10)
  await page.mouse.down()
  await page.mouse.move(corner.x + 40 * scale + 10, corner.y + 20 * scale + 10, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByTestId('selection-geometry-width')).toHaveValue('40')
  await expect(page.getByTestId('selection-geometry-height')).toHaveValue('20')
  await expect(page.getByTestId('tool-options-bar')).toContainText('4 selected')

  await page.keyboard.press('Enter')
  await expect(page.getByTestId('selection-geometry-x')).toBeFocused()
  await page.getByTestId('selection-geometry-width').fill('160/2')
  await page.getByTestId('selection-geometry-width').press('Enter')
  await expect(page.getByTestId('selection-geometry-width')).toHaveValue('80')
  await expect(page.getByTestId('selection-geometry-height')).toHaveValue('40')

  await page.mouse.click(corner.x, corner.y + 10 * scale, { button: 'right' })
  const menu = page.getByRole('menu', { name: 'Shape actions' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /Rotate 90° CW/ })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /^Delete/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  await page.keyboard.press('Delete')
  await expect.poll(() => shapeCount(page)).toBe(before - 4)
  await page.keyboard.press('Control+z')
  await expect.poll(() => shapeCount(page)).toBe(before)
  await page.keyboard.press('Control+y')
  await expect.poll(() => shapeCount(page)).toBe(before - 4)
})

test('status bar toggles snap, grid and units', async ({ page }) => {
  await boot(page)
  const snap = page.getByTestId('statusbar-snap')
  await expect(snap).toHaveAttribute('aria-pressed', 'true')
  await snap.click()
  await expect(snap).toHaveAttribute('aria-pressed', 'false')
  const grid = page.getByTestId('statusbar-grid')
  await grid.click()
  await expect(grid).toHaveAttribute('aria-pressed', 'false')
  const unit = page.getByTestId('statusbar-unit')
  await expect(unit).toHaveText('mm')
  await unit.click()
  await expect(unit).toHaveText('in')
  await page.keyboard.press('n')
  await expect(unit).toHaveText('mm')
})

test('the screen tour opens from Options and does not block the page', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('screen-tour')).toHaveCount(0)
  await page.getByTestId('ribbon-tab-output').click()
  await page.getByTestId('ribbon-command-options').click()
  const dialog = page.getByRole('dialog', { name: 'Options' })
  await dialog.getByRole('button', { name: 'Show the screen tour' }).click()
  await page.keyboard.press('Escape')
  const tour = page.getByTestId('screen-tour')
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Next' }).click()
  await expect(tour).toContainText('Drawing tools')
  await tour.getByRole('button', { name: 'Close tour' }).click()
  await expect(tour).toHaveCount(0)
})

test('compact controls share one height and radius across the workbench', async ({ page }) => {
  await boot(page)
  // Regions that use the compact control size; a mixed group (like a zoom bar
  // with two touch-sized and two mouse-sized buttons) should fail here.
  const measured = await page.evaluate(() => {
    const selectors = [
      '.workbench-header .workbench-quick-action',
      '.workbench-header-trailing select',
      '.tool-options-bar button',
      '.canvas-view-controls button',
      '.precision-strip input',
      '.precision-strip button',
      '.workbench-inspector-tabs button',
      '.workbench-tree-actions button',
    ]
    return selectors.flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => element.offsetParent)
      .map((element) => ({ selector, height: Math.round(element.getBoundingClientRect().height), radius: getComputedStyle(element).borderTopLeftRadius })))
  })
  expect(measured.length).toBeGreaterThan(10)
  expect(new Set(measured.map((item) => item.height))).toEqual(new Set([26]))
  expect(new Set(measured.map((item) => item.radius))).toEqual(new Set(['4px']))
})

test('the ribbon can be hidden and comes back from a tab; the status bar shows the cursor', async ({ page }) => {
  await boot(page)
  const canvasTop = async () => (await page.locator('.canvas-pane').boundingBox())?.y ?? 0
  const before = await canvasTop()
  await page.getByTestId('workbench-ribbon-collapse').click()
  await expect(page.locator('.workbench-ribbon')).toHaveCount(0)
  expect(await canvasTop()).toBeLessThan(before - 50)
  await page.getByTestId('ribbon-tab-output').click()
  await expect(page.getByTestId('ribbon-command-options')).toBeVisible()

  const at = await canvasPoint(page, 0.5, 0.3)
  await page.mouse.move(at.x, at.y)
  await expect(page.getByTestId('statusbar-cursor')).toHaveText(/X -?\d+\.\d{2}\s+Y -?\d+\.\d{2}/)
  await expect(page.locator('.workbench-statusbar')).toContainText(/Shapes \d+/)
})
