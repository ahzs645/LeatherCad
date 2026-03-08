import { describe, it, expect } from 'vitest'
import {
  gradeShapes,
  buildDefaultGradeRules,
  nestGradedPatterns,
} from './pattern-grading'
import type { GradeRule, SizeSpec, GradedPattern } from './pattern-grading'
import type { Shape, LineShape, ArcShape, BezierShape } from './cad-types'

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeLine(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): LineShape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'lt-1',
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  }
}

function makeArc(
  id: string,
  sx: number,
  sy: number,
  mx: number,
  my: number,
  ex: number,
  ey: number,
): ArcShape {
  return {
    id,
    type: 'arc',
    layerId: 'layer-1',
    lineTypeId: 'lt-1',
    start: { x: sx, y: sy },
    mid: { x: mx, y: my },
    end: { x: ex, y: ey },
  }
}

function makeBezier(
  id: string,
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  ex: number,
  ey: number,
): BezierShape {
  return {
    id,
    type: 'bezier',
    layerId: 'layer-1',
    lineTypeId: 'lt-1',
    start: { x: sx, y: sy },
    control: { x: cx, y: cy },
    end: { x: ex, y: ey },
  }
}

// ---------------------------------------------------------------------------
// gradeShapes
// ---------------------------------------------------------------------------

describe('gradeShapes', () => {
  const sizes: SizeSpec[] = [
    { name: 'S', sizeIndex: -1 },
    { name: 'M', sizeIndex: 0 },
    { name: 'L', sizeIndex: 1 },
    { name: 'XL', sizeIndex: 2 },
  ]

  it('returns one GradedPattern per size', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 100, 0)]
    const rules: GradeRule[] = []
    const result = gradeShapes(shapes, rules, sizes)
    expect(result).toHaveLength(4)
    expect(result.map((p) => p.sizeName)).toEqual(['S', 'M', 'L', 'XL'])
  })

  it('base size (index 0) has no shift', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 100, 0)]
    const rules: GradeRule[] = [
      { id: 'r1', shapeId: 's1', anchor: 'end', deltaXPerSize: 5, deltaYPerSize: 0 },
    ]
    const result = gradeShapes(shapes, rules, sizes)
    const medium = result.find((p) => p.sizeName === 'M')!
    expect(medium.shapes[0].end.x).toBe(100)
    expect(medium.shapes[0].end.y).toBe(0)
  })

  it('applies positive shift for sizes above base', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 100, 0)]
    const rules: GradeRule[] = [
      { id: 'r1', shapeId: 's1', anchor: 'end', deltaXPerSize: 5, deltaYPerSize: 2 },
    ]
    const result = gradeShapes(shapes, rules, sizes)
    const large = result.find((p) => p.sizeName === 'L')!
    expect(large.shapes[0].end.x).toBe(105) // 100 + 5*1
    expect(large.shapes[0].end.y).toBe(2)   // 0 + 2*1

    const xl = result.find((p) => p.sizeName === 'XL')!
    expect(xl.shapes[0].end.x).toBe(110)    // 100 + 5*2
    expect(xl.shapes[0].end.y).toBe(4)      // 0 + 2*2
  })

  it('applies negative shift for sizes below base', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 100, 0)]
    const rules: GradeRule[] = [
      { id: 'r1', shapeId: 's1', anchor: 'end', deltaXPerSize: 5, deltaYPerSize: 0 },
    ]
    const result = gradeShapes(shapes, rules, sizes)
    const small = result.find((p) => p.sizeName === 'S')!
    expect(small.shapes[0].end.x).toBe(95) // 100 + 5*(-1)
  })

  it('applies multiple rules to the same shape', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 100, 50)]
    const rules: GradeRule[] = [
      { id: 'r1', shapeId: 's1', anchor: 'start', deltaXPerSize: -2, deltaYPerSize: -1 },
      { id: 'r2', shapeId: 's1', anchor: 'end', deltaXPerSize: 3, deltaYPerSize: 2 },
    ]
    const result = gradeShapes(shapes, rules, sizes)
    const large = result.find((p) => p.sizeName === 'L')!
    expect(large.shapes[0].start.x).toBe(-2) // 0 + (-2)*1
    expect(large.shapes[0].start.y).toBe(-1)
    expect(large.shapes[0].end.x).toBe(103)  // 100 + 3*1
    expect(large.shapes[0].end.y).toBe(52)   // 50 + 2*1
  })

  it('handles multiple shapes with independent rules', () => {
    const shapes: Shape[] = [
      makeLine('s1', 0, 0, 100, 0),
      makeLine('s2', 0, 50, 80, 50),
    ]
    const rules: GradeRule[] = [
      { id: 'r1', shapeId: 's1', anchor: 'end', deltaXPerSize: 5, deltaYPerSize: 0 },
      { id: 'r2', shapeId: 's2', anchor: 'end', deltaXPerSize: 3, deltaYPerSize: 0 },
    ]
    const result = gradeShapes(shapes, rules, sizes)
    const large = result.find((p) => p.sizeName === 'L')!
    expect(large.shapes[0].end.x).toBe(105)
    expect(large.shapes[1].end.x).toBe(83)
  })

  it('grades arc mid point', () => {
    const shapes: Shape[] = [makeArc('a1', 0, 0, 50, 30, 100, 0)]
    const rules: GradeRule[] = [
      { id: 'r1', shapeId: 'a1', anchor: 'mid', deltaXPerSize: 0, deltaYPerSize: 2 },
    ]
    const result = gradeShapes(shapes, rules, sizes)
    const large = result.find((p) => p.sizeName === 'L')!
    const arc = large.shapes[0] as ArcShape
    expect(arc.mid.y).toBe(32)
  })

  it('grades bezier control point', () => {
    const shapes: Shape[] = [makeBezier('b1', 0, 0, 50, 50, 100, 0)]
    const rules: GradeRule[] = [
      { id: 'r1', shapeId: 'b1', anchor: 'control', deltaXPerSize: 0, deltaYPerSize: 3 },
    ]
    const result = gradeShapes(shapes, rules, sizes)
    const xl = result.find((p) => p.sizeName === 'XL')!
    const bezier = xl.shapes[0] as BezierShape
    expect(bezier.control.y).toBe(56) // 50 + 3*2
  })

  it('shapes without rules remain unchanged', () => {
    const shapes: Shape[] = [
      makeLine('s1', 10, 20, 30, 40),
      makeLine('s2', 50, 60, 70, 80),
    ]
    const rules: GradeRule[] = [
      { id: 'r1', shapeId: 's1', anchor: 'end', deltaXPerSize: 5, deltaYPerSize: 0 },
    ]
    const result = gradeShapes(shapes, rules, sizes)
    const large = result.find((p) => p.sizeName === 'L')!
    // s2 should be untouched
    expect(large.shapes[1].start.x).toBe(50)
    expect(large.shapes[1].end.x).toBe(70)
  })
})

