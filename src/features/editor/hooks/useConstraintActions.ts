import type { Dispatch, SetStateAction } from 'react'
import { clamp, uid } from '../cad/cad-geometry'
import type {
  ConstraintAxis,
  ConstraintEdge,
  Layer,
  ParametricConstraint,
  PatternPiece,
  PieceSeamAllowance,
  Shape,
  SnapSettings,
} from '../cad/cad-types'
import {
  applyCornerOnSelectedLines,
  createBoxStitchFromSelection,
  createOffsetGeometryForSelection,
} from '../ops/advanced-pattern-ops'
import {
  alignSelectedShapes,
  alignSelectedShapesToGrid,
  applyParametricConstraints,
} from '../ops/pattern-ops'

type UseConstraintActionsParams = {
  activeLayer: Layer | null
  activeLayerId: string | null
  activeLineTypeId: string
  stitchLineTypeId: string
  layers: Layer[]
  shapes: Shape[]
  selectedShapeIds: string[]
  selectedShapeIdSet: Set<string>
  constraintEdge: ConstraintEdge
  constraintOffsetMm: number
  constraintAxis: ConstraintAxis
  constraints: ParametricConstraint[]
  seamAllowanceInputMm: number
  patternPieces: PatternPiece[]
  seamAllowances: PieceSeamAllowance[]
  snapSettings: SnapSettings
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setSeamAllowances: Dispatch<SetStateAction<PieceSeamAllowance[]>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useConstraintActions(params: UseConstraintActionsParams) {
  const {
    activeLayer,
    activeLayerId,
    activeLineTypeId,
    stitchLineTypeId,
    layers,
    shapes,
    selectedShapeIds,
    selectedShapeIdSet,
    constraintEdge,
    constraintOffsetMm,
    constraintAxis,
    constraints,
    seamAllowanceInputMm,
    patternPieces,
    seamAllowances,
    snapSettings,
    setShapes,
    setSelectedShapeIds,
    setConstraints,
    setSeamAllowances,
    setStatus,
  } = params

  const handleAddEdgeConstraintFromSelection = () => {
    if (!activeLayer) {
      setStatus('No active layer available for edge constraint')
      return
    }

    const firstShapeId = selectedShapeIds[0]
    if (!firstShapeId) {
      setStatus('Select a shape to add an edge-offset constraint')
      return
    }

    const nextConstraint: ParametricConstraint = {
      id: uid(),
      name: `Edge offset ${constraints.length + 1}`,
      type: 'edge-offset',
      enabled: true,
      shapeId: firstShapeId,
      referenceLayerId: activeLayer.id,
      edge: constraintEdge,
      anchor: 'center',
      offsetMm: clamp(constraintOffsetMm, 0, 999),
    }
    setConstraints((previous) => [...previous, nextConstraint])
    setStatus('Edge-offset constraint added')
  }

  const handleAddAlignConstraintsFromSelection = () => {
    if (selectedShapeIds.length < 2) {
      setStatus('Select at least two shapes to add alignment constraints')
      return
    }

    const referenceShapeId = selectedShapeIds[0]
    const nextConstraints: ParametricConstraint[] = selectedShapeIds.slice(1).map((shapeId, index) => ({
      id: uid(),
      name: `Align ${constraints.length + index + 1}`,
      type: 'align',
      enabled: true,
      shapeId,
      referenceShapeId,
      axis: constraintAxis,
      anchor: 'center',
      referenceAnchor: 'center',
    }))
    setConstraints((previous) => [...previous, ...nextConstraints])
    setStatus(`Added ${nextConstraints.length} alignment constraint${nextConstraints.length === 1 ? '' : 's'}`)
  }

  const handleApplyConstraints = () => {
    if (constraints.length === 0) {
      setStatus('No constraints to apply')
      return
    }
    setShapes((previous) => applyParametricConstraints(previous, layers, constraints))
    setStatus('Applied parametric constraints')
  }

  const handleAlignSelection = (axis: 'x' | 'y' | 'both') => {
    if (selectedShapeIdSet.size < 2) {
      setStatus('Select at least two shapes to align')
      return
    }
    setShapes((previous) => alignSelectedShapes(previous, selectedShapeIdSet, axis))
    const axisLabel = axis === 'both' ? 'X/Y centers' : axis.toUpperCase()
    setStatus(`Aligned selected shapes on ${axisLabel}`)
  }

  const handleAlignSelectionToGrid = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to align to the grid')
      return
    }
    setShapes((previous) => alignSelectedShapesToGrid(previous, selectedShapeIdSet, snapSettings.gridStep))
    setStatus('Aligned selected shapes to grid')
  }

  const handleApplySeamAllowanceToSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }

    const safeOffset = clamp(seamAllowanceInputMm, 0.1, 150)
    const selectedPieces = patternPieces.filter(
      (piece) =>
        selectedShapeIdSet.has(piece.boundaryShapeId) ||
        piece.internalShapeIds.some((shapeId) => selectedShapeIdSet.has(shapeId)),
    )
    if (selectedPieces.length === 0) {
      setStatus('Select a pattern piece boundary or one of its linked internal paths')
      return
    }
    const selectedPieceIds = new Set(selectedPieces.map((piece) => piece.id))

    setSeamAllowances((previous) => {
      const retained = previous.filter((entry) => !selectedPieceIds.has(entry.pieceId))
      const created = selectedPieces.map((piece) => ({
        id: uid(),
        pieceId: piece.id,
        enabled: true,
        defaultOffsetMm: safeOffset,
        edgeOverrides: [],
      }))
      return [...retained, ...created]
    })

    setStatus(
      `Applied ${safeOffset.toFixed(1)}mm seam allowance to ${selectedPieces.length} piece${selectedPieces.length === 1 ? '' : 's'}`,
    )
  }

  const handleClearSeamAllowanceOnSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    const selectedPieceIds = new Set(
      patternPieces
        .filter(
          (piece) =>
            selectedShapeIdSet.has(piece.boundaryShapeId) ||
            piece.internalShapeIds.some((shapeId) => selectedShapeIdSet.has(shapeId)),
        )
        .map((piece) => piece.id),
    )
    if (selectedPieceIds.size === 0) {
      setStatus('No selected pattern pieces with seam allowances')
      return
    }
    setSeamAllowances((previous) => previous.filter((entry) => !selectedPieceIds.has(entry.pieceId)))
    setStatus('Cleared seam allowance on selected pattern pieces')
  }

  const handleClearAllSeamAllowances = () => {
    if (seamAllowances.length === 0) {
      setStatus('No seam allowances to clear')
      return
    }
    setSeamAllowances([])
    setStatus('Cleared all seam allowances')
  }

  const handleToggleConstraintEnabled = (constraintId: string) => {
    setConstraints((previous) =>
      previous.map((entry) =>
        entry.id === constraintId
          ? {
              ...entry,
              enabled: !entry.enabled,
            }
          : entry,
      ),
    )
  }

  const handleDeleteConstraint = (constraintId: string) => {
    setConstraints((previous) => previous.filter((entry) => entry.id !== constraintId))
  }

  const handleBevelSelectedCorner = () => {
    const input = Number(window.prompt('Bevel distance (mm)', '4'))
    if (!Number.isFinite(input) || input <= 0) {
      setStatus('Bevel cancelled')
      return
    }
    const result = applyCornerOnSelectedLines(shapes, selectedShapeIdSet, 'bevel', input, activeLineTypeId)
    if (!result.ok) {
      setStatus(result.message)
      return
    }
    setShapes(result.nextShapes)
    if (result.createdShapeIds.length > 0) {
      setSelectedShapeIds(result.createdShapeIds)
    }
    setStatus(result.message)
  }

  const handleRoundSelectedCorner = () => {
    const input = Number(window.prompt('Round distance (mm)', '4'))
    if (!Number.isFinite(input) || input <= 0) {
      setStatus('Round cancelled')
      return
    }
    const result = applyCornerOnSelectedLines(shapes, selectedShapeIdSet, 'round', input, activeLineTypeId)
    if (!result.ok) {
      setStatus(result.message)
      return
    }
    setShapes(result.nextShapes)
    if (result.createdShapeIds.length > 0) {
      setSelectedShapeIds(result.createdShapeIds)
    }
    setStatus(result.message)
  }

  const handleCreateOffsetGeometryFromSelection = () => {
    const input = Number(window.prompt('Offset distance (mm). Negative values offset the opposite side.', '4'))
    if (!Number.isFinite(input) || Math.abs(input) < 0.001) {
      setStatus('Offset cancelled')
      return
    }
    const result = createOffsetGeometryForSelection(shapes, selectedShapeIdSet, input, activeLineTypeId)
    if (!result.ok) {
      setStatus(result.message)
      return
    }
    setShapes((previous) => [...previous, ...result.created])
    setSelectedShapeIds(result.created.map((shape) => shape.id))
    setStatus(result.message)
  }

  const handleCreateBoxStitchFromSelection = () => {
    const input = Number(window.prompt('Inset distance for box stitch (mm)', '6'))
    if (!Number.isFinite(input) || input <= 0) {
      setStatus('Box stitch cancelled')
      return
    }
    const result = createBoxStitchFromSelection(
      shapes,
      selectedShapeIdSet,
      input,
      stitchLineTypeId,
      activeLayerId,
    )
    if (!result.ok) {
      setStatus(result.message)
      return
    }
    setShapes((previous) => [...previous, ...result.created])
    setSelectedShapeIds(result.created.map((shape) => shape.id))
    setStatus(result.message)
  }

  return {
    handleAddEdgeConstraintFromSelection,
    handleAddAlignConstraintsFromSelection,
    handleApplyConstraints,
    handleAlignSelection,
    handleAlignSelectionToGrid,
    handleApplySeamAllowanceToSelection,
    handleClearSeamAllowanceOnSelection,
    handleClearAllSeamAllowances,
    handleToggleConstraintEnabled,
    handleDeleteConstraint,
    handleBevelSelectedCorner,
    handleRoundSelectedCorner,
    handleCreateOffsetGeometryFromSelection,
    handleCreateBoxStitchFromSelection,
  }
}
