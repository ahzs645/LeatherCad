import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  Points,
  PointsMaterial,
  Vector2,
  Vector3,
  Path,
  Shape as ThreeShape,
  ShapeGeometry,
  MeshStandardMaterial,
} from 'three'
import { sampleShapePoints } from '../cad/cad-geometry'
import type { Layer, LineType, Shape, StitchHole } from '../cad/cad-types'
import { buildOutlineRegions } from './outline-regions'
import { isPhysicalCutShape, shouldUseOutlineRegions } from './physical-layer-heuristics'
import { buildPhysicalLayerRegions } from './physical-layer-regions'
import { clearGroup } from './bridge/scene-lifecycle'
import {
  clipPolygonByLine,
  lineIntersectionOnSegment,
  polygonBounds,
  segmentLengthSquared,
  sideOfLine,
  type Bounds2,
} from './bridge/geometry-utils'
import type { ModelTransform, RebuildFoldModelParams } from './model-builder-types'
import { buildBoundsFromShapes, projectPoint } from './model-builder-shared'

const EPSILON = 1e-6
const CUT_LINE_COLOR = '#38bdf8'
const STITCH_LINE_COLOR = '#f97316'
const FOLD_LINE_COLOR = '#fb7185'
const LAYER_STACK_STEP = 0.012

type ShapeSegment = {
  start: Vector2
  end: Vector2
  color: string
}

function shapeColor(shape: Shape, lineTypes: LineType[], layers: Layer[]) {
  const lineType = lineTypes.find((entry) => entry.id === shape.lineTypeId)
  if (lineType?.role === 'stitch') {
    return STITCH_LINE_COLOR
  }
  if (lineType?.role === 'fold') {
    return FOLD_LINE_COLOR
  }

  const layer = layers.find((entry) => entry.id === shape.layerId)
  const fallbackFingerprint = `${layer?.name ?? ''} ${shape.id}`.toLowerCase()
  if (
    fallbackFingerprint.includes('stitch') ||
    fallbackFingerprint.includes('seam') ||
    fallbackFingerprint.includes('thread')
  ) {
    return STITCH_LINE_COLOR
  }

  return CUT_LINE_COLOR
}

function addSegmentLine(group: Group, segment: ShapeSegment, pivot: Vector2 | null, yOffset: number) {
  if (segmentLengthSquared(segment.start, segment.end) <= EPSILON) {
    return
  }

  const offsetX = pivot?.x ?? 0
  const offsetY = pivot?.y ?? 0
  const line = new Line(
    new BufferGeometry().setFromPoints([
      new Vector3(segment.start.x - offsetX, yOffset + 0.003, segment.start.y - offsetY),
      new Vector3(segment.end.x - offsetX, yOffset + 0.003, segment.end.y - offsetY),
    ]),
    new LineBasicMaterial({ color: segment.color }),
  )
  group.add(line)
}

function addStitchPoint(group: Group, point: Vector2, color: string, pivot: Vector2 | null, yOffset: number) {
  const offsetX = pivot?.x ?? 0
  const offsetY = pivot?.y ?? 0
  const geometry = new BufferGeometry().setFromPoints([
    new Vector3(point.x - offsetX, yOffset + 0.007, point.y - offsetY),
  ])
  const points = new Points(
    geometry,
    new PointsMaterial({
      color,
      size: 0.025,
      sizeAttenuation: true,
    }),
  )
  group.add(points)
}

