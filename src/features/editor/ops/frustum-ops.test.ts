import { describe, it, expect } from 'vitest'
import { computeFrustumUnroll } from './frustum-ops'

describe('computeFrustumUnroll', () => {
  it('returns null for cylinder case', () => {
    expect(computeFrustumUnroll({ topRadius: 30, bottomRadius: 30, height: 80 })).toBeNull()
  })

  it('matches closed-form geometry for a truncated cone', () => {
    const result = computeFrustumUnroll({ topRadius: 30, bottomRadius: 40, height: 80 })
    expect(result).not.toBeNull()
    if (!result) return
    // slantHeight = hypot(80, 10) = sqrt(6500)
    expect(result.slantHeight).toBeCloseTo(Math.sqrt(6500), 6)
    // outerRadius = slantHeight * 40 / 10 = 4 * slantHeight
    expect(result.outerRadius).toBeCloseTo(4 * Math.sqrt(6500), 6)
    // innerRadius = slantHeight * 30 / 10 = 3 * slantHeight
    expect(result.innerRadius).toBeCloseTo(3 * Math.sqrt(6500), 6)
    // sectorAngleRad = 2π * 10 / slantHeight
    expect(result.sectorAngleRad).toBeCloseTo((2 * Math.PI * 10) / Math.sqrt(6500), 6)
    // arc-length identity: outer arc = bottom-circle circumference = 2π·40
    expect(result.outerArcLength).toBeCloseTo(2 * Math.PI * 40, 6)
    // inner arc = top-circle circumference = 2π·30
    expect(result.innerArcLength).toBeCloseTo(2 * Math.PI * 30, 6)
  })

  it('is symmetric when top/bottom are swapped', () => {
    const a = computeFrustumUnroll({ topRadius: 20, bottomRadius: 50, height: 100 })!
    const b = computeFrustumUnroll({ topRadius: 50, bottomRadius: 20, height: 100 })!
    expect(a.innerRadius).toBeCloseTo(b.innerRadius, 6)
    expect(a.outerRadius).toBeCloseTo(b.outerRadius, 6)
    expect(a.sectorAngleRad).toBeCloseTo(b.sectorAngleRad, 6)
  })
})
