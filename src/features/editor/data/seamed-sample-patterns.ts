/**
 * Sample patterns that declare pattern pieces and the seams joining them.
 *
 * The presets that shipped before this file are single-sheet nets: they fold,
 * but they have no pieces, so `0 pieces / 0 seams` was the out-of-the-box state
 * and every seam-dependent surface opened empty. These four exercise the whole
 * path — pieces, multi-span seams, curved seams, and a sewing order — and
 * between them cover the shapes a real project takes:
 *
 * - Card Case      two flat panels, three straight seams
 * - Boxed Pouch    a gusset meeting three sides of each panel as ONE seam
 * - Dice Cup       a butt seam plus a straight side sewn to a circle
 * - Tote Bag       five pieces with a deliberate sewing order
 *
 * Seam edges are authored by naming the boundary shape, never an edge index.
 * Indices are resolved from the geometry at build time by the same outline
 * detection the editor uses, so nudging a coordinate moves the seam with it
 * instead of silently repointing it at a different side.
 */

import type {
  DocFile,
  FoldLine,
  Layer,
  PatternPiece,
  PieceEdgeSpan,
  SeamConnection,
  Shape,
  ThreePreviewSettings,
} from '../cad/cad-types'
import {
  CUT_LINE_TYPE_ID,
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  GUIDE_LINE_TYPE_ID,
  createDefaultLineTypes,
} from '../cad/line-types'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import { detectOutlines, edgeRangeForShape, type OutlineChain } from '../ops/outline-detection'

type SeamSideSpec = {
  pieceId: string
  /** Boundary shapes this side of the seam runs along, in stitching order. */
  shapeIds: string[]
  /**
   * Portion of a named shape the seam covers, 0..1 along that shape, keyed by
   * shape id. Absent means the whole shape. A pocket shorter than the panel it
   * sits on, or a handle tacked down at its ends, needs this.
   */
  portions?: Record<string, { t0: number; t1: number }>
}

type SeamSpec = {
  id: string
  name: string
  from: SeamSideSpec
  to: SeamSideSpec
  /** Sides are stitched face to face, so one is usually walked backwards. */
  reversed?: boolean
  stitchSpacingMm?: number
  kind?: SeamConnection['kind']
}

type PieceSpec = {
  id: string
  name: string
  boundaryShapeId: string
  layerId: string
  code?: string
  quantity?: number
  color?: string
  notes?: string
}

type PatternSpec = {
  id: string
  label: string
  layers: Layer[]
  shapes: Shape[]
  pieces: PieceSpec[]
  seams: SeamSpec[]
  foldLines?: FoldLine[]
  threePreviewSettings?: ThreePreviewSettings
}

function layer(id: string, name: string, stackLevel = 0): Layer {
  return { id, name, visible: true, locked: false, stackLevel }
}

function line(
  id: string,
  layerId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineTypeId = CUT_LINE_TYPE_ID,
): Shape {
  return { id, type: 'line', layerId, lineTypeId, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }
}

function arc(
  id: string,
  layerId: string,
  sx: number,
  sy: number,
  mx: number,
  my: number,
  ex: number,
  ey: number,
  lineTypeId = CUT_LINE_TYPE_ID,
): Shape {
  return {
    id,
    type: 'arc',
    layerId,
    lineTypeId,
    start: { x: sx, y: sy },
    mid: { x: mx, y: my },
    end: { x: ex, y: ey },
  }
}

