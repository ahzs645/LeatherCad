import { clamp, getBounds } from '../cad/cad-geometry'
import type { Shape, Viewport } from '../cad/cad-types'
import { MAX_ZOOM, MIN_ZOOM } from '../editor-constants'

export type ViewportFitSize = {
  width: number
  height: number
}

export type ViewportFitBounds = {
  minX: number
  minY: number
  width: number
  height: number
}

export function fitViewportToBounds(bounds: ViewportFitBounds, size: ViewportFitSize, margin = 40): Viewport {
  const safeBoundsWidth = Math.max(1, bounds.width)
  const safeBoundsHeight = Math.max(1, bounds.height)
  const safeViewportWidth = Math.max(1, size.width)
  const safeViewportHeight = Math.max(1, size.height)
  const usableWidth = Math.max(1, safeViewportWidth - margin * 2)
  const usableHeight = Math.max(1, safeViewportHeight - margin * 2)
  const fitScale = clamp(Math.min(usableWidth / safeBoundsWidth, usableHeight / safeBoundsHeight), MIN_ZOOM, MAX_ZOOM)

  return {
    scale: fitScale,
    x: safeViewportWidth / 2 - (bounds.minX + safeBoundsWidth / 2) * fitScale,
    y: safeViewportHeight / 2 - (bounds.minY + safeBoundsHeight / 2) * fitScale,
  }
}

export function fitViewportToShapes(shapes: Shape[], size: ViewportFitSize, margin = 40): Viewport {
  return fitViewportToBounds(getBounds(shapes), size, margin)
}
