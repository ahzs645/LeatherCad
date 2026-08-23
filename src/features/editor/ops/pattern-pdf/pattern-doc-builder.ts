/**
 * Builds an editable LeatherCad project from an analysed pattern PDF.
 *
 * The analysis knows what the sheet contains; this decides what the *project*
 * is. Three things have to be true for the result to assemble rather than just
 * draw: every piece needs a closed boundary the outline detector will chain,
 * every seam has to name the boundary shapes it runs along rather than an edge
 * index, and the stitch holes have to be the ones punched in the PDF instead of
 * a fresh resampling of the seam.
 *
 * Fold lines are the one thing inferred rather than read, since sheets do not
 * draw them — `pattern-fold-inference` works out where, and they are emitted as
 * real fold lines named for the evidence behind them so a user can see they were
 * derived and move or delete them.
 */

import type {
  DocFile,
  FoldLine,
  HardwareMarker,
  Layer,
  PatternPiece,
  Point,
  SeamConnection,
  Shape,
  StitchHole,
} from '../../cad/cad-types'
import {
  CUT_LINE_TYPE_ID,
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  GUIDE_LINE_TYPE_ID,
  createDefaultLineTypes,
} from '../../cad/line-types'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../../editor-constants'
import { detectOutlines, edgeRangeForShape, type OutlineChain } from '../outline-detection'
import { inferFoldLines } from './pattern-fold-inference'
import { outlineSides } from './pattern-outline-sides'
import type { AnalyzedPiece, AnalyzedStitchRun, PatternPdfAnalysis } from './pattern-pdf-analysis'
import type { PdfTextItem } from './pdf-vector-paths'
import { sideToShapes } from './pattern-shape-emitter'

const PIECE_COLORS = ['#b0743a', '#8a5a2b', '#c68642', '#7a4a22', '#d1a05e']

export type PatternDocBuildOptions = {
  documentName: string
  /** Move the pattern so its bounding box is centred on the origin. */
  centreOnOrigin: boolean
  /** Emit the fold lines `pattern-fold-inference` derives. */
  inferFoldLines: boolean
  /** Keep the sheet's printed type as text shapes. */
  keepSheetText: boolean
}

export const DEFAULT_PATTERN_DOC_OPTIONS: PatternDocBuildOptions = {
  documentName: 'Imported pattern',
  centreOnOrigin: true,
  inferFoldLines: true,
  keepSheetText: true,
}

export type PatternDocBuild = {
  doc: DocFile
  /** Analysis piece id to document piece id. */
  pieceIdByOutlineId: Map<string, string>
  warnings: string[]
}

function pieceLetter(index: number) {
  return String.fromCharCode(65 + (index % 26))
}

function translate(point: Point, offset: Point): Point {
  return { x: point.x + offset.x, y: point.y + offset.y }
}

