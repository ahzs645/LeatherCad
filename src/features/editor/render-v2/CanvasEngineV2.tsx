import { useEffect, useRef } from 'react'
import type { Point, StitchHole } from '../cad/cad-types'
import type { Viewport } from '../cad/cad-types'
import { computeAdaptiveSpacing } from '../ops/grid-spacing'
import { createStitchHolePrimitive } from '../ops/stitch-hole-render'
import type { CanvasRenderEntity } from '../render/canvas-render-model'

/**
 * Parallel canvas-based rendering engine. Opt-in via `?engine=v2` URL param or
 * `localStorage.leathercad_engine_v2 = '1'`. Coexists with the SVG renderer so
 * we can iterate on performance/fidelity without disturbing the shipping code.
 *
 * Currently renders: adaptive grid + axis + render-model entities.
 */

type CanvasEngineV2Props = {
  viewport: Viewport
  gridSpacing: number
  darkMode: boolean
  entities: CanvasRenderEntity[]
  width: number
  height: number
}

type ScreenProjector = (point: Point) => Point

function isFinitePoint(point: Point | undefined): point is Point {
  return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y)
}

function applyAlpha(color: string, alpha: number) {
  if (alpha >= 0.999) return color
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4
      ? color.slice(1).split('').map((entry) => `${entry}${entry}`).join('')
      : color.slice(1)
    const value = Number.parseInt(hex, 16)
    if (Number.isFinite(value)) {
      return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
    }
  }
  return color
}

function setStroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  widthPx: number,
  dashPx: number[] = [],
  alpha = 1,
) {
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = Math.max(0.5, widthPx)
  ctx.setLineDash(dashPx)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function drawLine(ctx: CanvasRenderingContext2D, project: ScreenProjector, start: Point, end: Point) {
  if (!isFinitePoint(start) || !isFinitePoint(end)) return
  const s = project(start)
  const e = project(end)
  ctx.beginPath()
  ctx.moveTo(s.x, s.y)
  ctx.lineTo(e.x, e.y)
  ctx.stroke()
}

function drawShapeEntity(
  ctx: CanvasRenderingContext2D,
  project: ScreenProjector,
  scale: number,
  entity: Extract<CanvasRenderEntity, { kind: 'shape' }>,
) {
  const shape = entity.shape
  ctx.save()
  setStroke(
    ctx,
    entity.paint.strokeColor,
    Math.max(1, (entity.paint.strokeWidthMm ?? 1.25) * scale),
    entity.paint.strokeDasharray
      ?.split(/[ ,]+/)
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0)
      .map((entry) => entry * scale) ?? [],
    entity.paint.opacity,
  )
  ctx.beginPath()
  if (shape.type === 'line') {
    const start = project(shape.start)
    const end = project(shape.end)
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
  } else if (shape.type === 'arc') {
    const start = project(shape.start)
    const mid = project(shape.mid)
    const end = project(shape.end)
    ctx.moveTo(start.x, start.y)
    ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y)
  } else if (shape.type === 'bezier') {
    const start = project(shape.start)
    const control = project(shape.control)
    const end = project(shape.end)
    ctx.moveTo(start.x, start.y)
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y)
  }
  ctx.stroke()
  ctx.restore()
}

