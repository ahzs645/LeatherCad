import type { PointerEventHandler, ReactNode, RefObject } from 'react'
import type {
  DocumentBrowserNode,
  QuickAction,
  RibbonCommandGroup,
  SecondaryPreviewMode,
  WorkspaceMode,
  WorkbenchInspectorTab,
  WorkbenchRibbonTab,
} from './workbench-types'
import { DocumentBrowserDock } from './DocumentBrowserDock'
import { WorkbenchHeader } from './WorkbenchHeader'
import { WorkbenchInspectorDock } from './WorkbenchInspectorDock'
import { WorkbenchRibbon } from './WorkbenchRibbon'
import { WorkbenchStatusbar } from './WorkbenchStatusbar'
import { WorkbenchToolRail } from './WorkbenchToolRail'
import type { Tool } from '../cad/cad-types'
import type { ThemeMode } from '../editor-types'

type EditorWorkbenchProps = {
  docLabel: string
  shellRef: RefObject<HTMLElement | null>
  workspaceMode: WorkspaceMode
  secondaryPreviewMode: SecondaryPreviewMode
  showPeek: boolean
  browserWidth: number
  inspectorWidth: number
  peekWidth: number
  splitterWidth: number
  toolRailWidth: number
  quickActions: QuickAction[]
  onInvokeQuickAction: (actionId: string) => void
  onSetWorkspaceMode: (mode: WorkspaceMode) => void
  onTogglePeek: () => void
  activeRibbonTab: WorkbenchRibbonTab
  themeMode: ThemeMode
  ribbonGroups: RibbonCommandGroup[]
  onSetRibbonTab: (tab: WorkbenchRibbonTab) => void
  onInvokeRibbonCommand: (commandId: string) => void
  onSetThemeMode: (mode: ThemeMode) => void
  browserNodes: DocumentBrowserNode[]
  onActivateNode: (node: DocumentBrowserNode, multi: boolean) => void
  onToggleLayerVisibility: (layerId: string) => void
  onToggleLayerLock: (layerId: string) => void
  onToggleTracingVisibility: (overlayId: string) => void
  onToggleTracingLock: (overlayId: string) => void
  tool: Tool
  onSetActiveTool: (tool: Tool) => void
  activeInspectorTab: WorkbenchInspectorTab
  onSetActiveInspectorTab: (tab: WorkbenchInspectorTab) => void
  inspectContent: ReactNode
  pieceContent: ReactNode
  previewContent: ReactNode
  documentContent: ReactNode
  twoDPane: ReactNode
  threeDPane: ReactNode
  precisionDrawer: ReactNode
  onStartBrowserResize: PointerEventHandler<HTMLDivElement>
  onStartPeekResize: PointerEventHandler<HTMLDivElement>
  onStartInspectorResize: PointerEventHandler<HTMLDivElement>
  toolLabel: string
  selectionText: string
  zoomPercent: number
  displayUnit: 'mm' | 'in'
  activeLayerName: string
  activeLineTypeName: string
  onTogglePrecision: () => void
}

