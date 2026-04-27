import type { DocFile, FoldLine, Layer, Shape } from '../cad/cad-types'
import {
  CUT_LINE_TYPE_ID,
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  GUIDE_LINE_TYPE_ID,
  STITCH_LINE_TYPE_ID,
  createDefaultLineTypes,
} from '../cad/line-types'

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
const walletCapacityGuideLayer = makeLayer('wallet-capacity-guides', 'Bill and Card Clearance Guides', 0)
const walletBillPocketLayer = makeLayer('wallet-bill-pocket', 'Bill Pocket Liner', 1)
const walletLeftPocketLayer = makeLayer('wallet-left-pocket', 'Left Card Pocket Stack', 2)
const walletRightPocketLayer = makeLayer('wallet-right-pocket', 'Right Card Pocket Stack', 2)

const walletLayers: Layer[] = [
  walletShellLayer,
  walletCapacityGuideLayer,
  walletBillPocketLayer,
  walletLeftPocketLayer,
  walletRightPocketLayer,
]

const walletShapes: Shape[] = [
  ...rectangle('shell-outline', walletShellLayer.id, -116, -48, 116, 48),
  line('shell-left-stitch', walletShellLayer.id, -108, -38, -108, 38, STITCH_LINE_TYPE_ID),
  line('shell-bottom-stitch', walletShellLayer.id, -108, 38, 108, 38, STITCH_LINE_TYPE_ID),
  line('shell-right-stitch', walletShellLayer.id, 108, 38, 108, -38, STITCH_LINE_TYPE_ID),
  line('shell-center-crease-mark', walletShellLayer.id, 0, -48, 0, 48, GUIDE_LINE_TYPE_ID),

  ...rectangle('bill-clearance-reference', walletCapacityGuideLayer.id, -78, -36, 78, 36, GUIDE_LINE_TYPE_ID),
  ...rectangle('left-card-clearance-reference', walletCapacityGuideLayer.id, -101.8, -27, -16.2, 27, GUIDE_LINE_TYPE_ID),
  ...rectangle('right-card-clearance-reference', walletCapacityGuideLayer.id, 16.2, -27, 101.8, 27, GUIDE_LINE_TYPE_ID),

  ...rectangle('bill-liner-outline', walletBillPocketLayer.id, -110, -40, 110, 44),
  line('bill-liner-left-stitch', walletBillPocketLayer.id, -102, -32, -102, 36, STITCH_LINE_TYPE_ID),
  line('bill-liner-bottom-stitch', walletBillPocketLayer.id, -102, 36, 102, 36, STITCH_LINE_TYPE_ID),
  line('bill-liner-right-stitch', walletBillPocketLayer.id, 102, 36, 102, -32, STITCH_LINE_TYPE_ID),
  line('bill-liner-center-crease-mark', walletBillPocketLayer.id, 0, -40, 0, 44, GUIDE_LINE_TYPE_ID),

  line('left-pocket-left', walletLeftPocketLayer.id, -108, -34, -108, 43),
  line('left-pocket-bottom', walletLeftPocketLayer.id, -108, 43, -8, 43),
  line('left-pocket-right', walletLeftPocketLayer.id, -8, 43, -8, -34),
  arc('left-pocket-thumb-cutout', walletLeftPocketLayer.id, -8, -34, -58, -50, -108, -34),
  bezier('left-card-slot-upper', walletLeftPocketLayer.id, -100, -12, -58, -24, -16, -12),
  bezier('left-card-slot-lower', walletLeftPocketLayer.id, -100, 10, -58, -2, -16, 10),
  line('left-pocket-stitch-left', walletLeftPocketLayer.id, -100, -24, -100, 35, STITCH_LINE_TYPE_ID),
  line('left-pocket-stitch-right', walletLeftPocketLayer.id, -16, -24, -16, 35, STITCH_LINE_TYPE_ID),
  line('left-pocket-stitch-bottom', walletLeftPocketLayer.id, -100, 35, -16, 35, STITCH_LINE_TYPE_ID),

  line('right-pocket-left', walletRightPocketLayer.id, 8, -34, 8, 43),
  line('right-pocket-bottom', walletRightPocketLayer.id, 8, 43, 108, 43),
  line('right-pocket-right', walletRightPocketLayer.id, 108, 43, 108, -34),
  arc('right-pocket-thumb-cutout', walletRightPocketLayer.id, 108, -34, 58, -50, 8, -34),
  bezier('right-card-slot-upper', walletRightPocketLayer.id, 16, -12, 58, -24, 100, -12),
  bezier('right-card-slot-lower', walletRightPocketLayer.id, 16, 10, 58, -2, 100, 10),
  line('right-pocket-stitch-left', walletRightPocketLayer.id, 16, -24, 16, 35, STITCH_LINE_TYPE_ID),
  line('right-pocket-stitch-right', walletRightPocketLayer.id, 100, -24, 100, 35, STITCH_LINE_TYPE_ID),
  line('right-pocket-stitch-bottom', walletRightPocketLayer.id, 16, 35, 100, 35, STITCH_LINE_TYPE_ID),
]

const walletFolds: FoldLine[] = [
  {
    id: 'wallet-center-fold',
    name: 'Wallet Center Fold',
    start: { x: 0, y: -48 },
    end: { x: 0, y: 48 },
    angleDeg: 138,
    maxAngleDeg: 180,
    direction: 'mountain',
    radiusMm: 2.4,
    thicknessMm: 1.8,
    neutralAxisRatio: 0.5,
    stiffness: 0.38,
    clearanceMm: 3.2,
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
    direction: 'mountain',
    radiusMm: 0.8,
    thicknessMm: 1.3,
    neutralAxisRatio: 0.45,
    stiffness: 0.22,
    clearanceMm: 0.15,
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
    direction: 'mountain',
    radiusMm: 1.2,
    thicknessMm: 1.6,
    neutralAxisRatio: 0.5,
    stiffness: 0.3,
    clearanceMm: 0.2,
  },
  {
    id: 'tri-fold-right',
    name: 'Tri-Fold Right',
    start: { x: 100, y: -118 },
    end: { x: 100, y: 118 },
    angleDeg: 28,
    maxAngleDeg: 180,
    direction: 'valley',
    radiusMm: 1.2,
    thicknessMm: 1.6,
    neutralAxisRatio: 0.5,
    stiffness: 0.3,
    clearanceMm: 0.2,
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
