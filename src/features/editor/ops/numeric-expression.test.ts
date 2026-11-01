import { describe, expect, it } from 'vitest'
import { evaluateLengthExpressionMm, evaluateNumericExpression, isComputedExpression, normalizeNumericText } from './numeric-expression'

describe('numeric expressions', () => {
  it('evaluates arithmetic with precedence and parentheses', () => {
    expect(evaluateNumericExpression('100/4')).toBe(25)
    expect(evaluateNumericExpression('20 + 5 * 2')).toBe(30)
    expect(evaluateNumericExpression('(20 + 5) * 2')).toBe(50)
    expect(evaluateNumericExpression('-3 + 10')).toBe(7)
    expect(evaluateNumericExpression('2.5e1')).toBe(25)
    expect(evaluateNumericExpression('.5')).toBe(0.5)
  })

  it('normalizes full-width digits and typographic operators', () => {
    expect(normalizeNumericText('１２．５×２')).toBe('12.5*2')
    expect(evaluateNumericExpression('１２．５×２')).toBe(25)
    expect(evaluateNumericExpression('10÷4')).toBe(2.5)
  })

  it('converts unit suffixes into the display unit', () => {
    expect(evaluateLengthExpressionMm('1in', 'mm')).toBeCloseTo(25.4)
    expect(evaluateLengthExpressionMm('5/32in', 'mm')).toBeCloseTo(3.96875)
    expect(evaluateLengthExpressionMm('1 1/4"', 'mm')).toBeCloseTo(31.75)
    expect(evaluateLengthExpressionMm('1in + 5', 'mm')).toBeCloseTo(30.4)
    expect(evaluateLengthExpressionMm('2cm', 'mm')).toBe(20)
    expect(evaluateLengthExpressionMm('10/2', 'in')).toBeCloseTo(127)
    expect(evaluateLengthExpressionMm('25.4mm', 'in')).toBeCloseTo(25.4)
    expect(evaluateLengthExpressionMm('1 1/2', 'in')).toBeCloseTo(38.1)
  })

  it('rejects incomplete, unsafe or non-finite input', () => {
    for (const bad of ['', '   ', '2+', '(3', '3)', 'abc', 'alert(1)', '1/0', '2**3', '1,5']) {
      expect(evaluateNumericExpression(bad)).toBeNull()
    }
    expect(evaluateNumericExpression('3in')).toBeNull()
  })

  it('flags computed input but not plain numbers', () => {
    expect(isComputedExpression('12.5')).toBe(false)
    expect(isComputedExpression('-12.5')).toBe(false)
    expect(isComputedExpression('100/3')).toBe(true)
    expect(isComputedExpression('5/32in')).toBe(true)
  })
})
