import { describe, expect, it } from 'vitest'
import { resolveAdaptiveTextFontSize } from './canvas-geometry'

describe('resolveAdaptiveTextFontSize', () => {
  it('preserves authored size until it would exceed the screen cap', () => {
    expect(resolveAdaptiveTextFontSize(2, 2)).toBe(2)
    expect(resolveAdaptiveTextFontSize(2, 10)).toBe(1.4)
  })

  it('does not let high zoom force text above the screen cap', () => {
    expect(resolveAdaptiveTextFontSize(12, 40)).toBe(0.35)
  })
})
