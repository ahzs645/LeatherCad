import { describe, expect, it } from 'vitest'
import type { Shape } from '../cad/cad-types'
import {
  alignSelectionToEdge,
  flipSelection,
  makeLineAxisAligned,
  makeSelectedLinesAxisAligned,
  reverseSelectedPaths,
  reverseShapePath,
  rotateSelectionAround,
  scaleSelectionNonUniform,
} from './transform-ops'

function lineShape(id: string, x1: number, y1: number, x2: number, y2: number): Shape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'cut',
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  }
}

describe('alignSelectionToEdge', () => {
  it('aligns left edges to the selection bbox left', () => {
    const shapes: Shape[] = [lineShape('a', 10, 0, 20, 10), lineShape('b', 40, 0, 60, 10)]
    const aligned = alignSelectionToEdge(shapes, new Set(['a', 'b']), 'left')
    const b = aligned.find((shape) => shape.id === 'b')!
    expect(b.type === 'line' && b.start.x).toBe(10)
    expect(b.type === 'line' && b.end.x).toBe(30)
  })

  it('aligns to middleH by centering x', () => {
    const shapes: Shape[] = [lineShape('a', 0, 0, 10, 0), lineShape('b', 30, 0, 40, 0)]
    const aligned = alignSelectionToEdge(shapes, new Set(['a', 'b']), 'middleH')
    const a = aligned.find((shape) => shape.id === 'a')!
    const b = aligned.find((shape) => shape.id === 'b')!
    const midA =
      a.type === 'line' ? (a.start.x + a.end.x) / 2 : 0
    const midB = b.type === 'line' ? (b.start.x + b.end.x) / 2 : 0
    expect(midA).toBe(midB)
  })

  it('returns input untouched when fewer than 2 shapes selected', () => {
    const shapes: Shape[] = [lineShape('a', 0, 0, 10, 0)]
    expect(alignSelectionToEdge(shapes, new Set(['a']), 'top')).toBe(shapes)
  })
})

describe('flipSelection', () => {
  it('mirrors horizontally across bbox center', () => {
    const shapes: Shape[] = [lineShape('a', 0, 0, 10, 0)]
    const flipped = flipSelection(shapes, new Set(['a']), 'horizontal')
    const a = flipped[0]
    expect(a.type === 'line' && a.start.x).toBe(10)
    expect(a.type === 'line' && a.end.x).toBe(0)
  })

  it('mirrors vertically preserving X', () => {
    const shapes: Shape[] = [lineShape('a', 5, 0, 5, 20)]
    const flipped = flipSelection(shapes, new Set(['a']), 'vertical')
    const a = flipped[0]
    expect(a.type === 'line' && a.start.y).toBe(20)
    expect(a.type === 'line' && a.end.y).toBe(0)
    expect(a.type === 'line' && a.start.x).toBe(5)
  })
})

describe('reverseShapePath', () => {
  it('swaps start and end on line shapes', () => {
    const line = lineShape('a', 1, 2, 3, 4)
    const reversed = reverseShapePath(line)
    expect(reversed.type === 'line' && reversed.start).toEqual({ x: 3, y: 4 })
    expect(reversed.type === 'line' && reversed.end).toEqual({ x: 1, y: 2 })
  })

  it('reverseSelectedPaths applies only to selected ids', () => {
    const shapes: Shape[] = [lineShape('a', 0, 0, 1, 0), lineShape('b', 0, 0, 2, 0)]
    const out = reverseSelectedPaths(shapes, new Set(['a']))
    expect(out[0].type === 'line' && out[0].start.x).toBe(1)
    expect(out[1].type === 'line' && out[1].start.x).toBe(0)
  })
})

describe('rotateSelectionAround', () => {
  it('rotates 90 degrees about explicit pivot', () => {
    const shapes: Shape[] = [lineShape('a', 1, 0, 2, 0)]
    const rotated = rotateSelectionAround(shapes, new Set(['a']), 90, { x: 0, y: 0 })
    const a = rotated[0]
    if (a.type !== 'line') throw new Error('expected line')
    expect(a.start.x).toBeCloseTo(0)
    expect(a.start.y).toBeCloseTo(1)
    expect(a.end.x).toBeCloseTo(0)
    expect(a.end.y).toBeCloseTo(2)
  })
})

describe('scaleSelectionNonUniform', () => {
  it('scales x and y independently about center', () => {
    const shapes: Shape[] = [lineShape('a', 0, 0, 10, 10)]
    const out = scaleSelectionNonUniform(shapes, new Set(['a']), 2, 0.5)
    const a = out[0]
    if (a.type !== 'line') throw new Error('expected line')
    // center is midpoint (5,5); scale by (2, 0.5) →  width 20, height 5
    expect(a.end.x - a.start.x).toBeCloseTo(20)
    expect(a.end.y - a.start.y).toBeCloseTo(5)
  })

  it('rejects non-positive factors', () => {
    const shapes: Shape[] = [lineShape('a', 0, 0, 1, 1)]
    expect(scaleSelectionNonUniform(shapes, new Set(['a']), 0, 1)).toBe(shapes)
    expect(scaleSelectionNonUniform(shapes, new Set(['a']), -1, 1)).toBe(shapes)
  })
})

describe('makeLineAxisAligned', () => {
  it('forces line to horizontal by matching start y', () => {
    const out = makeLineAxisAligned(lineShape('a', 0, 3, 10, 7), 'horizontal')
    if (out.type !== 'line') throw new Error('expected line')
    expect(out.end.y).toBe(3)
    expect(out.end.x).toBe(10)
  })

  it('forces line to vertical by matching start x', () => {
    const out = makeLineAxisAligned(lineShape('a', 4, 0, 8, 10), 'vertical')
    if (out.type !== 'line') throw new Error('expected line')
    expect(out.end.x).toBe(4)
    expect(out.end.y).toBe(10)
  })

  it('makeSelectedLinesAxisAligned ignores non-line shapes', () => {
    const shapes: Shape[] = [
      lineShape('a', 0, 3, 10, 7),
      {
        id: 'b',
        type: 'arc',
        layerId: 'layer-1',
        lineTypeId: 'cut',
        start: { x: 0, y: 0 },
        mid: { x: 5, y: 5 },
        end: { x: 10, y: 0 },
      },
    ]
    const out = makeSelectedLinesAxisAligned(shapes, new Set(['a', 'b']), 'horizontal')
    expect(out[1]).toBe(shapes[1])
    const a = out[0]
    expect(a.type === 'line' && a.end.y).toBe(3)
  })
})
