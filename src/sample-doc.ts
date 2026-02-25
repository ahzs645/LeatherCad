import type { DocFile, FoldLine, Layer, Shape } from './cad-types'
import {
  CUT_LINE_TYPE_ID,
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  STITCH_LINE_TYPE_ID,
  createDefaultLineTypes,
} from './line-types'

type PresetDefinition = {
  id: string
  label: string
  doc: DocFile
}

function makeLayer(id: string, name: string, stackLevel = 0): Layer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    stackLevel,
  }
}

function line(id: string, layerId: string, x1: number, y1: number, x2: number, y2: number, lineTypeId = CUT_LINE_TYPE_ID): Shape {
  return {
    id,
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  }
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

function bezier(
  id: string,
  layerId: string,
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  ex: number,
  ey: number,
  lineTypeId = CUT_LINE_TYPE_ID,
): Shape {
  return {
    id,
    type: 'bezier',
    layerId,
    lineTypeId,
    start: { x: sx, y: sy },
    control: { x: cx, y: cy },
    end: { x: ex, y: ey },
  }
}

function rectangle(
  idPrefix: string,
  layerId: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  lineTypeId = CUT_LINE_TYPE_ID,
): Shape[] {
  return [
    line(`${idPrefix}-top`, layerId, minX, minY, maxX, minY, lineTypeId),
    line(`${idPrefix}-right`, layerId, maxX, minY, maxX, maxY, lineTypeId),
    line(`${idPrefix}-bottom`, layerId, maxX, maxY, minX, maxY, lineTypeId),
    line(`${idPrefix}-left`, layerId, minX, maxY, minX, minY, lineTypeId),
  ]
}

function stitchBox(idPrefix: string, layerId: string, minX: number, minY: number, maxX: number, maxY: number, inset: number): Shape[] {
  return rectangle(idPrefix, layerId, minX + inset, minY + inset, maxX - inset, maxY - inset, STITCH_LINE_TYPE_ID)
}

function buildDoc(
  name: string,
  layers: Layer[],
  shapes: Shape[],
  foldLines: FoldLine[],
  activeLayerId = layers[0]?.id ?? 'layer-1',
): DocFile {
  return {
    version: 1,
    units: 'mm',
    layers,
    activeLayerId,
    lineTypes: createDefaultLineTypes(),
    activeLineTypeId: DEFAULT_ACTIVE_LINE_TYPE_ID,
    objects: shapes.map((shape) => ({
      ...shape,
      id: `${name}-${shape.id}`,
    })),
    foldLines: foldLines.map((foldLine) => ({
      ...foldLine,
      id: `${name}-${foldLine.id}`,
      name: foldLine.name,
    })),
  }
}

const walletShellLayer = makeLayer('wallet-shell', 'Outer Shell', 0)
const walletLeftPocketLayer = makeLayer('wallet-left-pocket', 'Left Pocket', 1)
const walletRightPocketLayer = makeLayer('wallet-right-pocket', 'Right Pocket', 1)

const walletLayers: Layer[] = [walletShellLayer, walletLeftPocketLayer, walletRightPocketLayer]

const walletShapes: Shape[] = [
  ...rectangle('shell-outline', walletShellLayer.id, -220, -140, 220, 140),
  ...stitchBox('shell-stitch', walletShellLayer.id, -220, -140, 220, 140, 16),
  line('shell-center-seam', walletShellLayer.id, 0, -140, 0, 140),

  ...rectangle('left-pocket-outline', walletLeftPocketLayer.id, -206, -106, -8, 120),
  arc('left-pocket-mouth', walletLeftPocketLayer.id, -194, 86, -107, 40, -20, 86),
  bezier('left-card-slot', walletLeftPocketLayer.id, -188, -50, -106, -88, -24, -50),
  line('left-card-divider', walletLeftPocketLayer.id, -98, -48, -98, 84),
  line('left-pocket-stitch-left', walletLeftPocketLayer.id, -194, -92, -194, 106, STITCH_LINE_TYPE_ID),
  line('left-pocket-stitch-right', walletLeftPocketLayer.id, -20, -92, -20, 106, STITCH_LINE_TYPE_ID),
  line('left-pocket-stitch-bottom', walletLeftPocketLayer.id, -194, 106, -20, 106, STITCH_LINE_TYPE_ID),

  ...rectangle('right-pocket-outline', walletRightPocketLayer.id, 8, -106, 206, 120),
  arc('right-pocket-mouth', walletRightPocketLayer.id, 20, 86, 107, 40, 194, 86),
  bezier('right-card-slot', walletRightPocketLayer.id, 24, -50, 106, -88, 188, -50),
  line('right-card-divider', walletRightPocketLayer.id, 98, -48, 98, 84),
  line('right-pocket-stitch-left', walletRightPocketLayer.id, 20, -92, 20, 106, STITCH_LINE_TYPE_ID),
  line('right-pocket-stitch-right', walletRightPocketLayer.id, 194, -92, 194, 106, STITCH_LINE_TYPE_ID),
  line('right-pocket-stitch-bottom', walletRightPocketLayer.id, 20, 106, 194, 106, STITCH_LINE_TYPE_ID),
]

const walletFolds: FoldLine[] = [
  {
    id: 'wallet-center-fold',
    name: 'Wallet Center Fold',
    start: { x: 0, y: -140 },
    end: { x: 0, y: 140 },
    angleDeg: 58,
    maxAngleDeg: 180,
  },
]

const sleeveBackLayer = makeLayer('sleeve-back', 'Sleeve Back', 0)
const sleeveFrontLayer = makeLayer('sleeve-front', 'Sleeve Front Pocket', 1)

const cardSleeveLayers: Layer[] = [sleeveBackLayer, sleeveFrontLayer]

const cardSleeveShapes: Shape[] = [
  ...rectangle('sleeve-back-outline', sleeveBackLayer.id, -164, -102, 164, 102),
  ...stitchBox('sleeve-back-stitch', sleeveBackLayer.id, -164, -102, 164, 102, 14),

  line('sleeve-front-left', sleeveFrontLayer.id, -150, -84, -150, 98),
  line('sleeve-front-right', sleeveFrontLayer.id, 150, -84, 150, 98),
  line('sleeve-front-bottom', sleeveFrontLayer.id, 150, 98, -150, 98),
  arc('sleeve-thumb-cutout', sleeveFrontLayer.id, -58, -84, 0, -126, 58, -84),
  line('sleeve-front-stitch-left', sleeveFrontLayer.id, -138, -72, -138, 86, STITCH_LINE_TYPE_ID),
  line('sleeve-front-stitch-right', sleeveFrontLayer.id, 138, -72, 138, 86, STITCH_LINE_TYPE_ID),
  line('sleeve-front-stitch-bottom', sleeveFrontLayer.id, 138, 86, -138, 86, STITCH_LINE_TYPE_ID),
]

const cardSleeveFolds: FoldLine[] = [
  {
    id: 'sleeve-crease',
    name: 'Optional Crease',
    start: { x: 0, y: -102 },
    end: { x: 0, y: 102 },
    angleDeg: 16,
    maxAngleDeg: 120,
  },
]

const triCenterLayer = makeLayer('tri-center', 'Center Body', 0)
const triLeftFlapLayer = makeLayer('tri-left-flap', 'Left Flap', 1)
const triRightFlapLayer = makeLayer('tri-right-flap', 'Right Flap', 1)

const triFoldLayers: Layer[] = [triCenterLayer, triLeftFlapLayer, triRightFlapLayer]

const triFoldShapes: Shape[] = [
  ...rectangle('tri-center-outline', triCenterLayer.id, -110, -118, 110, 118),
  ...stitchBox('tri-center-stitch', triCenterLayer.id, -110, -118, 110, 118, 12),

  ...rectangle('tri-left-outline', triLeftFlapLayer.id, -302, -118, -100, 118),
  line('tri-left-window', triLeftFlapLayer.id, -196, -118, -196, 118),
  arc('tri-left-id-cut', triLeftFlapLayer.id, -286, 48, -202, 12, -118, 48),
  ...stitchBox('tri-left-stitch', triLeftFlapLayer.id, -302, -118, -100, 118, 12),

  ...rectangle('tri-right-outline', triRightFlapLayer.id, 100, -118, 302, 118),
  line('tri-right-window', triRightFlapLayer.id, 196, -118, 196, 118),
  arc('tri-right-id-cut', triRightFlapLayer.id, 118, 48, 202, 12, 286, 48),
  ...stitchBox('tri-right-stitch', triRightFlapLayer.id, 100, -118, 302, 118, 12),
]

const triFoldFolds: FoldLine[] = [
  {
    id: 'tri-fold-left',
    name: 'Tri-Fold Left',
    start: { x: -100, y: -118 },
    end: { x: -100, y: 118 },
    angleDeg: 32,
    maxAngleDeg: 180,
  },
  {
    id: 'tri-fold-right',
    name: 'Tri-Fold Right',
    start: { x: 100, y: -118 },
    end: { x: 100, y: 118 },
    angleDeg: 28,
    maxAngleDeg: 180,
  },
]

export const PRESET_DOCS: PresetDefinition[] = [
  {
    id: 'wallet',
    label: 'Wallet',
    doc: buildDoc('wallet', walletLayers, walletShapes, walletFolds, walletShellLayer.id),
  },
  {
    id: 'card-sleeve',
    label: 'Card Sleeve',
    doc: buildDoc('card-sleeve', cardSleeveLayers, cardSleeveShapes, cardSleeveFolds, sleeveBackLayer.id),
  },
  {
    id: 'trifold',
    label: 'Tri-fold Layout',
    doc: buildDoc('trifold', triFoldLayers, triFoldShapes, triFoldFolds, triCenterLayer.id),
  },
]

export const DEFAULT_PRESET_ID = PRESET_DOCS[0].id
