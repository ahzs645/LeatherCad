import { lazy, Suspense, type ComponentProps, type ReactNode } from 'react'
import { EditorCanvasPane } from './EditorCanvasPane'
import { ErrorBoundary } from './ErrorBoundary'
import { PieceInspectorContent, type PieceInspectorContentProps } from './PieceInspectorContent'
import { PrecisionCommandPanel } from './PrecisionCommandPanel'
import { EditorWorkbench, type EditorWorkbenchProps } from '../workbench/EditorWorkbench'
import type { DocumentInspectorPanelProps } from '../workbench/DocumentInspectorPanel'
import type { SelectionInspectorPanelProps } from '../workbench/SelectionInspectorPanel'
import { WorkbenchThreeWorkspace } from '../workbench/WorkbenchThreeWorkspace'

const SelectionInspectorPanel = lazy(() =>
  import('../workbench/SelectionInspectorPanel').then((mod) => ({ default: mod.SelectionInspectorPanel })),
)
const DocumentInspectorPanel = lazy(() =>
  import('../workbench/DocumentInspectorPanel').then((mod) => ({ default: mod.DocumentInspectorPanel })),
)

export type EditorDesktopShellProps = {
  shouldLoadThreeWorkbench: boolean
  workbenchProps: Omit<EditorWorkbenchProps, 'inspectContent' | 'pieceContent' | 'previewContent' | 'documentContent' | 'twoDPane' | 'threeDPane' | 'precisionDrawer' | 'commandStrip'>
  selectionInspectorProps: SelectionInspectorPanelProps
  pieceInspectorContentProps: PieceInspectorContentProps
  documentInspectorProps: DocumentInspectorPanelProps
  canvasPaneProps: ComponentProps<typeof EditorCanvasPane>
  precisionPanelProps: Omit<ComponentProps<typeof PrecisionCommandPanel>, 'variant'>
  workbenchThreeWorkspaceProps: Omit<ComponentProps<typeof WorkbenchThreeWorkspace>, 'children'>
  onOpenThreeWorkspace: () => void
}

export function EditorDesktopShell({
  shouldLoadThreeWorkbench,
  workbenchProps,
  selectionInspectorProps,
  pieceInspectorContentProps,
  documentInspectorProps,
  canvasPaneProps,
  precisionPanelProps,
  workbenchThreeWorkspaceProps,
  onOpenThreeWorkspace,
}: EditorDesktopShellProps) {
  const renderWorkbench = (threeDPane: ReactNode, previewContent: ReactNode) => (
    <EditorWorkbench
      {...workbenchProps}
      inspectContent={
        <Suspense fallback={<div className="control-block"><p className="hint">Loading inspector…</p></div>}>
          <SelectionInspectorPanel {...selectionInspectorProps} />
        </Suspense>
      }
      pieceContent={<PieceInspectorContent {...pieceInspectorContentProps} />}
      previewContent={previewContent}
      documentContent={
        <Suspense fallback={<div className="control-block"><p className="hint">Loading document settings…</p></div>}>
          <DocumentInspectorPanel {...documentInspectorProps} />
        </Suspense>
      }
      twoDPane={
        <ErrorBoundary>
          <EditorCanvasPane {...canvasPaneProps} />
        </ErrorBoundary>
      }
      threeDPane={threeDPane}
      precisionDrawer={<PrecisionCommandPanel {...precisionPanelProps} variant="drawer" />}
      commandStrip={<PrecisionCommandPanel {...precisionPanelProps} open variant="strip" />}
    />
  )

  const routePrompt = (
    <div className="workbench-empty-state">
      <strong>The model is not loaded in this mode.</strong>
      <p>Switch to Both or 3D Assembly to load the model and its tools.</p>
      <button type="button" onClick={onOpenThreeWorkspace}>
        Show the model
      </button>
    </div>
  )

  const loadingState = (
    <div className="workbench-empty-state">
      <strong>Loading 3D workspace…</strong>
      <p>Preparing the assembly preview and material tools.</p>
    </div>
  )

  if (!shouldLoadThreeWorkbench) {
    return renderWorkbench(routePrompt, routePrompt)
  }

  return (
    <Suspense fallback={renderWorkbench(loadingState, loadingState)}>
      <WorkbenchThreeWorkspace {...workbenchThreeWorkspaceProps}>
        {({ threeDPane, previewContent }) => renderWorkbench(threeDPane, previewContent)}
      </WorkbenchThreeWorkspace>
    </Suspense>
  )
}
