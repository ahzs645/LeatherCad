import { useMemo, type ReactNode } from 'react'

type UseEditorAppControllerParams = {
  layout: {
    isMobileLayout: boolean
    resolvedThemeMode: 'dark' | 'light'
    shouldLoadThreeWorkbench: boolean
    workspaceClassName: string
  }
  commands: {
    renderDesktopWorkbench: (threeDPane: ReactNode, previewContent: ReactNode) => ReactNode
    updateFoldLine: (foldLineId: string, updates: Record<string, unknown>) => void
  }
  panes: {
    mobileShellProps: Record<string, unknown>
    workbenchThreeWorkspaceProps: Record<string, unknown>
    threeWorkspaceLoadingState: ReactNode
    threeWorkspaceRoutePrompt: ReactNode
  }
  overlays: {
    modalStack: ReactNode
    projectMemoModal: ReactNode
    pieceInspectorModal: ReactNode
    nestingModal: ReactNode
  }
  inputs: {
    hiddenInputs: ReactNode
    fontInput: ReactNode
  }
}

export function useEditorAppController(params: UseEditorAppControllerParams) {
  return useMemo(() => params, [params])
}

export type EditorAppController = ReturnType<typeof useEditorAppController>
