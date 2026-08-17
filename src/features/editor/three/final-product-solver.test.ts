import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { FoldLine, StitchHole } from '../cad/cad-types'
import { solveFinalProduct, solvePanelPoint } from './final-product-solver'

function foldLine(id: string, start: { x: number; y: number }, end: { x: number; y: number }, angleDeg = 180): FoldLine {
  return {
    id,
    name: id,
    start,
    end,
    angleDeg,
    maxAngleDeg: 180,
    direction: 'mountain',
  }
}

function chain(id: string, points: Array<{ x: number; y: number }>): StitchHole[] {
  return points.map((point, index) => ({
    id: `${id}-${index}`,
    shapeId: `${id}-shape-${index}`,
    chainId: id,
    point,
    angleDeg: 0,
    holeType: 'round',
    sequence: index,
  }))
}

function row(id: string, count: number, x: number, y: number, pitch = 3, reverse = false) {
  const points = Array.from({ length: count }, (_, index) => ({
    x: x + index * pitch,
    y,
  }))
  return chain(id, reverse ? points.reverse() : points)
}

function column(id: string, count: number, x: number, y: number, pitch = 3, reverse = false) {
  const points = Array.from({ length: count }, (_, index) => ({
    x,
    y: y + index * pitch,
  }))
  return chain(id, reverse ? points.reverse() : points)
}

const twoPanelOutline = [{
  layerId: 'layer-1',
  shapeIds: ['outline'],
  polygon: [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 10 },
    { x: 0, y: 10 },
  ],
}]

