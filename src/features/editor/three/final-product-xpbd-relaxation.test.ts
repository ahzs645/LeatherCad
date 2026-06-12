import { Matrix4, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { FinalProductSolveResult, StitchChain } from './final-product-types'
import { relaxFinalProductSeamsWithXpbd } from './final-product-xpbd-relaxation'

function chain(id: string, x: number): StitchChain {
  const holes = [0, 1, 2].map((index) => ({
    id: `${id}-${index}`,
    shapeId: `${id}-shape-${index}`,
    chainId: id,
    point: { x, y: 2 + index * 2 },
    angleDeg: 0,
    holeType: 'round' as const,
    sequence: index,
  }))
  return {
    id,
    holes,
    pointCount: holes.length,
    pitchMm: 2,
    lengthMm: 4,
    start: holes[0].point,
    end: holes[2].point,
    direction: { x: 0, y: 1 },
    bounds: { minX: x, maxX: x, minY: 2, maxY: 6 },
    explicit: true,
  }
}

describe('final product XPBD relaxation', () => {
  it('relaxes paired seam holes toward zero weld distance', () => {
    const left = chain('left', 2)
    const right = chain('right', 12)
    const result: FinalProductSolveResult = {
      panels: [
        {
          id: 'left-panel',
          layerId: 'layer',
          polygon: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 }, { x: 0, y: 10 }],
          areaMm2: 50,
          transform: new Matrix4(),
          offset: new Vector3(),
        },
        {
          id: 'right-panel',
          layerId: 'layer',
          polygon: [{ x: 10, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 10 }, { x: 10, y: 10 }],
          areaMm2: 50,
          transform: new Matrix4(),
          offset: new Vector3(),
        },
      ],
      hinges: [],
      stitchChains: [left, right],
      stitchPairs: [{
        id: 'pair',
        left,
        right,
        reversed: false,
        score: 1,
        rmsErrorMm: 10,
        status: 'paired',
      }],
      diagnostics: [],
      iterations: 0,
      converged: false,
      rmsStitchErrorMm: 10,
      maxHingeErrorDeg: 0,
      collisionWarningCount: 0,
      foldSweepCollisionCount: 0,
      foldSweepSampleCount: 0,
      unpairedChainCount: 0,
    }

    const relaxation = relaxFinalProductSeamsWithXpbd(result)

    expect(relaxation).not.toBeNull()
    expect(relaxation?.constraintCount).toBe(3)
    expect(relaxation?.rmsBeforeMm).toBeCloseTo(10)
    expect(relaxation?.rmsAfterMm).toBeLessThan(0.01)
  })
})
