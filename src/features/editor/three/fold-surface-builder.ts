import { Vector2 } from 'three'
import { clearGroup } from './bridge/scene-lifecycle'
import { polygonBounds, segmentLengthSquared } from './bridge/geometry-utils'
import {
  buildFoldLayerSlices,
  computeDynamicLayerStep,
  renderPhysicalPanelsForLayer,
} from './fold-physical-panels'
import { renderFoldGuides, renderLayerOverlays } from './fold-overlay-renderer'
import type { RebuildFoldModelParams } from './model-builder-types'
import { projectPoint } from './model-builder-shared'

const EPSILON = 1e-6

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
  const dynamicLayerStep = computeDynamicLayerStep(
    foldBehavior.thicknessMm,
    foldBehavior.clearanceMm,
    transform.scale,
  )

  const { lineTypeById, layerStackLevels, layerPhysicalAnchorId, layerSlices } = buildFoldLayerSlices(
    layers,
    shapes,
    lineTypes,
  )

  let maxYOffset = 0
  for (const [index, layerSlice] of layerSlices.entries()) {
    const physicalAnchorId = layerPhysicalAnchorId.get(layerSlice.layerId) ?? layerSlice.layerId
    const stackLevel = layerStackLevels.get(physicalAnchorId) ?? layerStackLevels.get(layerSlice.layerId) ?? index
    const yOffset = stackLevel * dynamicLayerStep
    maxYOffset = Math.max(maxYOffset, yOffset)

    renderPhysicalPanelsForLayer({
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
    })

    renderLayerOverlays({
      layerSlice,
      lineTypes,
      layers,
      stitchHoles,
      transform,
      foldStart,
      foldEnd,
      foldMid,
      threadColor,
      yOffset,
      staticSideGroup,
      foldingSideGroup,
    })
  }

  renderFoldGuides({
    foldLines,
    transform,
    guideYOffset: maxYOffset + 0.006,
    foldGuideGroup,
  })

  foldManager.updateRotation({
    staticSideGroup,
    foldingSideGroup,
    modelRoot,
  })
  fitControlsToModel()
}
