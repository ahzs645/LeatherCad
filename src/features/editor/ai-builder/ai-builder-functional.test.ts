/**
 * Does the thing the AI Builder produced actually work?
 *
 * `ai-builder-benchmark.test.ts` scores twelve points, and every one of them
 * is a presence check: are there layers, are there pieces, are there at least
 * two stitch holes, did preflight stay quiet. A document can take all twelve
 * and still be a wallet that does not close. The committed baseline scores
 * eleven or twelve across the board, which is what a saturated metric looks
 * like.
 *
 * This file asks the harder question, using what the app can now compute about
 * a folded piece: the drape solver returns per-vertex `stress` (how much more
 * the fold is asking of the leather than it has) and `clash` (how far the
 * leather ended up inside another piece). Neither is an opinion this harness
 * invents — both come out of the same solve the 3D view draws.
 *
 * Ten agents then found four holes in *this* harness, each with a document
 * that took full marks while carrying the defect: pieces overlapping on the
 * flat sheet, stitching drawn off the leather, a crease that stops short of
 * the cut edge, and a seam whose two sides do not mate. Those four are scored
 * by `ai-builder-functional-checks.ts`, which lives beside this file so each
 * one can be tested against a document built to carry the defect rather than
 * against whatever the corpus happens to contain.
 *
 * The drape scoring lives in a test file on purpose. It needs the assembled
 * model builder and three.js, and the AI Builder module has no business
 * importing either.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Group, Material, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import { detectOutlines } from '../ops/outline-detection'
import { buildModelLayout } from '../three/model-builder'
import { rebuildAssembledModel } from '../three/assembled-model-builder'
import { solveFoldDrapeData } from '../three/assembled-fold-drape'
import { createFoldDrapeStore } from '../three/fold-drape-store'
import { createSharedMaterials } from '../three/shared-materials'
import type { DocFile } from '../cad/cad-types'
import { compileAiBuilderDocument } from './ai-builder-compile'
import {
  checkFoldsReachCutEdges,
  checkMarksOnLeather,
  checkPiecesDoNotOverlap,
  checkSeamsMateCorrectly,
  type FunctionalCheck,
} from './ai-builder-functional-checks'
import { parseAiBuilderDocument } from './ai-builder-parse'

const BENCHMARK_ROOT = path.join(process.cwd(), 'ai-builder-benchmarks')
const OUTPUTS_DIR = path.join(BENCHMARK_ROOT, 'outputs')
/**
 * Where the report lands, and which outputs go into it.
 *
 * Both are overridable so several agents can score their own file at once
 * without racing each other for one report: `AI_BENCH_FILTER` is a substring
 * matched against the file name, `AI_BENCH_REPORT` an alternative destination.
 */
const REPORT_PATH = process.env.AI_BENCH_REPORT
  ? path.resolve(process.env.AI_BENCH_REPORT)
  : path.join(BENCHMARK_ROOT, 'functional-report.json')
const FILTER = process.env.AI_BENCH_FILTER ?? ''

/**
 * The angle every fold is driven to for scoring.
 *
 * Documents arrive with `angleDeg: 0` — a fold that has not been dialled yet —
 * so scoring them as authored would fold nothing and pass everything. A
 * template is judged closed, because closed is the pose it has to survive.
 */
const SCORING_ANGLE_DEG = 180

/** Above this a fold is asking for more than the leather has. */
const STRESS_LIMIT = 1
/** Deeper than this and two pieces are meaningfully in the same place. */
const CLASH_LIMIT_MM = 0.5

type Check = FunctionalCheck

function materials() {
  return {
    shared: createSharedMaterials(),
    leftMaterial: new MeshStandardMaterial(),
    rightMaterial: new MeshStandardMaterial(),
    leftTextureMaterial: new MeshStandardMaterial(),
    rightTextureMaterial: new MeshStandardMaterial(),
    assembledFrontMaterial: new MeshStandardMaterial(),
    assembledBackMaterial: new MeshStandardMaterial(),
    assembledSideMaterial: new MeshStandardMaterial(),
  } as never
}

function outlinePolygons(doc: DocFile) {
  const result: unknown[] = []
  for (const chain of detectOutlines(doc.objects, doc.lineTypes)) {
    if (!chain.isClosed || chain.area < 1) continue
    const firstShape = doc.objects.find((shape) => shape.id === chain.shapeIds[0])
    if (!firstShape) continue
    result.push({
      polygon: chain.polygon,
      shapeIds: chain.shapeIds,
      segments: chain.segments,
      layerId: firstShape.layerId,
    })
  }
  return result as never
}

