import type { PointerEvent } from 'react'
import { arcPath, round } from '../../cad/cad-geometry'
import type { Shape, TextShape } from '../../cad/cad-types'
import {
  arrowMarkerStyle,
  renderTextShape,
} from './canvas-geometry'

type RenderShapeOptions = {
  key: string
  className: string
  color: string
  strokeDasharray?: string
  opacity: number
  interactive: boolean
  onShapePointerDown: (event: PointerEvent<SVGElement>, shapeId: string) => void
  buildTextGlyphPlacements: (shape: TextShape) => Array<{ x: number; y: number; rotationDeg: number; char: string }>
  normalizeTextShape: (shape: TextShape) => TextShape
  textBaselineAngleDeg: (shape: TextShape) => number
}

export function renderCanvasShape(shape: Shape, options: RenderShapeOptions) {
  if (shape.type === 'text') {
    return renderTextShape(shape, {
      key: options.key,
      color: options.color,
      className: options.className,
      opacity: options.opacity,
      interactive: options.interactive,
      onPointerDown: options.onShapePointerDown,
      buildTextGlyphPlacements: options.buildTextGlyphPlacements,
      normalizeTextShape: options.normalizeTextShape,
      textBaselineAngleDeg: options.textBaselineAngleDeg,
    })
  }

  if (shape.type === 'line') {
    return (
      <line
        key={options.key}
        x1={shape.start.x}
        y1={shape.start.y}
        x2={shape.end.x}
        y2={shape.end.y}
        className={options.className}
        style={{ stroke: options.color, strokeDasharray: options.strokeDasharray, strokeOpacity: options.opacity, ...arrowMarkerStyle(shape) }}
        onPointerDown={options.interactive ? (event) => options.onShapePointerDown(event, shape.id) : undefined}
      />
    )
  }

  if (shape.type === 'arc') {
    return (
      <path
        key={options.key}
        d={arcPath(shape.start, shape.mid, shape.end)}
        className={options.className}
        style={{ stroke: options.color, strokeDasharray: options.strokeDasharray, strokeOpacity: options.opacity, ...arrowMarkerStyle(shape) }}
        onPointerDown={options.interactive ? (event) => options.onShapePointerDown(event, shape.id) : undefined}
      />
    )
  }

  return (
    <path
      key={options.key}
      d={`M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(
        shape.end.x,
      )} ${round(shape.end.y)}`}
      className={options.className}
      style={{ stroke: options.color, strokeDasharray: options.strokeDasharray, strokeOpacity: options.opacity, ...arrowMarkerStyle(shape) }}
      onPointerDown={options.interactive ? (event) => options.onShapePointerDown(event, shape.id) : undefined}
    />
  )
}
