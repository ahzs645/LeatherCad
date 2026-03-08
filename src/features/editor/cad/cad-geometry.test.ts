import { describe, it, expect, vi } from 'vitest'

vi.mock('../ops/text-shape-ops', () => ({
  normalizeTextShape: (shape: unknown) => shape,
  sampleTextShapePoints: () => [{ x: 0, y: 0 }],
}))

import {
  clamp,
  round,
  uid,
  distance,
  arcPath,
  shapeToSvg,
  getShapePoints,
  getBounds,
  sampleShapePoints,
  isPointLike,
  isShapeLike,
} from './cad-geometry'
import type { LineShape, ArcShape, BezierShape } from './cad-types'

function makeLineShape(overrides: Partial<LineShape> = {}): LineShape {
  return {
    id: 'line-1',
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'lt-1',
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    ...overrides,
  }
}

function makeArcShape(overrides: Partial<ArcShape> = {}): ArcShape {
  return {
    id: 'arc-1',
    type: 'arc',
    layerId: 'layer-1',
    lineTypeId: 'lt-1',
    start: { x: 0, y: 0 },
    mid: { x: 5, y: 5 },
    end: { x: 10, y: 0 },
    ...overrides,
  }
}

function makeBezierShape(overrides: Partial<BezierShape> = {}): BezierShape {
  return {
    id: 'bezier-1',
    type: 'bezier',
    layerId: 'layer-1',
    lineTypeId: 'lt-1',
    start: { x: 0, y: 0 },
    control: { x: 5, y: 10 },
    end: { x: 10, y: 0 },
    ...overrides,
  }
}

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to min when value is below', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps to max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('returns min when min equals max', () => {
    expect(clamp(5, 3, 3)).toBe(3)
  })
})

describe('round', () => {
  it('rounds to 3 decimal places', () => {
    expect(round(1.23456)).toBe(1.235)
  })

  it('keeps values with fewer decimals unchanged', () => {
    expect(round(1.5)).toBe(1.5)
  })

  it('rounds negative values correctly', () => {
    expect(round(-1.23456)).toBe(-1.235)
  })

  it('handles zero', () => {
    expect(round(0)).toBe(0)
  })
})

describe('uid', () => {
  it('returns a string', () => {
    expect(typeof uid()).toBe('string')
  })

  it('returns unique values on successive calls', () => {
    const a = uid()
    const b = uid()
    expect(a).not.toBe(b)
  })
})

describe('distance', () => {
  it('calculates distance between two points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('returns 0 for identical points', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
  })

  it('handles negative coordinates', () => {
    expect(distance({ x: -3, y: 0 }, { x: 0, y: 4 })).toBe(5)
  })
})

describe('arcPath', () => {
  it('returns an SVG arc path string starting with M', () => {
    const path = arcPath({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 })
    expect(path).toMatch(/^M /)
    expect(path).toContain('A ')
  })

  it('falls back to quadratic curve for collinear points', () => {
    const path = arcPath({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 })
    expect(path).toContain('Q ')
  })
})

describe('shapeToSvg', () => {
  it('generates SVG line element for line shape', () => {
    const svg = shapeToSvg(makeLineShape({ start: { x: 1, y: 2 }, end: { x: 3, y: 4 } }))
    expect(svg).toContain('<line')
    expect(svg).toContain('x1="1"')
    expect(svg).toContain('y1="2"')
    expect(svg).toContain('x2="3"')
    expect(svg).toContain('y2="4"')
    expect(svg).toContain('stroke=')
    expect(svg).toContain('/>')
  })

  it('generates SVG path element for arc shape', () => {
    const svg = shapeToSvg(makeArcShape())
    expect(svg).toContain('<path')
    expect(svg).toContain('d="M ')
    expect(svg).toContain('stroke=')
  })

  it('generates SVG path element for bezier shape', () => {
    const svg = shapeToSvg(makeBezierShape({ start: { x: 0, y: 0 }, control: { x: 5, y: 10 }, end: { x: 10, y: 0 } }))
    expect(svg).toContain('<path')
    expect(svg).toContain('Q ')
  })
})

