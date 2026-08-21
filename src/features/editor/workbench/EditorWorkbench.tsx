import type { PointerEventHandler, ReactNode } from 'react'
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
import { WorkbenchIcon } from './workbench-icons'
import { WorkbenchInspectorDock } from './WorkbenchInspectorDock'
import { WorkbenchRibbon } from './WorkbenchRibbon'
import { WorkbenchStatusbar } from './WorkbenchStatusbar'
import { WorkbenchToolRail } from './WorkbenchToolRail'
import type { Tool } from '../cad/cad-types'
import type { ThemeMode } from '../editor-types'

export type EditorWorkbenchProps = {
  docLabel: string
  /** Callback ref: the observer has to follow the element, which is replaced
   *  when a lazily-loaded surface suspends and resolves. */
  shellRef: (node: HTMLElement | null) => void
  workspaceMode: WorkspaceMode
  secondaryPreviewMode: SecondaryPreviewMode
  showPeek: boolean
  browserWidth: number
  inspectorWidth: number
  inspectorOpen: boolean
  inspectorRestoreWidth: number
  peekWidth: number
  splitterWidth: number
  toolRailWidth: number
  quickActions: QuickAction[]
  onInvokeQuickAction: (actionId: string) => void
  onSetWorkspaceMode: (mode: WorkspaceMode) => void
  activeRibbonTab: WorkbenchRibbonTab
  themeMode: ThemeMode
  ribbonGroups: RibbonCommandGroup[]
  onSetRibbonTab: (tab: WorkbenchRibbonTab) => void
  onInvokeRibbonCommand: (commandId: string) => void
  onSetThemeMode: (mode: ThemeMode) => void
  browserNodes: DocumentBrowserNode[]
  onActivateNode: (node: DocumentBrowserNode, multi: boolean) => void
  onToggleLayerVisibility: (layerId: string) => void
  onToggleLayerGroupVisibility: (layerIds: string[]) => void
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
  commandStrip: ReactNode
  onStartBrowserResize: PointerEventHandler<HTMLDivElement>
  onStartPeekResize: PointerEventHandler<HTMLDivElement>
  onStartInspectorResize: PointerEventHandler<HTMLDivElement>
  onToggleInspector: () => void
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
  inspectorOpen,
  inspectorRestoreWidth,
  peekWidth,
  splitterWidth,
  toolRailWidth,
  quickActions,
  onInvokeQuickAction,
  onSetWorkspaceMode,
  activeRibbonTab,
  themeMode,
  ribbonGroups,
  onSetRibbonTab,
  onInvokeRibbonCommand,
  onSetThemeMode,
  browserNodes,
  onActivateNode,
  onToggleLayerVisibility,
  onToggleLayerGroupVisibility,
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
  commandStrip,
  onStartBrowserResize,
  onStartPeekResize,
  onStartInspectorResize,
  onToggleInspector,
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
  // Side by side, both surfaces are live: an edge picked on one completes a seam
  // started on the other.
  const bothLive = workspaceMode === 'both'
  const inspectorColumns = inspectorOpen
    ? `${splitterWidth}px ${inspectorWidth}px`
    : `${inspectorRestoreWidth}px`
  const gridTemplateColumns = showPeek
    ? `${browserWidth}px ${splitterWidth}px ${toolRailWidth}px minmax(0, 1fr) ${splitterWidth}px ${peekWidth}px ${inspectorColumns}`
    : `${browserWidth}px ${splitterWidth}px ${toolRailWidth}px minmax(0, 1fr) ${inspectorColumns}`

  return (
    <div className="workbench-shell">
      <WorkbenchHeader
        docLabel={docLabel}
        quickActions={quickActions}
        workspaceMode={workspaceMode}
        activeRibbonTab={activeRibbonTab}
        themeMode={themeMode}
        onInvokeQuickAction={onInvokeQuickAction}
        onSetRibbonTab={onSetRibbonTab}
        onSetWorkspaceMode={onSetWorkspaceMode}
        onSetThemeMode={onSetThemeMode}
      />

      <WorkbenchRibbon
        groups={ribbonGroups}
        onInvokeCommand={onInvokeRibbonCommand}
      />

      <main
        ref={shellRef}
        className={`workbench-main ${showPeek ? 'with-peek' : 'without-peek'} ${inspectorOpen ? 'inspector-open' : 'inspector-closed'}`}
        data-testid="workbench-main"
        style={{
          gridTemplateColumns,
        }}
      >
        <DocumentBrowserDock
          nodes={browserNodes}
          onActivateNode={onActivateNode}
          onToggleLayerVisibility={onToggleLayerVisibility}
          onToggleLayerGroupVisibility={onToggleLayerGroupVisibility}
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

        <div className={`workbench-surface workbench-2d-surface ${showThreeInMain ? (showTwoDInPeek ? 'in-peek' : 'hidden-surface') : 'in-main'} ${showThreeInMain && !bothLive ? 'read-only' : ''}`}>
          {twoDPane}
          {commandStrip}
        </div>

        <div className={`workbench-surface workbench-3d-surface ${showThreeInMain ? 'in-main' : showThreeInPeek ? 'in-peek' : 'hidden-surface'} ${showThreeInMain || bothLive ? '' : 'read-only'}`}>
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

        {inspectorOpen ? (
          <>
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
              onToggleInspector={onToggleInspector}
              onRequestPreview3D={
                workspaceMode === '2d'
                  ? () => {
                      onSetActiveInspectorTab('preview3d')
                      onSetWorkspaceMode('3d')
                    }
                  : undefined
              }
            />
          </>
        ) : (
          <button
            type="button"
            className="workbench-inspector-restore"
            data-testid="workbench-inspector-show"
            aria-label="Show inspector dock"
            aria-expanded={false}
            title="Show inspector dock"
            onClick={onToggleInspector}
          >
            <WorkbenchIcon name="inspect" />
            <span>Inspector</span>
          </button>
        )}
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
