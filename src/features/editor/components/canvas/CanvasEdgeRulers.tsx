import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point, Viewport } from '../../cad/cad-types'
import { useTranslate } from '../../hooks/useTranslate'
import {
  classifyTick,
  EDGE_RULER_SIZE_PX,
  formatRulerLabel,
  referenceTickLadder,
  SURFACE_PALETTES,
  tickIndexRange,
  type TickKind,
} from '../../ops/reference-grid'
import type { DisplayUnit } from '../../ops/unit-ops'
import type { Bounds } from './canvas-geometry'

type CanvasEdgeRulersProps = {
  viewport: Viewport
  displayUnit: DisplayUnit
  mode: 'light' | 'dark'
  cursorPoint: Point | null
  selectionBounds: Bounds | null
  invertYAxis: boolean
}

const TICK_LENGTH: Record<Exclude<TickKind, 'axis'>, number> = { minor: 4, small: 6.5, major: 9 }

function prepare(canvas: HTMLCanvasElement | null) {
  if (!canvas) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const dpr = window.devicePixelRatio || 1
  const bufferWidth = Math.max(1, Math.round(rect.width * dpr))
  const bufferHeight = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth
    canvas.height = bufferHeight
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, width: rect.width, height: rect.height }
}

/**
 * Edge rulers in the style of the Leathercraft CAD web editor: tick ladder that
 * follows zoom, labels on major ticks, an orange cursor marker, a cyan band for
 * the selection's extent, and a corner that switches the origin to the
 * selection's corner for relative measuring.
 */
