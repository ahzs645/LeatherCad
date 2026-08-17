import * as React from 'react'
import { round } from '../../cad/cad-geometry'
import type { Point, Shape, TextShape } from '../../cad/cad-types'
import type { CanvasInteractionPreview, HandlePointKey } from '../../hooks/useCanvasInteractions'
import type { ThreadSegment } from '../../ops/stitch-simulator-ops'

export type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boundsIntersect(bounds: Bounds, viewportBounds: Bounds, padding = 0) {
  return !(
    bounds.maxX < viewportBounds.minX - padding ||
    bounds.minX > viewportBounds.maxX + padding ||
    bounds.maxY < viewportBounds.minY - padding ||
    bounds.minY > viewportBounds.maxY + padding
  )
}

export function pointInBounds(point: Point, viewportBounds: Bounds, padding = 0) {
  return (
    point.x >= viewportBounds.minX - padding &&
    point.x <= viewportBounds.maxX + padding &&
    point.y >= viewportBounds.minY - padding &&
    point.y <= viewportBounds.maxY + padding
  )
}

export function shapeBounds(shape: Shape): Bounds {
  if (shape.type === 'line' || shape.type === 'text') {
    return {
      minX: Math.min(shape.start.x, shape.end.x),
      minY: Math.min(shape.start.y, shape.end.y),
      maxX: Math.max(shape.start.x, shape.end.x),
      maxY: Math.max(shape.start.y, shape.end.y),
    }
  }

  if (shape.type === 'arc') {
    return {
      minX: Math.min(shape.start.x, shape.mid.x, shape.end.x),
      minY: Math.min(shape.start.y, shape.mid.y, shape.end.y),
      maxX: Math.max(shape.start.x, shape.mid.x, shape.end.x),
      maxY: Math.max(shape.start.y, shape.mid.y, shape.end.y),
    }
  }

  return {
    minX: Math.min(shape.start.x, shape.control.x, shape.end.x),
    minY: Math.min(shape.start.y, shape.control.y, shape.end.y),
    maxX: Math.max(shape.start.x, shape.control.x, shape.end.x),
    maxY: Math.max(shape.start.y, shape.control.y, shape.end.y),
  }
}

export function lineBounds(start: Point, end: Point): Bounds {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  }
}

function pointAlongSegment(from: Point, to: Point, distanceFromEnd: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return { ...to }
  }

  const clampedDistance = Math.max(0, Math.min(length, distanceFromEnd))
  const ratio = (length - clampedDistance) / length
  return {
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
  }
}

export function buildDirectionArrowPoints(segment: ThreadSegment, size: number) {
  const dx = segment.to.x - segment.from.x
  const dy = segment.to.y - segment.from.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return null
  }

  const ux = dx / length
  const uy = dy / length
  const tip = pointAlongSegment(segment.from, segment.to, size * 0.8)
  const baseCenter = pointAlongSegment(segment.from, segment.to, size * 2.1)
  const normalX = -uy
  const normalY = ux

  return [
    `${tip.x},${tip.y}`,
    `${baseCenter.x + normalX * size * 0.8},${baseCenter.y + normalY * size * 0.8}`,
    `${baseCenter.x - normalX * size * 0.8},${baseCenter.y - normalY * size * 0.8}`,
  ].join(' ')
}

export function withPreviewApplied(shape: Shape, preview: CanvasInteractionPreview): Shape {
  if (preview.kind === 'selection-box') {
    return shape
  }

  if (preview.kind === 'move') {
    if (shape.type === 'line') {
      return {
        ...shape,
        start: { x: shape.start.x + preview.deltaX, y: shape.start.y + preview.deltaY },
        end: { x: shape.end.x + preview.deltaX, y: shape.end.y + preview.deltaY },
      }
    }
    if (shape.type === 'arc') {
      return {
        ...shape,
        start: { x: shape.start.x + preview.deltaX, y: shape.start.y + preview.deltaY },
        mid: { x: shape.mid.x + preview.deltaX, y: shape.mid.y + preview.deltaY },
        end: { x: shape.end.x + preview.deltaX, y: shape.end.y + preview.deltaY },
      }
    }
    if (shape.type === 'bezier') {
      return {
        ...shape,
        start: { x: shape.start.x + preview.deltaX, y: shape.start.y + preview.deltaY },
        control: { x: shape.control.x + preview.deltaX, y: shape.control.y + preview.deltaY },
        end: { x: shape.end.x + preview.deltaX, y: shape.end.y + preview.deltaY },
      }
    }
    return {
      ...shape,
      start: { x: shape.start.x + preview.deltaX, y: shape.start.y + preview.deltaY },
      end: { x: shape.end.x + preview.deltaX, y: shape.end.y + preview.deltaY },
    }
  }

  if (shape.id !== preview.shapeId) {
    return shape
  }

  if (shape.type === 'line' || shape.type === 'text') {
    if (preview.pointKey === 'start' || preview.pointKey === 'end') {
      return { ...shape, [preview.pointKey]: preview.point }
    }
    return shape
  }

  if (shape.type === 'arc') {
    if (preview.pointKey === 'start' || preview.pointKey === 'mid' || preview.pointKey === 'end') {
      return { ...shape, [preview.pointKey]: preview.point }
    }
    return shape
  }

  if (preview.pointKey === 'start' || preview.pointKey === 'control' || preview.pointKey === 'end') {
    return { ...shape, [preview.pointKey]: preview.point }
  }

  return shape
}

