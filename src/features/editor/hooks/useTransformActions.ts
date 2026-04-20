import type { Dispatch, SetStateAction } from 'react'
import type { Point, Shape, StitchHole } from '../cad/cad-types'
import { getSelectionCenter, rotatePointAround, scalePointFrom, transformSelectedStitchHoles } from '../ops/shape-selection-ops'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import {
  alignSelectionToEdge,
  flipSelection,
  makeSelectedLinesAxisAligned,
  reverseSelectedPaths,
  rotateSelectionAround,
  scaleSelectionNonUniform,
  type AlignEdge,
} from '../ops/transform-ops'

type UseTransformActionsParams = {
  shapes: Shape[]
  selectedShapeIdSet: Set<string>
  customRotationPivot: Point | null
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setCustomRotationPivot: Dispatch<SetStateAction<Point | null>>
  setCustomSnapPoint: Dispatch<SetStateAction<Point | null>>
  setShowSpecifyRotationModal: Dispatch<SetStateAction<boolean>>
  setShowSpecifyScaleModal: Dispatch<SetStateAction<boolean>>
  setSpecifyScaleModalAxis: Dispatch<SetStateAction<'both' | 'vertical'>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useTransformActions(params: UseTransformActionsParams) {
  const {
    shapes,
    selectedShapeIdSet,
    customRotationPivot,
    setShapes,
    setStitchHoles,
    setCustomRotationPivot,
    setCustomSnapPoint,
    setShowSpecifyRotationModal,
    setShowSpecifyScaleModal,
    setSpecifyScaleModalAxis,
    setStatus,
  } = params

  const requireSelection = (verb: string) => {
    if (selectedShapeIdSet.size === 0) {
      setStatus(`Select one or more shapes to ${verb}`)
      return false
    }
    return true
  }

  const handleAlignSelectionToEdge = (edge: AlignEdge) => {
    if (selectedShapeIdSet.size < 2) {
      setStatus('Select at least two shapes to align')
      return
    }
    setShapes((previous) => alignSelectionToEdge(previous, selectedShapeIdSet, edge))
    setStatus(`Aligned ${selectedShapeIdSet.size} shapes (${edge})`)
  }

  const handleFlipSelection = (axis: 'horizontal' | 'vertical') => {
    if (!requireSelection('flip')) return
    setShapes((previous) => flipSelection(previous, selectedShapeIdSet, axis))
    setStatus(`Flipped selection ${axis === 'horizontal' ? 'horizontally' : 'vertically'}`)
  }

  const handleReverseSelectedPaths = () => {
    if (!requireSelection('reverse')) return
    setShapes((previous) => reverseSelectedPaths(previous, selectedShapeIdSet))
    setStatus('Reversed direction of selected paths')
  }

  const handleSpecifyRotation = (angleDeg: number) => {
    if (!requireSelection('rotate')) return
    if (!Number.isFinite(angleDeg) || Math.abs(angleDeg) < 1e-8) {
      setStatus('Rotation cancelled')
      return
    }
    const center = customRotationPivot ?? getSelectionCenter(shapes, selectedShapeIdSet)
    if (!center) {
      setStatus('Could not compute rotation center')
      return
    }
    const radians = (angleDeg * Math.PI) / 180
    setShapes((previous) => rotateSelectionAround(previous, selectedShapeIdSet, angleDeg, center))
    setStitchHoles((previous) =>
      normalizeStitchHoleSequences(
        transformSelectedStitchHoles(previous, selectedShapeIdSet, (point) =>
          rotatePointAround(point, center, radians),
        ),
      ),
    )
    setStatus(`Rotated selection by ${angleDeg.toFixed(2)}°`)
  }

  const handleSpecifyScale = (factorX: number, factorY: number) => {
    if (!requireSelection('scale')) return
    if (!Number.isFinite(factorX) || !Number.isFinite(factorY) || factorX <= 0 || factorY <= 0) {
      setStatus('Scale cancelled')
      return
    }
    const center = customRotationPivot ?? getSelectionCenter(shapes, selectedShapeIdSet)
    if (!center) {
      setStatus('Could not compute scale center')
      return
    }
    setShapes((previous) => scaleSelectionNonUniform(previous, selectedShapeIdSet, factorX, factorY, center))
    setStitchHoles((previous) =>
      normalizeStitchHoleSequences(
        transformSelectedStitchHoles(previous, selectedShapeIdSet, (point) => ({
          x: center.x + (point.x - center.x) * factorX,
          y: center.y + (point.y - center.y) * factorY,
        })),
      ),
    )
    if (factorX === factorY) {
      setStatus(`Scaled selection by ${(factorX * 100).toFixed(1)}%`)
    } else {
      setStatus(`Scaled selection by ${(factorX * 100).toFixed(1)}% × ${(factorY * 100).toFixed(1)}%`)
    }
  }

  const handleOpenSpecifyRotationModal = () => {
    if (!requireSelection('rotate')) return
    setShowSpecifyRotationModal(true)
  }

  const handleOpenSpecifyScaleModal = (axis: 'both' | 'vertical') => {
    if (!requireSelection('scale')) return
    setSpecifyScaleModalAxis(axis)
    setShowSpecifyScaleModal(true)
  }

  const handleSetAsRotationCenter = () => {
    const center = getSelectionCenter(shapes, selectedShapeIdSet)
    if (!center) {
      setStatus('Select a shape whose center becomes the rotation pivot')
      return
    }
    setCustomRotationPivot(center)
    setStatus(`Rotation center set at (${center.x.toFixed(2)}, ${center.y.toFixed(2)})mm`)
  }

  const handleClearRotationCenter = () => {
    setCustomRotationPivot(null)
    setStatus('Rotation center cleared; using selection centroid')
  }

  const handleSetAsSnapPoint = () => {
    const center = getSelectionCenter(shapes, selectedShapeIdSet)
    if (!center) {
      setStatus('Select a shape whose center becomes the snap anchor')
      return
    }
    setCustomSnapPoint(center)
    setStatus(`Custom snap point set at (${center.x.toFixed(2)}, ${center.y.toFixed(2)})mm`)
  }

  const handleClearSnapPoint = () => {
    setCustomSnapPoint(null)
    setStatus('Custom snap point cleared')
  }

  const handleMakeSelectedLineHorizontal = () => {
    if (!requireSelection('make horizontal')) return
    setShapes((previous) => makeSelectedLinesAxisAligned(previous, selectedShapeIdSet, 'horizontal'))
    setStatus('Made selected lines horizontal')
  }

  const handleMakeSelectedLineVertical = () => {
    if (!requireSelection('make vertical')) return
    setShapes((previous) => makeSelectedLinesAxisAligned(previous, selectedShapeIdSet, 'vertical'))
    setStatus('Made selected lines vertical')
  }

  // For side-effect free consumers in tests.
  void scalePointFrom

  return {
    handleAlignSelectionToEdge,
    handleFlipSelection,
    handleReverseSelectedPaths,
    handleSpecifyRotation,
    handleSpecifyScale,
    handleOpenSpecifyRotationModal,
    handleOpenSpecifyScaleModal,
    handleSetAsRotationCenter,
    handleClearRotationCenter,
    handleSetAsSnapPoint,
    handleClearSnapPoint,
    handleMakeSelectedLineHorizontal,
    handleMakeSelectedLineVertical,
  }
}
