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

export type SolverConstraint = DistanceConstraint | CoincidentConstraint

export type SolverResult = {
  converged: boolean
  iterations: number
  residual: number
  updates: Map<string, Map<string, Point>> // shapeId -> anchorName -> newPosition
}

// ---------------------------------------------------------------------------
// Anchor helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the Point for a given anchor from a shape.
 *
 * - 'start' / 'end' exist on every shape type.
 * - 'mid' maps to `mid` on arcs, `control` on beziers, and the geometric
 *   midpoint of `start`/`end` for lines and text.
 * - 'center' is the geometric midpoint of `start` and `end` for all shape
 *   types (for arcs the arc-center could be used, but we keep it simple and
 *   consistent here).
 */
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
      // line / text: geometric midpoint
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

/**
 * Returns a new shape with the given anchor moved to `point`.
 *
 * For anchors that correspond to a single stored point (`start`, `end`, `mid`
 * on arcs, `control` on beziers) the translation is applied directly.
 *
 * For computed anchors (`mid` on lines/text, `center`) the entire shape is
 * translated so that the anchor lands on `point`.
 */
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
      // line / text: translate whole shape so midpoint lands on `point`
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
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

/**
 * Gauss-Seidel iterative constraint solver.
 *
 * Each iteration walks through every constraint and adjusts the two involved
 * shapes so the constraint is closer to being satisfied:
 *
 * - **Coincident**: both anchors are moved to their midpoint (50/50 split).
 * - **Distance**: anchors are pushed apart / pulled together along the line
 *   connecting them so their distance equals `targetDistance` (50/50 split).
 *
 * The solver stops when the maximum residual across all constraints drops
 * below `tolerance`, or after `maxIterations`.
 */
export function solveConstraints(
  shapes: Shape[],
  constraints: SolverConstraint[],
  maxIterations = 100,
  tolerance = 0.001,
): SolverResult {
  if (constraints.length === 0) {
    return {
      converged: true,
      iterations: 0,
      residual: 0,
      updates: new Map(),
    }
  }

  // Build a mutable map of shapes by id so we can update in place (Gauss-Seidel).
  const shapeMap = new Map<string, Shape>()
  for (const s of shapes) {
    shapeMap.set(s.id, { ...s } as Shape)
  }

  let iterations = 0
  let residual = Infinity

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1
    residual = 0

    for (const constraint of constraints) {
      const shapeA = shapeMap.get(constraint.shapeIdA)
      const shapeB = shapeMap.get(constraint.shapeIdB)
      if (!shapeA || !shapeB) continue

      const pA = getAnchorPoint(shapeA, constraint.anchorA)
      const pB = getAnchorPoint(shapeB, constraint.anchorB)

      if (constraint.type === 'coincident') {
        const d = dist(pA, pB)
        residual = Math.max(residual, d)

        if (d > tolerance) {
          // Move both anchors to the midpoint (50/50 split)
          const mid: Point = {
            x: (pA.x + pB.x) / 2,
            y: (pA.y + pB.y) / 2,
          }
          shapeMap.set(constraint.shapeIdA, setAnchorPoint(shapeA, constraint.anchorA, mid))
          shapeMap.set(constraint.shapeIdB, setAnchorPoint(shapeB, constraint.anchorB, mid))
        }
      } else {
        // distance constraint
        const d = dist(pA, pB)
        const error = Math.abs(d - constraint.targetDistance)
        residual = Math.max(residual, error)

        if (error > tolerance) {
          if (d < 1e-12) {
            // Points are coincident but target distance > 0: push apart along x
            const half = constraint.targetDistance / 2
            shapeMap.set(
              constraint.shapeIdA,
              setAnchorPoint(shapeA, constraint.anchorA, { x: pA.x - half, y: pA.y }),
            )
            shapeMap.set(
              constraint.shapeIdB,
              setAnchorPoint(shapeB, constraint.anchorB, { x: pB.x + half, y: pB.y }),
            )
          } else {
            // Move each anchor by half the error along the connecting line
            const ux = (pB.x - pA.x) / d
            const uy = (pB.y - pA.y) / d
            const correction = (d - constraint.targetDistance) / 2

            shapeMap.set(
              constraint.shapeIdA,
              setAnchorPoint(shapeA, constraint.anchorA, {
                x: pA.x + ux * correction,
                y: pA.y + uy * correction,
              }),
            )
            shapeMap.set(
              constraint.shapeIdB,
              setAnchorPoint(shapeB, constraint.anchorB, {
                x: pB.x - ux * correction,
                y: pB.y - uy * correction,
              }),
            )
          }
        }
      }
    }

    if (residual <= tolerance) {
      break
    }
  }

  // Build the updates map by comparing to the original shapes.
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
  }
}
