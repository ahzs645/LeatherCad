import type { QuickAction, SecondaryPreviewMode, WorkspaceMode, WorkbenchRibbonTab } from './workbench-types'
import { WorkbenchIcon, resolvePeekIcon, resolveQuickActionIcon } from './workbench-icons'

type WorkbenchHeaderProps = {
  docLabel: string
  quickActions: QuickAction[]
  workspaceMode: WorkspaceMode
  secondaryPreviewMode: SecondaryPreviewMode
  activeRibbonTab: WorkbenchRibbonTab
  onInvokeQuickAction: (actionId: string) => void
  onSetRibbonTab: (tab: WorkbenchRibbonTab) => void
  onSetWorkspaceMode: (mode: WorkspaceMode) => void
  onTogglePeek: () => void
}

const TABS: Array<{ id: WorkbenchRibbonTab; label: string }> = [
  { id: 'draft', label: 'Draft' },
  { id: 'modify', label: 'Modify' },
  { id: 'piece', label: 'Piece' },
  { id: 'stitch', label: 'Stitch' },
  { id: 'output', label: 'Output' },
]

export function WorkbenchHeader({
  docLabel,
  quickActions,
  workspaceMode,
  secondaryPreviewMode,
  activeRibbonTab,
  onInvokeQuickAction,
  onSetRibbonTab,
  onSetWorkspaceMode,
  onTogglePeek,
}: WorkbenchHeaderProps) {
  const peekLabel =
    secondaryPreviewMode === 'hidden'
      ? workspaceMode === '2d'
        ? 'Peek 3D'
        : 'Peek 2D'
      : 'Hide Peek'

  return (
    <header className="workbench-header">
      <div className="workbench-header-leading">
        <div className="workbench-brand">
          <div className="workbench-brand-mark">LC</div>
          <div className="workbench-brand-copy">
            <strong>LeatherCad</strong>
            <span>Compact Workbench</span>
          </div>
        </div>
        <div className="workbench-doc-label" title={docLabel}>
          <span className="workbench-doc-caption">Document</span>
          <strong>{docLabel}</strong>
        </div>
      </div>

      <div className="workbench-ribbon-tabs workbench-header-tabs" role="tablist" aria-label="Workbench ribbon tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-testid={`ribbon-tab-${tab.id}`}
            aria-selected={activeRibbonTab === tab.id}
            className={activeRibbonTab === tab.id ? 'active' : ''}
            onClick={() => onSetRibbonTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="workbench-header-trailing">
        <div className="workbench-header-actions">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="workbench-quick-action"
              disabled={action.disabled}
              aria-label={action.label}
              title={action.label}
              onClick={() => onInvokeQuickAction(action.id)}
            >
              <WorkbenchIcon name={resolveQuickActionIcon(action)} />
            </button>
          ))}
        </div>

        <div className="workbench-mode-toggle" role="tablist" aria-label="Workspace mode">
          <button
            type="button"
            className={workspaceMode === '2d' ? 'active' : ''}
            data-testid="workspace-mode-2d"
            onClick={() => onSetWorkspaceMode('2d')}
          >
            2D Draft
          </button>
          <button
            type="button"
            className={workspaceMode === '3d' ? 'active' : ''}
            data-testid="workspace-mode-3d"
            onClick={() => onSetWorkspaceMode('3d')}
          >
            3D Assembly
          </button>
        </div>

        <button type="button" className="workbench-peek-toggle" data-testid="workbench-peek-toggle" onClick={onTogglePeek}>
          <WorkbenchIcon name={resolvePeekIcon(secondaryPreviewMode)} />
          <span>{peekLabel}</span>
        </button>
      </div>
    </header>
  )
}
