import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape as ThreeShape,
  ShapeGeometry,
  Vector2,
} from 'three'
import type { Layer, LineType, Shape } from '../cad/cad-types'
import { buildOutlineRegions } from './outline-regions'
import { isPhysicalCutShape, shouldUseOutlineRegions } from './physical-layer-heuristics'
import { buildPhysicalLayerRegions } from './physical-layer-regions'
import { clipPolygonByLine, polygonBounds, type Bounds2 } from './bridge/geometry-utils'
import { buildBoundsFromShapes, projectPoint } from './model-builder-shared'
import type { ModelTransform, ModelBuilderMaterials } from './model-builder-types'
import { addPanelOutline } from './outline-renderer'
import { ThreeFoldManager } from './fold-manager'
import type { OutlinePolygon } from './three-bridge-types'

const EPSILON = 1e-6
const LAYER_STACK_STEP = 0.012

export type FoldLayerSlice = {
  layerId: string
  shapes: Shape[]
  hasPhysicalGeometry: boolean
}

function createPanelMesh(
  points: Vector2[],
  material: MeshStandardMaterial,
  bounds: Bounds2,
  pivot: Vector2 | null,
  yOffset: number,
  holes?: Vector2[][],
) {
  if (points.length < 3) {
    return null
  }

  const pivotX = pivot?.x ?? 0
  const pivotY = pivot?.y ?? 0
  const width = Math.max(bounds.maxX - bounds.minX, EPSILON)
  const height = Math.max(bounds.maxY - bounds.minY, EPSILON)

  const shape = new ThreeShape()
  shape.moveTo(points[0].x - pivotX, points[0].y - pivotY)
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x - pivotX, points[i].y - pivotY)
  }
  shape.closePath()

  if (holes) {
    for (const hole of holes) {
      if (hole.length < 3) continue
      const holePath = new Path()
      holePath.moveTo(hole[0].x - pivotX, hole[0].y - pivotY)
      for (let i = 1; i < hole.length; i++) {
        holePath.lineTo(hole[i].x - pivotX, hole[i].y - pivotY)
      }
      holePath.closePath()
      shape.holes.push(holePath)
    }
  }

  const shapeGeometry = new ShapeGeometry(shape)
  const posAttr = shapeGeometry.getAttribute('position')
  const count = posAttr.count
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []

  for (let i = 0; i < count; i++) {
    const sx = posAttr.getX(i)
    const sy = posAttr.getY(i)
    vertices.push(sx, yOffset, sy)
    normals.push(0, 1, 0)
    const worldX = sx + pivotX
    const worldY = sy + pivotY
    uvs.push((worldX - bounds.minX) / width, (worldY - bounds.minY) / height)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(Array.from(shapeGeometry.index?.array ?? []))
  geometry.computeBoundingSphere()

  shapeGeometry.dispose()

  return new Mesh(geometry, material)
}

