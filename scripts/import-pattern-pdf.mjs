/**
 * Reads a leathercraft pattern PDF and writes out what it contains.
 *
 * Usage:
 *   node scripts/import-pattern-pdf.mjs <pattern.pdf> [--out-dir docs/fixtures/pattern-pdf]
 *                                       [--page 1] [--name "Card Case"]
 *                                       [--assembly-angle 180] [--no-paths]
 *
 * Writes three files next to each other:
 *   <name>.paths.json    the extracted vector geometry, for tests to replay
 *   <name>.report.json   pieces, stitch runs, pitch, seams — the analysis
 *   <name>.doc.json      an assembled LeatherCad project, ready to open
 *
 * The app's modules are TypeScript, so this loads them through Vite's SSR
 * pipeline rather than duplicating them. pdf.js is aliased to its legacy build
 * for the same reason the loader takes a page object: the default build wants
 * browser globals Node does not have.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const MODULES = [
  '/src/features/editor/ops/pattern-pdf/pdf-vector-source.ts',
  '/src/features/editor/ops/pattern-pdf/pattern-path-codec.ts',
  '/src/features/editor/ops/pattern-pdf/pattern-pdf-analysis.ts',
  '/src/features/editor/ops/pattern-pdf/pattern-doc-builder.ts',
  '/src/features/editor/ops/pattern-pdf/pattern-assembly-placement.ts',
]

function parseArgs(argv) {
  const args = { pdf: null, outDir: 'docs/fixtures/pattern-pdf', page: 1, name: null, assemblyAngle: 180, writePaths: true }
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i]
    if (value === '--out-dir') args.outDir = argv[++i]
    else if (value === '--page') args.page = Number(argv[++i])
    else if (value === '--name') args.name = argv[++i]
    else if (value === '--assembly-angle') args.assemblyAngle = Number(argv[++i])
    else if (value === '--no-paths') args.writePaths = false
    else if (!args.pdf) args.pdf = value
  }
  return args
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const args = parseArgs(process.argv.slice(2))
if (!args.pdf) {
  console.error('usage: node scripts/import-pattern-pdf.mjs <pattern.pdf> [--out-dir dir] [--page n] [--name label]')
  process.exit(1)
}

const server = await createServer({
  configFile: false,
  logLevel: 'silent',
  appType: 'custom',
  server: { middlewareMode: true },
  resolve: { alias: { 'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf.mjs' } },
  ssr: { noExternal: true },
})
const loaded = await Promise.all(MODULES.map((entry) => server.ssrLoadModule(entry)))
const app = Object.assign({}, ...loaded)
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

const data = new Uint8Array(fs.readFileSync(args.pdf))
const document = await pdfjs.getDocument({
  data,
  disableFontFace: true,
  useWorkerFetch: false,
  useSystemFonts: false,
}).promise
const page = await document.getPage(Math.max(1, Math.min(document.numPages, args.page)))
const vectorPage = await app.readPdfVectorPage(page, document.numPages)
await document.destroy()

const label = args.name ?? path.basename(args.pdf, path.extname(args.pdf))
const analysis = app.analyzePatternPaths(vectorPage.paths, {
  widthMm: vectorPage.widthMm,
  heightMm: vectorPage.heightMm,
})
const built = app.buildPatternDoc(analysis, { documentName: label })
const assembled = app.assemblePatternDoc(built.doc, args.assemblyAngle)

fs.mkdirSync(args.outDir, { recursive: true })
const base = path.join(args.outDir, slug(label))
const written = []

if (args.writePaths) {
  const encoded = app.encodePatternPaths(
    vectorPage.paths,
    { widthMm: vectorPage.widthMm, heightMm: vectorPage.heightMm },
    path.basename(args.pdf),
  )
  fs.writeFileSync(`${base}.paths.json`, `${JSON.stringify(encoded)}\n`)
  written.push(`${base}.paths.json`)
}

const report = {
  source: path.basename(args.pdf),
  page: { number: vectorPage.pageNumber, count: vectorPage.pageCount, ...analysis.page },
  stitching: analysis.stitching,
  ignoredPathCount: analysis.ignoredPathCount,
  strayDotCount: analysis.strayDotCount,
  pieces: analysis.pieces.map((piece) => ({
    id: piece.id,
    widthMm: piece.widthMm,
    heightMm: piece.heightMm,
    areaMm2: piece.areaMm2,
    sides: piece.sides.length,
    cutouts: piece.cutouts.length,
    hardwareHoles: piece.hardwareHoles.map((hole) => ({ diameterMm: hole.diameterMm, cut: hole.cut })),
    stitchRuns: piece.stitchRuns.map((run) => ({
      id: run.id,
      holeCount: run.holeCount,
      pitchMm: run.pitchMm,
      pitchSpreadMm: run.pitchSpreadMm,
      stitchesPerInch: run.stitchesPerInch,
      lengthMm: run.lengthMm,
      holeDiameterMm: run.holeDiameterMm,
      closed: run.closed,
      cornerCount: run.cornerCount,
      spans: run.spans,
    })),
  })),
  seams: analysis.seams,
  build: {
    warnings: built.warnings,
    unplacedPieceIds: assembled.placement.unplacedPieceIds,
    skippedSeamIds: assembled.placement.skippedSeamIds,
    diagnostics: assembled.placement.diagnostics,
  },
}
fs.writeFileSync(`${base}.report.json`, `${JSON.stringify(report, null, 2)}\n`)
written.push(`${base}.report.json`)

fs.writeFileSync(`${base}.doc.json`, `${JSON.stringify(assembled.doc)}\n`)
written.push(`${base}.doc.json`)

await server.close()

const { stitching } = analysis
console.log(`${label}: ${analysis.pieces.length} piece(s), ${analysis.seams.length} paired run(s)`)
console.log(
  `  stitching: ${stitching.totalHoles} holes in ${stitching.runCount} run(s), ` +
    `${stitching.pitchMm.toFixed(2)} mm pitch (${stitching.stitchesPerInch.toFixed(1)} SPI), ` +
    `${stitching.holeDiameterMm.toFixed(2)} mm holes`,
)
for (const piece of analysis.pieces) {
  const runs = piece.stitchRuns.map((run) => `${run.holeCount}@${run.pitchMm.toFixed(2)}mm`).join(', ') || 'none'
  console.log(
    `  ${piece.id}: ${piece.widthMm.toFixed(1)} × ${piece.heightMm.toFixed(1)} mm, ` +
      `${piece.sides.length} sides, runs: ${runs}`,
  )
}
for (const seam of analysis.seams) {
  console.log(
    `  ${seam.fold ? 'fold' : 'seam'} ${seam.from.chainId} ↔ ${seam.to.chainId}: ` +
      `${seam.holeCount} holes, ${seam.lengthMm.toFixed(1)} mm, Δ${seam.lengthDeltaMm.toFixed(2)} mm`,
  )
}
for (const warning of built.warnings) console.log(`  warning: ${warning}`)
for (const file of written) console.log(`  wrote ${file}`)
process.exit(0)
