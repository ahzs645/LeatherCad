import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createDefaultLineTypes, CUT_LINE_TYPE_ID } from '../src/features/editor/cad/line-types'
import type { DocFile, Layer, Shape } from '../src/features/editor/cad/cad-types'
import { exportLccDocument } from '../src/features/editor/io/io-lcc'
import { generateLetterStampPreview } from '../src/features/editor/ops/letter-stamp-ops'
import {
  generateBoxJoint,
  generateCapPattern,
  generateDiceCup,
  generateJigsaw,
  generatePassCase,
  generateWatchStrap,
} from '../src/features/editor/ops/wizard-ops'

const outDir = join(process.cwd(), 'docs/fixtures/source-app-parity/generator-golden')
mkdirSync(outDir, { recursive: true })

const layer: Layer = {
  id: 'layer-1',
  name: 'Pattern',
  visible: true,
  locked: false,
}

function doc(name: string, objects: Shape[]): DocFile {
  const lineTypes = createDefaultLineTypes()
  return {
    version: 1,
    units: 'mm',
    documentName: name,
    layers: [layer],
    activeLayerId: layer.id,
    lineTypes,
    activeLineTypeId: CUT_LINE_TYPE_ID,
    objects,
    foldLines: [],
    stitchHoles: [],
    printAreas: [{ id: 'print-1', offsetX: 0, offsetY: 0, widthMm: 210, heightMm: 297, scalePercent: 100 }],
  }
}

function writeFixture(name: string, objects: Shape[]) {
  writeFileSync(join(outDir, `${name}.lcc`), exportLccDocument(doc(name, objects)))
}

const base = { layerId: layer.id, lineTypeId: CUT_LINE_TYPE_ID }

writeFixture('watch-band-golden', generateWatchStrap({
  ...base,
  totalLength: 220,
  watchLength: 44,
  wristCircumference: 170,
  lugInnerWidth: 22,
  buckleInnerWidth: 20,
  buckleLength: 18,
  width: 22,
  buckleEndWidth: 18,
  taperLength: 30,
  holeCount: 7,
  holeSpacing: 7,
  holeStartOffset: 55,
  holeDiameter: 2.5,
  tipShape: 'pointed',
  keeperWidth: 12,
}).shapes)

writeFixture('pass-case-golden', generatePassCase({
  ...base,
  cardWidth: 86,
  cardHeight: 54,
  sourceWidth: 100,
  sourceHeight: 70,
  stitchPitchMm: 4,
  stitchSpaceMm: 5,
  margin: 5,
  cornerRadius: 3,
  flapHeight: 0,
  pocketCount: 2,
}).shapes)

writeFixture('box-joint-golden', generateBoxJoint({
  ...base,
  length: 100,
  width: 80,
  height: 50,
  materialThickness: 2,
  lidMode: 'sliding',
  grooveDepthMm: 1,
  grooveOffsetMm: 4,
  kerfCompensationMm: 0.2,
  pinOverhangMm: 2,
  bottomOffsetMm: 1,
  sameThickness: false,
  frontThicknessMm: 2,
  backThicknessMm: 2.5,
  leftThicknessMm: 2,
  rightThicknessMm: 2.5,
  bottomThicknessMm: 3,
  lidThicknessMm: 1.5,
  fingerCount: 3,
}).shapes)

writeFixture('jigsaw-golden', generateJigsaw({
  ...base,
  columns: 4,
  rows: 3,
  pieceSize: 30,
  tabDepth: 8,
  tabWidth: 12,
  randomSeed: 42,
  randomizeTabs: true,
  flatEdges: true,
  flattenPath: true,
}).shapes)

writeFixture('dice-cup-golden', generateDiceCup({
  ...base,
  topDiameter: 70,
  bottomDiameter: 50,
  height: 90,
  segments: 6,
  includeBottom: true,
  leatherThickness: 2,
  compensationFactor: 0.5,
  stitchOffsetBottomRim: 5,
  stitchOffsetTopRim: 5,
  stitchOffsetSide: 4,
  stitchOffsetBottomDisc: 5,
  stitchTopRim: true,
}).shapes)

writeFixture('cap-pattern-golden', generateCapPattern({
  ...base,
  panelCount: 6,
  crownHeightMM: 99,
  panelGapMM: 10,
  seamMM: 5,
  crownBulge: 6,
  baseSmile: 4,
  brimDepthMM: 70,
  brimWidthMM: 180,
  brimBackRiseMM: 8,
}).shapes)

const letterStamp = generateLetterStampPreview({
  text: 'ABC\n123',
  stampSizeMm: 10,
  spacingMm: 2,
  lineSpacingMm: 4,
  alignment: 'center',
  baselineAngleDeg: 0,
  origin: { x: 0, y: 0 },
  fontFamily: 'Inter',
  layerId: layer.id,
  lineTypeId: CUT_LINE_TYPE_ID,
})
writeFixture('letter-stamp-golden', [...letterStamp.guideLines, ...letterStamp.textShapes])