/**
 * Solve every fold in the document at the scoring angle and report the worst
 * stress and clash any piece came back with.
 *
 * The drape is asked for through the assembled builder rather than called
 * directly, because the obstacles a fold has to clear are worked out there —
 * a fold solved without them would close through the leather it wraps and
 * report nothing wrong.
 */
function solveFolds(doc: DocFile) {
  const foldLines = (doc.foldLines ?? []).map((fold) => ({ ...fold, angleDeg: SCORING_ANGLE_DEG }))
  if (foldLines.length === 0) return null

  const { pieceMeshes, transform, documentBounds } = buildModelLayout({
    patternPieces: doc.patternPieces ?? [],
    outlinePolygons: outlinePolygons(doc),
    shapes: doc.objects,
    foldLines,
  })

  const captured: Record<string, unknown> = {}
  const store = createFoldDrapeStore({
    solver: {
      solve: async (pieceId: string, params: never) => {
        captured[pieceId] = params
        return solveFoldDrapeData(params)
      },
      dispose: () => undefined,
    },
    onSettled: () => undefined,
  })

  rebuildAssembledModel({
    layers: doc.layers,
    lineTypes: doc.lineTypes,
    shapes: doc.objects,
    foldLines,
    stitchHoles: doc.stitchHoles ?? [],
    outlinePolygons: [],
    patternPieces: doc.patternPieces ?? [],
    piecePlacements3d: doc.piecePlacements3d ?? [],
    seamConnections: doc.seamConnections ?? [],
    previewSettings: { ...DEFAULT_THREE_PREVIEW_SETTINGS, ...doc.threePreviewSettings, mode: 'assembled' },
    pieceMeshes,
    transform,
    documentBounds,
    threadColor: '#fb923c',
    texturedShapeIdSet: new Set(),
    hasActiveTexture: false,
    materials: materials(),
    preservedMaterials: new Set<Material>(),
    fitControlsToModel: () => undefined,
    assembledGroup: new Group(),
    finalProductGroup: new Group(),
    staticSideGroup: new Group(),
    foldingSideGroup: new Group(),
    foldGuideGroup: new Group(),
    avatarGroup: new Group(),
    rebuildAvatarModel: async () => undefined,
    foldDrape: store,
  } as never)

  let askedPieces = 0
  let solvedPieces = 0
  let settledPieces = 0
  let worstStress = 0
  let worstClashMm = 0
  for (const params of Object.values(captured)) {
    const data = solveFoldDrapeData(params as never)
    askedPieces += 1
    // A piece the solver could not drape at all reports nothing, and nothing
    // is not the same as zero: leaving it out of the maxima would hand full
    // marks for stress and clash to a fold that never happened.
    if (!data) continue
    solvedPieces += 1
    if (data.settled) settledPieces += 1
    worstStress = Math.max(worstStress, ...data.stress)
    worstClashMm = Math.max(worstClashMm, ...data.clash)
  }
  store.dispose()
  return {
    foldCount: foldLines.length,
    askedPieces,
    solvedPieces,
    settledPieces,
    worstStress,
    worstClashMm,
    measurable: askedPieces > 0 && solvedPieces === askedPieces && settledPieces === askedPieces,
  }
}

