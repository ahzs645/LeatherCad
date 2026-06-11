import type { ToolDefinition, ToolRuntime } from './tool-types'
import { fitFreehandCurve, smoothPoints } from '../ops/freehand-ops'
import { parseNumber, parseVector } from './tool-command-utils'
import {
  MIN_SHAPE_DISTANCE,
  addLineShape,
  clamp,
  createPolylineAsLines,
  createTextShapeLength,
  distance,
  ellipsePolylinePoints,
  pickToolPoint,
  uid,
  withWritableShapeTarget,
} from './tool-helpers'
import type { Point } from '../cad/cad-types'

/**
 * Apply the active line-tool constraint to a candidate endpoint. Source app
 * supports four modes: free, horizontal-only, vertical-only, and relative-angle
 * (snap to N° steps from the last-drawn line's heading).
 */
function applyLineConstraint(start: Point, candidate: Point, runtime: ToolRuntime): Point {
  if (runtime.lineToolConstraint === 'horizontal') {
    return { x: candidate.x, y: start.y }
  }
  if (runtime.lineToolConstraint === 'vertical') {
    return { x: start.x, y: candidate.y }
  }
  if (runtime.lineToolConstraint === 'relative-angle') {
    const baseAngle = runtime.lastLineAngleRad ?? 0
    const stepDeg = Math.max(1, runtime.relativeAngleStepDeg || 15)
    const stepRad = (stepDeg * Math.PI) / 180
    const dx = candidate.x - start.x
    const dy = candidate.y - start.y
    const radius = Math.hypot(dx, dy)
    if (radius < 1e-6) return candidate
    const currentAngle = Math.atan2(dy, dx)
    const delta = currentAngle - baseAngle
    const snapped = Math.round(delta / stepRad) * stepRad
    const finalAngle = baseAngle + snapped
    return {
      x: start.x + radius * Math.cos(finalAngle),
      y: start.y + radius * Math.sin(finalAngle),
    }
  }
  return candidate
}

