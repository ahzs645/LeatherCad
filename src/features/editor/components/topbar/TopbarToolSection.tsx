import type { Tool } from '../../cad/cad-types'
import { DESKTOP_TOOL_ICON_ITEMS, TOOL_OPTIONS } from '../../editor-constants'
import type { EditorTopbarProps } from './EditorTopbar.types'
import { TopbarSettingsDropdown } from './TopbarSettingsDropdown'

type TopbarToolSectionProps = Pick<
  EditorTopbarProps,
  | 'isMobileLayout'
  | 'tool'
  | 'onSetActiveTool'
  | 'mobileViewMode'
  | 'onSetMobileViewMode'
  | 'showMobileMenu'
  | 'onToggleMobileMenu'
  | 'showThreePreview'
  | 'onOpenPrecisionModal'
  | 'onOpenProjectMemoModal'
  | 'onOpenTemplateRepositoryModal'
  | 'displayUnit'
  | 'onSetDisplayUnit'
  | 'gridSpacing'
  | 'onSetGridSpacing'
  | 'showCanvasRuler'
  | 'onToggleCanvasRuler'
  | 'onOpenHelpModal'
>

export function TopbarToolSection({
  isMobileLayout,
  tool,
  onSetActiveTool,
  mobileViewMode,
  onSetMobileViewMode,
  showMobileMenu,
  onToggleMobileMenu,
  showThreePreview,
  onOpenPrecisionModal,
  onOpenProjectMemoModal,
  onOpenTemplateRepositoryModal,
  displayUnit,
  onSetDisplayUnit,
  gridSpacing,
  onSetGridSpacing,
  showCanvasRuler,
  onToggleCanvasRuler,
  onOpenHelpModal,
}: TopbarToolSectionProps) {
  return (
    <div className="group tool-group ribbon-section" data-section="Geometry">
      {isMobileLayout ? (
        <>
          <select
            className="tool-select-mobile"
            value={tool}
            onChange={(event) => onSetActiveTool(event.target.value as Tool)}
          >
            {TOOL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Tool: {option.label}
              </option>
            ))}
          </select>
          <div className="mobile-view-inline-tabs" role="tablist" aria-label="Mobile view mode">
            <button className={mobileViewMode === 'editor' ? 'active' : ''} onClick={() => onSetMobileViewMode('editor')}>
              2D
            </button>
            <button
              className={mobileViewMode === 'preview' ? 'active' : ''}
              onClick={() => onSetMobileViewMode('preview')}
              disabled={!showThreePreview}
            >
              3D
            </button>
            <button
              className={mobileViewMode === 'split' ? 'active' : ''}
              onClick={() => onSetMobileViewMode('split')}
              disabled={!showThreePreview}
            >
              Split
            </button>
          </div>
        </>
      ) : (
        <div className="tool-icon-grid">
          {DESKTOP_TOOL_ICON_ITEMS.map((toolItem) => (
            <button
              key={toolItem.value}
              type="button"
              className={tool === toolItem.value ? 'tool-icon-button active' : 'tool-icon-button'}
              onClick={() => onSetActiveTool(toolItem.value)}
              title={toolItem.label}
              aria-label={toolItem.label}
              data-tooltip={toolItem.label}
            >
              <span className="tool-icon-badge" aria-hidden="true">
                <img src={toolItem.iconSrc} alt="" />
              </span>
            </button>
          ))}
        </div>
      )}
      {isMobileLayout && (
        <>
          <button onClick={onOpenPrecisionModal}>Precision</button>
          <button onClick={onOpenProjectMemoModal}>Project Memo</button>
          <button onClick={onOpenTemplateRepositoryModal}>Catalog</button>
          <TopbarSettingsDropdown
            displayUnit={displayUnit}
            onSetDisplayUnit={onSetDisplayUnit}
            gridSpacing={gridSpacing}
            onSetGridSpacing={onSetGridSpacing}
            showCanvasRuler={showCanvasRuler}
            onToggleCanvasRuler={onToggleCanvasRuler}
            onOpenHelpModal={onOpenHelpModal}
            buttonClassName="mobile-help-toggle"
            iconSize={16}
          />
          <button className="mobile-menu-toggle" onClick={onToggleMobileMenu}>
            {showMobileMenu ? 'Close' : 'Options'}
          </button>
        </>
      )}
    </div>
  )
}
