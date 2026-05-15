import { describe, expect, it } from 'vitest'
import {
  generateBoxJoint,
  generateCapPattern,
  generateJigsaw,
  generatePassCase,
  generateWatchStrap,
} from './wizard-ops'

const base = {
  layerId: 'layer-1',
  lineTypeId: 'line-1',
}

describe('source-app wizard parity controls', () => {
  it('uses watch hardware measurements when generating strap dimensions', () => {
    const result = generateWatchStrap({
      ...base,
      totalLength: 120,
      watchLength: 40,
      wristCircumference: 190,
      lugInnerWidth: 24,
      buckleInnerWidth: 20,
      buckleLength: 16,
      width: 22,
      buckleEndWidth: 18,
      taperLength: 30,
      holeCount: 3,
      holeSpacing: 6,
      holeStartOffset: 40,
      holeDiameter: 2,
      tipShape: 'square',
      keeperWidth: 10,
    })

    expect(result.description).toContain('174mm total')
    expect(result.description).toContain('24mm lug width')
    expect(result.description).toContain('20mm buckle width')
  })

  it('adds pass-case stitch pitch and stitch space controls to the generated output', () => {
    const result = generatePassCase({
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
      pocketCount: 1,
    })

    expect(result.description).toContain('pitch 4mm')
    expect(result.description).toContain('space 5mm')
    expect(result.shapes.length).toBeGreaterThan(80)
  })

  it('carries source-app box joint lid, groove, kerf, overhang, and independent thickness controls', () => {
    const result = generateBoxJoint({
      ...base,
      length: 100,
      width: 80,
      height: 50,
      materialThickness: 2,
      lidMode: 'sliding',
      grooveDepthMm: 1,
      grooveOffsetMm: 4,
      kerfCompensationMm: 0.5,
      pinOverhangMm: 3,
      bottomOffsetMm: 2,
      sameThickness: false,
      frontThicknessMm: 2,
      backThicknessMm: 2.5,
      leftThicknessMm: 3,
      rightThicknessMm: 3.5,
      bottomThicknessMm: 4,
      lidThicknessMm: 1.5,
      fingerCount: 3,
    })

    expect(result.description).toContain('lid sliding')
    expect(result.description).toContain('independent')
    expect(result.shapes.length).toBeGreaterThan(60)
  })

  it('makes randomized jigsaw generation deterministic by seed', () => {
    const params = {
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
    }

    const first = generateJigsaw(params)
    const second = generateJigsaw(params)
    const comparable = (shape: (typeof first.shapes)[number]) => {
      const rest = { ...shape } as Record<string, unknown>
      delete rest.id
      delete rest.groupId
      return rest
    }

    expect(first.shapes.map(comparable)).toEqual(second.shapes.map(comparable))
    expect(first.description).toContain('randomized seed 42')
  })

  it('uses flat-edge and flattened-path jigsaw controls in generated geometry', () => {
    const baseParams = {
      ...base,
      columns: 3,
      rows: 2,
      pieceSize: 30,
      tabDepth: 8,
      tabWidth: 12,
      randomSeed: 7,
      randomizeTabs: false,
    }

    const flat = generateJigsaw({ ...baseParams, flatEdges: true, flattenPath: false })
    const tabbed = generateJigsaw({ ...baseParams, flatEdges: false, flattenPath: false })
    const flattened = generateJigsaw({ ...baseParams, flatEdges: false, flattenPath: true })

    expect(tabbed.description).toContain('tabbed outer edges')
    expect(flattened.description).toContain('flattened path')
    expect(tabbed.shapes.length).toBeGreaterThan(flat.shapes.length)
    expect(flattened.shapes.length).toBeGreaterThan(tabbed.shapes.length)
  })

  it('carries explicit cap pattern control schema into generated geometry', () => {
    const result = generateCapPattern({
      ...base,
      panelCount: 8,
      crownHeightMM: 120,
      panelGapMM: 6,
      seamMM: 5,
      crownBulge: 8,
      baseSmile: 5,
      brimDepthMM: 75,
      brimWidthMM: 200,
      brimBackRiseMM: 10,
    })

    expect(result.description).toContain('8 crown panels')
    expect(result.description).toContain('height 120mm')
    expect(result.description).toContain('gap 6mm')
    expect(result.shapes).toHaveLength(28)
  })
})
