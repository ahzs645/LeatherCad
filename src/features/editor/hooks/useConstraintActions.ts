import type { Dispatch, SetStateAction } from 'react'
import { clamp, uid } from '../cad/cad-geometry'
import type {
  ConstraintAxis,
  ConstraintEdge,
  Layer,
  ParametricConstraint,
  SeamAllowance,
  Shape,
  SnapSettings,
} from '../cad/cad-types'
import {
  alignSelectedShapes,
  alignSelectedShapesToGrid,
  applyParametricConstraints,
} from '../ops/pattern-ops'

type UseConstraintActionsParams = {
  activeLayer: Layer | null
  layers: Layer[]
  selectedShapeIds: string[]
  selectedShapeIdSet: Set<string>
  constraintEdge: ConstraintEdge
  constraintOffsetMm: number
  constraintAxis: ConstraintAxis
  constraints: ParametricConstraint[]
  seamAllowanceInputMm: number
  seamAllowances: SeamAllowance[]
  snapSettings: SnapSettings
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setSeamAllowances: Dispatch<SetStateAction<SeamAllowance[]>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useConstraintActions(params: UseConstraintActionsParams) {
  const {
    activeLayer,
    layers,
    selectedShapeIds,
    selectedShapeIdSet,
    constraintEdge,
    constraintOffsetMm,
    constraintAxis,
    constraints,
    seamAllowanceInputMm,
    seamAllowances,
    snapSettings,
    setShapes,
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
    const selectedIds = new Set(selectedShapeIds)

    setSeamAllowances((previous) => {
      const retained = previous.filter((entry) => !selectedIds.has(entry.shapeId))
      const created = selectedShapeIds.map((shapeId) => ({
        id: uid(),
        shapeId,
        offsetMm: safeOffset,
      }))
      return [...retained, ...created]
    })

    setStatus(`Applied ${safeOffset.toFixed(1)}mm seam allowance to ${selectedShapeIds.length} shape${selectedShapeIds.length === 1 ? '' : 's'}`)
  }

  const handleClearSeamAllowanceOnSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    setSeamAllowances((previous) => previous.filter((entry) => !selectedShapeIdSet.has(entry.shapeId)))
    setStatus('Cleared seam allowance on selected shapes')
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
  }
}
