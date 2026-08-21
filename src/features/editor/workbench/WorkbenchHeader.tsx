import { useEffect, useRef, useState } from 'react'
import type { ThemeMode } from '../editor-types'
import type { QuickAction, WorkspaceMode, WorkbenchRibbonTab } from './workbench-types'
import { WorkbenchIcon } from './workbench-icons'
import { resolveQuickActionIcon } from './workbench-icon-resolvers'

type WorkbenchHeaderProps = {
  docLabel: string
  quickActions: QuickAction[]
  workspaceMode: WorkspaceMode
  activeRibbonTab: WorkbenchRibbonTab
  themeMode: ThemeMode
  onInvokeQuickAction: (actionId: string) => void
  onSetRibbonTab: (tab: WorkbenchRibbonTab) => void
  onSetWorkspaceMode: (mode: WorkspaceMode) => void
  onSetThemeMode: (mode: ThemeMode) => void
}

const TABS: Array<{ id: WorkbenchRibbonTab; label: string }> = [
  { id: 'draft', label: 'Draft' },
  { id: 'modify', label: 'Modify' },
  { id: 'piece', label: 'Piece' },
  { id: 'stitch', label: 'Stitch' },
  { id: 'output', label: 'Output' },
]

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'dark', label: 'Dark mode' },
  { mode: 'light', label: 'Light mode' },
  { mode: 'system', label: 'System mode' },
]

function ThemeModeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-mode-icon">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2.5" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="21.5" />
        <line x1="2.5" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="21.5" y2="12" />
        <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
        <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
        <line x1="5.2" y1="18.8" x2="6.9" y2="17.1" />
        <line x1="17.1" y1="6.9" x2="18.8" y2="5.2" />
      </svg>
    )
  }

  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-mode-icon">
        <path d="M21 13.4A8.4 8.4 0 1 1 10.6 3a7.1 7.1 0 1 0 10.4 10.4z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-mode-icon">
      <rect x="3.5" y="4.5" width="17" height="12" rx="1.8" />
      <line x1="12" y1="16.5" x2="12" y2="20" />
      <line x1="8.5" y1="20.5" x2="15.5" y2="20.5" />
    </svg>
  )
}

const WORKSPACE_MODES: Array<{ mode: WorkspaceMode; label: string; title: string }> = [
  { mode: '2d', label: '2D Draft', title: 'The flat pattern on its own' },
  { mode: 'both', label: 'Both', title: 'Flat pattern and model side by side' },
  { mode: '3d', label: '3D Assembly', title: 'The assembled model on its own' },
]

export function WorkbenchHeader({
  docLabel,
  quickActions,
  workspaceMode,
  activeRibbonTab,
  themeMode,
  onInvokeQuickAction,
  onSetRibbonTab,
  onSetWorkspaceMode,
  onSetThemeMode,
}: WorkbenchHeaderProps) {
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const themeButtonRef = useRef<HTMLButtonElement>(null)
  const currentThemeLabel = THEME_OPTIONS.find((option) => option.mode === themeMode)?.label ?? 'Theme mode'

  useEffect(() => {
    if (!showThemeMenu) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(event.target as Node) &&
        themeButtonRef.current &&
        !themeButtonRef.current.contains(event.target as Node)
      ) {
        setShowThemeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showThemeMenu])

  return (
    <header className="workbench-header">
      <div className="workbench-header-leading">
        <div className="workbench-brand">
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

        {/* One control for which surfaces are showing. There used to be this
            toggle *and* a separate Open 3D Workspace / Peek 2D button doing the
            same job from the other end, which left no single place to read the
            current state from. */}
        <div className="workbench-mode-toggle" role="group" aria-label="Workspace mode">
          {WORKSPACE_MODES.map((option) => (
            <button
              key={option.mode}
              type="button"
              className={workspaceMode === option.mode ? 'active' : ''}
              data-testid={`workspace-mode-${option.mode}`}
              aria-pressed={workspaceMode === option.mode}
              title={option.title}
              onClick={() => onSetWorkspaceMode(option.mode)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="workbench-theme-menu">
          <button
            ref={themeButtonRef}
            type="button"
            className={`workbench-theme-trigger${showThemeMenu ? ' active' : ''}`}
            aria-label={currentThemeLabel}
            aria-haspopup="menu"
            aria-expanded={showThemeMenu}
            title={currentThemeLabel}
            onClick={() => setShowThemeMenu((previous) => !previous)}
          >
            <ThemeModeIcon mode={themeMode} />
          </button>
          {showThemeMenu && (
            <div ref={themeMenuRef} className="workbench-theme-dropdown" role="menu" aria-label="Theme mode">
              {THEME_OPTIONS.map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  role="menuitemradio"
                  aria-checked={themeMode === mode}
                  aria-label={label}
                  title={label}
                  className={`workbench-theme-option${themeMode === mode ? ' active' : ''}`}
                  onClick={() => {
                    onSetThemeMode(mode)
                    setShowThemeMenu(false)
                  }}
                >
                  <ThemeModeIcon mode={mode} />
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
