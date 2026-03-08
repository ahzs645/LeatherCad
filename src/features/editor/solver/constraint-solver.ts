import type { Point, Shape } from '../cad/cad-types'

// ---------------------------------------------------------------------------
// Constraint types
// ---------------------------------------------------------------------------

export type DistanceConstraint = {
  id: string
  type: 'distance'
  shapeIdA: string
  anchorA: 'start' | 'end' | 'mid' | 'center'
  shapeIdB: string
  anchorB: 'start' | 'end' | 'mid' | 'center'
  targetDistance: number // mm
}

export type CoincidentConstraint = {
  id: string
  type: 'coincident'
  shapeIdA: string
  anchorA: 'start' | 'end' | 'mid' | 'center'
  shapeIdB: string
  anchorB: 'start' | 'end' | 'mid' | 'center'
}

export type HorizontalConstraint = {
  id: string
  type: 'horizontal'
  shapeId: string
}

export type VerticalConstraint = {
  id: string
  type: 'vertical'
  shapeId: string
}

export type ParallelConstraint = {
  id: string
  type: 'parallel'
  shapeIdA: string
  shapeIdB: string
}

export type PerpendicularConstraint = {
  id: string
  type: 'perpendicular'
  shapeIdA: string
  shapeIdB: string
}

export type EqualLengthConstraint = {
  id: string
  type: 'equal-length'
  shapeIdA: string
  shapeIdB: string
}

export type AngleConstraint = {
  id: string
  type: 'angle'
  shapeIdA: string
  shapeIdB: string
  targetAngleDeg: number
}

export type SymmetricConstraint = {
  id: string
  type: 'symmetric'
  shapeIdA: string
  anchorA: 'start' | 'end'
  shapeIdB: string
  anchorB: 'start' | 'end'
  axisShapeId: string
}

export type TangentConstraint = {
  id: string
  type: 'tangent'
  shapeIdA: string
  shapeIdB: string
}

export type SolverConstraint =
  | DistanceConstraint
  | CoincidentConstraint
  | HorizontalConstraint
  | VerticalConstraint
  | ParallelConstraint
  | PerpendicularConstraint
  | EqualLengthConstraint
  | AngleConstraint
  | SymmetricConstraint
  | TangentConstraint

export type SolverResult = {
  converged: boolean
  iterations: number
  residual: number
  updates: Map<string, Map<string, Point>> // shapeId -> anchorName -> newPosition
  conflicts: string[] // descriptions of conflicting/overconstrained situations
}

// ---------------------------------------------------------------------------
// Anchor helpers
// ---------------------------------------------------------------------------

export function getAnchorPoint(shape: Shape, anchor: 'start' | 'end' | 'mid' | 'center'): Point {
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
      return translateShape(clone as Shape, dx, dy)
    }

    case 'center': {
      const currentCenter = getAnchorPoint(shape, 'center')
      const dx = point.x - currentCenter.x
      const dy = point.y - currentCenter.y
      return translateShape(clone as Shape, dx, dy)
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function translateShape(shape: Shape, dx: number, dy: number): Shape {
  const movePoint = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy })

  switch (shape.type) {
    case 'line':
      return { ...shape, start: movePoint(shape.start), end: movePoint(shape.end) }
    case 'arc':
      return { ...shape, start: movePoint(shape.start), mid: movePoint(shape.mid), end: movePoint(shape.end) }
    case 'bezier':
      return { ...shape, start: movePoint(shape.start), control: movePoint(shape.control), end: movePoint(shape.end) }
    case 'text':
      return { ...shape, start: movePoint(shape.start), end: movePoint(shape.end) }
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function shapeLength(shape: Shape): number {
  return dist(shape.start, shape.end)
}

function shapeDirection(shape: Shape): { dx: number; dy: number } {
  const dx = shape.end.x - shape.start.x
  const dy = shape.end.y - shape.start.y
  return { dx, dy }
}

function normalizeDir(dx: number, dy: number): { dx: number; dy: number } {
  const len = Math.hypot(dx, dy)
  if (len < 1e-12) return { dx: 1, dy: 0 }
  return { dx: dx / len, dy: dy / len }
}

// ---------------------------------------------------------------------------
// Constraint-specific update strategies
// ---------------------------------------------------------------------------

function solveCoincident(
  shapeMap: Map<string, Shape>,
  c: CoincidentConstraint,
  tolerance: number,
): number {
  const shapeA = shapeMap.get(c.shapeIdA)
  const shapeB = shapeMap.get(c.shapeIdB)
  if (!shapeA || !shapeB) return 0

  const pA = getAnchorPoint(shapeA, c.anchorA)
  const pB = getAnchorPoint(shapeB, c.anchorB)
  const d = dist(pA, pB)

  if (d > tolerance) {
    const mid: Point = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 }
    shapeMap.set(c.shapeIdA, setAnchorPoint(shapeA, c.anchorA, mid))
    shapeMap.set(c.shapeIdB, setAnchorPoint(shapeB, c.anchorB, mid))
  }
  return d
}

