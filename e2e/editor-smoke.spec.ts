import { expect, test } from '@playwright/test'

const OPEN_DOC_TRANSFER_PREFIX = 'leathercraft-open-doc-'

function buildSeedDocument() {
  return {
    version: 1,
    units: 'mm',
    documentName: 'E2E Stitch Draft',
    layers: [{ id: 'layer-1', name: 'Main', visible: true, locked: false }],
    activeLayerId: 'layer-1',
    lineTypes: [
      { id: 'type-cut', name: 'Cut', role: 'cut', style: 'solid', color: '#22d3ee', visible: true },
      { id: 'type-stitch', name: 'Stitch', role: 'stitch', style: 'solid', color: '#22c55e', visible: true },
    ],
    activeLineTypeId: 'type-cut',
    objects: [
      {
        id: 'stitch-line',
        type: 'line',
        layerId: 'layer-1',
        lineTypeId: 'type-stitch',
        start: { x: 10, y: 60 },
        end: { x: 90, y: 60 },
      },
      {
        id: 'curve-top',
        type: 'arc',
        layerId: 'layer-1',
        lineTypeId: 'type-cut',
        boxStitchSource: { extracted: true },
        start: { x: 10, y: 20 },
        mid: { x: 50, y: 10 },
        end: { x: 90, y: 20 },
      },
      {
        id: 'curve-bottom',
        type: 'arc',
        layerId: 'layer-1',
        lineTypeId: 'type-cut',
        boxStitchSource: { extracted: true },
        start: { x: 12, y: 40 },
        mid: { x: 50, y: 50 },
        end: { x: 88, y: 40 },
      },
    ],
    foldLines: [],
    stitchHoles: [],
    constraints: [],
    patternPieces: [],
    pieceGrainlines: [],
    pieceLabels: [],
    piecePlacementLabels: [],
    seamAllowances: [],
    pieceNotches: [],
    hardwareMarkers: [],
    snapSettings: { enabled: true, grid: true, gridStep: 10, endpoints: true, midpoints: true, guides: true, hardware: true },
    showAnnotations: true,
    tracingOverlays: [],
    projectMemo: '',
    stitchAlwaysShapeIds: [],
    stitchThreadColor: '#f97316',
    showCanvasRuler: true,
    showDimensions: false,
    dimensionLines: [],
    printAreas: [],
  }
}

