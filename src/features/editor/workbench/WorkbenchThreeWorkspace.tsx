import type { ReactNode } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import {
  WorkbenchThreePreviewInspector,
  WorkbenchThreePreviewViewport,
} from './WorkbenchThreePreview'
import {
  useWorkbenchThreePreviewController,
  type WorkbenchThreePreviewProps,
} from './useWorkbenchThreePreviewController'
import type { WorkspaceMode } from './workbench-types'

export type WorkbenchThreeWorkspaceProps = WorkbenchThreePreviewProps & {
  workspaceMode: WorkspaceMode
  children: (content: {
    threeDPane: ReactNode
    previewContent: ReactNode
  }) => ReactNode
}

export function WorkbenchThreeWorkspace({
  workspaceMode,
  children,
  ...controllerProps
}: WorkbenchThreeWorkspaceProps) {
  const controller = useWorkbenchThreePreviewController(controllerProps)

  return children({
    threeDPane: (
      <ErrorBoundary>
        <WorkbenchThreePreviewViewport
          controller={controller}
          compact={workspaceMode === '2d'}
          // Side by side, the model is live: it is where the second half of a
          // seam gets picked.
          interactive={workspaceMode !== '2d'}
        />
      </ErrorBoundary>
    ),
    previewContent: <WorkbenchThreePreviewInspector controller={controller} />,
  })
}