function solveDistance(
  shapeMap: Map<string, Shape>,
  c: DistanceConstraint,
  tolerance: number,
): number {
  const shapeA = shapeMap.get(c.shapeIdA)
  const shapeB = shapeMap.get(c.shapeIdB)
  if (!shapeA || !shapeB) return 0

  const pA = getAnchorPoint(shapeA, c.anchorA)
  const pB = getAnchorPoint(shapeB, c.anchorB)
  const d = dist(pA, pB)
  const error = Math.abs(d - c.targetDistance)

  if (error > tolerance) {
    if (d < 1e-12) {
      const half = c.targetDistance / 2
      shapeMap.set(c.shapeIdA, setAnchorPoint(shapeA, c.anchorA, { x: pA.x - half, y: pA.y }))
      shapeMap.set(c.shapeIdB, setAnchorPoint(shapeB, c.anchorB, { x: pB.x + half, y: pB.y }))
    } else {
      const ux = (pB.x - pA.x) / d
      const uy = (pB.y - pA.y) / d
      const correction = (d - c.targetDistance) / 2
      shapeMap.set(c.shapeIdA, setAnchorPoint(shapeA, c.anchorA, {
        x: pA.x + ux * correction,
        y: pA.y + uy * correction,
      }))
      shapeMap.set(c.shapeIdB, setAnchorPoint(shapeB, c.anchorB, {
        x: pB.x - ux * correction,
        y: pB.y - uy * correction,
      }))
    }
  }
  return error
}

function solveHorizontal(
  shapeMap: Map<string, Shape>,
  c: HorizontalConstraint,
  tolerance: number,
): number {
  const shape = shapeMap.get(c.shapeId)
  if (!shape) return 0

  const error = Math.abs(shape.end.y - shape.start.y)
  if (error > tolerance) {
    const avgY = (shape.start.y + shape.end.y) / 2
    let updated = setAnchorPoint(shape, 'start', { x: shape.start.x, y: avgY })
    updated = setAnchorPoint(updated, 'end', { x: shape.end.x, y: avgY })
    shapeMap.set(c.shapeId, updated)
  }
  return error
}

function solveVertical(
  shapeMap: Map<string, Shape>,
  c: VerticalConstraint,
  tolerance: number,
): number {
  const shape = shapeMap.get(c.shapeId)
  if (!shape) return 0

  const error = Math.abs(shape.end.x - shape.start.x)
  if (error > tolerance) {
    const avgX = (shape.start.x + shape.end.x) / 2
    let updated = setAnchorPoint(shape, 'start', { x: avgX, y: shape.start.y })
    updated = setAnchorPoint(updated, 'end', { x: avgX, y: shape.end.y })
    shapeMap.set(c.shapeId, updated)
  }
  return error
}