/** Four sides named `${prefix}-top|right|bottom|left`, wound clockwise. */
function panel(
  prefix: string,
  layerId: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Shape[] {
  return [
    line(`${prefix}-top`, layerId, minX, minY, maxX, minY),
    line(`${prefix}-right`, layerId, maxX, minY, maxX, maxY),
    line(`${prefix}-bottom`, layerId, maxX, maxY, minX, maxY),
    line(`${prefix}-left`, layerId, minX, maxY, minX, minY),
  ]
}

/** A circle as four quarter arcs, so its boundary is genuinely curved. */
function circle(prefix: string, layerId: string, cx: number, cy: number, radius: number): Shape[] {
  const diagonal = radius * Math.SQRT1_2
  return [
    arc(`${prefix}-q1`, layerId, cx + radius, cy, cx + diagonal, cy + diagonal, cx, cy + radius),
    arc(`${prefix}-q2`, layerId, cx, cy + radius, cx - diagonal, cy + diagonal, cx - radius, cy),
    arc(`${prefix}-q3`, layerId, cx - radius, cy, cx - diagonal, cy - diagonal, cx, cy - radius),
    arc(`${prefix}-q4`, layerId, cx, cy - radius, cx + diagonal, cy - diagonal, cx + radius, cy),
  ]
}

function guideLabel(id: string, layerId: string, x: number, y: number, value: string): Shape {
  return {
    id,
    type: 'text',
    layerId,
    lineTypeId: GUIDE_LINE_TYPE_ID,
    start: { x, y },
    end: { x: x + value.length * 2.6, y },
    text: value,
    fontFamily: 'Georgia, serif',
    fontSizeMm: 4,
    transform: 'none',
    radiusMm: 40,
    sweepDeg: 140,
  }
}

function piece(spec: PieceSpec): PatternPiece {
  return {
    id: spec.id,
    name: spec.name,
    boundaryShapeId: spec.boundaryShapeId,
    internalShapeIds: [],
    layerId: spec.layerId,
    quantity: spec.quantity ?? 1,
    code: spec.code,
    notes: spec.notes,
    onFold: false,
    orientation: 'any',
    allowFlip: true,
    includeInLayout: true,
    locked: false,
    color: spec.color,
  }
}

/**
 * Turn an authored seam side into spans against the real geometry.
 *
 * Throws rather than degrading: a sample pattern whose seam names a shape that
 * is not on the piece boundary is an authoring mistake, and silently producing
 * a seam pointing at edge 0 is how the positional-index bug used to hide.
 */
function resolveSide(
  patternId: string,
  seamId: string,
  side: SeamSideSpec,
  chainForPiece: Map<string, OutlineChain>,
): PieceEdgeSpan[] {
  const chain = chainForPiece.get(side.pieceId)
  if (!chain) {
    throw new Error(`${patternId}: seam ${seamId} references unknown piece ${side.pieceId}`)
  }
  return side.shapeIds.map((shapeId) => {
    const range = edgeRangeForShape(chain, shapeId)
    if (!range) {
      throw new Error(
        `${patternId}: seam ${seamId} references ${shapeId}, which is not on the boundary of ${side.pieceId}`,
      )
    }
    const portion = side.portions?.[shapeId]
    return {
      pieceId: side.pieceId,
      edgeIndex: range.firstEdgeIndex,
      boundaryShapeId: shapeId,
      t0: portion?.t0 ?? 0,
      t1: portion?.t1 ?? 1,
    }
  })
}

function buildPatternDoc(spec: PatternSpec): DocFile {
  const lineTypes = createDefaultLineTypes()
  const chains = detectOutlines(spec.shapes, lineTypes)
  const chainByShapeId = new Map<string, OutlineChain>()
  for (const chain of chains) {
    for (const shapeId of chain.shapeIds) {
      chainByShapeId.set(shapeId, chain)
    }
  }

  const pieces = spec.pieces.map(piece)
  const chainForPiece = new Map<string, OutlineChain>()
  for (const entry of pieces) {
    const chain = chainByShapeId.get(entry.boundaryShapeId)
    if (!chain?.isClosed) {
      throw new Error(`${spec.id}: piece ${entry.id} has no closed boundary at ${entry.boundaryShapeId}`)
    }
    chainForPiece.set(entry.id, chain)
  }

  const seamConnections: SeamConnection[] = spec.seams.map((seam, index) => {
    const fromSpans = resolveSide(spec.id, seam.id, seam.from, chainForPiece)
    const toSpans = resolveSide(spec.id, seam.id, seam.to, chainForPiece)
    return {
      id: `${spec.id}-${seam.id}`,
      name: seam.name,
      from: { pieceId: fromSpans[0].pieceId, edgeIndex: fromSpans[0].edgeIndex, boundaryShapeId: fromSpans[0].boundaryShapeId },
      to: { pieceId: toSpans[0].pieceId, edgeIndex: toSpans[0].edgeIndex, boundaryShapeId: toSpans[0].boundaryShapeId },
      fromSpan: fromSpans[0],
      toSpan: toSpans[0],
      fromSpans: fromSpans.length > 1 ? fromSpans : undefined,
      toSpans: toSpans.length > 1 ? toSpans : undefined,
      kind: seam.kind ?? 'sewn',
      reversed: seam.reversed ?? true,
      stitchSpacingMm: seam.stitchSpacingMm ?? 4,
      sequence: index + 1,
    }
  })

  return {
    version: 1,
    units: 'mm',
    documentName: spec.label,
    layers: spec.layers,
    activeLayerId: spec.layers[0]?.id ?? 'layer-1',
    lineTypes,
    activeLineTypeId: DEFAULT_ACTIVE_LINE_TYPE_ID,
    objects: spec.shapes,
    foldLines: spec.foldLines ?? [],
    patternPieces: pieces,
    seamConnections,
    threePreviewSettings: spec.threePreviewSettings ?? {
      ...DEFAULT_THREE_PREVIEW_SETTINGS,
      mode: 'assembled',
      showSeams: true,
    },
  }
}

// ── Card Case ───────────────────────────────────────────────────────────────
// The smallest thing with a seam: a back panel and a pocket, joined down both
// sides and across the bottom. Three separate seams, because on a real card
// case they are three separate runs of stitching.

const cardCaseBackLayer = layer('card-case-back', 'Back Panel', 0)
const cardCasePocketLayer = layer('card-case-pocket', 'Pocket Panel', 1)

const cardCaseSpec: PatternSpec = {
  id: 'card-case',
  label: 'Two-Panel Card Case',
  layers: [cardCaseBackLayer, cardCasePocketLayer],
  shapes: [
    ...panel('card-case-back', cardCaseBackLayer.id, -115, -35, -15, 35),
    ...panel('card-case-pocket', cardCasePocketLayer.id, 15, -12, 115, 35),
    guideLabel('card-case-back-label', cardCaseBackLayer.id, -100, -42, 'Back 100x70'),
    guideLabel('card-case-pocket-label', cardCasePocketLayer.id, 30, -19, 'Pocket 100x47'),
  ],
  pieces: [
    { id: 'card-case-back', name: 'Back Panel', boundaryShapeId: 'card-case-back-top', layerId: cardCaseBackLayer.id, code: 'A', color: '#b0743a' },
    { id: 'card-case-pocket', name: 'Pocket Panel', boundaryShapeId: 'card-case-pocket-top', layerId: cardCasePocketLayer.id, code: 'B', color: '#8a5a2b' },
  ],
  seams: [
    {
      id: 'seam-left',
      name: 'Left edge',
      // The pocket is 47mm tall against a 70mm back, so the seam covers the
      // lower 47/70 of the back's side. back-left runs bottom to top.
      from: {
        pieceId: 'card-case-back',
        shapeIds: ['card-case-back-left'],
        portions: { 'card-case-back-left': { t0: 0, t1: 47 / 70 } },
      },
      to: { pieceId: 'card-case-pocket', shapeIds: ['card-case-pocket-left'] },
      stitchSpacingMm: 3.5,
    },
    {
      id: 'seam-bottom',
      name: 'Bottom edge',
      from: { pieceId: 'card-case-back', shapeIds: ['card-case-back-bottom'] },
      to: { pieceId: 'card-case-pocket', shapeIds: ['card-case-pocket-bottom'] },
      stitchSpacingMm: 3.5,
    },
    {
      id: 'seam-right',
      name: 'Right edge',
      // back-right runs top to bottom, so the pocket's stretch is the far end.
      from: {
        pieceId: 'card-case-back',
        shapeIds: ['card-case-back-right'],
        portions: { 'card-case-back-right': { t0: 23 / 70, t1: 1 } },
      },
      to: { pieceId: 'card-case-pocket', shapeIds: ['card-case-pocket-right'] },
      stitchSpacingMm: 3.5,
    },
  ],
}

// ── Boxed Pouch ─────────────────────────────────────────────────────────────
// The case the old one-edge-to-one-edge model could not express. The gusset is
// a single strip that runs up one side of a panel, across its base and down the
// far side: one seam over three boundary shapes, not three unrelated seams.

const pouchFrontLayer = layer('pouch-front', 'Front Panel', 0)
const pouchBackLayer = layer('pouch-back', 'Back Panel', 1)
const pouchGussetLayer = layer('pouch-gusset', 'Gusset Strip', 2)

const pouchSpec: PatternSpec = {
  id: 'boxed-pouch',
  label: 'Boxed Zip Pouch',
  layers: [pouchFrontLayer, pouchBackLayer, pouchGussetLayer],
  shapes: [
    ...panel('pouch-front', pouchFrontLayer.id, -200, -120, -40, -10),
    ...panel('pouch-back', pouchBackLayer.id, 40, -120, 200, -10),
    // 110 up + 160 across + 110 down = 380mm of gusset, 60mm deep.
    ...panel('pouch-gusset', pouchGussetLayer.id, -190, 40, 190, 100),
    guideLabel('pouch-front-label', pouchFrontLayer.id, -190, -127, 'Front 160x110'),
    guideLabel('pouch-back-label', pouchBackLayer.id, 50, -127, 'Back 160x110'),
    guideLabel('pouch-gusset-label', pouchGussetLayer.id, -180, 33, 'Gusset 380x60 (110 + 160 + 110)'),
  ],
  pieces: [
    { id: 'pouch-front', name: 'Front Panel', boundaryShapeId: 'pouch-front-top', layerId: pouchFrontLayer.id, code: 'A', color: '#a8663a' },
    { id: 'pouch-back', name: 'Back Panel', boundaryShapeId: 'pouch-back-top', layerId: pouchBackLayer.id, code: 'B', color: '#96562f' },
    {
      id: 'pouch-gusset',
      name: 'Gusset Strip',
      boundaryShapeId: 'pouch-gusset-top',
      layerId: pouchGussetLayer.id,
      code: 'C',
      color: '#c98d54',
      notes: 'One strip: 110mm side, 160mm base, 110mm side.',
    },
  ],
  seams: [
    {
      id: 'seam-front-gusset',
      name: 'Front to gusset',
      from: { pieceId: 'pouch-front', shapeIds: ['pouch-front-left', 'pouch-front-bottom', 'pouch-front-right'] },
      to: { pieceId: 'pouch-gusset', shapeIds: ['pouch-gusset-top'] },
      stitchSpacingMm: 4,
    },
    {
      id: 'seam-back-gusset',
      name: 'Back to gusset',
      from: { pieceId: 'pouch-back', shapeIds: ['pouch-back-left', 'pouch-back-bottom', 'pouch-back-right'] },
      to: { pieceId: 'pouch-gusset', shapeIds: ['pouch-gusset-bottom'] },
      stitchSpacingMm: 4,
    },
  ],
}

// ── Dice Cup ────────────────────────────────────────────────────────────────
// A straight side sewn to a circle. The base boundary is four quarter arcs, so
// its side of the seam is a couple of hundred sampled edges — the case an
// edge-index reference could not name at all.

const cupWallLayer = layer('dice-cup-wall', 'Cup Wall', 0)
const cupBaseLayer = layer('dice-cup-base', 'Cup Base', 1)

const CUP_RADIUS_MM = 35
const CUP_CIRCUMFERENCE_MM = Math.round(2 * Math.PI * CUP_RADIUS_MM)

const diceCupSpec: PatternSpec = {
  id: 'dice-cup',
  label: 'Round Dice Cup',
  layers: [cupWallLayer, cupBaseLayer],
  shapes: [
    ...panel('dice-cup-wall', cupWallLayer.id, -CUP_CIRCUMFERENCE_MM / 2, -110, CUP_CIRCUMFERENCE_MM / 2, -20),
    ...circle('dice-cup-base', cupBaseLayer.id, 0, 60, CUP_RADIUS_MM),
    guideLabel('dice-cup-wall-label', cupWallLayer.id, -CUP_CIRCUMFERENCE_MM / 2, -117, `Wall ${CUP_CIRCUMFERENCE_MM}x90 (unrolled)`),
    guideLabel('dice-cup-base-label', cupBaseLayer.id, -30, 110, `Base r${CUP_RADIUS_MM}`),
  ],
  pieces: [
    { id: 'dice-cup-wall', name: 'Cup Wall', boundaryShapeId: 'dice-cup-wall-top', layerId: cupWallLayer.id, code: 'A', color: '#9a6a3c' },
    { id: 'dice-cup-base', name: 'Cup Base', boundaryShapeId: 'dice-cup-base-q1', layerId: cupBaseLayer.id, code: 'B', color: '#7d5228' },
  ],
  seams: [
    {
      id: 'seam-wall-closure',
      name: 'Wall butt seam',
      from: { pieceId: 'dice-cup-wall', shapeIds: ['dice-cup-wall-left'] },
      to: { pieceId: 'dice-cup-wall', shapeIds: ['dice-cup-wall-right'] },
      // A butt seam joins a piece to itself; both sides run the same way.
      reversed: false,
      stitchSpacingMm: 4,
    },
    {
      id: 'seam-wall-base',
      name: 'Wall to base',
      from: { pieceId: 'dice-cup-wall', shapeIds: ['dice-cup-wall-bottom'] },
      to: {
        pieceId: 'dice-cup-base',
        shapeIds: ['dice-cup-base-q1', 'dice-cup-base-q2', 'dice-cup-base-q3', 'dice-cup-base-q4'],
      },
      stitchSpacingMm: 4,
    },
  ],
}

// ── Tote Bag ────────────────────────────────────────────────────────────────
// Five pieces and a deliberate sewing order: sides, then base, then handles.
// Sequence numbers come from the seam's position in this list.

const toteFrontLayer = layer('tote-front', 'Front Panel', 0)
const toteBackLayer = layer('tote-back', 'Back Panel', 1)
const toteBaseLayer = layer('tote-base', 'Base Panel', 2)
const toteHandleLayer = layer('tote-handles', 'Handles', 3)

const toteSpec: PatternSpec = {
  id: 'tote-bag',
  label: 'Tote Bag',
  layers: [toteFrontLayer, toteBackLayer, toteBaseLayer, toteHandleLayer],
  shapes: [
    ...panel('tote-front', toteFrontLayer.id, -260, -180, -80, 20),
    ...panel('tote-back', toteBackLayer.id, 80, -180, 260, 20),
    ...panel('tote-base', toteBaseLayer.id, -90, 70, 90, 150),
    ...panel('tote-handle-left', toteHandleLayer.id, -260, 190, -20, 215),
    ...panel('tote-handle-right', toteHandleLayer.id, 20, 190, 260, 215),
    guideLabel('tote-front-label', toteFrontLayer.id, -250, -187, 'Front 180x200'),
    guideLabel('tote-back-label', toteBackLayer.id, 90, -187, 'Back 180x200'),
    guideLabel('tote-base-label', toteBaseLayer.id, -80, 63, 'Base 180x80'),
    guideLabel('tote-handle-label', toteHandleLayer.id, -250, 183, 'Handles 240x25, cut 2'),
  ],
  pieces: [
    { id: 'tote-front', name: 'Front Panel', boundaryShapeId: 'tote-front-top', layerId: toteFrontLayer.id, code: 'A', color: '#a97244' },
    { id: 'tote-back', name: 'Back Panel', boundaryShapeId: 'tote-back-top', layerId: toteBackLayer.id, code: 'B', color: '#96602f' },
    { id: 'tote-base', name: 'Base Panel', boundaryShapeId: 'tote-base-top', layerId: toteBaseLayer.id, code: 'C', color: '#7a4b25' },
    { id: 'tote-handle-left', name: 'Left Handle', boundaryShapeId: 'tote-handle-left-top', layerId: toteHandleLayer.id, code: 'D', color: '#c99259' },
    { id: 'tote-handle-right', name: 'Right Handle', boundaryShapeId: 'tote-handle-right-top', layerId: toteHandleLayer.id, code: 'E', color: '#c99259' },
  ],
  seams: [
    {
      id: 'seam-side-left',
      name: 'Left side seam',
      from: { pieceId: 'tote-front', shapeIds: ['tote-front-left'] },
      to: { pieceId: 'tote-back', shapeIds: ['tote-back-right'] },
    },
    {
      id: 'seam-side-right',
      name: 'Right side seam',
      from: { pieceId: 'tote-front', shapeIds: ['tote-front-right'] },
      to: { pieceId: 'tote-back', shapeIds: ['tote-back-left'] },
    },
    {
      id: 'seam-base-front',
      name: 'Base to front',
      from: { pieceId: 'tote-front', shapeIds: ['tote-front-bottom'] },
      to: { pieceId: 'tote-base', shapeIds: ['tote-base-top'] },
    },
    {
      id: 'seam-base-back',
      name: 'Base to back',
      from: { pieceId: 'tote-back', shapeIds: ['tote-back-bottom'] },
      to: { pieceId: 'tote-base', shapeIds: ['tote-base-bottom'] },
    },
    // A handle is tacked down at each end, not stitched along its whole length,
    // so each attachment is a partial span on both sides: 36mm of the 240mm
    // handle onto 36mm of the 180mm panel top.
    {
      id: 'seam-handle-front-left',
      name: 'Front handle, left tab',
      from: {
        pieceId: 'tote-handle-left',
        shapeIds: ['tote-handle-left-bottom'],
        portions: { 'tote-handle-left-bottom': { t0: 0, t1: 36 / 240 } },
      },
      to: {
        pieceId: 'tote-front',
        shapeIds: ['tote-front-top'],
        portions: { 'tote-front-top': { t0: 18 / 180, t1: 54 / 180 } },
      },
      stitchSpacingMm: 5,
    },
    {
      id: 'seam-handle-front-right',
      name: 'Front handle, right tab',
      from: {
        pieceId: 'tote-handle-left',
        shapeIds: ['tote-handle-left-bottom'],
        portions: { 'tote-handle-left-bottom': { t0: 204 / 240, t1: 1 } },
      },
      to: {
        pieceId: 'tote-front',
        shapeIds: ['tote-front-top'],
        portions: { 'tote-front-top': { t0: 126 / 180, t1: 162 / 180 } },
      },
      stitchSpacingMm: 5,
    },
    {
      id: 'seam-handle-back-left',
      name: 'Back handle, left tab',
      from: {
        pieceId: 'tote-handle-right',
        shapeIds: ['tote-handle-right-bottom'],
        portions: { 'tote-handle-right-bottom': { t0: 0, t1: 36 / 240 } },
      },
      to: {
        pieceId: 'tote-back',
        shapeIds: ['tote-back-top'],
        portions: { 'tote-back-top': { t0: 18 / 180, t1: 54 / 180 } },
      },
      stitchSpacingMm: 5,
    },
    {
      id: 'seam-handle-back-right',
      name: 'Back handle, right tab',
      from: {
        pieceId: 'tote-handle-right',
        shapeIds: ['tote-handle-right-bottom'],
        portions: { 'tote-handle-right-bottom': { t0: 204 / 240, t1: 1 } },
      },
      to: {
        pieceId: 'tote-back',
        shapeIds: ['tote-back-top'],
        portions: { 'tote-back-top': { t0: 126 / 180, t1: 162 / 180 } },
      },
      stitchSpacingMm: 5,
    },
  ],
}

export const SEAMED_PATTERN_SPECS: PatternSpec[] = [cardCaseSpec, pouchSpec, diceCupSpec, toteSpec]

export const SEAMED_PATTERN_PRESETS = SEAMED_PATTERN_SPECS.map((spec) => ({
  id: spec.id,
  label: spec.label,
  doc: buildPatternDoc(spec),
}))

export { buildPatternDoc }
export type { PatternSpec }
