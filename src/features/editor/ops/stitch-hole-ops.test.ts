import { describe, expect, it } from 'vitest'
import type { LineType, Shape, StitchHoleDefaults } from '../cad/cad-types'
import {
  findNearestStitchAnchor,
  generateFixedPitchStitchHoles,
} from './stitch-hole-ops'

const lineTypesById: Record<string, LineType> = {
  cut: {
    id: 'cut',
    name: 'Cut',
    role: 'cut',
    style: 'solid',
    color: '#000000',
    visible: true,
  },
  stitch: {
    id: 'stitch',
    name: 'Stitch',
    role: 'stitch',
    style: 'solid',
    color: '#00ff00',
    visible: true,
  },
}

function lineShape(id: string, lineTypeId: string, y: number): Shape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId,
    start: { x: 0, y },
    end: { x: 100, y },
  }
}

const stitchDefaults: StitchHoleDefaults = {
  holeType: 'round',
  diameterMm: 1.2,
}

describe('findNearestStitchAnchor', () => {
  it('falls back to non-stitch geometry when enabled', () => {
    const anchor = findNearestStitchAnchor(
      { x: 40, y: 2 },
      [lineShape('cut-line', 'cut', 0)],
      lineTypesById,
      10,
      { allowNonStitchShapes: true },
    )

    expect(anchor?.shapeId).toBe('cut-line')
    expect(anchor?.point.x).toBe(40)
    expect(anchor?.point.y).toBe(0)
  })

  it('still prefers stitch geometry over other nearby shapes', () => {
    const anchor = findNearestStitchAnchor(
      { x: 40, y: 1.5 },
      [lineShape('cut-line', 'cut', 0), lineShape('stitch-line', 'stitch', 2)],
      lineTypesById,
      10,
      { allowNonStitchShapes: true },
    )

    expect(anchor?.shapeId).toBe('stitch-line')
    expect(anchor?.point.x).toBe(40)
    expect(anchor?.point.y).toBe(2)
  })
})

describe('generateFixedPitchStitchHoles', () => {
  it('can force fit the last hole to the path end', () => {
    const line = lineShape('stitch-line', 'stitch', 0)

    const strict = generateFixedPitchStitchHoles(line, 30, stitchDefaults)
    const forceFit = generateFixedPitchStitchHoles(line, 30, stitchDefaults, 0, {
      forceFitLastHole: true,
    })

    expect(strict).toHaveLength(5)
    expect(strict.at(-1)?.point.x).toBe(100)
    expect(forceFit).toHaveLength(4)
    expect(forceFit.at(-1)?.point.x).toBe(100)
    expect(forceFit[1]?.point.x).toBeCloseTo(100 / 3, 3)
  })

  it('supports continuation from a selected point without duplicating the start hole', () => {
    const line = lineShape('stitch-line', 'stitch', 0)

    const continued = generateFixedPitchStitchHoles(line, 20, stitchDefaults, 2, {
      forceFitLastHole: true,
      startDistanceMm: 40,
      includeStartHole: false,
    })

    expect(continued.map((hole) => hole.sequence)).toEqual([2, 3, 4])
    expect(continued.map((hole) => hole.point.x)).toEqual([60, 80, 100])
  })
})