export function arrowMarkerStyle(shape: Shape): Record<string, string> {
  const style: Record<string, string> = {}
  if ('arrowStart' in shape && shape.arrowStart) {
    style.markerStart = 'url(#arrow-start)'
  }
  if ('arrowEnd' in shape && shape.arrowEnd) {
    style.markerEnd = 'url(#arrow-end)'
  }
  return style
}

export function shapeHandleEntries(shape: Shape): Array<{ key: HandlePointKey; point: Point }> {
  if (shape.type === 'line' || shape.type === 'text') {
    return [
      { key: 'start', point: shape.start },
      { key: 'end', point: shape.end },
    ]
  }
  if (shape.type === 'arc') {
    return [
      { key: 'start', point: shape.start },
      { key: 'mid', point: shape.mid },
      { key: 'end', point: shape.end },
    ]
  }
  return [
    { key: 'start', point: shape.start },
    { key: 'control', point: shape.control },
    { key: 'end', point: shape.end },
  ]
}

type RenderTextShapeOptions = {
  key: string
  color: string
  className: string
  opacity: number
  interactive: boolean
  onPointerDown: (event: React.PointerEvent<SVGElement>, shapeId: string) => void
  buildTextGlyphPlacements: (shape: TextShape) => Array<{ x: number; y: number; rotationDeg: number; char: string }>
  normalizeTextShape: (shape: TextShape) => TextShape
  textBaselineAngleDeg: (shape: TextShape) => number
  viewportScale?: number
}

// Clamp the on-screen glyph size so text stays readable across the same zoom
// range as grid labels. The inner <g transform="scale(viewport.scale)"> makes
// world-space fonts shrink when zoomed out and balloon when zoomed in, so we
// adapt the world-space font size to a stable screen-space range.
const TEXT_MIN_SCREEN_PX = 11
const TEXT_MAX_SCREEN_PX = 14
const TEXT_MIN_WORLD_MM = 0.01

export function resolveAdaptiveTextFontSize(
  fontSizeMm: number,
  viewportScale = 1,
  minScreenPx = TEXT_MIN_SCREEN_PX,
  maxScreenPx = TEXT_MAX_SCREEN_PX,
) {
  const safeScale = Number.isFinite(viewportScale) && viewportScale > 0 ? viewportScale : 1
  const safeFontSizeMm = Number.isFinite(fontSizeMm) && fontSizeMm > 0 ? fontSizeMm : 2
  const minWorldFontSize = Math.max(0, minScreenPx) / safeScale
  const maxWorldFontSize = Math.max(minWorldFontSize, maxScreenPx / safeScale)
  return round(Math.max(TEXT_MIN_WORLD_MM, Math.min(Math.max(safeFontSizeMm, minWorldFontSize), maxWorldFontSize)))
}

export function renderTextShape(shape: TextShape, options: RenderTextShapeOptions) {
  const normalized = options.normalizeTextShape(shape)
  const scale = options.viewportScale && options.viewportScale > 0 ? options.viewportScale : 1
  const fontSize = resolveAdaptiveTextFontSize(normalized.fontSizeMm, scale)
  const haloStrokeWidth = round(Math.max(0.8, 3 / scale))
  const trackingMm = typeof normalized.trackingMm === 'number' && Number.isFinite(normalized.trackingMm)
    ? normalized.trackingMm
    : 0
  const textStyle: React.CSSProperties = {
    fill: options.color,
    fontFamily: normalized.fontFamily,
    fontSize: `${fontSize}px`,
    letterSpacing: trackingMm !== 0 ? `${trackingMm}` : undefined,
    opacity: options.opacity,
    paintOrder: 'stroke',
    stroke: '#f8fafc',
    strokeLinejoin: 'round',
    strokeWidth: `${haloStrokeWidth}px`,
  }

  if (normalized.transform === 'none') {
    const baselineAngle = options.textBaselineAngleDeg(normalized)
    return (
      <text
        key={options.key}
        x={round(normalized.start.x)}
        y={round(normalized.start.y)}
        className={options.className}
        style={{
          ...textStyle,
          pointerEvents: options.interactive ? 'auto' : 'none',
        }}
        transform={`rotate(${round(baselineAngle)} ${round(normalized.start.x)} ${round(normalized.start.y)})`}
        onPointerDown={options.interactive ? (event) => options.onPointerDown(event, shape.id) : undefined}
      >
        {normalized.text}
      </text>
    )
  }

  const glyphs = options.buildTextGlyphPlacements(normalized)
  return (
    <g key={options.key} style={{ pointerEvents: options.interactive ? 'auto' : 'none' }}>
      {glyphs.map((glyph, index) => (
        <text
          key={`${shape.id}-glyph-${index}`}
          x={round(glyph.x)}
          y={round(glyph.y)}
          className={options.className}
          style={textStyle}
          transform={`rotate(${round(glyph.rotationDeg)} ${round(glyph.x)} ${round(glyph.y)})`}
          textAnchor="middle"
          dominantBaseline="middle"
          onPointerDown={options.interactive ? (event) => options.onPointerDown(event, shape.id) : undefined}
        >
          {glyph.char}
        </text>
      ))}
    </g>
  )
}
