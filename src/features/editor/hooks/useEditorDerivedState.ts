import { useMemo } from 'react'
import {
  computeBoundsFromShapes,
  getShapeAnchorPoint,
} from '../ops/pattern-ops'
import { countShapesByLineType } from '../ops/line-type-ops'
import { countStitchHolesByShape } from '../ops/stitch-hole-ops'
import { buildPrintPlan, type PrintPaper } from '../preview/print-preview'
import type { TemplateRepositoryEntry } from '../templates/template-repository'
import { lineTypeStrokeDasharray } from '../cad/line-types'
import type {
  AvatarSpec,
  FoldLine,
  HardwareMarker,
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
  SeamConnection,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  ThreePreviewSettings,
  TextureSource,
  TracingOverlay,
} from '../cad/cad-types'
import type {
  AnnotationLabel,
  EditorSnapshot,
  ExportRoleFilters,
  LegendMode,
  PiecePlacementGuide,
  ResolvedThemeMode,
  SeamGuide,
  SketchWorkspaceMode,
} from '../editor-types'
import {
  DEFAULT_FRONT_LAYER_COLOR,
  FOLD_COLOR_DARK,
  FOLD_COLOR_LIGHT,
  STITCH_COLOR_DARK,
  STITCH_COLOR_LIGHT,
} from '../editor-constants'
import { buildDocSnapshotSignature, interpolateHexColor } from '../editor-utils'
import type { HistoryState } from '../ops/history-ops'
import { deepClone } from '../ops/history-ops'
import { buildLinkedProjectionShapes } from '../ops/sketch-link-ops'
import {
  buildPatternPieceSeamPath,
  buildPieceDerivedGrainline,
  buildPieceDerivedLabels,
  buildPieceDerivedPlacementGuides,
  buildPieceDerivedNotches,
  getPatternPieceChain,
  resolvePatternPieceChains,
} from '../ops/pattern-piece-ops'

type UseEditorDerivedStateParams = {
  layers: Layer[]
  activeLayerId: string
  sketchGroups: SketchGroup[]
  activeSketchGroupId: string | null
  lineTypes: LineType[]
  activeLineTypeId: string
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  constraints: ParametricConstraint[]
  patternPieces: PatternPiece[]
  pieceGrainlines: PieceGrainline[]
  pieceLabels: PieceLabel[]
  piecePlacementLabels: PiecePlacementLabel[]
  piecePlacements3d: PiecePlacement3D[]
  seamConnections: SeamConnection[]
  seamAllowances: PieceSeamAllowance[]
  pieceNotches: PieceNotch[]
  hardwareMarkers: HardwareMarker[]
  snapSettings: SnapSettings
  showAnnotations: boolean
  tracingOverlays: TracingOverlay[]
  projectMemo: string
  stitchAlwaysShapeIds: string[]
  stitchThreadColor: string
  threePreviewSettings: ThreePreviewSettings
  avatars: AvatarSpec[]
  threeTextureSource: TextureSource | null
  threeTextureShapeIds: string[]
  showCanvasRuler: boolean
  showDimensions: boolean
  activeTracingOverlayId: string | null
  selectedShapeIds: string[]
  selectedStitchHoleId: string | null
  selectedHardwareMarkerId: string | null
  templateRepository: TemplateRepositoryEntry[]
  selectedTemplateEntryId: string | null
  historyState: HistoryState<EditorSnapshot>
  opHistory?: { past: unknown[]; future: unknown[] }
  printSelectedOnly: boolean
  printPaper: PrintPaper
  printMarginMm: number
  printOverlapMm: number
  printTileX: number
  printTileY: number
  printScalePercent: number
  exportRoleFilters: ExportRoleFilters
  frontLayerColor: string
  backLayerColor: string
  layerColorOverrides: Record<string, string>
  legendMode: LegendMode
  sketchWorkspaceMode: SketchWorkspaceMode
  themeMode: ResolvedThemeMode
}

