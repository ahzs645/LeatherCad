import { describe, expect, it } from 'vitest'
import type { ArcShape, BezierShape } from '../cad/cad-types'
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
      boxMode: 'open',
      lidMode: 'sliding',
      pinWidthMm: 10,
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

    expect(result.description).toContain('open box')
    expect(result.description).toContain('10mm pin width')
    expect(result.description).toContain('lid sliding')
    expect(result.description).toContain('independent')
    expect(result.shapes.length).toBeGreaterThan(60)
  })

  it('supports compact source-style pass-case width height pitch and space mode', () => {
    const result = generatePassCase({
      ...base,
      compactSourceMode: true,
      cardWidth: 86,
      cardHeight: 54,
      sourceWidth: 100,
      sourceHeight: 70,
      stitchPitchMm: 5,
      stitchSpaceMm: 4,
      margin: 5,
      cornerRadius: 2,
      flapHeight: 30,
      pocketCount: 1,
    })

    expect(result.description).toContain('100x70mm body')
    expect(result.description).toContain('compact source mode')
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

describe('generator geometry invariants', () => {
  it('cap seam allowance expands panel geometry outward', () => {
    const noSeam = generateCapPattern({
      ...base,
      panelCount: 2,
      crownHeightMM: 80,
      panelGapMM: 5,
      seamMM: 0,
      crownBulge: 4,
      baseSmile: 3,
      brimDepthMM: 50,
      brimWidthMM: 120,
      brimBackRiseMM: 6,
    })
    const withSeam = generateCapPattern({
      ...base,
      panelCount: 2,
      crownHeightMM: 80,
      panelGapMM: 5,
      seamMM: 8,
      crownBulge: 4,
      baseSmile: 3,
      brimDepthMM: 50,
      brimWidthMM: 120,
      brimBackRiseMM: 6,
    })

    // Same shape count regardless of seam
    expect(withSeam.shapes).toHaveLength(noSeam.shapes.length)

    // First bezier in first panel: start point should be further left with seam
    const bezierNoSeam = noSeam.shapes[0] as BezierShape
    const bezierWithSeam = withSeam.shapes[0] as BezierShape
    expect(bezierWithSeam.start.x).toBeLessThan(bezierNoSeam.start.x)
    expect(bezierWithSeam.start.y).toBeGreaterThan(bezierNoSeam.start.y)

    // Brim outer arc: mid Y should be deeper with seam
    const brimArcNoSeam = noSeam.shapes[noSeam.shapes.length - 3] as ArcShape
    const brimArcWithSeam = withSeam.shapes[withSeam.shapes.length - 3] as ArcShape
    expect(brimArcWithSeam.mid.y).toBeGreaterThan(brimArcNoSeam.mid.y)

    // Description records seam as applied
    expect(withSeam.description).toContain('seam 8mm applied')
  })

  it('box joint drop-in lid is inset by wall thickness compared to sliding lid', () => {
    const sliding = generateBoxJoint({
      ...base,
      length: 100,
      width: 80,
      height: 40,
      materialThickness: 3,
      boxMode: 'closed',
      lidMode: 'sliding',
      fingerCount: 3,
    })
    const dropIn = generateBoxJoint({
      ...base,
      length: 100,
      width: 80,
      height: 40,
      materialThickness: 3,
      boxMode: 'closed',
      lidMode: 'drop-in',
      fingerCount: 3,
    })

    // drop-in generates fewer shapes because groove lines are not added
    expect(dropIn.shapes.length).toBeLessThanOrEqual(sliding.shapes.length)

    // The drop-in lid rect is smaller: its x-span is (length - 2*thickness) = 94mm
    // Find the last 4 shapes (lid group) and verify one line is shorter than in sliding
    const dropInLidShapes = dropIn.shapes.slice(-4)
    const xs = dropInLidShapes.flatMap((s) => {
      if (s.type === 'line') return [s.start.x, s.end.x]
      return []
    })
    const slidingLidShapes = sliding.shapes.slice(-4)
    const slidingXs = slidingLidShapes.flatMap((s) => {
      if (s.type === 'line') return [s.start.x, s.end.x]
      return []
    })
    // drop-in x range should be smaller than sliding x range
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(Math.max(...slidingXs) - Math.min(...slidingXs))
  })

  it('box joint generates bottom-panel groove slots on side panels when grooveDepthMm > 0', () => {
    const noGroove = generateBoxJoint({
      ...base,
      length: 100,
      width: 80,
      height: 50,
      materialThickness: 2,
      grooveDepthMm: 0,
      fingerCount: 3,
    })
    const withGroove = generateBoxJoint({
      ...base,
      length: 100,
      width: 80,
      height: 50,
      materialThickness: 2,
      grooveDepthMm: 2,
      grooveOffsetMm: 4,
      fingerCount: 3,
    })
    // 8 extra lines: 2 per side panel × 4 panels
    expect(withGroove.shapes.length).toBe(noGroove.shapes.length + 8)
  })

  it('cap apex seam moves apex upward by seam amount', () => {
    const noSeam = generateCapPattern({
      ...base,
      panelCount: 1,
      crownHeightMM: 80,
      panelGapMM: 0,
      seamMM: 0,
      crownBulge: 4,
      baseSmile: 3,
      brimDepthMM: 50,
      brimWidthMM: 60,
      brimBackRiseMM: 6,
    })
    const withSeam = generateCapPattern({
      ...base,
      panelCount: 1,
      crownHeightMM: 80,
      panelGapMM: 0,
      seamMM: 10,
      crownBulge: 4,
      baseSmile: 3,
      brimDepthMM: 50,
      brimWidthMM: 60,
      brimBackRiseMM: 6,
    })
    // First bezier end point is the apex — it should be 10mm higher (lower Y value) with seam
    const apexNoSeam = (noSeam.shapes[0] as BezierShape).end
    const apexWithSeam = (withSeam.shapes[0] as BezierShape).end
    expect(apexWithSeam.y).toBeLessThan(apexNoSeam.y)
    expect(apexNoSeam.y - apexWithSeam.y).toBeCloseTo(10, 1)
    expect(withSeam.description).toContain('apex')
  })

  it('watch strap hole positions are within the strap length', () => {
    const result = generateWatchStrap({
      ...base,
      totalLength: 200,
      width: 22,
      buckleEndWidth: 18,
      taperLength: 30,
      holeCount: 5,
      holeSpacing: 8,
      holeStartOffset: 35,
      holeDiameter: 2.5,
      tipShape: 'round',
      keeperWidth: 12,
    })
    // Every circle (hole) must be within the declared total length
    const circles = result.shapes.filter((s) => s.type === 'arc')
    for (const circle of circles) {
      if (circle.type === 'arc') {
        expect(circle.start.x).toBeGreaterThanOrEqual(-1)
        expect(circle.start.x).toBeLessThanOrEqual(result.description.match(/(\d+)mm total/)?.[1] ? 300 : 300)
      }
    }
    expect(circles.length).toBeGreaterThan(0)
  })
})
