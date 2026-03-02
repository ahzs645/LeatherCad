import type { Dispatch, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import type {
  HardwareMarker,
  Layer,
  SeamAllowance,
  Shape,
  SketchGroup,
  StitchHole,
} from '../cad/cad-types'
import { normalizeStitchHoleSequences } from '../ops/stitch-hole-ops'
import { translateShape } from '../ops/pattern-ops'
import { SUB_SKETCH_COPY_OFFSET_MM } from '../editor-constants'
import { newSketchGroupName } from '../editor-utils'

type UseSketchGroupActionsParams = {
  activeLayer: Layer | null
  activeSketchGroup: SketchGroup | null
  selectedShapeIdSet: Set<string>
  sketchGroups: SketchGroup[]
  shapes: Shape[]
  stitchHoles: StitchHole[]
  seamAllowances: SeamAllowance[]
  hardwareMarkers: HardwareMarker[]
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setStitchHoles: Dispatch<SetStateAction<StitchHole[]>>
  setSeamAllowances: Dispatch<SetStateAction<SeamAllowance[]>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setActiveSketchGroupId: Dispatch<SetStateAction<string | null>>
  setLayers: Dispatch<SetStateAction<Layer[]>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useSketchGroupActions(params: UseSketchGroupActionsParams) {
  const {
    activeLayer,
    activeSketchGroup,
    selectedShapeIdSet,
    sketchGroups,
    shapes,
    stitchHoles,
    seamAllowances,
    hardwareMarkers,
    setSketchGroups,
    setShapes,
    setStitchHoles,
    setSeamAllowances,
    setHardwareMarkers,
    setSelectedShapeIds,
    setActiveSketchGroupId,
    setLayers,
    setStatus,
  } = params

  const handleCreateSketchGroupFromSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to create a sub-sketch')
      return
    }

    if (!activeLayer) {
      setStatus('No active layer for sub-sketch creation')
      return
    }

    const nextGroupId = uid()
    const nextGroup: SketchGroup = {
      id: nextGroupId,
      name: newSketchGroupName(sketchGroups.length),
      layerId: activeLayer.id,
      visible: true,
      locked: false,
    }

    setSketchGroups((previous) => [...previous, nextGroup])
    setShapes((previous) =>
      previous.map((shape) =>
        selectedShapeIdSet.has(shape.id)
          ? {
              ...shape,
              groupId: nextGroupId,
            }
          : shape,
      ),
    )
    setActiveSketchGroupId(nextGroupId)
    setStatus(`Created sub-sketch "${nextGroup.name}"`)
  }

  const handleRenameActiveSketchGroup = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to rename')
      return
    }

    const nextName = window.prompt('Sub-sketch name', activeSketchGroup.name)?.trim()
    if (!nextName) {
      return
    }

    setSketchGroups((previous) =>
      previous.map((group) =>
        group.id === activeSketchGroup.id
          ? {
              ...group,
              name: nextName,
            }
          : group,
      ),
    )
    setStatus(`Renamed sub-sketch to "${nextName}"`)
  }

  const handleToggleActiveSketchGroupVisibility = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to update')
      return
    }

    setSketchGroups((previous) =>
      previous.map((group) =>
        group.id === activeSketchGroup.id
          ? {
              ...group,
              visible: !group.visible,
            }
          : group,
      ),
    )
    setStatus(activeSketchGroup.visible ? 'Active sub-sketch hidden' : 'Active sub-sketch shown')
  }

  const handleToggleActiveSketchGroupLock = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to update')
      return
    }

    setSketchGroups((previous) =>
      previous.map((group) =>
        group.id === activeSketchGroup.id
          ? {
              ...group,
              locked: !group.locked,
            }
          : group,
      ),
    )
    setStatus(activeSketchGroup.locked ? 'Active sub-sketch unlocked' : 'Active sub-sketch locked')
  }

  const handleClearActiveSketchGroup = () => {
    setActiveSketchGroupId(null)
    setStatus('Active sub-sketch cleared')
  }

  const handleDeleteActiveSketchGroup = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to delete')
      return
    }

    const deleteGroupId = activeSketchGroup.id
    setSketchGroups((previous) => previous.filter((group) => group.id !== deleteGroupId))
    setShapes((previous) =>
      previous.map((shape) =>
        shape.groupId === deleteGroupId
          ? {
              ...shape,
              groupId: undefined,
            }
          : shape,
      ),
    )
    setHardwareMarkers((previous) =>
      previous.map((marker) =>
        marker.groupId === deleteGroupId
          ? {
              ...marker,
              groupId: undefined,
            }
          : marker,
      ),
    )
    setActiveSketchGroupId(null)
    setStatus('Deleted active sub-sketch')
  }

  const handleDuplicateActiveSketchGroup = () => {
    if (!activeSketchGroup) {
      setStatus('No active sub-sketch to place')
      return
    }

    const sourceShapes = shapes.filter((shape) => shape.groupId === activeSketchGroup.id)
    if (sourceShapes.length === 0) {
      setStatus('Active sub-sketch has no shapes to place')
      return
    }

    const shapeIdMap = new Map<string, string>()
    const duplicatedShapes = sourceShapes.map((shape) => {
      const nextId = uid()
      shapeIdMap.set(shape.id, nextId)
      return {
        ...translateShape(shape, SUB_SKETCH_COPY_OFFSET_MM, SUB_SKETCH_COPY_OFFSET_MM),
        id: nextId,
      }
    })
    const duplicatedShapeIds = new Set(duplicatedShapes.map((shape) => shape.id))
    const duplicatedHoles = stitchHoles
      .filter((hole) => shapeIdMap.has(hole.shapeId))
      .map((hole) => ({
        ...hole,
        id: uid(),
        shapeId: shapeIdMap.get(hole.shapeId) ?? hole.shapeId,
        point: {
          x: hole.point.x + SUB_SKETCH_COPY_OFFSET_MM,
          y: hole.point.y + SUB_SKETCH_COPY_OFFSET_MM,
        },
      }))
    const duplicatedSeamAllowances = seamAllowances
      .filter((entry) => shapeIdMap.has(entry.shapeId))
      .map((entry) => ({
        ...entry,
        id: uid(),
        shapeId: shapeIdMap.get(entry.shapeId) ?? entry.shapeId,
      }))
    const duplicatedHardware = hardwareMarkers
      .filter((marker) => marker.groupId === activeSketchGroup.id)
      .map((marker) => ({
        ...marker,
        id: uid(),
        point: {
          x: marker.point.x + SUB_SKETCH_COPY_OFFSET_MM,
          y: marker.point.y + SUB_SKETCH_COPY_OFFSET_MM,
        },
      }))

    setShapes((previous) => [...previous, ...duplicatedShapes])
    setStitchHoles((previous) => normalizeStitchHoleSequences([...previous, ...duplicatedHoles]))
    setSeamAllowances((previous) => [...previous, ...duplicatedSeamAllowances])
    setHardwareMarkers((previous) => [...previous, ...duplicatedHardware])
    setSelectedShapeIds(Array.from(duplicatedShapeIds))
    setStatus(`Placed ${duplicatedShapes.length} copied sub-sketch shape${duplicatedShapes.length === 1 ? '' : 's'}`)
  }

  const handleSetActiveLayerAnnotation = (value: string) => {
    if (!activeLayer) {
      return
    }
    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              annotation: value,
            }
          : layer,
      ),
    )
  }

  const handleSetActiveSketchAnnotation = (value: string) => {
    if (!activeSketchGroup) {
      return
    }
    setSketchGroups((previous) =>
      previous.map((group) =>
        group.id === activeSketchGroup.id
          ? {
              ...group,
              annotation: value,
            }
          : group,
      ),
    )
  }

  return {
    handleCreateSketchGroupFromSelection,
    handleRenameActiveSketchGroup,
    handleToggleActiveSketchGroupVisibility,
    handleToggleActiveSketchGroupLock,
    handleClearActiveSketchGroup,
    handleDeleteActiveSketchGroup,
    handleDuplicateActiveSketchGroup,
    handleSetActiveLayerAnnotation,
    handleSetActiveSketchAnnotation,
  }
}
