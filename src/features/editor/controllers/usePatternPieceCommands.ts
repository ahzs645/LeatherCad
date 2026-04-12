import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  PatternPiece,
  PieceLabel,
  PiecePlacementLabel,
  PieceSeamAllowance,
  Shape,
} from '../cad/cad-types'
import type { WorkbenchInspectorTab } from '../workbench/workbench-types'
import { clamp } from '../cad/cad-geometry'
import {
  createDefaultPatternPiece,
  createDefaultPieceGrainline,
  createDefaultPieceLabels,
  createDefaultPiecePlacementLabel,
  createDefaultPieceSeamAllowance,
} from '../ops/pattern-piece-ops'

type UsePatternPieceCommandsParams = {
  isMobileLayout: boolean
  selectedShapeIds: string[]
  shapesById: Record<string, Shape | undefined>
  patternPieces: PatternPiece[]
  patternPieceByBoundaryShapeId: Record<string, PatternPiece | undefined>
  patternPieceChainsByShapeId: Map<string, { polygon: import('../cad/cad-types').Point[]; isClosed: boolean }>
  selectedPatternPiece: PatternPiece | null
  selectedPatternPieceEdgeCount: number
  pieceGrainlines: import('../cad/cad-types').PieceGrainline[]
  pieceLabels: import('../cad/cad-types').PieceLabel[]
  seamAllowances: PieceSeamAllowance[]
  setPatternPieces: Dispatch<SetStateAction<PatternPiece[]>>
  setPieceGrainlines: Dispatch<SetStateAction<import('../cad/cad-types').PieceGrainline[]>>
  setPieceLabels: Dispatch<SetStateAction<PieceLabel[]>>
  setSeamAllowances: Dispatch<SetStateAction<PieceSeamAllowance[]>>
  setSeamConnections: Dispatch<SetStateAction<import('../cad/cad-types').SeamConnection[]>>
  setPieceNotches: Dispatch<SetStateAction<import('../cad/cad-types').PieceNotch[]>>
  setPiecePlacementLabels: Dispatch<SetStateAction<PiecePlacementLabel[]>>
  setShowPieceInspectorModal: Dispatch<SetStateAction<boolean>>
  setActiveInspectorTab: (tab: WorkbenchInspectorTab) => void
  setStatus: (status: string) => void
}

