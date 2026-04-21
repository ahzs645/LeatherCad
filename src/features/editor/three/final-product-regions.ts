import type { LineType, Point, Shape, Layer } from '../cad/cad-types'
import { buildPhysicalLayerRegions } from './physical-layer-regions'
import type { OutlinePolygon } from './three-bridge-types'

export type FinalProductRegion = {
  layerId: string
  polygon: Point[]
}

export function buildFinalProductRegions({
  layers,
  lineTypes,
  shapes,
  outlinePolygons,
}: {
  layers: Layer[]
  lineTypes: LineType[]
  shapes: Shape[]
  outlinePolygons: OutlinePolygon[]
}): FinalProductRegion[] {
  const lineTypeById = new Map(lineTypes.map((lineType) => [lineType.id, lineType]))
  const regions: FinalProductRegion[] = []
  const layerIds = new Set(layers.map((layer) => layer.id))
  const orderedLayerIds = [
    ...layers.map((layer) => layer.id),
    ...Array.from(new Set(shapes.map((shape) => shape.layerId))).filter((layerId) => !layerIds.has(layerId)),
  ]

  for (const layerId of orderedLayerIds) {
    const layerShapes = shapes.filter((shape) => shape.layerId === layerId)
    if (layerShapes.length === 0) {
      continue
    }
    const layerOutlines = outlinePolygons.filter((outline) => outline.layerId === layerId)
    const physicalRegions = buildPhysicalLayerRegions({
      layerId,
      shapes: layerShapes,
      lineTypeById,
      closedCutOutlines: layerOutlines,
    })
    for (const region of physicalRegions) {
      regions.push({ layerId, polygon: region.outer })
    }
  }

  if (regions.length > 0) {
    return regions
  }

  return outlinePolygons.map((outline) => ({
    layerId: outline.layerId,
    polygon: outline.polygon,
  }))
}
