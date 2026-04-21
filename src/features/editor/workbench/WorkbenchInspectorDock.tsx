import type { ReactNode } from 'react'
import type { WorkbenchInspectorTab } from './workbench-types'
import { WorkbenchIcon } from './workbench-icons'

type WorkbenchInspectorDockProps = {
  activeTab: WorkbenchInspectorTab
  onSetActiveTab: (tab: WorkbenchInspectorTab) => void
  inspectContent: ReactNode
  pieceContent: ReactNode
  previewContent: ReactNode
  documentContent: ReactNode
  onRequestPreview3D?: () => void
  onToggleInspector: () => void
}

const TABS: Array<{ id: WorkbenchInspectorTab; label: string }> = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'piece', label: 'Piece' },
  { id: 'preview3d', label: 'Preview 3D' },
  { id: 'document', label: 'Document' },
]

export function WorkbenchInspectorDock({
  activeTab,
  onSetActiveTab,
  inspectContent,
  pieceContent,
  previewContent,
  documentContent,
  onRequestPreview3D,
  onToggleInspector,
}: WorkbenchInspectorDockProps) {
  const contentByTab: Record<WorkbenchInspectorTab, ReactNode> = {
    inspect: inspectContent,
    piece: pieceContent,
    preview3d: previewContent,
    document: documentContent,
  }

  return (
    <aside className="workbench-inspector-dock" aria-label="Inspector dock">
      <div className="workbench-inspector-tabs" role="tablist" aria-label="Inspector tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-testid={`inspector-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => {
              if (tab.id === 'preview3d' && onRequestPreview3D) {
                onRequestPreview3D()
                return
              }
              onSetActiveTab(tab.id)
            }}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          className="workbench-inspector-collapse"
          data-testid="workbench-inspector-hide"
          aria-label="Hide inspector dock"
          title="Hide inspector dock"
          onClick={onToggleInspector}
        >
          <WorkbenchIcon name="clear" />
        </button>
      </div>
      <div className="workbench-inspector-content">
        {contentByTab[activeTab]}
      </div>
    </aside>
  )
}
