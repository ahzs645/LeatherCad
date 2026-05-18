import type { Dispatch, SetStateAction } from 'react'
import { clamp } from '../cad/cad-geometry'
import type {
  Layer,
  LineType,
  Shape,
  StitchHole,
  StitchHoleRenderShape,
} from '../cad/cad-types'
import {
  changeStitchHoleShapesOnShapes,
  deleteStitchHolesForShapes,
  fixStitchHoleOrderFromHole,
  generateEvenlySpacedStitchHoles,
  generateFixedPitchStitchHoles,
  generateVariablePitchStitchHoles,
  normalizeStitchHoleSequences,
  type AutoPitchGenerationOptions,
  projectDistanceOnShape,
  resequenceStitchHolesOnShape,
  selectNextStitchHole,
} from '../ops/stitch-hole-ops'
import { useEditorToolSelector } from '../state/providers/EditorToolStateProvider'
import { useEditorUIActions } from '../state/providers/EditorUIStateProvider'

type UseStitchActionsParams = {
  selectedShapeIdSet: Set<string>
  selectedStitchHoleCount: number
  stitchHoles: StitchHole[]
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setSelectedStitchHoleId: Dispatch<SetStateAction<string | null>>
  shapes: Shape[]
  lineTypesById: Record<string, LineType>
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
    shapes,
    lineTypesById,
    selectedStitchHole,
    shapesById,
    layers,
    stitchHoleCountsByShape,
  } = params
  const {
    stitchPitchMm,
    stitchVariablePitchStartMm,
    stitchVariablePitchEndMm,
    stitchAutoPitchSettings,
    stitchHoleDefaults,
  } = useEditorToolSelector((state) => ({
    stitchPitchMm: state.stitchPitchMm,
    stitchVariablePitchStartMm: state.stitchVariablePitchStartMm,
    stitchVariablePitchEndMm: state.stitchVariablePitchEndMm,
    stitchAutoPitchSettings: state.stitchAutoPitchSettings,
    stitchHoleDefaults: state.stitchHoleDefaults,
  }))
  const { setStatus } = useEditorUIActions()

  const getSelectedStitchShapes = () =>
    shapes.filter((shape) => {
      if (!selectedShapeIdSet.has(shape.id)) {
        return false
      }
      const lineTypeRole = lineTypesById[shape.lineTypeId]?.role ?? 'cut'
      return lineTypeRole === 'stitch'
    })

  const buildAutoPitchOptions = (): AutoPitchGenerationOptions => ({
    forceFitLastHole: stitchAutoPitchSettings.forceFitLastHole,
    solverSteps: stitchAutoPitchSettings.solverSteps,
    precisionMm: stitchAutoPitchSettings.precisionMm,
    stopGapMm: stitchAutoPitchSettings.stopGapMm,
  })

  const buildContinuationOptions = (
    shape: Shape,
    existingHoles: StitchHole[],
  ): {
    retained: StitchHole[]
    sequenceStart: number
    generationOptions: AutoPitchGenerationOptions
    continued: boolean
  } => {
    if (
      !stitchAutoPitchSettings.continueFromSelectedHole ||
      !selectedStitchHole ||
      selectedStitchHole.shapeId !== shape.id
    ) {
      return {
        retained: [],
        sequenceStart: 0,
        generationOptions: {
          ...buildAutoPitchOptions(),
          startDistanceMm: 0,
          includeStartHole: true,
        },
        continued: false,
      }
    }

    const ordered = existingHoles
      .filter((stitchHole) => stitchHole.shapeId === shape.id)
      .slice()
      .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
    const selectedIndex = ordered.findIndex((stitchHole) => stitchHole.id === selectedStitchHole.id)
    if (selectedIndex < 0) {
      return {
        retained: [],
        sequenceStart: 0,
        generationOptions: {
          ...buildAutoPitchOptions(),
          startDistanceMm: 0,
          includeStartHole: true,
        },
        continued: false,
      }
    }

    const retained = ordered.slice(0, selectedIndex + 1)
    const terminalHole = ordered.find((stitchHole) => stitchHole.endHole === true)
    const selectedDistance = projectDistanceOnShape(shape, selectedStitchHole.point)
    const terminalDistance = terminalHole ? projectDistanceOnShape(shape, terminalHole.point) : null
    return {
      retained,
      sequenceStart: retained.length,
      generationOptions: {
        ...buildAutoPitchOptions(),
        startDistanceMm: selectedDistance,
        endDistanceMm: terminalDistance !== null && terminalDistance > selectedDistance ? terminalDistance : undefined,
        includeStartHole: false,
      },
      continued: true,
    }
  }

  const applyAutoPlacement = (
    selectedStitchShapes: Shape[],
    generator: (shape: Shape, sequenceStart: number, options: AutoPitchGenerationOptions) => StitchHole[],
  ) => {
    const selectedShapeIds = new Set(selectedStitchShapes.map((shape) => shape.id))
    let firstGeneratedId: string | null = null
    let generatedCount = 0
    let continuedCount = 0

    setStitchHoles((previous) => {
      const retainedOtherShapes = previous.filter((stitchHole) => !selectedShapeIds.has(stitchHole.shapeId))
      const nextHoles: StitchHole[] = [...retainedOtherShapes]

      for (const shape of selectedStitchShapes) {
        const continuation = buildContinuationOptions(shape, previous)
        if (continuation.continued) {
          continuedCount += 1
        }
        const generated = generator(shape, continuation.sequenceStart, continuation.generationOptions)
        generatedCount += generated.length
        if (!firstGeneratedId && generated[0]) {
          firstGeneratedId = generated[0].id
        }
        nextHoles.push(...continuation.retained, ...generated)
      }

      return normalizeStitchHoleSequences(nextHoles)
    })

    setSelectedStitchHoleId(firstGeneratedId)
    return { generatedCount, continuedCount }
  }

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

  const handleChangeStitchHoleShapeOnSelectedShapes = (renderShape: StitchHoleRenderShape) => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first to change stitch hole shape')
      return
    }
    if (selectedStitchHoleCount === 0) {
      setStatus('Selected shapes do not contain stitch holes')
      return
    }

    setStitchHoles((previous) =>
      changeStitchHoleShapesOnShapes(previous, selectedShapeIdSet, renderShape),
    )
    setStatus(
      `Changed ${selectedStitchHoleCount} stitch hole${selectedStitchHoleCount === 1 ? '' : 's'} to ${renderShape}`,
    )
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
    const { generatedCount, continuedCount } = applyAutoPlacement(selectedStitchShapes, (shape, sequenceStart, options) =>
      generateFixedPitchStitchHoles(shape, safePitch, stitchHoleDefaults, sequenceStart, options),
    )

    setStatus(
      `Auto placed ${generatedCount} stitch holes on ${selectedStitchShapes.length} path${selectedStitchShapes.length === 1 ? '' : 's'} at ${safePitch.toFixed(1)}mm pitch${continuedCount > 0 ? ` from ${continuedCount} selected continuation point${continuedCount === 1 ? '' : 's'}` : ''}`,
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
    const { generatedCount, continuedCount } = applyAutoPlacement(selectedStitchShapes, (shape, sequenceStart, options) =>
      generateVariablePitchStitchHoles(shape, safeStartPitch, safeEndPitch, stitchHoleDefaults, sequenceStart, options),
    )

    setStatus(
      `Auto placed ${generatedCount} stitch holes on ${selectedStitchShapes.length} path${selectedStitchShapes.length === 1 ? '' : 's'} using ${safeStartPitch.toFixed(1)} to ${safeEndPitch.toFixed(1)}mm pitch${continuedCount > 0 ? ` from ${continuedCount} selected continuation point${continuedCount === 1 ? '' : 's'}` : ''}`,
    )
  }

  const handleAutoPlacePreferredPitchStitchHoles = () => {
    if (stitchAutoPitchSettings.defaultMode === 'variable') {
      handleAutoPlaceVariablePitchStitchHoles()
      return
    }
    if (stitchAutoPitchSettings.defaultMode === 'set-num') {
      const input = window.prompt('Number of evenly-spaced holes (≥ 2)?', '8')
      if (input === null) {
        setStatus('Even auto-placement cancelled')
        return
      }
      const count = Number.parseInt(input.trim(), 10)
      if (!Number.isFinite(count) || count < 2) {
        setStatus('Hole count must be an integer ≥ 2')
        return
      }
      handleAutoPlaceEvenlySpacedStitchHoles(count)
      return
    }
    handleAutoPlaceFixedPitchStitchHoles()
  }

  const handleAutoPlaceEvenlySpacedStitchHoles = (count: number) => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more stitch paths first')
      return
    }
    const selectedStitchShapes = getSelectedStitchShapes()
    if (selectedStitchShapes.length === 0) {
      setStatus('Selected shapes are not stitch-role paths')
      return
    }
    if (!Number.isInteger(count) || count < 2) {
      setStatus('Hole count must be an integer ≥ 2')
      return
    }
    const { generatedCount } = applyAutoPlacement(selectedStitchShapes, (shape, sequenceStart, options) =>
      generateEvenlySpacedStitchHoles(shape, count, stitchHoleDefaults, sequenceStart, options),
    )
    setStatus(
      `Placed ${generatedCount} evenly spaced stitch hole${generatedCount === 1 ? '' : 's'} on ${selectedStitchShapes.length} path${selectedStitchShapes.length === 1 ? '' : 's'}`,
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
    handleChangeStitchHoleShapeOnSelectedShapes,
    handleClearAllStitchHoles,
    handleAutoPlacePreferredPitchStitchHoles,
    handleAutoPlaceFixedPitchStitchHoles,
    handleAutoPlaceVariablePitchStitchHoles,
    handleAutoPlaceEvenlySpacedStitchHoles,
    handleResequenceSelectedStitchHoles,
    handleSelectNextStitchHole,
    handleFixStitchHoleOrderFromSelected,
  }
}
