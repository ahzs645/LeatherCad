import { useMemo } from 'react'
import type { PatternPiece, PiecePlacementLabel, Shape } from '../../cad/cad-types'
import { clamp, getBounds } from '../../cad/cad-geometry'
import {
  getPatternPieceChain,
} from '../../ops/pattern-piece-ops'

type UsePatternPieceSelectionParams = {
  isPieceInspectorOpen: boolean
  tool: string
  selectedShapeIds: string[]
  shapesById: Record<string, Shape | undefined>
  shapes: Shape[]
  patternPieces: PatternPiece[]
  patternPiecesById: Record<string, PatternPiece | undefined>
  patternPieceByBoundaryShapeId: Record<string, PatternPiece | undefined>
  patternPieceChains: {
    byShapeId: Map<string, import('../../ops/outline-detection').OutlineChain>
  }
  pieceGrainlines: import('../../cad/cad-types').PieceGrainline[]
  pieceLabels: import('../../cad/cad-types').PieceLabel[]
  seamAllowances: import('../../cad/cad-types').PieceSeamAllowance[]
  seamConnections: import('../../cad/cad-types').SeamConnection[]
  pieceNotches: import('../../cad/cad-types').PieceNotch[]
  piecePlacementLabels: import('../../cad/cad-types').PiecePlacementLabel[]
  visibleLayerIdSet: Set<string>
}

