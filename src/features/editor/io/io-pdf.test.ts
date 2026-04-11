import { describe, expect, it } from 'vitest'
import type { LineShape, StitchHole } from '../cad/cad-types'
import { buildPdfFromShapes } from './io-pdf'

function makeLineShape(overrides: Partial<LineShape> = {}): LineShape {
  return {
    id: 'line-1',
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'lt-1',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    ...overrides,
  }
}

function makeStitchHole(overrides: Partial<StitchHole> = {}): StitchHole {
  return {
    id: 'hole-1',
    shapeId: 'line-1',
    point: { x: 5, y: 0 },
    angleDeg: 0,
    holeType: 'round',
    sequence: 0,
    diameterMm: 1.4,
    renderShape: 'round',
    ...overrides,
  }
}

describe('buildPdfFromShapes', () => {
  it('includes stitch holes in the exported PDF stream', () => {
    const pdf = buildPdfFromShapes([makeLineShape()], {
      lineTypeColors: { 'lt-1': '#000000' },
      stitchHoles: [makeStitchHole()],
      stitchHoleRenderMode: 'dots',
      stitchDotRadiusMm: 0.7,
    })

    expect(pdf).toContain('%PDF-1.4')
    expect(pdf).toMatch(/\n0\.000 0\.000 0\.000 rg\n/)
    expect(pdf).toMatch(/\nf\n/)
  })
})
