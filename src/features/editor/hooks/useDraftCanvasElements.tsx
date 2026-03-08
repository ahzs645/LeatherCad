import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { arcPath, round } from '../cad/cad-geometry'
import type { Point, Tool } from '../cad/cad-types'
import { GRID_EXTENT } from '../editor-constants'

type UseDraftPreviewElementParams = {
  cursorPoint: Point | null
  draftPoints: Point[]
  tool: Tool
  activeLineTypeStrokeColor: string
  activeLineTypeDasharray: string | undefined
}

export function useGridLines(gridSpacing: number) {
  return useMemo(() => {
    const lines: ReactElement[] = []
    const majorStep = gridSpacing
    // Minor subdivisions: split each major cell into 5 (or 2 if spacing <= 2)
    const subdivisions = majorStep <= 2 ? 2 : 5
    const minorStep = majorStep / subdivisions

    // Limit extent for fine grids to avoid too many elements
    const extent = Math.min(GRID_EXTENT, Math.max(500, majorStep * 80))

    // Minor grid lines
    for (let i = -extent; i <= extent; i += minorStep) {
      // Skip positions that fall on major grid lines
      if (Math.abs(i % majorStep) > minorStep * 0.1) {
        lines.push(
          <line key={`mv-${i}`} x1={i} y1={-extent} x2={i} y2={extent} className="grid-line-minor" />,
          <line key={`mh-${i}`} x1={-extent} y1={i} x2={extent} y2={i} className="grid-line-minor" />,
        )
      }
    }

    // Major grid lines
    for (let i = -extent; i <= extent; i += majorStep) {
      lines.push(
        <line key={`v-${i}`} x1={i} y1={-extent} x2={i} y2={extent} className="grid-line" />,
        <line key={`h-${i}`} x1={-extent} y1={i} x2={extent} y2={i} className="grid-line" />,
      )
    }

    // Axis lines (always on top)
    lines.push(
      <line key="axis-y" x1={0} y1={-extent} x2={0} y2={extent} className="axis-line" />,
      <line key="axis-x" x1={-extent} y1={0} x2={extent} y2={0} className="axis-line" />,
    )
    return lines
  }, [gridSpacing])
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