export const drawingToolDefinitions = {
  line: {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      if (runtime.draftPoints.length === 0) {
        runtime.setDraftPoints([point])
        pickToolPoint(runtime, point)
        runtime.setStatus('Line: pick end point')
        return
      }

      const start = runtime.draftPoints[0]
      const constrainedEnd = applyLineConstraint(start, point, runtime)
      if (distance(start, constrainedEnd) < MIN_SHAPE_DISTANCE) {
        runtime.setStatus('Line ignored: start and end overlap')
        runtime.clearDraft()
        return
      }

      addLineShape(runtime, start, constrainedEnd)
      runtime.setLastLineAngleRad?.(Math.atan2(constrainedEnd.y - start.y, constrainedEnd.x - start.x))
      pickToolPoint(runtime, constrainedEnd)
      runtime.clearDraft()
      runtime.setStatus('Line created')
    },
    onCommand(command, context) {
      const { runtime, referencePoint } = context
      if (runtime.draftPoints.length === 1) {
        const distanceMm = parseNumber(command)
        if (Number.isFinite(distanceMm) && distanceMm > 0) {
          const start = runtime.draftPoints[0]
          const cursor = runtime.cursorPoint ?? referencePoint
          const constrainedCursor = applyLineConstraint(start, cursor, runtime)
          const dx = constrainedCursor.x - start.x
          const dy = constrainedCursor.y - start.y
          const length = Math.hypot(dx, dy)
          const angle = length > 1e-6 ? Math.atan2(dy, dx) : runtime.lastLineAngleRad ?? 0
          const end = {
            x: start.x + Math.cos(angle) * distanceMm,
            y: start.y + Math.sin(angle) * distanceMm,
          }
          drawingToolDefinitions.line.onPointerDown(end, runtime)
          return 'Line distance applied'
        }
      }

      const vector = parseVector(referencePoint, command)
      if (!vector.ok) {
        return vector.message
      }
      drawingToolDefinitions.line.onPointerDown(vector.point, runtime)
      pickToolPoint(runtime, vector.point)
      return 'Point accepted'
    },
  },
  polyline: {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      if (runtime.draftPoints.length === 0) {
        runtime.setDraftPoints([point])
        pickToolPoint(runtime, point)
        runtime.setStatus('Polyline: pick next point, press Escape to finish')
        return
      }

      const start = runtime.draftPoints[runtime.draftPoints.length - 1]
      if (distance(start, point) < MIN_SHAPE_DISTANCE) {
        runtime.setStatus('Polyline segment ignored: points overlap')
        return
      }

      addLineShape(runtime, start, point)
      runtime.setDraftPoints([point])
      pickToolPoint(runtime, point)
      runtime.setStatus('Polyline segment created')
    },
    getHint(draftPoints) {
      return draftPoints.length > 0 ? 'Polyline: click to continue, Escape or "finish" to stop' : null
    },
  },
  rectangle: {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      if (runtime.draftPoints.length === 0) {
        runtime.setDraftPoints([point])
        pickToolPoint(runtime, point)
        runtime.setStatus('Rectangle: pick opposite corner')
        return
      }

      const start = runtime.draftPoints[0]
      if (distance(start, point) < MIN_SHAPE_DISTANCE) {
        runtime.setStatus('Rectangle ignored: corners overlap')
        runtime.clearDraft()
        return
      }

      const p1 = { x: start.x, y: start.y }
      const p2 = { x: point.x, y: start.y }
      const p3 = { x: point.x, y: point.y }
      const p4 = { x: start.x, y: point.y }

      runtime.setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'line',
          layerId: runtime.activeLayerId,
          lineTypeId: runtime.activeLineTypeId,
          groupId: runtime.activeSketchGroup?.id,
          start: p1,
          end: p2,
        },
        {
          id: uid(),
          type: 'line',
          layerId: runtime.activeLayerId,
          lineTypeId: runtime.activeLineTypeId,
          groupId: runtime.activeSketchGroup?.id,
          start: p2,
          end: p3,
        },
        {
          id: uid(),
          type: 'line',
          layerId: runtime.activeLayerId,
          lineTypeId: runtime.activeLineTypeId,
          groupId: runtime.activeSketchGroup?.id,
          start: p3,
          end: p4,
        },
        {
          id: uid(),
          type: 'line',
          layerId: runtime.activeLayerId,
          lineTypeId: runtime.activeLineTypeId,
          groupId: runtime.activeSketchGroup?.id,
          start: p4,
          end: p1,
        },
      ])
      pickToolPoint(runtime, point)
      runtime.clearDraft()
      runtime.setStatus('Rectangle created')
    },
    getHint(draftPoints) {
      return draftPoints.length > 0 ? 'Rectangle: pick opposite corner' : null
    },
  },
  circle: {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      if (runtime.draftPoints.length === 0) {
        runtime.setDraftPoints([point])
        pickToolPoint(runtime, point)
        runtime.setStatus('Circle: pick radius point')
        return
      }

      const center = runtime.draftPoints[0]
      const radius = distance(center, point)
      const points = ellipsePolylinePoints(center, radius, radius)
      if (points.length < 2) {
        runtime.setStatus('Circle ignored: radius too small')
        runtime.clearDraft()
        return
      }

      createPolylineAsLines(runtime, points)
      pickToolPoint(runtime, point)
      runtime.clearDraft()
      runtime.setStatus('Circle created')
    },
    onCommand(command, context) {
      const { runtime, referencePoint } = context
      if (runtime.draftPoints.length === 1) {
        const radius = parseNumber(command)
        if (Number.isFinite(radius) && radius > 0) {
          const center = runtime.draftPoints[0]
          drawingToolDefinitions.circle.onPointerDown({ x: center.x + radius, y: center.y }, runtime)
          return 'Circle radius applied'
        }
      }

      const vector = parseVector(referencePoint, command)
      if (!vector.ok) {
        return vector.message
      }
      drawingToolDefinitions.circle.onPointerDown(vector.point, runtime)
      return 'Point accepted'
    },
    getHint(draftPoints) {
      return draftPoints.length > 0 ? 'Circle: pick radius point (or type radius)' : null
    },
  },
  ellipse: {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      if (runtime.draftPoints.length === 0) {
        runtime.setDraftPoints([point])
        pickToolPoint(runtime, point)
        runtime.setStatus('Ellipse: pick radius extents')
        return
      }

      const center = runtime.draftPoints[0]
      const radiusX = point.x - center.x
      const radiusY = point.y - center.y
      const points = ellipsePolylinePoints(center, radiusX, radiusY)
      if (points.length < 2) {
        runtime.setStatus('Ellipse ignored: radius too small')
        runtime.clearDraft()
        return
      }

      createPolylineAsLines(runtime, points)
      pickToolPoint(runtime, point)
      runtime.clearDraft()
      runtime.setStatus('Ellipse created')
    },
    onCommand(command, context) {
      const { runtime, referencePoint } = context
      if (runtime.draftPoints.length === 1) {
        const compact = command.replace(/\s+/g, '')
        const parts = compact.split(',')
        if (parts.length === 2) {
          const rx = parseNumber(parts[0])
          const ry = parseNumber(parts[1])
          if (Number.isFinite(rx) && Number.isFinite(ry) && rx !== 0 && ry !== 0) {
            const center = runtime.draftPoints[0]
            drawingToolDefinitions.ellipse.onPointerDown({ x: center.x + rx, y: center.y + ry }, runtime)
            return 'Ellipse radii applied'
          }
        }
      }

      const vector = parseVector(referencePoint, command)
      if (!vector.ok) {
        return vector.message
      }
      drawingToolDefinitions.ellipse.onPointerDown(vector.point, runtime)
      return 'Point accepted'
    },
    getHint(draftPoints) {
      return draftPoints.length > 0 ? 'Ellipse: pick radii point (or type rx,ry)' : null
    },
  },
  arc: {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      const mode = runtime.arcDrawMode ?? 'three-point'
      // Two-click modes (radius / half-moon) take start + end then compute mid.
      if (mode === 'radius' || mode === 'half-moon') {
        if (runtime.draftPoints.length === 0) {
          runtime.setDraftPoints([point])
          pickToolPoint(runtime, point)
          runtime.setStatus(`Arc (${mode}): pick end point`)
          return
        }
        const start = runtime.draftPoints[0]
        const end = point
        const dx = end.x - start.x
        const dy = end.y - start.y
        const chord = Math.hypot(dx, dy)
        if (chord < MIN_SHAPE_DISTANCE) {
          runtime.setStatus('Arc ignored: chord too short')
          runtime.clearDraft()
          return
        }
        const midX = (start.x + end.x) / 2
        const midY = (start.y + end.y) / 2
        const nx = -dy / chord
        const ny = dx / chord
        let height: number
        if (mode === 'radius') {
          const radius = Math.max(chord / 2 + 0.01, runtime.arcRadiusMm ?? chord)
          // h = R - sqrt(R^2 - (chord/2)^2) — sagitta for a circular arc.
          const halfChord = chord / 2
          height = radius - Math.sqrt(Math.max(0, radius * radius - halfChord * halfChord))
        } else {
          // half-moon: height = chord * ratio (interpreted as height/chord)
          height = chord * (runtime.arcHalfMoonRatio ?? 0.5)
        }
        const mid = { x: midX + nx * height, y: midY + ny * height }
        runtime.setShapes((previous) => [
          ...previous,
          {
            id: uid(),
            type: 'arc',
            layerId: runtime.activeLayerId,
            lineTypeId: runtime.activeLineTypeId,
            groupId: runtime.activeSketchGroup?.id,
            start,
            mid,
            end,
          },
        ])
        pickToolPoint(runtime, end)
        runtime.clearDraft()
        runtime.setStatus(`Arc created (${mode})`)
        return
      }

      if (runtime.draftPoints.length < 2) {
        runtime.setDraftPoints((previous) => [...previous, point])
        pickToolPoint(runtime, point)
        runtime.setStatus(runtime.draftPoints.length === 0 ? 'Arc: pick midpoint' : 'Arc: pick end point')
        return
      }

      runtime.setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'arc',
          layerId: runtime.activeLayerId,
          lineTypeId: runtime.activeLineTypeId,
          groupId: runtime.activeSketchGroup?.id,
          start: runtime.draftPoints[0],
          mid: runtime.draftPoints[1],
          end: point,
        },
      ])
      pickToolPoint(runtime, point)
      runtime.clearDraft()
      runtime.setStatus('Arc created')
    },
    getHint(draftPoints) {
      if (draftPoints.length === 1) {
        return 'Arc: pick midpoint'
      }
      if (draftPoints.length === 2) {
        return 'Arc: pick end point'
      }
      return null
    },
  },
  bezier: {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      if (runtime.draftPoints.length < 2) {
        runtime.setDraftPoints((previous) => [...previous, point])
        pickToolPoint(runtime, point)
        runtime.setStatus(runtime.draftPoints.length === 0 ? 'Bezier: pick control point' : 'Bezier: pick end point')
        return
      }

      runtime.setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'bezier',
          layerId: runtime.activeLayerId,
          lineTypeId: runtime.activeLineTypeId,
          groupId: runtime.activeSketchGroup?.id,
          start: runtime.draftPoints[0],
          control: runtime.draftPoints[1],
          end: point,
        },
      ])
      pickToolPoint(runtime, point)
      runtime.clearDraft()
      runtime.setStatus('Bezier created')
    },
    getHint(draftPoints) {
      if (draftPoints.length === 1) {
        return 'Bezier: pick control point'
      }
      if (draftPoints.length === 2) {
        return 'Bezier: pick end point'
      }
      return null
    },
  },
  freehand: {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      if (runtime.draftPoints.length === 0) {
        runtime.setDraftPoints([point])
        pickToolPoint(runtime, point)
        runtime.setStatus('Freehand: drawing... press Escape to finish')
        return
      }

      const lastPoint = runtime.draftPoints[runtime.draftPoints.length - 1]
      if (distance(lastPoint, point) < 0.5) {
        return
      }

      runtime.setDraftPoints((previous) => [...previous, point])
    },
    onCommand(command, context) {
      const trimmed = command.trim().toLowerCase()
      if (trimmed === 'finish' || trimmed === 'done') {
        const { runtime } = context
        const rawPoints = runtime.draftPoints
        if (rawPoints.length < 3) {
          runtime.clearDraft()
          runtime.setStatus('Freehand: not enough points')
          return 'Not enough points for freehand curve'
        }

        const smoothed = smoothPoints(rawPoints, 3)
        const shapes = fitFreehandCurve(
          smoothed,
          1.0,
          runtime.activeLayerId,
          runtime.activeLineTypeId,
          runtime.activeSketchGroup?.id,
        )

        if (shapes.length > 0) {
          runtime.setShapes((previous) => [...previous, ...shapes])
          runtime.setStatus(`Freehand: created ${shapes.length} curve segment(s)`)
        } else {
          runtime.setStatus('Freehand: could not fit curve')
        }

        runtime.clearDraft()
        return `Created ${shapes.length} freehand segments`
      }

      return 'Type "finish" to complete freehand drawing'
    },
    getHint(draftPoints) {
      return draftPoints.length > 0 ? 'Freehand: click to add points, "finish" or Escape to complete' : null
    },
  },
  'cut-line': {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      const cutLineType = Object.values(runtime.lineTypesById).find((lineType) => lineType?.role === 'cut')
      const cutLineTypeId = cutLineType?.id ?? runtime.activeLineTypeId

      if (runtime.draftPoints.length === 0) {
        runtime.setDraftPoints([point])
        pickToolPoint(runtime, point)
        runtime.setStatus('Cut: click to continue, Escape to finish')
        return
      }

      const start = runtime.draftPoints[runtime.draftPoints.length - 1]
      if (distance(start, point) < MIN_SHAPE_DISTANCE) {
        runtime.setStatus('Cut segment ignored: points overlap')
        return
      }

      addLineShape(runtime, start, point, { lineTypeId: cutLineTypeId })
      runtime.setDraftPoints([point])
      pickToolPoint(runtime, point)
      runtime.setStatus('Cut segment created')
    },
    getHint(draftPoints) {
      return draftPoints.length > 0 ? 'Cut: click to continue, Escape to finish' : null
    },
  },
  text: {
    onPointerDown(point, runtime) {
      if (!withWritableShapeTarget(runtime)) {
        return
      }

      const { safeText, safeFontSize, baseLength } = createTextShapeLength(runtime.textDraftValue, runtime.textFontSizeMm)
      runtime.setShapes((previous) => [
        ...previous,
        {
          id: uid(),
          type: 'text',
          layerId: runtime.activeLayerId,
          lineTypeId: runtime.activeLineTypeId,
          groupId: runtime.activeSketchGroup?.id,
          start: point,
          end: { x: point.x + baseLength, y: point.y },
          text: safeText,
          fontFamily: runtime.textFontFamily,
          fontSizeMm: safeFontSize,
          transform: runtime.textTransformMode,
          radiusMm: clamp(runtime.textRadiusMm || 40, 2, 2000),
          sweepDeg: clamp(runtime.textSweepDeg || 140, -1080, 1080),
        },
      ])
      pickToolPoint(runtime, point)
      runtime.clearDraft()
      runtime.setStatus(`Text placed: ${safeText}`)
    },
  },
} satisfies Partial<Record<string, ToolDefinition>>
