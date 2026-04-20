import { describe, expect, it } from 'vitest'
import type { LineShape, Shape } from '../cad/cad-types'
import {
  buildBoundaryLines,
  buildCenterLineBetween,
  convexHull,
  getLineAngleDeg,
  removeDuplicateShapes,
  setLineAngle,
  shapesCoincide,
  splitShapeIntoN,
} from './geometry-editing-ops'

function makeLine(id: string, x1: number, y1: number, x2: number, y2: number): LineShape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'cut',
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  }
}

describe('buildCenterLineBetween', () => {
  it('draws a line connecting midpoints of two lines', () => {
    const a = makeLine('a', 0, 0, 10, 0)
    const b = makeLine('b', 0, 20, 10, 20)
    const mid = buildCenterLineBetween(a, b, { layerId: 'layer-1', lineTypeId: 'cut' })
    expect(mid.start).toEqual({ x: 5, y: 0 })
    expect(mid.end).toEqual({ x: 5, y: 20 })
  })
})

describe('setLineAngle', () => {
  it('rotates end about start preserving length', () => {
    const line = makeLine('a', 0, 0, 10, 0)
    const rotated = setLineAngle(line, 90)
    expect(rotated.end.x).toBeCloseTo(0)
    expect(rotated.end.y).toBeCloseTo(10)
    expect(getLineAngleDeg(rotated)).toBeCloseTo(90)
  })
})

describe('shapesCoincide / removeDuplicateShapes', () => {
  it('treats forward and reverse line orientations as duplicates', () => {
    const a = makeLine('a', 0, 0, 10, 0)
    const b = makeLine('b', 10, 0, 0, 0)
    expect(shapesCoincide(a, b)).toBe(true)
  })

  it('removes subsequent duplicate shapes, keeping the first', () => {
    const shapes: Shape[] = [
      makeLine('a', 0, 0, 10, 0),
      makeLine('b', 0, 0, 10, 0),
      makeLine('c', 0, 0, 5, 5),
    ]
    const { shapes: kept, removedIds } = removeDuplicateShapes(shapes)
    expect(kept).toHaveLength(2)
    expect(removedIds).toEqual(['b'])
  })
})

describe('splitShapeIntoN', () => {
  it('splits a line into N equal segments', () => {
    const line = makeLine('a', 0, 0, 10, 0)
    const parts = splitShapeIntoN(line, 4)
    expect(parts).toHaveLength(4)
    const first = parts[0]
    const last = parts[3]
    if (first.type !== 'line' || last.type !== 'line') throw new Error('expected lines')
    expect(first.start).toEqual({ x: 0, y: 0 })
    expect(first.end.x).toBeCloseTo(2.5)
    expect(last.end.x).toBeCloseTo(10)
  })

  it('returns the original when count < 2', () => {
    const line = makeLine('a', 0, 0, 10, 0)
    expect(splitShapeIntoN(line, 1)).toEqual([line])
  })
})

describe('convexHull / buildBoundaryLines', () => {
  it('computes a convex hull of a unit square', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0.5, y: 0.5 },
    ])
    expect(hull).toHaveLength(4)
  })

  it('buildBoundaryLines produces a closed ring of line shapes', () => {
    const shapes: Shape[] = [
      makeLine('a', 0, 0, 10, 0),
      makeLine('b', 10, 0, 10, 10),
      makeLine('c', 10, 10, 0, 10),
      makeLine('d', 0, 10, 0, 0),
    ]
    const boundary = buildBoundaryLines(shapes, { layerId: 'layer-1', lineTypeId: 'cut' })
    expect(boundary.length).toBeGreaterThanOrEqual(4)
    // Each line's end should match next line's start
    for (let i = 0; i < boundary.length; i++) {
      const next = boundary[(i + 1) % boundary.length]
      expect(boundary[i].end).toEqual(next.start)
    }
  })
})