describe('final product solver', () => {
  it('converges a two-panel fold with paired stitch chains', () => {
    const result = solveFinalProduct({
      foldLines: [foldLine('center-fold', { x: 10, y: 0 }, { x: 10, y: 10 })],
      stitchHoles: [
        ...chain('left', [{ x: 5, y: 2 }, { x: 5, y: 5 }, { x: 5, y: 8 }]),
        ...chain('right', [{ x: 15, y: 8 }, { x: 15, y: 5 }, { x: 15, y: 2 }]),
      ],
      outlinePolygons: twoPanelOutline,
      documentBounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
    })

    expect(result.panels).toHaveLength(2)
    expect(result.hinges).toHaveLength(1)
    expect(result.stitchPairs).toHaveLength(1)
    expect(result.rmsStitchErrorMm).toBeLessThanOrEqual(0.25)
    expect(result.maxHingeErrorDeg).toBeLessThanOrEqual(1)
    expect(result.converged).toBe(true)
  })

  it('settles a four-pair sheath-style fixture', () => {
    const holes = [
      ...column('a7', 7, 10, 5),
      ...column('b7', 7, 50, 5, 3, true),
      ...row('c4', 4, 5, 22),
      ...row('d4', 4, 5, 38, 3, true),
      ...row('e4', 4, 46, 22),
      ...row('f4', 4, 46, 38, 3, true),
      ...column('g7', 7, 10, 37),
      ...column('h7', 7, 50, 37, 3, true),
    ]

    const result = solveFinalProduct({
      foldLines: [
        foldLine('vertical-fold', { x: 30, y: -10 }, { x: 30, y: 70 }, 180),
        foldLine('horizontal-fold', { x: -10, y: 30 }, { x: 70, y: 30 }, 180),
      ],
      stitchHoles: holes,
      outlinePolygons: [{
        layerId: 'layer-1',
        shapeIds: ['outline'],
        polygon: [
          { x: 0, y: 0 },
          { x: 60, y: 0 },
          { x: 60, y: 60 },
          { x: 0, y: 60 },
        ],
      }],
      documentBounds: { minX: 0, maxX: 60, minY: 0, maxY: 60 },
    })

    expect(result.panels).toHaveLength(4)
    expect(result.stitchPairs).toHaveLength(4)
    expect(result.unpairedChainCount).toBe(0)
    expect(result.rmsStitchErrorMm).toBeLessThan(0.25)
  })

  it('reports diagnostics for ambiguous stitch-chain fixtures', () => {
    const result = solveFinalProduct({
      foldLines: [foldLine('center-fold', { x: 10, y: 0 }, { x: 10, y: 30 }, 90)],
      stitchHoles: [
        ...row('a', 4, 0, 0),
        ...row('b', 4, 0, 10, 3, true),
        ...row('c', 4, 0, 20),
      ],
      outlinePolygons: [{
        layerId: 'layer-1',
        shapeIds: ['outline'],
        polygon: [
          { x: -5, y: -5 },
          { x: 25, y: -5 },
          { x: 25, y: 30 },
          { x: -5, y: 30 },
        ],
      }],
      documentBounds: { minX: -5, maxX: 25, minY: -5, maxY: 30 },
    })

    expect(result.converged).toBe(false)
    expect(result.stitchPairs).toHaveLength(0)
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'stitch-pair-ambiguous')).toBe(true)
    expect(result.unpairedChainCount).toBe(3)
  })

  it('does not report intended stacked panels as collisions', () => {
    const result = solveFinalProduct({
      foldLines: [foldLine('center-fold', { x: 10, y: 0 }, { x: 10, y: 10 }, 90)],
      stitchHoles: [],
      regions: [
        {
          layerId: 'outer',
          stackLevel: 0,
          polygon: twoPanelOutline[0].polygon,
        },
        {
          layerId: 'liner',
          stackLevel: 1,
          polygon: twoPanelOutline[0].polygon,
        },
      ],
      documentBounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
      thicknessMm: 1.8,
    })

    expect(result.hinges).toHaveLength(2)
    expect(result.collisionWarningCount).toBe(0)
    expect(result.panels.some((panel) => panel.offset.length() > 0)).toBe(true)
  })

  it('carries disconnected upper-stack panels with the folded lower panel they sit on', () => {
    const result = solveFinalProduct({
      foldLines: [foldLine('center-fold', { x: 10, y: 0 }, { x: 10, y: 10 }, 90)],
      stitchHoles: [],
      regions: [
        {
          layerId: 'outer',
          stackLevel: 0,
          polygon: twoPanelOutline[0].polygon,
        },
        {
          layerId: 'pocket',
          stackLevel: 1,
          polygon: [
            { x: 12, y: 2 },
            { x: 18, y: 2 },
            { x: 18, y: 8 },
            { x: 12, y: 8 },
          ],
        },
      ],
      documentBounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
      thicknessMm: 1.8,
    })

    const point = { x: 15, y: 5 }
    const pocket = result.panels.find((panel) => panel.layerId === 'pocket')
    const carrier = result.panels.find((panel) => panel.layerId === 'outer' && panel.polygon.some((entry) => entry.x > 10))
    expect(pocket).toBeTruthy()
    expect(carrier).toBeTruthy()

    const pocketPoint = solvePanelPoint(pocket!, point)
    const carrierPoint = solvePanelPoint(carrier!, point)
    expect(pocketPoint.distanceTo(carrierPoint)).toBeCloseTo(1.8, 6)
    const carrierNormal = new Vector3(0, 1, 0)
      .applyMatrix4(carrier!.transform)
      .sub(new Vector3(0, 0, 0).applyMatrix4(carrier!.transform))
      .normalize()
    expect(pocketPoint.clone().sub(carrierPoint).dot(carrierNormal)).toBeGreaterThan(0)
  })

  it('adds material clearance between closed base panels that fold onto each other', () => {
    const result = solveFinalProduct({
      foldLines: [foldLine('center-fold', { x: 10, y: 0 }, { x: 10, y: 10 }, 180)],
      stitchHoles: [],
      outlinePolygons: twoPanelOutline,
      documentBounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
      thicknessMm: 1.8,
    })

    const leftPanel = result.panels.find((panel) => panel.polygon.every((point) => point.x <= 10))
    const rightPanel = result.panels.find((panel) => panel.polygon.every((point) => point.x >= 10))
    expect(leftPanel).toBeTruthy()
    expect(rightPanel).toBeTruthy()

    const leftPoint = solvePanelPoint(leftPanel!, { x: 5, y: 5 })
    const rightPoint = solvePanelPoint(rightPanel!, { x: 15, y: 5 })
    expect(Math.abs(leftPoint.y - rightPoint.y)).toBeCloseTo(1.8, 6)
  })

  it('detects non-hinged panel clipping when panel volumes occupy the same space', () => {
    const result = solveFinalProduct({
      foldLines: [],
      stitchHoles: [],
      regions: [
        {
          layerId: 'left',
          stackLevel: 0,
          polygon: twoPanelOutline[0].polygon,
        },
        {
          layerId: 'right',
          stackLevel: 0,
          polygon: twoPanelOutline[0].polygon,
        },
      ],
      documentBounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
      thicknessMm: 1.8,
    })

    expect(result.collisionWarningCount).toBeGreaterThan(0)
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'panel-clearance-warning')).toBe(true)
  })

  describe('clearance stacking', () => {
    // Trifold-style strip: wide center panel (the BFS root) with a wing on
    // each side. Both wings fold 180° over the center.
    const stripOutline = [{
      layerId: 'layer-1',
      shapeIds: ['outline'],
      polygon: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 10 },
        { x: 0, y: 10 },
      ],
    }]
    const stripBounds = { minX: 0, maxX: 40, minY: 0, maxY: 10 }
    const leftFold = { ...foldLine('left-fold', { x: 10, y: 0 }, { x: 10, y: 10 }), direction: 'valley' as const }
    const rightFold = { ...foldLine('right-fold', { x: 30, y: 0 }, { x: 30, y: 10 }), direction: 'valley' as const }

    function solveStrip(foldOrderRank?: ReadonlyMap<string, number>) {
      const result = solveFinalProduct({
        foldLines: [leftFold, rightFold],
        stitchHoles: [],
        outlinePolygons: stripOutline,
        documentBounds: stripBounds,
        thicknessMm: 2,
        foldOrderRank,
      })
      const wingAt = (x: number) =>
        result.panels.find((panel) => panel.polygon.every((point) => (x < 20 ? point.x <= 10 : point.x >= 30)))!
      return { left: wingAt(0), right: wingAt(40) }
    }

    it('stacks the later-folded wing farther out when a timeline rank is given', () => {
      const { left, right } = solveStrip(new Map([
        ['right-fold', 1],
        ['left-fold', 2],
      ]))
      expect(Math.abs(right.offset.y)).toBeCloseTo(2, 6)
      expect(Math.abs(left.offset.y)).toBeCloseTo(4, 6)
    })

    it('inverts the stacking when the fold sequence is reversed', () => {
      const { left, right } = solveStrip(new Map([
        ['left-fold', 1],
        ['right-fold', 2],
      ]))
      expect(Math.abs(left.offset.y)).toBeCloseTo(2, 6)
      expect(Math.abs(right.offset.y)).toBeCloseTo(4, 6)
    })

    it('falls back to declaration order without a timeline rank', () => {
      const { left, right } = solveStrip()
      expect(Math.abs(left.offset.y)).toBeCloseTo(2, 6)
      expect(Math.abs(right.offset.y)).toBeCloseTo(4, 6)
    })

    it('clears an under-folding wing downward and an over-folding wing upward', () => {
      // The same wing folded mountain vs valley must clear on opposite sides,
      // and each side must match where the wing actually swings mid-fold.
      for (const direction of ['mountain', 'valley'] as const) {
        const fold = { ...foldLine('center-fold', { x: 10, y: 0 }, { x: 10, y: 10 }), direction }
        const solveAt = (angleDeg: number) => solveFinalProduct({
          foldLines: [{ ...fold, angleDeg }],
          stitchHoles: [],
          outlinePolygons: twoPanelOutline,
          documentBounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
          thicknessMm: 2,
        })
        // The BFS root keeps the identity transform; the wing is whichever
        // panel actually swings at the halfway pose.
        const centroidOf = (panel: { polygon: Array<{ x: number; y: number }> }) => ({
          x: panel.polygon.reduce((sum, point) => sum + point.x, 0) / panel.polygon.length,
          y: panel.polygon.reduce((sum, point) => sum + point.y, 0) / panel.polygon.length,
        })
        const halfwayResult = solveAt(90)
        const halfway = [...halfwayResult.panels].sort((left, right) =>
          Math.abs(solvePanelPoint(right, centroidOf(right)).y) - Math.abs(solvePanelPoint(left, centroidOf(left)).y),
        )[0]
        const swingY = solvePanelPoint(halfway, centroidOf(halfway)).y
        expect(Math.abs(swingY)).toBeGreaterThan(1)

        const closedResult = solveAt(180)
        const closed = closedResult.panels.find((panel) => panel.id === halfway.id)!
        expect(Math.sign(closed.offset.y)).toBe(Math.sign(swingY))
      }
    })
  })
})