function addPanelOutline(points: Vector2[], group: Group, color: string, pivot: Vector2 | null, yOffset: number) {
  if (points.length < 2) {
    return
  }

  const offsetX = pivot?.x ?? 0
  const offsetY = pivot?.y ?? 0
  const outlinePoints = points.map((point) => new Vector3(point.x - offsetX, yOffset + 0.004, point.y - offsetY))
  outlinePoints.push(new Vector3(points[0].x - offsetX, yOffset + 0.004, points[0].y - offsetY))

  const outline = new Line(
    new BufferGeometry().setFromPoints(outlinePoints),
    new LineBasicMaterial({ color }),
  )
  group.add(outline)
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

function splitSegmentByFold(start: Vector2, end: Vector2, foldStart: Vector2, foldEnd: Vector2) {
  const sideStart = sideOfLine(start, foldStart, foldEnd)
  const sideEnd = sideOfLine(end, foldStart, foldEnd)
  const onStart = Math.abs(sideStart) <= EPSILON
  const onEnd = Math.abs(sideEnd) <= EPSILON

  if (onStart && onEnd) {
    return {
      positive: [{ start, end }],
      negative: [{ start, end }],
    }
  }

  if ((sideStart >= -EPSILON && sideEnd >= -EPSILON) || (onStart && sideEnd > EPSILON) || (onEnd && sideStart > EPSILON)) {
    return { positive: [{ start, end }], negative: [] as Array<{ start: Vector2; end: Vector2 }> }
  }

  if ((sideStart <= EPSILON && sideEnd <= EPSILON) || (onStart && sideEnd < -EPSILON) || (onEnd && sideStart < -EPSILON)) {
    return { positive: [] as Array<{ start: Vector2; end: Vector2 }>, negative: [{ start, end }] }
  }

  const intersection = lineIntersectionOnSegment(start, end, sideStart, sideEnd)
  if (!intersection) {
    if (sideStart >= 0) {
      return { positive: [{ start, end }], negative: [] as Array<{ start: Vector2; end: Vector2 }> }
    }
    return { positive: [] as Array<{ start: Vector2; end: Vector2 }>, negative: [{ start, end }] }
  }

  if (sideStart >= 0) {
    return {
      positive: [{ start, end: intersection }],
      negative: [{ start: intersection, end }],
    }
  }

  return {
    positive: [{ start: intersection, end }],
    negative: [{ start, end: intersection }],
  }
}

function buildShapeSegments(
  shapes: Shape[],
  foldStart: Vector2,
  foldEnd: Vector2,
  transform: ModelTransform,
  lineTypes: LineType[],
  layers: Layer[],
) {
  const positiveSegments: ShapeSegment[] = []
  const negativeSegments: ShapeSegment[] = []

  for (const shape of shapes) {
    const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 28)
    const color = shapeColor(shape, lineTypes, layers)

    for (let index = 0; index < sampled.length - 1; index += 1) {
      const start = projectPoint(sampled[index], transform)
      const end = projectPoint(sampled[index + 1], transform)
      const split = splitSegmentByFold(start, end, foldStart, foldEnd)

      for (const segment of split.positive) {
        if (segmentLengthSquared(segment.start, segment.end) > EPSILON) {
          positiveSegments.push({
            start: segment.start.clone(),
            end: segment.end.clone(),
            color,
          })
        }
      }

      for (const segment of split.negative) {
        if (segmentLengthSquared(segment.start, segment.end) > EPSILON) {
          negativeSegments.push({
            start: segment.start.clone(),
            end: segment.end.clone(),
            color,
          })
        }
      }
    }
  }

  return { positiveSegments, negativeSegments }
}

