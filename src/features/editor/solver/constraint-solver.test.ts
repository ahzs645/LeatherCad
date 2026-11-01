import { describe, it, expect } from 'vitest'
import type { CubicShape, EllipseShape, LineShape } from '../cad/cad-types'
import {
  getAnchorPoint,
  setAnchorPoint,
  solveConstraints,
  type CoincidentConstraint,
  type DistanceConstraint,
} from './constraint-solver'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLine(id: string, x1: number, y1: number, x2: number, y2: number): LineShape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'lt-1',
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  }
}

// ---------------------------------------------------------------------------
// getAnchorPoint / setAnchorPoint
// ---------------------------------------------------------------------------

describe('getAnchorPoint', () => {
  it('returns start and end points directly', () => {
    const line = makeLine('a', 0, 0, 10, 20)
    expect(getAnchorPoint(line, 'start')).toEqual({ x: 0, y: 0 })
    expect(getAnchorPoint(line, 'end')).toEqual({ x: 10, y: 20 })
  })

  it('returns the geometric midpoint for mid on a line', () => {
    const line = makeLine('a', 0, 0, 10, 20)
    expect(getAnchorPoint(line, 'mid')).toEqual({ x: 5, y: 10 })
  })

  it('returns the geometric center for center', () => {
    const line = makeLine('a', 2, 4, 8, 12)
    expect(getAnchorPoint(line, 'center')).toEqual({ x: 5, y: 8 })
  })
})

describe('setAnchorPoint', () => {
  it('moves start without affecting end', () => {
    const line = makeLine('a', 0, 0, 10, 10)
    const updated = setAnchorPoint(line, 'start', { x: 5, y: 5 })
    expect(getAnchorPoint(updated, 'start')).toEqual({ x: 5, y: 5 })
    expect(getAnchorPoint(updated, 'end')).toEqual({ x: 10, y: 10 })
  })

  it('translates the whole shape when setting center', () => {
    const line = makeLine('a', 0, 0, 10, 0)
    // current center is (5, 0); move it to (10, 5) -> dx=5, dy=5
    const updated = setAnchorPoint(line, 'center', { x: 10, y: 5 })
    expect(getAnchorPoint(updated, 'start')).toEqual({ x: 5, y: 5 })
    expect(getAnchorPoint(updated, 'end')).toEqual({ x: 15, y: 5 })
  })
})

