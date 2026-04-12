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

type WorkbenchThreeWorkspaceProps = WorkbenchThreePreviewProps & {
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
          compact={workspaceMode !== '3d'}
          interactive={workspaceMode === '3d'}
        />
      </ErrorBoundary>
    ),
    previewContent: <WorkbenchThreePreviewInspector controller={controller} />,
  })
}
