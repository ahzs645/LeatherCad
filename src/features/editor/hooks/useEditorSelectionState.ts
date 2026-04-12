import { useEditorSelectionStateApi } from '../state/providers/EditorSelectionStateProvider'

export function useEditorSelectionState() {
  return useEditorSelectionStateApi()
}
