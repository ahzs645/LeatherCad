import { describe, expect, it } from 'vitest'
import { createDistanceConstraint, stepXpbdLite, type XpbdParticleState } from './xpbd-lite'

describe('xpbd lite', () => {
  it('projects a distance constraint toward its rest length', () => {
    const state: XpbdParticleState = {
      positions: new Float32Array([0, 0, 0, 4, 0, 0]),
      previousPositions: new Float32Array([0, 0, 0, 4, 0, 0]),
      velocities: new Float32Array(6),
      inverseMasses: new Float32Array([1, 1]),
    }
    const constraint = createDistanceConstraint({ a: 0, b: 1, restLength: 2, compliance: 0 })

    stepXpbdLite(state, [constraint], {
      dt: 1 / 60,
      substeps: 1,
      iterations: 4,
      damping: 1,
    })

    const distance = Math.hypot(
      state.positions[0] - state.positions[3],
      state.positions[1] - state.positions[4],
      state.positions[2] - state.positions[5],
    )
    expect(distance).toBeCloseTo(2, 4)
  })
})
