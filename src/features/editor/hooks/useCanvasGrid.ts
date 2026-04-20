import { useCallback, useEffect, useRef } from 'react'
import type { Viewport } from '../cad/cad-types'
import { computeAdaptiveSpacing } from '../ops/grid-spacing'
import { formatDisplayDistance, type DisplayUnit } from '../ops/unit-ops'

type UseCanvasGridParams = {
  viewport: Viewport
  gridSpacing: number
  displayUnit: DisplayUnit
  showGrid?: boolean
  gridBackgroundMode?: 'light' | 'dark'
}

const MIN_VISIBLE_MINOR_SPACING_PX = 16
const GRID_MARKER_TARGET_SPACING_PX = 110
const GRID_MARKER_MIN_SPACING_PX = 72
const GRID_MARKER_EDGE_PADDING_PX = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function alignToDevicePixel(value: number, lineWidth: number) {
  return Math.round(value) + (Math.round(lineWidth) % 2 === 1 ? 0.5 : 0)
}

function isNearMultiple(value: number, step: number, tolerance: number) {
  if (step <= 0) return false
  return Math.abs(value / step - Math.round(value / step)) <= tolerance
}

function niceCeil(value: number) {
  const safeValue = Math.max(value, 0.0001)
  const exponent = Math.floor(Math.log10(safeValue))
  const magnitude = 10 ** exponent
  const normalized = safeValue / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

function buildMarkerValues(start: number, end: number, step: number) {
  const first = Math.ceil(start / step) * step
  const values: number[] = []
  for (let value = first; value <= end + step * 0.5 && values.length < 240; value += step) {
    values.push(Math.round(value * 10000) / 10000)
  }
  return values
}

function markerPrecision(step: number, displayUnit: DisplayUnit) {
  if (displayUnit === 'in') return step < 25.4 ? 2 : 1
  if (step < 1) return 2
  if (step < 10) return 1
  return 0
}

export function useCanvasGrid(params: UseCanvasGridParams) {
  const { viewport, gridSpacing, displayUnit, showGrid = true, gridBackgroundMode = 'light' } = params
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    if (width <= 0 || height <= 0) return

    // Resize canvas buffer to match display size * dpr
    const bufferWidth = Math.round(width * dpr)
    const bufferHeight = Math.round(height * dpr)
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth
      canvas.height = bufferHeight
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

    const isDark = gridBackgroundMode === 'dark'
    const backgroundColor = isDark ? '#0f172a' : '#f8fbff'
    const minorColor = isDark ? 'rgba(71, 85, 105, 0.38)' : 'rgba(185, 201, 222, 0.42)'
    const majorColor = isDark ? 'rgba(100, 116, 139, 0.68)' : 'rgba(142, 165, 197, 0.58)'
    const axisColor = isDark ? 'rgba(148, 163, 184, 0.86)' : 'rgba(130, 157, 194, 0.78)'
    const markerColor = isDark ? 'rgba(203, 213, 225, 0.72)' : 'rgba(71, 85, 105, 0.66)'
    const markerTickColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.28)'
    const markerHaloColor = isDark ? 'rgba(15, 23, 42, 0.86)' : 'rgba(248, 251, 255, 0.9)'
    const minorScreenStep = minor * scale
    const minorLineWidth = 1
    const majorLineWidth = 1
    const axisLineWidth = 1

    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // Align to grid steps
    const minorStartX = Math.floor(worldLeft / minor) * minor
    const minorStartY = Math.floor(worldTop / minor) * minor
    const majorStartX = Math.floor(worldLeft / major) * major
    const majorStartY = Math.floor(worldTop / major) * major

    // --- Draw minor grid lines ---
    if (showGrid && minorScreenStep >= MIN_VISIBLE_MINOR_SPACING_PX) {
      ctx.beginPath()
      ctx.strokeStyle = minorColor
      ctx.lineWidth = minorLineWidth

      for (let wx = minorStartX; wx <= worldRight; wx += minor) {
        // Skip if this falls on a major line.
        if (isNearMultiple(wx, major, 0.0001)) continue
        const sx = alignToDevicePixel(wx * scale + offsetX, minorLineWidth)
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, height)
      }
      for (let wy = minorStartY; wy <= worldBottom; wy += minor) {
        if (isNearMultiple(wy, major, 0.0001)) continue
        const sy = alignToDevicePixel(wy * scale + offsetY, minorLineWidth)
        ctx.moveTo(0, sy)
        ctx.lineTo(width, sy)
      }
      ctx.stroke()
    }

    // --- Draw major grid lines ---
    if (showGrid) {
      ctx.beginPath()
      ctx.strokeStyle = majorColor
      ctx.lineWidth = majorLineWidth

      for (let wx = majorStartX; wx <= worldRight; wx += major) {
        if (Math.abs(wx) < major * 0.01) continue // skip axis
        const sx = alignToDevicePixel(wx * scale + offsetX, majorLineWidth)
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, height)
      }
      for (let wy = majorStartY; wy <= worldBottom; wy += major) {
        if (Math.abs(wy) < major * 0.01) continue // skip axis
        const sy = alignToDevicePixel(wy * scale + offsetY, majorLineWidth)
        ctx.moveTo(0, sy)
        ctx.lineTo(width, sy)
      }
      ctx.stroke()
    }

    // --- Draw axis lines ---
    ctx.beginPath()
    ctx.strokeStyle = axisColor
    ctx.lineWidth = axisLineWidth

    // Y axis (x=0)
    const axisScreenX = alignToDevicePixel(offsetX, axisLineWidth)
    if (axisScreenX >= 0 && axisScreenX <= width) {
      ctx.moveTo(axisScreenX, 0)
      ctx.lineTo(axisScreenX, height)
    }
    // X axis (y=0)
    const axisScreenY = alignToDevicePixel(offsetY, axisLineWidth)
    if (axisScreenY >= 0 && axisScreenY <= height) {
      ctx.moveTo(0, axisScreenY)
      ctx.lineTo(width, axisScreenY)
    }
    ctx.stroke()

    if (showGrid) {
      const markerStep = Math.max(major, niceCeil(GRID_MARKER_TARGET_SPACING_PX / scale))
      const markerScreenStep = markerStep * scale

      if (markerScreenStep >= GRID_MARKER_MIN_SPACING_PX) {
        const fontSizePx = clamp(11 + Math.log2(Math.max(scale, 1)) * 0.45, 11, 14)
        const markerPrecisionValue = markerPrecision(markerStep, displayUnit)
        const xMarkers = buildMarkerValues(worldLeft, worldRight, markerStep)
        const yMarkers = buildMarkerValues(worldTop, worldBottom, markerStep)

        ctx.save()
        ctx.font = `600 ${fontSizePx}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.lineWidth = 3
        ctx.strokeStyle = markerHaloColor
        ctx.fillStyle = markerColor
        ctx.textBaseline = 'middle'

        ctx.beginPath()
        ctx.strokeStyle = markerTickColor
        ctx.lineWidth = 1
        for (const wx of xMarkers) {
          const sx = alignToDevicePixel(wx * scale + offsetX, 1)
          if (sx < 0 || sx > width) continue
          ctx.moveTo(sx, 0)
          ctx.lineTo(sx, 7)
        }
        for (const wy of yMarkers) {
          const sy = alignToDevicePixel(wy * scale + offsetY, 1)
          if (sy < 0 || sy > height) continue
          ctx.moveTo(0, sy)
          ctx.lineTo(7, sy)
        }
        ctx.stroke()

        ctx.strokeStyle = markerHaloColor
        ctx.lineWidth = 3
        ctx.textAlign = 'center'
        for (const wx of xMarkers) {
          const sx = wx * scale + offsetX
          if (sx < 18 || sx > width - 18) continue
          const label = formatDisplayDistance(wx, displayUnit, markerPrecisionValue)
          const sy = GRID_MARKER_EDGE_PADDING_PX + fontSizePx / 2
          ctx.strokeText(label, sx, sy)
          ctx.fillText(label, sx, sy)
        }

        ctx.textAlign = 'left'
        for (const wy of yMarkers) {
          const sy = wy * scale + offsetY
          if (sy < fontSizePx + 10 || sy > height - 12) continue
          const label = formatDisplayDistance(-wy, displayUnit, markerPrecisionValue)
          const sx = GRID_MARKER_EDGE_PADDING_PX
          ctx.strokeText(label, sx, sy)
          ctx.fillText(label, sx, sy)
        }
        ctx.restore()
      }
    }
  }, [viewport, gridSpacing, displayUnit, showGrid, gridBackgroundMode])

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
