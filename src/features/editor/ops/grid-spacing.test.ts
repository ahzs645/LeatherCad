import { describe, expect, it } from 'vitest'
import { computeAdaptiveSpacing } from './grid-spacing'

describe('computeAdaptiveSpacing', () => {
  it('coarsens the visible grid when zoomed out', () => {
    expect(computeAdaptiveSpacing(0.1, 10)).toEqual({ major: 1000, minor: 200 })
    expect(computeAdaptiveSpacing(0.2, 10)).toEqual({ major: 500, minor: 100 })
  })

  it('keeps readable screen spacing at normal drafting zooms', () => {
    expect(computeAdaptiveSpacing(1, 10)).toEqual({ major: 100, minor: 20 })
    expect(computeAdaptiveSpacing(4, 10)).toEqual({ major: 20, minor: 4 })
  })

  it('reveals finer subdivisions when zoomed in', () => {
    expect(computeAdaptiveSpacing(20, 10)).toEqual({ major: 5, minor: 1 })
    expect(computeAdaptiveSpacing(100, 10)).toEqual({ major: 1, minor: 0.5 })
  })
})
