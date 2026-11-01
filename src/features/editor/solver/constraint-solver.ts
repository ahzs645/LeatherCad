import type { Point, Shape } from '../cad/cad-types'
import { isShapeLike } from '../cad/cad-geometry'
import { isNativeCurve, nativeCurveBounds, nativeCurveEndpoints, nativeCurvePointAt, transformNativeCurve } from '../cad/native-curve-ops'
import { buildGroupAccess, isShapeLocked } from '../ops/shape-access'
import { constraintCurveLength, constraintDirection, constraintTangent, endpoints, magnitude, rotateConstraintShape, scaleConstraintShape, separation, subtract, translateConstraintShape } from './constraint-geometry'
import type { ConstraintAccess, SolverConstraint, SolverResult, TangentConstraint } from './constraint-types'
export type * from './constraint-types'

export function getAnchorPoint(shape: Shape, anchor: 'start' | 'end' | 'mid' | 'center'): Point {
  if (isNativeCurve(shape)) {
    if (anchor === 'start' || anchor === 'end') return nativeCurveEndpoints(shape)[anchor]
    if (anchor === 'mid') return nativeCurvePointAt(shape, 0.5)
    if (shape.type === 'ellipse') return { ...shape.center }
    const bounds = nativeCurveBounds(shape)
    return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
  }
  switch (anchor) {
    case 'start':
      return { x: shape.start.x, y: shape.start.y }
    case 'end':
      return { x: shape.end.x, y: shape.end.y }
    case 'mid': {
      if (shape.type === 'arc') {
        return { x: shape.mid.x, y: shape.mid.y }
      }
      if (shape.type === 'bezier') {
        return { x: shape.control.x, y: shape.control.y }
      }
      return {
        x: (shape.start.x + shape.end.x) / 2,
        y: (shape.start.y + shape.end.y) / 2,
      }
    }
    case 'center': {
      return {
        x: (shape.start.x + shape.end.x) / 2,
        y: (shape.start.y + shape.end.y) / 2,
      }
    }
  }
}

export function setAnchorPoint(shape: Shape, anchor: 'start' | 'end' | 'mid' | 'center', point: Point): Shape {
  if (shape.locked) return shape
  if (isNativeCurve(shape)) {
    if (shape.type === 'cubic' && (anchor === 'start' || anchor === 'end')) return { ...shape, [anchor]: { ...point } }
    const current = getAnchorPoint(shape, anchor)
    return transformNativeCurve(shape, [1, 0, 0, 1, point.x - current.x, point.y - current.y])
  }
  const clone = { ...shape }

  switch (anchor) {
    case 'start':
      return { ...clone, start: { x: point.x, y: point.y } }

    case 'end':
      return { ...clone, end: { x: point.x, y: point.y } }

    case 'mid': {
      if (shape.type === 'arc') {
        return { ...clone, mid: { x: point.x, y: point.y } } as Shape
      }
      if (shape.type === 'bezier') {
        return { ...clone, control: { x: point.x, y: point.y } } as Shape
      }
      const currentMid = getAnchorPoint(shape, 'mid')
      const dx = point.x - currentMid.x
      const dy = point.y - currentMid.y
      return translateConstraintShape(clone, dx, dy)
    }

    case 'center': {
      const currentCenter = getAnchorPoint(shape, 'center')
      const dx = point.x - currentCenter.x
      const dy = point.y - currentCenter.y
      return translateConstraintShape(clone, dx, dy)
    }
  }
}

const RAD = Math.PI / 180
/** Signed smallest rotation; unoriented relations are equivalent modulo pi. */
function angleDelta(value: number, unoriented = false): number {
  const period = unoriented ? Math.PI : 2 * Math.PI
  return ((value + period / 2) % period + period) % period - period / 2
}
const directionAngle = (p: Point) => Math.atan2(p.y, p.x)

function constraintShapeIds(c: SolverConstraint): string[] {
  if (c.type === 'horizontal' || c.type === 'vertical') return [c.shapeId]
  return c.type === 'symmetric' ? [c.shapeIdA, c.shapeIdB, c.axisShapeId] : [c.shapeIdA, c.shapeIdB]
}

type EndpointPair = { a: 'start' | 'end'; b: 'start' | 'end' }
function tangentPair(c: TangentConstraint, a: Shape, b: Shape): EndpointPair {
  const anchors = ['end', 'start'] as const
  const pairs = anchors.flatMap(aa => anchors.map(bb => ({ a: aa, b: bb })))
    .filter(pair => (!c.anchorA || pair.a === c.anchorA) && (!c.anchorB || pair.b === c.anchorB))
  pairs.sort((one, two) => separation(endpoints(a)[one.a], endpoints(b)[one.b]) - separation(endpoints(a)[two.a], endpoints(b)[two.b]))
  return pairs[0]
}

/**
 * Exact primitive projections with a final whole-system residual check.
 * Positional/length residuals are mm; angular residuals are degrees. Tangency
 * requires endpoint contact AND parallel limiting tangents (G1, either sign).
 * Full native changes live in shapeUpdates; updates is the legacy anchor view.
 */
