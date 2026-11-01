import { describe, expect, it } from 'vitest'
import { classifyTick, formatInchFraction, formatRulerLabel, referenceTickLadder, tickIndexRange } from './reference-grid'

describe('reference grid ladder', () => {
  it('picks the smallest 1-2-5 millimetre tick that is at least 10 screen pixels', () => {
    expect(referenceTickLadder(1, 'mm')).toEqual({ tickMm: 10, smallEvery: 5, largeEvery: 10 })
    expect(referenceTickLadder(4, 'mm').tickMm).toBe(5)
    expect(referenceTickLadder(10, 'mm').tickMm).toBe(1)
    expect(referenceTickLadder(200, 'mm').tickMm).toBe(0.1)
    expect(referenceTickLadder(0.001, 'mm').tickMm).toBe(500)
  })

  it('uses binary inch fractions with 4/8 subdivisions', () => {
    const ladder = referenceTickLadder(1, 'in')
    expect(ladder.tickMm).toBeCloseTo(25.4 / 2)
    expect(ladder.smallEvery).toBe(4)
    expect(ladder.largeEvery).toBe(8)
  })

  it('classifies axis, major, small and minor ticks', () => {
    const ladder = referenceTickLadder(1, 'mm')
    expect(classifyTick(0, ladder)).toBe('axis')
    expect(classifyTick(10, ladder)).toBe('major')
    expect(classifyTick(-20, ladder)).toBe('major')
    expect(classifyTick(5, ladder)).toBe('small')
    expect(classifyTick(3, ladder)).toBe('minor')
  })

  it('returns the inclusive index range covering a world span', () => {
    const ladder = referenceTickLadder(1, 'mm')
    expect(tickIndexRange(-25, 31, ladder)).toEqual({ first: -2, last: 3 })
  })
})

describe('ruler labels', () => {
  it('formats millimetres with precision that shrinks as values grow', () => {
    expect(formatRulerLabel(0, 'mm')).toBe('0')
    expect(formatRulerLabel(120, 'mm')).toBe('120')
    expect(formatRulerLabel(-2.5, 'mm')).toBe('-2.5')
    expect(formatRulerLabel(0.25, 'mm')).toBe('0.25')
  })

  it('formats inches as reduced mixed fractions', () => {
    expect(formatInchFraction(25.4)).toBe('1"')
    expect(formatInchFraction(25.4 * 1.25)).toBe('1 1/4"')
    expect(formatInchFraction(-25.4 * 0.5)).toBe('-1/2"')
    expect(formatInchFraction(25.4 * (5 / 32))).toBe('5/32"')
    expect(formatRulerLabel(25.4 * 2, 'in')).toBe('2"')
  })
})
