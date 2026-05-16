import { describe, expect, it } from 'vitest'
import { computeStampPlacements, generateLetterStampPreview } from './letter-stamp-ops'

const base = {
  stampSizeMm: 10,
  spacingMm: 2,
  lineSpacingMm: 4,
  alignment: 'left' as const,
  origin: { x: 0, y: 0 },
  fontFamily: 'serif',
  layerId: 'layer-1',
  lineTypeId: 'line-1',
}

describe('computeStampPlacements', () => {
  it('places characters at expected grid positions with no rotation', () => {
    const placements = computeStampPlacements({ ...base, text: 'AB', baselineAngleDeg: 0 })
    expect(placements).toHaveLength(2)
    // First char center: origin.x + 0*(10+2) + 10/2 = 5, origin.y + 0*(10+4) + 10/2 = 5
    expect(placements[0].center).toEqual({ x: 5, y: 5 })
    // Second char: origin.x + 1*(10+2) + 5 = 17, same y = 5
    expect(placements[1].center).toEqual({ x: 17, y: 5 })
  })

  it('rotates placement centers when baselineAngleDeg is set', () => {
    const flat = computeStampPlacements({ ...base, text: 'AB', baselineAngleDeg: 0 })
    const rotated = computeStampPlacements({ ...base, text: 'AB', baselineAngleDeg: 90 })
    // Centers must differ
    expect(rotated[0].center).not.toEqual(flat[0].center)
    // At 90° a point (5, 5) rotated about (0,0) becomes (-5, 5)
    expect(rotated[0].center.x).toBeCloseTo(-5, 1)
    expect(rotated[0].center.y).toBeCloseTo(5, 1)
  })

  it('skips spaces in placements', () => {
    const placements = computeStampPlacements({ ...base, text: 'A B', baselineAngleDeg: 0 })
    expect(placements).toHaveLength(2)
    expect(placements.map((p) => p.character)).toEqual(['A', 'B'])
  })
})

describe('generateLetterStampPreview – text shape rotation', () => {
  it('produces horizontal text boxes when angle is 0', () => {
    const result = generateLetterStampPreview({ ...base, text: 'A', baselineAngleDeg: 0 })
    const shape = result.textShapes[0]
    // start and end should share the same Y (horizontal baseline)
    expect(shape.start.y).toBeCloseTo(shape.end.y, 5)
    // end.x - start.x should equal stampSizeMm
    expect(shape.end.x - shape.start.x).toBeCloseTo(base.stampSizeMm, 5)
  })

  it('rotates text shape endpoints with baseline angle', () => {
    const result90 = generateLetterStampPreview({ ...base, text: 'A', baselineAngleDeg: 90 })
    const shape = result90.textShapes[0]
    // At 90° the baseline is vertical: start and end differ mainly in Y, not X
    const dx = Math.abs(shape.end.x - shape.start.x)
    const dy = Math.abs(shape.end.y - shape.start.y)
    expect(dy).toBeGreaterThan(dx)
  })

  it('text box diagonal equals stampSizeMm regardless of rotation angle', () => {
    const size = 10
    for (const angle of [0, 30, 45, 90, 135, 180]) {
      const result = generateLetterStampPreview({ ...base, text: 'X', stampSizeMm: size, baselineAngleDeg: angle })
      const shape = result.textShapes[0]
      const dist = Math.hypot(shape.end.x - shape.start.x, shape.end.y - shape.start.y)
      expect(dist).toBeCloseTo(size, 1)
    }
  })

  it('produces same shape count for multi-line rotated text', () => {
    const flat = generateLetterStampPreview({ ...base, text: 'AB\nCD', baselineAngleDeg: 0 })
    const rotated = generateLetterStampPreview({ ...base, text: 'AB\nCD', baselineAngleDeg: 45 })
    expect(rotated.textShapes).toHaveLength(flat.textShapes.length)
    expect(rotated.guideLines).toHaveLength(flat.guideLines.length)
  })
})
