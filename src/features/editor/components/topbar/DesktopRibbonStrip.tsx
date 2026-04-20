import { DESKTOP_RIBBON_TABS } from '../../editor-constants'
import type { EditorTopbarProps } from './EditorTopbar.types'
import { ThemeModeToggle } from './ThemeModeToggle'
import { TopbarSettingsDropdown } from './TopbarSettingsDropdown'

type DesktopRibbonStripProps = Pick<
  EditorTopbarProps,
  | 'desktopRibbonTab'
  | 'onDesktopRibbonTabChange'
  | 'selectedShapeCount'
  | 'selectedStitchHoleCount'
  | 'showThreePreview'
  | 'onToggleThreePreview'
  | 'onOpenPrecisionModal'
  | 'onOpenProjectMemoModal'
  | 'onOpenTemplateRepositoryModal'
  | 'themeMode'
  | 'onSetThemeMode'
  | 'displayUnit'
  | 'onSetDisplayUnit'
  | 'gridSpacing'
  | 'onSetGridSpacing'
  | 'showCanvasRuler'
  | 'onToggleCanvasRuler'
  | 'onOpenHelpModal'
>

export function DesktopRibbonStrip({
  desktopRibbonTab,
  onDesktopRibbonTabChange,
  selectedShapeCount,
  selectedStitchHoleCount,
  showThreePreview,
  onToggleThreePreview,
  onOpenPrecisionModal,
  onOpenProjectMemoModal,
  onOpenTemplateRepositoryModal,
  themeMode,
  onSetThemeMode,
  displayUnit,
  onSetDisplayUnit,
  gridSpacing,
  onSetGridSpacing,
  showCanvasRuler,
  onToggleCanvasRuler,
  onOpenHelpModal,
}: DesktopRibbonStripProps) {
  return (
    <div className="desktop-ribbon-strip">
      <div className="desktop-ribbon-brand">
        <span className="desktop-ribbon-app">LeatherCAD</span>
        <span className="desktop-ribbon-mode">Desktop Builder</span>
      </div>
      <nav className="desktop-ribbon-tabs" aria-label="Desktop ribbon tabs">
        {DESKTOP_RIBBON_TABS.map((tab) => (
          <button
            key={tab.value}
            className={desktopRibbonTab === tab.value ? 'active' : ''}
            onClick={() => onDesktopRibbonTabChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="desktop-ribbon-strip-meta">
        <span>{selectedShapeCount} selected</span>
        <span>{selectedStitchHoleCount} selected holes</span>
        <button onClick={onToggleThreePreview}>{showThreePreview ? 'Hide Panel' : 'Show Panel'}</button>
        <button onClick={onOpenPrecisionModal}>Precision</button>
        <button onClick={onOpenProjectMemoModal}>Project Memo</button>
        <button onClick={onOpenTemplateRepositoryModal}>Catalog</button>
        <ThemeModeToggle
          themeMode={themeMode}
          onSetThemeMode={onSetThemeMode}
          className="desktop-theme-toggle"
        />
        <TopbarSettingsDropdown
          displayUnit={displayUnit}
          onSetDisplayUnit={onSetDisplayUnit}
          gridSpacing={gridSpacing}
          onSetGridSpacing={onSetGridSpacing}
          showCanvasRuler={showCanvasRuler}
          onToggleCanvasRuler={onToggleCanvasRuler}
          onOpenHelpModal={onOpenHelpModal}
        />
      </div>
    </div>
  )
}