test('terminal stitch editing and extracted curve box stitch flow work in the desktop UI', async ({ page }) => {
  const token = 'playwright-stitch-seed'
  const storageKey = `${OPEN_DOC_TRANSFER_PREFIX}${token}`

  await page.addInitScript(
    ({ key, rawDocument }) => {
      localStorage.setItem(key, rawDocument)
    },
    {
      key: storageKey,
      rawDocument: JSON.stringify(buildSeedDocument()),
    },
  )

  await page.goto(`/?openDoc=${token}`)

  const ribbonTabs = page.getByRole('tablist', { name: 'Workbench ribbon tabs' })
  await expect(ribbonTabs).toBeVisible()
  const pointerSelectShape = async (index: number, additive = false) => {
    await canvasShapeLines.nth(index).dispatchEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      shiftKey: additive,
    })
  }

  const canvasShapeLines = page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')
  await expect.poll(async () => canvasShapeLines.count()).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Fit' }).first().click()
  await pointerSelectShape(0)
  await pointerSelectShape(1, true)
  await pointerSelectShape(2, true)
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-selected')).toHaveCount(3)
  await ribbonTabs.getByRole('tab', { name: 'Stitch' }).click()
  await expect(page.getByRole('button', { name: 'Fixed', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Fixed', exact: true }).click()
  const stitchHoleDots = page.locator('svg.canvas .stitch-hole-dot')
  await expect.poll(async () => stitchHoleDots.count()).toBeGreaterThan(0)
  const initialHoleCount = await stitchHoleDots.count()
  expect(initialHoleCount).toBeGreaterThan(0)

  const lineCountBefore = await canvasShapeLines.count()
  await page.getByRole('button', { name: 'Box Stitch Helper' }).click()
  await expect(page.getByRole('heading', { name: 'Box Stitch Helper' })).toBeVisible()
  await page.getByRole('button', { name: 'Create Stitch Path' }).click()

  await expect.poll(async () => page.locator('svg.canvas .shape-line').count()).toBeGreaterThan(lineCountBefore)
  await expect.poll(async () => stitchHoleDots.count()).toBeGreaterThan(initialHoleCount)
  const lineCountAfter = await page.locator('svg.canvas .shape-line').count()
  const holeCountAfterHelper = await stitchHoleDots.count()
  expect(lineCountAfter).toBeGreaterThan(lineCountBefore)
  expect(holeCountAfterHelper).toBeGreaterThan(initialHoleCount)

  await stitchHoleDots.first().click({ force: true })
  await expect(page.getByRole('button', { name: 'End Stitch Here' })).toBeVisible()
  await page.getByRole('button', { name: 'End Stitch Here' }).click()
  await expect(page.locator('svg.canvas .stitch-hole-terminal-marker')).toHaveCount(1)

  await ribbonTabs.getByRole('tab', { name: 'Stitch' }).click()
  await expect(page.getByRole('button', { name: 'Simulate' })).toBeVisible()
  await page.getByRole('button', { name: 'Simulate' }).click()
  await expect(page.getByText('Show direction arrows')).toBeVisible()
  await expect(page.getByText('Use the stitch-hole inspector to set or clear the terminal stitch hole.')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
})

test('drawn closed outlines can become shaped pieces from the interface', async ({ page }) => {
  const token = 'playwright-piece-seed'
  const storageKey = `${OPEN_DOC_TRANSFER_PREFIX}${token}`
  const emptyDocument = {
    ...buildSeedDocument(),
    documentName: 'E2E Piece Draft',
    objects: [],
  }

  await page.addInitScript(
    ({ key, rawDocument }) => {
      localStorage.setItem(key, rawDocument)
    },
    {
      key: storageKey,
      rawDocument: JSON.stringify(emptyDocument),
    },
  )

  await page.goto(`/?openDoc=${token}`)

  const ribbonTabs = page.getByRole('tablist', { name: 'Workbench ribbon tabs' })
  await expect(ribbonTabs).toBeVisible()
  await expect(page.getByText('E2E Piece Draft')).toBeVisible()
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')).toHaveCount(0)

  const canvas = page.locator('svg.canvas')
  await page.getByRole('button', { name: 'Rect' }).click()
  await canvas.click({ position: { x: 140, y: 140 } })
  await canvas.click({ position: { x: 280, y: 250 } })

  const canvasShapeLines = page.locator('svg.canvas .canvas-editable-geometry-layer .shape-line')
  await expect(canvasShapeLines).toHaveCount(4)

  await page.getByRole('button', { name: 'Move' }).click()
  for (let index = 0; index < 4; index += 1) {
    await canvasShapeLines.nth(index).dispatchEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: index + 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      shiftKey: index > 0,
    })
  }
  await expect(page.locator('svg.canvas .canvas-editable-geometry-layer .shape-selected')).toHaveCount(4)

  await ribbonTabs.getByRole('tab', { name: 'Piece' }).click()
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  await expect(page.getByRole('button', { name: /Piece 1/ })).toBeVisible()
  await expect(page.getByText('4.0mm seam')).toBeVisible()

  await page.getByRole('button', { name: 'Open 3D Workspace' }).click()
  await expect(page.getByText('3D Preview 4 shapes | 1 pieces')).toBeVisible()
  await expect(page.getByText('Piece Placement')).toBeVisible()
  await expect(page.locator('body')).toContainText('1 piece in the current 3D view.')
})