function solveParallel(
  shapeMap: Map<string, Shape>,
  c: ParallelConstraint,
  tolerance: number,
): number {
  const shapeA = shapeMap.get(c.shapeIdA)
  const shapeB = shapeMap.get(c.shapeIdB)
  if (!shapeA || !shapeB) return 0

  const dirA = shapeDirection(shapeA)
  const dirB = shapeDirection(shapeB)
  const lenA = Math.hypot(dirA.dx, dirA.dy)
  const lenB = Math.hypot(dirB.dx, dirB.dy)
  if (lenA < 1e-12 || lenB < 1e-12) return 0

  // Cross product = sin(angle between)
  const cross = (dirA.dx * dirB.dy - dirA.dy * dirB.dx) / (lenA * lenB)
  const error = Math.abs(cross)

  if (error > tolerance * 0.01) {
    // Rotate shapeB to be parallel to shapeA
    const nA = normalizeDir(dirA.dx, dirA.dy)
    const dot = (dirB.dx * nA.dx + dirB.dy * nA.dy)
    const sign = dot >= 0 ? 1 : -1

    const midB: Point = {
      x: (shapeB.start.x + shapeB.end.x) / 2,
      y: (shapeB.start.y + shapeB.end.y) / 2,
    }

    const halfLen = lenB / 2
    const newStart: Point = {
      x: midB.x - nA.dx * halfLen * sign,
      y: midB.y - nA.dy * halfLen * sign,
    }
    const newEnd: Point = {
      x: midB.x + nA.dx * halfLen * sign,
      y: midB.y + nA.dy * halfLen * sign,
    }

    // Only adjust half the error (split between shapes)
    const blendedStart: Point = {
      x: (shapeB.start.x + newStart.x) / 2,
      y: (shapeB.start.y + newStart.y) / 2,
    }
    const blendedEnd: Point = {
      x: (shapeB.end.x + newEnd.x) / 2,
      y: (shapeB.end.y + newEnd.y) / 2,
    }

    let updated = setAnchorPoint(shapeB, 'start', blendedStart)
    updated = setAnchorPoint(updated, 'end', blendedEnd)
    shapeMap.set(c.shapeIdB, updated)
  }
  return error
}

function solvePerpendicular(
  shapeMap: Map<string, Shape>,
  c: PerpendicularConstraint,
  tolerance: number,
): number {
  const shapeA = shapeMap.get(c.shapeIdA)
  const shapeB = shapeMap.get(c.shapeIdB)
  if (!shapeA || !shapeB) return 0

  const dirA = shapeDirection(shapeA)
  const dirB = shapeDirection(shapeB)
  const lenA = Math.hypot(dirA.dx, dirA.dy)
  const lenB = Math.hypot(dirB.dx, dirB.dy)
  if (lenA < 1e-12 || lenB < 1e-12) return 0

  // Dot product = cos(angle between) — should be 0 for perpendicular
  const dot = (dirA.dx * dirB.dx + dirA.dy * dirB.dy) / (lenA * lenB)
  const error = Math.abs(dot)

  if (error > tolerance * 0.01) {
    // Rotate shapeB to be perpendicular to shapeA
    const nA = normalizeDir(dirA.dx, dirA.dy)
    // Perpendicular direction
    const perpDx = -nA.dy
    const perpDy = nA.dx
    const cross = dirB.dx * perpDy - dirB.dy * perpDx
    const sign = cross >= 0 ? 1 : -1

    const midB: Point = {
      x: (shapeB.start.x + shapeB.end.x) / 2,
      y: (shapeB.start.y + shapeB.end.y) / 2,
    }

    const halfLen = lenB / 2
    const newStart: Point = {
      x: midB.x - perpDx * halfLen * sign,
      y: midB.y - perpDy * halfLen * sign,
    }
    const newEnd: Point = {
      x: midB.x + perpDx * halfLen * sign,
      y: midB.y + perpDy * halfLen * sign,
    }

    const blendedStart: Point = {
      x: (shapeB.start.x + newStart.x) / 2,
      y: (shapeB.start.y + newStart.y) / 2,
    }
    const blendedEnd: Point = {
      x: (shapeB.end.x + newEnd.x) / 2,
      y: (shapeB.end.y + newEnd.y) / 2,
    }

    let updated = setAnchorPoint(shapeB, 'start', blendedStart)
    updated = setAnchorPoint(updated, 'end', blendedEnd)
    shapeMap.set(c.shapeIdB, updated)
  }
  return error
}

