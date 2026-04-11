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
  it('respects an explicit stitch end hole', () => {
    const holes = [createHole(0), createHole(1), createHole(2), createHole(3)]
    const result = simulateStitches(holes, {
      ...getDefaultStitchSimulatorSettings(),
      stitchType: 'running',
      endHoleId: 'hole-2',
    })

    expect(result.holeCount).toBe(3)
    expect(result.terminalHoleId).toBe('hole-2')
    expect(result.segments).toHaveLength(2)
    expect(result.segments.map((segment) => segment.to.x)).toEqual([10, 20])
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
