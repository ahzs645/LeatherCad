import type { Dispatch, SetStateAction } from 'react'
import { clamp } from '../cad/cad-geometry'
import type {
  Layer,
  LineType,
  Shape,
  StitchHole,
  StitchHoleType,
} from '../cad/cad-types'
import {
  deleteStitchHolesForShapes,
  fixStitchHoleOrderFromHole,
  generateFixedPitchStitchHoles,
  generateVariablePitchStitchHoles,
  normalizeStitchHoleSequences,
  resequenceStitchHolesOnShape,
  selectNextStitchHole,
} from '../ops/stitch-hole-ops'

type UseStitchActionsParams = {
  selectedShapeIdSet: Set<string>
  selectedStitchHoleCount: number
  stitchHoles: StitchHole[]
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  setStatus: Dispatch<SetStateAction<string>>
  shapes: Shape[]
  lineTypesById: Record<string, LineType>
  stitchPitchMm: number
  stitchVariablePitchStartMm: number
  stitchVariablePitchEndMm: number
  stitchHoleType: StitchHoleType
  selectedStitchHole: StitchHole | null
  shapesById: Record<string, Shape>
  layers: Layer[]
  stitchHoleCountsByShape: Record<string, number>
}

export function useStitchActions(params: UseStitchActionsParams) {
  const {
    selectedShapeIdSet,
    selectedStitchHoleCount,
    stitchHoles,
    setStitchHoles,
    setSelectedStitchHoleId,
    setStatus,
    shapes,
    lineTypesById,
    stitchPitchMm,
    stitchVariablePitchStartMm,
    stitchVariablePitchEndMm,
    stitchHoleType,
    selectedStitchHole,
    shapesById,
    layers,
    stitchHoleCountsByShape,
  } = params

  const getSelectedStitchShapes = () =>
    shapes.filter((shape) => {
      if (!selectedShapeIdSet.has(shape.id)) {
        return false
      }
      const lineTypeRole = lineTypesById[shape.lineTypeId]?.role ?? 'cut'
      return lineTypeRole === 'stitch'
    })

  const handleCountStitchHolesOnSelectedShapes = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first to count stitch holes')
      return
    }
    setStatus(`Selected shapes contain ${selectedStitchHoleCount} stitch hole${selectedStitchHoleCount === 1 ? '' : 's'}`)
  }

  const handleDeleteStitchHolesOnSelectedShapes = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first to delete stitch holes')
      return
    }

    if (selectedStitchHoleCount === 0) {
      setStatus('Selected shapes do not contain stitch holes')
      return
    }

    setStitchHoles((previous) => normalizeStitchHoleSequences(deleteStitchHolesForShapes(previous, selectedShapeIdSet)))
    setStatus(`Deleted ${selectedStitchHoleCount} stitch hole${selectedStitchHoleCount === 1 ? '' : 's'} on selected shapes`)
  }

  const handleClearAllStitchHoles = () => {
    if (stitchHoles.length === 0) {
      setStatus('No stitch holes to clear')
      return
    }
    setStitchHoles([])
    setSelectedStitchHoleId(null)
    setStatus('Cleared all stitch holes')
  }

  const handleAutoPlaceFixedPitchStitchHoles = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more stitch paths first')
      return
    }

    const selectedStitchShapes = getSelectedStitchShapes()

    if (selectedStitchShapes.length === 0) {
      setStatus('Selected shapes are not stitch-role paths')
      return
    }

    const safePitch = clamp(stitchPitchMm, 0.2, 100)
    const selectedShapeIds = new Set(selectedStitchShapes.map((shape) => shape.id))
    const generatedHoles = selectedStitchShapes.flatMap((shape) =>
      generateFixedPitchStitchHoles(shape, safePitch, stitchHoleType, 0),
    )

    setStitchHoles((previous) => {
      const retained = previous.filter((stitchHole) => !selectedShapeIds.has(stitchHole.shapeId))
      return normalizeStitchHoleSequences([...retained, ...generatedHoles])
    })
    setSelectedStitchHoleId(generatedHoles[0]?.id ?? null)

    setStatus(
      `Auto placed ${generatedHoles.length} stitch holes on ${selectedStitchShapes.length} path${selectedStitchShapes.length === 1 ? '' : 's'} at ${safePitch.toFixed(1)}mm pitch`,
    )
  }

  const handleAutoPlaceVariablePitchStitchHoles = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more stitch paths first')
      return
    }

    const selectedStitchShapes = getSelectedStitchShapes()
    if (selectedStitchShapes.length === 0) {
      setStatus('Selected shapes are not stitch-role paths')
      return
    }

    const safeStartPitch = clamp(stitchVariablePitchStartMm, 0.2, 100)
    const safeEndPitch = clamp(stitchVariablePitchEndMm, 0.2, 100)
    const selectedShapeIds = new Set(selectedStitchShapes.map((shape) => shape.id))
    const generatedHoles = selectedStitchShapes.flatMap((shape) =>
      generateVariablePitchStitchHoles(shape, safeStartPitch, safeEndPitch, stitchHoleType, 0),
    )

    setStitchHoles((previous) => {
      const retained = previous.filter((stitchHole) => !selectedShapeIds.has(stitchHole.shapeId))
      return normalizeStitchHoleSequences([...retained, ...generatedHoles])
    })
    setSelectedStitchHoleId(generatedHoles[0]?.id ?? null)

    setStatus(
      `Auto placed ${generatedHoles.length} stitch holes on ${selectedStitchShapes.length} path${selectedStitchShapes.length === 1 ? '' : 's'} using ${safeStartPitch.toFixed(1)} to ${safeEndPitch.toFixed(1)}mm pitch`,
    )
  }

  const handleResequenceSelectedStitchHoles = (reverse = false) => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more stitch paths first')
      return
    }

    const selectedShapes = shapes.filter((shape) => selectedShapeIdSet.has(shape.id))
    if (selectedShapes.length === 0) {
      setStatus('No selected shapes to re-sequence')
      return
    }

    setStitchHoles((previous) => {
      const byShape = new Map<string, StitchHole[]>()
      for (const hole of previous) {
        const entries = byShape.get(hole.shapeId) ?? []
        entries.push(hole)
        byShape.set(hole.shapeId, entries)
      }

      const preserved: StitchHole[] = []
      for (const hole of previous) {
        if (!selectedShapeIdSet.has(hole.shapeId)) {
          preserved.push(hole)
        }
      }

      const resequenced: StitchHole[] = []
      for (const shape of selectedShapes) {
        const holes = byShape.get(shape.id) ?? []
        if (holes.length === 0) {
          continue
        }
        resequenced.push(...resequenceStitchHolesOnShape(holes, shape, reverse))
      }
      return normalizeStitchHoleSequences([...preserved, ...resequenced])
    })

    setStatus(reverse ? 'Reversed stitch-hole order on selected paths' : 'Re-sequenced stitch holes on selected paths')
  }

  const handleSelectNextStitchHole = () => {
    const preferredShapeId =
      selectedStitchHole?.shapeId ??
      shapes.find((shape) => selectedShapeIdSet.has(shape.id) && (stitchHoleCountsByShape[shape.id] ?? 0) > 0)?.id ??
      stitchHoles[0]?.shapeId ??
      null

    if (!preferredShapeId) {
      setStatus('No stitch holes available to select')
      return
    }

    const holesOnShape = stitchHoles.filter((stitchHole) => stitchHole.shapeId === preferredShapeId)
    const currentHoleId = selectedStitchHole?.shapeId === preferredShapeId ? selectedStitchHole.id : null
    const nextHole = selectNextStitchHole(holesOnShape, currentHoleId)
    if (!nextHole) {
      setStatus('No stitch holes available to select')
      return
    }

    setSelectedStitchHoleId(nextHole.id)
    setStatus(`Selected stitch hole ${nextHole.sequence + 1} of ${holesOnShape.length}`)
  }

  const handleFixStitchHoleOrderFromSelected = (reverse = false) => {
    if (!selectedStitchHole) {
      setStatus('Select a stitch hole first (Move tool)')
      return
    }

    const targetShape = shapesById[selectedStitchHole.shapeId]
    if (!targetShape) {
      setStatus('Selected stitch hole has no valid path')
      return
    }

    const targetLayer = layers.find((layer) => layer.id === targetShape.layerId)
    if (targetLayer?.locked) {
      setStatus('Target layer is locked. Unlock it before editing stitch order.')
      return
    }

    const lineTypeRole = lineTypesById[targetShape.lineTypeId]?.role ?? 'cut'
    if (lineTypeRole !== 'stitch') {
      setStatus('Selected stitch hole is not on a stitch-role path')
      return
    }

    setStitchHoles((previous) => {
      const onShape = previous.filter((stitchHole) => stitchHole.shapeId === targetShape.id)
      const retained = previous.filter((stitchHole) => stitchHole.shapeId !== targetShape.id)
      const fixedOrder = fixStitchHoleOrderFromHole(onShape, targetShape, selectedStitchHole.id, reverse)
      return normalizeStitchHoleSequences([...retained, ...fixedOrder])
    })

    setStatus(reverse ? 'Fixed stitch order in reverse from selected hole' : 'Fixed stitch order from selected hole')
  }

  return {
    handleCountStitchHolesOnSelectedShapes,
    handleDeleteStitchHolesOnSelectedShapes,
    handleClearAllStitchHoles,
    handleAutoPlaceFixedPitchStitchHoles,
    handleAutoPlaceVariablePitchStitchHoles,
    handleResequenceSelectedStitchHoles,
    handleSelectNextStitchHole,
    handleFixStitchHoleOrderFromSelected,
  }
}