describe('native curve constraint contracts', () => {
  const curve: EllipseShape = { id: 'ellipse', type: 'ellipse', layerId: 'main', lineTypeId: 'cut', center: { x: 20, y: 30 }, radiusX: 10, radiusY: 4, rotationDeg: 25, startAngleDeg: 0, sweepDeg: 270 }
  it('sets virtual position anchors by translation while retaining ellipse parameters', () => {
    const old = getAnchorPoint(curve, 'end'), moved = setAnchorPoint(curve, 'end', { x: old.x + 7, y: old.y - 9 })
    if (moved.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(moved.center.x).toBeCloseTo(27); expect(moved.center.y).toBeCloseTo(21)
    expect(moved.radiusX).toBeCloseTo(10); expect(moved.radiusY).toBeCloseTo(4)
    expect('end' in moved).toBe(false)
  })
  it('aligns a native chord without approximating the curve', () => {
    const result = solveConstraints([curve], [{ id: 'horizontal', type: 'horizontal', shapeId: curve.id }])
    expect(result.converged).toBe(true)
    const updated = result.shapeUpdates.get(curve.id)!
    expect(updated.type).toBe('ellipse')
    expect(getAnchorPoint(updated, 'start').y).toBeCloseTo(getAnchorPoint(updated, 'end').y, 7)
  })
  it('solves coincident native anchors while leaving a locked reference and cubic controls unchanged', () => {
    const cubic: CubicShape = { id: 'cubic', type: 'cubic', layerId: 'main', lineTypeId: 'cut', start: { x: 2, y: 3 }, control1: { x: 5, y: 20 }, control2: { x: 20, y: 30 }, end: { x: 40, y: 0 } }
    const reference = { ...curve, locked: true }
    const result = solveConstraints([cubic, reference], [{ id: 'coincident', type: 'coincident', shapeIdA: cubic.id, anchorA: 'start', shapeIdB: curve.id, anchorB: 'end' }])
    expect(result.converged).toBe(true)
    expect(result.updates.has(curve.id)).toBe(false)
    const actual = result.updates.get(cubic.id)?.get('start'), expected = getAnchorPoint(curve, 'end')
    if (!actual) throw new Error('Expected a moved native anchor')
    expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThanOrEqual(0.001)
  })
})

// ---------------------------------------------------------------------------
// solveConstraints
// ---------------------------------------------------------------------------

describe('solveConstraints', () => {
  it('converges two shapes with a coincident constraint to the same point', () => {
    const lineA = makeLine('a', 0, 0, 10, 0)
    const lineB = makeLine('b', 20, 0, 30, 0)

    const constraint: CoincidentConstraint = {
      id: 'c1',
      type: 'coincident',
      shapeIdA: 'a',
      anchorA: 'end',
      shapeIdB: 'b',
      anchorB: 'start',
    }

    const result = solveConstraints([lineA, lineB], [constraint])

    expect(result.converged).toBe(true)
    expect(result.residual).toBeLessThanOrEqual(0.001)

    // Both anchors should have converged to the midpoint (15, 0)
    const updatedA = result.updates.get('a')!
    const updatedB = result.updates.get('b')!
    expect(updatedA.get('end')!.x).toBeCloseTo(15, 1)
    expect(updatedA.get('end')!.y).toBeCloseTo(0, 1)
    expect(updatedB.get('start')!.x).toBeCloseTo(15, 1)
    expect(updatedB.get('start')!.y).toBeCloseTo(0, 1)
  })

  it('converges two shapes with a distance constraint to the correct distance', () => {
    const lineA = makeLine('a', 0, 0, 10, 0)
    const lineB = makeLine('b', 10, 0, 20, 0)

    const constraint: DistanceConstraint = {
      id: 'd1',
      type: 'distance',
      shapeIdA: 'a',
      anchorA: 'end',
      shapeIdB: 'b',
      anchorB: 'start',
      targetDistance: 5,
    }

    const result = solveConstraints([lineA, lineB], [constraint])

    expect(result.converged).toBe(true)
    expect(result.residual).toBeLessThanOrEqual(0.001)

    // Check the final distance between the anchors equals 5
    const updatedEndA = result.updates.get('a')?.get('end')
    const updatedStartB = result.updates.get('b')?.get('start')

    // The anchors started at the same point (10,0), so both should have moved
    // apart by 2.5 each along x.
    if (updatedEndA && updatedStartB) {
      const dx = updatedStartB.x - updatedEndA.x
      const dy = updatedStartB.y - updatedEndA.y
      const d = Math.sqrt(dx * dx + dy * dy)
      expect(d).toBeCloseTo(5, 2)
    }
  })

  it('returns converged=true when constraints are already satisfied', () => {
    const lineA = makeLine('a', 0, 0, 10, 0)
    const lineB = makeLine('b', 10, 0, 20, 0)

    const constraint: CoincidentConstraint = {
      id: 'c1',
      type: 'coincident',
      shapeIdA: 'a',
      anchorA: 'end',
      shapeIdB: 'b',
      anchorB: 'start',
    }

    const result = solveConstraints([lineA, lineB], [constraint])

    expect(result.converged).toBe(true)
    expect(result.iterations).toBe(1)
    expect(result.residual).toBe(0)
    expect(result.updates.size).toBe(0)
  })

  it('handles empty constraints', () => {
    const lineA = makeLine('a', 0, 0, 10, 0)
    const result = solveConstraints([lineA], [])

    expect(result.converged).toBe(true)
    expect(result.iterations).toBe(0)
    expect(result.residual).toBe(0)
    expect(result.updates.size).toBe(0)
  })

  it('handles distance constraint when points start coincident', () => {
    const lineA = makeLine('a', 0, 0, 5, 0)
    const lineB = makeLine('b', 5, 0, 10, 0)

    const constraint: DistanceConstraint = {
      id: 'd1',
      type: 'distance',
      shapeIdA: 'a',
      anchorA: 'end',
      shapeIdB: 'b',
      anchorB: 'start',
      targetDistance: 0,
    }

    const result = solveConstraints([lineA, lineB], [constraint])

    expect(result.converged).toBe(true)
    expect(result.residual).toBeLessThanOrEqual(0.001)
  })

  it('handles distance constraint with non-zero target between separated points', () => {
    const lineA = makeLine('a', 0, 0, 0, 0)
    const lineB = makeLine('b', 100, 0, 110, 0)

    const constraint: DistanceConstraint = {
      id: 'd1',
      type: 'distance',
      shapeIdA: 'a',
      anchorA: 'end',
      shapeIdB: 'b',
      anchorB: 'start',
      targetDistance: 20,
    }

    const result = solveConstraints([lineA, lineB], [constraint])

    expect(result.converged).toBe(true)

    const endA = result.updates.get('a')?.get('end') ?? getAnchorPoint(lineA, 'end')
    const startB = result.updates.get('b')?.get('start') ?? getAnchorPoint(lineB, 'start')
    const dx = startB.x - endA.x
    const dy = startB.y - endA.y
    const d = Math.sqrt(dx * dx + dy * dy)
    expect(d).toBeCloseTo(20, 2)
  })

  it('reports the final conflict when a later correction breaks an earlier relation', () => {
    const lineA = makeLine('a', 0, 0, 10, 0)
    const lineB = makeLine('b', 1000, 0, 1010, 0)

    const constraint: CoincidentConstraint = {
      id: 'c1',
      type: 'coincident',
      shapeIdA: 'a',
      anchorA: 'end',
      shapeIdB: 'b',
      anchorB: 'start',
    }

    const result = solveConstraints([lineA, lineB], [constraint, { ...constraint, id: 'd1', type: 'distance', targetDistance: 20 }], 1, 0.001)

    // Distance now succeeds, but the earlier coincidence is broken by 20 mm.
    expect(result.converged).toBe(false)
    expect(result.iterations).toBe(1)
    expect(result.residual).toBeGreaterThan(0.001)
    expect(result.conflicts.join(' ')).toContain('c1')
  })
})
