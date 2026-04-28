import { describe, expect, it } from 'vitest'
import { resolveAdaptiveTextFontSize } from './canvas-geometry'

describe('resolveAdaptiveTextFontSize', () => {
  it('raises small text to the screen minimum when zoomed out', () => {
    expect(resolveAdaptiveTextFontSize(2, 1)).toBe(11)
    expect(resolveAdaptiveTextFontSize(2, 2)).toBe(5.5)
  })

  it('preserves authored size while it is inside the readable screen range', () => {
    expect(resolveAdaptiveTextFontSize(12, 1)).toBe(12)
  })

  it('does not let high zoom force text above the screen cap', () => {
    expect(resolveAdaptiveTextFontSize(2, 10)).toBe(1.4)
    expect(resolveAdaptiveTextFontSize(12, 40)).toBe(0.35)
  })

  it('allows callers to tune the screen-space range', () => {
    expect(resolveAdaptiveTextFontSize(2, 1, 9, 16)).toBe(9)
    expect(resolveAdaptiveTextFontSize(20, 1, 9, 16)).toBe(16)
  })
})
