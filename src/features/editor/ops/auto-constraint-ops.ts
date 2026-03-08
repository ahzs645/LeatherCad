/**
 * Auto-constraint detection and suggestion system.
 *
 * Analyzes shapes as they are drawn and suggests geometric constraints
 * (horizontal, vertical, parallel, perpendicular, equal-length, tangent).
 */

import type { Point, Shape } from '../cad/cad-types'
import type { SolverConstraint } from '../solver/constraint-solver'
import { uid } from '../cad/cad-geometry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConstraintSuggestion = {
  constraint: SolverConstraint
  label: string
  /** Glyph to display on the canvas near the constraint location */
  glyph: string
  /** The point on the canvas where the glyph should appear */
  glyphPoint: Point
  /** Confidence 0..1 */
  confidence: number
}

export type AutoConstraintSettings = {
  enabled: boolean
  horizontal: boolean
  vertical: boolean
  parallel: boolean
  perpendicular: boolean
  equalLength: boolean
  tangent: boolean
  /** Angular tolerance in degrees for near-horizontal/vertical detection */
  angleTolerance: number
  /** Distance tolerance in mm for coincident detection */
  distanceTolerance: number
}

export const DEFAULT_AUTO_CONSTRAINT_SETTINGS: AutoConstraintSettings = {
  enabled: true,
  horizontal: true,
  vertical: true,
  parallel: true,
  perpendicular: true,
  equalLength: true,
  tangent: true,
  angleTolerance: 3,
  distanceTolerance: 0.5,
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function shapeAngleDeg(shape: Shape): number {
  const dx = shape.end.x - shape.start.x
  const dy = shape.end.y - shape.start.y
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

function shapeLength(shape: Shape): number {
  return Math.hypot(shape.end.x - shape.start.x, shape.end.y - shape.start.y)
}

function normalizeAngle(deg: number): number {
  let a = deg % 360
  if (a < 0) a += 360
  return a
}

function midPoint(shape: Shape): Point {
  return {
    x: (shape.start.x + shape.end.x) / 2,
    y: (shape.start.y + shape.end.y) / 2,
  }
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detects auto-constraint suggestions for a shape being drawn or just placed.
 *
 * @param newShape - The shape being drawn / just placed
 * @param existingShapes - All other shapes in the canvas
 * @param settings - Auto-constraint configuration
 * @returns Array of constraint suggestions, sorted by confidence (highest first)
 */
export function detectAutoConstraints(
  newShape: Shape,
  existingShapes: Shape[],
  settings: AutoConstraintSettings,
): ConstraintSuggestion[] {
  if (!settings.enabled) return []

  const suggestions: ConstraintSuggestion[] = []
  const angle = shapeAngleDeg(newShape)
  const len = shapeLength(newShape)
  const normalizedAngle = normalizeAngle(angle)

  // Check horizontal
  if (settings.horizontal && newShape.type === 'line') {
    const hError = Math.min(
      Math.abs(normalizedAngle),
      Math.abs(normalizedAngle - 180),
      Math.abs(normalizedAngle - 360),
    )
    if (hError < settings.angleTolerance && hError > 0.01) {
      suggestions.push({
        constraint: {
          id: uid(),
          type: 'horizontal',
          shapeId: newShape.id,
        },
        label: 'Horizontal',
        glyph: 'H',
        glyphPoint: midPoint(newShape),
        confidence: 1 - hError / settings.angleTolerance,
      })
    }
  }

  // Check vertical
  if (settings.vertical && newShape.type === 'line') {
    const vError = Math.min(
      Math.abs(normalizedAngle - 90),
      Math.abs(normalizedAngle - 270),
    )
    if (vError < settings.angleTolerance && vError > 0.01) {
      suggestions.push({
        constraint: {
          id: uid(),
          type: 'vertical',
          shapeId: newShape.id,
        },
        label: 'Vertical',
        glyph: 'V',
        glyphPoint: midPoint(newShape),
        confidence: 1 - vError / settings.angleTolerance,
      })
    }
  }

  // Compare with existing shapes
  const lineShapes = existingShapes.filter(
    (s): s is Extract<Shape, { type: 'line' }> => s.type === 'line' && s.id !== newShape.id,
  )

  for (const other of lineShapes) {
    const otherAngle = shapeAngleDeg(other)
    const otherLen = shapeLength(other)

    // Parallel detection
    if (settings.parallel && newShape.type === 'line') {
      let angleDiff = Math.abs(normalizeAngle(angle) - normalizeAngle(otherAngle))
      if (angleDiff > 180) angleDiff = 360 - angleDiff

      if (angleDiff < settings.angleTolerance && angleDiff > 0.01) {
        suggestions.push({
          constraint: {
            id: uid(),
            type: 'parallel',
            shapeIdA: other.id,
            shapeIdB: newShape.id,
          },
          label: `Parallel to ${other.id.slice(0, 6)}`,
          glyph: '‖',
          glyphPoint: midPoint(newShape),
          confidence: 1 - angleDiff / settings.angleTolerance,
        })
      }

      // Perpendicular detection
      if (settings.perpendicular) {
        const perpDiff = Math.abs(angleDiff - 90)
        if (perpDiff < settings.angleTolerance && perpDiff > 0.01) {
          suggestions.push({
            constraint: {
              id: uid(),
              type: 'perpendicular',
              shapeIdA: other.id,
              shapeIdB: newShape.id,
            },
            label: `Perpendicular to ${other.id.slice(0, 6)}`,
            glyph: '⊥',
            glyphPoint: midPoint(newShape),
            confidence: 1 - perpDiff / settings.angleTolerance,
          })
        }
      }
    }

    // Equal length detection
    if (settings.equalLength && len > 0.1 && otherLen > 0.1) {
      const lenDiff = Math.abs(len - otherLen)
      const lenTol = Math.max(settings.distanceTolerance, len * 0.02) // 2% or absolute
      if (lenDiff < lenTol && lenDiff > 0.001) {
        suggestions.push({
          constraint: {
            id: uid(),
            type: 'equal-length',
            shapeIdA: other.id,
            shapeIdB: newShape.id,
          },
          label: `Equal length to ${other.id.slice(0, 6)}`,
          glyph: '=',
          glyphPoint: midPoint(newShape),
          confidence: 1 - lenDiff / lenTol,
        })
      }
    }
  }

  // Tangent detection (for arcs/beziers near lines)
  if (settings.tangent && (newShape.type === 'arc' || newShape.type === 'bezier')) {
    for (const other of lineShapes) {
      // Check if any endpoint of newShape is near the other line
      const endpoints = [newShape.start, newShape.end]
      for (const ep of endpoints) {
        const dStart = Math.hypot(ep.x - other.start.x, ep.y - other.start.y)
        const dEnd = Math.hypot(ep.x - other.end.x, ep.y - other.end.y)
        const minD = Math.min(dStart, dEnd)

        if (minD < settings.distanceTolerance * 3) {
          suggestions.push({
            constraint: {
              id: uid(),
              type: 'tangent',
              shapeIdA: other.id,
              shapeIdB: newShape.id,
            },
            label: `Tangent to ${other.id.slice(0, 6)}`,
            glyph: 'T',
            glyphPoint: ep,
            confidence: 1 - minD / (settings.distanceTolerance * 3),
          })
        }
      }
    }
  }

  // Sort by confidence, highest first
  suggestions.sort((a, b) => b.confidence - a.confidence)

  // Limit to top 3 suggestions to avoid UI clutter
  return suggestions.slice(0, 3)
}
