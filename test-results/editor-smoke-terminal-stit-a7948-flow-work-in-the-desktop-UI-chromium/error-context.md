# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-smoke.spec.ts >> terminal stitch editing and extracted curve box stitch flow work in the desktop UI
- Location: e2e/editor-smoke.spec.ts:70:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('tablist', { name: 'Workbench ribbon tabs' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('tablist', { name: 'Workbench ribbon tabs' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:import-analysis] Failed to resolve import \"./controllers/useEditorScreenShells\" from \"src/features/editor/useEditorScreenController.ts\". Does the file exist?"
  - generic [ref=e5]: /Users/ahmadjalil/github/LeatherCad/src/features/editor/useEditorScreenController.ts:69:38
  - generic [ref=e6]: "62 | import { useEditorOverlayViewModel } from \"./modules/overlays/useEditorOverlayViewModel\"; 63 | import { useEditorScreenRefs } from \"./controllers/useEditorScreenRefs\"; 64 | import { useEditorScreenShells } from \"./controllers/useEditorScreenShells\"; | ^ 65 | import { useEditorDocumentCommands } from \"./useEditorDocumentCommands\"; 66 | import { useEditorAssetCommands } from \"./useEditorAssetCommands\";"
  - generic [ref=e7]: at TransformPluginContext._formatLog (file:///Users/ahmadjalil/github/LeatherCad/node_modules/vite/dist/node/chunks/config.js:28999:43) at TransformPluginContext.error (file:///Users/ahmadjalil/github/LeatherCad/node_modules/vite/dist/node/chunks/config.js:28996:14) at normalizeUrl (file:///Users/ahmadjalil/github/LeatherCad/node_modules/vite/dist/node/chunks/config.js:27119:18) at process.processTicksAndRejections (node:internal/process/task_queues:103:5) at async file:///Users/ahmadjalil/github/LeatherCad/node_modules/vite/dist/node/chunks/config.js:27177:32 at async Promise.all (index 53) at async TransformPluginContext.transform (file:///Users/ahmadjalil/github/LeatherCad/node_modules/vite/dist/node/chunks/config.js:27145:4) at async EnvironmentPluginContainer.transform (file:///Users/ahmadjalil/github/LeatherCad/node_modules/vite/dist/node/chunks/config.js:28797:14) at async loadAndTransform (file:///Users/ahmadjalil/github/LeatherCad/node_modules/vite/dist/node/chunks/config.js:22670:26) at async viteTransformMiddleware (file:///Users/ahmadjalil/github/LeatherCad/node_modules/vite/dist/node/chunks/config.js:24542:20)
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.ts
    - text: .
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test'
  2   | 
  3   | const OPEN_DOC_TRANSFER_PREFIX = 'leathercraft-open-doc-'
  4   | 
  5   | function buildSeedDocument() {
  6   |   return {
  7   |     version: 1,
  8   |     units: 'mm',
  9   |     documentName: 'E2E Stitch Draft',
  10  |     layers: [{ id: 'layer-1', name: 'Main', visible: true, locked: false }],
  11  |     activeLayerId: 'layer-1',
  12  |     lineTypes: [
  13  |       { id: 'type-cut', name: 'Cut', role: 'cut', style: 'solid', color: '#22d3ee', visible: true },
  14  |       { id: 'type-stitch', name: 'Stitch', role: 'stitch', style: 'solid', color: '#22c55e', visible: true },
  15  |     ],
  16  |     activeLineTypeId: 'type-cut',
  17  |     objects: [
  18  |       {
  19  |         id: 'stitch-line',
  20  |         type: 'line',
  21  |         layerId: 'layer-1',
  22  |         lineTypeId: 'type-stitch',
  23  |         start: { x: 10, y: 60 },
  24  |         end: { x: 90, y: 60 },
  25  |       },
  26  |       {
  27  |         id: 'curve-top',
  28  |         type: 'arc',
  29  |         layerId: 'layer-1',
  30  |         lineTypeId: 'type-cut',
  31  |         boxStitchSource: { extracted: true },
  32  |         start: { x: 10, y: 20 },
  33  |         mid: { x: 50, y: 10 },
  34  |         end: { x: 90, y: 20 },
  35  |       },
  36  |       {
  37  |         id: 'curve-bottom',
  38  |         type: 'arc',
  39  |         layerId: 'layer-1',
  40  |         lineTypeId: 'type-cut',
  41  |         boxStitchSource: { extracted: true },
  42  |         start: { x: 12, y: 40 },
  43  |         mid: { x: 50, y: 50 },
  44  |         end: { x: 88, y: 40 },
  45  |       },
  46  |     ],
  47  |     foldLines: [],
  48  |     stitchHoles: [],
  49  |     constraints: [],
  50  |     patternPieces: [],
  51  |     pieceGrainlines: [],
  52  |     pieceLabels: [],
  53  |     piecePlacementLabels: [],
  54  |     seamAllowances: [],
  55  |     pieceNotches: [],
  56  |     hardwareMarkers: [],
  57  |     snapSettings: { enabled: true, grid: true, gridStep: 10, endpoints: true, midpoints: true, guides: true, hardware: true },
  58  |     showAnnotations: true,
  59  |     tracingOverlays: [],
  60  |     projectMemo: '',
  61  |     stitchAlwaysShapeIds: [],
  62  |     stitchThreadColor: '#f97316',
  63  |     showCanvasRuler: true,
  64  |     showDimensions: false,
  65  |     dimensionLines: [],
  66  |     printAreas: [],
  67  |   }
  68  | }
  69  | 
  70  | test('terminal stitch editing and extracted curve box stitch flow work in the desktop UI', async ({ page }) => {
  71  |   const token = 'playwright-stitch-seed'
  72  |   const storageKey = `${OPEN_DOC_TRANSFER_PREFIX}${token}`
  73  | 
  74  |   await page.addInitScript(
  75  |     ({ key, rawDocument }) => {
  76  |       localStorage.setItem(key, rawDocument)
  77  |     },
  78  |     {
  79  |       key: storageKey,
  80  |       rawDocument: JSON.stringify(buildSeedDocument()),
  81  |     },
  82  |   )
  83  | 
  84  |   await page.goto(`/?openDoc=${token}`)
  85  | 
  86  |   const ribbonTabs = page.getByRole('tablist', { name: 'Workbench ribbon tabs' })
> 87  |   await expect(ribbonTabs).toBeVisible()
      |                            ^ Error: expect(locator).toBeVisible() failed
  88  |   await page.getByRole('button', { name: 'Fit' }).first().click()
  89  | 
  90  |   const canvasShapeLines = page.locator('svg.canvas .shape-line')
  91  |   await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  92  |   await ribbonTabs.getByRole('tab', { name: 'Stitch' }).click()
  93  |   await expect(page.getByRole('button', { name: 'Fixed' })).toBeVisible()
  94  |   await page.getByRole('button', { name: 'Fixed' }).click()
  95  |   const stitchHoleDots = page.locator('svg.canvas .stitch-hole-dot')
  96  |   await expect.poll(async () => stitchHoleDots.count()).toBeGreaterThan(0)
  97  |   const initialHoleCount = await stitchHoleDots.count()
  98  |   expect(initialHoleCount).toBeGreaterThan(0)
  99  | 
  100 |   await stitchHoleDots.first().click({ force: true })
  101 |   await expect(page.getByRole('button', { name: 'End Stitch Here' })).toBeVisible()
  102 |   await page.getByRole('button', { name: 'End Stitch Here' }).click()
  103 |   await expect(page.locator('svg.canvas .stitch-hole-terminal-marker')).toHaveCount(1)
  104 | 
  105 |   const lineCountBefore = await canvasShapeLines.count()
  106 |   await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  107 |   await page.getByRole('button', { name: 'Box Stitch Helper' }).click()
  108 |   await expect(page.getByRole('heading', { name: 'Box Stitch Helper' })).toBeVisible()
  109 |   await page.getByRole('button', { name: 'Create Stitch Path' }).click()
  110 | 
  111 |   await expect.poll(async () => page.locator('svg.canvas .shape-line').count()).toBeGreaterThan(lineCountBefore)
  112 |   await expect.poll(async () => stitchHoleDots.count()).toBeGreaterThan(initialHoleCount)
  113 |   const lineCountAfter = await page.locator('svg.canvas .shape-line').count()
  114 |   const holeCountAfterHelper = await stitchHoleDots.count()
  115 |   expect(lineCountAfter).toBeGreaterThan(lineCountBefore)
  116 |   expect(holeCountAfterHelper).toBeGreaterThan(initialHoleCount)
  117 | 
  118 |   await ribbonTabs.getByRole('tab', { name: 'Stitch' }).click()
  119 |   await expect(page.getByRole('button', { name: 'Simulate' })).toBeVisible()
  120 |   await page.getByRole('button', { name: 'Simulate' }).click()
  121 |   await expect(page.getByText('Show direction arrows')).toBeVisible()
  122 |   await expect(page.getByText('Use the stitch-hole inspector to set or clear the terminal stitch hole.')).toBeVisible()
  123 |   await page.getByRole('button', { name: 'Cancel' }).click()
  124 | })
  125 | 
```