// ---------------------------------------------------------------------------
// buildDefaultGradeRules
// ---------------------------------------------------------------------------

describe('buildDefaultGradeRules', () => {
  it('returns empty array for no shapes', () => {
    expect(buildDefaultGradeRules([])).toEqual([])
  })

  it('generates rules for each anchor of each shape', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 100, 0)]
    const rules = buildDefaultGradeRules(shapes)
    // line has start and end -> 2 rules
    expect(rules).toHaveLength(2)
    expect(rules.every((r) => r.shapeId === 's1')).toBe(true)
    expect(rules.map((r) => r.anchor)).toEqual(['start', 'end'])
  })

  it('generates 3 rules for arc (start, mid, end)', () => {
    const shapes: Shape[] = [makeArc('a1', 0, 0, 50, 30, 100, 0)]
    const rules = buildDefaultGradeRules(shapes)
    expect(rules).toHaveLength(3)
    expect(rules.map((r) => r.anchor)).toEqual(['start', 'mid', 'end'])
  })

  it('generates 3 rules for bezier (start, control, end)', () => {
    const shapes: Shape[] = [makeBezier('b1', 0, 0, 50, 50, 100, 0)]
    const rules = buildDefaultGradeRules(shapes)
    expect(rules).toHaveLength(3)
    expect(rules.map((r) => r.anchor)).toEqual(['start', 'control', 'end'])
  })

  it('produces delta values that scale points away from centroid', () => {
    // Symmetric rectangle-like shape: centroid at (50, 25)
    const shapes: Shape[] = [
      makeLine('s1', 0, 0, 100, 0),
      makeLine('s2', 100, 0, 100, 50),
      makeLine('s3', 100, 50, 0, 50),
      makeLine('s4', 0, 50, 0, 0),
    ]
    const rules = buildDefaultGradeRules(shapes)
    // All shapes have start+end anchors -> 8 rules
    expect(rules).toHaveLength(8)

    // For s1 start at (0,0): centroid is (50,25) => dx = (0-50)/100 = -0.5, dy = (0-25)/100 = -0.25
    const s1Start = rules.find((r) => r.shapeId === 's1' && r.anchor === 'start')!
    expect(s1Start.deltaXPerSize).toBeCloseTo(-0.5)
    expect(s1Start.deltaYPerSize).toBeCloseTo(-0.25)

    // For s1 end at (100,0): dx = (100-50)/100 = 0.5, dy = -0.25
    const s1End = rules.find((r) => r.shapeId === 's1' && r.anchor === 'end')!
    expect(s1End.deltaXPerSize).toBeCloseTo(0.5)
    expect(s1End.deltaYPerSize).toBeCloseTo(-0.25)
  })

  it('resulting graded shapes are uniformly larger for positive size index', () => {
    const shapes: Shape[] = [
      makeLine('s1', 0, 0, 200, 0),
      makeLine('s2', 200, 0, 200, 100),
    ]
    const rules = buildDefaultGradeRules(shapes)
    const sizes: SizeSpec[] = [
      { name: 'M', sizeIndex: 0 },
      { name: 'L', sizeIndex: 1 },
    ]
    const graded = gradeShapes(shapes, rules, sizes)
    const medium = graded.find((p) => p.sizeName === 'M')!
    const large = graded.find((p) => p.sizeName === 'L')!

    // The large should be wider than the medium
    const mediumWidth = medium.shapes[0].end.x - medium.shapes[0].start.x
    const largeWidth = large.shapes[0].end.x - large.shapes[0].start.x
    expect(largeWidth).toBeGreaterThan(mediumWidth)
  })
})