function scoreFunctional(doc: DocFile, preflight: { code: string; severity: string }[]) {
  const checks: Check[] = []

  // 1. Every piece has a boundary the app can actually resolve into a closed
  //    loop with area. A piece whose boundary does not close cannot be cut.
  const outlines = detectOutlines(doc.objects, doc.lineTypes)
  const closedWithArea = outlines.filter((chain) => chain.isClosed && chain.area >= 1)
  const pieces = doc.patternPieces ?? []
  const piecesClosed = pieces.length > 0 && closedWithArea.length >= pieces.length
  checks.push({
    name: 'pieces-cuttable',
    points: piecesClosed ? 2 : 0,
    max: 2,
    note: piecesClosed
      ? `${pieces.length} piece(s), ${closedWithArea.length} closed outline(s)`
      : `${pieces.length} piece(s) but only ${closedWithArea.length} closed outline(s) with area`,
  })

  // 1b. And no two of them are cut from the same leather. Nothing else here
  //     looks at the nesting, and a sheet that cannot be cut is not a pattern.
  checks.push(checkPiecesDoNotOverlap(doc))

  // 2. The app's own preflight already decides whether a seam can be sewn and
  //    whether a boundary closes; reusing its codes keeps one answer in the
  //    codebase rather than a second opinion that can drift from it.
  const blocking = preflight.filter((issue) =>
    ['seam-length-mismatch', 'seam-edge-unavailable', 'seam-open-piece-boundary', 'invalid-seam-piece'].includes(
      issue.code,
    ),
  )
  const seams = doc.seamConnections ?? []
  checks.push({
    name: 'seams-sewable',
    points: seams.length === 0 ? 0 : blocking.length === 0 ? 2 : 0,
    max: 2,
    note:
      seams.length === 0
        ? 'no seam connections'
        : `${seams.length} seam(s), ${blocking.length} blocking preflight issue(s)`,
  })

  // 2b. Preflight's only guard on a seam is a length comparison, so ask
  //     whether the two sides actually mate and whether the seam graph
  //     reaches every piece.
  checks.push(checkSeamsMateCorrectly(doc))

  // 2c. Stitch holes, hardware and marks have to land on the leather they
  //     belong to. Counting holes says nothing about where they are.
  checks.push(checkMarksOnLeather(doc))

  // 3-5. What the fold does. A document with no fold cannot score these and
  //      is not punished for it either — a card sleeve does not fold.
  const folds = solveFolds(doc)
  if (!folds) {
    checks.push({ name: 'folds-solve', points: 0, max: 0, note: 'no fold lines' })
    checks.push({ name: 'folds-within-leather', points: 0, max: 0, note: 'no fold lines' })
    checks.push({ name: 'folds-clear-other-pieces', points: 0, max: 0, note: 'no fold lines' })
  } else {
    checks.push({
      name: 'folds-solve',
      points: folds.measurable ? 2 : 0,
      max: 2,
      note: `${folds.settledPieces}/${folds.askedPieces} piece(s) settled`
        + (folds.solvedPieces < folds.askedPieces
          ? `, ${folds.askedPieces - folds.solvedPieces} produced no drape`
          : ''),
    })
    // Both physical checks are gated on the fold having actually solved. A
    // stress of zero from a fold that never ran is not a fold that behaves.
    checks.push({
      name: 'folds-within-leather',
      points: folds.measurable && folds.worstStress < STRESS_LIMIT ? 3 : 0,
      max: 3,
      note: folds.measurable ? `worst stress ${folds.worstStress.toFixed(3)}` : 'not measurable, fold did not solve',
    })
    checks.push({
      name: 'folds-clear-other-pieces',
      points: folds.measurable && folds.worstClashMm < CLASH_LIMIT_MM ? 3 : 0,
      max: 3,
      note: folds.measurable ? `worst clash ${folds.worstClashMm.toFixed(3)}mm` : 'not measurable, fold did not solve',
    })
  }

  // 6. Whether the crease is one a maker could put in. The drape above will
  //    solve a fold that only crosses the middle of a piece, because region
  //    splitting extends it to an infinite line; the leather will not.
  checks.push(checkFoldsReachCutEdges(doc))

  const score = checks.reduce((total, check) => total + check.points, 0)
  const maxScore = checks.reduce((total, check) => total + check.max, 0)
  return { score, maxScore, checks, folds }
}

describe('AI Builder functional benchmark', () => {
  const files = existsSync(OUTPUTS_DIR)
    ? readdirSync(OUTPUTS_DIR)
        .filter((name) => name.endsWith('.json') && name.includes(FILTER))
        .sort()
    : []

  it('scores every benchmark output on whether it works, not what it contains', () => {
    expect(existsSync(OUTPUTS_DIR)).toBe(true)
    const rows: unknown[] = []

    for (const fileName of files) {
      const source = readFileSync(path.join(OUTPUTS_DIR, fileName), 'utf8')
      const parsed = parseAiBuilderDocument(source)
      if (!parsed.ok) {
        rows.push({ file: fileName, parsed: false, errors: parsed.errors.slice(0, 5) })
        continue
      }
      const compiled = compileAiBuilderDocument(parsed.document)
      const functional = scoreFunctional(compiled.doc, compiled.preflight)
      rows.push({
        file: fileName,
        parsed: true,
        preflightErrors: compiled.summary.preflightErrorCount,
        preflightWarnings: compiled.summary.preflightWarningCount,
        functionalScore: functional.score,
        functionalMax: functional.maxScore,
        checks: functional.checks,
        folds: functional.folds,
      })
    }

    mkdirSync(BENCHMARK_ROOT, { recursive: true })
    writeFileSync(REPORT_PATH, `${JSON.stringify({ scoringAngleDeg: SCORING_ANGLE_DEG, rows }, null, 2)}\n`)

    // The report is the deliverable; the only hard assertion is that scoring
    // ran at all, so one unbuildable output does not hide the rest.
    expect(rows.length).toBe(files.length)
  }, 600000)
})
