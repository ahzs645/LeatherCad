import { useState } from 'react'
import { uid } from '../cad/cad-geometry'
import type { Layer } from '../cad/cad-types'
import {
  DEFAULT_FRONT_LAYER_COLOR,
  DEFAULT_BACK_LAYER_COLOR,
} from '../editor-constants'

export function useEditorLayers() {
  const [initialLayerId] = useState(() => uid())
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      id: initialLayerId,
      name: 'Layer 1',
      visible: true,
      locked: false,
      stackLevel: 0,
    },
  ])
  const [activeLayerId, setActiveLayerId] = useState<string>(initialLayerId)
  const [frontLayerColor, setFrontLayerColor] = useState(DEFAULT_FRONT_LAYER_COLOR)
  const [backLayerColor, setBackLayerColor] = useState(DEFAULT_BACK_LAYER_COLOR)
  const [layerColorOverrides, setLayerColorOverrides] = useState<Record<string, string>>({})

  return {
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    frontLayerColor,
    setFrontLayerColor,
    backLayerColor,
    setBackLayerColor,
    layerColorOverrides,
    setLayerColorOverrides,
  }
}
