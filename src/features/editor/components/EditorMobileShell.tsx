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
        {/* The stage wrapper — not just the pane inside it — has to go when the 2D
            lane is hidden. It is a grid item, so leaving it mounted lets it claim
            the workspace's only explicit row and pushes the 3D pane into an
            auto-sized implicit row. On a phone that cost the 3D canvas 170px. */}
        <div className={`canvas-stage ${hideCanvasPane ? 'panel-hidden' : ''}`}>
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