export function buildFoldLayerSlices(layers: Layer[], shapes: Shape[], lineTypes: LineType[]) {
  const layerOrder = layers.map((layer) => layer.id)
  const layerStackLevels = new Map<string, number>()
  let maxStackLevel = 0
  for (const [index, layer] of layers.entries()) {
    const stackLevel =
      typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel)
        ? Math.max(0, Math.round(layer.stackLevel))
        : index
    layerStackLevels.set(layer.id, stackLevel)
    maxStackLevel = Math.max(maxStackLevel, stackLevel)
  }

  const lineTypeById = new Map(lineTypes.map((lineType) => [lineType.id, lineType]))
  const layerPhysicalAnchorId = new Map<string, string>()
  const layerSlices: FoldLayerSlice[] = []
  let currentPhysicalLayerId: string | null = null

  for (const layerId of layerOrder) {
    const layerShapes = shapes.filter((shape) => shape.layerId === layerId)
    const hasPhysicalGeometry = layerShapes.some((shape) => isPhysicalCutShape(shape, lineTypeById))
    if (hasPhysicalGeometry) {
      currentPhysicalLayerId = layerId
    }
    layerPhysicalAnchorId.set(layerId, currentPhysicalLayerId ?? layerId)
    if (layerShapes.length > 0) {
      layerSlices.push({ layerId, shapes: layerShapes, hasPhysicalGeometry })
    }
  }

  const orphanShapes = shapes.filter((shape) => !layerOrder.includes(shape.layerId))
  if (orphanShapes.length > 0) {
    const hasPhysicalGeometry = orphanShapes.some((shape) => isPhysicalCutShape(shape, lineTypeById))
    layerStackLevels.set('__orphan__', maxStackLevel + 1)
    if (hasPhysicalGeometry) {
      currentPhysicalLayerId = '__orphan__'
    }
    layerPhysicalAnchorId.set('__orphan__', currentPhysicalLayerId ?? '__orphan__')
    layerSlices.push({ layerId: '__orphan__', shapes: orphanShapes, hasPhysicalGeometry })
  }

  if (layerSlices.length === 0 && shapes.length > 0) {
    const hasPhysicalGeometry = shapes.some((shape) => isPhysicalCutShape(shape, lineTypeById))
    layerStackLevels.set('__all__', maxStackLevel + 1)
    layerPhysicalAnchorId.set('__all__', hasPhysicalGeometry ? '__all__' : currentPhysicalLayerId ?? '__all__')
    layerSlices.push({ layerId: '__all__', shapes, hasPhysicalGeometry })
  }

  return {
    lineTypeById,
    layerStackLevels,
    layerPhysicalAnchorId,
    layerSlices,
  }
}

