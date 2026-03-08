import type { Point, Shape } from './cad-types'
import { distance } from './cad-geometry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DimensionParam = {
  id: string
  name: string
  valueMm: number
  minMm?: number
  maxMm?: number
  expression?: string
}

export type DimensionBinding = {
  id: string
  paramId: string
  shapeId: string
  anchorFrom: 'start' | 'end' | 'mid' | 'control'
  anchorTo: 'start' | 'end' | 'mid' | 'control'
  axis: 'x' | 'y' | 'distance'
}

// ---------------------------------------------------------------------------
// Expression evaluator – recursive descent, no eval()
// ---------------------------------------------------------------------------

type Token =
  | { type: 'number'; value: number }
  | { type: 'name'; value: string }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      i++
      continue
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }

    if (/[0-9.]/.test(ch)) {
      let num = ''
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i]
        i++
      }
      tokens.push({ type: 'number', value: parseFloat(num) })
      continue
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let name = ''
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        name += expr[i]
        i++
      }
      tokens.push({ type: 'name', value: name })
      continue
    }

    throw new Error(`Unexpected character '${ch}' in expression`)
  }
  return tokens
}

/**
 * Recursive descent parser for arithmetic expressions.
 *
 * Grammar:
 *   expr   -> term (('+' | '-') term)*
 *   term   -> unary (('*' | '/') unary)*
 *   unary  -> '-' unary | primary
 *   primary -> NUMBER | NAME | '(' expr ')'
 */
