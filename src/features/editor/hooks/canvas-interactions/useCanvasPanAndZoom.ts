import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { clamp } from '../../cad/cad-geometry'
import type { Viewport } from '../../cad/cad-types'
import { MAX_ZOOM, MIN_ZOOM } from '../../editor-constants'
import type { PanState } from './canvas-interaction-types'

type UseCanvasPanAndZoomParams = {
  svgRef: RefObject<SVGSVGElement | null>
  panRef: RefObject<PanState | null>
  viewport: Viewport
  setViewport: Dispatch<SetStateAction<Viewport>>
  reverseZoomDirection?: boolean
  onWheelRotateSelection?: (deltaDeg: number) => void
  onWheelScaleSelection?: (factor: number) => void
}

export function useCanvasPanAndZoom({
  svgRef,
  panRef,
  viewport,
  setViewport,
  reverseZoomDirection = false,
  onWheelRotateSelection,
  onWheelScaleSelection,
}: UseCanvasPanAndZoomParams) {
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const preventGestureDefault = (event: Event) => {
      event.preventDefault()
    }
    const preventMultiTouchDefault = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault()
      }
    }

    svg.addEventListener('gesturestart', preventGestureDefault, { passive: false })
    svg.addEventListener('gesturechange', preventGestureDefault, { passive: false })
    svg.addEventListener('gestureend', preventGestureDefault, { passive: false })
    svg.addEventListener('touchstart', preventMultiTouchDefault, { passive: false })
    svg.addEventListener('touchmove', preventMultiTouchDefault, { passive: false })

    return () => {
      svg.removeEventListener('gesturestart', preventGestureDefault)
      svg.removeEventListener('gesturechange', preventGestureDefault)
      svg.removeEventListener('gestureend', preventGestureDefault)
      svg.removeEventListener('touchstart', preventMultiTouchDefault)
      svg.removeEventListener('touchmove', preventMultiTouchDefault)
    }
  }, [svgRef])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()

      // Mouse-wheel modifiers (mirror source-app):
      // - Alt+Shift wheel  → scale selection (1% per tick)
      // - Alt wheel        → rotate selection (1° per tick)
      // The plain/Ctrl wheel stays as zoom so pinch-zoom still works on trackpads.
      if (event.altKey && event.shiftKey && onWheelScaleSelection) {
        const factor = event.deltaY < 0 ? 1.01 : 0.99
        onWheelScaleSelection(factor)
        return
      }
      if (event.altKey && onWheelRotateSelection) {
        const deltaDeg = event.deltaY < 0 ? 1 : -1
        onWheelRotateSelection(deltaDeg)
        return
      }

      const rect = svg.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      const naturalZoomIn = event.deltaY < 0
      const zoomIn = reverseZoomDirection ? !naturalZoomIn : naturalZoomIn
      const zoomFactor = zoomIn ? 1.1 : 0.9

      setViewport((previous) => {
        const nextScale = clamp(previous.scale * zoomFactor, MIN_ZOOM, MAX_ZOOM)
        const worldX = (screenX - previous.x) / previous.scale
        const worldY = (screenY - previous.y) / previous.scale
        return {
          x: screenX - worldX * nextScale,
          y: screenY - worldY * nextScale,
          scale: nextScale,
        }
      })
    }

    svg.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      svg.removeEventListener('wheel', handleWheel)
    }
  }, [setViewport, svgRef, reverseZoomDirection, onWheelRotateSelection, onWheelScaleSelection])

  const beginPan = (clientX: number, clientY: number, pointerId: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: viewport.x,
      originY: viewport.y,
      pointerId,
    }
  }

  const handlePanPointerMove = (clientX: number, clientY: number, pointerId: number, pointerType: string) => {
    const panState = panRef.current
    if (!panState) {
      return false
    }
    if (pointerType === 'touch' && pointerId !== panState.pointerId) {
      return true
    }

    const deltaX = clientX - panState.startX
    const deltaY = clientY - panState.startY
    setViewport((previous) => ({
      ...previous,
      x: panState.originX + deltaX,
      y: panState.originY + deltaY,
    }))
    return true
  }

  const handlePanPointerUp = (pointerId: number, pointerType: string) => {
    const panState = panRef.current
    if (!panState) {
      return false
    }
    if (pointerType === 'touch' && pointerId !== panState.pointerId) {
      return true
    }
    panRef.current = null
    return true
  }

  return {
    beginPan,
    handlePanPointerMove,
    handlePanPointerUp,
  }
}
