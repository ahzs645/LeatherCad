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
  setLayers: Dispatch<SetStateAction<Layer[]>>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  setShapes: Dispatch<SetStateAction<Shape[]>>
  setSketchGroups: Dispatch<SetStateAction<SketchGroup[]>>
  setHardwareMarkers: Dispatch<SetStateAction<HardwareMarker[]>>
  setConstraints: Dispatch<SetStateAction<ParametricConstraint[]>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useLayerActions(params: UseLayerActionsParams) {
  const {
    activeLayer,
    layers,
    setLayers,
    setActiveLayerId,
    setShapes,
    setSketchGroups,
    setHardwareMarkers,
    setConstraints,
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

  return {
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
  }
}
