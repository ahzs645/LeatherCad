/**
 * End to end over a real template: MAKESUPPLY's free Keychain Snap Wallet.
 *
 * The geometry is replayed from a stored path file rather than from the PDF —
 * `scripts/import-pattern-pdf.mjs` writes it, and pdf.js needs a browser build
 * these tests do not have — but it is the same 142 paths pdf.js produced, curves
 * and all. Everything downstream of the reader runs for real, so the numbers
 * asserted here are the ones a maker would measure with a ruler: 5 mm pitch,
 * 1.1 mm holes, 45 of them down each side of the one seam.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assemblePatternDoc } from './pattern-assembly-placement'
import { buildPatternDoc } from './pattern-doc-builder'
import { analyzePatternPaths } from './pattern-pdf-analysis'
import { decodePatternPaths, type PatternPathsFile } from './pattern-path-codec'
import { detectOutlines } from '../outline-detection'

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../docs/fixtures/pattern-pdf/makesupply-keychain-snap-wallet.paths.json',
)
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as PatternPathsFile
const paths = decodePatternPaths(fixture)
const analysis = analyzePatternPaths(paths, fixture.page)

describe('MAKESUPPLY Keychain Snap Wallet', () => {
  it('reads the sheet as three pieces and nothing else', () => {
    // The sheet also carries a logo, a print-scale warning, and two clip
    // frames. None of them is a piece.
    expect(analysis.pieces).toHaveLength(3)
    const sizes = analysis.pieces.map((piece) => [piece.widthMm, piece.heightMm])
    // 4¼ × 5 in, 2¾ × 4¼ in, and a 1½ in tab, to the tenth of a millimetre.
    expect(sizes[0][0]).toBeCloseTo(107.95, 2)
    expect(sizes[0][1]).toBeCloseTo(128.51, 2)
    expect(sizes[1][0]).toBeCloseTo(69.85, 2)
    expect(sizes[1][1]).toBeCloseTo(107.95, 2)
    expect(sizes[2][0]).toBeCloseTo(39.51, 2)
    expect(sizes[2][1]).toBeCloseTo(15.875, 2)
  })

  it('leaves the logo out of the pattern', () => {
    // Every mark the logo contributes falls outside all three pieces.
    expect(analysis.strayDotCount).toBeGreaterThan(0)
    expect(analysis.pieces.every((piece) => piece.cutouts.length === 0)).toBe(true)
  })

  it('measures the stitching at 5 mm pitch through a 1.1 mm punch', () => {
    expect(analysis.stitching.totalHoles).toBe(96)
    expect(analysis.stitching.pitchMm).toBeCloseTo(4.97, 2)
    expect(analysis.stitching.stitchesPerInch).toBeCloseTo(5.11, 2)
    expect(analysis.stitching.holeDiameterMm).toBeCloseTo(1.13, 2)
  })

  it('chains the body and the pocket each into one 45-hole run around three sides', () => {
    const [body, pocket] = analysis.pieces

    for (const piece of [body, pocket]) {
      expect(piece.stitchRuns).toHaveLength(1)
      expect(piece.stitchRuns[0].holeCount).toBe(45)
      expect(piece.stitchRuns[0].pitchMm).toBeCloseTo(4.972, 3)
      // Punched, not hand-marked: no gap is a tenth of a millimetre off.
      expect(piece.stitchRuns[0].pitchSpreadMm).toBeLessThan(0.1)
      expect(piece.stitchRuns[0].cornerCount).toBe(2)
      expect(piece.stitchRuns[0].closed).toBe(false)
      // Two straight sides and the two corner rounds between them.
      expect(piece.stitchRuns[0].spans).toHaveLength(5)
    }
  })

  it('finds the snap holes and keeps them out of the stitching', () => {
    const snaps = analysis.pieces.flatMap((piece) => piece.hardwareHoles)

    expect(snaps).toHaveLength(2)
    for (const snap of snaps) {
      expect(snap.diameterMm).toBeCloseTo(2.34, 2)
      // Drawn as an outline, because it gets punched out.
      expect(snap.cut).toBe(true)
    }
  })

  it('pairs the body and pocket runs into one seam', () => {
    const seams = analysis.seams.filter((seam) => !seam.fold)

    expect(seams).toHaveLength(1)
    expect(seams[0].holeCount).toBe(45)
    expect(seams[0].lengthMm).toBeCloseTo(218.78, 1)
    // Both sides punched in the same passes, so they agree to within the
    // micrometre the path file is rounded to.
    expect(seams[0].lengthDeltaMm).toBeLessThan(0.005)
    expect(seams[0].turnMismatchDeg).toBeLessThan(0.05)
  })

  it('reads the keychain tab as a piece that folds onto itself', () => {
    const tab = analysis.pieces[2]
    const fold = analysis.seams.find((seam) => seam.fold)

    expect(tab.stitchRuns.map((run) => run.holeCount)).toEqual([3, 3])
    expect(fold?.from.pieceId).toBe(tab.id)
    expect(fold?.to.pieceId).toBe(tab.id)
  })
})

describe('the project built from it', () => {
  const built = buildPatternDoc(analysis, { documentName: 'Keychain Snap Wallet' })

  it('gives every piece a boundary the outline detector closes', () => {
    const chains = detectOutlines(built.doc.objects, built.doc.lineTypes)
    const chainByShapeId = new Map(chains.flatMap((chain) => chain.shapeIds.map((id) => [id, chain])))

    expect(built.doc.patternPieces).toHaveLength(3)
    for (const piece of built.doc.patternPieces ?? []) {
      expect(chainByShapeId.get(piece.boundaryShapeId)?.isClosed).toBe(true)
    }
  })

  it('carries the punched holes rather than a fresh resampling of the seam', () => {
    expect(built.doc.stitchHoles).toHaveLength(96)
    const chains = new Set(built.doc.stitchHoles?.map((hole) => hole.chainId))
    expect(chains.size).toBe(4)
    // Anchored to the piece boundary, which is the id the 3D builders filter by.
    const boundaryIds = new Set(built.doc.patternPieces?.map((piece) => piece.boundaryShapeId))
    for (const hole of built.doc.stitchHoles ?? []) {
      expect(boundaryIds.has(hole.shapeId)).toBe(true)
    }
  })

  it('writes the seam against named boundary shapes on both pieces', () => {
    const [seam] = built.doc.seamConnections ?? []

    expect(built.doc.seamConnections).toHaveLength(1)
    expect(seam.fromSpans).toHaveLength(5)
    expect(seam.toSpans).toHaveLength(5)
    for (const span of [...(seam.fromSpans ?? []), ...(seam.toSpans ?? [])]) {
      expect(span.boundaryShapeId).toBeTruthy()
    }
    expect(seam.stitchSpacingMm).toBeCloseTo(4.972, 3)
  })

  it('derives the wallet flap hinge and the tab fold', () => {
    expect(built.doc.foldLines).toHaveLength(2)
    const [tabFold, flapFold] = built.doc.foldLines
    // The tab folds down its middle; the flap hinges across the wallet.
    expect(Math.abs(tabFold.end.y - tabFold.start.y)).toBeCloseTo(15.87, 1)
    expect(Math.abs(flapFold.end.x - flapFold.start.x)).toBeCloseTo(107.95, 1)
  })

  it('says plainly that nothing joins the keychain tab to the rest', () => {
    // The sheet never draws where the tab attaches, so the import must not
    // pretend to know.
    expect(built.warnings).toEqual([
      'piece-c: no run on this piece pairs with one on another, so nothing joins it to the assembly',
    ])
  })

  it('closes the seam when the pocket is folded onto the body', () => {
    const assembled = assemblePatternDoc(built.doc, 180)

    expect(assembled.placement.skippedSeamIds).toEqual([])
    expect(assembled.placement.unplacedPieceIds).toEqual(['piece-c'])
    for (const diagnostic of assembled.placement.diagnostics) {
      expect(diagnostic.residualGapMm).toBeLessThan(0.5)
      expect(diagnostic.requiresCrease).toBe(false)
    }
    expect(assembled.doc.piecePlacements3d).toHaveLength(2)
  })
})
