import type { ComponentProps } from 'react'
import { EditorStatusBar } from '../components/EditorStatusBar'
import { useEditorDocumentSelector } from '../state/providers/EditorDocumentStateProvider'
import { useEditorUISelector } from '../state/providers/EditorUIStateProvider'

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
  const { status, displayUnit } = useEditorUISelector((state) => ({
    status: state.status,
    displayUnit: state.displayUnit,
  }))

  return {
    toolLabel,
    status,
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
