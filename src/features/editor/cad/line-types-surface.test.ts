import { describe, expect, it } from 'vitest'
import { adaptStrokeColorForLightSurface, createDefaultLineTypes, lineTypeColorForSurface, parseLineType, relativeLuminance } from './line-types'

describe('line type colours per drawing surface', () => {
  it('uses the light-surface colour on light and the base colour on dark', () => {
    const lineType = { color: '#ffffff', colorLight: '#000000' }
    expect(lineTypeColorForSurface(lineType, 'dark')).toBe('#ffffff')
    expect(lineTypeColorForSurface(lineType, 'light')).toBe('#000000')
  })

  it('derives a readable ink for pale colours without a light variant', () => {
    expect(adaptStrokeColorForLightSurface('#ffffff')).toBe('#1f1b16')
    expect(adaptStrokeColorForLightSurface('#1d4ed8')).toBe('#1d4ed8')
    const cyan = adaptStrokeColorForLightSurface('#22d3ee')
    expect(cyan).not.toBe('#22d3ee')
    expect(parseInt(cyan.slice(1, 3), 16)).toBeLessThan(0x22)
  })

  it('gives every default slot a colour that reads on the light surface', () => {
    for (const lineType of createDefaultLineTypes()) {
      expect(relativeLuminance(lineTypeColorForSurface(lineType, 'light'))).toBeLessThanOrEqual(0.3)
    }
  })

  it('keeps a stored light colour when parsing and ignores invalid ones', () => {
    expect(parseLineType({ id: 'a', color: '#ffffff', colorLight: '#000000' }, 0)?.colorLight).toBe('#000000')
    expect(parseLineType({ id: 'b', color: '#ffffff', colorLight: 'black' }, 0)).not.toHaveProperty('colorLight')
  })
})
