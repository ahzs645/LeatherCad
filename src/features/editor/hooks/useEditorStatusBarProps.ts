import type { ComponentProps } from 'react'
import type { LineType } from '../cad/cad-types'
import { EditorStatusBar } from '../components/EditorStatusBar'

type UseEditorStatusBarPropsParams = {
  toolLabel: string
  status: string
  zoomPercent: number
  visibleShapeCount: number
  shapeCount: number
  layerCount: number
  sketchGroupCount: number
  lineTypes: LineType[]
  foldLineCount: number
  stitchHoleCount: number
  seamAllowanceCount: number
  constraintCount: number
  hardwareMarkerCount: number
  tracingOverlayCount: number
  templateCount: number
}

export function useEditorStatusBarProps(params: UseEditorStatusBarPropsParams): ComponentProps<typeof EditorStatusBar> {
  const {
    toolLabel,
    status,
    zoomPercent,
    visibleShapeCount,
    shapeCount,
    layerCount,
    sketchGroupCount,
    lineTypes,
    foldLineCount,
    stitchHoleCount,
    seamAllowanceCount,
    constraintCount,
    hardwareMarkerCount,
    tracingOverlayCount,
    templateCount,
  } = params

  return {
    toolLabel,
    status,
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