export function solveConstraints(
  shapes: Shape[],
  constraints: SolverConstraint[],
  maxIterations = 200,
  tolerance = 0.001,
  access: ConstraintAccess = {},
): SolverResult {
  const unchanged = (conflicts: string[], residual = Infinity): SolverResult => ({ converged: conflicts.length === 0, iterations: 0, residual, updates: new Map(), shapeUpdates: new Map(), conflicts })
  if (!constraints.length) return unchanged([], 0)
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 10000 || !Number.isFinite(tolerance) || tolerance <= 0) return unchanged(['Invalid solver iteration limit or tolerance'])
  if (new Set(shapes.map(shape => shape.id)).size !== shapes.length) return unchanged(['Duplicate shape IDs'])
  if (new Set(constraints.map(c => c.id)).size !== constraints.length) return unchanged(['Duplicate constraint IDs'])
  if (shapes.some(shape => !isShapeLike(shape))) return unchanged(['Invalid input geometry'])

  const shapeMap = new Map(shapes.map(shape => [shape.id, shape]))
  const groups = buildGroupAccess([...(access.sketchGroups ?? [])])
  const lockedLayers = new Set(access.layers?.filter(layer => layer.locked).map(layer => layer.id))
  const locked = new Set(shapes.filter(shape => isShapeLocked(shape, groups) || lockedLayers.has(shape.layerId)).map(shape => shape.id))
  const pairs = new Map<string, EndpointPair>()
  const errors = new Map<string, string>()
  const lengths = new WeakMap<Shape, number>()
  const length = (shape: Shape) => {
    let value = lengths.get(shape)
    if (value === undefined) { value = constraintCurveLength(shape, Math.min(1e-7, tolerance / 32)); lengths.set(shape, value) }
    return value
  }

  const process = (c: SolverConstraint, apply: boolean): number => {
    const ids = constraintShapeIds(c)
    for (const id of ids) if (!shapeMap.has(id)) throw new Error(`Missing shape ${id}`)
    const a = shapeMap.get(ids[0])!, b = shapeMap.get(ids[1])!
    const freeA = !locked.has(a.id), freeB = b && !locked.has(b.id)
    const pending = new Map<string, Shape>()
    const put = (shape: Shape) => {
      if (locked.has(shape.id)) return
      if (!isShapeLike(shape)) throw new Error('Correction exceeds valid geometry bounds')
      pending.set(shape.id, shape)
    }
    const turn = (shape: Shape, angle: number, center = getAnchorPoint(shape, 'center')) => put(rotateConstraintShape(shape, angle, center))
    const pairMustDiffer = () => { if (a.id === b.id) throw new Error('This unsatisfied self-relation cannot move two independent curves') }
    let residual: number

    switch (c.type) {
      case 'coincident':
      case 'distance': {
        if (c.type === 'distance' && (!Number.isFinite(c.targetDistance) || c.targetDistance < 0)) throw new Error('Distance must be finite and nonnegative')
        const pa = getAnchorPoint(a, c.anchorA), pb = getAnchorPoint(b, c.anchorB), delta = subtract(pb, pa), d = magnitude(delta)
        const target = c.type === 'distance' ? c.targetDistance : 0
        residual = Math.abs(d - target)
        if (apply && residual > tolerance) {
          pairMustDiffer()
          const error = d - target, ux = d > 1e-12 ? delta.x / d : 1, uy = d > 1e-12 ? delta.y / d : 0
          const shareA = freeA ? freeB ? 0.5 : 1 : 0, shareB = freeB ? freeA ? 0.5 : 1 : 0
          if (freeA) put(setAnchorPoint(a, c.anchorA, { x: pa.x + ux * error * shareA, y: pa.y + uy * error * shareA }))
          if (freeB) put(setAnchorPoint(b, c.anchorB, { x: pb.x - ux * error * shareB, y: pb.y - uy * error * shareB }))
        }
        break
      }
      case 'horizontal':
      case 'vertical': {
        const angle = angleDelta((c.type === 'horizontal' ? 0 : Math.PI / 2) - directionAngle(constraintDirection(a)), true)
        residual = Math.abs(angle) / RAD
        if (apply && residual > tolerance && freeA) turn(a, angle)
        break
      }
      case 'parallel':
      case 'perpendicular':
      case 'angle': {
        if (c.type === 'angle' && !Number.isFinite(c.targetAngleDeg)) throw new Error('Angle must be finite')
        const target = c.type === 'parallel' ? 0 : c.type === 'perpendicular' ? Math.PI / 2 : (c.targetAngleDeg % 360) * RAD
        const axial = [a, b].some(shape => shape.type === 'ellipse' && Math.abs(shape.sweepDeg) >= 360 - 1e-8)
        const correction = angleDelta(directionAngle(constraintDirection(a)) + target - directionAngle(constraintDirection(b)), c.type !== 'angle' || axial)
        residual = Math.abs(correction) / RAD
        if (apply && residual > tolerance) {
          pairMustDiffer()
          if (freeB) turn(b, correction)
          else if (freeA) turn(a, -correction)
        }
        break
      }
      case 'equal-length': {
        const la = length(a), lb = length(b)
        residual = Math.abs(la - lb)
        if (apply && residual > tolerance) {
          pairMustDiffer()
          const target = freeA && freeB ? (la + lb) / 2 : freeA ? lb : la
          if (freeA) put(scaleConstraintShape(a, target / la, getAnchorPoint(a, 'center')))
          if (freeB) put(scaleConstraintShape(b, target / lb, getAnchorPoint(b, 'center')))
        }
        break
      }
      case 'symmetric': {
        const axis = shapeMap.get(c.axisShapeId)!, origin = axis.type === 'ellipse' && Math.abs(axis.sweepDeg) >= 360 - 1e-8 ? axis.center : endpoints(axis).start, direction = constraintDirection(axis), norm = magnitude(direction)
        const ux = direction.x / norm, uy = direction.y / norm
        const reflect = (p: Point): Point => {
          const dot = (p.x - origin.x) * ux + (p.y - origin.y) * uy
          return { x: 2 * (origin.x + dot * ux) - p.x, y: 2 * (origin.y + dot * uy) - p.y }
        }
        const pa = getAnchorPoint(a, c.anchorA), pb = getAnchorPoint(b, c.anchorB)
        residual = separation(reflect(pa), pb)
        if (apply && residual > tolerance) {
          pairMustDiffer()
          if (axis.id === a.id || axis.id === b.id) throw new Error('A reflection axis must be independent of the moved curves')
          if (freeB) put(setAnchorPoint(b, c.anchorB, reflect(pa)))
          else if (freeA) put(setAnchorPoint(a, c.anchorA, reflect(pb)))
        }
        break
      }
      case 'tangent': {
        if (!pairs.has(c.id)) pairs.set(c.id, tangentPair(c, a, b))
        const pair = pairs.get(c.id)!, pa = endpoints(a)[pair.a], pb = endpoints(b)[pair.b]
        const ta = constraintTangent(a, pair.a), tb = constraintTangent(b, pair.b)
        const correction = angleDelta(directionAngle(ta) - directionAngle(tb), true)
        residual = Math.max(separation(pa, pb), Math.abs(correction) / RAD)
        if (apply && residual > tolerance) {
          pairMustDiffer()
          if (freeB) put(translateConstraintShape(rotateConstraintShape(b, correction, pb), pa.x - pb.x, pa.y - pb.y))
          else if (freeA) put(translateConstraintShape(rotateConstraintShape(a, -correction, pa), pb.x - pa.x, pb.y - pa.y))
        }
        break
      }
    }
    if (!Number.isFinite(residual)) throw new Error('Constraint has a nonfinite residual')
    if (apply) for (const [id, updated] of pending) shapeMap.set(id, updated)
    return residual
  }

  const safelyProcess = (c: SolverConstraint, apply: boolean): number => {
    if (errors.has(c.id)) return Infinity
    try { return process(c, apply) } catch (error) {
      errors.set(c.id, `Constraint ${c.id} (${c.type}): ${error instanceof Error ? error.message : String(error)}`)
      return Infinity
    }
  }
  let iterations = 0, residual = Infinity
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    iterations = iteration + 1
    for (const c of constraints) safelyProcess(c, true)
    // Later projections can invalidate earlier ones: measure the returned geometry.
    residual = Math.max(...constraints.map(c => safelyProcess(c, false)))
    if (residual <= tolerance || errors.size === constraints.length) break
  }

  const conflicts = [...errors.values()]
  for (const c of constraints) {
    if (errors.has(c.id)) continue
    const error = safelyProcess(c, false)
    if (error > tolerance) {
      const protectedIds = constraintShapeIds(c).filter(id => locked.has(id))
      conflicts.push(`Constraint ${c.id} (${c.type}) remains unsatisfied${protectedIds.length ? `; locked shapes: ${protectedIds.join(', ')}` : '; conflicting or nonconvergent relations'}`)
    }
  }
  const updates = new Map<string, Map<string, Point>>(), shapeUpdates = new Map<string, Shape>()
  for (const original of shapes) {
    const updated = shapeMap.get(original.id)!
    if (updated === original) continue
    shapeUpdates.set(original.id, updated)
    const points = new Map<string, Point>()
    for (const anchor of ['start', 'end', 'mid', 'center'] as const) {
      const before = getAnchorPoint(original, anchor), after = getAnchorPoint(updated, anchor)
      if (separation(before, after) > 1e-9) points.set(anchor, after)
    }
    if (updated.type === 'cubic' && original.type === 'cubic') for (const key of ['control1', 'control2'] as const) {
      if (separation(original[key], updated[key]) > 1e-9) points.set(key, updated[key])
    }
    if (points.size) updates.set(original.id, points)
  }
  return { converged: errors.size === 0 && residual <= tolerance, iterations, residual, updates, shapeUpdates, conflicts }
}
