import type { CubicShape, Point, Shape } from './cad-types'
import { distance, isShapeLike } from './cad-geometry'
import { nativeCurveEndpoints, nativeCurvePointAt, transformNativeCurve } from './native-curve-ops'
import { evaluateShapeAt } from '../ops/geometry/path-core'
import { buildGroupAccess, isShapeLocked } from '../ops/shape-access'
import type { ConstraintAccess } from '../solver/constraint-types'

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

export type DimensionAnchor = 'start' | 'end' | 'mid' | 'control' | 'control1' | 'control2' | 'center' | 'quarter' | 'threeQuarter'

export type DimensionBinding = {
  id: string
  paramId: string
  shapeId: string
  anchorFrom: DimensionAnchor
  anchorTo: DimensionAnchor
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

// Cubic landmarks are affine combinations of the four stored controls.
function cubicWeights(anchor: DimensionAnchor): number[] {
  if (anchor === 'start') return [1, 0, 0, 0]
  if (anchor === 'end') return [0, 0, 0, 1]
  if (anchor === 'control' || anchor === 'control1') return [0, 1, 0, 0]
  if (anchor === 'control2') return [0, 0, 1, 0]
  if (anchor === 'center') return [0.5, 0, 0, 0.5]
  const t = anchor === 'quarter' ? 0.25 : anchor === 'threeQuarter' ? 0.75 : 0.5, u = 1 - t
  return [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3]
}

function getAnchorPoint(shape: Shape, anchor: DimensionAnchor): Point {
  if (shape.type === 'cubic') {
    const weights = cubicWeights(anchor), points = [shape.start, shape.control1, shape.control2, shape.end]
    return points.reduce((sum, point, i) => ({ x: sum.x + point.x * weights[i], y: sum.y + point.y * weights[i] }), { x: 0, y: 0 })
  }
  if (shape.type === 'ellipse') {
    if (anchor === 'center') return shape.center
    if (anchor === 'control1' || anchor === 'control2') throw new Error(`An ellipse has no ${anchor} anchor; use center and parameter landmarks`)
    if (anchor === 'start' || anchor === 'end') return nativeCurveEndpoints(shape)[anchor]
    return nativeCurvePointAt(shape, anchor === 'quarter' ? 0.25 : anchor === 'threeQuarter' ? 0.75 : 0.5)
  }
  if (anchor === 'start') return shape.start
  if (anchor === 'end') return shape.end
  if (anchor === 'control2') throw new Error('The control2 anchor requires a cubic curve')
  if (anchor === 'quarter' || anchor === 'threeQuarter') return evaluateShapeAt(shape, anchor === 'quarter' ? 0.25 : 0.75)
  if (anchor === 'mid' && shape.type === 'arc') return shape.mid
  if (anchor === 'control' || anchor === 'control1') {
    if (shape.type === 'bezier') return shape.control
    if (shape.type === 'arc') return shape.mid
  }
  return { x: (shape.start.x + shape.end.x) / 2, y: (shape.start.y + shape.end.y) / 2 }
}

function moveCubicAnchor(shape: CubicShape, from: DimensionAnchor, to: DimensionAnchor, delta: Point): CubicShape {
  const f = cubicWeights(from), t = cubicWeights(to), dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0)
  const projection = dot(f, t) / dot(f, f), independent = t.map((value, i) => value - projection * f[i]), denominator = dot(t, independent)
  if (Math.abs(denominator) < 1e-12) throw new Error('Coincident cubic anchor definitions cannot have a nonzero dimension')
  const updated = { ...shape }
  for (const [i, key] of (['start', 'control1', 'control2', 'end'] as const).entries()) {
    updated[key] = { x: shape[key].x + independent[i] / denominator * delta.x, y: shape[key].y + independent[i] / denominator * delta.y }
  }
  return updated
}

/** Fix the source landmark and move the target using a nonsingular affine map. */
function moveEllipseAnchor(shape: Extract<Shape, { type: 'ellipse' }>, from: Point, to: Point, target: Point): Shape {
  const vx = to.x - from.x, vy = to.y - from.y, wx = target.x - from.x, wy = target.y - from.y
  const length = Math.hypot(vx, vy), targetLength = Math.hypot(wx, wy)
  if (length < 1e-10) throw new Error('Coincident ellipse landmarks cannot be separated by an affine dimension')
  if (targetLength < 1e-10) throw new Error('A dimension cannot collapse distinct ellipse landmarks')
  const ux = vx / length, uy = vy / length, nx = -uy, ny = ux, zx = wx / length, zy = wy / length
  // Retain the perpendicular direction unless that would make the map singular.
  const dot = (vx * wx + vy * wy) / (length * targetLength)
  const px = Math.abs(dot) < 1e-8 ? -wy / targetLength : nx, py = Math.abs(dot) < 1e-8 ? wx / targetLength : ny
  const a = zx * ux + px * nx, b = zy * ux + py * nx, c = zx * uy + px * ny, d = zy * uy + py * ny
  return transformNativeCurve(shape, [a, b, c, d, from.x - a * from.x - c * from.y, from.y - b * from.x - d * from.y])
}

