import type { ComponentProps } from 'react'
import type { ArcShape, LineShape, Point } from '../cad/cad-types'
import { EditorStatusBar } from '../components/EditorStatusBar'
import { useEditorDocumentSelector } from '../state/providers/EditorDocumentStateProvider'
import { useEditorSelectionSelector } from '../state/providers/EditorSelectionStateProvider'
import { useEditorUISelector } from '../state/providers/EditorUIStateProvider'

function arcSweepAngleDeg(p1: Point, p2: Point, p3: Point): number {
  const denom = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y))
  if (Math.abs(denom) < 1e-10) return 0
  const s1 = p1.x * p1.x + p1.y * p1.y
  const s2 = p2.x * p2.x + p2.y * p2.y
  const s3 = p3.x * p3.x + p3.y * p3.y
  const cx = (s1 * (p2.y - p3.y) + s2 * (p3.y - p1.y) + s3 * (p1.y - p2.y)) / denom
  const cy = (s1 * (p3.x - p2.x) + s2 * (p1.x - p3.x) + s3 * (p2.x - p1.x)) / denom
  const a1 = Math.atan2(p1.y - cy, p1.x - cx)
  const am = Math.atan2(p2.y - cy, p2.x - cx)
  const a3 = Math.atan2(p3.y - cy, p3.x - cx)
  const TAU = Math.PI * 2
  const normalize = (value: number) => ((value % TAU) + TAU) % TAU
  const sweepToEnd = normalize(a3 - a1)
  const sweepToMid = normalize(am - a1)
  const ccw = sweepToMid <= sweepToEnd
  const sweep = ccw ? sweepToEnd : TAU - sweepToEnd
  return (sweep * 180) / Math.PI
}

function angleBetweenLinesDeg(a: LineShape, b: LineShape): number {
  const v1x = a.end.x - a.start.x
  const v1y = a.end.y - a.start.y
  const v2x = b.end.x - b.start.x
  const v2y = b.end.y - b.start.y
  const dot = v1x * v2x + v1y * v2y
  const m1 = Math.hypot(v1x, v1y)
  const m2 = Math.hypot(v2x, v2y)
  if (m1 < 1e-8 || m2 < 1e-8) return 0
  const cosine = Math.max(-1, Math.min(1, dot / (m1 * m2)))
  return (Math.acos(cosine) * 180) / Math.PI
}
// Re-export for type narrowing consumers.
export type { ArcShape }

type UseEditorStatusBarPropsParams = {
  toolLabel: string
  zoomPercent: number
  visibleShapeCount: number
  layerCount: number
  templateCount: number
}

export function useEditorStatusBarProps(params: UseEditorStatusBarPropsParams): ComponentProps<typeof EditorStatusBar> {
  const {
    toolLabel,
    zoomPercent,
    visibleShapeCount,
    layerCount,
    templateCount,
  } = params
  const {
    shapes,
    shapeCount,
    sketchGroupCount,
    lineTypes,
    foldLineCount,
    stitchHoleCount,
    seamAllowanceCount,
    constraintCount,
    hardwareMarkerCount,
    tracingOverlayCount,
  } = useEditorDocumentSelector((state) => ({
    shapes: state.shapes,
    shapeCount: state.shapes.length,
    sketchGroupCount: state.sketchGroups.length,
    lineTypes: state.lineTypes,
    foldLineCount: state.foldLines.length,
    stitchHoleCount: state.stitchHoles.length,
    seamAllowanceCount: state.seamAllowances.length,
    constraintCount: state.constraints.length,
    hardwareMarkerCount: state.hardwareMarkers.length,
    tracingOverlayCount: state.tracingOverlays.length,
  }))
  const selectedShapeIds = useEditorSelectionSelector((state) => state.selectedShapeIds)
  const { status, displayUnit } = useEditorUISelector((state) => ({
    status: state.status,
    displayUnit: state.displayUnit,
  }))

  const selectionInfo = (() => {
    if (selectedShapeIds.length === 1) {
      const shape = shapes.find((entry) => entry.id === selectedShapeIds[0])
      if (shape?.type === 'arc') {
        const angleDeg = arcSweepAngleDeg(shape.start, shape.mid, shape.end)
        return `Arc sweep: ${angleDeg.toFixed(1)}°`
      }
    }
    if (selectedShapeIds.length === 2) {
      const a = shapes.find((entry) => entry.id === selectedShapeIds[0])
      const b = shapes.find((entry) => entry.id === selectedShapeIds[1])
      if (a?.type === 'line' && b?.type === 'line') {
        const angleDeg = angleBetweenLinesDeg(a, b)
        return `Line angle: ${angleDeg.toFixed(1)}°`
      }
    }
    return null
  })()

  return {
    toolLabel,
    status,
    selectionInfo,
    displayUnit,
    zoomPercent,
    visibleShapeCount,
    shapeCount,
    layerCount,
    sketchGroupCount,
    visibleLineTypeCount: lineTypes.filter((lineType) => lineType.visible).length,
    lineTypeCount: lineTypes.length,
    foldLineCount,
    stitchHoleCount,
    seamAllowanceCount,
    constraintCount,
    hardwareMarkerCount,
    tracingOverlayCount,
    templateCount,
  }
}
