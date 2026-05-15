import type { Shape } from '../cad/cad-types'

export type WizardType = 'watch-strap' | 'pass-case' | 'box-joint' | 'jigsaw' | 'dice-cup' | 'cap-pattern'

export type WatchStrapParams = {
  totalLength: number
  watchLength?: number
  wristCircumference?: number
  lugInnerWidth?: number
  buckleInnerWidth?: number
  buckleLength?: number
  width: number
  buckleEndWidth: number
  taperLength: number
  holeCount: number
  holeSpacing: number
  holeStartOffset: number
  holeDiameter: number
  tipShape: 'pointed' | 'round' | 'square'
  keeperWidth: number
  layerId: string
  lineTypeId: string
}

export type PassCaseParams = {
  compactSourceMode?: boolean
  cardWidth: number
  cardHeight: number
  sourceWidth?: number
  sourceHeight?: number
  stitchPitchMm?: number
  stitchSpaceMm?: number
  margin: number
  cornerRadius: number
  flapHeight: number
  pocketCount: number
  layerId: string
  lineTypeId: string
}

export type BoxJointParams = {
  length: number
  width: number
  height: number
  materialThickness: number
  boxMode?: 'closed' | 'open'
  lidMode?: 'none' | 'drop-in' | 'sliding'
  pinWidthMm?: number
  grooveDepthMm?: number
  grooveOffsetMm?: number
  kerfCompensationMm?: number
  pinOverhangMm?: number
  bottomOffsetMm?: number
  sameThickness?: boolean
  frontThicknessMm?: number
  backThicknessMm?: number
  leftThicknessMm?: number
  rightThicknessMm?: number
  bottomThicknessMm?: number
  lidThicknessMm?: number
  fingerCount: number
  layerId: string
  lineTypeId: string
}

export type JigsawParams = {
  columns: number
  rows: number
  pieceSize: number
  tabDepth: number
  tabWidth: number
  randomSeed?: number
  randomizeTabs?: boolean
  flatEdges?: boolean
  flattenPath?: boolean
  layerId: string
  lineTypeId: string
}

export type DiceCupParams = {
  topDiameter: number
  bottomDiameter: number
  height: number
  segments: number
  includeBottom: boolean
  leatherThickness?: number
  compensationFactor?: number
  stitchOffsetBottomRim?: number
  stitchOffsetTopRim?: number
  stitchOffsetSide?: number
  stitchOffsetBottomDisc?: number
  stitchTopRim?: boolean
  layerId: string
  lineTypeId: string
}

export type CapPatternParams = {
  panelCount?: number
  crownHeightMM?: number
  panelGapMM?: number
  seamMM: number
  crownBulge: number
  baseSmile: number
  brimDepthMM: number
  brimWidthMM: number
  brimBackRiseMM: number
  layerId: string
  lineTypeId: string
}

export type WizardResult = {
  shapes: Shape[]
  description: string
}
