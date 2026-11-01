import { useCallback, useEffect, useRef } from 'react'
import type { Viewport } from '../cad/cad-types'
import { classifyTick, referenceTickLadder, SURFACE_PALETTES, tickIndexRange, type TickKind } from '../ops/reference-grid'
import type { DisplayUnit } from '../ops/unit-ops'

type UseCanvasGridParams = {
  viewport: Viewport
  /** Retained for callers; the drafting grid density follows zoom, as in the reference editor. */
  gridSpacing: number
  displayUnit: DisplayUnit
  showGrid?: boolean
  gridBackgroundMode?: 'light' | 'dark'
}

const DASH_BY_KIND: Record<TickKind, number[]> = { minor: [3, 3], small: [], major: [], axis: [] }
const DRAW_ORDER: TickKind[] = ['minor', 'small', 'major', 'axis']

/**
 * Paints the drafting surface behind the SVG scene: solid background, dashed
 * minor lines, a solid line every 5 (or 4) ticks, a stronger line every 10 (or 8)
 * and the axes. Distances are read from the edge rulers, not from labels inside
 * the drawing area.
 */
export function useCanvasGrid(params: UseCanvasGridParams) {
  const { viewport, displayUnit, showGrid = true, gridBackgroundMode = 'dark' } = params
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

    const bufferWidth = Math.round(width * dpr)
    const bufferHeight = Math.round(height * dpr)
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth
      canvas.height = bufferHeight
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const palette = SURFACE_PALETTES[gridBackgroundMode]
    ctx.fillStyle = palette.background
    ctx.fillRect(0, 0, width, height)
    if (!showGrid) return

    const { scale, x: offsetX, y: offsetY } = viewport
    const ladder = referenceTickLadder(scale, displayUnit)
    const lines: Record<TickKind, Array<{ position: number; vertical: boolean }>> = { minor: [], small: [], major: [], axis: [] }
    const xRange = tickIndexRange(-offsetX / scale, (width - offsetX) / scale, ladder)
    for (let index = xRange.first; index <= xRange.last; index += 1) {
      lines[classifyTick(index, ladder)].push({ position: Math.round(index * ladder.tickMm * scale + offsetX) + 0.5, vertical: true })
    }
    const yRange = tickIndexRange(-offsetY / scale, (height - offsetY) / scale, ladder)
    for (let index = yRange.first; index <= yRange.last; index += 1) {
      lines[classifyTick(index, ladder)].push({ position: Math.round(index * ladder.tickMm * scale + offsetY) + 0.5, vertical: false })
    }

    ctx.save()
    ctx.lineWidth = 1
    for (const kind of DRAW_ORDER) {
      const entries = lines[kind]
      if (entries.length === 0) continue
      ctx.strokeStyle = palette[kind]
      ctx.setLineDash(DASH_BY_KIND[kind])
      ctx.beginPath()
      for (const entry of entries) {
        if (entry.vertical) {
          ctx.moveTo(entry.position, 0)
          ctx.lineTo(entry.position, height)
        } else {
          ctx.moveTo(0, entry.position)
          ctx.lineTo(width, entry.position)
        }
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.restore()
  }, [viewport, displayUnit, showGrid, gridBackgroundMode])

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(drawGrid)
    return () => cancelAnimationFrame(rafRef.current)
  }, [drawGrid])

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
