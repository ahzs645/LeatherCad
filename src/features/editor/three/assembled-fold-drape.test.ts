import { describe, expect, it } from 'vitest'
import type { Point } from '../cad/cad-types'
import { solveFoldDrape, type DrapeFoldInput } from './assembled-fold-drape'

const SQUARE: Point[] = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 40 },
  { x: 0, y: 40 },
]

/** The fixture crease: y = 20 across the square, the y < 20 half swinging. */
function fold(overrides: Partial<DrapeFoldInput> = {}): DrapeFoldInput {
  return {
    foldLineId: 'fold-1',
    start: { x: 0, y: 20 },
    end: { x: 40, y: 20 },
    angleDeg: 90,
    bendRadiusMm: 3,
    swingSample: { x: 20, y: 10 },
    ...overrides,
  }
}

function solve(overrides: Partial<DrapeFoldInput> = {}) {
  const result = solveFoldDrape({
    outer: SQUARE,
    holes: [],
    folds: [fold(overrides)],
    thicknessMm: 2,
  })
  expect(result).not.toBeNull()
  return result!
}

describe('solveFoldDrape', () => {
  it('folds the way the rigid hinge convention folds', () => {
    // The pivot chain rotates by the document's signed angle about the
    // authored crease direction: with the flap on the crease's document-right
    // — this fixture — a valley (positive) fold carries it down and a
    // mountain (negative) fold carries it up. The drape must agree, or
    // dialling a fold would flip the model the day the solver ships.
    const valley = solve({ angleDeg: 90 })
    expect(valley.mapPoint({ x: 20, y: 2 }).y).toBeLessThan(-5)
    const mountain = solve({ angleDeg: -90 })
    expect(mountain.mapPoint({ x: 20, y: 2 }).y).toBeGreaterThan(5)
  })

  it('keeps the staying half where it lay', () => {
    const result = solve()
    for (const point of [
      { x: 5, y: 35 },
      { x: 35, y: 30 },
      { x: 20, y: 38 },
    ]) {
      const solved = result.mapPoint(point)
      expect(solved.x).toBeCloseTo(point.x, 0)
      expect(Math.abs(solved.y)).toBeLessThan(0.5)
      expect(solved.z).toBeCloseTo(point.y, 0)
    }
  })

  it('bends the leather instead of stretching it', () => {
    const result = solve({ angleDeg: 180 })
    // A chord along the flap, from its root to its tip: folding may only
    // shorten it (the surface curls), never grow it.
    const near = result.mapPoint({ x: 20, y: 16 })
    const far = result.mapPoint({ x: 20, y: 2 })
    const chord = Math.hypot(far.x - near.x, far.y - near.y, far.z - near.z)
    expect(chord).toBeLessThanOrEqual(14 * 1.05)
    expect(chord).toBeGreaterThan(3)
  })

  it('lands a full fold a bend diameter clear of the half that stays', () => {
    const radius = 4
    const result = solveFoldDrape({
      outer: SQUARE,
      holes: [],
      folds: [fold({ angleDeg: -180, bendRadiusMm: radius })],
      thicknessMm: 2,
    })
    expect(result).not.toBeNull()
    // Mountain 180: the flap lies back over the base, lifted by the bend.
    const tip = result!.mapPoint({ x: 20, y: 2 })
    expect(tip.y).toBeGreaterThan(radius)
    expect(tip.y).toBeLessThan(4 * radius)
    expect(tip.z).toBeGreaterThan(20)
  })

  it('drapes over an obstacle it is not sewn to', () => {
    // A slab parked over the base, taller than the fold's own bend diameter,
    // not attached to anything. The analytic fold cannot know it is there;
    // the drape lands on it.
    const obstacleTop = 14
    const obstacle = {
      positions: [
        5, obstacleTop, 22, 35, obstacleTop, 22, 5, obstacleTop, 38, 35, obstacleTop, 38,
        5, 0, 22, 35, 0, 22,
      ],
      triangles: [0, 1, 3, 0, 3, 2, 4, 1, 0, 4, 5, 1],
    }
    const through = solveFoldDrape({
      outer: SQUARE, holes: [], folds: [fold({ angleDeg: -180, bendRadiusMm: 3 })], thicknessMm: 2,
    })
    const draped = solveFoldDrape({
      outer: SQUARE, holes: [], folds: [fold({ angleDeg: -180, bendRadiusMm: 3 })], thicknessMm: 2,
      obstacles: [obstacle],
    })
    expect(through).not.toBeNull()
    expect(draped).not.toBeNull()
    // The wall stands right past the crease, so the near flap tents against
    // it; the flap's far end has to ride up and over the top.
    const tip = { x: 20, y: 2 }
    expect(through!.mapPoint(tip).y).toBeLessThan(obstacleTop - 4)
    expect(draped!.mapPoint(tip).y).toBeGreaterThan(obstacleTop - 1)
    expect(draped!.mapPoint(tip).y).toBeGreaterThan(through!.mapPoint(tip).y + 4)
  })

  it('returns null when there is nothing to fold', () => {
    expect(
      solveFoldDrape({ outer: SQUARE, holes: [], folds: [], thicknessMm: 2 }),
    ).toBeNull()
    expect(
      solveFoldDrape({
        outer: SQUARE,
        holes: [],
        folds: [fold({ angleDeg: 0 })],
        thicknessMm: 2,
      }),
    ).toBeNull()
  })
})
