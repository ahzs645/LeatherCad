import type { Point } from '../cad/cad-types'

export type ConstraintAnchor = 'start' | 'end' | 'mid' | 'center'

export type DistanceConstraint = {
  id: string
  type: 'distance'
  shapeIdA: string
  anchorA: ConstraintAnchor
  shapeIdB: string
  anchorB: ConstraintAnchor
  targetDistance: number
}

export type CoincidentConstraint = {
  id: string
  type: 'coincident'
  shapeIdA: string
  anchorA: ConstraintAnchor
  shapeIdB: string
  anchorB: ConstraintAnchor
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
  updates: Map<string, Map<string, Point>>
  conflicts: string[]
}
