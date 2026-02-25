import type { DocFile, FoldLine, Layer, Shape } from './cad-types'

type PresetDefinition = {
  id: string
  label: string
  doc: DocFile
}

const DEFAULT_PATTERN_LAYER: Layer = {
  id: 'layer-pattern',
  name: 'Pattern',
  visible: true,
  locked: false,
}

const DEFAULT_STITCH_LAYER: Layer = {
  id: 'layer-stitch-guides',
  name: 'Stitch Guides',
  visible: true,
  locked: false,
}

function buildDoc(name: string, patternShapes: Shape[], stitchShapes: Shape[], foldLines: FoldLine[]): DocFile {
  return {
    version: 1,
    units: 'mm',
    layers: [
      {
        ...DEFAULT_PATTERN_LAYER,
      },
      {
        ...DEFAULT_STITCH_LAYER,
      },
    ],
    activeLayerId: DEFAULT_PATTERN_LAYER.id,
    objects: [...patternShapes, ...stitchShapes].map((shape) => ({
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

const walletPattern: Shape[] = [
  {
    id: 'outline-top',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -220, y: -140 },
    end: { x: 220, y: -140 },
  },
  {
    id: 'outline-right',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 220, y: -140 },
    end: { x: 220, y: 140 },
  },
  {
    id: 'outline-bottom',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 220, y: 140 },
    end: { x: -220, y: 140 },
  },
  {
    id: 'outline-left',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -220, y: 140 },
    end: { x: -220, y: -140 },
  },
  {
    id: 'left-slot-top',
    type: 'bezier',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -200, y: -50 },
    control: { x: -112, y: -92 },
    end: { x: -20, y: -50 },
  },
  {
    id: 'right-slot-top',
    type: 'bezier',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 20, y: -50 },
    control: { x: 112, y: -92 },
    end: { x: 200, y: -50 },
  },
  {
    id: 'left-pocket-mouth',
    type: 'arc',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -198, y: 86 },
    mid: { x: -110, y: 34 },
    end: { x: -22, y: 86 },
  },
  {
    id: 'right-pocket-mouth',
    type: 'arc',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 22, y: 86 },
    mid: { x: 110, y: 34 },
    end: { x: 198, y: 86 },
  },
  {
    id: 'card-divider-left',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -96, y: -50 },
    end: { x: -96, y: 96 },
  },
  {
    id: 'card-divider-right',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 96, y: -50 },
    end: { x: 96, y: 96 },
  },
]

const walletStitch: Shape[] = [
  {
    id: 'stitch-guide-top',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: -200, y: -122 },
    end: { x: 200, y: -122 },
  },
  {
    id: 'stitch-guide-right',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: 200, y: -122 },
    end: { x: 200, y: 122 },
  },
  {
    id: 'stitch-guide-bottom',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: 200, y: 122 },
    end: { x: -200, y: 122 },
  },
  {
    id: 'stitch-guide-left',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: -200, y: 122 },
    end: { x: -200, y: -122 },
  },
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

const cardSleevePattern: Shape[] = [
  {
    id: 'outline-top',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -150, y: -95 },
    end: { x: 150, y: -95 },
  },
  {
    id: 'outline-right',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 150, y: -95 },
    end: { x: 150, y: 95 },
  },
  {
    id: 'outline-bottom',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 150, y: 95 },
    end: { x: -150, y: 95 },
  },
  {
    id: 'outline-left',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -150, y: 95 },
    end: { x: -150, y: -95 },
  },
  {
    id: 'thumb-cutout',
    type: 'arc',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -54, y: 95 },
    mid: { x: 0, y: 56 },
    end: { x: 54, y: 95 },
  },
]

const cardSleeveStitch: Shape[] = [
  {
    id: 'stitch-guide-top',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: -130, y: -78 },
    end: { x: 130, y: -78 },
  },
  {
    id: 'stitch-guide-right',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: 130, y: -78 },
    end: { x: 130, y: 78 },
  },
  {
    id: 'stitch-guide-bottom',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: 130, y: 78 },
    end: { x: -130, y: 78 },
  },
  {
    id: 'stitch-guide-left',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: -130, y: 78 },
    end: { x: -130, y: -78 },
  },
]

const cardSleeveFolds: FoldLine[] = [
  {
    id: 'sleeve-crease',
    name: 'Optional Crease',
    start: { x: 0, y: -95 },
    end: { x: 0, y: 95 },
    angleDeg: 18,
    maxAngleDeg: 120,
  },
]

const triFoldPattern: Shape[] = [
  {
    id: 'outline-top',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -300, y: -120 },
    end: { x: 300, y: -120 },
  },
  {
    id: 'outline-right',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 300, y: -120 },
    end: { x: 300, y: 120 },
  },
  {
    id: 'outline-bottom',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 300, y: 120 },
    end: { x: -300, y: 120 },
  },
  {
    id: 'outline-left',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -300, y: 120 },
    end: { x: -300, y: -120 },
  },
  {
    id: 'window-left',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: -100, y: -120 },
    end: { x: -100, y: 120 },
  },
  {
    id: 'window-right',
    type: 'line',
    layerId: DEFAULT_PATTERN_LAYER.id,
    start: { x: 100, y: -120 },
    end: { x: 100, y: 120 },
  },
]

const triFoldStitch: Shape[] = [
  {
    id: 'stitch-guide-top',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: -280, y: -104 },
    end: { x: 280, y: -104 },
  },
  {
    id: 'stitch-guide-right',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: 280, y: -104 },
    end: { x: 280, y: 104 },
  },
  {
    id: 'stitch-guide-bottom',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: 280, y: 104 },
    end: { x: -280, y: 104 },
  },
  {
    id: 'stitch-guide-left',
    type: 'line',
    layerId: DEFAULT_STITCH_LAYER.id,
    start: { x: -280, y: 104 },
    end: { x: -280, y: -104 },
  },
]

const triFoldFolds: FoldLine[] = [
  {
    id: 'tri-fold-left',
    name: 'Tri-Fold Left',
    start: { x: -100, y: -120 },
    end: { x: -100, y: 120 },
    angleDeg: 32,
    maxAngleDeg: 180,
  },
  {
    id: 'tri-fold-right',
    name: 'Tri-Fold Right',
    start: { x: 100, y: -120 },
    end: { x: 100, y: 120 },
    angleDeg: 28,
    maxAngleDeg: 180,
  },
]

export const PRESET_DOCS: PresetDefinition[] = [
  {
    id: 'wallet',
    label: 'Wallet',
    doc: buildDoc('wallet', walletPattern, walletStitch, walletFolds),
  },
  {
    id: 'card-sleeve',
    label: 'Card Sleeve',
    doc: buildDoc('card-sleeve', cardSleevePattern, cardSleeveStitch, cardSleeveFolds),
  },
  {
    id: 'trifold',
    label: 'Tri-fold Layout',
    doc: buildDoc('trifold', triFoldPattern, triFoldStitch, triFoldFolds),
  },
]

export const DEFAULT_PRESET_ID = PRESET_DOCS[0].id
