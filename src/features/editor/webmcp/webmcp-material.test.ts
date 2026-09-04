import { describe, expect, it } from 'vitest'
import type { PieceMeasurement } from './webmcp-measure'
import {
  DEFAULT_NESTING_EFFICIENCY,
  DEFAULT_THREAD_MULTIPLIER,
  estimateMaterial,
  MM2_PER_SQFT,
} from './webmcp-material'

function piece(overrides: Partial<PieceMeasurement> = {}): PieceMeasurement {
  return {
    pieceId: 'p1',
    name: 'Panel',
    quantity: 1,
    onFold: false,
    widthMm: 100,
    heightMm: 100,
    boundsMm: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    centerMm: { x: 50, y: 50 },
    cutAreaMm2: 10000,
    perimeterMm: 400,
    cutoutCount: 0,
    stitchHoleCount: 0,
    ...overrides,
  }
}

const noStock = {
  hideAreaMm2: null,
  nestingEfficiency: DEFAULT_NESTING_EFFICIENCY,
  pricePerSqft: null,
  pricePerHide: null,
  threadMultiplier: DEFAULT_THREAD_MULTIPLIER,
  stitchRunMm: 0,
}

describe('estimateMaterial', () => {
  it('counts every copy of a piece that gets cut', () => {
    const estimate = estimateMaterial([piece({ quantity: 4 })], noStock)
    expect(estimate.netAreaMm2).toBe(40000)
    expect(estimate.totalCutPieces).toBe(4)
  })

  it('buys enough leather to nest into, not just enough to cover the pieces', () => {
    const estimate = estimateMaterial([piece()], { ...noStock, nestingEfficiency: 0.5 })
    expect(estimate.grossAreaMm2).toBe(20000)
    expect(estimate.wasteAreaSqft).toBeCloseTo(10000 / MM2_PER_SQFT, 6)
  })

  it('rounds hides up, because half a hide cannot be bought', () => {
    const estimate = estimateMaterial([piece({ cutAreaMm2: MM2_PER_SQFT * 10 })], {
      ...noStock,
      nestingEfficiency: 1,
      hideAreaMm2: MM2_PER_SQFT * 24,
    })
    expect(estimate.hidesRequired).toBe(1)
  })

  it('prices by the hide when a hide price is given, and by the foot otherwise', () => {
    const shared = { ...noStock, nestingEfficiency: 1, hideAreaMm2: MM2_PER_SQFT * 24 }
    const byHide = estimateMaterial([piece({ cutAreaMm2: MM2_PER_SQFT * 30 })], {
      ...shared,
      pricePerHide: 200,
      pricePerSqft: 9,
    })
    expect(byHide.hidesRequired).toBe(2)
    expect(byHide.estimatedCost).toBe(400)

    const byFoot = estimateMaterial([piece({ cutAreaMm2: MM2_PER_SQFT * 30 })], {
      ...shared,
      pricePerSqft: 9,
    })
    expect(byFoot.estimatedCost).toBeCloseTo(270, 6)
  })

  it('says so when one piece is bigger than the stock it would be cut from', () => {
    const estimate = estimateMaterial([piece({ name: 'Bag back', cutAreaMm2: MM2_PER_SQFT * 30 })], {
      ...noStock,
      hideAreaMm2: MM2_PER_SQFT * 24,
    })
    expect(estimate.notes.join(' ')).toContain('Bag back')
  })

  it('flags a piece whose boundary never closed rather than quietly costing zero', () => {
    const estimate = estimateMaterial(
      [piece({ name: 'Gusset', cutAreaMm2: 0, perimeterMm: 0 })],
      noStock,
    )
    expect(estimate.notes.join(' ')).toContain('Gusset')
  })

  it('allows for the thread a saddle stitch actually consumes', () => {
    const estimate = estimateMaterial([piece()], { ...noStock, stitchRunMm: 1000 })
    expect(estimate.threadLengthM).toBeCloseTo(3.5, 6)
  })

  it('clamps a nonsense nesting efficiency instead of dividing by it', () => {
    const estimate = estimateMaterial([piece()], { ...noStock, nestingEfficiency: 0 })
    expect(estimate.nestingEfficiency).toBe(0.05)
    expect(Number.isFinite(estimate.grossAreaMm2)).toBe(true)
  })
})
