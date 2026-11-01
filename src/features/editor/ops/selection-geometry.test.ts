import { describe, expect, it } from 'vitest'
import type { Shape } from '../cad/cad-types'
import { boxToBoxMapper, fitSelectionToBox, lineEndFor, lineLengthAngle, selectionBox } from './selection-geometry'

const line = (id: string, x1: number, y1: number, x2: number, y2: number): Shape =>
  ({ id, type: 'line', layerId: 'a', lineTypeId: 't', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } })

describe('selection geometry', () => {
  const rect = [line('a', 0, 0, 40, 0), line('b', 40, 0, 40, 20), line('c', 40, 20, 0, 20), line('d', 0, 20, 0, 0), line('other', 100, 100, 120, 100)]
  const ids = new Set(['a', 'b', 'c', 'd'])

  it('measures the combined bounds of the selected shapes only', () => {
    expect(selectionBox(rect, ids)).toEqual({ minX: 0, minY: 0, maxX: 40, maxY: 20 })
    expect(selectionBox(rect, new Set())).toBeNull()
  })

  it('moves and resizes the selection to a target box in one change', () => {
    const next = fitSelectionToBox(rect, ids, { minX: 10, minY: 5, width: 80, height: 10 })
    expect(selectionBox(next, ids)).toEqual({ minX: 10, minY: 5, maxX: 90, maxY: 15 })
    expect(next.find((shape) => shape.id === 'other')).toBe(rect[4])
  })

  it('keeps a zero-size axis instead of dividing by zero', () => {
    const mapper = boxToBoxMapper({ minX: 0, minY: 5, maxX: 10, maxY: 5 }, { minX: 0, minY: 5, width: 20, height: 7 })
    expect(mapper.factorY).toBe(1)
    expect(mapper.map({ x: 10, y: 5 })).toEqual({ x: 20, y: 5 })
  })

  it('reports line length and counter-clockwise screen angle', () => {
    expect(lineLengthAngle({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } })).toEqual({ length: 10, angleDeg: 0 })
    const up = lineLengthAngle({ start: { x: 0, y: 0 }, end: { x: 0, y: -5 } })
    expect(up.length).toBe(5)
    expect(up.angleDeg).toBeCloseTo(90)
    const end = lineEndFor({ x: 1, y: 1 }, 10, 90)
    expect(end.x).toBeCloseTo(1)
    expect(end.y).toBeCloseTo(-9)
  })
})
