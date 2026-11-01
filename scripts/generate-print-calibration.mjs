import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'

// Synthetic, redistributable drawings passed through the actual print pipeline.
// No HAR, user document, sign-in or external resource is read.
const outDir = path.resolve(process.argv[2] || 'docs/fixtures/physical-calibration')
await mkdir(outDir, { recursive: true })
const server = await createServer({ configFile: false, logLevel: 'error',
  server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
let browser
try {
  const { buildPrintPlan } = await server.ssrLoadModule('/src/features/editor/preview/print-preview.ts')
  const { buildPrintableHtml } = await server.ssrLoadModule('/src/features/editor/preview/print-output.ts')
  browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {})
  const page = await browser.newPage()
  const line = (id, x1, y1, x2, y2) => ({ id, type: 'line', layerId: 'main', lineTypeId: 'cut',
    start: { x: x1, y: y1 }, end: { x: x2, y: y2 } })
  const label = (text, x, y) => ({ id: text, type: 'text', layerId: 'main', lineTypeId: 'cut',
    start: { x, y }, end: { x: x + 100, y }, text, fontSizeMm: 4, fontFamily: 'sans-serif',
    transform: 'none', radiusMm: 100, sweepDeg: 0 })
  const lineTypes = [{ id: 'cut', name: 'Calibration', role: 'cut', style: 'solid', color: '#111827', visible: true, strokeWidthMm: 0.25 }]
  const fixtures = [
    { name: 'xy-100mm', tileX: 1, shapes: [line('x100', 0, 0, 100, 0), line('y100', 0, 0, 0, 100),
      line('square-right', 100, 0, 100, 100), line('square-bottom', 0, 100, 100, 100),
      label('100 mm X / 100 mm Y', 10, 20), label('Pitch: 4 mm (40 mm over 10 intervals)', 10, 40),
      ...Array.from({ length: 11 }, (_, i) => line(`pitch-${i}`, 10 + 4 * i, 50, 10 + 4 * i, 55)),
      line('asymmetry', 70, 70, 90, 90), label('Keep this corner at bottom right', 10, 80)],
      measurements: { xMm: 100, yMm: 100, pitchMm: 4, tenPitchIntervalsMm: 40 } },
    { name: 'asymmetric-tiled', tileX: 2, shapes: [line('top', 0, 0, 280, 0), line('notch-a', 280, 0, 280, 20),
      line('notch-b', 280, 20, 300, 20), line('right', 300, 20, 300, 180),
      line('bottom', 300, 180, 0, 180), line('left', 0, 180, 0, 0),
      line('registration', 0, 90, 300, 90), label('300 x 180 mm / notch at TOP RIGHT', 25, 35),
      ...Array.from({ length: 71 }, (_, i) => line(`pitch-${i}`, 10 + 4 * i, 165, 10 + 4 * i, 170))],
      measurements: { widthMm: 300, heightMm: 180, notchMm: 20, pitchMm: 4, overlapMm: 10 } },
  ]
  const manifest = { version: 1, generatedBy: 'LeatherCad print pipeline', physicalPrinterChecked: false, files: [] }
  for (const fixture of fixtures) {
    const document = { version: 1, units: 'mm', documentName: fixture.name, objects: fixture.shapes,
      layers: [{ id: 'main', name: 'Calibration', visible: true, locked: false }], activeLayerId: 'main',
      lineTypes, activeLineTypeId: 'cut', stitchHoles: [], foldLines: [] }
    await writeFile(path.join(outDir, `${fixture.name}.json`), JSON.stringify(document, null, 2) + '\n')
    for (const paper of ['a4', 'letter']) {
      const variants = [{ suffix: '', calibrationXPercent: 100, calibrationYPercent: 100, orientation: 'portrait' }]
      if (paper === 'a4') for (const orientation of ['portrait', 'landscape']) variants.push({
        suffix: `-calibrated-${orientation}`, calibrationXPercent: 110, calibrationYPercent: 90, orientation })
      for (const variant of variants) {
        const tileY = fixture.name === 'asymmetric-tiled' && variant.orientation === 'landscape' ? 2 : 1
        const plan = buildPrintPlan(fixture.shapes, { paper, marginMm: 10, overlapMm: 10,
          tileX: fixture.tileX, tileY, scalePercent: 100, ...variant })
        const html = buildPrintableHtml({ shapes: fixture.shapes, stitchHoles: [], foldLines: [],
          lineTypesById: { cut: lineTypes[0] }, printPlan: plan, printInColor: false,
          printStitchAsDots: false, lineThicknessScalePercent: 100, showIgnoredLineTypes: false,
          printRulerInside: false, calibrationXPercent: variant.calibrationXPercent, calibrationYPercent: variant.calibrationYPercent }).replace(/[ \t]+$/gm, '')
        const name = `${variant.suffix ? 'automated/' : ''}${fixture.name}-${paper}${variant.suffix}`
        await mkdir(path.dirname(path.join(outDir, name)), { recursive: true })
        await writeFile(path.join(outDir, `${name}.html`), html)
        await page.setContent(html)
        await page.pdf({ path: path.join(outDir, `${name}.pdf`), preferCSSPageSize: true, printBackground: true })
        manifest.files.push({ name, fixture: fixture.name, pages: plan.tiles.length, paperMm: [plan.paperWidthMm, plan.paperHeightMm],
          measurements: fixture.measurements, scalePercent: 100, marginMm: 10, tileY, ...variant })
      }
    }
  }
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  process.stdout.write(`Calibration drawings, printable HTML and PDFs written to ${outDir}\n`)
} finally {
  await browser?.close()
  await server.close()
}
