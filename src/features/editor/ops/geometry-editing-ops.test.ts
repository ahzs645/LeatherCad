import { describe, expect, it } from 'vitest'
import type { ArcShape, LineShape, Shape } from '../cad/cad-types'
import {
  buildBoundaryLines,
  buildCenterLineBetween,
  buildDistanceMarks,
  convexHull,
  filletCorner,
  getArcGeometry,
  getLineAngleDeg,
  getLineLengthMm,
  removeDuplicateShapes,
  scaleLineLengthByRatio,
  setArcGeometry,
  setLineAngle,
  setLineLength,
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

function makeArc(id: string, startX: number, startY: number, midX: number, midY: number, endX: number, endY: number): ArcShape {
  return {
    id,
    type: 'arc',
    layerId: 'layer-1',
    lineTypeId: 'cut',
    start: { x: startX, y: startY },
    mid: { x: midX, y: midY },
    end: { x: endX, y: endY },
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

describe('setLineLength / scaleLineLengthByRatio', () => {
  it('sets absolute length while preserving start and direction', () => {
    const line = makeLine('a', 0, 0, 10, 0)
    const out = setLineLength(line, 5)
    expect(out.end).toEqual({ x: 5, y: 0 })
  })

  it('scaleLineLengthByRatio doubles the length', () => {
    const line = makeLine('a', 0, 0, 3, 4)
    const out = scaleLineLengthByRatio(line, 2)
    expect(getLineLengthMm(out)).toBeCloseTo(10)
  })

  it('returns input unchanged for non-finite or non-positive input', () => {
    const line = makeLine('a', 0, 0, 3, 4)
    expect(setLineLength(line, -1)).toBe(line)
    expect(scaleLineLengthByRatio(line, 0)).toBe(line)
  })
})

describe('getArcGeometry / setArcGeometry', () => {
  it('reports radius and sweep for a three-point arc', () => {
    const arc = makeArc('arc', 10, 0, 0, 10, -10, 0)
    const geometry = getArcGeometry(arc)
    expect(geometry).not.toBeNull()
    expect(geometry?.radiusMm).toBeCloseTo(10)
    expect(geometry?.sweepDeg).toBeCloseTo(180)
  })

  it('updates arc radius and sweep while preserving the center', () => {
    const arc = makeArc('arc', 10, 0, 0, 10, -10, 0)
    const edited = setArcGeometry(arc, 20, 90)
    expect(edited).not.toBeNull()
    if (!edited) return
    const geometry = getArcGeometry(edited)
    expect(geometry?.radiusMm).toBeCloseTo(20)
    expect(geometry?.sweepDeg).toBeCloseTo(90)
    expect(edited.start).toEqual({ x: 20, y: 0 })
  })

  it('returns null for degenerate arcs', () => {
    const arc = makeArc('arc', 0, 0, 5, 0, 10, 0)
    expect(getArcGeometry(arc)).toBeNull()
    expect(setArcGeometry(arc, 10, 90)).toBeNull()
  })
})

describe('buildDistanceMarks', () => {
  it('places perpendicular tick marks at the requested distances along a line', () => {
    const line = makeLine('l', 0, 0, 100, 0)
    const marks = buildDistanceMarks(line, [25, 75], {
      layerId: 'layer-1',
      lineTypeId: 'mark',
      tickLengthMm: 4,
    })
    expect(marks).toHaveLength(2)
    const first = marks[0]
    expect(first.start.x).toBe(25)
    expect(first.start.y).toBe(-2)
    expect(first.end.x).toBe(25)
    expect(first.end.y).toBe(2)
  })

  it('skips distances that exceed the shape length', () => {
    const line = makeLine('l', 0, 0, 10, 0)
    const marks = buildDistanceMarks(line, [5, 50], {
      layerId: 'layer-1',
      lineTypeId: 'mark',
    })
    expect(marks).toHaveLength(1)
  })
})

describe('filletCorner', () => {
  it('rounds a right-angle corner with the given radius', () => {
    const horizontal: LineShape = {
      id: 'h',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    }
    const vertical: LineShape = {
      id: 'v',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 10, y: 0 },
      end: { x: 10, y: 10 },
    }
    const result = filletCorner(horizontal, vertical, 2)
    expect(result).not.toBeNull()
    if (!result) return
    expect(result.trimmedA.end.x).toBeCloseTo(8)
    expect(result.trimmedA.end.y).toBeCloseTo(0)
    expect(result.trimmedB.end.x).toBeCloseTo(10)
    expect(result.trimmedB.end.y).toBeCloseTo(2)
    expect(result.arc.type).toBe('arc')
    // Arc bulges toward the original corner: midpoint on the near-side of the fillet arc.
    expect(result.arc.mid.x).toBeCloseTo(10 - 2 + 2 / Math.SQRT2, 1)
    expect(result.arc.mid.y).toBeCloseTo(2 - 2 / Math.SQRT2, 1)
  })

  it('returns null for parallel lines', () => {
    const a: LineShape = {
      id: 'a',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    }
    const b: LineShape = { ...a, id: 'b', start: { x: 0, y: 5 }, end: { x: 10, y: 5 } }
    expect(filletCorner(a, b, 1)).toBeNull()
  })

  it('returns null when radius exceeds available line length', () => {
    const a: LineShape = {
      id: 'a',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 0, y: 0 },
      end: { x: 2, y: 0 },
    }
    const b: LineShape = {
      id: 'b',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: 'cut',
      start: { x: 2, y: 0 },
      end: { x: 2, y: 2 },
    }
    expect(filletCorner(a, b, 10)).toBeNull()
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

  it('expands the boundary outward when a positive margin is provided', () => {
    const shapes: Shape[] = [
      makeLine('a', 0, 0, 10, 0),
      makeLine('b', 10, 0, 10, 10),
      makeLine('c', 10, 10, 0, 10),
      makeLine('d', 0, 10, 0, 0),
    ]
    const boundary = buildBoundaryLines(shapes, { layerId: 'layer-1', lineTypeId: 'cut', marginMm: 2 })
    const points = boundary.flatMap((line) => [line.start, line.end])

    expect(Math.min(...points.map((point) => point.x))).toBeLessThan(0)
    expect(Math.min(...points.map((point) => point.y))).toBeLessThan(0)
    expect(Math.max(...points.map((point) => point.x))).toBeGreaterThan(10)
    expect(Math.max(...points.map((point) => point.y))).toBeGreaterThan(10)
  })
})
