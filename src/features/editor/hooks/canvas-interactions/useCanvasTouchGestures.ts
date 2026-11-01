import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { Viewport } from '../../cad/cad-types'

/** Window event the keyboard-shortcut hook turns into undo/redo. */
export const CANVAS_HISTORY_EVENT = 'leathercad:history'

const MIN_SCALE = 0.02
const MAX_SCALE = 400
const TAP_MAX_MS = 280
const TAP_MAX_TRAVEL_PX = 18
const DOUBLE_TAP_MS = 380

type TouchPoint = { x: number; y: number }

export type PinchStart = {
  distance: number
  mid: TouchPoint
  viewport: Viewport
}

/**
 * Viewport after a two-finger pinch: the world point under the starting
 * midpoint stays under the current midpoint while the scale follows the change
 * in finger distance.
 */
export function pinchViewport(start: PinchStart, distance: number, mid: TouchPoint): Viewport {
  const ratio = start.distance > 0 ? distance / start.distance : 1
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, start.viewport.scale * ratio))
  const worldX = (start.mid.x - start.viewport.x) / start.viewport.scale
  const worldY = (start.mid.y - start.viewport.y) / start.viewport.scale
  return { ...start.viewport, scale, x: mid.x - worldX * scale, y: mid.y - worldY * scale }
}

function centroid(touches: TouchList, rect: DOMRect): TouchPoint {
  let x = 0
  let y = 0
  for (let index = 0; index < touches.length; index += 1) {
    x += touches[index].clientX - rect.left
    y += touches[index].clientY - rect.top
  }
  return { x: x / touches.length, y: y / touches.length }
}

function spread(touches: TouchList) {
  if (touches.length < 2) return 0
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
}

type UseCanvasTouchGesturesParams = {
  svgRef: RefObject<SVGSVGElement | null>
  viewport: Viewport
  setViewport: Dispatch<SetStateAction<Viewport>>
  /** Called once when a multi-finger gesture begins, to cancel single-finger work. */
  onGestureStart: () => void
}

/**
 * Multi-touch on the 2D canvas: two-finger pinch zoom and pan, two-finger
 * double tap = undo, three-finger double tap = redo (as in the reference
 * editor). Single-finger input keeps using pointer events.
 */
export function useCanvasTouchGestures({ svgRef, viewport, setViewport, onGestureStart }: UseCanvasTouchGesturesParams) {
  const gestureActiveRef = useRef(false)
  const onGestureStartRef = useRef(onGestureStart)
  const viewportRef = useRef(viewport)
  useEffect(() => {
    onGestureStartRef.current = onGestureStart
    viewportRef.current = viewport
  }, [onGestureStart, viewport])

  useEffect(() => {
    // Listen on the document and resolve the canvas per event: the phone and
    // desktop shells mount different canvas elements after the first render.
    const canvasFor = (event: TouchEvent) => {
      const svg = svgRef.current
      return svg && event.target instanceof Node && svg.contains(event.target) ? svg : null
    }
    let activeSvg: SVGSVGElement | null = null
    let pinch: PinchStart | null = null
    let tap: { fingers: number; startedAt: number; origin: TouchPoint; travel: number } | null = null
    let lastTap: { fingers: number; at: number } | null = null

    let liveViewport: Viewport | null = null
    const startPinch = (event: TouchEvent) => {
      if (!activeSvg) return
      const rect = activeSvg.getBoundingClientRect()
      pinch = { distance: spread(event.touches), mid: centroid(event.touches, rect), viewport: liveViewport ?? viewportRef.current }
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return
      const svg = gestureActiveRef.current ? activeSvg : canvasFor(event)
      if (!svg) return
      activeSvg = svg
      event.preventDefault()
      if (!gestureActiveRef.current) {
        gestureActiveRef.current = true
        onGestureStartRef.current()
        tap = { fingers: event.touches.length, startedAt: performance.now(), origin: centroid(event.touches, svg.getBoundingClientRect()), travel: 0 }
      } else if (tap) {
        tap.fingers = Math.max(tap.fingers, event.touches.length)
      }
      startPinch(event)
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!gestureActiveRef.current || event.touches.length < 2 || !activeSvg) return
      event.preventDefault()
      const rect = activeSvg.getBoundingClientRect()
      const mid = centroid(event.touches, rect)
      if (tap) tap.travel = Math.max(tap.travel, Math.hypot(mid.x - tap.origin.x, mid.y - tap.origin.y))
      const start = pinch
      if (!start) return
      const distance = spread(event.touches)
      if (tap) tap.travel = Math.max(tap.travel, Math.abs(distance - start.distance))
      liveViewport = pinchViewport(start, distance, mid)
      setViewport(liveViewport)
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (!gestureActiveRef.current) return
      event.preventDefault()
      if (event.touches.length >= 2) {
        // A finger lifted but two remain: re-anchor so the view does not jump.
        startPinch(event)
        return
      }
      pinch = null
      if (event.touches.length > 0) return
      gestureActiveRef.current = false
      liveViewport = null
      activeSvg = null
      const finished = tap
      tap = null
      if (!finished) return
      const now = performance.now()
      const isTap = now - finished.startedAt <= TAP_MAX_MS && finished.travel <= TAP_MAX_TRAVEL_PX
      if (!isTap) {
        lastTap = null
        return
      }
      if (lastTap && lastTap.fingers === finished.fingers && now - lastTap.at <= DOUBLE_TAP_MS) {
        lastTap = null
        const action = finished.fingers >= 3 ? 'redo' : 'undo'
        window.dispatchEvent(new CustomEvent(CANVAS_HISTORY_EVENT, { detail: action }))
        return
      }
      lastTap = { fingers: finished.fingers, at: now }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true })
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false, capture: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart, { capture: true })
      document.removeEventListener('touchmove', handleTouchMove, { capture: true })
      document.removeEventListener('touchend', handleTouchEnd, { capture: true })
      document.removeEventListener('touchcancel', handleTouchEnd, { capture: true })
    }
  }, [setViewport, svgRef])

  return { gestureActiveRef }
}
