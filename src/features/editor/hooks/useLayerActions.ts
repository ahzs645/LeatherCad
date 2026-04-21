import type { Dispatch, SetStateAction } from 'react'
import { uid } from '../cad/cad-geometry'
import type {
  HardwareMarker,
  Layer,
  ParametricConstraint,
  Shape,
  SketchGroup,
} from '../cad/cad-types'
import { newLayerName } from '../editor-utils'

type UseLayerActionsParams = {
  activeLayer: Layer | null
  layers: Layer[]
  shapes: Shape[]
  selectedShapeIdSet: Set<string>
  setLayers: Dispatch<SetStateAction<Layer[]>>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setSelectedShapeIds: Dispatch<SetStateAction<string[]>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useLayerActions(params: UseLayerActionsParams) {
  const {
    activeLayer,
    layers,
    shapes,
    selectedShapeIdSet,
    setLayers,
    setActiveLayerId,
    setShapes,
    setSketchGroups,
    setHardwareMarkers,
    setConstraints,
    setSelectedShapeIds,
    setStatus,
  } = params

  const handleAddLayer = () => {
    const nextLayerId = uid()
    setLayers((previous) => [
      ...previous,
      {
        id: nextLayerId,
        name: newLayerName(previous.length),
        visible: true,
        locked: false,
        stackLevel:
          previous.reduce(
            (maximum, layer, index) =>
              Math.max(
                maximum,
                typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel) ? layer.stackLevel : index,
              ),
            -1,
          ) + 1,
      },
    ])
    setActiveLayerId(nextLayerId)
    setStatus('Layer added')
  }

  const handleRenameActiveLayer = () => {
    if (!activeLayer) {
      setStatus('No active layer to rename')
      return
    }

    const nextName = window.prompt('Layer name', activeLayer.name)?.trim()
    if (!nextName) {
      return
    }

    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              name: nextName,
            }
          : layer,
      ),
    )
    setStatus(`Renamed layer to "${nextName}"`)
  }

  const handleToggleLayerVisibility = () => {
    if (!activeLayer) {
      setStatus('No active layer to update')
      return
    }

    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              visible: !layer.visible,
            }
          : layer,
      ),
    )
    setStatus(activeLayer.visible ? 'Active layer hidden' : 'Active layer shown')
  }

  const handleToggleLayerLock = () => {
    if (!activeLayer) {
      setStatus('No active layer to update')
      return
    }

    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              locked: !layer.locked,
            }
          : layer,
      ),
    )
    setStatus(activeLayer.locked ? 'Active layer unlocked' : 'Active layer locked')
  }

  const handleMoveLayer = (direction: -1 | 1) => {
    if (!activeLayer) {
      return
    }

    setLayers((previous) => {
      const index = previous.findIndex((layer) => layer.id === activeLayer.id)
      if (index < 0) {
        return previous
      }

      const target = index + direction
      if (target < 0 || target >= previous.length) {
        return previous
      }

      const next = [...previous]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setStatus(direction < 0 ? 'Moved layer up' : 'Moved layer down')
  }

  const handleDeleteLayer = () => {
    if (!activeLayer) {
      setStatus('No active layer to delete')
      return
    }

    if (layers.length === 1) {
      setStatus('Cannot delete the last remaining layer')
      return
    }

    const activeIndex = layers.findIndex((layer) => layer.id === activeLayer.id)
    if (activeIndex < 0) {
      return
    }

    const fallbackLayer = layers[activeIndex > 0 ? activeIndex - 1 : 1]
    const deleteLayerId = activeLayer.id

    setLayers((previous) => previous.filter((layer) => layer.id !== deleteLayerId))
    setActiveLayerId(fallbackLayer.id)
    setShapes((previous) =>
      previous.map((shape) =>
        shape.layerId === deleteLayerId
          ? {
              ...shape,
              layerId: fallbackLayer.id,
            }
          : shape,
      ),
    )
    setSketchGroups((previous) =>
      previous.map((group) =>
        group.layerId === deleteLayerId
          ? {
              ...group,
              layerId: fallbackLayer.id,
            }
          : group,
      ),
    )
    setHardwareMarkers((previous) =>
      previous.map((marker) =>
        marker.layerId === deleteLayerId
          ? {
              ...marker,
              layerId: fallbackLayer.id,
            }
          : marker,
      ),
    )
    setConstraints((previous) =>
      previous.map((constraint) =>
        constraint.type === 'edge-offset' && constraint.referenceLayerId === deleteLayerId
          ? {
              ...constraint,
              referenceLayerId: fallbackLayer.id,
            }
          : constraint,
      ),
    )
    setStatus(`Deleted layer and moved its shapes to "${fallbackLayer.name}"`)
  }

  const handleActivateLayerOfSelectedShape = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select a shape first to activate its layer')
      return
    }
    const firstSelectedId = selectedShapeIdSet.values().next().value
    const shape = shapes.find((entry) => entry.id === firstSelectedId)
    if (!shape) {
      setStatus('Could not resolve selection layer')
      return
    }
    const targetLayer = layers.find((layer) => layer.id === shape.layerId)
    if (!targetLayer) {
      setStatus('Selected shape references a missing layer')
      return
    }
    setActiveLayerId(targetLayer.id)
    setStatus(`Active layer set to "${targetLayer.name}"`)
  }

  const findLayerBelow = (referenceLayer: Layer | null): Layer | null => {
    if (!referenceLayer) return null
    const index = layers.findIndex((layer) => layer.id === referenceLayer.id)
    if (index < 0 || index + 1 >= layers.length) return null
    return layers[index + 1]
  }

  const retargetLayerContents = (sourceLayerId: string, targetLayerId: string) => {
    setShapes((previous) =>
      previous.map((shape) =>
        shape.layerId === sourceLayerId
          ? {
              ...shape,
              layerId: targetLayerId,
            }
          : shape,
      ),
    )
    setSketchGroups((previous) =>
      previous.map((group) =>
        group.layerId === sourceLayerId
          ? {
              ...group,
              layerId: targetLayerId,
            }
          : group,
      ),
    )
    setHardwareMarkers((previous) =>
      previous.map((marker) =>
        marker.layerId === sourceLayerId
          ? {
              ...marker,
              layerId: targetLayerId,
            }
          : marker,
      ),
    )
    setConstraints((previous) =>
      previous.map((constraint) =>
        constraint.type === 'edge-offset' && constraint.referenceLayerId === sourceLayerId
          ? {
              ...constraint,
              referenceLayerId: targetLayerId,
            }
          : constraint,
      ),
    )
  }

  const handleShowAllLayers = () => {
    if (layers.length === 0) {
      setStatus('No layers to show')
      return
    }

    setLayers((previous) => previous.map((layer) => ({ ...layer, visible: true })))
    setStatus('All layers shown')
  }

  const handleHideOtherLayers = () => {
    if (!activeLayer) {
      setStatus('No active layer to isolate')
      return
    }

    setLayers((previous) =>
      previous.map((layer) => ({
        ...layer,
        visible: layer.id === activeLayer.id,
      })),
    )
    setStatus(`Showing only "${activeLayer.name}"`)
  }

  const handleMergeActiveLayerIntoBelow = () => {
    if (!activeLayer) {
      setStatus('No active layer to merge')
      return
    }

    if (layers.length < 2) {
      setStatus('Need at least two layers to merge')
      return
    }

    const targetLayer = findLayerBelow(activeLayer)
    if (!targetLayer) {
      setStatus('No layer below the active one to merge into')
      return
    }

    if (activeLayer.locked || targetLayer.locked) {
      setStatus('Unlock the active layer and layer below before merging')
      return
    }

    retargetLayerContents(activeLayer.id, targetLayer.id)
    setLayers((previous) => previous.filter((layer) => layer.id !== activeLayer.id))
    setActiveLayerId(targetLayer.id)
    setStatus(`Merged "${activeLayer.name}" into "${targetLayer.name}"`)
  }

  const handleFlattenAllLayers = () => {
    if (layers.length < 2) {
      setStatus('Only one layer is present')
      return
    }

    const targetLayer = activeLayer ?? layers[0]
    if (!targetLayer) {
      setStatus('No layer to flatten into')
      return
    }

    const lockedLayer = layers.find((layer) => layer.locked)
    if (lockedLayer) {
      setStatus(`Unlock "${lockedLayer.name}" before flattening layers`)
      return
    }

    const targetLayerId = targetLayer.id
    setShapes((previous) =>
      previous.map((shape) =>
        shape.layerId === targetLayerId ? shape : { ...shape, layerId: targetLayerId },
      ),
    )
    setSketchGroups((previous) =>
      previous.map((group) =>
        group.layerId === targetLayerId ? group : { ...group, layerId: targetLayerId },
      ),
    )
    setHardwareMarkers((previous) =>
      previous.map((marker) =>
        marker.layerId === targetLayerId ? marker : { ...marker, layerId: targetLayerId },
      ),
    )
    setConstraints((previous) =>
      previous.map((constraint) =>
        constraint.type === 'edge-offset' && constraint.referenceLayerId !== targetLayerId
          ? {
              ...constraint,
              referenceLayerId: targetLayerId,
            }
          : constraint,
      ),
    )
    setLayers([{ ...targetLayer, visible: true, stackLevel: 0 }])
    setActiveLayerId(targetLayerId)
    setStatus(`Flattened ${layers.length} layers into "${targetLayer.name}"`)
  }

  const handleDuplicateSelectedShapesOnBelowLayer = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to duplicate')
      return
    }
    const targetLayer = findLayerBelow(activeLayer)
    if (!targetLayer) {
      setStatus('No layer below the active one to duplicate onto')
      return
    }
    const copies: Shape[] = shapes
      .filter((shape) => selectedShapeIdSet.has(shape.id))
      .map((shape) => ({ ...shape, id: uid(), layerId: targetLayer.id, groupId: undefined }))
    if (copies.length === 0) {
      setStatus('No shapes to duplicate')
      return
    }
    setShapes((previous) => [...previous, ...copies])
    setSelectedShapeIds(copies.map((shape) => shape.id))
    setActiveLayerId(targetLayer.id)
    setStatus(`Duplicated ${copies.length} shape${copies.length === 1 ? '' : 's'} to "${targetLayer.name}"`)
  }

  const handleMoveSelectedShapesToLayerBelow = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to move')
      return
    }
    const targetLayer = findLayerBelow(activeLayer)
    if (!targetLayer) {
      setStatus('No layer below the active one to move onto')
      return
    }
    setShapes((previous) =>
      previous.map((shape) =>
        selectedShapeIdSet.has(shape.id) ? { ...shape, layerId: targetLayer.id } : shape,
      ),
    )
    setStatus(`Moved ${selectedShapeIdSet.size} shape${selectedShapeIdSet.size === 1 ? '' : 's'} to "${targetLayer.name}"`)
  }

  const handleMoveSelectedShapesToLayer = (targetLayerId: string) => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to move')
      return
    }
    const targetLayer = layers.find((layer) => layer.id === targetLayerId)
    if (!targetLayer) {
      setStatus('Target layer not found')
      return
    }
    setShapes((previous) =>
      previous.map((shape) =>
        selectedShapeIdSet.has(shape.id) ? { ...shape, layerId: targetLayer.id } : shape,
      ),
    )
    setStatus(`Moved ${selectedShapeIdSet.size} shape${selectedShapeIdSet.size === 1 ? '' : 's'} to "${targetLayer.name}"`)
  }

  const handleMoveSelectedShapesToAnotherLayer = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes to move')
      return
    }
    const candidates = layers.filter((layer) => layer.id !== activeLayer?.id)
    if (candidates.length === 0) {
      setStatus('No other layer available as a move target')
      return
    }
    const promptLines = [
      'Move selected shapes to which layer? Type the layer name:',
      ...candidates.map((layer) => `- ${layer.name}`),
    ]
    const raw = window.prompt(promptLines.join('\n'), candidates[0].name)?.trim()
    if (!raw) {
      setStatus('Move cancelled')
      return
    }
    const target = candidates.find((layer) => layer.name === raw)
    if (!target) {
      setStatus(`No layer named "${raw}"`)
      return
    }
    handleMoveSelectedShapesToLayer(target.id)
  }

  const handleHighlightShapesOnCurrentLayer = () => {
    if (!activeLayer) {
      setStatus('No active layer to highlight')
      return
    }
    const layerShapeIds = shapes.filter((shape) => shape.layerId === activeLayer.id).map((shape) => shape.id)
    if (layerShapeIds.length === 0) {
      setStatus(`"${activeLayer.name}" has no shapes to highlight`)
      return
    }
    setSelectedShapeIds(layerShapeIds)
    setStatus(`Highlighted ${layerShapeIds.length} shape${layerShapeIds.length === 1 ? '' : 's'} on "${activeLayer.name}"`)
  }

  const handleToggleLayerIgnored = () => {
    if (!activeLayer) {
      setStatus('No active layer to ignore')
      return
    }
    const nextIgnored = !(activeLayer.ignored === true)
    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id ? { ...layer, ignored: nextIgnored } : layer,
      ),
    )
    setStatus(nextIgnored ? `Ignoring layer "${activeLayer.name}"` : `Layer "${activeLayer.name}" no longer ignored`)
  }

  const handleToggleIndependentLayer = () => {
    if (!activeLayer) {
      setStatus('No active layer to toggle')
      return
    }
    const nextIndependent = !(activeLayer.independent === true)
    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === activeLayer.id ? { ...layer, independent: nextIndependent } : layer,
      ),
    )
    setStatus(
      nextIndependent
        ? `Layer "${activeLayer.name}" marked independent`
        : `Layer "${activeLayer.name}" rejoined linked-group transforms`,
    )
  }

  return {
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
    handleShowAllLayers,
    handleHideOtherLayers,
    handleMergeActiveLayerIntoBelow,
    handleFlattenAllLayers,
    handleActivateLayerOfSelectedShape,
    handleDuplicateSelectedShapesOnBelowLayer,
    handleMoveSelectedShapesToLayerBelow,
    handleMoveSelectedShapesToLayer,
    handleMoveSelectedShapesToAnotherLayer,
    handleHighlightShapesOnCurrentLayer,
    handleToggleLayerIgnored,
    handleToggleIndependentLayer,
  }
}
