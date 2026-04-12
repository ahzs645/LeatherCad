import { useKeyboardShortcuts } from './useKeyboardShortcuts'

type UseEditorGlobalBindingsParams = Parameters<typeof useKeyboardShortcuts>[0]

export function useEditorGlobalBindings(params: UseEditorGlobalBindingsParams) {
  useKeyboardShortcuts(params)
}
