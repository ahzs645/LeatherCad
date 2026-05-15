import { describe, expect, it } from 'vitest'
import type { Shape, StitchHoleDefaults } from '../cad/cad-types'
import { createBoxStitchFromSelection } from './advanced-box-stitch-ops'

const stitchHoleDefaults: StitchHoleDefaults = {
  holeType: 'round',
  diameterMm: 1,
}

function line(
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  extracted = false,
): Shape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'cut',
    ...(extracted ? { boxStitchSource: { extracted: true as const } } : {}),
    start,
    end,
  }
}

describe('createBoxStitchFromSelection', () => {
  it('prioritizes extracted box stitch sources over the broader selection bounds', () => {
    const shapes = [
      line('top-source', { x: 0, y: 0 }, { x: 100, y: 0 }, true),
      line('bottom-source', { x: 0, y: 40 }, { x: 100, y: 40 }, true),
      line('outer-top', { x: -40, y: -10 }, { x: 140, y: -10 }),
      line('outer-bottom', { x: -40, y: 50 }, { x: 140, y: 50 }),
    ]

    const result = createBoxStitchFromSelection(
      shapes,
      [],
      new Set(shapes.map((shape) => shape.id)),
      { distanceMm: 5, stretchCompensationPercent: 100 },
      'stitch',
      'layer-1',
      6,
      stitchHoleDefaults,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.message).toContain('extracted source')
    expect(result.guideLines[0]).toMatchObject({
      start: { x: 5, y: 5 },
      end: { x: 95, y: 5 },
    })
    expect(result.stitchHoles.length).toBeGreaterThan(0)
  })

  it('projects existing selected stitch holes onto generated guide paths before falling back to pitch', () => {
    const shapes = [
      line('top-source', { x: 0, y: 0 }, { x: 100, y: 0 }, true),
      line('bottom-source', { x: 0, y: 40 }, { x: 100, y: 40 }, true),
      line('left-source', { x: 0, y: 0 }, { x: 0, y: 40 }, true),
      line('right-source', { x: 100, y: 0 }, { x: 100, y: 40 }, true),
    ]

    const result = createBoxStitchFromSelection(
      shapes,
      [
        { id: 'h1', shapeId: 'top-source', point: { x: 10, y: 0 }, angleDeg: 0, holeType: 'round', sequence: 0 },
        { id: 'h2', shapeId: 'top-source', point: { x: 90, y: 0 }, angleDeg: 0, holeType: 'round', sequence: 1 },
      ],
      new Set(shapes.map((shape) => shape.id)),
      { distanceMm: 5, stretchCompensationPercent: 100 },
      'stitch',
      'layer-1',
      6,
      stitchHoleDefaults,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.stitchHoles).toHaveLength(8)
    expect(result.stitchHoles[0]).toMatchObject({ point: { x: 14, y: 5 } })
    expect(result.stitchHoles[1]).toMatchObject({ point: { x: 86, y: 5 } })
  })
})
