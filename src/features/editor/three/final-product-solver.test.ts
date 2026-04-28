import { describe, expect, it } from 'vitest'
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
  })
})
