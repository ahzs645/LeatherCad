import { useMemo } from 'react'
import { arcPath, round } from '../cad/cad-geometry'
import { useEditorToolSelector } from '../state/providers/EditorToolStateProvider'

type UseDraftPreviewElementParams = {
  activeLineTypeStrokeColor: string
  activeLineTypeDasharray: string | undefined
}

export function useDraftPreviewElement(params: UseDraftPreviewElementParams) {
  const { activeLineTypeStrokeColor, activeLineTypeDasharray } = params
  const { cursorPoint, draftPoints, tool } = useEditorToolSelector((state) => ({
    cursorPoint: state.cursorPoint,
    draftPoints: state.draftPoints,
    tool: state.tool,
  }))

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

    if (tool === 'polyline') {
      const start = draftPoints[draftPoints.length - 1]
      return (
        <line
          x1={start.x}
          y1={start.y}
          x2={cursorPoint.x}
          y2={cursorPoint.y}
          className="shape-preview"
          style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
        />
      )
    }

    if (tool === 'rectangle') {
      const start = draftPoints[0]
      const minX = Math.min(start.x, cursorPoint.x)
      const minY = Math.min(start.y, cursorPoint.y)
      const width = Math.abs(cursorPoint.x - start.x)
      const height = Math.abs(cursorPoint.y - start.y)
      return (
        <rect
          x={minX}
          y={minY}
          width={width}
          height={height}
          className="shape-preview"
          style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
        />
      )
    }

    if (tool === 'circle') {
      const center = draftPoints[0]
      const radius = Math.hypot(cursorPoint.x - center.x, cursorPoint.y - center.y)
      return (
        <circle
          cx={center.x}
          cy={center.y}
          r={radius}
          className="shape-preview"
          style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
        />
      )
    }

    if (tool === 'ellipse') {
      const center = draftPoints[0]
      const radiusX = Math.abs(cursorPoint.x - center.x)
      const radiusY = Math.abs(cursorPoint.y - center.y)
      return (
        <ellipse
          cx={center.x}
          cy={center.y}
          rx={radiusX}
          ry={radiusY}
          className="shape-preview"
          style={{ stroke: activeLineTypeStrokeColor, strokeDasharray: activeLineTypeDasharray }}
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
