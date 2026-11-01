import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Viewport } from '../../cad/cad-types'
import { useInterfacePreferences } from '../../ops/interface-preferences'
import { navigateWithWheel } from '../../ops/wheel-navigation'
import type { PanState } from './canvas-interaction-types'

type UseCanvasPanAndZoomParams = {
  svgRef: RefObject<SVGSVGElement | null>
  panRef: RefObject<PanState | null>
  viewport: Viewport
  setViewport: Dispatch<SetStateAction<Viewport>>
  reverseZoomDirection?: boolean
  onWheelRotateSelection?: (deltaDeg: number) => void
  onWheelScaleSelection?: (factor: number) => void
  onWheelAdjustThickness?: (deltaSteps: number) => void
}

export function useCanvasPanAndZoom({
  svgRef,
  panRef,
  viewport,
  setViewport,
  reverseZoomDirection = false,
  onWheelRotateSelection,
  onWheelScaleSelection,
  onWheelAdjustThickness,
}: UseCanvasPanAndZoomParams) {
  const { wheelMode, trackpadSensitivity } = useInterfacePreferences()
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
      if (event.deltaX === 0 && event.deltaY === 0) return

      // Mouse-wheel modifiers (mirror source-app):
      // - Alt+Shift wheel  → scale selection (1% per tick)
      // - Alt wheel        → adjust line thickness on selection
      // - Shift wheel      → rotate selection (1° per tick)
      // Pinch/Ctrl/Command always navigates, including in Pan mode.
      if (!event.ctrlKey && !event.metaKey && event.altKey && event.shiftKey && onWheelScaleSelection) {
        const factor = event.deltaY < 0 ? 1.01 : 0.99
        onWheelScaleSelection(factor)
        return
      }
      if (!event.ctrlKey && !event.metaKey && event.altKey && onWheelAdjustThickness) {
        const deltaSteps = event.deltaY < 0 ? 1 : -1
        onWheelAdjustThickness(deltaSteps)
        return
      }
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && onWheelRotateSelection) {
        const deltaDeg = event.deltaY < 0 ? 1 : -1
        onWheelRotateSelection(deltaDeg)
        return
      }

      const rect = svg.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      setViewport(previous => navigateWithWheel(previous, event, { wheelMode, trackpadSensitivity }, { x: screenX, y: screenY, height: rect.height }, reverseZoomDirection))
    }

    svg.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      svg.removeEventListener('wheel', handleWheel)
    }
  }, [
    setViewport,
    svgRef,
    reverseZoomDirection,
    wheelMode,
    trackpadSensitivity,
    onWheelRotateSelection,
    onWheelScaleSelection,
    onWheelAdjustThickness,
  ])

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
