import type { Point, Shape, LineType } from '../cad/cad-types'
import type { OutlineRegion } from './outline-regions'
import type { OutlinePolygon } from './three-bridge'

const EPSILON = 1e-6

export function isPhysicalCutShape(shape: Shape, lineTypeById: Map<string, LineType>) {
  if (shape.type === 'text') {
    return false
  }
  const lineType = lineTypeById.get(shape.lineTypeId)
  return !lineType || lineType.role === 'cut'
}

export function polygonAreaPoints(points: Point[]) {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return Math.abs(area) / 2
}

export function shouldUseOutlineRegions(params: {
  cutShapes: Shape[]
  layerOutlines: OutlinePolygon[]
  outlineRegions: OutlineRegion[]
  fallbackBoundsArea: number
}) {
  const { cutShapes, layerOutlines, outlineRegions, fallbackBoundsArea } = params
  if (outlineRegions.length === 0) {
    return false
  }
  const closedShapeIdSet = new Set(layerOutlines.flatMap((outline) => outline.shapeIds))
  const hasOpenCutGeometry = cutShapes.some((shape) => !closedShapeIdSet.has(shape.id))
  if (!hasOpenCutGeometry || fallbackBoundsArea <= EPSILON) {
    return true
  }
  const largestOutlineArea = outlineRegions.reduce(
    (largest, region) => Math.max(largest, polygonAreaPoints(region.outer.polygon)),
    0,
  )
  return largestOutlineArea >= fallbackBoundsArea * 0.1
}
