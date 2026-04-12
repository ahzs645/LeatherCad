import { useEditorDocumentStateApi } from '../state/providers/EditorDocumentStateProvider'

export function useEditorDocumentState() {
  return useEditorDocumentStateApi()
}
