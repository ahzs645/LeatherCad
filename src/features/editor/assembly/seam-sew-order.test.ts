import { describe, expect, it } from 'vitest'
import type { SeamConnection, StitchHole } from '../cad/cad-types'
import type { StitchChain, StitchPair } from '../three/final-product-types'
import { buildSeamSewPlan, resolveSewProgress, sewnFractionForSeam } from './seam-sew-order'

function seam(id: string, overrides: Partial<SeamConnection> = {}): SeamConnection {
  return {
    id,
    name: `Seam ${id}`,
    from: { pieceId: 'a', edgeIndex: 0 },
    to: { pieceId: 'b', edgeIndex: 0 },
    kind: 'sewn',
    ...overrides,
  }
}

function chain(connectionId: string, side: string, holeCount: number): StitchChain {
  const holes: StitchHole[] = Array.from({ length: holeCount }, (_, index) => ({
    id: `${connectionId}-${side}-${index}`,
    shapeId: `explicit-seam-${connectionId}`,
    chainId: `${connectionId}-${side}`,
    connectionId,
    point: { x: index, y: 0 },
    angleDeg: 0,
    holeType: 'round',
    sequence: index,
  }))
  return {
    id: `${connectionId}-${side}`,
    holes,
    pointCount: holeCount,
    pitchMm: 1,
    lengthMm: Math.max(0, holeCount - 1),
    start: { x: 0, y: 0 },
    end: { x: Math.max(0, holeCount - 1), y: 0 },
    direction: { x: 1, y: 0 },
    bounds: { minX: 0, maxX: Math.max(0, holeCount - 1), minY: 0, maxY: 0 },
    explicit: true,
  }
}

function pair(connectionId: string, holeCount: number): StitchPair {
  return {
    id: `explicit-stitch-pair-${connectionId}`,
    left: chain(connectionId, 'from', holeCount),
    right: chain(connectionId, 'to', holeCount),
    reversed: false,
    score: 1,
    rmsErrorMm: 0,
    status: 'paired',
  }
}

describe('buildSeamSewPlan', () => {
  it('lays the seams end to end on one stitch axis', () => {
    const plan = buildSeamSewPlan({
      seamConnections: [seam('one'), seam('two')],
      stitchPairs: [pair('one', 10), pair('two', 6)],
    })

    expect(plan.stitchCount).toBe(16)
    expect(plan.ranges).toEqual([
      { seamId: 'one', name: 'Seam one', start: 0, end: 10 },
      { seamId: 'two', name: 'Seam two', start: 10, end: 16 },
    ])
  })

  it('honours the authored sewing order rather than array order', () => {
    const plan = buildSeamSewPlan({
      seamConnections: [seam('late', { sequence: 2 }), seam('early', { sequence: 1 })],
      stitchPairs: [pair('late', 4), pair('early', 3)],
    })

    expect(plan.ranges.map((range) => range.seamId)).toEqual(['early', 'late'])
    expect(plan.ranges[0]).toMatchObject({ start: 0, end: 3 })
  })

  it('keeps a stitchless seam as a zero-width range so the caption can still name it', () => {
    // An aligned seam compiles no stitches, but dropping it would shift every
    // later seam's indices the moment its kind changed.
    const plan = buildSeamSewPlan({
      seamConnections: [seam('aligned', { kind: 'aligned' }), seam('sewn')],
      stitchPairs: [pair('sewn', 5)],
    })

    expect(plan.ranges[0]).toEqual({ seamId: 'aligned', name: 'Seam aligned', start: 0, end: 0 })
    expect(plan.stitchCount).toBe(5)
  })

  it('falls back to the seam id when the seam carries no name', () => {
    const plan = buildSeamSewPlan({
      seamConnections: [seam('unnamed', { name: undefined })],
      stitchPairs: [pair('unnamed', 2)],
    })

    expect(plan.ranges[0].name).toBe('unnamed')
  })

  it('counts the shorter side when the two sides disagree', () => {
    const uneven: StitchPair = { ...pair('lopsided', 8), right: chain('lopsided', 'to', 5) }
    const plan = buildSeamSewPlan({ seamConnections: [seam('lopsided')], stitchPairs: [uneven] })

    expect(plan.stitchCount).toBe(5)
  })
})

describe('resolveSewProgress', () => {
  const plan = buildSeamSewPlan({
    seamConnections: [seam('one'), seam('two')],
    stitchPairs: [pair('one', 10), pair('two', 6)],
  })

  it('names the seam under the needle and how far through it is', () => {
    const progress = resolveSewProgress(plan, 13)

    expect(progress.activeSeam?.seamId).toBe('two')
    expect(progress.activeSeamProgress).toBeCloseTo(0.5, 6)
    expect(progress.completedSeamIds).toEqual(['one'])
  })

  it('has no active seam before the first stitch or after the last', () => {
    expect(resolveSewProgress(plan, 0).activeSeam).toBeNull()
    expect(resolveSewProgress(plan, 16).activeSeam).toBeNull()
    expect(resolveSewProgress(plan, 16).completedSeamIds).toEqual(['one', 'two'])
  })

  it('clamps a count from outside the plan', () => {
    expect(resolveSewProgress(plan, -5).sewnStitchCount).toBe(0)
    expect(resolveSewProgress(plan, 999).sewnStitchCount).toBe(16)
  })

  it('treats a seam boundary as the earlier seam finished, not the later one started', () => {
    const progress = resolveSewProgress(plan, 10)

    expect(progress.completedSeamIds).toEqual(['one'])
    expect(progress.activeSeam).toBeNull()
  })
})

describe('sewnFractionForSeam', () => {
  const plan = buildSeamSewPlan({
    seamConnections: [seam('one'), seam('two')],
    stitchPairs: [pair('one', 10), pair('two', 6)],
  })

  it('reads everything as sewn when no scrubber is in play', () => {
    expect(sewnFractionForSeam(plan, 'one', null)).toBe(1)
    expect(sewnFractionForSeam(plan, 'two', undefined)).toBe(1)
  })

  it('clips the seam under the needle and leaves the rest alone', () => {
    expect(sewnFractionForSeam(plan, 'one', 13)).toBe(1)
    expect(sewnFractionForSeam(plan, 'two', 13)).toBeCloseTo(0.5, 6)
  })

  it('reads a seam not yet reached as unsewn', () => {
    expect(sewnFractionForSeam(plan, 'two', 4)).toBe(0)
    expect(sewnFractionForSeam(plan, 'one', 0)).toBe(0)
  })

  it('reads a seam the plan does not know about as sewn rather than hiding it', () => {
    expect(sewnFractionForSeam(plan, 'never-heard-of-it', 0)).toBe(1)
  })
})
