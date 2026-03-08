import { describe, it, expect } from 'vitest'
import { rdpSimplify, fitFreehandCurve } from './freehand-ops'
import type { Point } from '../cad/cad-types'

describe('rdpSimplify', () => {
  it('returns same points for 2 or fewer', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    expect(rdpSimplify(pts, 1)).toEqual(pts)
  })

  it('keeps endpoints for collinear points', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]
    const result = rdpSimplify(pts, 0.1)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ x: 0, y: 0 })
    expect(result[1]).toEqual({ x: 3, y: 0 })
  })

  it('keeps significant points', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 10 }, // big deviation
      { x: 10, y: 0 },
    ]
    const result = rdpSimplify(pts, 1)
    expect(result).toHaveLength(3)
  })

  it('simplifies noisy line', () => {
    const pts: Point[] = []
    for (let i = 0; i <= 20; i++) {
      pts.push({ x: i, y: Math.sin(i * 0.01) * 0.01 }) // nearly collinear
    }
    const result = rdpSimplify(pts, 0.1)
    expect(result.length).toBeLessThan(pts.length)
  })
})

describe('fitFreehandCurve', () => {
  it('returns empty for less than 2 points', () => {
    expect(fitFreehandCurve([], 1, 'l1', 'lt1')).toEqual([])
    expect(fitFreehandCurve([{ x: 0, y: 0 }], 1, 'l1', 'lt1')).toEqual([])
  })

  it('returns shapes for two points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    const shapes = fitFreehandCurve(pts, 1, 'l1', 'lt1')
    expect(shapes.length).toBeGreaterThanOrEqual(1)
    // May return line or bezier depending on fitting heuristics
    expect(['line', 'bezier']).toContain(shapes[0].type)
  })

  it('creates bezier shapes for curved input', () => {
    // Semi-circle points
    const pts: Point[] = []
    for (let i = 0; i <= 30; i++) {
      const angle = (i / 30) * Math.PI
      pts.push({
        x: 50 + 40 * Math.cos(angle),
        y: 50 + 40 * Math.sin(angle),
      })
    }
    const shapes = fitFreehandCurve(pts, 1, 'l1', 'lt1')
    expect(shapes.length).toBeGreaterThan(0)
    const hasBezier = shapes.some((s) => s.type === 'bezier')
    expect(hasBezier).toBe(true)
  })

  it('assigns layerId and lineTypeId to all shapes', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 10 },
      { x: 10, y: 0 },
    ]
    const shapes = fitFreehandCurve(pts, 1, 'myLayer', 'myLineType')
    for (const s of shapes) {
      expect(s.layerId).toBe('myLayer')
      expect(s.lineTypeId).toBe('myLineType')
    }
  })
})
