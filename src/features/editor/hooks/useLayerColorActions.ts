import type { Dispatch, SetStateAction } from 'react'
import { DEFAULT_BACK_LAYER_COLOR, DEFAULT_FRONT_LAYER_COLOR } from '../editor-constants'
import { normalizeHexColor } from '../editor-utils'

type UseLayerColorActionsParams = {
  layerColorsById: Record<string, string>
  setLayerColorOverrides: Dispatch<SetStateAction<Record<string, string>>>
  setFrontLayerColor: Dispatch<SetStateAction<string>>
  setBackLayerColor: Dispatch<SetStateAction<string>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useLayerColorActions(params: UseLayerColorActionsParams) {
  const {
    layerColorsById,
    setLayerColorOverrides,
    setFrontLayerColor,
    setBackLayerColor,
    setStatus,
  } = params

  const handleSetLayerColorOverride = (layerId: string, nextColor: string) => {
    const normalizedColor = normalizeHexColor(nextColor, layerColorsById[layerId] ?? DEFAULT_FRONT_LAYER_COLOR)
    setLayerColorOverrides((previous) => ({
      ...previous,
      [layerId]: normalizedColor,
    }))
  }

  const handleClearLayerColorOverride = (layerId: string) => {
    setLayerColorOverrides((previous) => {
      if (!(layerId in previous)) {
        return previous
      }
      const next = { ...previous }
      delete next[layerId]
      return next
    })
  }

  const handleResetLayerColors = () => {
    setFrontLayerColor(DEFAULT_FRONT_LAYER_COLOR)
    setBackLayerColor(DEFAULT_BACK_LAYER_COLOR)
    setLayerColorOverrides({})
    setStatus('Layer color continuum reset')
  }

  return {
    handleSetLayerColorOverride,
    handleClearLayerColorOverride,
    handleResetLayerColors,
  }
}