export function EditorWorkbench({
  docLabel,
  shellRef,
  workspaceMode,
  secondaryPreviewMode,
  showPeek,
  browserWidth,
  inspectorWidth,
  peekWidth,
  splitterWidth,
  toolRailWidth,
  quickActions,
  onInvokeQuickAction,
  onSetWorkspaceMode,
  onTogglePeek,
  activeRibbonTab,
  themeMode,
  ribbonGroups,
  onSetRibbonTab,
  onInvokeRibbonCommand,
  onSetThemeMode,
  browserNodes,
  onActivateNode,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onToggleTracingVisibility,
  onToggleTracingLock,
  tool,
  onSetActiveTool,
  activeInspectorTab,
  onSetActiveInspectorTab,
  inspectContent,
  pieceContent,
  previewContent,
  documentContent,
  twoDPane,
  threeDPane,
  precisionDrawer,
  onStartBrowserResize,
  onStartPeekResize,
  onStartInspectorResize,
  toolLabel,
  selectionText,
  zoomPercent,
  displayUnit,
  activeLayerName,
  activeLineTypeName,
  onTogglePrecision,
}: EditorWorkbenchProps) {
  const showThreeInMain = workspaceMode === '3d'
  const showThreeInPeek = showPeek && secondaryPreviewMode === '3d-peek'
  const showTwoDInPeek = showPeek && secondaryPreviewMode === '2d-peek'

  return (
    <div className="workbench-shell">
      <WorkbenchHeader
        docLabel={docLabel}
        quickActions={quickActions}
        workspaceMode={workspaceMode}
        secondaryPreviewMode={secondaryPreviewMode}
        activeRibbonTab={activeRibbonTab}
        themeMode={themeMode}
        onInvokeQuickAction={onInvokeQuickAction}
        onSetRibbonTab={onSetRibbonTab}
        onSetWorkspaceMode={onSetWorkspaceMode}
        onSetThemeMode={onSetThemeMode}
        onTogglePeek={onTogglePeek}
      />

      <WorkbenchRibbon
        groups={ribbonGroups}
        onInvokeCommand={onInvokeRibbonCommand}
      />

      <main
        ref={shellRef}
        className={`workbench-main ${showPeek ? 'with-peek' : 'without-peek'}`}
        data-testid="workbench-main"
        style={{
          gridTemplateColumns: showPeek
            ? `${browserWidth}px ${splitterWidth}px ${toolRailWidth}px minmax(0, 1fr) ${splitterWidth}px ${peekWidth}px ${splitterWidth}px ${inspectorWidth}px`
            : `${browserWidth}px ${splitterWidth}px ${toolRailWidth}px minmax(0, 1fr) ${splitterWidth}px ${inspectorWidth}px`,
        }}
      >
        <DocumentBrowserDock
          nodes={browserNodes}
          onActivateNode={onActivateNode}
          onToggleLayerVisibility={onToggleLayerVisibility}
          onToggleLayerLock={onToggleLayerLock}
          onToggleTracingVisibility={onToggleTracingVisibility}
          onToggleTracingLock={onToggleTracingLock}
        />

        <div
          className="workbench-splitter browser-splitter"
          data-testid="browser-splitter"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={onStartBrowserResize}
        />

        <WorkbenchToolRail tool={tool} onSetActiveTool={onSetActiveTool} />

        <div className={`workbench-surface workbench-2d-surface ${showThreeInMain ? (showTwoDInPeek ? 'in-peek' : 'hidden-surface') : 'in-main'} ${showThreeInMain ? 'read-only' : ''}`}>
          {twoDPane}
        </div>

        <div className={`workbench-surface workbench-3d-surface ${showThreeInMain ? 'in-main' : showThreeInPeek ? 'in-peek' : 'hidden-surface'} ${showThreeInMain ? '' : 'read-only'}`}>
          {threeDPane}
        </div>

        {showPeek && (
          <>
            <div
              className="workbench-splitter peek-splitter"
              data-testid="peek-splitter"
              role="separator"
              aria-orientation="vertical"
              onPointerDown={onStartPeekResize}
            />
          </>
        )}

        <div
          className="workbench-splitter inspector-splitter"
          data-testid="inspector-splitter"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={onStartInspectorResize}
        />

        <WorkbenchInspectorDock
          activeTab={activeInspectorTab}
          onSetActiveTab={onSetActiveInspectorTab}
          inspectContent={inspectContent}
          pieceContent={pieceContent}
          previewContent={previewContent}
          documentContent={documentContent}
        />
      </main>

      {precisionDrawer}

      <WorkbenchStatusbar
        toolLabel={toolLabel}
        selectionText={selectionText}
        zoomPercent={zoomPercent}
        displayUnit={displayUnit}
        activeLayerName={activeLayerName}
        activeLineTypeName={activeLineTypeName}
        onTogglePrecision={onTogglePrecision}
      />
    </div>
  )
}