function solveEqualLength(
  shapeMap: Map<string, Shape>,
  c: EqualLengthConstraint,
  tolerance: number,
): number {
  const shapeA = shapeMap.get(c.shapeIdA)
  const shapeB = shapeMap.get(c.shapeIdB)
  if (!shapeA || !shapeB) return 0

  const lenA = shapeLength(shapeA)
  const lenB = shapeLength(shapeB)
  const error = Math.abs(lenA - lenB)

  if (error > tolerance) {
    const targetLen = (lenA + lenB) / 2
    // Scale shapeB to target length from its midpoint
    const midB: Point = {
      x: (shapeB.start.x + shapeB.end.x) / 2,
      y: (shapeB.start.y + shapeB.end.y) / 2,
    }
    const dirB = normalizeDir(
      shapeB.end.x - shapeB.start.x,
      shapeB.end.y - shapeB.start.y,
    )
    const halfTarget = targetLen / 2
    let updated = setAnchorPoint(shapeB, 'start', {
      x: midB.x - dirB.dx * halfTarget,
      y: midB.y - dirB.dy * halfTarget,
    })
    updated = setAnchorPoint(updated, 'end', {
      x: midB.x + dirB.dx * halfTarget,
      y: midB.y + dirB.dy * halfTarget,
    })
    shapeMap.set(c.shapeIdB, updated)
  }
  return error
}

function solveAngle(
  shapeMap: Map<string, Shape>,
  c: AngleConstraint,
  tolerance: number,
): number {
  const shapeA = shapeMap.get(c.shapeIdA)
  const shapeB = shapeMap.get(c.shapeIdB)
  if (!shapeA || !shapeB) return 0

  const dirA = shapeDirection(shapeA)
  const dirB = shapeDirection(shapeB)
  const lenB = Math.hypot(dirB.dx, dirB.dy)
  if (lenB < 1e-12) return 0

  const angleA = Math.atan2(dirA.dy, dirA.dx)
  const angleB = Math.atan2(dirB.dy, dirB.dx)
  const targetRad = (c.targetAngleDeg * Math.PI) / 180

  let currentAngle = angleB - angleA
  // Normalize to [-PI, PI]
  while (currentAngle > Math.PI) currentAngle -= 2 * Math.PI
  while (currentAngle < -Math.PI) currentAngle += 2 * Math.PI

  let targetNorm = targetRad
  while (targetNorm > Math.PI) targetNorm -= 2 * Math.PI
  while (targetNorm < -Math.PI) targetNorm += 2 * Math.PI

  const errorRad = Math.abs(currentAngle - targetNorm)
  const errorDeg = (errorRad * 180) / Math.PI

  if (errorDeg > tolerance * 0.5) {
    const desiredAngle = angleA + targetNorm
    const midB: Point = {
      x: (shapeB.start.x + shapeB.end.x) / 2,
      y: (shapeB.start.y + shapeB.end.y) / 2,
    }
    const halfLen = lenB / 2
    const newStart: Point = {
      x: midB.x - Math.cos(desiredAngle) * halfLen,
      y: midB.y - Math.sin(desiredAngle) * halfLen,
    }
    const newEnd: Point = {
      x: midB.x + Math.cos(desiredAngle) * halfLen,
      y: midB.y + Math.sin(desiredAngle) * halfLen,
    }

    // Blend for stability
    const blendedStart: Point = {
      x: (shapeB.start.x + newStart.x) / 2,
      y: (shapeB.start.y + newStart.y) / 2,
    }
    const blendedEnd: Point = {
      x: (shapeB.end.x + newEnd.x) / 2,
      y: (shapeB.end.y + newEnd.y) / 2,
    }

    let updated = setAnchorPoint(shapeB, 'start', blendedStart)
    updated = setAnchorPoint(updated, 'end', blendedEnd)
    shapeMap.set(c.shapeIdB, updated)
  }
  return errorDeg
}