export function usePatternPieceSelection({
  isPieceInspectorOpen,
  tool,
  selectedShapeIds,
  shapesById,
  shapes,
  patternPieces,
  patternPiecesById,
  patternPieceByBoundaryShapeId,
  patternPieceChains,
  pieceGrainlines,
  pieceLabels,
  seamAllowances,
  seamConnections,
  pieceNotches,
  piecePlacementLabels,
  visibleLayerIdSet,
}: UsePatternPieceSelectionParams) {
  const selectedShapes = useMemo(
    () => selectedShapeIds.map((shapeId) => shapesById[shapeId]).filter((shape): shape is Shape => shape !== undefined),
    [selectedShapeIds, shapesById],
  )

  const selectionBounds = useMemo(() => {
    if (selectedShapes.length === 0) return null
    const bounds = getBounds(selectedShapes)
    return { width: bounds.width - 200, height: bounds.height - 200 }
  }, [selectedShapes])

  const selectedPatternPiece = useMemo(() => {
    if (selectedShapeIds.length !== 1) {
      return null
    }
    const selectedShapeId = selectedShapeIds[0]
    return (
      patternPieces.find(
        (piece) => piece.boundaryShapeId === selectedShapeId || piece.internalShapeIds.includes(selectedShapeId),
      ) ?? null
    )
  }, [selectedShapeIds, patternPieces])

  const selectedPieceGrainline = useMemo(
    () => (selectedPatternPiece ? pieceGrainlines.find((entry) => entry.pieceId === selectedPatternPiece.id) ?? null : null),
    [selectedPatternPiece, pieceGrainlines],
  )

  const selectedPieceLabel = useMemo(
    () =>
      selectedPatternPiece
        ? pieceLabels.find((entry) => entry.pieceId === selectedPatternPiece.id && entry.kind === 'piece') ?? null
        : null,
    [selectedPatternPiece, pieceLabels],
  )

  const selectedPatternLabel = useMemo(
    () =>
      selectedPatternPiece
        ? pieceLabels.find((entry) => entry.pieceId === selectedPatternPiece.id && entry.kind === 'pattern') ?? null
        : null,
    [selectedPatternPiece, pieceLabels],
  )

  const selectedPieceSeamAllowance = useMemo(
    () => (selectedPatternPiece ? seamAllowances.find((entry) => entry.pieceId === selectedPatternPiece.id) ?? null : null),
    [selectedPatternPiece, seamAllowances],
  )

  const selectedPieceSeamConnections = useMemo(
    () =>
      selectedPatternPiece
        ? seamConnections
            .filter(
              (connection) =>
                connection.from.pieceId === selectedPatternPiece.id || connection.to.pieceId === selectedPatternPiece.id,
            )
            .map((connection) => {
              const counterpartId =
                connection.from.pieceId === selectedPatternPiece.id ? connection.to.pieceId : connection.from.pieceId
              return {
                connection,
                counterpartPieceName: patternPiecesById[counterpartId]?.name ?? 'Unknown piece',
              }
            })
        : [],
    [selectedPatternPiece, seamConnections, patternPiecesById],
  )

  const selectedPieceNotches = useMemo(
    () => (selectedPatternPiece ? pieceNotches.filter((entry) => entry.pieceId === selectedPatternPiece.id) : []),
    [selectedPatternPiece, pieceNotches],
  )

  const selectedPiecePlacementLabels = useMemo(
    () => (selectedPatternPiece ? piecePlacementLabels.filter((entry) => entry.pieceId === selectedPatternPiece.id) : []),
    [selectedPatternPiece, piecePlacementLabels],
  )

  const selectedPieceInternalShapeIdSet = useMemo(
    () => new Set(selectedPatternPiece?.internalShapeIds ?? []),
    [selectedPatternPiece],
  )

  const selectedPatternPieceEdgeCount = useMemo(() => {
    if (!selectedPatternPiece) {
      return 0
    }
    const chain = getPatternPieceChain(selectedPatternPiece, patternPieceChains.byShapeId)
    return chain ? Math.max(0, chain.polygon.length - 1) : 0
  }, [selectedPatternPiece, patternPieceChains.byShapeId])

  const pieceEdgeLabels = useMemo(() => {
    if (!(tool === 'seam' || isPieceInspectorOpen)) {
      return []
    }

    return patternPieces
      .filter((piece) => visibleLayerIdSet.has(piece.layerId))
      .flatMap((piece) => {
        const chain = getPatternPieceChain(piece, patternPieceChains.byShapeId)
        if (!chain) {
          return []
        }
        return chain.polygon.slice(0, -1).map((point, index) => {
          const next = chain.polygon[index + 1]
          return {
            id: `${piece.id}-edge-${index}`,
            x: (point.x + next.x) / 2,
            y: (point.y + next.y) / 2,
            label: `${index + 1}`,
            active: piece.id === selectedPatternPiece?.id,
          }
        })
      })
  }, [tool, isPieceInspectorOpen, patternPieces, visibleLayerIdSet, patternPieceChains.byShapeId, selectedPatternPiece])

  const selectedPieceAvailableInternalShapes = useMemo(() => {
    if (!selectedPatternPiece) {
      return []
    }
    const otherBoundaryShapeIdSet = new Set(
      patternPieces
        .filter((piece) => piece.id !== selectedPatternPiece.id)
        .map((piece) => piece.boundaryShapeId),
    )
    return shapes.filter(
      (shape) =>
        shape.layerId === selectedPatternPiece.layerId &&
        shape.id !== selectedPatternPiece.boundaryShapeId &&
        !otherBoundaryShapeIdSet.has(shape.id),
    )
  }, [selectedPatternPiece, patternPieces, shapes])

  const sanitizePlacementLabelPatch = (
    patch: Partial<PiecePlacementLabel>,
    edgeCount: number,
    current: PiecePlacementLabel,
  ) => ({
    ...current,
    ...patch,
    edgeIndex:
      typeof patch.edgeIndex === 'number'
        ? Math.max(0, Math.min(Math.max(0, edgeCount - 1), Math.round(patch.edgeIndex)))
        : current.edgeIndex,
    t: typeof patch.t === 'number' ? clamp(patch.t, 0, 1) : current.t,
    widthMm: typeof patch.widthMm === 'number' ? Math.max(0.5, patch.widthMm) : current.widthMm,
    heightMm: typeof patch.heightMm === 'number' ? Math.max(0.5, patch.heightMm) : current.heightMm,
  })

  return {
    selectedShapes,
    selectionBounds,
    selectedPatternPiece,
    selectedPieceGrainline,
    selectedPieceLabel,
    selectedPatternLabel,
    selectedPieceSeamAllowance,
    selectedPieceSeamConnections,
    selectedPieceNotches,
    selectedPiecePlacementLabels,
    selectedPieceInternalShapeIdSet,
    selectedPatternPieceEdgeCount,
    pieceEdgeLabels,
    selectedPieceAvailableInternalShapes,
    patternPieceByBoundaryShapeId,
    sanitizePlacementLabelPatch,
  }
}
