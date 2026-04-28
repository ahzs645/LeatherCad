import type { LineType, Point, Shape, Layer } from '../cad/cad-types'
import { buildPhysicalLayerRegions } from './physical-layer-regions'
import type { OutlinePolygon } from './three-bridge-types'

export type FinalProductRegion = {
  layerId: string
  stackLevel?: number
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
  const layerStackLevelById = new Map(
    layers.map((layer, index) => [
      layer.id,
      typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel)
        ? Math.max(0, Math.round(layer.stackLevel))
        : index,
    ]),
  )
  const orderedLayerIds = [
    ...layers.map((layer) => layer.id),
    ...Array.from(new Set(shapes.map((shape) => shape.layerId))).filter((layerId) => !layerIds.has(layerId)),
  ]

  for (const [fallbackStackLevel, layerId] of orderedLayerIds.entries()) {
    const layerShapes = shapes.filter((shape) => shape.layerId === layerId)
    if (layerShapes.length === 0) {
      continue
    }
    const stackLevel = layerStackLevelById.get(layerId) ?? fallbackStackLevel
    const layerOutlines = outlinePolygons.filter((outline) => outline.layerId === layerId)
    const physicalRegions = buildPhysicalLayerRegions({
      layerId,
      shapes: layerShapes,
      lineTypeById,
      closedCutOutlines: [],
    })
    const resolvedRegions = physicalRegions.length > 0
      ? physicalRegions
      : buildPhysicalLayerRegions({
          layerId,
          shapes: layerShapes,
          lineTypeById,
          closedCutOutlines: layerOutlines,
        })

    for (const region of resolvedRegions) {
      regions.push({ layerId, stackLevel, polygon: region.outer })
    }
  }

  if (regions.length > 0) {
    return regions
  }

  return outlinePolygons.map((outline) => ({
    layerId: outline.layerId,
    stackLevel: layerStackLevelById.get(outline.layerId),
    polygon: outline.polygon,
  }))
}
