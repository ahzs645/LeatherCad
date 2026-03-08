import { describe, it, expect } from 'vitest'
import {
  evaluateExpression,
  resolveAllParams,
  applyDimensionBindings,
  measureDimension,
} from './parametric-dimensions'
import type { DimensionParam, DimensionBinding } from './parametric-dimensions'
import type { Shape, LineShape, BezierShape } from './cad-types'

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
// evaluateExpression
// ---------------------------------------------------------------------------

describe('evaluateExpression', () => {
  it('evaluates a simple number', () => {
    expect(evaluateExpression('42', new Map())).toBe(42)
  })

  it('evaluates addition and subtraction', () => {
    expect(evaluateExpression('10 + 5 - 3', new Map())).toBe(12)
  })

  it('evaluates multiplication and division', () => {
    expect(evaluateExpression('6 * 7 / 2', new Map())).toBe(21)
  })

  it('respects operator precedence', () => {
    expect(evaluateExpression('2 + 3 * 4', new Map())).toBe(14)
  })

  it('handles parentheses', () => {
    expect(evaluateExpression('(2 + 3) * 4', new Map())).toBe(20)
  })

  it('handles nested parentheses', () => {
    expect(evaluateExpression('((2 + 3) * (4 - 1))', new Map())).toBe(15)
  })

  it('resolves parameter references', () => {
    const params = new Map([
      ['width', 100],
      ['height', 50],
    ])
    expect(evaluateExpression('width * 0.5', params)).toBe(50)
    expect(evaluateExpression('width + height', params)).toBe(150)
  })

  it('handles unary minus', () => {
    expect(evaluateExpression('-5', new Map())).toBe(-5)
    expect(evaluateExpression('-5 + 10', new Map())).toBe(5)
    expect(evaluateExpression('-(3 + 2)', new Map())).toBe(-5)
  })

  it('throws on unknown parameter', () => {
    expect(() => evaluateExpression('unknown', new Map())).toThrow(
      "Unknown parameter 'unknown'",
    )
  })

  it('throws on mismatched parentheses', () => {
    expect(() => evaluateExpression('(2 + 3', new Map())).toThrow()
  })

  it('handles decimals', () => {
    expect(evaluateExpression('3.14 * 2', new Map())).toBeCloseTo(6.28)
  })
})

// ---------------------------------------------------------------------------
// resolveAllParams
// ---------------------------------------------------------------------------

describe('resolveAllParams', () => {
  it('resolves simple params without expressions', () => {
    const params: DimensionParam[] = [
      { id: '1', name: 'width', valueMm: 100 },
      { id: '2', name: 'height', valueMm: 50 },
    ]
    const resolved = resolveAllParams(params)
    expect(resolved.get('width')).toBe(100)
    expect(resolved.get('height')).toBe(50)
  })

  it('resolves expressions referencing other params', () => {
    const params: DimensionParam[] = [
      { id: '1', name: 'width', valueMm: 200 },
      { id: '2', name: 'half_width', valueMm: 0, expression: 'width * 0.5' },
    ]
    const resolved = resolveAllParams(params)
    expect(resolved.get('half_width')).toBe(100)
  })

  it('resolves chained dependencies', () => {
    const params: DimensionParam[] = [
      { id: '1', name: 'a', valueMm: 10 },
      { id: '2', name: 'b', valueMm: 0, expression: 'a * 2' },
      { id: '3', name: 'c', valueMm: 0, expression: 'b + 5' },
    ]
    const resolved = resolveAllParams(params)
    expect(resolved.get('b')).toBe(20)
    expect(resolved.get('c')).toBe(25)
  })

  it('clamps to min/max', () => {
    const params: DimensionParam[] = [
      { id: '1', name: 'width', valueMm: 500, minMm: 10, maxMm: 200 },
    ]
    const resolved = resolveAllParams(params)
    expect(resolved.get('width')).toBe(200)
  })

  it('clamps expression results to min/max', () => {
    const params: DimensionParam[] = [
      { id: '1', name: 'base', valueMm: 100 },
      {
        id: '2',
        name: 'derived',
        valueMm: 0,
        expression: 'base * 3',
        maxMm: 250,
      },
    ]
    const resolved = resolveAllParams(params)
    expect(resolved.get('derived')).toBe(250)
  })

  it('throws on circular dependency', () => {
    const params: DimensionParam[] = [
      { id: '1', name: 'a', valueMm: 0, expression: 'b' },
      { id: '2', name: 'b', valueMm: 0, expression: 'a' },
    ]
    expect(() => resolveAllParams(params)).toThrow('Circular dependency')
  })
})

