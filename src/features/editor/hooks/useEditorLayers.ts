import { useEditorLayerStateApi } from '../state/providers/EditorLayerStateProvider'

export function useEditorLayers() {
  return useEditorLayerStateApi()
}