export function rebuildFoldModel({
  layers,
  lineTypes,
  shapes,
  foldLines,
  stitchHoles,
  outlinePolygons,
  transform,
  documentBounds,
  threadColor,
  texturedShapeIdSet,
  hasActiveTexture,
  materials,
  preservedMaterials,
  fitControlsToModel,
  staticSideGroup,
  foldingSideGroup,
  foldGuideGroup,
  assembledGroup,
  avatarGroup,
  foldingPivot,
  modelRoot,
  foldManager,
}: RebuildFoldModelParams) {
  clearGroup(assembledGroup, preservedMaterials)
  clearGroup(avatarGroup, preservedMaterials)
  clearGroup(staticSideGroup, preservedMaterials)
  clearGroup(foldingSideGroup, preservedMaterials)
  clearGroup(foldGuideGroup, preservedMaterials)
  foldManager.resetPanels()

  const documentRectangle = [
    projectPoint({ x: documentBounds.minX, y: documentBounds.minY }, transform),
    projectPoint({ x: documentBounds.maxX, y: documentBounds.minY }, transform),
    projectPoint({ x: documentBounds.maxX, y: documentBounds.maxY }, transform),
    projectPoint({ x: documentBounds.minX, y: documentBounds.maxY }, transform),
  ]
  const projectedDocumentBounds = polygonBounds(documentRectangle)

  let foldStart =
    foldLines.length > 0
      ? projectPoint(foldLines[0].start, transform)
      : new Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.minY)
  let foldEnd =
    foldLines.length > 0
      ? projectPoint(foldLines[0].end, transform)
      : new Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.maxY)

  if (segmentLengthSquared(foldStart, foldEnd) <= EPSILON) {
    foldStart = new Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.minY)
    foldEnd = new Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.maxY)
  }

  const foldMid = foldStart.clone().add(foldEnd).multiplyScalar(0.5)
  const foldBehavior = foldManager.configureFold({
    foldLine: foldLines[0] ?? null,
    foldStart,
    foldEnd,
    foldingPivot,
    transformScale: transform.scale,
  })
  const dynamicLayerStep = Math.max(
    LAYER_STACK_STEP,
    (foldBehavior.thicknessMm + foldBehavior.clearanceMm * 0.5) * transform.scale,
  )

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
  const layerSlices: Array<{ layerId: string; shapes: Shape[]; hasPhysicalGeometry: boolean }> = []
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

  let maxYOffset = 0
  for (const [index, layerSlice] of layerSlices.entries()) {
    const physicalAnchorId = layerPhysicalAnchorId.get(layerSlice.layerId) ?? layerSlice.layerId
    const stackLevel = layerStackLevels.get(physicalAnchorId) ?? layerStackLevels.get(layerSlice.layerId) ?? index
    const yOffset = stackLevel * dynamicLayerStep
    maxYOffset = Math.max(maxYOffset, yOffset)
    const hasTexturedShape = hasActiveTexture && layerSlice.shapes.some((shape) => texturedShapeIdSet.has(shape.id))
    const staticMaterial = hasTexturedShape ? materials.leftTextureMaterial : materials.leftMaterial
    const foldingMaterial = hasTexturedShape ? materials.rightTextureMaterial : materials.rightMaterial

    if (layerSlice.hasPhysicalGeometry) {
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
        const regions = outlineRegions
        panelRegions = regions.map((region) => ({
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
            addPanelOutline(negativePolygon, staticSideGroup, '#e2e8f0', null, yOffset)
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
            addPanelOutline(positivePolygon, foldingSideGroup, '#e2e8f0', foldMid, yOffset)
          }
        }
      }
    }

    const { positiveSegments, negativeSegments } = buildShapeSegments(
      layerSlice.shapes,
      foldStart,
      foldEnd,
      transform,
      lineTypes,
      layers,
    )
    for (const segment of negativeSegments) {
      addSegmentLine(staticSideGroup, segment, null, yOffset)
    }
    for (const segment of positiveSegments) {
      addSegmentLine(foldingSideGroup, segment, foldMid, yOffset)
    }

    const layerShapeIds = new Set(layerSlice.shapes.map((shape) => shape.id))
    const layerStitchHoles = stitchHoles.filter((stitchHole) => layerShapeIds.has(stitchHole.shapeId))
    const stitchHolesByShape = new Map<string, StitchHole[]>()
    for (const stitchHole of layerStitchHoles) {
      const entries = stitchHolesByShape.get(stitchHole.shapeId) ?? []
      entries.push(stitchHole)
      stitchHolesByShape.set(stitchHole.shapeId, entries)
    }

    for (const stitchHolesOnShape of stitchHolesByShape.values()) {
      const ordered = stitchHolesOnShape
        .slice()
        .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))

      const projectedPoints = ordered.map((stitchHole) => projectPoint(stitchHole.point, transform))
      for (const projectedPoint of projectedPoints) {
        if (sideOfLine(projectedPoint, foldStart, foldEnd) > -EPSILON) {
          addStitchPoint(foldingSideGroup, projectedPoint, threadColor, foldMid, yOffset)
        } else {
          addStitchPoint(staticSideGroup, projectedPoint, threadColor, null, yOffset)
        }
      }

      for (let index = 1; index < projectedPoints.length; index += 1) {
        const split = splitSegmentByFold(projectedPoints[index - 1], projectedPoints[index], foldStart, foldEnd)
        for (const segment of split.negative) {
          addSegmentLine(
            staticSideGroup,
            {
              start: segment.start,
              end: segment.end,
              color: threadColor,
            },
            null,
            yOffset + 0.0015,
          )
        }
        for (const segment of split.positive) {
          addSegmentLine(
            foldingSideGroup,
            {
              start: segment.start,
              end: segment.end,
              color: threadColor,
            },
            foldMid,
            yOffset + 0.0015,
          )
        }
      }
    }
  }

  const guideYOffset = maxYOffset + 0.006
  for (const foldLine of foldLines) {
    const projectedStart = projectPoint(foldLine.start, transform)
    const projectedEnd = projectPoint(foldLine.end, transform)
    const line = new Line(
      new BufferGeometry().setFromPoints([
        new Vector3(projectedStart.x, guideYOffset, projectedStart.y),
        new Vector3(projectedEnd.x, guideYOffset, projectedEnd.y),
      ]),
      new LineDashedMaterial({
        color: FOLD_LINE_COLOR,
        dashSize: 0.06,
        gapSize: 0.035,
      }),
    )
    line.computeLineDistances()
    foldGuideGroup.add(line)
  }

  foldManager.updateRotation({
    staticSideGroup,
    foldingSideGroup,
    modelRoot,
  })
  fitControlsToModel()
}
