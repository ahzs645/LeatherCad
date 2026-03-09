import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import { normalizeLineTypes, resolveActiveLineTypeId } from '../cad/line-types'
import type {
  AvatarSpec,
  DimensionLine,
  DocFile,
  HardwareMarker,
  LegacySeamAllowance,
  Layer,
  LineType,
  PatternPiece,
  PiecePlacement3D,
  ParametricConstraint,
  PieceGrainline,
  PieceLabel,
  PiecePlacementLabel,
  PieceNotch,
  PieceSeamAllowance,
  PrintArea,
  SeamConnection,
  Shape,
  SketchGroup,
  StitchHole,
  TextureSource,
  ThreePreviewSettings,
  Tool,
  TracingOverlay,
} from '../cad/cad-types'
import { DEFAULT_SNAP_SETTINGS, DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import { parseSnapSettings } from '../editor-parsers'
import { parseAvatarSpec, parsePiecePlacement3d, parseSeamConnection, parseThreePreviewSettings, sanitizeThreePreviewSettings } from '../editor-parsers'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import { createDefaultLayer } from '../editor-utils'
import { sanitizeSketchGroupLinks } from '../ops/sketch-link-ops'
import { migrateLegacySeamAllowances } from '../ops/pattern-piece-ops'

type UseLoadedDocumentActionsParams = {
  clearDraft: () => void
  setLayers: Dispatch<SetStateAction<Layer[]>>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setActiveSketchGroupId: Dispatch<SetStateAction<string | null>>
  setLineTypes: Dispatch<SetStateAction<LineType[]>>
  setActiveLineTypeId: Dispatch<SetStateAction<string>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setFoldLines: Dispatch<SetStateAction<import('../cad/cad-types').FoldLine[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setPatternPieces: Dispatch<SetStateAction<PatternPiece[]>>
  setPieceGrainlines: Dispatch<SetStateAction<PieceGrainline[]>>
  setPieceLabels: Dispatch<SetStateAction<PieceLabel[]>>
  setPiecePlacementLabels: Dispatch<SetStateAction<PiecePlacementLabel[]>>
  setPiecePlacements3d: Dispatch<SetStateAction<PiecePlacement3D[]>>
  setSeamConnections: Dispatch<SetStateAction<SeamConnection[]>>
  setSeamAllowances: Dispatch<SetStateAction<PieceSeamAllowance[]>>
  setPieceNotches: Dispatch<SetStateAction<PieceNotch[]>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setSnapSettings: Dispatch<SetStateAction<import('../cad/cad-types').SnapSettings>>
  setShowAnnotations: Dispatch<SetStateAction<boolean>>
  setTracingOverlays: Dispatch<SetStateAction<TracingOverlay[]>>
  setProjectMemo: Dispatch<SetStateAction<string>>
  setStitchAlwaysShapeIds: Dispatch<SetStateAction<string[]>>
  setStitchThreadColor: Dispatch<SetStateAction<string>>
  setThreePreviewSettings: Dispatch<SetStateAction<ThreePreviewSettings>>
  setAvatars: Dispatch<SetStateAction<AvatarSpec[]>>
  setThreeTextureSource: Dispatch<SetStateAction<TextureSource | null>>
  setThreeTextureShapeIds: Dispatch<SetStateAction<string[]>>
  setShowCanvasRuler: Dispatch<SetStateAction<boolean>>
  setShowDimensions: Dispatch<SetStateAction<boolean>>
  setDimensionLines: Dispatch<SetStateAction<DimensionLine[]>>
  setPrintAreas: Dispatch<SetStateAction<PrintArea[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setLayerColorOverrides: Dispatch<SetStateAction<Record<string, string>>>
  setTool: Dispatch<SetStateAction<Tool>>
  setShowPrintAreas: Dispatch<SetStateAction<boolean>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useLoadedDocumentActions(params: UseLoadedDocumentActionsParams) {
  const {
    clearDraft,
    setLayers,
    setActiveLayerId,
    setSketchGroups,
    setActiveSketchGroupId,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setConstraints,
    setPatternPieces,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setShowCanvasRuler,
    setShowDimensions,
    setDimensionLines,
    setPrintAreas,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setTool,
    setShowPrintAreas,
    setStatus,
  } = params

  const applyLoadedDocument = useCallback((doc: DocFile, statusMessage: string) => {
    const normalizedLayers = doc.layers.length > 0 ? doc.layers : [createDefaultLayer(uid())]
    const normalizedActiveLayerId = normalizedLayers.some((layer) => layer.id === doc.activeLayerId)
      ? doc.activeLayerId
      : normalizedLayers[0].id
    const layerIdSet = new Set(normalizedLayers.map((layer) => layer.id))
    const normalizedSketchGroups = sanitizeSketchGroupLinks((doc.sketchGroups ?? []).filter((group) => layerIdSet.has(group.layerId)))
    const sketchGroupIdSet = new Set(normalizedSketchGroups.map((group) => group.id))
    const normalizedShapes = doc.objects.map((shape) => {
      if (!shape.groupId || !sketchGroupIdSet.has(shape.groupId)) {
        return {
          ...shape,
          groupId: undefined,
        }
      }

      const group = normalizedSketchGroups.find((entry) => entry.id === shape.groupId)
      if (!group || group.layerId !== shape.layerId) {
        return {
          ...shape,
          groupId: undefined,
        }
      }

      return shape
    })
    const shapeIdSet = new Set(normalizedShapes.map((shape) => shape.id))
    const normalizedConstraints = (doc.constraints ?? []).filter((constraint) => {
      if (!shapeIdSet.has(constraint.shapeId)) {
        return false
      }
      if (constraint.type === 'edge-offset') {
        return layerIdSet.has(constraint.referenceLayerId)
      }
      return shapeIdSet.has(constraint.referenceShapeId)
    })
    const normalizedPatternPieces = (doc.patternPieces ?? []).filter((piece) => shapeIdSet.has(piece.boundaryShapeId))
    const patternPieceIdSet = new Set(normalizedPatternPieces.map((piece) => piece.id))
    const rawSeamAllowances = doc.seamAllowances ?? []
    const legacySeamAllowances: LegacySeamAllowance[] = rawSeamAllowances.filter(
      (entry): entry is LegacySeamAllowance =>
        'shapeId' in entry &&
        typeof entry.shapeId === 'string' &&
        shapeIdSet.has(entry.shapeId),
    )
    const pieceSeamAllowances = rawSeamAllowances.filter(
      (entry): entry is PieceSeamAllowance =>
        'pieceId' in entry &&
        typeof entry.pieceId === 'string' &&
        patternPieceIdSet.has(entry.pieceId),
    )
    const migratedSeamAllowances = migrateLegacySeamAllowances(legacySeamAllowances, normalizedPatternPieces)
    const normalizedSeamAllowances = [...pieceSeamAllowances, ...migratedSeamAllowances]
    const normalizedPieceGrainlines = (doc.pieceGrainlines ?? []).filter((grainline) => patternPieceIdSet.has(grainline.pieceId))
    const normalizedPieceLabels = (doc.pieceLabels ?? []).filter((label) => patternPieceIdSet.has(label.pieceId))
    const normalizedPiecePlacementLabels = (doc.piecePlacementLabels ?? []).filter((label) => patternPieceIdSet.has(label.pieceId))
    const normalizedPiecePlacements3d = (doc.piecePlacements3d ?? [])
      .map(parsePiecePlacement3d)
      .filter((placement): placement is PiecePlacement3D => placement !== null && patternPieceIdSet.has(placement.pieceId))
    const normalizedSeamConnections = (doc.seamConnections ?? [])
      .map(parseSeamConnection)
      .filter(
        (connection): connection is SeamConnection =>
          connection !== null &&
          patternPieceIdSet.has(connection.from.pieceId) &&
          patternPieceIdSet.has(connection.to.pieceId),
      )
    const normalizedPieceNotches = (doc.pieceNotches ?? []).filter((notch) => patternPieceIdSet.has(notch.pieceId))
    const normalizedHardwareMarkers = (doc.hardwareMarkers ?? []).filter((marker) => {
      if (!layerIdSet.has(marker.layerId)) {
        return false
      }
      if (!marker.groupId) {
        return true
      }
      return sketchGroupIdSet.has(marker.groupId)
    })
    const normalizedActiveSketchGroupId =
      doc.activeSketchGroupId && sketchGroupIdSet.has(doc.activeSketchGroupId) ? doc.activeSketchGroupId : null
    const normalizedProjectMemo = typeof doc.projectMemo === 'string' ? doc.projectMemo.slice(0, 8000) : ''
    const normalizedStitchAlwaysShapeIds = Array.isArray(doc.stitchAlwaysShapeIds)
      ? doc.stitchAlwaysShapeIds.filter((shapeId): shapeId is string => typeof shapeId === 'string' && shapeIdSet.has(shapeId))
      : []
    const normalizedStitchThreadColor =
      typeof doc.stitchThreadColor === 'string' && doc.stitchThreadColor.trim().length > 0
        ? doc.stitchThreadColor
        : '#fb923c'
    const normalizedThreePreviewSettings = sanitizeThreePreviewSettings(
      parseThreePreviewSettings(doc.threePreviewSettings) ?? DEFAULT_THREE_PREVIEW_SETTINGS,
    )
    const normalizedAvatars = (doc.avatars ?? [])
      .map(parseAvatarSpec)
      .filter((avatar): avatar is AvatarSpec => avatar !== null)
    const normalizedThreeTextureSource =
      doc.threeTextureSource &&
      typeof doc.threeTextureSource === 'object' &&
      typeof doc.threeTextureSource.albedoUrl === 'string' &&
      doc.threeTextureSource.albedoUrl.trim().length > 0
        ? (doc.threeTextureSource)
        : null
    const normalizedThreeTextureShapeIds = Array.isArray(doc.threeTextureShapeIds)
      ? doc.threeTextureShapeIds.filter((shapeId): shapeId is string => typeof shapeId === 'string' && shapeIdSet.has(shapeId))
      : []
    const normalizedShowCanvasRuler = typeof doc.showCanvasRuler === 'boolean' ? doc.showCanvasRuler : true
    const normalizedShowDimensions = typeof doc.showDimensions === 'boolean' ? doc.showDimensions : false
    const nextLineTypes = normalizeLineTypes(doc.lineTypes ?? [])

    setLayers(normalizedLayers)
    setActiveLayerId(normalizedActiveLayerId)
    setSketchGroups(normalizedSketchGroups)
    setActiveSketchGroupId(normalizedActiveSketchGroupId)
    setLineTypes(nextLineTypes)
    setActiveLineTypeId(resolveActiveLineTypeId(nextLineTypes, doc.activeLineTypeId))
    setShapes(normalizedShapes)
    setFoldLines(doc.foldLines)
    setStitchHoles(normalizeStitchHoleSequences(doc.stitchHoles ?? []))
    setConstraints(normalizedConstraints)
    setPatternPieces(normalizedPatternPieces)
    setPieceGrainlines(normalizedPieceGrainlines)
    setPieceLabels(normalizedPieceLabels)
    setPiecePlacementLabels(normalizedPiecePlacementLabels)
    setPiecePlacements3d(normalizedPiecePlacements3d)
    setSeamConnections(normalizedSeamConnections)
    setSeamAllowances(normalizedSeamAllowances)
    setPieceNotches(normalizedPieceNotches)
    setHardwareMarkers(normalizedHardwareMarkers)
    setSnapSettings(parseSnapSettings(doc.snapSettings) ?? DEFAULT_SNAP_SETTINGS)
    setShowAnnotations(typeof doc.showAnnotations === 'boolean' ? doc.showAnnotations : true)
    setTracingOverlays(doc.tracingOverlays ?? [])
    setProjectMemo(normalizedProjectMemo)
    setStitchAlwaysShapeIds(normalizedStitchAlwaysShapeIds)
    setStitchThreadColor(normalizedStitchThreadColor)
    setThreePreviewSettings(normalizedThreePreviewSettings)
    setAvatars(normalizedAvatars)
    setThreeTextureSource(normalizedThreeTextureSource)
    setThreeTextureShapeIds(normalizedThreeTextureShapeIds)
    setShowCanvasRuler(normalizedShowCanvasRuler)
    setShowDimensions(normalizedShowDimensions)
    setDimensionLines(doc.dimensionLines ?? [])
    setPrintAreas(doc.printAreas ?? [])
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
    setLayerColorOverrides({})
    setTool('pan')
    setShowPrintAreas(false)
    clearDraft()
    setStatus(statusMessage)
  }, [
    clearDraft,
    setLayers,
    setActiveLayerId,
    setSketchGroups,
    setActiveSketchGroupId,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setConstraints,
    setPatternPieces,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setShowCanvasRuler,
    setShowDimensions,
    setDimensionLines,
    setPrintAreas,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setTool,
    setShowPrintAreas,
    setStatus,
  ])

  return { applyLoadedDocument }
}