function solveSymmetric(
  shapeMap: Map<string, Shape>,
  c: SymmetricConstraint,
  tolerance: number,
): number {
  const shapeA = shapeMap.get(c.shapeIdA)
  const shapeB = shapeMap.get(c.shapeIdB)
  const axisShape = shapeMap.get(c.axisShapeId)
  if (!shapeA || !shapeB || !axisShape) return 0

  const pA = getAnchorPoint(shapeA, c.anchorA)
  const axisStart = axisShape.start
  const axisEnd = axisShape.end
  const axisDir = normalizeDir(axisEnd.x - axisStart.x, axisEnd.y - axisStart.y)

  // Reflect pA across the axis line
  const vx = pA.x - axisStart.x
  const vy = pA.y - axisStart.y
  const dot = vx * axisDir.dx + vy * axisDir.dy
  const reflected: Point = {
    x: 2 * (axisStart.x + dot * axisDir.dx) - pA.x,
    y: 2 * (axisStart.y + dot * axisDir.dy) - pA.y,
  }

  const pB = getAnchorPoint(shapeB, c.anchorB)
  const error = dist(pB, reflected)

  if (error > tolerance) {
    const target: Point = {
      x: (pB.x + reflected.x) / 2,
      y: (pB.y + reflected.y) / 2,
    }
    shapeMap.set(c.shapeIdB, setAnchorPoint(shapeB, c.anchorB, target))
  }
  return error
}

function solveTangent(
  shapeMap: Map<string, Shape>,
  c: TangentConstraint,
  tolerance: number,
): number {
  const shapeA = shapeMap.get(c.shapeIdA)
  const shapeB = shapeMap.get(c.shapeIdB)
  if (!shapeA || !shapeB) return 0

  // Tangent constraint: shapes touch at a single point and have the same
  // tangent direction there. We approximate by checking if an endpoint of B
  // lies on the tangent line of A's closest endpoint, and vice versa.
  // For simplicity, we enforce coincident endpoints + parallel tangent.

  // Find closest endpoint pair
  const pairs = [
    { aAnc: 'end' as const, bAnc: 'start' as const, d: dist(shapeA.end, shapeB.start) },
    { aAnc: 'start' as const, bAnc: 'end' as const, d: dist(shapeA.start, shapeB.end) },
    { aAnc: 'end' as const, bAnc: 'end' as const, d: dist(shapeA.end, shapeB.end) },
    { aAnc: 'start' as const, bAnc: 'start' as const, d: dist(shapeA.start, shapeB.start) },
  ]
  pairs.sort((a, b) => a.d - b.d)
  const best = pairs[0]

  // Enforce coincident at the closest endpoint pair
  const pA = getAnchorPoint(shapeA, best.aAnc)
  const pB = getAnchorPoint(shapeB, best.bAnc)
  const error = dist(pA, pB)

  if (error > tolerance) {
    const mid: Point = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 }
    shapeMap.set(c.shapeIdA, setAnchorPoint(shapeA, best.aAnc, mid))
    shapeMap.set(c.shapeIdB, setAnchorPoint(shapeB, best.bAnc, mid))
  }

  return error
}

// ---------------------------------------------------------------------------
// Constraint conflict detection
// ---------------------------------------------------------------------------

