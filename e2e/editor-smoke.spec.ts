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
  await page.getByRole('button', { name: 'Fit' }).first().click()

  const canvasShapeLines = page.locator('svg.canvas .shape-line')
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await ribbonTabs.getByRole('tab', { name: 'Stitch' }).click()
  await expect(page.getByRole('button', { name: 'Fixed' })).toBeVisible()
  await page.getByRole('button', { name: 'Fixed' }).click()
  const stitchHoleDots = page.locator('svg.canvas .stitch-hole-dot')
  await expect.poll(async () => stitchHoleDots.count()).toBeGreaterThan(0)
  const initialHoleCount = await stitchHoleDots.count()
  expect(initialHoleCount).toBeGreaterThan(0)

  await stitchHoleDots.first().click({ force: true })
  await expect(page.getByRole('button', { name: 'End Stitch Here' })).toBeVisible()
  await page.getByRole('button', { name: 'End Stitch Here' }).click()
  await expect(page.locator('svg.canvas .stitch-hole-terminal-marker')).toHaveCount(1)

  const lineCountBefore = await canvasShapeLines.count()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.getByRole('button', { name: 'Box Stitch Helper' }).click()
  await expect(page.getByRole('heading', { name: 'Box Stitch Helper' })).toBeVisible()
  await page.getByRole('button', { name: 'Create Stitch Path' }).click()

  await expect.poll(async () => page.locator('svg.canvas .shape-line').count()).toBeGreaterThan(lineCountBefore)
  await expect.poll(async () => stitchHoleDots.count()).toBeGreaterThan(initialHoleCount)
  const lineCountAfter = await page.locator('svg.canvas .shape-line').count()
  const holeCountAfterHelper = await stitchHoleDots.count()
  expect(lineCountAfter).toBeGreaterThan(lineCountBefore)
  expect(holeCountAfterHelper).toBeGreaterThan(initialHoleCount)

  await ribbonTabs.getByRole('tab', { name: 'Stitch' }).click()
  await expect(page.getByRole('button', { name: 'Simulate' })).toBeVisible()
  await page.getByRole('button', { name: 'Simulate' }).click()
  await expect(page.getByText('Show direction arrows')).toBeVisible()
  await expect(page.getByText('Use the stitch-hole inspector to set or clear the terminal stitch hole.')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
})