function drawStitchHole(ctx: CanvasRenderingContext2D, project: ScreenProjector, scale: number, stitchHole: StitchHole) {
  if (!isFinitePoint(stitchHole.point)) return
  const primitive = createStitchHolePrimitive(stitchHole)
  ctx.save()
  if (primitive.kind === 'segment') {
    setStroke(ctx, '#f59e0b', Math.max(1.2, primitive.strokeWidthMm * scale))
    drawLine(ctx, project, primitive.start, primitive.end)
    ctx.restore()
    return
  }
  if (primitive.kind === 'polygon') {
    const points = primitive.points.filter(isFinitePoint).map(project)
    if (points.length >= 3) {
      setStroke(ctx, '#f59e0b', 1.7)
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
      ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()
    return
  }
  const center = project(primitive.center)
  const dotR = Math.max(2, primitive.radiusMm * scale)
  const outerR = dotR * 2.5
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 0.6
  ctx.setLineDash([1.2, 1])
  ctx.beginPath()
  ctx.arc(center.x, center.y, outerR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#c084fc'
  ctx.globalAlpha = 0.5
  ctx.setLineDash([0.8, 0.8])
  ctx.beginPath()
  ctx.moveTo(center.x - outerR * 1.3, center.y)
  ctx.lineTo(center.x + outerR * 1.3, center.y)
  ctx.moveTo(center.x, center.y - outerR * 1.3)
  ctx.lineTo(center.x, center.y + outerR * 1.3)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.fillStyle = '#f59e0b'
  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.arc(center.x, center.y, dotR, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawHardwareMarker(ctx: CanvasRenderingContext2D, project: ScreenProjector, scale: number, marker: Extract<CanvasRenderEntity, { kind: 'hardware-marker' }>['payload']) {
  if (!isFinitePoint(marker.point)) return
  const point = project(marker.point)
  ctx.save()
  ctx.fillStyle = 'rgba(250, 204, 21, 0.12)'
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(point.x - 4.2, point.y)
  ctx.lineTo(point.x + 4.2, point.y)
  ctx.moveTo(point.x, point.y - 4.2)
  ctx.lineTo(point.x, point.y + 4.2)
  ctx.stroke()
  if (scale >= 0.35) {
    ctx.fillStyle = '#64748b'
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)'
    ctx.lineWidth = 2
    ctx.font = '600 11px sans-serif'
    const text = `${marker.label} (${marker.holeDiameterMm.toFixed(1)}mm)`
    ctx.strokeText(text, point.x + 5, point.y - 5)
    ctx.fillText(text, point.x + 5, point.y - 5)
  }
  ctx.restore()
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point, sizePx: number, fill = false) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return
  const ux = dx / len
  const uy = dy / len
  const base = { x: to.x - ux * sizePx, y: to.y - uy * sizePx }
  const wing = sizePx * 0.45
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(base.x - uy * wing, base.y + ux * wing)
  ctx.lineTo(base.x + uy * wing, base.y - ux * wing)
  ctx.closePath()
  if (fill) {
    ctx.fill()
  } else {
    ctx.stroke()
  }
}

function drawPlacementGuide(ctx: CanvasRenderingContext2D, project: ScreenProjector, scale: number, guide: Extract<CanvasRenderEntity, { kind: 'placement-guide' }>['payload']) {
  if (!isFinitePoint(guide.point)) return
  const radians = (guide.rotationDeg * Math.PI) / 180
  const halfWidth = guide.widthMm / 2
  const halfHeight = guide.heightMm / 2
  const rotatePoint = (x: number, y: number): Point => ({
    x: guide.point.x + x * Math.cos(radians) - y * Math.sin(radians),
    y: guide.point.y + x * Math.sin(radians) + y * Math.cos(radians),
  })
  ctx.save()
  setStroke(ctx, '#1d4ed8', 1.2)
  if (guide.kind === 'text') {
    const point = project(guide.point)
    ctx.translate(point.x, point.y)
    ctx.rotate(radians)
    ctx.fillStyle = '#64748b'
    ctx.font = `600 ${Math.max(8, guide.heightMm * scale)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(guide.text ?? guide.id, 0, 0)
  } else if (guide.kind === 'circle') {
    const point = project(guide.point)
    ctx.beginPath()
    ctx.arc(point.x, point.y, Math.max(1, halfWidth * scale), 0, Math.PI * 2)
    ctx.stroke()
  } else if (guide.kind === 'box') {
    const corners = [
      rotatePoint(-halfWidth, -halfHeight),
      rotatePoint(halfWidth, -halfHeight),
      rotatePoint(halfWidth, halfHeight),
      rotatePoint(-halfWidth, halfHeight),
    ].map(project)
    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y)
    ctx.closePath()
    ctx.stroke()
  } else {
    drawLine(ctx, project, rotatePoint(-halfWidth, 0), rotatePoint(halfWidth, 0))
    drawLine(ctx, project, rotatePoint(0, -halfHeight), rotatePoint(0, halfHeight))
  }
  ctx.restore()
}

function drawDimensionLine(ctx: CanvasRenderingContext2D, project: ScreenProjector, scale: number, dim: Extract<CanvasRenderEntity, { kind: 'dimension-line' }>['payload']) {
  if (
    !isFinitePoint(dim.extensionStart) ||
    !isFinitePoint(dim.extensionEnd) ||
    !isFinitePoint(dim.measureStart) ||
    !isFinitePoint(dim.measureEnd)
  ) {
    return
  }
  const extensionStart = project(dim.extensionStart)
  const extensionEnd = project(dim.extensionEnd)
  const measureStart = project(dim.measureStart)
  const measureEnd = project(dim.measureEnd)
  const firstMeasureEnd = dim.firstMeasureEnd ? project(dim.firstMeasureEnd) : null
  const secondMeasureStart = dim.secondMeasureStart ? project(dim.secondMeasureStart) : null
  ctx.save()
  setStroke(ctx, '#d97706', 0.8)
  ctx.beginPath()
  ctx.moveTo(extensionStart.x, extensionStart.y)
  ctx.lineTo(measureStart.x, measureStart.y)
  ctx.moveTo(extensionEnd.x, extensionEnd.y)
  ctx.lineTo(measureEnd.x, measureEnd.y)
  if (firstMeasureEnd && secondMeasureStart) {
    ctx.moveTo(measureStart.x, measureStart.y)
    ctx.lineTo(firstMeasureEnd.x, firstMeasureEnd.y)
    ctx.moveTo(secondMeasureStart.x, secondMeasureStart.y)
    ctx.lineTo(measureEnd.x, measureEnd.y)
  } else {
    ctx.moveTo(measureStart.x, measureStart.y)
    ctx.lineTo(measureEnd.x, measureEnd.y)
  }
  ctx.stroke()
  ctx.fillStyle = '#d97706'
  drawArrowHead(ctx, measureEnd, measureStart, 6, true)
  drawArrowHead(ctx, measureStart, measureEnd, 6, true)
  if (dim.label) {
    const labelPoint = project(dim.label.point)
    ctx.font = `600 ${Math.max(8, dim.label.fontSizeMm * scale)}px sans-serif`
    ctx.textAlign = dim.label.center ? 'center' : 'start'
    ctx.textBaseline = 'middle'
    ctx.save()
    ctx.translate(labelPoint.x, labelPoint.y)
    const rotation = (dim.label.rotationDeg * Math.PI) / 180
    if (rotation) ctx.rotate(rotation)
    ctx.fillText(dim.label.text, 0, 0)
    ctx.restore()
  }
  ctx.restore()
}

export function CanvasEngineV2({ viewport, gridSpacing, darkMode, entities, width, height }: CanvasEngineV2Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssW = width
    const cssH = height
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const { scale, x: offsetX, y: offsetY } = viewport
    const { major, minor } = computeAdaptiveSpacing(scale, gridSpacing)

    const worldLeft = -offsetX / scale
    const worldTop = -offsetY / scale
    const worldRight = (cssW - offsetX) / scale
    const worldBottom = (cssH - offsetY) / scale

    const gridMinor = darkMode ? 'rgba(51, 65, 85, 0.45)' : 'rgba(148, 163, 184, 0.35)'
    const gridMajor = darkMode ? 'rgba(71, 85, 105, 0.85)' : 'rgba(148, 163, 184, 0.75)'
    const axis = darkMode ? 'rgba(100, 116, 139, 1)' : 'rgba(71, 85, 105, 1)'
    // Minor grid
    ctx.beginPath()
    ctx.strokeStyle = gridMinor
    ctx.lineWidth = 0.5
    const minorStartX = Math.floor(worldLeft / minor) * minor
    const minorStartY = Math.floor(worldTop / minor) * minor
    for (let wx = minorStartX; wx <= worldRight; wx += minor) {
      if (Math.abs(wx % major) < minor * 0.1) continue
      const sx = Math.round(wx * scale + offsetX) + 0.5
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, cssH)
    }
    for (let wy = minorStartY; wy <= worldBottom; wy += minor) {
      if (Math.abs(wy % major) < minor * 0.1) continue
      const sy = Math.round(wy * scale + offsetY) + 0.5
      ctx.moveTo(0, sy)
      ctx.lineTo(cssW, sy)
    }
    ctx.stroke()

    // Major grid
    ctx.beginPath()
    ctx.strokeStyle = gridMajor
    ctx.lineWidth = 1
    const majorStartX = Math.floor(worldLeft / major) * major
    const majorStartY = Math.floor(worldTop / major) * major
    for (let wx = majorStartX; wx <= worldRight; wx += major) {
      if (Math.abs(wx) < major * 0.01) continue
      const sx = Math.round(wx * scale + offsetX) + 0.5
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, cssH)
    }
    for (let wy = majorStartY; wy <= worldBottom; wy += major) {
      if (Math.abs(wy) < major * 0.01) continue
      const sy = Math.round(wy * scale + offsetY) + 0.5
      ctx.moveTo(0, sy)
      ctx.lineTo(cssW, sy)
    }
    ctx.stroke()

    // Axis
    ctx.beginPath()
    ctx.strokeStyle = axis
    ctx.lineWidth = 1.5
    const axisX = Math.round(offsetX) + 0.5
    const axisY = Math.round(offsetY) + 0.5
    if (axisX >= 0 && axisX <= cssW) { ctx.moveTo(axisX, 0); ctx.lineTo(axisX, cssH) }
    if (axisY >= 0 && axisY <= cssH) { ctx.moveTo(0, axisY); ctx.lineTo(cssW, axisY) }
    ctx.stroke()

    const project: ScreenProjector = (point) => ({ x: point.x * scale + offsetX, y: point.y * scale + offsetY })
    for (const entity of entities) {
      switch (entity.kind) {
        case 'shape':
          drawShapeEntity(ctx, project, scale, entity)
          break
        case 'fold-line':
          ctx.save()
          setStroke(ctx, entity.paint.strokeColor ?? '#dc2626', 1.8, [7, 5], entity.paint.opacity)
          drawLine(ctx, project, entity.payload.start, entity.payload.end)
          ctx.restore()
          break
        case 'stitch-hole':
          drawStitchHole(ctx, project, scale, entity.payload)
          break
        case 'hardware-marker':
          drawHardwareMarker(ctx, project, scale, entity.payload)
          break
        case 'grainline': {
          const start = project(entity.payload.start)
          const end = project(entity.payload.end)
          ctx.save()
          setStroke(ctx, entity.paint.strokeColor ?? '#0f766e', 1.25, [6, 4], entity.paint.opacity)
          drawLine(ctx, project, entity.payload.start, entity.payload.end)
          drawArrowHead(ctx, start, end, 8)
          ctx.restore()
          break
        }
        case 'notch':
          ctx.save()
          setStroke(ctx, entity.paint.strokeColor ?? (entity.payload.showOnSeam ? '#7c2d12' : '#0f172a'), 1.4, [], entity.paint.opacity)
          drawLine(ctx, project, entity.payload.start, entity.payload.end)
          ctx.restore()
          break
        case 'placement-guide':
          drawPlacementGuide(ctx, project, scale, entity.payload)
          break
        case 'selection-box': {
          const start = project(entity.payload.start)
          const end = project(entity.payload.end)
          const crossing = entity.payload.mode === 'crossing'
          ctx.save()
          ctx.fillStyle = crossing ? 'rgba(16, 185, 129, 0.08)' : 'rgba(14, 165, 233, 0.08)'
          setStroke(ctx, crossing ? '#10b981' : '#0ea5e9', 1.25, crossing ? [4, 4] : [8, 6], entity.paint.opacity)
          ctx.beginPath()
          ctx.rect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y))
          ctx.fill()
          ctx.stroke()
          ctx.restore()
          break
        }
        case 'snap-anchor': {
          const point = project(entity.payload.point)
          ctx.save()
          ctx.fillStyle = 'rgba(16, 185, 129, 0.14)'
          ctx.strokeStyle = '#10b981'
          ctx.lineWidth = 1.25
          ctx.beginPath()
          ctx.arc(point.x, point.y, 5.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(point.x - 3.5, point.y)
          ctx.lineTo(point.x + 3.5, point.y)
          ctx.moveTo(point.x, point.y - 3.5)
          ctx.lineTo(point.x, point.y + 3.5)
          ctx.stroke()
          ctx.restore()
          break
        }
        case 'angle-guide':
          ctx.save()
          setStroke(ctx, 'rgba(14, 165, 233, 0.5)', 1, [10, 8], entity.paint.opacity)
          drawLine(ctx, project, entity.payload.start, entity.payload.end)
          ctx.restore()
          break
        case 'seam-guide':
          if (typeof Path2D !== 'undefined' && entity.payload.d) {
            ctx.save()
            ctx.translate(offsetX, offsetY)
            ctx.scale(scale, scale)
            setStroke(ctx, entity.paint.strokeColor ?? 'rgba(59, 130, 246, 0.9)', Math.max(0.5 / scale, 1.3 / scale), [4 / scale, 4 / scale], entity.paint.opacity)
            try {
              ctx.stroke(new Path2D(entity.payload.d))
            } catch {
              // Invalid SVG path data is ignored; the V2 engine should never break the canvas frame.
            }
            ctx.restore()
          }
          if (entity.paint.labelVisible && isFinitePoint(entity.payload.labelPoint)) {
            const point = project(entity.payload.labelPoint)
            ctx.save()
            ctx.fillStyle = '#64748b'
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)'
            ctx.lineWidth = 2
            ctx.font = '600 11px sans-serif'
            const text = entity.paint.labelText
            ctx.strokeText(text, point.x + 5, point.y + 5)
            ctx.fillText(text, point.x + 5, point.y + 5)
            ctx.restore()
          }
          break
        case 'dimension-line':
          drawDimensionLine(ctx, project, scale, entity.payload)
          break
        case 'dimension-label': {
          const point = project({ x: entity.payload.x, y: entity.payload.y })
          ctx.save()
          ctx.fillStyle = applyAlpha(entity.paint.fillColor ?? '#d97706', entity.paint.opacity)
          ctx.font = `600 ${Math.max(8, entity.payload.fontSizeMm * scale)}px sans-serif`
          ctx.textBaseline = 'middle'
          ctx.fillText(entity.payload.text, point.x, point.y)
          ctx.restore()
          break
        }
        case 'piece-edge-label': {
          const point = project({ x: entity.payload.x, y: entity.payload.y })
          ctx.save()
          ctx.fillStyle = entity.payload.active ? 'rgba(249, 115, 22, 0.92)' : 'rgba(15, 23, 42, 0.8)'
          ctx.strokeStyle = entity.payload.active ? '#fed7aa' : 'rgba(255,255,255,0.24)'
          ctx.lineWidth = 0.7
          ctx.beginPath()
          ctx.arc(point.x, point.y, 5.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#f8fafc'
          ctx.font = '700 5px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(entity.payload.label, point.x, point.y + 0.4)
          ctx.restore()
          break
        }
        case 'constraint-glyph': {
          const point = project(entity.payload.glyphPoint)
          ctx.save()
          ctx.globalAlpha = entity.payload.opacity
          ctx.fillStyle = '#22d3ee'
          ctx.font = `700 ${entity.payload.fontSizePx}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(entity.payload.glyph, point.x, point.y - 4 * scale)
          ctx.restore()
          break
        }
        case 'outline-chain-label': {
          const first = project(entity.payload.first)
          const last = project(entity.payload.last)
          const centroid = project(entity.payload.centroid)
          ctx.save()
          ctx.globalAlpha = entity.paint.opacity
          ctx.strokeStyle = '#f97316'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.arc(first.x, first.y, entity.payload.endpointRadius * scale, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(last.x, last.y, entity.payload.endpointRadius * scale, 0, Math.PI * 2)
          ctx.stroke()
          ctx.fillStyle = '#f97316'
          ctx.font = `600 ${entity.payload.labelSize * scale}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(entity.payload.text, centroid.x, centroid.y - 4)
          ctx.restore()
          break
        }
        case 'annotation-label': {
          if (!entity.payload.text || !isFinitePoint(entity.payload.point)) break
          const point = project(entity.payload.point)
          ctx.save()
          ctx.translate(point.x, point.y)
          if (entity.payload.rotationDeg) ctx.rotate((entity.payload.rotationDeg * Math.PI) / 180)
          ctx.fillStyle = applyAlpha(entity.paint.fillColor ?? '#64748b', entity.paint.opacity)
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)'
          ctx.lineWidth = 2
          ctx.font = `600 ${Math.max(8, (entity.payload.fontSizeMm ?? 3.8) * scale)}px sans-serif`
          ctx.strokeText(entity.payload.text, 0, 0)
          ctx.fillText(entity.payload.text, 0, 0)
          ctx.restore()
          break
        }
        default:
          break
      }
    }
  }, [viewport, gridSpacing, darkMode, entities, width, height])

  return (
    <canvas
      ref={canvasRef}
      className="canvas-engine-v2"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
