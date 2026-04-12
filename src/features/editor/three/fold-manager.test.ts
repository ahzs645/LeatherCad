import { Vector2 } from 'three'
import { describe, expect, it } from 'vitest'
import { resolveFoldBehavior } from '../ops/fold-line-ops'
import { foldAxisFromLine, resolveSafeFoldAngle, ThreeFoldManager } from './fold-manager'

describe('foldAxisFromLine', () => {
  it('derives a normalized axis from the projected fold line', () => {
    const axis = foldAxisFromLine(new Vector2(2, 3), new Vector2(5, 7))

    expect(axis.length()).toBeCloseTo(1)
    expect(axis.x).toBeCloseTo(0.6)
    expect(axis.z).toBeCloseTo(0.8)
  })

  it('falls back to the default axis for a degenerate fold line', () => {
    const axis = foldAxisFromLine(new Vector2(1, 1), new Vector2(1, 1))

    expect(axis.x).toBe(0)
    expect(axis.y).toBe(0)
    expect(axis.z).toBe(1)
  })
})

describe('resolveSafeFoldAngle', () => {
  it('clamps the requested angle to the fold behavior max angle', () => {
    const behavior = resolveFoldBehavior({
      id: 'fold-1',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 10 },
      angleDeg: 20,
      maxAngleDeg: 45,
      direction: 'mountain',
    })
    let applied = 0

    const safeAngle = resolveSafeFoldAngle({
      targetAngleDeg: 120,
      behavior,
      applyTransform: (angleDeg) => {
        applied = angleDeg
      },
      hasCollision: () => false,
    })

    expect(safeAngle).toBe(45)
    expect(applied).toBe(45)
  })

  it('backs off to the nearest non-colliding angle', () => {
    const behavior = resolveFoldBehavior({
      id: 'fold-2',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 10 },
      angleDeg: 75,
      maxAngleDeg: 90,
      direction: 'mountain',
    })
    let currentCandidate = 0

    const safeAngle = resolveSafeFoldAngle({
      targetAngleDeg: 75,
      behavior,
      applyTransform: (angleDeg) => {
        currentCandidate = angleDeg
      },
      hasCollision: () => Math.abs(currentCandidate) > 30,
    })

    expect(safeAngle).toBe(30)
  })
})

describe('ThreeFoldManager', () => {
  it('tracks fold line defaults and clamps explicit angle updates', () => {
    const manager = new ThreeFoldManager()

    manager.syncFoldLine({
      id: 'fold-3',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 20 },
      angleDeg: 25,
      maxAngleDeg: 40,
      direction: 'valley',
    })
    manager.setAngle(80)

    expect(manager.behavior.maxAngleDeg).toBe(40)
    expect(manager.angleDeg).toBe(40)
  })
})
