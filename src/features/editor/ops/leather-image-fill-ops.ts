import { getBounds, uid } from '../cad/cad-geometry'
import type { LeatherImageFill, LineType, Shape } from '../cad/cad-types'
import { detectOutlines } from './outline-detection'

export function fileToLeatherImageDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('FileReader produced non-string result'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

export function readLeatherImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 })
    image.onerror = () => reject(new Error('Could not decode leather image'))
    image.src = dataUrl
  })
}

export function computeLeatherImageMmSize(
  bitmapWidth: number,
  bitmapHeight: number,
  dpi: number | undefined,
): { widthMm: number; heightMm: number } {
  if (dpi && dpi > 0) {
    const mmPerPixel = 25.4 / dpi
    return {
      widthMm: bitmapWidth * mmPerPixel,
      heightMm: bitmapHeight * mmPerPixel,
    }
  }
  return { widthMm: bitmapWidth, heightMm: bitmapHeight }
}

export function createLeatherImageFillFromImage(params: {
  name: string
  imageDataUrl: string
  bitmapWidth: number
  bitmapHeight: number
  dpi?: number
  placementBounds?: { minX: number; minY: number; width: number; height: number } | null
}): LeatherImageFill {
  const size = computeLeatherImageMmSize(params.bitmapWidth, params.bitmapHeight, params.dpi)
  const placement = params.placementBounds
  return {
    id: uid(),
    name: params.name,
    imageDataUrl: params.imageDataUrl,
    bitmapWidth: params.bitmapWidth,
    bitmapHeight: params.bitmapHeight,
    x: placement?.minX ?? 0,
    y: placement?.minY ?? 0,
    widthMm: placement?.width ?? size.widthMm,
    heightMm: placement?.height ?? size.heightMm,
    rotationDeg: 0,
    crop: {
      x: 0,
      y: 0,
      width: params.bitmapWidth,
      height: params.bitmapHeight,
    },
    assignedShapeIds: [],
    visible: true,
    opacity: 0.65,
    dpi: params.dpi,
  }
}

export function resolveSelectedClosedOutlineShapeIds(
  shapes: Shape[],
  lineTypes: LineType[],
  selectedShapeIdSet: Set<string>,
) {
  const selectedClosedShapeIds = new Set<string>()
  const outlines = detectOutlines(shapes, lineTypes)
  for (const outline of outlines) {
    if (!outline.isClosed || outline.area <= 0) {
      continue
    }
    if (!outline.shapeIds.some((shapeId) => selectedShapeIdSet.has(shapeId))) {
      continue
    }
    outline.shapeIds.forEach((shapeId) => selectedClosedShapeIds.add(shapeId))
  }
  return selectedClosedShapeIds
}

export function buildLeatherImagePlacementBounds(shapes: Shape[], assignedShapeIds: Set<string>) {
  const assignedShapes = shapes.filter((shape) => assignedShapeIds.has(shape.id))
  if (assignedShapes.length === 0) {
    return null
  }
  return getBounds(assignedShapes)
}

export function clampLeatherImageFill(fill: LeatherImageFill): LeatherImageFill {
  const cropWidth = Math.max(1, Math.min(fill.bitmapWidth, fill.crop.width))
  const cropHeight = Math.max(1, Math.min(fill.bitmapHeight, fill.crop.height))
  return {
    ...fill,
    widthMm: Math.max(1, fill.widthMm),
    heightMm: Math.max(1, fill.heightMm),
    opacity: Math.max(0.05, Math.min(1, fill.opacity)),
    crop: {
      x: Math.max(0, Math.min(fill.bitmapWidth - cropWidth, fill.crop.x)),
      y: Math.max(0, Math.min(fill.bitmapHeight - cropHeight, fill.crop.y)),
      width: cropWidth,
      height: cropHeight,
    },
    assignedShapeIds: Array.from(new Set(fill.assignedShapeIds)),
  }
}
