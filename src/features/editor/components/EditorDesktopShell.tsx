import type { ComponentProps, ReactNode } from 'react'
import { Suspense } from 'react'
import { WorkbenchThreeWorkspace } from '../workbench/WorkbenchThreeWorkspace'

type EditorDesktopShellProps = {
  shouldLoadThreeWorkbench: boolean
  renderDesktopWorkbench: (threeDPane: ReactNode, previewContent: ReactNode) => ReactNode
  threeWorkspaceLoadingState: ReactNode
  threeWorkspaceRoutePrompt: ReactNode
  workbenchProps: Omit<ComponentProps<typeof WorkbenchThreeWorkspace>, 'children'>
}

export function EditorDesktopShell({
  shouldLoadThreeWorkbench,
  renderDesktopWorkbench,
  threeWorkspaceLoadingState,
  threeWorkspaceRoutePrompt,
  workbenchProps,
}: EditorDesktopShellProps) {
  if (!shouldLoadThreeWorkbench) {
    return renderDesktopWorkbench(threeWorkspaceRoutePrompt, threeWorkspaceRoutePrompt)
  }

  return (
    <Suspense fallback={renderDesktopWorkbench(threeWorkspaceLoadingState, threeWorkspaceLoadingState)}>
      <WorkbenchThreeWorkspace {...workbenchProps}>
        {({ threeDPane, previewContent }) => renderDesktopWorkbench(threeDPane, previewContent)}
      </WorkbenchThreeWorkspace>
    </Suspense>
  )
}
