import { describe, expect, it } from 'vitest'
import { buildArmedCommand } from './tool-option-commands'

describe('tool option commands', () => {
  it('turns typed sizes into command-line input', () => {
    expect(buildArmedCommand('rectangle', { width: 40, height: 25 })).toBe('@40,25')
    expect(buildArmedCommand('circle', { radius: 12.5 })).toBe('12.5')
    expect(buildArmedCommand('ellipse', { radiusX: 30, radiusY: 10 })).toBe('30,10')
    expect(buildArmedCommand('line', { length: 50 })).toBe('50')
  })

  it('measures line angles counter-clockwise on screen (world Y points down)', () => {
    expect(buildArmedCommand('line', { length: 50, angle: 30 })).toBe('@50<-30')
    expect(buildArmedCommand('line', { length: 50, angle: 0 })).toBe('@50<0')
  })

  it('waits until every required size is present', () => {
    expect(buildArmedCommand('rectangle', { width: 40 })).toBeNull()
    expect(buildArmedCommand('circle', { radius: null })).toBeNull()
    expect(buildArmedCommand('text', { width: 10, height: 10 })).toBeNull()
  })
})
