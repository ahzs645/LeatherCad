import { clamp } from './cad/cad-geometry'
import type { Backdrop, Point, TracingOverlay } from './cad/cad-types'

function parseBackdropPoint(value: unknown): Point | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<Point>
  if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') return undefined
  return { x: candidate.x, y: candidate.y }
}

export function parseBackdrop(value: unknown): Backdrop | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<Backdrop>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) return null
  if (typeof candidate.bitmapDataUrl !== 'string' || candidate.bitmapDataUrl.length === 0) return null
  const leftTop = parseBackdropPoint(candidate.leftTop) ?? { x: 0, y: 0 }
  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' && candidate.name.length > 0 ? candidate.name : 'Backdrop',
    bitmapDataUrl: candidate.bitmapDataUrl,
    bitmapWidth:
      typeof candidate.bitmapWidth === 'number' && candidate.bitmapWidth > 0 ? candidate.bitmapWidth : 1,
    bitmapHeight:
      typeof candidate.bitmapHeight === 'number' && candidate.bitmapHeight > 0 ? candidate.bitmapHeight : 1,
    leftTop,
    width: typeof candidate.width === 'number' && candidate.width > 0 ? candidate.width : 100,
    height: typeof candidate.height === 'number' && candidate.height > 0 ? candidate.height : 100,
    angleDeg: typeof candidate.angleDeg === 'number' ? candidate.angleDeg : 0,
    rotationCenter: parseBackdropPoint(candidate.rotationCenter),
    dpi:
      typeof candidate.dpi === 'number' && candidate.dpi > 0 ? candidate.dpi : undefined,
    fullPath: typeof candidate.fullPath === 'string' ? candidate.fullPath : undefined,
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    locked: typeof candidate.locked === 'boolean' ? candidate.locked : false,
    opacity: typeof candidate.opacity === 'number' ? clamp(candidate.opacity, 0.05, 1) : 1,
  }
}

export function parseTracingOverlay(value: unknown): TracingOverlay | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<TracingOverlay>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }
  if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
    return null
  }
  if (candidate.kind !== 'image' && candidate.kind !== 'pdf') {
    return null
  }
  if (typeof candidate.sourceUrl !== 'string' || candidate.sourceUrl.length === 0) {
    return null
  }

  return {
    id: candidate.id,
    name: candidate.name,
    kind: candidate.kind,
    sourceUrl: candidate.sourceUrl,
    pdfSourceUrl: typeof candidate.pdfSourceUrl === 'string' && candidate.pdfSourceUrl.length > 0 ? candidate.pdfSourceUrl : undefined,
    pdfPageNumber:
      typeof candidate.pdfPageNumber === 'number' && Number.isFinite(candidate.pdfPageNumber) && candidate.pdfPageNumber > 0
        ? Math.round(candidate.pdfPageNumber)
        : undefined,
    pdfPageCount:
      typeof candidate.pdfPageCount === 'number' && Number.isFinite(candidate.pdfPageCount) && candidate.pdfPageCount > 0
        ? Math.round(candidate.pdfPageCount)
        : undefined,
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    locked: typeof candidate.locked === 'boolean' ? candidate.locked : true,
    opacity: typeof candidate.opacity === 'number' ? clamp(candidate.opacity, 0.05, 1) : 0.75,
    scale: typeof candidate.scale === 'number' ? clamp(candidate.scale, 0.05, 20) : 1,
    rotationDeg: typeof candidate.rotationDeg === 'number' ? candidate.rotationDeg : 0,
    offsetX: typeof candidate.offsetX === 'number' ? candidate.offsetX : 0,
    offsetY: typeof candidate.offsetY === 'number' ? candidate.offsetY : 0,
    width: typeof candidate.width === 'number' && candidate.width > 0 ? candidate.width : 800,
    height: typeof candidate.height === 'number' && candidate.height > 0 ? candidate.height : 800,
    isObjectUrl: typeof candidate.isObjectUrl === 'boolean' ? candidate.isObjectUrl : false,
  }
}
