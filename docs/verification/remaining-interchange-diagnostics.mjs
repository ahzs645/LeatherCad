// Synthetic interchange diagnostics. Contains no captured or user drawing data.
// Usage: node docs/verification/remaining-interchange-diagnostics.mjs /path/to/leathercad
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const projectRoot = resolve(process.argv[2] ?? process.cwd())
const projectRequire = createRequire(resolve(projectRoot, 'package.json'))
const { createServer } = await import(pathToFileURL(projectRequire.resolve('vite')).href)
const server = await createServer({
  root: projectRoot,
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  const { importLcadDocument, exportLcadDocument } = await server.ssrLoadModule('/src/features/editor/io/io-lcad.ts')
  const lcadInput = {
    version: 2,
    layers: [{ id: 'l1', name: 'Synthetic layer' }],
    palettes: [{ id: 'p1', strokeWidth: 0.65 }],
    shapes: [{ id: 's1', type: 'line', layerId: 'l1', paletteId: 'p1', strokeWidth: 0.25, x1: 0, y1: 0, x2: 10, y2: 0 }],
  }
  const importedLcad = importLcadDocument(JSON.stringify(lcadInput))
  const lcadImportObservation = {
    lineTypeWidthMm: importedLcad.doc.lineTypes[0].strokeWidthMm ?? null,
    shapeWidthOverride: importedLcad.doc.objects[0].strokeWidthOverride ?? null,
    warnings: importedLcad.warnings,
  }
  importedLcad.doc.objects[0].strokeWidthOverride = 0.33
  const exportedLcad = exportLcadDocument(importedLcad.doc)
  const exportedLcadWidth = JSON.parse(exportedLcad.text).shapes[0].strokeWidth
  assert.equal(lcadImportObservation.lineTypeWidthMm, 0.8)
  assert.equal(lcadImportObservation.shapeWidthOverride, null)
  assert.equal(exportedLcadWidth, 0.8)
  assert.deepEqual(importedLcad.warnings, [])
  assert.deepEqual(exportedLcad.warnings, [])

  const { importDxfDocument } = await server.ssrLoadModule('/src/features/editor/io/io-dxf-import.ts')
  const dxfInput = [
    '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    ...[25, 80].flatMap((weight, index) => [
      '0', 'LINE', '8', 'SyntheticLayer', '370', String(weight),
      '10', String(index * 10), '20', '0', '11', String(index * 10 + 5), '21', '0',
    ]),
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n')
  const importedDxf = importDxfDocument(dxfInput)
  const dxfWidths = importedDxf.shapes.map(shape => importedDxf.lineTypes.find(type => type.id === shape.lineTypeId)?.strokeWidthMm ?? null)
  assert.deepEqual(dxfWidths, [0.25, 0.25])
  assert.equal(importedDxf.lineTypes.length, 1)
  assert.deepEqual(importedDxf.warnings, [])

  const { importLccDocument } = await server.ssrLoadModule('/src/features/editor/io/io-lcc.ts')
  const lccInput = {
    meta: { file_type: 'LeathercraftCAD' },
    layers: [{ id: 0, chk: '-1', nam: 'Synthetic cut layer' }],
    shapes: [{ id: '1', type: 'LINE', layer: '0', color: 'Aqua', dash: 'Solid', sp: [0, 0], ep: [100, 0], bz1: [0, 100], bz2: [100, 100] }],
  }
  const importedLcc = importLccDocument(JSON.stringify(lccInput))
  const curve = importedLcc.doc.objects[0]
  assert.equal(curve.type, 'bezier')
  const importedMidpoint = {
    x: 0.25 * curve.start.x + 0.5 * curve.control.x + 0.25 * curve.end.x,
    y: 0.25 * curve.start.y + 0.5 * curve.control.y + 0.25 * curve.end.y,
  }
  const sourceMidpoint = { x: 50, y: 75 }
  const errorMm = Math.hypot(importedMidpoint.x - sourceMidpoint.x, importedMidpoint.y - sourceMidpoint.y)
  assert.deepEqual(importedMidpoint, { x: 50, y: 50 })
  assert.equal(errorMm, 25)
  assert.deepEqual(importedLcc.warnings, [])

  process.stdout.write(JSON.stringify({
    syntheticOnly: true,
    description: 'Observed behavior of commit 41da8db; assertions intentionally document unresolved fidelity defects, not desired behavior.',
    lcadStrokeWidth: {
      input: lcadInput,
      imported: lcadImportObservation,
      editorShapeWidthOverrideBeforeExport: 0.33,
      exportedShapeWidth: exportedLcadWidth,
      exportWarnings: exportedLcad.warnings,
    },
    dxfLineweightCollision: {
      inputAscii: dxfInput,
      sourceWidthsMm: [0.25, 0.8],
      importedWidthsMm: dxfWidths,
      importedLineTypeCount: importedDxf.lineTypes.length,
      warnings: importedDxf.warnings,
    },
    legacyLccCubicApproximation: {
      input: lccInput,
      sourceMidpoint,
      importedMidpoint,
      errorMm,
      warnings: importedLcc.warnings,
    },
  }, null, 2) + '\n')
} finally {
  await server.close()
}
