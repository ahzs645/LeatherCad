import { describe, expect, it } from 'vitest'
import type { StitchHole } from '../cad/cad-types'
import { getDefaultStitchSimulatorSettings, simulateStitches } from './stitch-simulator-ops'

function createHole(index: number): StitchHole {
  return {
    id: `hole-${index}`,
    shapeId: 'shape-1',
    point: { x: index * 10, y: 0 },
    angleDeg: 90,
    holeType: 'round',
    sequence: index,
    diameterMm: 1.2,
  }
}

describe('simulateStitches', () => {
  it('respects a persisted stitch end hole on the path', () => {
    const holes = [createHole(0), createHole(1), createHole(2), createHole(3)]
    holes[2] = {
      ...holes[2],
      endHole: true,
    }
    const result = simulateStitches(holes, {
      ...getDefaultStitchSimulatorSettings(),
      stitchType: 'running',
    })

    expect(result.holeCount).toBe(3)
    expect(result.terminalHoleId).toBe('hole-2')
    expect(result.segments).toHaveLength(2)
    expect(result.segments.map((segment) => segment.to.x)).toEqual([10, 20])
  })

  it('truncates each stitch path independently when multiple shapes have terminal holes', () => {
    const holes = [
      createHole(0),
      createHole(1),
      createHole(2),
      { ...createHole(10), id: 'hole-b0', shapeId: 'shape-2', sequence: 0, point: { x: 0, y: 20 } },
      { ...createHole(11), id: 'hole-b1', shapeId: 'shape-2', sequence: 1, point: { x: 10, y: 20 }, endHole: true },
      { ...createHole(12), id: 'hole-b2', shapeId: 'shape-2', sequence: 2, point: { x: 20, y: 20 } },
    ]
    holes[1] = {
      ...holes[1],
      endHole: true,
    }

    const result = simulateStitches(holes, {
      ...getDefaultStitchSimulatorSettings(),
      stitchType: 'running',
    })

    expect(result.holeCount).toBe(4)
    expect(result.segments).toHaveLength(2)
    expect(result.segments.map((segment) => `${segment.from.y}-${segment.to.y}`)).toEqual(['0-0', '20-20'])
  })

  it('filters back and even stitches independently', () => {
    const holes = [createHole(0), createHole(1), createHole(2)]
    const result = simulateStitches(holes, {
      ...getDefaultStitchSimulatorSettings(),
      stitchType: 'saddle',
      showBackStitches: false,
      showEvenStitches: false,
      showOddStitches: true,
    })

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.parity).toBe('odd')
    expect(result.segments[0]?.side).toBe('front')
  })
})
