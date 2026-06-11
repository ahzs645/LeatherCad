import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import { EditorMobileShell } from './components/EditorMobileShell'
import { EditorPreviewPane } from './components/EditorPreviewPane'
import { EditorStatusBar } from './components/EditorStatusBar'
import { EditorTopbar } from './components/EditorTopbar'
import { PrecisionCommandPanel } from './components/PrecisionCommandPanel'
import type { PieceInspectorContentProps } from './components/PieceInspectorContent'
import { useEditorCanvasPaneProps } from './view-models/useEditorCanvasPaneProps'
import type { EditorWorkbenchProps } from './workbench/EditorWorkbench'
import type { DocumentInspectorPanelProps } from './workbench/DocumentInspectorPanel'
import type { SelectionInspectorPanelProps } from './workbench/SelectionInspectorPanel'
import type { WorkbenchThreeWorkspaceProps } from './workbench/WorkbenchThreeWorkspace'

type PrecisionPanelProps = Omit<ComponentProps<typeof PrecisionCommandPanel>, 'variant'>

type UseEditorWorkbenchPropsParams = {
  workspaceRef: ComponentProps<typeof EditorMobileShell>['workspaceRef']
  workspaceClassName: ComponentProps<typeof EditorMobileShell>['workspaceClassName']
  topbarProps: ComponentProps<typeof EditorTopbar>
  hideCanvasPane: boolean
  previewPaneProps: ComponentProps<typeof EditorPreviewPane>
  statusBarProps: ComponentProps<typeof EditorStatusBar>
  showPrecisionModal: boolean
  setShowPrecisionModal: Dispatch<SetStateAction<boolean>>
  toolHint: PrecisionPanelProps['toolHint']
  runPrecisionCommand: PrecisionPanelProps['onRunCommand']
  workbenchProps: Omit<EditorWorkbenchProps, 'inspectContent' | 'pieceContent' | 'previewContent' | 'documentContent' | 'twoDPane' | 'threeDPane' | 'precisionDrawer' | 'commandStrip'>
  selectionInspectorProps: SelectionInspectorPanelProps
  pieceInspectorContentProps: PieceInspectorContentProps
  documentInspectorProps: DocumentInspectorPanelProps
  workbenchThreeWorkspaceProps: Omit<WorkbenchThreeWorkspaceProps, 'children'>
  onOpenThreeWorkspace: () => void
  shouldLoadThreeWorkbench: boolean
  canvasPaneParams: Parameters<typeof useEditorCanvasPaneProps>[0]
}

export function useEditorWorkbenchProps({
  workspaceRef,
  workspaceClassName,
  topbarProps,
  hideCanvasPane,
  previewPaneProps,
  statusBarProps,
  showPrecisionModal,
  setShowPrecisionModal,
  toolHint,
  runPrecisionCommand,
  workbenchProps,
  selectionInspectorProps,
  pieceInspectorContentProps,
  documentInspectorProps,
  workbenchThreeWorkspaceProps,
  onOpenThreeWorkspace,
  shouldLoadThreeWorkbench,
  canvasPaneParams,
}: UseEditorWorkbenchPropsParams) {
  const canvasPaneProps = useEditorCanvasPaneProps(canvasPaneParams)
  const precisionPanelProps: PrecisionPanelProps = {
    open: showPrecisionModal,
    onClose: () => setShowPrecisionModal(false),
    toolHint,
    onRunCommand: runPrecisionCommand,
  }

  return {
    mobileShell: {
      workspaceRef,
      workspaceClassName,
      topbarProps,
      canvasPaneProps,
      hideCanvasPane,
      previewPaneProps,
      precisionPanelProps,
      statusBarProps,
    },
    desktopShell: {
      shouldLoadThreeWorkbench,
      workbenchProps,
      selectionInspectorProps,
      pieceInspectorContentProps,
      documentInspectorProps,
      canvasPaneProps,
      precisionPanelProps,
      workbenchThreeWorkspaceProps,
      onOpenThreeWorkspace,
    },
  }
}
