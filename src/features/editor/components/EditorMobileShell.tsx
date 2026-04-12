import type { ComponentProps, RefObject } from 'react'
import { EditorCanvasPane } from './EditorCanvasPane'
import { ErrorBoundary } from './ErrorBoundary'
import { EditorPreviewPane } from './EditorPreviewPane'
import { EditorStatusBar } from './EditorStatusBar'
import { EditorTopbar } from './EditorTopbar'
import { PrecisionCommandPanel } from './PrecisionCommandPanel'

type EditorMobileShellProps = {
  workspaceRef: RefObject<HTMLElement | null>
  workspaceClassName: string
  topbarProps: ComponentProps<typeof EditorTopbar>
  canvasPaneProps: ComponentProps<typeof EditorCanvasPane>
  hideCanvasPane: boolean
  previewPaneProps: ComponentProps<typeof EditorPreviewPane>
  precisionPanelProps: Omit<ComponentProps<typeof PrecisionCommandPanel>, 'variant'>
  statusBarProps: ComponentProps<typeof EditorStatusBar>
}

export function EditorMobileShell({
  workspaceRef,
  workspaceClassName,
  topbarProps,
  canvasPaneProps,
  hideCanvasPane,
  previewPaneProps,
  precisionPanelProps,
  statusBarProps,
}: EditorMobileShellProps) {
  return (
    <>
      <EditorTopbar {...topbarProps} />

      <main ref={workspaceRef} className={workspaceClassName}>
        <div className="canvas-stage">
          <ErrorBoundary>
            <EditorCanvasPane {...canvasPaneProps} hideCanvasPane={hideCanvasPane} />
          </ErrorBoundary>
        </div>

        <ErrorBoundary>
          <EditorPreviewPane {...previewPaneProps} />
        </ErrorBoundary>
      </main>

      <PrecisionCommandPanel {...precisionPanelProps} />

      <EditorStatusBar {...statusBarProps} />
    </>
  )
}
