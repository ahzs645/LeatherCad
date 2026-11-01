import type { DisplayUnit } from './unit-ops'

/**
 * Safe arithmetic for numeric fields: `100/3`, `20 + 5`, `(40-2)*2`,
 * `5/32in`, `1 1/4"`, `12.5cm`, full-width digits and ×/÷. There is no `eval`;
 * a small recursive-descent parser accepts only numbers, units, + − × ÷ and
 * parentheses.
 */

const UNIT_TO_MM: Record<string, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, '"': 25.4, inch: 25.4, inches: 25.4, ft: 304.8, "'": 304.8 }

type Token =
  | { kind: 'number'; value: number; unitMm: number | null; spaceBefore: boolean }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' }
  | { kind: 'paren'; value: '(' | ')' }

/** Converts full-width digits and common typographic operators to ASCII. */
export function normalizeNumericText(text: string) {
  return text
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[，]/g, ',')
    .replace(/[ー－−–—〜]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[×＊·]/g, '*')
    .replace(/[÷／]/g, '/')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[″”＂]/g, '"')
    .replace(/[′’]/g, "'")
}

function tokenize(source: string): Token[] | null {
  const tokens: Token[] = []
  let index = 0
  let sawSpace = false
  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) {
      sawSpace = true
      index += 1
      continue
    }
    if (/[0-9.]/.test(char)) {
      const match = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(source.slice(index))
      if (!match) return null
      index += match[0].length
      const unitMatch = /^\s*(mm|cm|inches|inch|in|ft|m(?![a-z])|"|')/i.exec(source.slice(index))
      let unitMm: number | null = null
      if (unitMatch) {
        unitMm = UNIT_TO_MM[unitMatch[1].toLowerCase()] ?? null
        index += unitMatch[0].length
      }
      tokens.push({ kind: 'number', value: Number(match[0]), unitMm, spaceBefore: sawSpace })
      sawSpace = false
      continue
    }
    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ kind: 'op', value: char })
    } else if (char === '(' || char === ')') {
      tokens.push({ kind: 'paren', value: char })
    } else {
      return null
    }
    sawSpace = false
    index += 1
  }
  return tokens
}

/**
 * A unit written after a simple fraction applies to the whole fraction
 * (`5/32in`), and to a preceding whole number of a mixed number (`1 1/4"`).
 */
function foldFractionUnits(tokens: Token[]): Token[] {
  const result: Token[] = []
  for (let index = 0; index < tokens.length; index += 1) {
    const numerator = tokens[index]
    const slash = tokens[index + 1]
    const denominator = tokens[index + 2]
    const before = result[result.length - 1]
    const startsFraction = numerator.kind === 'number' && numerator.unitMm === null
      && slash?.kind === 'op' && slash.value === '/'
      && denominator?.kind === 'number' && denominator.unitMm !== null
      && !(before?.kind === 'op' && (before.value === '*' || before.value === '/'))
    if (!startsFraction) {
      result.push(numerator)
      continue
    }
    let value = numerator.value / denominator.value
    let spaceBefore = numerator.spaceBefore
    const whole = result[result.length - 1]
    const beforeWhole = result[result.length - 2]
    if (whole?.kind === 'number' && whole.unitMm === null && numerator.spaceBefore
      && !(beforeWhole?.kind === 'op' && (beforeWhole.value === '*' || beforeWhole.value === '/'))) {
      result.pop()
      value += whole.value
      spaceBefore = whole.spaceBefore
    }
    result.push({ kind: 'number', value, unitMm: denominator.unitMm, spaceBefore })
    index += 2
  }
  return result
}

/**
 * Mixed numbers: `1 1/4` means 1 + 1/4. Insert `+` where a whole number is
 * followed, after a space, by a simple fraction `a/b`.
 */
function insertMixedNumberAddition(tokens: Token[]): Token[] {
  const result: Token[] = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const previous = result[result.length - 1]
    const isFractionStart = token.kind === 'number' && token.spaceBefore
      && tokens[index + 1]?.kind === 'op' && tokens[index + 1]?.value === '/'
      && tokens[index + 2]?.kind === 'number'
    if (isFractionStart && previous?.kind === 'number' && previous.unitMm === null) {
      result.push({ kind: 'op', value: '+' })
    }
    result.push(token)
  }
  return result
}

/**
 * Evaluates `text` in `displayUnit`. Literals with an explicit unit are
 * converted into the display unit first. Returns null for anything that is not
 * a complete, finite expression.
 */
export function evaluateNumericExpression(text: string, displayUnit: DisplayUnit | null = null): number | null {
  const normalized = normalizeNumericText(text).trim()
  if (!normalized) return null
  const raw = tokenize(normalized)
  if (!raw || raw.length === 0) return null
  const tokens = insertMixedNumberAddition(foldFractionUnits(raw))
  const displayMm = displayUnit === 'in' ? 25.4 : 1
  let position = 0

  const peek = () => tokens[position]
  const literal = (token: Extract<Token, { kind: 'number' }>) => {
    if (token.unitMm === null) return token.value
    if (displayUnit === null) return Number.NaN
    return (token.value * token.unitMm) / displayMm
  }

  function parsePrimary(): number {
    const token = peek()
    if (!token) return Number.NaN
    if (token.kind === 'number') {
      position += 1
      return literal(token)
    }
    if (token.kind === 'op' && (token.value === '-' || token.value === '+')) {
      position += 1
      const value = parsePrimary()
      return token.value === '-' ? -value : value
    }
    if (token.kind === 'paren' && token.value === '(') {
      position += 1
      const value = parseSum()
      const closing = peek()
      if (!closing || closing.kind !== 'paren' || closing.value !== ')') return Number.NaN
      position += 1
      return value
    }
    return Number.NaN
  }

  function parseProduct(): number {
    let value = parsePrimary()
    for (let token = peek(); token?.kind === 'op' && (token.value === '*' || token.value === '/'); token = peek()) {
      position += 1
      const right = parsePrimary()
      value = token.value === '*' ? value * right : value / right
    }
    return value
  }

  function parseSum(): number {
    let value = parseProduct()
    for (let token = peek(); token?.kind === 'op' && (token.value === '+' || token.value === '-'); token = peek()) {
      position += 1
      const right = parseProduct()
      value = token.value === '+' ? value + right : value - right
    }
    return value
  }

  const result = parseSum()
  if (position !== tokens.length || !Number.isFinite(result)) return null
  return result
}

/** Length expression in `displayUnit`, returned in millimetres. */
export function evaluateLengthExpressionMm(text: string, displayUnit: DisplayUnit): number | null {
  const value = evaluateNumericExpression(text, displayUnit)
  if (value === null) return null
  return displayUnit === 'in' ? value * 25.4 : value
}

/** True when the text is more than a plain number, so the evaluated value is worth showing. */
export function isComputedExpression(text: string) {
  return /[+*/()a-z"'×÷]|\d\s+\d|\d-/.test(normalizeNumericText(text).trim().toLowerCase())
}
