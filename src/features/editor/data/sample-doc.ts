import type { DocFile, FoldLine, HardwareMarker, Layer, Shape } from '../cad/cad-types'
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

function text(
  id: string,
  layerId: string,
  x: number,
  y: number,
  value: string,
  fontSizeMm = 4,
): Shape {
  return {
    id,
    type: 'text',
    layerId,
    lineTypeId: GUIDE_LINE_TYPE_ID,
    start: { x, y },
    end: { x: x + Math.max(fontSizeMm, value.length * fontSizeMm * 0.62), y },
    text: value,
    fontFamily: 'Georgia, serif',
    fontSizeMm,
    transform: 'none',
    radiusMm: 40,
    sweepDeg: 140,
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

function withPresetStrokeWidth(shape: Shape): Shape {
  if (shape.type === 'text') {
    return shape
  }

  const strokeWidthOverride =
    shape.lineTypeId === STITCH_LINE_TYPE_ID
      ? 1.8
      : shape.lineTypeId === GUIDE_LINE_TYPE_ID
        ? 1.35
        : 2.2

  return { ...shape, strokeWidthOverride } as Shape
}

function buildDoc(
  name: string,
  layers: Layer[],
  shapes: Shape[],
  foldLines: FoldLine[],
  activeLayerId = layers[0]?.id ?? 'layer-1',
  hardwareMarkers: HardwareMarker[] = [],
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
    hardwareMarkers: hardwareMarkers.map((marker) => ({
      ...marker,
      id: `${name}-${marker.id}`,
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

const compactShellLayer = makeLayer('compact-shell', 'Outer Shell with Rounded Flap', 0)
const compactMoneyLayer = makeLayer('compact-money', 'Back Money Holder', 1)
const compactMiddleCardLayer = makeLayer('compact-middle-card', 'Middle Card Holder', 2)
const compactOutsideCardLayer = makeLayer('compact-outside-card', 'Outside Card Holder', 3)
const compactClaspLayer = makeLayer('compact-clasp', 'Clasp and Snap Hardware', 4)
const compactGuideLayer = makeLayer('compact-guides', 'Card and Cash Clearance Guides', 0)

const compactWalletLayers: Layer[] = [
  compactShellLayer,
  compactMoneyLayer,
  compactMiddleCardLayer,
  compactOutsideCardLayer,
  compactClaspLayer,
  compactGuideLayer,
]

const compactWalletShapes: Shape[] = [
  line('shell-left-edge', compactShellLayer.id, -46, -52, -46, 86),
  line('shell-bottom-edge', compactShellLayer.id, -46, 86, 46, 86),
  line('shell-right-edge', compactShellLayer.id, 46, 86, 46, -52),
  bezier('shell-flap-right-curve', compactShellLayer.id, 46, -52, 36, -82, 0, -86),
  bezier('shell-flap-left-curve', compactShellLayer.id, 0, -86, -36, -82, -46, -52),
  bezier('flap-lower-scallop-right', compactShellLayer.id, 44, -36, 30, -16, 0, -14, GUIDE_LINE_TYPE_ID),
  bezier('flap-lower-scallop-left', compactShellLayer.id, 0, -14, -30, -16, -44, -36, GUIDE_LINE_TYPE_ID),
  line('flap-fold-guide', compactShellLayer.id, -38, -50, 38, -50, GUIDE_LINE_TYPE_ID),
  line('shell-left-stitch', compactShellLayer.id, -39, -47, -39, 78, STITCH_LINE_TYPE_ID),
  line('shell-bottom-stitch', compactShellLayer.id, -39, 78, 39, 78, STITCH_LINE_TYPE_ID),
  line('shell-right-stitch', compactShellLayer.id, 39, 78, 39, -47, STITCH_LINE_TYPE_ID),
  bezier('flap-stitch-right', compactShellLayer.id, 37, -48, 29, -70, 0, -74, STITCH_LINE_TYPE_ID),
  bezier('flap-stitch-left', compactShellLayer.id, 0, -74, -29, -70, -37, -48, STITCH_LINE_TYPE_ID),

  line('money-left-edge', compactMoneyLayer.id, -41, -18, -41, 84),
  line('money-bottom-edge', compactMoneyLayer.id, -41, 84, 41, 84),
  line('money-right-edge', compactMoneyLayer.id, 41, 84, 41, -18),
  bezier('money-mouth-scoop', compactMoneyLayer.id, -41, -18, 0, 2, 41, -18),
  line('money-left-stitch', compactMoneyLayer.id, -36, -8, -36, 76, STITCH_LINE_TYPE_ID),
  line('money-bottom-stitch', compactMoneyLayer.id, -36, 76, 36, 76, STITCH_LINE_TYPE_ID),
  line('money-right-stitch', compactMoneyLayer.id, 36, 76, 36, -8, STITCH_LINE_TYPE_ID),
  text('money-label', compactMoneyLayer.id, 58, -2, 'Back cash sleeve', 12),

  line('middle-card-left-edge', compactMiddleCardLayer.id, -38, 4, -38, 52),
  line('middle-card-bottom-edge', compactMiddleCardLayer.id, -38, 52, 38, 52),
  line('middle-card-right-edge', compactMiddleCardLayer.id, 38, 52, 38, 4),
  bezier('middle-card-thumb-scoop', compactMiddleCardLayer.id, -38, 4, 0, 24, 38, 4),
  line('middle-card-left-stitch', compactMiddleCardLayer.id, -33, 12, -33, 47, STITCH_LINE_TYPE_ID),
  line('middle-card-bottom-stitch', compactMiddleCardLayer.id, -33, 47, 33, 47, STITCH_LINE_TYPE_ID),
  line('middle-card-right-stitch', compactMiddleCardLayer.id, 33, 47, 33, 12, STITCH_LINE_TYPE_ID),
  text('middle-card-label', compactMiddleCardLayer.id, 58, 24, 'Middle card', 12),

  line('outside-card-left-edge', compactOutsideCardLayer.id, -40, 36, -40, 84),
  line('outside-card-bottom-edge', compactOutsideCardLayer.id, -40, 84, 40, 84),
  line('outside-card-right-edge', compactOutsideCardLayer.id, 40, 84, 40, 36),
  bezier('outside-card-mouth-scoop', compactOutsideCardLayer.id, -40, 36, 0, 54, 40, 36),
  line('outside-card-left-stitch', compactOutsideCardLayer.id, -35, 44, -35, 78, STITCH_LINE_TYPE_ID),
  line('outside-card-bottom-stitch', compactOutsideCardLayer.id, -35, 78, 35, 78, STITCH_LINE_TYPE_ID),
  line('outside-card-right-stitch', compactOutsideCardLayer.id, 35, 78, 35, 44, STITCH_LINE_TYPE_ID),
  text('outside-card-label', compactOutsideCardLayer.id, 58, 50, 'Outside card', 12),

  bezier('clasp-visible-flap-edge-right', compactClaspLayer.id, 42, -37, 26, -21, 0, -20, GUIDE_LINE_TYPE_ID),
  bezier('clasp-visible-flap-edge-left', compactClaspLayer.id, 0, -20, -26, -21, -42, -37, GUIDE_LINE_TYPE_ID),
  line('snap-centerline', compactClaspLayer.id, 0, -70, 0, 42, GUIDE_LINE_TYPE_ID),
  text('clasp-label', compactClaspLayer.id, 58, -62, 'Snap clasp', 12),

  ...rectangle('card-clearance-front', compactGuideLayer.id, -42.8, 22, 42.8, 76, GUIDE_LINE_TYPE_ID),
  ...rectangle('card-clearance-middle', compactGuideLayer.id, -42.8, -4, 42.8, 50, GUIDE_LINE_TYPE_ID),
  ...rectangle('folded-cash-clearance', compactGuideLayer.id, -39, -28, 39, 50, GUIDE_LINE_TYPE_ID),
].map(withPresetStrokeWidth)

const compactWalletFolds: FoldLine[] = [
  {
    id: 'flap-fold',
    name: 'Rounded Clasp Flap Fold',
    start: { x: -38, y: -50 },
    end: { x: 38, y: -50 },
    angleDeg: 74,
    maxAngleDeg: 180,
    direction: 'mountain',
    radiusMm: 2,
    thicknessMm: 1.5,
    neutralAxisRatio: 0.5,
    stiffness: 0.32,
    clearanceMm: 1.5,
  },
  {
    id: 'front-pocket-crease',
    name: 'Front Pocket Flex Crease',
    start: { x: -38, y: 52 },
    end: { x: 38, y: 52 },
    angleDeg: 18,
    maxAngleDeg: 90,
    direction: 'valley',
    radiusMm: 1,
    thicknessMm: 1.2,
    neutralAxisRatio: 0.45,
    stiffness: 0.2,
    clearanceMm: 0.6,
  },
]

const compactWalletHardware: HardwareMarker[] = [
  {
    id: 'flap-snap-cap',
    layerId: compactClaspLayer.id,
    point: { x: 0, y: -62 },
    kind: 'snap',
    label: 'Flap snap cap',
    holeDiameterMm: 3.2,
    spacingMm: 0,
    notes: '',
    visible: true,
  },
  {
    id: 'body-snap-socket',
    layerId: compactClaspLayer.id,
    point: { x: 0, y: 28 },
    kind: 'snap',
    label: 'Body snap socket',
    holeDiameterMm: 3.2,
    spacingMm: 0,
    notes: '',
    visible: true,
  },
]

export const PRESET_DOCS: PresetDefinition[] = [
  {
    id: 'wallet',
    label: 'Wallet',
    doc: buildDoc('wallet', walletLayers, walletShapes, walletFolds, walletShellLayer.id),
  },
  {
    id: 'compact-clasp-wallet',
    label: 'Compact Clasp Wallet',
    doc: buildDoc(
      'compact-clasp-wallet',
      compactWalletLayers,
      compactWalletShapes,
      compactWalletFolds,
      compactShellLayer.id,
      compactWalletHardware,
    ),
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
