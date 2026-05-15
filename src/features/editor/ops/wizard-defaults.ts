import type {
  BoxJointParams,
  CapPatternParams,
  DiceCupParams,
  JigsawParams,
  PassCaseParams,
  WatchStrapParams,
  WizardType,
} from './wizard-types'

export function getDefaultWizardParams(type: 'watch-strap'): WatchStrapParams
export function getDefaultWizardParams(type: 'pass-case'): PassCaseParams
export function getDefaultWizardParams(type: 'box-joint'): BoxJointParams
export function getDefaultWizardParams(type: 'jigsaw'): JigsawParams
export function getDefaultWizardParams(type: 'dice-cup'): DiceCupParams
export function getDefaultWizardParams(type: 'cap-pattern'): CapPatternParams
export function getDefaultWizardParams(
  type: WizardType,
): WatchStrapParams | PassCaseParams | BoxJointParams | JigsawParams | DiceCupParams | CapPatternParams {
  switch (type) {
    case 'watch-strap':
      return {
        totalLength: 220,
        watchLength: 44,
        wristCircumference: 170,
        lugInnerWidth: 22,
        buckleInnerWidth: 20,
        buckleLength: 18,
        width: 22,
        buckleEndWidth: 18,
        taperLength: 30,
        holeCount: 5,
        holeSpacing: 8,
        holeStartOffset: 35,
        holeDiameter: 2.5,
        tipShape: 'pointed',
        keeperWidth: 12,
        layerId: '',
        lineTypeId: '',
      }
    case 'pass-case':
      return {
        cardWidth: 86,
        cardHeight: 54,
        sourceWidth: 100,
        sourceHeight: 70,
        stitchPitchMm: 4,
        stitchSpaceMm: 5,
        margin: 5,
        cornerRadius: 3,
        flapHeight: 0,
        pocketCount: 1,
        layerId: '',
        lineTypeId: '',
      }
    case 'box-joint':
      return {
        length: 100,
        width: 80,
        height: 50,
        materialThickness: 2,
        lidMode: 'none',
        grooveDepthMm: 1,
        grooveOffsetMm: 4,
        kerfCompensationMm: 0,
        pinOverhangMm: 0,
        bottomOffsetMm: 0,
        sameThickness: true,
        frontThicknessMm: 2,
        backThicknessMm: 2,
        leftThicknessMm: 2,
        rightThicknessMm: 2,
        bottomThicknessMm: 2,
        lidThicknessMm: 2,
        fingerCount: 3,
        layerId: '',
        lineTypeId: '',
      }
    case 'jigsaw':
      return {
        columns: 3,
        rows: 3,
        pieceSize: 40,
        tabDepth: 8,
        tabWidth: 12,
        randomSeed: 1,
        randomizeTabs: false,
        flatEdges: true,
        flattenPath: false,
        layerId: '',
        lineTypeId: '',
      }
    case 'dice-cup':
      return {
        topDiameter: 70,
        bottomDiameter: 50,
        height: 90,
        segments: 4,
        includeBottom: true,
        layerId: '',
        lineTypeId: '',
      }
    case 'cap-pattern':
      return {
        panelCount: 6,
        crownHeightMM: 99,
        panelGapMM: 10,
        seamMM: 5,
        crownBulge: 6,
        baseSmile: 4,
        brimDepthMM: 70,
        brimWidthMM: 180,
        brimBackRiseMM: 8,
        layerId: '',
        lineTypeId: '',
      }
  }
}