export function usePatternPieceCommands({
  isMobileLayout,
  selectedShapeIds,
  shapesById,
  patternPieces,
  patternPieceByBoundaryShapeId,
  patternPieceChainsByShapeId,
  selectedPatternPiece,
  selectedPatternPieceEdgeCount,
  pieceGrainlines,
  pieceLabels,
  seamAllowances,
  setPatternPieces,
  setPieceGrainlines,
  setPieceLabels,
  setSeamAllowances,
  setSeamConnections,
  setPieceNotches,
  setPiecePlacementLabels,
  setShowPieceInspectorModal,
  setActiveInspectorTab,
  setStatus,
}: UsePatternPieceCommandsParams) {
  const ensurePatternPieceSupportRecords = useCallback((piece: PatternPiece) => {
    if (!pieceGrainlines.some((entry) => entry.pieceId === piece.id)) {
      setPieceGrainlines((previous) => [...previous, createDefaultPieceGrainline(piece.id)])
    }
    if (!pieceLabels.some((entry) => entry.pieceId === piece.id && entry.kind === 'piece')) {
      const defaultPieceLabel = createDefaultPieceLabels(piece).find((entry) => entry.kind === 'piece')
      if (defaultPieceLabel) {
        setPieceLabels((previous) => [...previous, defaultPieceLabel])
      }
    }
    if (!pieceLabels.some((entry) => entry.pieceId === piece.id && entry.kind === 'pattern')) {
      const defaultPatternLabel = createDefaultPieceLabels(piece).find((entry) => entry.kind === 'pattern')
      if (defaultPatternLabel) {
        setPieceLabels((previous) => [...previous, defaultPatternLabel])
      }
    }
    if (!seamAllowances.some((entry) => entry.pieceId === piece.id)) {
      setSeamAllowances((previous) => [...previous, createDefaultPieceSeamAllowance(piece.id)])
    }
  }, [pieceGrainlines, pieceLabels, seamAllowances, setPieceGrainlines, setPieceLabels, setSeamAllowances])

  const openSelectedPatternPieceInspector = useCallback(() => {
    if (!selectedPatternPiece) {
      setStatus('Select a pattern piece first')
      return
    }
    ensurePatternPieceSupportRecords(selectedPatternPiece)
    if (isMobileLayout) {
      setShowPieceInspectorModal(true)
    } else {
      setActiveInspectorTab('piece')
    }
  }, [ensurePatternPieceSupportRecords, isMobileLayout, selectedPatternPiece, setActiveInspectorTab, setShowPieceInspectorModal, setStatus])

  const handleCreatePatternPieceFromSelection = useCallback(() => {
    if (selectedShapeIds.length !== 1) {
      setStatus('Select exactly one closed outline to create a pattern piece')
      return
    }
    const boundaryShapeId = selectedShapeIds[0]
    const boundaryShape = shapesById[boundaryShapeId]
    if (!boundaryShape) {
      setStatus('Selected outline could not be resolved')
      return
    }
    const existingPiece = patternPieceByBoundaryShapeId[boundaryShapeId]
    if (existingPiece) {
      ensurePatternPieceSupportRecords(existingPiece)
      if (isMobileLayout) {
        setShowPieceInspectorModal(true)
      } else {
        setActiveInspectorTab('piece')
      }
      setStatus('Pattern piece already exists for this boundary')
      return
    }
    const chain = patternPieceChainsByShapeId.get(boundaryShapeId)
    if (!chain?.isClosed) {
      setStatus('Pattern pieces require a closed outline boundary')
      return
    }

    const piece = createDefaultPatternPiece(boundaryShapeId, boundaryShape.layerId, `Piece ${patternPieces.length + 1}`)
    setPatternPieces((previous) => [...previous, piece])
    setPieceGrainlines((previous) => [...previous, createDefaultPieceGrainline(piece.id)])
    setPieceLabels((previous) => [...previous, ...createDefaultPieceLabels(piece)])
    setSeamAllowances((previous) => [...previous, createDefaultPieceSeamAllowance(piece.id)])
    if (isMobileLayout) {
      setShowPieceInspectorModal(true)
    } else {
      setActiveInspectorTab('piece')
    }
    setStatus(`Created pattern piece "${piece.name}"`)
  }, [
    ensurePatternPieceSupportRecords,
    isMobileLayout,
    patternPieceByBoundaryShapeId,
    patternPieceChainsByShapeId,
    patternPieces.length,
    selectedShapeIds,
    setActiveInspectorTab,
    setPatternPieces,
    setPieceGrainlines,
    setPieceLabels,
    setSeamAllowances,
    setShowPieceInspectorModal,
    setStatus,
    shapesById,
  ])

  const handleUpdateSelectedPatternPiece = useCallback((patch: Partial<PatternPiece>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPatternPieces((previous) =>
      previous.map((piece) => (piece.id === selectedPatternPiece.id ? { ...piece, ...patch } : piece)),
    )
  }, [selectedPatternPiece, setPatternPieces])

  const handleToggleSelectedPieceInternalShape = useCallback((shapeId: string, included: boolean) => {
    if (!selectedPatternPiece) {
      return
    }
    setPatternPieces((previous) =>
      previous.map((piece) => {
        if (piece.id !== selectedPatternPiece.id) {
          return piece
        }
        const internalShapeIds = included
          ? Array.from(new Set([...piece.internalShapeIds, shapeId]))
          : piece.internalShapeIds.filter((entry) => entry !== shapeId)
        return { ...piece, internalShapeIds }
      }),
    )
  }, [selectedPatternPiece, setPatternPieces])

  const updateSelectedLabel = useCallback((kind: 'piece' | 'pattern', patch: Partial<PieceLabel>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPieceLabels((previous) =>
      previous.map((label) =>
        label.pieceId === selectedPatternPiece.id && label.kind === kind ? { ...label, ...patch } : label,
      ),
    )
  }, [selectedPatternPiece, setPieceLabels])

  const handleUpdateSelectedPieceGrainline = useCallback((patch: Partial<import('../cad/cad-types').PieceGrainline>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPieceGrainlines((previous) =>
      previous.map((entry) => (entry.pieceId === selectedPatternPiece.id ? { ...entry, ...patch } : entry)),
    )
  }, [selectedPatternPiece, setPieceGrainlines])

  const handleUpdateSelectedPieceSeamAllowance = useCallback((patch: Partial<PieceSeamAllowance>) => {
    if (!selectedPatternPiece) {
      return
    }
    const nextEdgeOverrides = Array.isArray(patch.edgeOverrides)
      ? patch.edgeOverrides
          .map((entry) => ({
            edgeIndex: Math.max(0, Math.min(Math.max(0, selectedPatternPieceEdgeCount - 1), Math.round(entry.edgeIndex))),
            offsetMm: Math.max(0.1, entry.offsetMm),
          }))
          .sort((left, right) => left.edgeIndex - right.edgeIndex)
      : undefined
    setSeamAllowances((previous) =>
      previous.map((entry) =>
        entry.pieceId === selectedPatternPiece.id
          ? {
              ...entry,
              ...patch,
              edgeOverrides: nextEdgeOverrides ?? entry.edgeOverrides,
            }
          : entry,
      ),
    )
  }, [selectedPatternPiece, selectedPatternPieceEdgeCount, setSeamAllowances])

  const handleUpdateSelectedPieceSeamConnection = useCallback((connectionId: string, patch: Partial<import('../cad/cad-types').SeamConnection>) => {
    if (!selectedPatternPiece) {
      return
    }
    setSeamConnections((previous) =>
      previous.map((connection) => {
        if (
          connection.id !== connectionId ||
          (connection.from.pieceId !== selectedPatternPiece.id && connection.to.pieceId !== selectedPatternPiece.id)
        ) {
          return connection
        }
        return {
          ...connection,
          ...patch,
          stitchSpacingMm:
            'stitchSpacingMm' in patch
              ? typeof patch.stitchSpacingMm === 'number'
                ? Math.max(0, patch.stitchSpacingMm)
                : undefined
              : connection.stitchSpacingMm,
        }
      }),
    )
  }, [selectedPatternPiece, setSeamConnections])

  const handleUpdateSelectedPieceNotch = useCallback((notchId: string, patch: Partial<import('../cad/cad-types').PieceNotch>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPieceNotches((previous) =>
      previous.map((entry) => {
        if (entry.id !== notchId || entry.pieceId !== selectedPatternPiece.id) {
          return entry
        }
        return {
          ...entry,
          ...patch,
          edgeIndex:
            typeof patch.edgeIndex === 'number'
              ? Math.max(0, Math.min(Math.max(0, selectedPatternPieceEdgeCount - 1), Math.round(patch.edgeIndex)))
              : entry.edgeIndex,
          t: typeof patch.t === 'number' ? clamp(patch.t, 0, 1) : entry.t,
          lengthMm: typeof patch.lengthMm === 'number' ? Math.max(0.5, patch.lengthMm) : entry.lengthMm,
          widthMm: typeof patch.widthMm === 'number' ? Math.max(0, patch.widthMm) : entry.widthMm,
        }
      }),
    )
  }, [selectedPatternPiece, selectedPatternPieceEdgeCount, setPieceNotches])

  const handleAddSelectedPiecePlacementLabel = useCallback(() => {
    if (!selectedPatternPiece) {
      return
    }
    setPiecePlacementLabels((previous) => [...previous, createDefaultPiecePlacementLabel(selectedPatternPiece.id)])
  }, [selectedPatternPiece, setPiecePlacementLabels])

  const handleUpdateSelectedPiecePlacementLabel = useCallback((labelId: string, patch: Partial<PiecePlacementLabel>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPiecePlacementLabels((previous) =>
      previous.map((entry) => {
        if (entry.id !== labelId || entry.pieceId !== selectedPatternPiece.id) {
          return entry
        }
        return {
          ...entry,
          ...patch,
          edgeIndex:
            typeof patch.edgeIndex === 'number'
              ? Math.max(0, Math.min(Math.max(0, selectedPatternPieceEdgeCount - 1), Math.round(patch.edgeIndex)))
              : entry.edgeIndex,
          t: typeof patch.t === 'number' ? clamp(patch.t, 0, 1) : entry.t,
          widthMm: typeof patch.widthMm === 'number' ? Math.max(0.5, patch.widthMm) : entry.widthMm,
          heightMm: typeof patch.heightMm === 'number' ? Math.max(0.5, patch.heightMm) : entry.heightMm,
        }
      }),
    )
  }, [selectedPatternPiece, selectedPatternPieceEdgeCount, setPiecePlacementLabels])

  const handleDeleteSelectedPiecePlacementLabel = useCallback((labelId: string) => {
    setPiecePlacementLabels((previous) => previous.filter((entry) => entry.id !== labelId))
  }, [setPiecePlacementLabels])

  return {
    ensurePatternPieceSupportRecords,
    openSelectedPatternPieceInspector,
    handleCreatePatternPieceFromSelection,
    handleUpdateSelectedPatternPiece,
    handleToggleSelectedPieceInternalShape,
    updateSelectedLabel,
    handleUpdateSelectedPieceGrainline,
    handleUpdateSelectedPieceSeamAllowance,
    handleUpdateSelectedPieceSeamConnection,
    handleUpdateSelectedPieceNotch,
    handleAddSelectedPiecePlacementLabel,
    handleUpdateSelectedPiecePlacementLabel,
    handleDeleteSelectedPiecePlacementLabel,
  }
}
