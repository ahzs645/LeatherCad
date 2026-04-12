import { useEditorToolStateApi } from '../state/providers/EditorToolStateProvider'

export function useEditorTools() {
  return useEditorToolStateApi()
}