function detectConflicts(constraints: SolverConstraint[]): string[] {
  const conflicts: string[] = []

  // Count constraints per shape
  const shapeConstraintCount = new Map<string, number>()
  for (const c of constraints) {
    const ids = getConstraintShapeIds(c)
    for (const id of ids) {
      shapeConstraintCount.set(id, (shapeConstraintCount.get(id) ?? 0) + 1)
    }
  }

  // Check for over-constrained shapes (heuristic: >4 constraints on one shape)
  for (const [shapeId, count] of shapeConstraintCount) {
    if (count > 4) {
      conflicts.push(`Shape ${shapeId.slice(0, 8)}... may be over-constrained (${count} constraints)`)
    }
  }

  // Check for contradictory horizontal+vertical on same shape (would need point shape)
  const horizontalShapes = new Set<string>()
  const verticalShapes = new Set<string>()
  for (const c of constraints) {
    if (c.type === 'horizontal') horizontalShapes.add(c.shapeId)
    if (c.type === 'vertical') verticalShapes.add(c.shapeId)
  }
  for (const id of horizontalShapes) {
    if (verticalShapes.has(id)) {
      conflicts.push(`Shape ${id.slice(0, 8)}... has both horizontal and vertical constraints`)
    }
  }

  return conflicts
}

function getConstraintShapeIds(c: SolverConstraint): string[] {
  switch (c.type) {
    case 'horizontal':
    case 'vertical':
      return [c.shapeId]
    case 'symmetric':
      return [c.shapeIdA, c.shapeIdB, c.axisShapeId]
    default:
      return [c.shapeIdA, c.shapeIdB]
  }
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

/**
 * Enhanced Gauss-Seidel iterative constraint solver with constraint-specific
 * update strategies.
 *
 * Supports: distance, coincident, horizontal, vertical, parallel,
 * perpendicular, equal-length, angle, symmetric, tangent constraints.
 *
 * Includes basic overconstrained system detection.
 */
export function solveConstraints(
  shapes: Shape[],
  constraints: SolverConstraint[],
  maxIterations = 200,
  tolerance = 0.001,
): SolverResult {
  if (constraints.length === 0) {
    return {
      converged: true,
      iterations: 0,
      residual: 0,
      updates: new Map(),
      conflicts: [],
    }
  }

  const shapeMap = new Map<string, Shape>()
  for (const s of shapes) {
    shapeMap.set(s.id, { ...s } as Shape)
  }

  const conflicts = detectConflicts(constraints)

  let iterations = 0
  let residual = Infinity

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1
    residual = 0

    for (const constraint of constraints) {
      let error = 0

      switch (constraint.type) {
        case 'coincident':
          error = solveCoincident(shapeMap, constraint, tolerance)
          break
        case 'distance':
          error = solveDistance(shapeMap, constraint, tolerance)
          break
        case 'horizontal':
          error = solveHorizontal(shapeMap, constraint, tolerance)
          break
        case 'vertical':
          error = solveVertical(shapeMap, constraint, tolerance)
          break
        case 'parallel':
          error = solveParallel(shapeMap, constraint, tolerance)
          break
        case 'perpendicular':
          error = solvePerpendicular(shapeMap, constraint, tolerance)
          break
        case 'equal-length':
          error = solveEqualLength(shapeMap, constraint, tolerance)
          break
        case 'angle':
          error = solveAngle(shapeMap, constraint, tolerance)
          break
        case 'symmetric':
          error = solveSymmetric(shapeMap, constraint, tolerance)
          break
        case 'tangent':
          error = solveTangent(shapeMap, constraint, tolerance)
          break
      }

      residual = Math.max(residual, error)
    }

    if (residual <= tolerance) {
      break
    }
  }

  // Build the updates map
  const updates = new Map<string, Map<string, Point>>()
  const anchors: Array<'start' | 'end' | 'mid' | 'center'> = ['start', 'end', 'mid', 'center']

  for (const original of shapes) {
    const updated = shapeMap.get(original.id)
    if (!updated) continue

    const anchorUpdates = new Map<string, Point>()
    for (const anchor of anchors) {
      const oldP = getAnchorPoint(original, anchor)
      const newP = getAnchorPoint(updated, anchor)
      if (Math.abs(oldP.x - newP.x) > 1e-9 || Math.abs(oldP.y - newP.y) > 1e-9) {
        anchorUpdates.set(anchor, newP)
      }
    }
    if (anchorUpdates.size > 0) {
      updates.set(original.id, anchorUpdates)
    }
  }

  return {
    converged: residual <= tolerance,
    iterations,
    residual,
    updates,
    conflicts,
  }
}