export function CanvasEdgeRulers({ viewport, displayUnit, mode, cursorPoint, selectionBounds, invertYAxis }: CanvasEdgeRulersProps) {
  const t = useTranslate()
  const xRef = useRef<HTMLCanvasElement>(null)
  const yRef = useRef<HTMLCanvasElement>(null)
  const cornerRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const [relativeOrigin, setRelativeOrigin] = useState(false)

  const draw = useCallback(() => {
    const palette = SURFACE_PALETTES[mode]
    const ladder = referenceTickLadder(viewport.scale, displayUnit)
    const origin = relativeOrigin && selectionBounds
      ? { x: selectionBounds.minX, y: invertYAxis ? selectionBounds.maxY : selectionBounds.minY }
      : { x: 0, y: 0 }
    const ySign = invertYAxis ? -1 : 1
    const size = EDGE_RULER_SIZE_PX

    const corner = prepare(cornerRef.current)
    if (corner) {
      const { ctx, width, height } = corner
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = palette.rulerBackground
      ctx.fillRect(0, 0, width, height)
      ctx.beginPath()
      ctx.arc(width / 2, 7, 3, 0, Math.PI * 2)
      if (relativeOrigin) {
        ctx.fillStyle = palette.rulerOriginOn
        ctx.fill()
      } else {
        ctx.strokeStyle = palette.rulerOriginOff
        ctx.lineWidth = 1.2
        ctx.stroke()
      }
      ctx.font = '9px system-ui, sans-serif'
      ctx.fillStyle = palette.rulerText
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(displayUnit === 'in' ? 'in' : 'mm', width / 2, 12)
    }

    const drawAxis = (canvas: HTMLCanvasElement | null, horizontal: boolean) => {
      const target = prepare(canvas)
      if (!target) return
      const { ctx, width, height } = target
      const length = horizontal ? width : height
      const depth = horizontal ? height : width
      const pan = horizontal ? viewport.x : viewport.y
      const originValue = horizontal ? origin.x : origin.y
      const toScreen = (world: number) => world * viewport.scale + pan - size
      const toWorld = (screen: number) => (screen + size - pan) / viewport.scale

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = palette.rulerBackground
      ctx.fillRect(0, 0, width, height)

      if (selectionBounds) {
        const a = toScreen(horizontal ? selectionBounds.minX : selectionBounds.minY)
        const b = toScreen(horizontal ? selectionBounds.maxX : selectionBounds.maxY)
        ctx.fillStyle = palette.rulerSelectionFill
        if (horizontal) ctx.fillRect(Math.min(a, b), 0, Math.abs(b - a), depth)
        else ctx.fillRect(0, Math.min(a, b), depth, Math.abs(b - a))
        ctx.strokeStyle = palette.rulerSelectionEdge
        ctx.lineWidth = 1
        ctx.beginPath()
        for (const edge of [a, b]) {
          if (horizontal) {
            ctx.moveTo(edge + 0.5, 0)
            ctx.lineTo(edge + 0.5, depth)
          } else {
            ctx.moveTo(0, edge + 0.5)
            ctx.lineTo(depth, edge + 0.5)
          }
        }
        ctx.stroke()
      }

      // Ticks are placed relative to the active origin so labels read from it.
      const range = tickIndexRange(toWorld(0) - originValue, toWorld(length) - originValue, ladder)
      const buckets: Record<Exclude<TickKind, 'axis'>, number[]> = { minor: [], small: [], major: [] }
      ctx.font = '10px system-ui, sans-serif'
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      ctx.fillStyle = palette.rulerText
      for (let index = range.first; index <= range.last; index += 1) {
        const offset = index * ladder.tickMm
        const screen = Math.round(toScreen(offset + originValue)) + 0.5
        if (screen < -1 || screen > length + 1) continue
        const kind = classifyTick(index, ladder)
        const bucket = kind === 'axis' ? 'major' : kind
        buckets[bucket].push(screen)
        if (bucket !== 'major') continue
        const label = formatRulerLabel(horizontal ? offset : offset * ySign, displayUnit)
        const labelWidth = ctx.measureText(label).width
        if (horizontal) {
          ctx.fillText(label, screen - labelWidth / 2, 2)
        } else {
          ctx.save()
          ctx.translate(2, screen + labelWidth / 2)
          ctx.rotate(-Math.PI / 2)
          ctx.fillText(label, 0, 0)
          ctx.restore()
        }
      }
      const tickColor: Record<Exclude<TickKind, 'axis'>, string> = {
        minor: palette.rulerTickMinor,
        small: palette.rulerTickSmall,
        major: palette.rulerTickMajor,
      }
      ctx.lineWidth = 1
      for (const kind of ['minor', 'small', 'major'] as const) {
        if (buckets[kind].length === 0) continue
        ctx.strokeStyle = tickColor[kind]
        ctx.beginPath()
        for (const screen of buckets[kind]) {
          if (horizontal) {
            ctx.moveTo(screen, depth - TICK_LENGTH[kind])
            ctx.lineTo(screen, depth)
          } else {
            ctx.moveTo(depth - TICK_LENGTH[kind], screen)
            ctx.lineTo(depth, screen)
          }
        }
        ctx.stroke()
      }

      if (cursorPoint) {
        const screen = toScreen(horizontal ? cursorPoint.x : cursorPoint.y)
        if (screen >= -1 && screen <= length + 1) {
          ctx.strokeStyle = palette.rulerCursor
          ctx.lineWidth = 1.5
          ctx.beginPath()
          if (horizontal) {
            ctx.moveTo(screen + 0.5, 0)
            ctx.lineTo(screen + 0.5, depth)
          } else {
            ctx.moveTo(0, screen + 0.5)
            ctx.lineTo(depth, screen + 0.5)
          }
          ctx.stroke()
        }
      }
    }

    drawAxis(xRef.current, true)
    drawAxis(yRef.current, false)
  }, [cursorPoint, displayUnit, invertYAxis, mode, relativeOrigin, selectionBounds, viewport.scale, viewport.x, viewport.y])

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw])

  useEffect(() => {
    const targets = [xRef.current, yRef.current].filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas))
    if (targets.length === 0 || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    })
    for (const canvas of targets) observer.observe(canvas)
    return () => observer.disconnect()
  }, [draw])

  const cornerLabel = relativeOrigin
    ? t('Rulers measure from the selection corner. Click to measure from the origin.')
    : t('Click to measure the rulers from the selection corner (relative origin).')

  return (
    <div className={`canvas-edge-rulers canvas-edge-rulers-${mode}`} data-testid="canvas-edge-rulers">
      <canvas ref={xRef} className="canvas-edge-ruler canvas-edge-ruler-x" aria-hidden="true" />
      <canvas ref={yRef} className="canvas-edge-ruler canvas-edge-ruler-y" aria-hidden="true" />
      <button
        type="button"
        className="canvas-edge-ruler-corner"
        aria-pressed={relativeOrigin}
        aria-label={cornerLabel}
        title={cornerLabel}
        onClick={() => setRelativeOrigin(value => !value)}
      >
        <canvas ref={cornerRef} aria-hidden="true" />
      </button>
    </div>
  )
}