function offsetFor(analysis: PatternPdfAnalysis, centre: boolean): Point {
  if (!centre) return { x: 0, y: 0 }
  const bounds = analysis.pieces.reduce(
    (acc, piece) => ({
      minX: Math.min(acc.minX, piece.outline.bounds.minX),
      minY: Math.min(acc.minY, piece.outline.bounds.minY),
      maxX: Math.max(acc.maxX, piece.outline.bounds.maxX),
      maxY: Math.max(acc.maxY, piece.outline.bounds.maxY),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
  if (!Number.isFinite(bounds.minX)) return { x: 0, y: 0 }
  return { x: -(bounds.minX + bounds.maxX) / 2, y: -(bounds.minY + bounds.maxY) / 2 }
}

function shiftShape(shape: Shape, offset: Point): Shape {
  switch (shape.type) {
    case 'arc':
      return { ...shape, start: translate(shape.start, offset), mid: translate(shape.mid, offset), end: translate(shape.end, offset) }
    case 'bezier':
      return { ...shape, start: translate(shape.start, offset), control: translate(shape.control, offset), end: translate(shape.end, offset) }
    default:
      return { ...shape, start: translate(shape.start, offset), end: translate(shape.end, offset) }
  }
}

/** Direction the thread travels through a hole, for chisel alignment. */
function holeAngleDeg(run: AnalyzedStitchRun, index: number) {
  const before = run.dots[Math.max(0, index - 1)].center
  const after = run.dots[Math.min(run.dots.length - 1, index + 1)].center
  return (Math.atan2(after.y - before.y, after.x - before.x) * 180) / Math.PI
}

/**
 * The piece's holes, in sewing order.
 *
 * Every hole is anchored to the piece's boundary shape rather than to the side
 * it sits beside: that is the id the 3D builders filter a piece's holes by, and
 * a hole anchored to any other shape is simply not drawn. Run membership rides
 * on `chainId` instead, which is what the chain builders read. `sequence` runs
 * across the whole piece so that the one renderer that orders holes by shape
 * keeps a piece's runs apart instead of interleaving them.
 */
function stitchHolesFor(piece: AnalyzedPiece, boundaryShapeId: string, offset: Point): StitchHole[] {
  let sequence = 0
  return piece.stitchRuns.flatMap((run) =>
    run.dots.map((dot, index) => ({
      id: `${run.id}-hole-${index + 1}`,
      shapeId: boundaryShapeId,
      chainId: run.id,
      point: translate(dot.center, offset),
      angleDeg: holeAngleDeg(run, index),
      holeType: 'round' as const,
      sequence: sequence++,
      diameterMm: dot.diameterMm,
      endHole: index === 0 || index === run.dots.length - 1,
    })),
  )
}

function hardwareFor(piece: AnalyzedPiece, layerId: string, offset: Point): HardwareMarker[] {
  return piece.hardwareHoles.map((hole, index) => ({
    id: `${hole.id}-hardware`,
    layerId,
    point: translate(hole.center, offset),
    // Nothing on the sheet names the hardware; the hole size is the only
    // evidence, and a punched hole this size is a post going through it.
    kind: 'snap' as const,
    label: `Snap ${index + 1}`,
    holeDiameterMm: hole.diameterMm,
    spacingMm: 0,
    visible: true,
    notes: `Imported ${hole.diameterMm.toFixed(2)} mm hole`,
  }))
}

/**
 * The sheet's own type, kept as text.
 *
 * On a guide line type, so it prints with the pattern but is never mistaken
 * for something to cut, and never chained into a boundary. The width is
 * estimated from the font size — the glyphs are not measured here — which is
 * enough for a label a user can drag or retype.
 */
function labelShapes(
  labels: PdfTextItem[],
  params: { idPrefix: string; layerId: string },
  offset: Point,
): Shape[] {
  return labels.map((label, index) => ({
    id: `${params.idPrefix}-label-${index + 1}`,
    type: 'text' as const,
    layerId: params.layerId,
    lineTypeId: GUIDE_LINE_TYPE_ID,
    start: translate(label.position, offset),
    end: translate(
      { x: label.position.x + label.text.length * label.heightMm * 0.6, y: label.position.y },
      offset,
    ),
    text: label.text,
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSizeMm: label.heightMm,
    transform: 'none' as const,
    radiusMm: 0,
    sweepDeg: 0,
  }))
}

function layerFor(index: number, name: string): Layer {
  return { id: `pattern-layer-${index + 1}`, name, visible: true, locked: false, stackLevel: index }
}

/** Builds the project. Pieces come out largest first, as the analysis ordered them. */
export function buildPatternDoc(
  analysis: PatternPdfAnalysis,
  options: Partial<PatternDocBuildOptions> = {},
): PatternDocBuild {
  const config = { ...DEFAULT_PATTERN_DOC_OPTIONS, ...options }
  const offset = offsetFor(analysis, config.centreOnOrigin)
  const lineTypes = createDefaultLineTypes()
  const warnings: string[] = []

  const layers: Layer[] = []
  const shapes: Shape[] = []
  const pieces: PatternPiece[] = []
  const stitchHoles: StitchHole[] = []
  const hardwareMarkers: HardwareMarker[] = []
  const foldLines: FoldLine[] = []
  const pieceIdByOutlineId = new Map<string, string>()
  /** Analysis side id to every document shape emitted for it, in order. */
  const shapesForSide = new Map<string, string[]>()

  analysis.pieces.forEach((piece, index) => {
    const code = pieceLetter(index)
    const pieceId = `piece-${code.toLowerCase()}`
    pieceIdByOutlineId.set(piece.id, pieceId)
    const layer = layerFor(index, `Piece ${code}`)
    layers.push(layer)

    const boundaryShapeIds: string[] = []
    piece.sides.forEach((side, sideIndex) => {
      const emitted = sideToShapes(side, {
        idPrefix: `${pieceId}-s${sideIndex + 1}`,
        layerId: layer.id,
        lineTypeId: CUT_LINE_TYPE_ID,
      }).map((shape) => shiftShape(shape, offset))
      shapes.push(...emitted)
      const ids = emitted.map((shape) => shape.id)
      shapesForSide.set(side.id, ids)
      boundaryShapeIds.push(...ids)
    })

    if (boundaryShapeIds.length === 0) {
      warnings.push(`${piece.id}: outline produced no shapes`)
      return
    }

    // Card slots, windows, and strap openings: real cut geometry on the piece,
    // and the mesh builder needs them listed to punch them through.
    const internalShapeIds: string[] = []
    piece.cutouts.forEach((cutout, cutoutIndex) => {
      const prefix = `${pieceId}-cut${cutoutIndex + 1}`
      outlineSides(cutout.segments, prefix).forEach((side, sideIndex) => {
        const emitted = sideToShapes(side, {
          idPrefix: `${prefix}-s${sideIndex + 1}`,
          layerId: layer.id,
          lineTypeId: CUT_LINE_TYPE_ID,
        }).map((shape) => shiftShape(shape, offset))
        shapes.push(...emitted)
        internalShapeIds.push(...emitted.map((shape) => shape.id))
      })
    })

    pieces.push({
      id: pieceId,
      // The sheet's own word for the piece beats anything generated from it.
      name: piece.name ?? `Piece ${code} — ${piece.widthMm.toFixed(1)} × ${piece.heightMm.toFixed(1)} mm`,
      boundaryShapeId: boundaryShapeIds[0],
      internalShapeIds,
      layerId: layer.id,
      quantity: 1,
      code,
      onFold: false,
      orientation: 'any',
      allowFlip: true,
      includeInLayout: true,
      locked: false,
      color: PIECE_COLORS[index % PIECE_COLORS.length],
      notes:
        `${piece.widthMm.toFixed(1)} × ${piece.heightMm.toFixed(1)} mm · ` +
        `${piece.stitchRuns.reduce((sum, run) => sum + run.holeCount, 0)} stitch holes imported from PDF`,
    })

    stitchHoles.push(...stitchHolesFor(piece, boundaryShapeIds[0], offset))
    hardwareMarkers.push(...hardwareFor(piece, layer.id, offset))
    if (config.keepSheetText) {
      shapes.push(...labelShapes(piece.labels, { idPrefix: pieceId, layerId: layer.id }, offset))
    }
  })

  if (config.keepSheetText && analysis.sheetLabels.length > 0) {
    // Print-scale warnings and sheet titles belong to the page, not to a piece,
    // so they get a layer of their own that can be switched off in one click.
    const notesLayer = layerFor(layers.length, 'Sheet notes')
    layers.push(notesLayer)
    shapes.push(
      ...labelShapes(analysis.sheetLabels, { idPrefix: 'sheet', layerId: notesLayer.id }, offset),
    )
  }

  if (config.inferFoldLines) {
    for (const inferred of inferFoldLines(analysis)) {
      const pieceId = pieceIdByOutlineId.get(inferred.fold.pieceId ?? '')
      if (!pieceId) continue
      foldLines.push({
        ...inferred.fold,
        pieceId,
        start: translate(inferred.fold.start, offset),
        end: translate(inferred.fold.end, offset),
      })
    }
  }

  const chains = detectOutlines(shapes, lineTypes)
  const chainByShapeId = new Map<string, OutlineChain>()
  for (const chain of chains) {
    for (const shapeId of chain.shapeIds) chainByShapeId.set(shapeId, chain)
  }
  for (const piece of pieces) {
    if (!chainByShapeId.get(piece.boundaryShapeId)?.isClosed) {
      warnings.push(`${piece.id}: boundary did not close`)
    }
  }

  const runById = new Map(
    analysis.pieces.flatMap((piece) => piece.stitchRuns.map((run) => [run.id, run] as const)),
  )
  const seamConnections: SeamConnection[] = []
  for (const seam of analysis.seams) {
    // A fold match is one piece meeting itself; it becomes a fold line, not a
    // seam between two pieces.
    if (seam.fold) continue
    const fromRun = runById.get(seam.from.chainId)
    const toRun = runById.get(seam.to.chainId)
    const fromPieceId = pieceIdByOutlineId.get(seam.from.pieceId)
    const toPieceId = pieceIdByOutlineId.get(seam.to.pieceId)
    if (!fromRun || !toRun || !fromPieceId || !toPieceId) continue

    // Spans have to read as one continuous walk along the boundary, so a run
    // that travels against the outline's winding is listed back to front. The
    // walk direction is folded into the seam's own `reversed` flag below rather
    // than left in the span list, because that is where the document keeps it.
    const sideSpans = (run: AnalyzedStitchRun, pieceId: string) => {
      const spans = run.spansReversed ? [...run.spans].reverse() : run.spans
      return spans.flatMap((span) => {
        const shapeIds = shapesForSide.get(span.sideId) ?? []
        return shapeIds.flatMap((shapeId) => {
          const chain = chainByShapeId.get(shapeId)
          const range = chain ? edgeRangeForShape(chain, shapeId) : null
          if (!range) return []
          return [{
            pieceId,
            edgeIndex: range.firstEdgeIndex,
            boundaryShapeId: shapeId,
            // A side split across several shapes carries its portion on the
            // side as a whole; clipping each shape by it would drop the run's
            // middle. Only a single-shape side can honour the portion exactly.
            t0: shapeIds.length === 1 ? span.t0 : 0,
            t1: shapeIds.length === 1 ? span.t1 : 1,
          }]
        })
      })
    }

    const fromSpans = sideSpans(fromRun, fromPieceId)
    const toSpans = sideSpans(toRun, toPieceId)
    if (fromSpans.length === 0 || toSpans.length === 0) {
      warnings.push(`${seam.id}: could not resolve seam spans`)
      continue
    }
    seamConnections.push({
      id: `seam-${seamConnections.length + 1}`,
      name: `${seam.holeCount} holes @ ${seam.pitchMm.toFixed(2)} mm`,
      from: { pieceId: fromPieceId, edgeIndex: fromSpans[0].edgeIndex, boundaryShapeId: fromSpans[0].boundaryShapeId },
      to: { pieceId: toPieceId, edgeIndex: toSpans[0].edgeIndex, boundaryShapeId: toSpans[0].boundaryShapeId },
      fromSpan: fromSpans[0],
      toSpan: toSpans[0],
      fromSpans: fromSpans.length > 1 ? fromSpans : undefined,
      toSpans: toSpans.length > 1 ? toSpans : undefined,
      kind: 'sewn',
      // Three independent flips compose here: whether the pairing itself is
      // head-to-tail, and whether either side's span list had to be turned
      // around to read as a forward walk. An even number of flips cancels.
      reversed: seam.reversed !== fromRun.spansReversed !== toRun.spansReversed,
      stitchSpacingMm: seam.pitchMm,
      edgeLengthDeltaMm: seam.lengthDeltaMm,
      sequence: seamConnections.length + 1,
    })
  }

  const seamedPieceIds = new Set(
    seamConnections.flatMap((seam) => [seam.from.pieceId, seam.to.pieceId]),
  )
  for (const piece of pieces) {
    if (!seamedPieceIds.has(piece.id)) {
      warnings.push(
        `${piece.id}: no run on this piece pairs with one on another, so nothing joins it to the assembly`,
      )
    }
  }

  const doc: DocFile = {
    version: 1,
    units: 'mm',
    documentName: config.documentName,
    layers,
    activeLayerId: layers[0]?.id ?? 'pattern-layer-1',
    lineTypes,
    activeLineTypeId: DEFAULT_ACTIVE_LINE_TYPE_ID,
    objects: shapes,
    foldLines,
    stitchHoles,
    // The holes hang off each piece's cut boundary, and the editor only shows
    // holes on a stitch-role shape unless a shape is on this override list.
    // Without it the imported stitching is in the document but invisible.
    stitchAlwaysShapeIds: pieces.map((piece) => piece.boundaryShapeId),
    hardwareMarkers,
    patternPieces: pieces,
    seamConnections,
    threePreviewSettings: {
      ...DEFAULT_THREE_PREVIEW_SETTINGS,
      mode: 'assembled',
      showSeams: true,
      // An import already knows where the pieces go, so it opens with them
      // together rather than pulled apart for inspection.
      explodedFactor: 0,
    },
  }
  return { doc, pieceIdByOutlineId, warnings }
}
