import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { arcPath, round } from '../cad/cad-geometry'
import type { Point, Tool } from '../cad/cad-types'
import { GRID_EXTENT, GRID_STEP } from '../editor-constants'

type UseDraftPreviewElementParams = {
  cursorPoint: Point | null
  draftPoints: Point[]
  tool: Tool
  activeLineTypeStrokeColor: string
  activeLineTypeDasharray: string | undefined
}

export function useGridLines() {
  return useMemo(() => {
    const lines: ReactElement[] = []
    for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i += GRID_STEP) {
      lines.push(
        <line key={`v-${i}`} x1={i} y1={-GRID_EXTENT} x2={i} y2={GRID_EXTENT} className="grid-line" />,
        <line key={`h-${i}`} x1={-GRID_EXTENT} y1={i} x2={GRID_EXTENT} y2={i} className="grid-line" />,
      )
    }
    lines.push(
      <line key="axis-y" x1={0} y1={-GRID_EXTENT} x2={0} y2={GRID_EXTENT} className="axis-line" />,
      <line key="axis-x" x1={-GRID_EXTENT} y1={0} x2={GRID_EXTENT} y2={0} className="axis-line" />,
    )
    return lines
  }, [])
}

export function useDraftPreviewElement(params: UseDraftPreviewElementParams) {
  const {
    cursorPoint,
    draftPoints,
    tool,
    activeLineTypeStrokeColor,
    activeLineTypeDasharray,
  } = params

  return useMemo(() => {
    if (!cursorPoint || draftPoints.length === 0) {
      return null
    }

    if (tool === 'line' || tool === 'fold') {
      return (
        <line
          x1={draftPoints[0].x}
          y1={draftPoints[0].y}
          x2={cursorPoint.x}
          y2={cursorPoint.y}
          className={tool === 'fold' ? 'fold-preview' : 'shape-preview'}
          style={tool === 'fold' ? undefined : { stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
        />
      )
    }

    if (tool === 'arc') {
      if (draftPoints.length === 1) {
        return (
          <line
            x1={draftPoints[0].x}
            y1={draftPoints[0].y}
            x2={cursorPoint.x}
            y2={cursorPoint.y}
            className="shape-preview"
            style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
          />
        )
      }

      return (
        <path
          d={arcPath(draftPoints[0], draftPoints[1], cursorPoint)}
          className="shape-preview"
          style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
        />
      )
    }

    if (tool === 'bezier') {
      if (draftPoints.length === 1) {
        return (
          <line
            x1={draftPoints[0].x}
            y1={draftPoints[0].y}
            x2={cursorPoint.x}
            y2={cursorPoint.y}
            className="shape-preview"
            style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
          />
        )
      }

      return (
        <path
          d={`M ${round(draftPoints[0].x)} ${round(draftPoints[0].y)} Q ${round(draftPoints[1].x)} ${round(
            draftPoints[1].y,
          )} ${round(cursorPoint.x)} ${round(cursorPoint.y)}`}
          className="shape-preview"
          style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
        />
      )
    }

    return null
  }, [cursorPoint, draftPoints, tool, activeLineTypeStrokeColor, activeLineTypeDasharray])
}
