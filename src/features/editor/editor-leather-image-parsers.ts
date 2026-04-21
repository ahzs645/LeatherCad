import type { LeatherImageFill } from './cad/cad-types'
import { clampLeatherImageFill } from './ops/leather-image-fill-ops'

export function parseLeatherImageFill(value: unknown): LeatherImageFill | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<LeatherImageFill>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }
  if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
    return null
  }
  if (typeof candidate.imageDataUrl !== 'string' || !candidate.imageDataUrl.startsWith('data:image/')) {
    return null
  }
  if (typeof candidate.bitmapWidth !== 'number' || candidate.bitmapWidth <= 0) {
    return null
  }
  if (typeof candidate.bitmapHeight !== 'number' || candidate.bitmapHeight <= 0) {
    return null
  }

  const crop = candidate.crop && typeof candidate.crop === 'object' ? candidate.crop : undefined
  return clampLeatherImageFill({
    id: candidate.id,
    name: candidate.name,
    imageDataUrl: candidate.imageDataUrl,
    bitmapWidth: candidate.bitmapWidth,
    bitmapHeight: candidate.bitmapHeight,
    x: typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? candidate.x : 0,
    y: typeof candidate.y === 'number' && Number.isFinite(candidate.y) ? candidate.y : 0,
    widthMm:
      typeof candidate.widthMm === 'number' && Number.isFinite(candidate.widthMm) && candidate.widthMm > 0
        ? candidate.widthMm
        : candidate.bitmapWidth,
    heightMm:
      typeof candidate.heightMm === 'number' && Number.isFinite(candidate.heightMm) && candidate.heightMm > 0
        ? candidate.heightMm
        : candidate.bitmapHeight,
    rotationDeg:
      typeof candidate.rotationDeg === 'number' && Number.isFinite(candidate.rotationDeg)
        ? candidate.rotationDeg
        : 0,
    crop: {
      x: typeof crop?.x === 'number' && Number.isFinite(crop.x) ? crop.x : 0,
      y: typeof crop?.y === 'number' && Number.isFinite(crop.y) ? crop.y : 0,
      width:
        typeof crop?.width === 'number' && Number.isFinite(crop.width) && crop.width > 0
          ? crop.width
          : candidate.bitmapWidth,
      height:
        typeof crop?.height === 'number' && Number.isFinite(crop.height) && crop.height > 0
          ? crop.height
          : candidate.bitmapHeight,
    },
    assignedShapeIds: Array.isArray(candidate.assignedShapeIds)
      ? candidate.assignedShapeIds.filter((shapeId): shapeId is string => typeof shapeId === 'string')
      : [],
    visible: typeof candidate.visible === 'boolean' ? candidate.visible : true,
    opacity: typeof candidate.opacity === 'number' && Number.isFinite(candidate.opacity) ? candidate.opacity : 0.65,
    dpi: typeof candidate.dpi === 'number' && Number.isFinite(candidate.dpi) && candidate.dpi > 0 ? candidate.dpi : undefined,
  })
}
