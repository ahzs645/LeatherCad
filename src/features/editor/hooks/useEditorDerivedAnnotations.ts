import { useMemo } from 'react'
import type {
  HardwareMarker,
  Layer,
  PatternPiece,
  PieceGrainline,
  PieceLabel,
  PieceNotch,
  PiecePlacementLabel,
  PieceSeamAllowance,
  Shape,
  SketchGroup,
} from '../cad/cad-types'
import type { AnnotationLabel, PiecePlacementGuide, SeamGuide } from '../editor-types'
import type { OutlineChain } from '../ops/outline-detection'
import { computeBoundsFromShapes, getShapeAnchorPoint } from '../ops/pattern-ops'
import {
  buildPatternPieceSeamPath,
  buildPieceDerivedGrainline,
  buildPieceDerivedLabels,
  buildPieceDerivedNotches,
  buildPieceDerivedPlacementGuides,
  getPatternPieceChain,
  type PieceDerivedGrainline,
  type PieceDerivedNotchLine,
} from '../ops/pattern-piece-ops'

type PatternPieceChains = {
  byShapeId: Map<string, OutlineChain>
}

type UseEditorDerivedAnnotationsParams = {
  showAnnotations: boolean
  layers: Layer[]
  sketchGroups: SketchGroup[]
  workspaceShapes: Shape[]
  workspaceHardwareMarkers: HardwareMarker[]
  patternPieces: PatternPiece[]
  pieceGrainlines: PieceGrainline[]
  pieceLabels: PieceLabel[]
  piecePlacementLabels: PiecePlacementLabel[]
  pieceNotches: PieceNotch[]
  seamAllowances: PieceSeamAllowance[]
  patternPiecesById: Record<string, PatternPiece>
  patternPieceChains: PatternPieceChains
  visibleLayerIdSet: Set<string>
  visibleShapeIdSet: Set<string>
  shapesById: Record<string, Shape>
}

type UseEditorDerivedAnnotationsResult = {
  seamGuides: SeamGuide[]
  annotationLabels: AnnotationLabel[]
  pieceGrainlineSegments: PieceDerivedGrainline[]
  pieceNotchLines: PieceDerivedNotchLine[]
  piecePlacementGuides: PiecePlacementGuide[]
}

export function useEditorDerivedAnnotations(
  params: UseEditorDerivedAnnotationsParams,
): UseEditorDerivedAnnotationsResult {
  const {
    showAnnotations,
    layers,
    sketchGroups,
    workspaceShapes,
    workspaceHardwareMarkers,
    patternPieces,
    pieceGrainlines,
    pieceLabels,
    piecePlacementLabels,
    pieceNotches,
    seamAllowances,
    patternPiecesById,
    patternPieceChains,
    visibleLayerIdSet,
    visibleShapeIdSet,
    shapesById,
  } = params

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
            .filter((entry): entry is PieceDerivedGrainline => entry !== null)
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

  return {
    seamGuides,
    annotationLabels,
    pieceGrainlineSegments,
    pieceNotchLines,
    piecePlacementGuides,
  }
}
