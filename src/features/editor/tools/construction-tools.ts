import { sanitizeFoldLine } from '../editor-parsers'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
} from '../ops/fold-line-ops'
import type { ToolDefinition } from './tool-types'
import { MIN_SHAPE_DISTANCE, distance, pickToolPoint, uid } from './tool-helpers'

export const constructionToolDefinitions = {
  fold: {
    onPointerDown(point, runtime) {
      if (runtime.draftPoints.length === 0) {
        runtime.setDraftPoints([point])
        pickToolPoint(runtime, point)
        runtime.setStatus('Fold line: pick end point')
        return
      }

      const start = runtime.draftPoints[0]
      if (distance(start, point) < MIN_SHAPE_DISTANCE) {
        runtime.setStatus('Fold line ignored: start and end overlap')
        runtime.clearDraft()
        return
      }

      runtime.setFoldLines((previous) => [
        ...previous,
        sanitizeFoldLine({
          id: uid(),
          name: `Fold ${previous.length + 1}`,
          start,
          end: point,
          angleDeg: 0,
          maxAngleDeg: 180,
          direction: DEFAULT_FOLD_DIRECTION,
          radiusMm: DEFAULT_FOLD_RADIUS_MM,
          thicknessMm: DEFAULT_FOLD_THICKNESS_MM,
          neutralAxisRatio: DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
          stiffness: DEFAULT_FOLD_STIFFNESS,
          clearanceMm: DEFAULT_FOLD_CLEARANCE_MM,
        }),
      ])
      pickToolPoint(runtime, point)
      runtime.clearDraft()
      runtime.setStatus('Fold line assigned')
    },
  },
  dimension: {
    onPointerDown(point, runtime) {
      if (runtime.draftPoints.length === 0) {
        runtime.setDraftPoints([point])
        pickToolPoint(runtime, point)
        runtime.setStatus('Dimension: pick second point')
        return
      }

      const start = runtime.draftPoints[0]
      if (distance(start, point) < MIN_SHAPE_DISTANCE) {
        runtime.setStatus('Dimension ignored: points overlap')
        runtime.clearDraft()
        return
      }

      const lengthMm = distance(start, point)
      const defaults = runtime.dimensionDefaults
      runtime.setDimensionLines((previous) => [
        ...previous,
        {
          id: uid(),
          start: { x: start.x, y: start.y },
          end: { x: point.x, y: point.y },
          offsetMm: 6,
          text: `${lengthMm.toFixed(Math.min(6, Math.max(0, defaults.precision)))}mm`,
          fontSizeMm: defaults.fontSizeMm,
          precision: defaults.precision,
          arrowOnly: defaults.arrowOnly,
          singleLine: defaults.singleLine,
          textInside: defaults.textInside,
          textReverse: defaults.textReverse,
          layerId: runtime.activeLayerId,
          lineTypeId: runtime.activeLineTypeId,
        },
      ])
      pickToolPoint(runtime, point)
      runtime.clearDraft()
      runtime.setStatus(`Dimension placed (${lengthMm.toFixed(1)}mm)`)
    },
  },
} satisfies Partial<Record<string, ToolDefinition>>
