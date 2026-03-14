import { useCallback, useEffect, useRef } from 'react'
import type { Viewport } from '../cad/cad-types'

/**
 * Compute the "nice" grid spacing for the current zoom level.
 * Uses a 1-2-5 sequence (like engineering graph paper) so that as you zoom in,
 * the grid smoothly subdivides into finer increments.
 */
function computeAdaptiveSpacing(scale: number, baseSpacing: number): { major: number; minor: number } {
  // Target: major grid lines should be ~60-150 screen-pixels apart
  const targetScreenPx = 80
  const idealWorldSpacing = targetScreenPx / scale

  // 1-2-5 sequence steps
  const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]

  // Find the step closest to idealWorldSpacing
  let major = baseSpacing
  let bestDiff = Infinity
  for (const step of steps) {
    const diff = Math.abs(step - idealWorldSpacing)
    if (diff < bestDiff) {
      bestDiff = diff
      major = step
    }
  }

  // Minor subdivisions: 5 per major (or 2 for very small spacings)
  const subdivisions = major <= 2 ? 2 : 5
  const minor = major / subdivisions

  return { major, minor }
}

type UseCanvasGridParams = {
  viewport: Viewport
  gridSpacing: number
  darkMode: boolean
}

export function useCanvasGrid(params: UseCanvasGridParams) {
  const { viewport, gridSpacing, darkMode } = params
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Resize canvas buffer to match display size * dpr
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const { scale, x: offsetX, y: offsetY } = viewport
    const { major, minor } = computeAdaptiveSpacing(scale, gridSpacing)

    // Visible world-coordinate bounds
    const worldLeft = -offsetX / scale
    const worldTop = -offsetY / scale
    const worldRight = (width - offsetX) / scale
    const worldBottom = (height - offsetY) / scale

    // Colors from theme
    const gridColor = darkMode ? 'rgba(51, 65, 85, 0.55)' : 'rgba(148, 163, 184, 0.45)'
    const gridColorMajor = darkMode ? 'rgba(51, 65, 85, 1)' : 'rgba(148, 163, 184, 0.8)'
    const axisColor = darkMode ? 'rgba(71, 85, 105, 1)' : 'rgba(167, 186, 214, 1)'

    // Align to grid steps
    const minorStartX = Math.floor(worldLeft / minor) * minor
    const minorStartY = Math.floor(worldTop / minor) * minor
    const majorStartX = Math.floor(worldLeft / major) * major
    const majorStartY = Math.floor(worldTop / major) * major

    // --- Draw minor grid lines ---
    ctx.beginPath()
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 0.5

    for (let wx = minorStartX; wx <= worldRight; wx += minor) {
      // Skip if this falls on a major line
      if (Math.abs(wx % major) < minor * 0.1 || Math.abs(wx % major - major) < minor * 0.1) continue
      const sx = Math.round(wx * scale + offsetX) + 0.5
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, height)
    }
    for (let wy = minorStartY; wy <= worldBottom; wy += minor) {
      if (Math.abs(wy % major) < minor * 0.1 || Math.abs(wy % major - major) < minor * 0.1) continue
      const sy = Math.round(wy * scale + offsetY) + 0.5
      ctx.moveTo(0, sy)
      ctx.lineTo(width, sy)
    }
    ctx.stroke()

    // --- Draw major grid lines ---
    ctx.beginPath()
    ctx.strokeStyle = gridColorMajor
    ctx.lineWidth = 1

    for (let wx = majorStartX; wx <= worldRight; wx += major) {
      if (Math.abs(wx) < major * 0.01) continue // skip axis
      const sx = Math.round(wx * scale + offsetX) + 0.5
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, height)
    }
    for (let wy = majorStartY; wy <= worldBottom; wy += major) {
      if (Math.abs(wy) < major * 0.01) continue // skip axis
      const sy = Math.round(wy * scale + offsetY) + 0.5
      ctx.moveTo(0, sy)
      ctx.lineTo(width, sy)
    }
    ctx.stroke()

    // --- Draw axis lines ---
    ctx.beginPath()
    ctx.strokeStyle = axisColor
    ctx.lineWidth = 1.5

    // Y axis (x=0)
    const axisScreenX = Math.round(offsetX) + 0.5
    if (axisScreenX >= 0 && axisScreenX <= width) {
      ctx.moveTo(axisScreenX, 0)
      ctx.lineTo(axisScreenX, height)
    }
    // X axis (y=0)
    const axisScreenY = Math.round(offsetY) + 0.5
    if (axisScreenY >= 0 && axisScreenY <= height) {
      ctx.moveTo(0, axisScreenY)
      ctx.lineTo(width, axisScreenY)
    }
    ctx.stroke()
  }, [viewport, gridSpacing, darkMode])

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(drawGrid)
    return () => cancelAnimationFrame(rafRef.current)
  }, [drawGrid])

  // Re-draw on resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(drawGrid)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [drawGrid])

  return { canvasRef }
}
