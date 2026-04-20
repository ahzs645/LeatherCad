import { useEffect, useRef } from 'react'
import type { Shape, Viewport } from '../cad/cad-types'
import { computeAdaptiveSpacing } from '../ops/grid-spacing'

/**
 * Parallel canvas-based rendering engine. Opt-in via `?engine=v2` URL param or
 * `localStorage.leathercad_engine_v2 = '1'`. Coexists with the SVG renderer so
 * we can iterate on performance/fidelity without disturbing the shipping code.
 *
 * Currently renders: adaptive grid + axis + shape outlines. More fidelity
 * (stitch holes, dimensions, pieces) to be added incrementally.
 */

type CanvasEngineV2Props = {
  viewport: Viewport
  gridSpacing: number
  darkMode: boolean
  shapes: Shape[]
  width: number
  height: number
}

export function isEngineV2Enabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('engine') === 'v2') return true
    return window.localStorage?.getItem('leathercad_engine_v2') === '1'
  } catch {
    return false
  }
}

export function CanvasEngineV2({ viewport, gridSpacing, darkMode, shapes, width, height }: CanvasEngineV2Props) {
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
    const stroke = darkMode ? 'rgba(56, 189, 248, 0.95)' : 'rgba(14, 116, 144, 0.95)'

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

    // Shape outlines (line / bezier only for now)
    const toScreen = (wx: number, wy: number): [number, number] => [wx * scale + offsetX, wy * scale + offsetY]
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.25
    ctx.beginPath()
    for (const shape of shapes) {
      if (shape.type === 'line') {
        const [x1, y1] = toScreen(shape.start.x, shape.start.y)
        const [x2, y2] = toScreen(shape.end.x, shape.end.y)
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
      } else if (shape.type === 'arc') {
        const [x1, y1] = toScreen(shape.start.x, shape.start.y)
        const [xm, ym] = toScreen(shape.mid.x, shape.mid.y)
        const [x2, y2] = toScreen(shape.end.x, shape.end.y)
        ctx.moveTo(x1, y1)
        ctx.quadraticCurveTo(xm, ym, x2, y2)
      } else if (shape.type === 'bezier') {
        const [x1, y1] = toScreen(shape.start.x, shape.start.y)
        const [xc, yc] = toScreen(shape.control.x, shape.control.y)
        const [x2, y2] = toScreen(shape.end.x, shape.end.y)
        ctx.moveTo(x1, y1)
        ctx.quadraticCurveTo(xc, yc, x2, y2)
      }
    }
    ctx.stroke()
  }, [viewport, gridSpacing, darkMode, shapes, width, height])

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
