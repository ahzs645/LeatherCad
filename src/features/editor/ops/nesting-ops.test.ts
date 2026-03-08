import { describe, it, expect } from 'vitest'
import {
  nestPieces,
  shapesToNestingPieces,
  computeNFP,
  DEFAULT_NESTING_CONFIG,
  type NestingPiece,
} from './nesting-ops'
import type { Shape } from '../cad/cad-types'

const smallSquare: NestingPiece = {
  id: 'sq1',
  polygon: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
  quantity: 1,
}

describe('nestPieces', () => {
  it('places a single piece', () => {
    const result = nestPieces([smallSquare], 100, 100, { ...DEFAULT_NESTING_CONFIG, iterations: 1 })
    expect(result.placements).toHaveLength(1)
    expect(result.unplaced).toHaveLength(0)
    expect(result.wastePercent).toBeGreaterThan(0)
  })

  it('places multiple small pieces in a large hide', () => {
    const pieces: NestingPiece[] = [
      { ...smallSquare, id: 'a', quantity: 3 },
    ]
    const result = nestPieces(pieces, 200, 200, { ...DEFAULT_NESTING_CONFIG, iterations: 1 })
    expect(result.placements.length).toBe(3)
    expect(result.unplaced).toHaveLength(0)
  })

  it('reports unplaced pieces when hide is too small', () => {
    const pieces: NestingPiece[] = [
      { ...smallSquare, id: 'big', polygon: [
        { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 },
      ], quantity: 1 },
    ]
    const result = nestPieces(pieces, 20, 20, { ...DEFAULT_NESTING_CONFIG, iterations: 1 })
    expect(result.unplaced.length).toBeGreaterThan(0)
  })

  it('calculates waste percentage', () => {
    const result = nestPieces([smallSquare], 100, 100, { ...DEFAULT_NESTING_CONFIG, iterations: 1 })
    expect(result.totalArea).toBe(100 * 100)
    expect(result.wastePercent).toBeGreaterThan(0)
    expect(result.wastePercent).toBeLessThan(100)
  })
})

describe('computeNFP', () => {
  it('returns a polygon', () => {
    const fixed = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]
    const moving = [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 },
    ]
    const nfp = computeNFP(fixed, moving)
    expect(nfp.length).toBeGreaterThan(0)
  })
})

describe('shapesToNestingPieces', () => {
  it('converts selected line shapes to nesting pieces', () => {
    const shapes: Shape[] = [
      { id: 's1', type: 'line', layerId: 'l1', lineTypeId: 'lt1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { id: 's2', type: 'line', layerId: 'l1', lineTypeId: 'lt1', start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
      { id: 's3', type: 'line', layerId: 'l1', lineTypeId: 'lt1', start: { x: 10, y: 10 }, end: { x: 0, y: 10 } },
      { id: 's4', type: 'line', layerId: 'l1', lineTypeId: 'lt1', start: { x: 0, y: 10 }, end: { x: 0, y: 0 } },
    ]
    const selected = new Set(['s1', 's2', 's3', 's4'])
    const pieces = shapesToNestingPieces(shapes, selected)
    expect(pieces.length).toBeGreaterThanOrEqual(1)
    expect(pieces[0].polygon.length).toBeGreaterThan(0)
  })

  it('returns empty for no selected shapes', () => {
    const shapes: Shape[] = [
      { id: 's1', type: 'line', layerId: 'l1', lineTypeId: 'lt1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    ]
    const pieces = shapesToNestingPieces(shapes, new Set())
    expect(pieces).toHaveLength(0)
  })
})