// ---------------------------------------------------------------------------
// applyDimensionBindings
// ---------------------------------------------------------------------------

describe('applyDimensionBindings', () => {
  it('adjusts line end along x axis', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 100, 0)]
    const bindings: DimensionBinding[] = [
      {
        id: 'b1',
        paramId: 'width',
        shapeId: 's1',
        anchorFrom: 'start',
        anchorTo: 'end',
        axis: 'x',
      },
    ]
    const resolved = new Map([['width', 150]])
    const result = applyDimensionBindings(shapes, bindings, resolved)
    expect(result[0].end.x).toBe(150)
    expect(result[0].end.y).toBe(0)
  })

  it('adjusts line end along y axis', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 0, 100)]
    const bindings: DimensionBinding[] = [
      {
        id: 'b1',
        paramId: 'height',
        shapeId: 's1',
        anchorFrom: 'start',
        anchorTo: 'end',
        axis: 'y',
      },
    ]
    const resolved = new Map([['height', 75]])
    const result = applyDimensionBindings(shapes, bindings, resolved)
    expect(result[0].end.x).toBe(0)
    expect(result[0].end.y).toBe(75)
  })

  it('adjusts line end by distance, preserving direction', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 30, 40)]
    const bindings: DimensionBinding[] = [
      {
        id: 'b1',
        paramId: 'length',
        shapeId: 's1',
        anchorFrom: 'start',
        anchorTo: 'end',
        axis: 'distance',
      },
    ]
    const resolved = new Map([['length', 100]])
    const result = applyDimensionBindings(shapes, bindings, resolved)
    // Original direction: (30,40), length 50 => scale by 2
    expect(result[0].end.x).toBeCloseTo(60)
    expect(result[0].end.y).toBeCloseTo(80)
  })

  it('adjusts bezier control point', () => {
    const shapes: Shape[] = [makeBezier('s1', 0, 0, 50, 50, 100, 0)]
    const bindings: DimensionBinding[] = [
      {
        id: 'b1',
        paramId: 'curvature',
        shapeId: 's1',
        anchorFrom: 'start',
        anchorTo: 'control',
        axis: 'y',
      },
    ]
    const resolved = new Map([['curvature', 80]])
    const result = applyDimensionBindings(shapes, bindings, resolved)
    const bezier = result[0] as BezierShape
    expect(bezier.control.y).toBe(80)
  })

  it('handles missing param gracefully', () => {
    const shapes: Shape[] = [makeLine('s1', 0, 0, 100, 0)]
    const bindings: DimensionBinding[] = [
      {
        id: 'b1',
        paramId: 'missing',
        shapeId: 's1',
        anchorFrom: 'start',
        anchorTo: 'end',
        axis: 'x',
      },
    ]
    const resolved = new Map<string, number>()
    const result = applyDimensionBindings(shapes, bindings, resolved)
    // Should be unchanged
    expect(result[0].end.x).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// measureDimension
// ---------------------------------------------------------------------------

describe('measureDimension', () => {
  it('measures x distance', () => {
    const shape = makeLine('s1', 10, 20, 110, 20)
    const binding: DimensionBinding = {
      id: 'b1',
      paramId: 'w',
      shapeId: 's1',
      anchorFrom: 'start',
      anchorTo: 'end',
      axis: 'x',
    }
    expect(measureDimension(shape, binding)).toBe(100)
  })

  it('measures y distance', () => {
    const shape = makeLine('s1', 10, 20, 10, 70)
    const binding: DimensionBinding = {
      id: 'b1',
      paramId: 'h',
      shapeId: 's1',
      anchorFrom: 'start',
      anchorTo: 'end',
      axis: 'y',
    }
    expect(measureDimension(shape, binding)).toBe(50)
  })

  it('measures euclidean distance', () => {
    const shape = makeLine('s1', 0, 0, 30, 40)
    const binding: DimensionBinding = {
      id: 'b1',
      paramId: 'len',
      shapeId: 's1',
      anchorFrom: 'start',
      anchorTo: 'end',
      axis: 'distance',
    }
    expect(measureDimension(shape, binding)).toBeCloseTo(50)
  })

  it('measures negative x distance when end is left of start', () => {
    const shape = makeLine('s1', 100, 0, 30, 0)
    const binding: DimensionBinding = {
      id: 'b1',
      paramId: 'w',
      shapeId: 's1',
      anchorFrom: 'start',
      anchorTo: 'end',
      axis: 'x',
    }
    expect(measureDimension(shape, binding)).toBe(-70)
  })
})