function moveLegacyAnchor(shape: Exclude<Shape, { type: 'cubic' | 'ellipse' }>, anchor: DimensionAnchor, point: Point): Shape {
  if (anchor === 'start' || anchor === 'end') return { ...shape, [anchor]: point }
  if (anchor === 'control' || anchor === 'control1') {
    if (shape.type === 'bezier') return { ...shape, control: point }
    if (shape.type === 'arc') return { ...shape, mid: point }
  }
  if (anchor === 'mid' && shape.type === 'arc') return { ...shape, mid: point }
  // Virtual affine landmarks on the legacy primitives: changing the endpoint
  // changes the midpoint by half that amount. Iteration checks the true result.
  const current = getAnchorPoint(shape, anchor), dx = point.x - current.x, dy = point.y - current.y
  if (anchor === 'quarter' || anchor === 'threeQuarter') throw new Error('Quarter dimension mutation requires a native cubic or ellipse')
  return { ...shape, end: { x: shape.end.x + 2 * dx, y: shape.end.y + 2 * dy } }
}

export type DimensionBindingOptions = ConstraintAccess & { tolerance?: number; maxIterations?: number }

/** Atomic projection of bindings; incompatible or locked requests throw, never return partial success. */
export function applyDimensionBindings(
  shapes: Shape[],
  bindings: DimensionBinding[],
  resolvedParams: Map<string, number>,
  options: DimensionBindingOptions = {},
): Shape[] {
  const tolerance = options.tolerance ?? 1e-6, maxIterations = options.maxIterations ?? 64
  if (!Number.isFinite(tolerance) || tolerance <= 0 || !Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 10000) throw new Error('Invalid dimension iteration limit or tolerance')
  if (new Set(shapes.map(shape => shape.id)).size !== shapes.length) throw new Error('Duplicate shape IDs')
  const shapeMap = new Map(shapes.map(shape => [shape.id, shape]))
  const groups = buildGroupAccess([...(options.sketchGroups ?? [])]), lockedLayers = new Set(options.layers?.filter(layer => layer.locked).map(layer => layer.id))
  const active = bindings.filter(binding => resolvedParams.has(binding.paramId))
  for (const binding of active) {
    const value = resolvedParams.get(binding.paramId)!
    if (!Number.isFinite(value) || (binding.axis === 'distance' && value < 0)) throw new Error(`Dimension ${binding.id} must be finite${binding.axis === 'distance' ? ' and nonnegative' : ''}`)
    if (!shapeMap.has(binding.shapeId)) throw new Error(`Dimension ${binding.id} references a missing shape`)
  }
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    for (const binding of active) {
      const value = resolvedParams.get(binding.paramId)!, shape = shapeMap.get(binding.shapeId)!
      if (Math.abs(measureDimension(shape, binding) - value) <= tolerance) continue
      if (isShapeLocked(shape, groups) || lockedLayers.has(shape.layerId)) throw new Error(`Dimension ${binding.id} cannot change a locked shape`)
      const from = getAnchorPoint(shape, binding.anchorFrom), to = getAnchorPoint(shape, binding.anchorTo)
      let target: Point
      if (binding.axis === 'x') target = { x: from.x + value, y: to.y }
      else if (binding.axis === 'y') target = { x: to.x, y: from.y + value }
      else {
        const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy)
        target = length < 1e-10 ? { x: from.x + value, y: from.y } : { x: from.x + dx * value / length, y: from.y + dy * value / length }
      }
      // A zero signed projection can rotate a nonzero ellipse chord onto the
      // free axis; only a zero Euclidean distance requires a collapsed curve.
      if (shape.type === 'ellipse' && binding.axis !== 'distance' && distance(from, target) < 1e-10) {
        const length = distance(from, to)
        target = binding.axis === 'x' ? { x: target.x, y: from.y + length } : { x: from.x + length, y: target.y }
      }
      const updated = shape.type === 'ellipse' ? moveEllipseAnchor(shape, from, to, target)
        : shape.type === 'cubic' ? moveCubicAnchor(shape, binding.anchorFrom, binding.anchorTo, { x: target.x - to.x, y: target.y - to.y })
          : moveLegacyAnchor(shape, binding.anchorTo, target)
      if (!isShapeLike(updated)) throw new Error(`Dimension ${binding.id} exceeds valid geometry bounds`)
      shapeMap.set(shape.id, updated)
    }
    if (active.every(binding => Math.abs(measureDimension(shapeMap.get(binding.shapeId)!, binding) - resolvedParams.get(binding.paramId)!) <= tolerance)) return shapes.map(shape => shapeMap.get(shape.id)!)
  }
  const failed = active.filter(binding => Math.abs(measureDimension(shapeMap.get(binding.shapeId)!, binding) - resolvedParams.get(binding.paramId)!) > tolerance)
  throw new Error(`Conflicting or nonconvergent dimension bindings: ${failed.map(binding => binding.id).join(', ')}`)
}

export function measureDimension(shape: Shape, binding: DimensionBinding): number {
  const from = getAnchorPoint(shape, binding.anchorFrom), to = getAnchorPoint(shape, binding.anchorTo)
  if (binding.axis === 'x') return to.x - from.x
  if (binding.axis === 'y') return to.y - from.y
  return distance(from, to)
}