export function useEditorDerivedState(params: UseEditorDerivedStateParams) {
  const {
    layers,
    activeLayerId,
    sketchGroups,
    activeSketchGroupId,
    lineTypes,
    activeLineTypeId,
    shapes,
    foldLines,
    stitchHoles,
    constraints,
    patternPieces,
    pieceGrainlines,
    pieceLabels,
    piecePlacementLabels,
    piecePlacements3d,
    seamConnections,
    seamAllowances,
    pieceNotches,
    hardwareMarkers,
    snapSettings,
    showAnnotations,
    tracingOverlays,
    projectMemo,
    stitchAlwaysShapeIds,
    stitchThreadColor,
    threePreviewSettings,
    avatars,
    threeTextureSource,
    threeTextureShapeIds,
    showCanvasRuler,
    showDimensions,
    activeTracingOverlayId,
    selectedShapeIds,
    selectedStitchHoleId,
    selectedHardwareMarkerId,
    templateRepository,
    selectedTemplateEntryId,
    historyState,
    printSelectedOnly,
    printPaper,
    printMarginMm,
    printOverlapMm,
    printTileX,
    printTileY,
    printScalePercent,
    exportRoleFilters,
    frontLayerColor,
    backLayerColor,
    layerColorOverrides,
    legendMode,
    sketchWorkspaceMode,
    themeMode,
  } = params

  const activeLayer = useMemo(() => layers.find((layer) => layer.id === activeLayerId) ?? layers[0] ?? null, [layers, activeLayerId])
  const sketchGroupsById = useMemo(
    () => Object.fromEntries(sketchGroups.map((group) => [group.id, group])),
    [sketchGroups],
  )
  const activeSketchGroup = useMemo(
    () => (activeSketchGroupId ? sketchGroups.find((group) => group.id === activeSketchGroupId) ?? null : null),
    [sketchGroups, activeSketchGroupId],
  )
  const activeLineType = useMemo(
    () => lineTypes.find((lineType) => lineType.id === activeLineTypeId) ?? lineTypes[0] ?? null,
    [lineTypes, activeLineTypeId],
  )
  const lineTypesById = useMemo(
    () => Object.fromEntries(lineTypes.map((lineType) => [lineType.id, lineType])),
    [lineTypes],
  )
  const shapesById = useMemo(
    () => Object.fromEntries(shapes.map((shape) => [shape.id, shape])),
    [shapes],
  )
  const patternPieceChains = useMemo(
    () => resolvePatternPieceChains(shapes, lineTypes),
    [shapes, lineTypes],
  )
  const patternPiecesById = useMemo(
    () => Object.fromEntries(patternPieces.map((piece) => [piece.id, piece])),
    [patternPieces],
  )
  const patternPieceByBoundaryShapeId = useMemo(
    () => Object.fromEntries(patternPieces.map((piece) => [piece.boundaryShapeId, piece])),
    [patternPieces],
  )
  const selectedShapeIdSet = useMemo(() => new Set(selectedShapeIds), [selectedShapeIds])
  const shapeCountsByLineType = useMemo(() => countShapesByLineType(shapes), [shapes])
  const stitchHoleCountsByShape = useMemo(() => countStitchHolesByShape(stitchHoles), [stitchHoles])
  const selectedShapeCount = selectedShapeIds.length
  const selectedStitchHoleCount = useMemo(
    () => selectedShapeIds.reduce((sum, shapeId) => sum + (stitchHoleCountsByShape[shapeId] ?? 0), 0),
    [selectedShapeIds, stitchHoleCountsByShape],
  )
  const selectedStitchHole = useMemo(
    () => stitchHoles.find((stitchHole) => stitchHole.id === selectedStitchHoleId) ?? null,
    [stitchHoles, selectedStitchHoleId],
  )
  const selectedHardwareMarker = useMemo(
    () => hardwareMarkers.find((marker) => marker.id === selectedHardwareMarkerId) ?? null,
    [hardwareMarkers, selectedHardwareMarkerId],
  )
  const activeTracingOverlay = useMemo(
    () => tracingOverlays.find((overlay) => overlay.id === activeTracingOverlayId) ?? null,
    [tracingOverlays, activeTracingOverlayId],
  )
  const selectedTemplateEntry = useMemo(
    () => templateRepository.find((entry) => entry.id === selectedTemplateEntryId) ?? null,
    [templateRepository, selectedTemplateEntryId],
  )
  const stitchAlwaysShapeIdSet = useMemo(() => new Set(stitchAlwaysShapeIds), [stitchAlwaysShapeIds])
  const canUndo = (params.opHistory?.past.length ?? 0) > 0 || historyState.past.length > 0
  const canRedo = (params.opHistory?.future.length ?? 0) > 0 || historyState.future.length > 0

  const visibleLayerIdSet = useMemo(() => new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id)), [layers])
  const visibleLineTypeIdSet = useMemo(
    () => new Set(lineTypes.filter((lineType) => lineType.visible).map((lineType) => lineType.id)),
    [lineTypes],
  )

  const visibleShapes = useMemo(() => {
    return shapes.filter((shape) => {
      if (!visibleLayerIdSet.has(shape.layerId) || !visibleLineTypeIdSet.has(shape.lineTypeId)) {
        return false
      }
      if (!shape.groupId) {
        return true
      }
      const group = sketchGroupsById[shape.groupId]
      return group ? group.visible : true
    })
  }, [shapes, visibleLayerIdSet, visibleLineTypeIdSet, sketchGroupsById])

  const linkedProjectionShapes = useMemo(
    () => buildLinkedProjectionShapes(shapes, sketchGroups),
    [shapes, sketchGroups],
  )

  const visibleLinkedProjectionShapes = useMemo(
    () =>
      linkedProjectionShapes.filter((shape) => {
        if (!visibleLayerIdSet.has(shape.layerId) || !visibleLineTypeIdSet.has(shape.lineTypeId)) {
          return false
        }
        if (!shape.groupId) {
          return true
        }
        const group = sketchGroupsById[shape.groupId]
        return group ? group.visible : false
      }),
    [linkedProjectionShapes, visibleLayerIdSet, visibleLineTypeIdSet, sketchGroupsById],
  )

  const assemblyShapes = useMemo(
    () => [...visibleShapes, ...visibleLinkedProjectionShapes],
    [visibleShapes, visibleLinkedProjectionShapes],
  )

  const workspaceEditableShapes = useMemo(() => {
    if (sketchWorkspaceMode === 'assembly') {
      return visibleShapes
    }

    if (!activeLayer) {
      return []
    }

    if (activeSketchGroup) {
      return visibleShapes.filter(
        (shape) =>
          shape.layerId === activeLayer.id &&
          (shape.groupId === activeSketchGroup.id || shape.groupId === undefined),
      )
    }

    return visibleShapes.filter((shape) => shape.layerId === activeLayer.id)
  }, [sketchWorkspaceMode, visibleShapes, activeLayer, activeSketchGroup])

  const workspaceLinkedShapes = useMemo(() => {
    if (sketchWorkspaceMode === 'assembly') {
      return visibleLinkedProjectionShapes
    }

    if (!activeSketchGroup) {
      return []
    }

    return visibleLinkedProjectionShapes.filter((shape) => shape.groupId === activeSketchGroup.id)
  }, [sketchWorkspaceMode, visibleLinkedProjectionShapes, activeSketchGroup])

  const workspaceShapes = useMemo(
    () => [...workspaceEditableShapes, ...workspaceLinkedShapes],
    [workspaceEditableShapes, workspaceLinkedShapes],
  )

  const visibleShapeIdSet = useMemo(() => new Set(visibleShapes.map((shape) => shape.id)), [visibleShapes])
  const workspaceEditableShapeIdSet = useMemo(
    () => new Set(workspaceEditableShapes.map((shape) => shape.id)),
    [workspaceEditableShapes],
  )

  const visibleStitchHoles = useMemo(
    () =>
      stitchHoles.filter((stitchHole) => {
        const shape = shapesById[stitchHole.shapeId]
        if (!shape || !visibleShapeIdSet.has(shape.id)) {
          return false
        }
        const lineTypeRole = lineTypesById[shape.lineTypeId]?.role ?? 'cut'
        return lineTypeRole === 'stitch' || stitchAlwaysShapeIdSet.has(shape.id)
      }),
    [stitchHoles, shapesById, visibleShapeIdSet, lineTypesById, stitchAlwaysShapeIdSet],
  )

  const visibleHardwareMarkers = useMemo(
    () =>
      hardwareMarkers.filter((marker) => {
        if (!marker.visible || !visibleLayerIdSet.has(marker.layerId)) {
          return false
        }
        if (!marker.groupId) {
          return true
        }
        const group = sketchGroupsById[marker.groupId]
        return group ? group.visible : true
      }),
    [hardwareMarkers, visibleLayerIdSet, sketchGroupsById],
  )

  const workspaceStitchHoles = useMemo(
    () =>
      visibleStitchHoles.filter((stitchHole) => workspaceEditableShapeIdSet.has(stitchHole.shapeId)),
    [visibleStitchHoles, workspaceEditableShapeIdSet],
  )

  const workspaceHardwareMarkers = useMemo(() => {
    if (sketchWorkspaceMode === 'assembly') {
      return visibleHardwareMarkers
    }

    if (!activeLayer) {
      return []
    }

    if (activeSketchGroup) {
      return visibleHardwareMarkers.filter(
        (marker) =>
          marker.layerId === activeLayer.id &&
          (marker.groupId === activeSketchGroup.id || marker.groupId === undefined),
      )
    }

    return visibleHardwareMarkers.filter((marker) => marker.layerId === activeLayer.id)
  }, [sketchWorkspaceMode, visibleHardwareMarkers, activeLayer, activeSketchGroup])

  const seamGuides = useMemo<SeamGuide[]>(
    () =>
      seamAllowances
        .map((entry) => {
          const piece = patternPiecesById[entry.pieceId]
          if (!piece || !visibleLayerIdSet.has(piece.layerId)) {
            return null
          }
          const chain = getPatternPieceChain(piece, patternPieceChains.byShapeId)
          if (!chain || !chain.shapeIds.some((shapeId) => visibleShapeIdSet.has(shapeId))) {
            return null
          }
          const d = buildPatternPieceSeamPath(chain, entry)
          if (!d) {
            return null
          }
          const boundaryShape = shapesById[piece.boundaryShapeId]
          if (!boundaryShape) {
            return null
          }
          return {
            id: entry.id,
            shapeId: piece.boundaryShapeId,
            d,
            labelPoint: getShapeAnchorPoint(boundaryShape, 'center'),
            offsetMm: entry.defaultOffsetMm,
          }
        })
        .filter((entry): entry is SeamGuide => entry !== null),
    [seamAllowances, patternPiecesById, visibleLayerIdSet, patternPieceChains.byShapeId, visibleShapeIdSet, shapesById],
  )

  const annotationLabels = useMemo<AnnotationLabel[]>(() => {
    if (!showAnnotations) {
      return []
    }

    const labels: AnnotationLabel[] = []
    for (const layer of layers) {
      if (!layer.visible || !layer.annotation || layer.annotation.trim().length === 0) {
        continue
      }
      const onLayer = workspaceShapes.filter((shape) => shape.layerId === layer.id)
      const bounds = computeBoundsFromShapes(onLayer)
      if (!bounds) {
        continue
      }
      labels.push({
        id: `layer-${layer.id}`,
        text: layer.annotation.trim(),
        point: { x: bounds.minX + 6, y: bounds.minY - 8 },
      })
    }

    for (const group of sketchGroups) {
      if (!group.visible || !group.annotation || group.annotation.trim().length === 0) {
        continue
      }
      const onGroup = workspaceShapes.filter((shape) => shape.groupId === group.id)
      const bounds = computeBoundsFromShapes(onGroup)
      if (!bounds) {
        continue
      }
      labels.push({
        id: `group-${group.id}`,
        text: group.annotation.trim(),
        point: { x: bounds.minX + 6, y: bounds.minY - 8 },
      })
    }

    for (const marker of workspaceHardwareMarkers) {
      if (!marker.notes || marker.notes.trim().length === 0) {
        continue
      }
      labels.push({
        id: `hardware-${marker.id}`,
        text: marker.notes.trim(),
        point: { x: marker.point.x + 7, y: marker.point.y - 7 },
        kind: 'generic',
      })
    }

    for (const piece of patternPieces) {
      if (!visibleLayerIdSet.has(piece.layerId)) {
        continue
      }
      const chain = getPatternPieceChain(piece, patternPieceChains.byShapeId)
      if (!chain || !chain.shapeIds.some((shapeId) => visibleShapeIdSet.has(shapeId))) {
        continue
      }
      labels.push(
        ...buildPieceDerivedLabels(piece, pieceLabels, chain).map((label) => ({
          id: label.id,
          text: label.text,
          point: label.point,
          pieceId: piece.id,
          rotationDeg: label.rotationDeg,
          fontSizeMm: label.fontSizeMm,
          kind: label.kind,
        })),
      )
    }

    return labels
  }, [
    showAnnotations,
    layers,
    sketchGroups,
    workspaceShapes,
    workspaceHardwareMarkers,
    patternPieces,
    pieceLabels,
    visibleLayerIdSet,
    visibleShapeIdSet,
    patternPieceChains.byShapeId,
  ])

  const pieceGrainlineSegments = useMemo(
    () =>
      showAnnotations
        ? patternPieces
            .map((piece) => {
              if (!visibleLayerIdSet.has(piece.layerId)) {
                return null
              }
              const chain = getPatternPieceChain(piece, patternPieceChains.byShapeId)
              if (!chain || !chain.shapeIds.some((shapeId) => visibleShapeIdSet.has(shapeId))) {
                return null
              }
              return buildPieceDerivedGrainline(
                piece,
                pieceGrainlines.find((entry) => entry.pieceId === piece.id),
                chain,
              )
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        : [],
    [showAnnotations, patternPieces, visibleLayerIdSet, patternPieceChains.byShapeId, visibleShapeIdSet, pieceGrainlines],
  )

  const pieceNotchLines = useMemo(
    () =>
      showAnnotations
        ? patternPieces.flatMap((piece) => {
            if (!visibleLayerIdSet.has(piece.layerId)) {
              return []
            }
            const chain = getPatternPieceChain(piece, patternPieceChains.byShapeId)
            if (!chain || !chain.shapeIds.some((shapeId) => visibleShapeIdSet.has(shapeId))) {
              return []
            }
            return buildPieceDerivedNotches(
              piece,
              pieceNotches,
              chain,
              seamAllowances.find((entry) => entry.pieceId === piece.id),
            )
          })
        : [],
    [showAnnotations, patternPieces, visibleLayerIdSet, patternPieceChains.byShapeId, visibleShapeIdSet, pieceNotches, seamAllowances],
  )

  const piecePlacementGuides = useMemo<PiecePlacementGuide[]>(
    () =>
      showAnnotations
        ? patternPieces.flatMap((piece) => {
            if (!visibleLayerIdSet.has(piece.layerId)) {
              return []
            }
            const chain = getPatternPieceChain(piece, patternPieceChains.byShapeId)
            if (!chain || !chain.shapeIds.some((shapeId) => visibleShapeIdSet.has(shapeId))) {
              return []
            }
            return buildPieceDerivedPlacementGuides(
              piece,
              piecePlacementLabels,
              chain,
              seamAllowances.find((entry) => entry.pieceId === piece.id),
            )
          })
        : [],
    [showAnnotations, patternPieces, visibleLayerIdSet, patternPieceChains.byShapeId, visibleShapeIdSet, piecePlacementLabels, seamAllowances],
  )

  const lineTypeStylesById = useMemo(
    () =>
      Object.fromEntries(
        lineTypes.map((lineType) => [lineType.id, lineType.style] as const),
      ),
    [lineTypes],
  )

  const printableShapes = useMemo(() => {
    if (!printSelectedOnly) {
      return assemblyShapes
    }
    return assemblyShapes.filter((shape) => selectedShapeIdSet.has(shape.id))
  }, [printSelectedOnly, assemblyShapes, selectedShapeIdSet])

  const printPlan = useMemo(
    () =>
      buildPrintPlan(printableShapes, {
        paper: printPaper,
        marginMm: printMarginMm,
        overlapMm: printOverlapMm,
        tileX: printTileX,
        tileY: printTileY,
        scalePercent: printScalePercent,
      }),
    [printableShapes, printPaper, printMarginMm, printOverlapMm, printTileX, printTileY, printScalePercent],
  )

  const activeExportRoleCount = useMemo(
    () => Object.values(exportRoleFilters).filter((value) => value).length,
    [exportRoleFilters],
  )

  const layerColorsById = useMemo(() => {
    const colorMap: Record<string, string> = {}
    const denominator = Math.max(layers.length - 1, 1)

    for (const [index, layer] of layers.entries()) {
      const continuumColor = interpolateHexColor(frontLayerColor, backLayerColor, index / denominator)
      colorMap[layer.id] = layerColorOverrides[layer.id] ?? continuumColor
    }

    return colorMap
  }, [layers, frontLayerColor, backLayerColor, layerColorOverrides])

  const layerStackLevels = useMemo(() => {
    const stackMap: Record<string, number> = {}
    for (const [index, layer] of layers.entries()) {
      stackMap[layer.id] =
        typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel)
          ? Math.max(0, Math.round(layer.stackLevel))
          : index
    }
    return stackMap
  }, [layers])

  const stackColorsByLevel = useMemo(() => {
    const uniqueStackLevels = Array.from(new Set(layers.map((layer) => layerStackLevels[layer.id] ?? 0))).sort(
      (left, right) => left - right,
    )
    const denominator = Math.max(uniqueStackLevels.length - 1, 1)
    const colorMap: Record<number, string> = {}

    uniqueStackLevels.forEach((stackLevel, index) => {
      colorMap[stackLevel] = interpolateHexColor(frontLayerColor, backLayerColor, index / denominator)
    })

    return colorMap
  }, [layers, layerStackLevels, frontLayerColor, backLayerColor])

  const stackColorsByLayerId = useMemo(() => {
    const colorMap: Record<string, string> = {}
    for (const [index, layer] of layers.entries()) {
      const stackLevel = layerStackLevels[layer.id] ?? index
      colorMap[layer.id] = stackColorsByLevel[stackLevel] ?? DEFAULT_FRONT_LAYER_COLOR
    }
    return colorMap
  }, [layers, layerStackLevels, stackColorsByLevel])

  const stackLegendEntries = useMemo(() => {
    const grouped = new Map<number, { layerNames: string[]; layerColors: string[] }>()
    for (const layer of layers) {
      const stackLevel = layerStackLevels[layer.id] ?? 0
      const entry = grouped.get(stackLevel) ?? { layerNames: [], layerColors: [] }
      entry.layerNames.push(layer.name)
      entry.layerColors.push(layerColorsById[layer.id] ?? stackColorsByLevel[stackLevel] ?? DEFAULT_FRONT_LAYER_COLOR)
      grouped.set(stackLevel, entry)
    }

    return Array.from(grouped.entries())
      .map(([stackLevel, entry]) => {
        const uniqueColors = Array.from(new Set(entry.layerColors))
        return {
          stackLevel,
          layerNames: entry.layerNames,
          swatchBackground:
            uniqueColors.length > 1
              ? `linear-gradient(90deg, ${uniqueColors.join(', ')})`
              : uniqueColors[0] ?? DEFAULT_FRONT_LAYER_COLOR,
        }
      })
      .sort((left, right) => left.stackLevel - right.stackLevel)
  }, [layers, layerStackLevels, layerColorsById, stackColorsByLevel])

  const displayLayerColorsById = legendMode === 'stack' ? stackColorsByLayerId : layerColorsById
  const activeLayerColor = activeLayer
    ? displayLayerColorsById[activeLayer.id] ?? DEFAULT_FRONT_LAYER_COLOR
    : DEFAULT_FRONT_LAYER_COLOR

  const fallbackLayerStroke = themeMode === 'light' ? '#0f172a' : '#e2e8f0'
  const cutStrokeColor = lineTypes.find((lineType) => lineType.role === 'cut')?.color ?? fallbackLayerStroke
  const stitchStrokeColor = themeMode === 'light' ? STITCH_COLOR_LIGHT : STITCH_COLOR_DARK
  const foldStrokeColor = themeMode === 'light' ? FOLD_COLOR_LIGHT : FOLD_COLOR_DARK
  const activeLineTypeStrokeColor = activeLineType?.color ?? activeLayerColor
  const activeLineTypeDasharray = lineTypeStrokeDasharray(activeLineType?.style ?? 'solid')

  const currentSnapshot = useMemo<EditorSnapshot>(
    () => ({
      layers: deepClone(layers),
      activeLayerId,
      sketchGroups: deepClone(sketchGroups),
      activeSketchGroupId,
      lineTypes: deepClone(lineTypes),
      activeLineTypeId,
      shapes: deepClone(shapes),
      foldLines: deepClone(foldLines),
      stitchHoles: deepClone(stitchHoles),
      constraints: deepClone(constraints),
      patternPieces: deepClone(patternPieces),
      pieceGrainlines: deepClone(pieceGrainlines),
      pieceLabels: deepClone(pieceLabels),
      piecePlacementLabels: deepClone(piecePlacementLabels),
      piecePlacements3d: deepClone(piecePlacements3d),
      seamConnections: deepClone(seamConnections),
      seamAllowances: deepClone(seamAllowances),
      pieceNotches: deepClone(pieceNotches),
      hardwareMarkers: deepClone(hardwareMarkers),
      snapSettings: deepClone(snapSettings),
      showAnnotations,
      tracingOverlays: deepClone(tracingOverlays),
      projectMemo,
      stitchAlwaysShapeIds: deepClone(stitchAlwaysShapeIds),
      stitchThreadColor,
      threePreviewSettings: deepClone(threePreviewSettings),
      avatars: deepClone(avatars),
      threeTextureSource: deepClone(threeTextureSource),
      threeTextureShapeIds: deepClone(threeTextureShapeIds),
      showCanvasRuler,
      showDimensions,
      layerColorOverrides: deepClone(layerColorOverrides),
      frontLayerColor,
      backLayerColor,
    }),
    [
      layers,
      activeLayerId,
      sketchGroups,
      activeSketchGroupId,
      lineTypes,
      activeLineTypeId,
      shapes,
      foldLines,
      stitchHoles,
      constraints,
      patternPieces,
      pieceGrainlines,
      pieceLabels,
      piecePlacementLabels,
      piecePlacements3d,
      seamConnections,
      seamAllowances,
      pieceNotches,
      hardwareMarkers,
      snapSettings,
      showAnnotations,
      tracingOverlays,
      projectMemo,
      stitchAlwaysShapeIds,
      stitchThreadColor,
      threePreviewSettings,
      avatars,
      threeTextureSource,
      threeTextureShapeIds,
      showCanvasRuler,
      showDimensions,
      layerColorOverrides,
      frontLayerColor,
      backLayerColor,
    ],
  )

  const currentSnapshotSignature = useMemo(
    () => buildDocSnapshotSignature(currentSnapshot),
    [currentSnapshot],
  )

  return {
    activeLayer,
    sketchGroupsById,
    activeSketchGroup,
    activeLineType,
    lineTypesById,
    shapesById,
    patternPiecesById,
    patternPieceByBoundaryShapeId,
    patternPieceChains,
    selectedShapeIdSet,
    shapeCountsByLineType,
    stitchHoleCountsByShape,
    selectedShapeCount,
    selectedStitchHoleCount,
    selectedStitchHole,
    selectedHardwareMarker,
    activeTracingOverlay,
    selectedTemplateEntry,
    canUndo,
    canRedo,
    assemblyShapes,
    visibleShapes,
    visibleLinkedProjectionShapes,
    visibleShapeIdSet,
    visibleStitchHoles,
    visibleLayerIdSet,
    visibleHardwareMarkers,
    workspaceShapes,
    workspaceEditableShapes,
    workspaceLinkedShapes,
    workspaceStitchHoles,
    workspaceHardwareMarkers,
    seamGuides,
    annotationLabels,
    pieceGrainlineSegments,
    pieceNotchLines,
    piecePlacementGuides,
    lineTypeStylesById,
    printableShapes,
    printPlan,
    activeExportRoleCount,
    layerColorsById,
    layerStackLevels,
    stackColorsByLevel,
    stackColorsByLayerId,
    stackLegendEntries,
    displayLayerColorsById,
    activeLayerColor,
    fallbackLayerStroke,
    cutStrokeColor,
    stitchStrokeColor,
    foldStrokeColor,
    activeLineTypeStrokeColor,
    activeLineTypeDasharray,
    currentSnapshot,
    currentSnapshotSignature,
  }
}