export function evaluateExpression(
  expr: string,
  params: Map<string, number>,
): number {
  const tokens = tokenize(expr)
  let pos = 0

  function peek(): Token | undefined {
    return tokens[pos]
  }

  function consume(): Token {
    return tokens[pos++]
  }

  function parseExpr(): number {
    let left = parseTerm()
    while (peek()?.type === 'op' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume().value
      const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm(): number {
    let left = parseUnary()
    while (peek()?.type === 'op' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = consume().value
      const right = parseUnary()
      left = op === '*' ? left * right : left / right
    }
    return left
  }

  function parseUnary(): number {
    if (peek()?.type === 'op' && peek()!.value === '-') {
      consume()
      return -parseUnary()
    }
    return parsePrimary()
  }

  function parsePrimary(): number {
    const token = peek()
    if (!token) throw new Error('Unexpected end of expression')

    if (token.type === 'number') {
      consume()
      return token.value
    }

    if (token.type === 'name') {
      consume()
      const val = params.get(token.value)
      if (val === undefined) {
        throw new Error(`Unknown parameter '${token.value}'`)
      }
      return val
    }

    if (token.type === 'paren' && token.value === '(') {
      consume()
      const val = parseExpr()
      const closing = consume()
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error('Expected closing parenthesis')
      }
      return val
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`)
  }

  const result = parseExpr()
  if (pos !== tokens.length) {
    throw new Error('Unexpected tokens after expression')
  }
  return result
}

// ---------------------------------------------------------------------------
// resolveAllParams – topological sort on expression dependencies
// ---------------------------------------------------------------------------

export function resolveAllParams(params: DimensionParam[]): Map<string, number> {
  const byName = new Map<string, DimensionParam>()
  for (const p of params) {
    byName.set(p.name, p)
  }

  // Extract referenced names from an expression string
  function getDeps(expr: string): string[] {
    const deps: string[] = []
    const re = /[a-zA-Z_][a-zA-Z0-9_]*/g
    let m: RegExpExecArray | null
    while ((m = re.exec(expr)) !== null) {
      if (byName.has(m[0])) {
        deps.push(m[0])
      }
    }
    return deps
  }

  // Topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>()
  const edges = new Map<string, string[]>() // dependency -> dependents
  for (const p of params) {
    inDegree.set(p.name, 0)
    edges.set(p.name, [])
  }

  for (const p of params) {
    if (p.expression) {
      const deps = getDeps(p.expression)
      inDegree.set(p.name, deps.length)
      for (const dep of deps) {
        edges.get(dep)?.push(p.name)
      }
    }
  }

  const queue: string[] = []
  for (const [name, deg] of inDegree) {
    if (deg === 0) queue.push(name)
  }

  const resolved = new Map<string, number>()
  const order: string[] = []

  while (queue.length > 0) {
    const name = queue.shift()!
    order.push(name)
    const p = byName.get(name)!

    let value: number
    if (p.expression) {
      value = evaluateExpression(p.expression, resolved)
    } else {
      value = p.valueMm
    }

    if (p.minMm !== undefined) value = Math.max(value, p.minMm)
    if (p.maxMm !== undefined) value = Math.min(value, p.maxMm)
    resolved.set(name, value)

    for (const dependent of edges.get(name) ?? []) {
      const deg = (inDegree.get(dependent) ?? 1) - 1
      inDegree.set(dependent, deg)
      if (deg === 0) queue.push(dependent)
    }
  }

  if (order.length !== params.length) {
    throw new Error('Circular dependency detected among dimension parameters')
  }

  return resolved
}

// ---------------------------------------------------------------------------
// Anchor helpers
// ---------------------------------------------------------------------------

function getAnchorPoint(
  shape: Shape,
  anchor: 'start' | 'end' | 'mid' | 'control',
): Point {
  if (anchor === 'start') return shape.start
  if (anchor === 'end') return shape.end
  if (anchor === 'mid') {
    if (shape.type === 'arc') return shape.mid
    // For other shapes, compute midpoint of start/end
    return {
      x: (shape.start.x + shape.end.x) / 2,
      y: (shape.start.y + shape.end.y) / 2,
    }
  }
  if (anchor === 'control') {
    if (shape.type === 'bezier') return shape.control
    if (shape.type === 'arc') return shape.mid
    // Fallback: midpoint
    return {
      x: (shape.start.x + shape.end.x) / 2,
      y: (shape.start.y + shape.end.y) / 2,
    }
  }
  return shape.start
}

function setAnchorPoint(
  shape: Shape,
  anchor: 'start' | 'end' | 'mid' | 'control',
  point: Point,
): Shape {
  const clone = { ...shape }
  if (anchor === 'start') {
    return { ...clone, start: point }
  }
  if (anchor === 'end') {
    return { ...clone, end: point }
  }
  if (anchor === 'mid') {
    if (clone.type === 'arc') return { ...clone, mid: point }
    // For non-arc shapes, 'mid' is virtual – move end to match
    return { ...clone, end: point }
  }
  if (anchor === 'control') {
    if (clone.type === 'bezier') return { ...clone, control: point }
    if (clone.type === 'arc') return { ...clone, mid: point }
    return clone
  }
  return clone
}

// ---------------------------------------------------------------------------
// applyDimensionBindings
// ---------------------------------------------------------------------------

export function applyDimensionBindings(
  shapes: Shape[],
  bindings: DimensionBinding[],
  resolvedParams: Map<string, number>,
): Shape[] {
  const shapeMap = new Map<string, Shape>()
  for (const s of shapes) {
    shapeMap.set(s.id, { ...s })
  }

  for (const binding of bindings) {
    const paramValue = resolvedParams.get(binding.paramId)
    if (paramValue === undefined) continue

    const shape = shapeMap.get(binding.shapeId)
    if (!shape) continue

    const from = getAnchorPoint(shape, binding.anchorFrom)
    const to = getAnchorPoint(shape, binding.anchorTo)

    let newTo: Point

    if (binding.axis === 'x') {
      newTo = { x: from.x + paramValue, y: to.y }
    } else if (binding.axis === 'y') {
      newTo = { x: to.x, y: from.y + paramValue }
    } else {
      // distance – keep direction from->to, set magnitude
      const dx = to.x - from.x
      const dy = to.y - from.y
      const currentDist = Math.hypot(dx, dy)
      if (currentDist < 1e-9) {
        // If the two anchors coincide, extend along X by default
        newTo = { x: from.x + paramValue, y: from.y }
      } else {
        const scale = paramValue / currentDist
        newTo = {
          x: from.x + dx * scale,
          y: from.y + dy * scale,
        }
      }
    }

    const updatedShape = setAnchorPoint(shape, binding.anchorTo, newTo)
    shapeMap.set(shape.id, updatedShape)
  }

  return shapes.map((s) => shapeMap.get(s.id) ?? s)
}

// ---------------------------------------------------------------------------
// measureDimension
// ---------------------------------------------------------------------------

export function measureDimension(
  shape: Shape,
  binding: DimensionBinding,
): number {
  const from = getAnchorPoint(shape, binding.anchorFrom)
  const to = getAnchorPoint(shape, binding.anchorTo)

  if (binding.axis === 'x') return to.x - from.x
  if (binding.axis === 'y') return to.y - from.y
  return distance(from, to)
}
