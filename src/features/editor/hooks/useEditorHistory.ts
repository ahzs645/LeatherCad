import { useEditorHistoryStateApi } from '../state/providers/EditorHistoryStateProvider'

export function useEditorHistory() {
  return useEditorHistoryStateApi()
}
