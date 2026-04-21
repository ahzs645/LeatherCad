import type { Dispatch, RefObject, SetStateAction } from 'react'
import { clamp } from '../../cad/cad-geometry'
import type { Shape, Viewport } from '../../cad/cad-types'
import { MAX_ZOOM, MIN_ZOOM } from '../../editor-constants'
import { fitViewportToShapes } from '../../ops/viewport-fit'

type UseCanvasViewportControlsParams = {
  svgRef: RefObject<SVGSVGElement | null>
  displayShapes: Shape[]
  setViewport: Dispatch<SetStateAction<Viewport>>
  setStatus: (status: string) => void
}

export function useCanvasViewportControls({
  svgRef,
  displayShapes,
  setViewport,
  setStatus,
}: UseCanvasViewportControlsParams) {
  const zoomAtScreenPoint = (screenX: number, screenY: number, zoomFactor: number) => {
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

  const handleZoomStep = (zoomFactor: number) => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    zoomAtScreenPoint(rect.width / 2, rect.height / 2, zoomFactor)
  }

  const handleResetView = () => {
    setViewport({ x: 560, y: 360, scale: 1 })
    setStatus('View reset')
  }

  const handleFitView = () => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    if (displayShapes.length === 0) {
      handleResetView()
      return
    }

    const rect = svg.getBoundingClientRect()
    setViewport(fitViewportToShapes(displayShapes, rect))
    setStatus('View fit to current sketch view')
  }

  return {
    handleZoomStep,
    handleResetView,
    handleFitView,
    zoomAtScreenPoint,
  }
}
