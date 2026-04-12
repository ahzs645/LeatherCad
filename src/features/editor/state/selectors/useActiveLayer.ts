import { useMemo } from 'react'
import type { Layer } from '../../cad/cad-types'

export function useActiveLayer(layers: Layer[], activeLayerId: string) {
  return useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? layers[0] ?? null,
    [activeLayerId, layers],
  )
}