// ---------------------------------------------------------------------------
// nestGradedPatterns
// ---------------------------------------------------------------------------

describe('nestGradedPatterns', () => {
  it('returns empty array for empty input', () => {
    expect(nestGradedPatterns([], 10)).toEqual([])
  })

  it('positions first pattern starting at x=0', () => {
    const patterns: GradedPattern[] = [
      {
        sizeName: 'M',
        shapes: [makeLine('s1', 20, 0, 120, 50)],
      },
    ]
    const result = nestGradedPatterns(patterns, 10)
    // Original minX is 20, so shifted left by 20
    expect(result[0].shapes[0].start.x).toBe(0)
    expect(result[0].shapes[0].end.x).toBe(100)
  })

  it('stacks patterns horizontally with spacing', () => {
    const patterns: GradedPattern[] = [
      {
        sizeName: 'S',
        shapes: [makeLine('s1', 0, 0, 100, 0)],
      },
      {
        sizeName: 'M',
        shapes: [makeLine('s1', 0, 0, 120, 0)],
      },
      {
        sizeName: 'L',
        shapes: [makeLine('s1', 0, 0, 140, 0)],
      },
    ]
    const spacing = 10
    const result = nestGradedPatterns(patterns, spacing)

    // First pattern: minX=0, width=100, starts at x=0
    expect(result[0].shapes[0].start.x).toBe(0)
    expect(result[0].shapes[0].end.x).toBe(100)

    // Second pattern: starts at x = 100 + 10 = 110
    expect(result[1].shapes[0].start.x).toBe(110)
    expect(result[1].shapes[0].end.x).toBe(230) // 110 + 120

    // Third pattern: starts at x = 110 + 120 + 10 = 240
    expect(result[2].shapes[0].start.x).toBe(240)
    expect(result[2].shapes[0].end.x).toBe(380) // 240 + 140
  })

  it('does not shift y coordinates', () => {
    const patterns: GradedPattern[] = [
      {
        sizeName: 'S',
        shapes: [makeLine('s1', 0, 30, 100, 70)],
      },
      {
        sizeName: 'M',
        shapes: [makeLine('s1', 0, 30, 120, 70)],
      },
    ]
    const result = nestGradedPatterns(patterns, 10)
    expect(result[0].shapes[0].start.y).toBe(30)
    expect(result[0].shapes[0].end.y).toBe(70)
    expect(result[1].shapes[0].start.y).toBe(30)
    expect(result[1].shapes[0].end.y).toBe(70)
  })

  it('handles patterns with negative coordinates', () => {
    const patterns: GradedPattern[] = [
      {
        sizeName: 'S',
        shapes: [makeLine('s1', -50, 0, 50, 0)],
      },
      {
        sizeName: 'M',
        shapes: [makeLine('s1', -60, 0, 60, 0)],
      },
    ]
    const spacing = 5
    const result = nestGradedPatterns(patterns, spacing)

    // First: minX=-50, shift by +50, so start=0, end=100, width=100
    expect(result[0].shapes[0].start.x).toBe(0)
    expect(result[0].shapes[0].end.x).toBe(100)

    // Second: minX=-60, currentX=105, shift=105-(-60)=165
    expect(result[1].shapes[0].start.x).toBe(105) // 100 + 5
    expect(result[1].shapes[0].end.x).toBe(225)   // 105 + 120
  })

  it('handles multi-shape patterns', () => {
    const patterns: GradedPattern[] = [
      {
        sizeName: 'M',
        shapes: [
          makeLine('s1', 10, 0, 60, 0),
          makeLine('s2', 20, 10, 50, 40),
        ],
      },
    ]
    const result = nestGradedPatterns(patterns, 10)
    // minX across both shapes is 10, shift = 0 - 10 = -10
    expect(result[0].shapes[0].start.x).toBe(0)
    expect(result[0].shapes[0].end.x).toBe(50)
    expect(result[0].shapes[1].start.x).toBe(10)
    expect(result[0].shapes[1].end.x).toBe(40)
  })

  it('preserves sizeName in output', () => {
    const patterns: GradedPattern[] = [
      { sizeName: 'XS', shapes: [makeLine('s1', 0, 0, 50, 0)] },
      { sizeName: 'S', shapes: [makeLine('s1', 0, 0, 60, 0)] },
      { sizeName: 'M', shapes: [makeLine('s1', 0, 0, 70, 0)] },
    ]
    const result = nestGradedPatterns(patterns, 5)
    expect(result.map((p) => p.sizeName)).toEqual(['XS', 'S', 'M'])
  })
})
