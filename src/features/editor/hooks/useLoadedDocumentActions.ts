import { useCallback } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
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
  AssemblyConnection,
  PatternPiece,
  PieceInterface,
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
  Viewport,
} from '../cad/cad-types'
import { DEFAULT_SNAP_SETTINGS, DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import { parseSnapSettings } from '../editor-parsers'
import {
  parseAssemblyConnection,
  parseAvatarSpec,
  parsePieceInterface,
  parsePiecePlacement3d,
  parseSeamConnection,
  parseThreePreviewSettings,
  sanitizeThreePreviewSettings,
} from '../editor-parsers'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import { createDefaultLayer } from '../editor-utils'
import { sanitizeSketchGroupLinks } from '../ops/sketch-link-ops'
import { migrateLegacySeamAllowances } from '../ops/pattern-piece-ops'
import { isExtractedBoxStitchSourceValue } from '../ops/box-stitch-source'
import { fitViewportToShapes, type ViewportFitSize } from '../ops/viewport-fit'

type UseLoadedDocumentActionsParams = {
  clearDraft: () => void
  setDocumentName: Dispatch<SetStateAction<string | null>>
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
  setPieceInterfaces: Dispatch<SetStateAction<PieceInterface[]>>
  setAssemblyConnections: Dispatch<SetStateAction<AssemblyConnection[]>>
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
  setBackdrops: Dispatch<SetStateAction<import('../cad/cad-types').Backdrop[]>>
  setActiveBackdropId: Dispatch<SetStateAction<string | null>>
  setProjectMemo: Dispatch<SetStateAction<string>>
  setStitchAlwaysShapeIds: Dispatch<SetStateAction<string[]>>
  setStitchThreadColor: Dispatch<SetStateAction<string>>
  setThreePreviewSettings: Dispatch<SetStateAction<ThreePreviewSettings>>
  setAvatars: Dispatch<SetStateAction<AvatarSpec[]>>
  setThreeTextureSource: Dispatch<SetStateAction<TextureSource | null>>
  setThreeTextureShapeIds: Dispatch<SetStateAction<string[]>>
  setLeatherImageFills: Dispatch<SetStateAction<NonNullable<DocFile['leatherImageFills']>>>
  setActiveLeatherImageFillId: Dispatch<SetStateAction<string | null>>
  setShowCanvasRuler: Dispatch<SetStateAction<boolean>>
  setShowDimensions: Dispatch<SetStateAction<boolean>>
  setDimensionLines: Dispatch<SetStateAction<DimensionLine[]>>
  setPrintAreas: Dispatch<SetStateAction<PrintArea[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setSelectedHardwareMarkerId: Dispatch<SetStateAction<string | null>>
  setLayerColorOverrides: Dispatch<SetStateAction<Record<string, string>>>
  setViewport: Dispatch<SetStateAction<Viewport>>
  svgRef: RefObject<SVGSVGElement | null>
  setTool: Dispatch<SetStateAction<Tool>>
  setShowPrintAreas: Dispatch<SetStateAction<boolean>>
  setStatus: Dispatch<SetStateAction<string>>
}

function getLoadedDocumentFitSize(svgRef: RefObject<SVGSVGElement | null>): ViewportFitSize {
  const rect = svgRef.current?.getBoundingClientRect()
  if (rect && rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height }
  }

  if (typeof window !== 'undefined') {
    return {
      width: Math.max(320, window.innerWidth - 420),
      height: Math.max(240, window.innerHeight - 180),
    }
  }

  return { width: 960, height: 640 }
}

export function useLoadedDocumentActions(params: UseLoadedDocumentActionsParams) {
  const {
    clearDraft,
    setDocumentName,
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
    setPieceInterfaces,
    setAssemblyConnections,
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
    setBackdrops,
    setActiveBackdropId,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setLeatherImageFills,
    setActiveLeatherImageFillId,
    setShowCanvasRuler,
    setShowDimensions,
    setDimensionLines,
    setPrintAreas,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setViewport,
    svgRef,
    setTool,
    setShowPrintAreas,
    setStatus,
  } = params

  const applyLoadedDocument = useCallback((doc: DocFile, statusMessage: string) => {
    const normalizedDocumentName =
      typeof doc.documentName === 'string' && doc.documentName.trim().length > 0 ? doc.documentName.trim() : null
    const normalizedLayers = doc.layers.length > 0 ? doc.layers : [createDefaultLayer(uid())]
    const normalizedActiveLayerId = normalizedLayers.some((layer) => layer.id === doc.activeLayerId)
      ? doc.activeLayerId
      : normalizedLayers[0].id
    const layerIdSet = new Set(normalizedLayers.map((layer) => layer.id))
    const normalizedSketchGroups = sanitizeSketchGroupLinks((doc.sketchGroups ?? []).filter((group) => layerIdSet.has(group.layerId)))
    const sketchGroupIdSet = new Set(normalizedSketchGroups.map((group) => group.id))
    const normalizeBoxStitchSource = (shape: Shape) =>
      shape.type !== 'text' && isExtractedBoxStitchSourceValue(shape.boxStitchSource)
        ? { extracted: true as const }
        : undefined
    const normalizedShapes = doc.objects.map((shape) => {
      const boxStitchSource = normalizeBoxStitchSource(shape)

      if (!shape.groupId || !sketchGroupIdSet.has(shape.groupId)) {
        return {
          ...shape,
          boxStitchSource,
          groupId: undefined,
        }
      }

      const group = normalizedSketchGroups.find((entry) => entry.id === shape.groupId)
      if (!group || group.layerId !== shape.layerId) {
        return {
          ...shape,
          boxStitchSource,
          groupId: undefined,
        }
      }

      return {
        ...shape,
        boxStitchSource,
      }
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
    const normalizedPieceInterfaces = (doc.pieceInterfaces ?? [])
      .map(parsePieceInterface)
      .filter((entry): entry is PieceInterface => entry !== null && patternPieceIdSet.has(entry.pieceId))
    const pieceInterfaceIdSet = new Set(normalizedPieceInterfaces.map((entry) => entry.id))
    const normalizedAssemblyConnections = (doc.assemblyConnections ?? [])
      .map(parseAssemblyConnection)
      .filter(
        (entry): entry is AssemblyConnection =>
          entry !== null &&
          pieceInterfaceIdSet.has(entry.fromInterfaceId) &&
          pieceInterfaceIdSet.has(entry.toInterfaceId),
      )
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
    const normalizedLeatherImageFills = (doc.leatherImageFills ?? []).map((fill) => ({
      ...fill,
      assignedShapeIds: fill.assignedShapeIds.filter((shapeId) => shapeIdSet.has(shapeId)),
    }))
    const normalizedActiveLeatherImageFillId =
      doc.activeLeatherImageFillId &&
      normalizedLeatherImageFills.some((fill) => fill.id === doc.activeLeatherImageFillId)
        ? doc.activeLeatherImageFillId
        : normalizedLeatherImageFills[0]?.id ?? null
    const normalizedShowCanvasRuler = typeof doc.showCanvasRuler === 'boolean' ? doc.showCanvasRuler : true
    const normalizedShowDimensions = typeof doc.showDimensions === 'boolean' ? doc.showDimensions : false
    const nextLineTypes = normalizeLineTypes(doc.lineTypes ?? [])

    setDocumentName(normalizedDocumentName)
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
    setPieceInterfaces(normalizedPieceInterfaces)
    setAssemblyConnections(normalizedAssemblyConnections)
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
    setBackdrops(doc.backdrops ?? [])
    setActiveBackdropId(null)
    setProjectMemo(normalizedProjectMemo)
    setStitchAlwaysShapeIds(normalizedStitchAlwaysShapeIds)
    setStitchThreadColor(normalizedStitchThreadColor)
    setThreePreviewSettings(normalizedThreePreviewSettings)
    setAvatars(normalizedAvatars)
    setThreeTextureSource(normalizedThreeTextureSource)
    setThreeTextureShapeIds(normalizedThreeTextureShapeIds)
    setLeatherImageFills(normalizedLeatherImageFills)
    setActiveLeatherImageFillId(normalizedActiveLeatherImageFillId)
    setShowCanvasRuler(normalizedShowCanvasRuler)
    setShowDimensions(normalizedShowDimensions)
    setDimensionLines(doc.dimensionLines ?? [])
    setPrintAreas(doc.printAreas ?? [])
    setSelectedShapeIds([])
    setSelectedStitchHoleId(null)
    setSelectedHardwareMarkerId(null)
    setLayerColorOverrides({})
    setViewport(
      normalizedShapes.length > 0
        ? fitViewportToShapes(normalizedShapes, getLoadedDocumentFitSize(svgRef))
        : { x: 560, y: 360, scale: 1 },
    )
    setTool('pan')
    setShowPrintAreas(false)
    clearDraft()
    setStatus(statusMessage)
  }, [
    clearDraft,
    setDocumentName,
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
    setBackdrops,
    setActiveBackdropId,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setLeatherImageFills,
    setActiveLeatherImageFillId,
    setShowCanvasRuler,
    setShowDimensions,
    setDimensionLines,
    setPrintAreas,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setViewport,
    svgRef,
    setTool,
    setShowPrintAreas,
    setStatus,
  ])

  return { applyLoadedDocument }
}