describe('getShapePoints', () => {
  it('returns start and end for line shape', () => {
    const line = makeLineShape({ start: { x: 1, y: 2 }, end: { x: 3, y: 4 } })
    const points = getShapePoints(line)
    expect(points).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }])
  })

  it('returns start, mid, end for arc shape', () => {
    const arc = makeArcShape({ start: { x: 0, y: 0 }, mid: { x: 5, y: 5 }, end: { x: 10, y: 0 } })
    const points = getShapePoints(arc)
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }])
  })

  it('returns start, control, end for bezier shape', () => {
    const bezier = makeBezierShape({ start: { x: 0, y: 0 }, control: { x: 5, y: 10 }, end: { x: 10, y: 0 } })
    const points = getShapePoints(bezier)
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 0 }])
  })
})

describe('getBounds', () => {
  it('returns default bounds for empty shapes array', () => {
    expect(getBounds([])).toEqual({
      minX: -500,
      minY: -500,
      width: 1000,
      height: 1000,
    })
  })

  it('calculates bounds with 100px padding', () => {
    const shapes = [makeLineShape({ start: { x: 0, y: 0 }, end: { x: 100, y: 50 } })]
    const bounds = getBounds(shapes)
    expect(bounds.minX).toBe(-100)
    expect(bounds.minY).toBe(-100)
    expect(bounds.width).toBe(300) // 100 + 200 padding
    expect(bounds.height).toBe(250) // 50 + 200 padding
  })

  it('ensures minimum width and height of 100', () => {
    const shapes = [makeLineShape({ start: { x: 5, y: 5 }, end: { x: 5, y: 5 } })]
    const bounds = getBounds(shapes)
    expect(bounds.width).toBeGreaterThanOrEqual(100)
    expect(bounds.height).toBeGreaterThanOrEqual(100)
  })
})

describe('sampleShapePoints', () => {
  it('returns start and end for line shape', () => {
    const line = makeLineShape({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } })
    const points = sampleShapePoints(line)
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }])
  })

  it('returns multiple points for bezier shape', () => {
    const bezier = makeBezierShape()
    const points = sampleShapePoints(bezier, 4)
    expect(points.length).toBe(5) // segments + 1
    expect(points[0]).toEqual({ x: 0, y: 0 })
    expect(points[4].x).toBeCloseTo(10)
    expect(points[4].y).toBeCloseTo(0)
  })

  it('returns multiple points for arc shape', () => {
    const arc = makeArcShape()
    const points = sampleShapePoints(arc, 4)
    expect(points.length).toBeGreaterThan(2)
    expect(points[0].x).toBeCloseTo(0)
    expect(points[0].y).toBeCloseTo(0)
  })
})

describe('isPointLike', () => {
  it('returns true for valid Point objects', () => {
    expect(isPointLike({ x: 1, y: 2 })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isPointLike(null)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(isPointLike('string')).toBe(false)
    expect(isPointLike(42)).toBe(false)
  })

  it('returns false for object missing x or y', () => {
    expect(isPointLike({ x: 1 })).toBe(false)
    expect(isPointLike({ y: 1 })).toBe(false)
  })

  it('returns false for object with non-number x or y', () => {
    expect(isPointLike({ x: '1', y: 2 })).toBe(false)
  })
})

describe('isShapeLike', () => {
  it('returns true for valid line shape', () => {
    expect(isShapeLike(makeLineShape())).toBe(true)
  })

  it('returns true for valid arc shape', () => {
    expect(isShapeLike(makeArcShape())).toBe(true)
  })

  it('returns true for valid bezier shape', () => {
    expect(isShapeLike(makeBezierShape())).toBe(true)
  })

  it('returns false for null', () => {
    expect(isShapeLike(null)).toBe(false)
  })

  it('returns false for object without type', () => {
    expect(isShapeLike({ start: { x: 0, y: 0 }, end: { x: 1, y: 1 } })).toBe(false)
  })

  it('returns false for unknown type', () => {
    expect(isShapeLike({ type: 'polygon', start: { x: 0, y: 0 } })).toBe(false)
  })

  it('returns false for line shape with invalid points', () => {
    expect(isShapeLike({ type: 'line', start: { x: 0, y: 0 }, end: 'bad' })).toBe(false)
  })
})
