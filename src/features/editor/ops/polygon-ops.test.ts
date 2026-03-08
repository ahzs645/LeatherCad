import { describe, it, expect } from 'vitest'
import {
  polygonArea,
  polygonToLineShapes,
  ensureCCW,
  polygonBounds,
  polygonCentroid,
  translatePolygon,
  rotatePolygon,
} from './polygon-ops'

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

describe('polygonArea', () => {
  it('returns positive area for CCW polygon', () => {
    const area = polygonArea(square)
    expect(area).toBe(100)
  })

  it('returns negative area for CW polygon', () => {
    const cw = [...square].reverse()
    expect(polygonArea(cw)).toBe(-100)
  })

  it('returns 0 for degenerate polygon', () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(0)
  })
})

describe('ensureCCW', () => {
  it('keeps CCW polygon unchanged', () => {
    const result = ensureCCW(square)
    expect(polygonArea(result)).toBeGreaterThan(0)
  })

  it('reverses CW polygon to CCW', () => {
    const cw = [...square].reverse()
    const result = ensureCCW(cw)
    expect(polygonArea(result)).toBeGreaterThan(0)
  })
})

describe('polygonBounds', () => {
  it('computes correct bounding box', () => {
    const bounds = polygonBounds(square)
    expect(bounds.minX).toBe(0)
    expect(bounds.minY).toBe(0)
    expect(bounds.maxX).toBe(10)
    expect(bounds.maxY).toBe(10)
  })
})

describe('polygonCentroid', () => {
  it('computes centroid of a square', () => {
    const c = polygonCentroid(square)
    expect(c.x).toBe(5)
    expect(c.y).toBe(5)
  })
})

describe('translatePolygon', () => {
  it('translates all vertices', () => {
    const translated = translatePolygon(square, 5, 3)
    expect(translated[0]).toEqual({ x: 5, y: 3 })
    expect(translated[2]).toEqual({ x: 15, y: 13 })
  })
})

describe('rotatePolygon', () => {
  it('rotates 90 degrees around origin', () => {
    const rotated = rotatePolygon([{ x: 1, y: 0 }], { x: 0, y: 0 }, 90)
    expect(rotated[0].x).toBeCloseTo(0, 10)
    expect(rotated[0].y).toBeCloseTo(1, 10)
  })
})

describe('polygonToLineShapes', () => {
  it('creates line shapes from polygon', () => {
    const shapes = polygonToLineShapes(square, 'layer1', 'lt1')
    expect(shapes).toHaveLength(4)
    expect(shapes[0].type).toBe('line')
    expect(shapes[0].start).toEqual({ x: 0, y: 0 })
    expect(shapes[0].end).toEqual({ x: 10, y: 0 })
    // Last edge closes the polygon
    expect(shapes[3].start).toEqual({ x: 0, y: 10 })
    expect(shapes[3].end).toEqual({ x: 0, y: 0 })
  })

  it('creates open polyline when closed=false', () => {
    const shapes = polygonToLineShapes(square, 'layer1', 'lt1', undefined, false)
    expect(shapes).toHaveLength(3)
  })
})