export function renderPhysicalPanelsForLayer({
  layerSlice,
  lineTypeById,
  outlinePolygons,
  transform,
  documentBounds,
  foldStart,
  foldEnd,
  foldMid,
  yOffset,
  materials,
  hasActiveTexture,
  texturedShapeIdSet,
  staticSideGroup,
  foldingSideGroup,
  foldManager,
}: {
  layerSlice: FoldLayerSlice
  lineTypeById: Map<string, LineType>
  outlinePolygons: OutlinePolygon[]
  transform: ModelTransform
  documentBounds: Bounds2
  foldStart: Vector2
  foldEnd: Vector2
  foldMid: Vector2
  yOffset: number
  materials: ModelBuilderMaterials
  hasActiveTexture: boolean
  texturedShapeIdSet: Set<string>
  staticSideGroup: Group
  foldingSideGroup: Group
  foldManager: ThreeFoldManager
}) {
  if (!layerSlice.hasPhysicalGeometry) {
    return
  }

  const hasTexturedShape = hasActiveTexture && layerSlice.shapes.some((shape) => texturedShapeIdSet.has(shape.id))
  const staticMaterial = hasTexturedShape ? materials.leftTextureMaterial : materials.leftMaterial
  const foldingMaterial = hasTexturedShape ? materials.rightTextureMaterial : materials.rightMaterial

  const cutShapes = layerSlice.shapes.filter((shape) => isPhysicalCutShape(shape, lineTypeById))
  const layerOutlines = outlinePolygons.filter((outline) => outline.layerId === layerSlice.layerId)
  let panelRegions: Array<{ outer: Vector2[]; holes: Vector2[][] }>
  let layerProjectedBounds: Bounds2

  const fallbackLayerBounds = buildBoundsFromShapes(cutShapes) ?? buildBoundsFromShapes(layerSlice.shapes) ?? documentBounds
  const fallbackLayerArea = Math.max(
    0,
    (fallbackLayerBounds.maxX - fallbackLayerBounds.minX) * (fallbackLayerBounds.maxY - fallbackLayerBounds.minY),
  )
  const outlineRegions = layerOutlines.length > 0 ? buildOutlineRegions(layerOutlines) : []
  const canUseDetectedOutlines = shouldUseOutlineRegions({
    cutShapes,
    layerOutlines,
    outlineRegions,
    fallbackBoundsArea: fallbackLayerArea,
  })
  const physicalLayerRegions = canUseDetectedOutlines
    ? []
    : buildPhysicalLayerRegions({
        layerId: layerSlice.layerId,
        shapes: layerSlice.shapes,
        lineTypeById,
        closedCutOutlines: layerOutlines,
      })

  if (canUseDetectedOutlines) {
    panelRegions = outlineRegions.map((region) => ({
      outer: region.outer.polygon.map((point) => projectPoint(point, transform)),
      holes: region.holes.map((hole) => hole.polygon.map((point) => projectPoint(point, transform))),
    }))
    const allPoints = panelRegions.flatMap((region) => [region.outer, ...region.holes]).flat()
    layerProjectedBounds = polygonBounds(allPoints)
  } else if (physicalLayerRegions.length > 0) {
    panelRegions = physicalLayerRegions.map((region) => ({
      outer: region.outer.map((point) => projectPoint(point, transform)),
      holes: region.holes.map((hole) => hole.map((point) => projectPoint(point, transform))),
    }))
    const allPoints = panelRegions.flatMap((region) => [region.outer, ...region.holes]).flat()
    layerProjectedBounds = polygonBounds(allPoints)
  } else {
    panelRegions = [{
      outer: [
        projectPoint({ x: fallbackLayerBounds.minX, y: fallbackLayerBounds.minY }, transform),
        projectPoint({ x: fallbackLayerBounds.maxX, y: fallbackLayerBounds.minY }, transform),
        projectPoint({ x: fallbackLayerBounds.maxX, y: fallbackLayerBounds.maxY }, transform),
        projectPoint({ x: fallbackLayerBounds.minX, y: fallbackLayerBounds.maxY }, transform),
      ],
      holes: [],
    }]
    layerProjectedBounds = polygonBounds(panelRegions[0].outer)
  }

  for (const panelRegion of panelRegions) {
    const panelPoly = panelRegion.outer
    let positivePolygon = clipPolygonByLine(panelPoly, foldStart, foldEnd, true)
    let negativePolygon = clipPolygonByLine(panelPoly, foldStart, foldEnd, false)
    let positiveHoles = panelRegion.holes
      .map((hole) => clipPolygonByLine(hole, foldStart, foldEnd, true))
      .filter((hole) => hole.length >= 3)
    let negativeHoles = panelRegion.holes
      .map((hole) => clipPolygonByLine(hole, foldStart, foldEnd, false))
      .filter((hole) => hole.length >= 3)
    if (positivePolygon.length < 3 && negativePolygon.length < 3) {
      positivePolygon = []
      negativePolygon = panelPoly.map((point) => point.clone())
      positiveHoles = []
      negativeHoles = panelRegion.holes.map((hole) => hole.map((point) => point.clone()))
    }

    if (negativePolygon.length >= 3) {
      const staticPanel = createPanelMesh(
        negativePolygon,
        staticMaterial,
        layerProjectedBounds,
        null,
        yOffset,
        negativeHoles,
      )
      if (staticPanel) {
        foldManager.registerStaticPanel(staticPanel)
        staticSideGroup.add(staticPanel)
        addPanelOutline(negativePolygon, staticSideGroup, '#e2e8f0', yOffset, null)
      }
    }

    if (positivePolygon.length >= 3) {
      const foldingPanel = createPanelMesh(
        positivePolygon,
        foldingMaterial,
        layerProjectedBounds,
        foldMid,
        yOffset,
        positiveHoles,
      )
      if (foldingPanel) {
        foldManager.registerFoldingPanel(foldingPanel)
        foldingSideGroup.add(foldingPanel)
        addPanelOutline(positivePolygon, foldingSideGroup, '#e2e8f0', yOffset, foldMid)
      }
    }
  }
}

export function computeDynamicLayerStep(thicknessMm: number, clearanceMm: number, transformScale: number) {
  return Math.max(
    LAYER_STACK_STEP,
    (thicknessMm + clearanceMm * 0.5) * transformScale,
  )
}
