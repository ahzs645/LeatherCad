import { clamp } from '../cad/cad-geometry'
import type { Layer, LineType, StitchHoleType, Tool } from '../cad/cad-types'
import { DESKTOP_RIBBON_TABS, MOBILE_OPTIONS_TABS, TOOL_OPTIONS } from '../editor-constants'
import type {
  DesktopRibbonTab,
  MobileFileAction,
  MobileLayerAction,
  MobileOptionsTab,
  MobileViewMode,
  SketchWorkspaceMode,
  ThemeMode,
} from '../editor-types'
import { StitchHolePanel } from './StitchHolePanel'
import { PRESET_DOCS } from '../data/sample-doc'

type EditorTopbarProps = {
  topbarClassName: string
  isMobileLayout: boolean
  desktopRibbonTab: DesktopRibbonTab
  onDesktopRibbonTabChange: (tab: DesktopRibbonTab) => void
  selectedShapeCount: number
  selectedStitchHoleCount: number
  showThreePreview: boolean
  onOpenHelpModal: () => void
  showToolSection: boolean
  tool: Tool
  onSetActiveTool: (tool: Tool) => void
  mobileViewMode: MobileViewMode
  onSetMobileViewMode: (mode: MobileViewMode) => void
  showMobileMenu: boolean
  onToggleMobileMenu: () => void
  mobileOptionsTab: MobileOptionsTab
  onSetMobileOptionsTab: (tab: MobileOptionsTab) => void
  showPresetSection: boolean
  selectedPresetId: string
  onSetSelectedPresetId: (presetId: string) => void
  onLoadPreset: () => void
  onSetThemeMode: (mode: ThemeMode) => void
  themeMode: ThemeMode
  showZoomSection: boolean
  sketchWorkspaceMode: SketchWorkspaceMode
  onSetSketchWorkspaceMode: (mode: SketchWorkspaceMode) => void
  onZoomOut: () => void
  onZoomIn: () => void
  onFitView: () => void
  onResetView: () => void
  showEditSection: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onCopySelection: () => void
  onCutSelection: () => void
  onPasteClipboard: () => void
  canPaste: boolean
  onDuplicateSelection: () => void
  onDeleteSelection: () => void
  onMoveSelectionBackward: () => void
  onMoveSelectionForward: () => void
  onSendSelectionToBack: () => void
  onBringSelectionToFront: () => void
  showLineTypeSection: boolean
  activeLineType: LineType | null
  lineTypes: LineType[]
  onSetActiveLineTypeId: (lineTypeId: string) => void
  onToggleActiveLineTypeVisibility: () => void
  onOpenLineTypePalette: () => void
  showStitchSection: boolean
  stitchHoleType: StitchHoleType
  onSetStitchHoleType: (type: StitchHoleType) => void
  stitchPitchMm: number
  onSetStitchPitchMm: (value: number) => void
  stitchVariablePitchStartMm: number
  stitchVariablePitchEndMm: number
  onSetStitchVariablePitchStartMm: (value: number) => void
  onSetStitchVariablePitchEndMm: (value: number) => void
  onAutoPlaceFixedPitchStitchHoles: () => void
  onAutoPlaceVariablePitchStitchHoles: () => void
  onResequenceSelectedStitchHoles: () => void
  onReverseSelectedStitchHoles: () => void
  onSelectNextStitchHole: () => void
  onFixStitchHoleOrderFromSelected: () => void
  onFixReverseStitchHoleOrderFromSelected: () => void
  showStitchSequenceLabels: boolean
  onToggleStitchSequenceLabels: () => void
  onCountStitchHolesOnSelectedShapes: () => void
  onDeleteStitchHolesOnSelectedShapes: () => void
  onClearAllStitchHoles: () => void
  selectedHoleCount: number
  stitchHoleCount: number
  hasSelectedStitchHole: boolean
  showLayerSection: boolean
  activeLayer: Layer | null
  layers: Layer[]
  layerStackLevels: Record<string, number>
  onSetActiveLayerId: (layerId: string) => void
  onClearDraft: () => void
  mobileLayerAction: MobileLayerAction
  onSetMobileLayerAction: (action: MobileLayerAction) => void
  onRunMobileLayerAction: () => void
  onAddLayer: () => void
  onRenameActiveLayer: () => void
  onToggleLayerVisibility: () => void
  onToggleLayerLock: () => void
  onMoveLayerUp: () => void
  onMoveLayerDown: () => void
  onDeleteLayer: () => void
  onOpenLayerColorModal: () => void
  showFileSection: boolean
  mobileFileAction: MobileFileAction
  onSetMobileFileAction: (action: MobileFileAction) => void
  onRunMobileFileAction: () => void
  onSaveJson: () => void
  onOpenLoadJson: () => void
  onOpenImportSvg: () => void
  onExportSvg: () => void
  onExportPdf: () => void
  onExportDxf: () => void
  onOpenExportOptionsModal: () => void
  onOpenPatternToolsModal: () => void
  onOpenTemplateRepositoryModal: () => void
  onOpenTracingImport: () => void
  onOpenTracingModal: () => void
  hasTracingOverlays: boolean
  onOpenPrintPreviewModal: () => void
  showPrintAreas: boolean
  onTogglePrintAreas: () => void
  onToggleThreePreview: () => void
  onResetDocument: () => void
}

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

export function EditorTopbar({
  topbarClassName,
  isMobileLayout,
  desktopRibbonTab,
  onDesktopRibbonTabChange,
  selectedShapeCount,
  selectedStitchHoleCount,
  showThreePreview,
  onOpenHelpModal,
  showToolSection,
  tool,
  onSetActiveTool,
  mobileViewMode,
  onSetMobileViewMode,
  showMobileMenu,
  onToggleMobileMenu,
  mobileOptionsTab,
  onSetMobileOptionsTab,
  showPresetSection,
  selectedPresetId,
  onSetSelectedPresetId,
  onLoadPreset,
  onSetThemeMode,
  themeMode,
  showZoomSection,
  sketchWorkspaceMode,
  onSetSketchWorkspaceMode,
  onZoomOut,
  onZoomIn,
  onFitView,
  onResetView,
  showEditSection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCopySelection,
  onCutSelection,
  onPasteClipboard,
  canPaste,
  onDuplicateSelection,
  onDeleteSelection,
  onMoveSelectionBackward,
  onMoveSelectionForward,
  onSendSelectionToBack,
  onBringSelectionToFront,
  showLineTypeSection,
  activeLineType,
  lineTypes,
  onSetActiveLineTypeId,
  onToggleActiveLineTypeVisibility,
  onOpenLineTypePalette,
  showStitchSection,
  stitchHoleType,
  onSetStitchHoleType,
  stitchPitchMm,
  onSetStitchPitchMm,
  stitchVariablePitchStartMm,
  stitchVariablePitchEndMm,
  onSetStitchVariablePitchStartMm,
  onSetStitchVariablePitchEndMm,
  onAutoPlaceFixedPitchStitchHoles,
  onAutoPlaceVariablePitchStitchHoles,
  onResequenceSelectedStitchHoles,
  onReverseSelectedStitchHoles,
  onSelectNextStitchHole,
  onFixStitchHoleOrderFromSelected,
  onFixReverseStitchHoleOrderFromSelected,
  showStitchSequenceLabels,
  onToggleStitchSequenceLabels,
  onCountStitchHolesOnSelectedShapes,
  onDeleteStitchHolesOnSelectedShapes,
  onClearAllStitchHoles,
  selectedHoleCount,
  stitchHoleCount,
  hasSelectedStitchHole,
  showLayerSection,
  activeLayer,
  layers,
  layerStackLevels,
  onSetActiveLayerId,
  onClearDraft,
  mobileLayerAction,
  onSetMobileLayerAction,
  onRunMobileLayerAction,
  onAddLayer,
  onRenameActiveLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onMoveLayerUp,
  onMoveLayerDown,
  onDeleteLayer,
  onOpenLayerColorModal,
  showFileSection,
  mobileFileAction,
  onSetMobileFileAction,
  onRunMobileFileAction,
  onSaveJson,
  onOpenLoadJson,
  onOpenImportSvg,
  onExportSvg,
  onExportPdf,
  onExportDxf,
  onOpenExportOptionsModal,
  onOpenPatternToolsModal,
  onOpenTemplateRepositoryModal,
  onOpenTracingImport,
  onOpenTracingModal,
  hasTracingOverlays,
  onOpenPrintPreviewModal,
  showPrintAreas,
  onTogglePrintAreas,
  onToggleThreePreview,
  onResetDocument,
}: EditorTopbarProps) {
  const renderThemeModeToggle = (className?: string) => (
    <div className={`theme-mode-toggle${className ? ` ${className}` : ''}`} role="group" aria-label="Theme mode">
      {THEME_OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={`theme-mode-button${themeMode === mode ? ' active' : ''}`}
          onClick={() => onSetThemeMode(mode)}
          aria-label={label}
          title={label}
        >
          <ThemeModeIcon mode={mode} />
        </button>
      ))}
    </div>
  )

  return (
    <header className={topbarClassName}>
      {!isMobileLayout && (
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
            <button onClick={onToggleThreePreview}>{showThreePreview ? 'Hide 3D Panel' : 'Show 3D Panel'}</button>
            {renderThemeModeToggle('desktop-theme-toggle')}
            <button
              type="button"
              className="help-button"
              onClick={onOpenHelpModal}
              aria-label="Open help"
              title="Help"
            >
              ?
            </button>
          </div>
        </div>
      )}

      <div className={`topbar-body ${isMobileLayout ? 'topbar-body-mobile' : 'desktop-ribbon-panel'}`}>
        {showToolSection && (
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
              <>
                <button className={tool === 'pan' ? 'active' : ''} onClick={() => onSetActiveTool('pan')}>
                  Move
                </button>
                <button className={tool === 'line' ? 'active' : ''} onClick={() => onSetActiveTool('line')}>
                  Line
                </button>
                <button className={tool === 'arc' ? 'active' : ''} onClick={() => onSetActiveTool('arc')}>
                  Arc
                </button>
                <button className={tool === 'bezier' ? 'active' : ''} onClick={() => onSetActiveTool('bezier')}>
                  Bezier
                </button>
                <button className={tool === 'fold' ? 'active' : ''} onClick={() => onSetActiveTool('fold')}>
                  Fold
                </button>
                <button className={tool === 'stitch-hole' ? 'active' : ''} onClick={() => onSetActiveTool('stitch-hole')}>
                  Stitch Hole
                </button>
                <button className={tool === 'hardware' ? 'active' : ''} onClick={() => onSetActiveTool('hardware')}>
                  Hardware
                </button>
              </>
            )}
            {isMobileLayout && (
              <>
                <button
                  type="button"
                  className="help-button mobile-help-toggle"
                  onClick={onOpenHelpModal}
                  aria-label="Open help"
                  title="Help"
                >
                  ?
                </button>
                <button className="mobile-menu-toggle" onClick={onToggleMobileMenu}>
                  {showMobileMenu ? 'Close' : 'Options'}
                </button>
              </>
            )}
          </div>
        )}

        {isMobileLayout && showMobileMenu && (
          <div className="group mobile-options-tabs">
            {MOBILE_OPTIONS_TABS.map((tab) => (
              <button
                key={tab.value}
                className={mobileOptionsTab === tab.value ? 'active' : ''}
                onClick={() => onSetMobileOptionsTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {showPresetSection && (
          <div className="group preset-controls ribbon-section" data-section="Workspace">
            <select
              className="preset-select"
              value={selectedPresetId}
              onChange={(event) => onSetSelectedPresetId(event.target.value)}
            >
              {PRESET_DOCS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <button onClick={onLoadPreset}>Load Preset</button>
            {isMobileLayout && renderThemeModeToggle('mobile-theme-toggle')}
          </div>
        )}

        {showZoomSection && (
          <div className="group zoom-controls ribbon-section" data-section="View">
            <div className="view-mode-toggle" role="tablist" aria-label="Workspace view mode">
              <button className={sketchWorkspaceMode === 'assembly' ? 'active' : ''} onClick={() => onSetSketchWorkspaceMode('assembly')}>
                Assembly
              </button>
              <button className={sketchWorkspaceMode === 'sketch' ? 'active' : ''} onClick={() => onSetSketchWorkspaceMode('sketch')}>
                Sketch Focus
              </button>
            </div>
            <button onClick={onZoomOut}>-</button>
            <button onClick={onZoomIn}>+</button>
            <button onClick={onFitView}>Fit</button>
            <button onClick={onResetView}>Reset</button>
          </div>
        )}

        {showEditSection && (
          <div className="group edit-controls ribbon-section" data-section="Edit">
            <button onClick={onUndo} disabled={!canUndo}>
              Undo
            </button>
            <button onClick={onRedo} disabled={!canRedo}>
              Redo
            </button>
            <button onClick={onCopySelection} disabled={selectedShapeCount === 0}>
              Copy
            </button>
            <button onClick={onCutSelection} disabled={selectedShapeCount === 0}>
              Cut
            </button>
            <button onClick={onPasteClipboard} disabled={!canPaste}>
              Paste
            </button>
            <button onClick={onDuplicateSelection} disabled={selectedShapeCount === 0}>
              Duplicate
            </button>
            <button onClick={onDeleteSelection} disabled={selectedShapeCount === 0}>
              Delete
            </button>
            <button onClick={onMoveSelectionBackward} disabled={selectedShapeCount === 0}>
              Send Back
            </button>
            <button onClick={onMoveSelectionForward} disabled={selectedShapeCount === 0}>
              Bring Forward
            </button>
            <button onClick={onSendSelectionToBack} disabled={selectedShapeCount === 0}>
              To Back
            </button>
            <button onClick={onBringSelectionToFront} disabled={selectedShapeCount === 0}>
              To Front
            </button>
          </div>
        )}

        {showLineTypeSection && (
          <div className="group line-type-controls ribbon-section" data-section="Line Types">
            <span className="line-type-label">Line Type</span>
            <select
              className="line-type-select"
              value={activeLineType?.id ?? ''}
              onChange={(event) => onSetActiveLineTypeId(event.target.value)}
            >
              {lineTypes.map((lineType) => (
                <option key={lineType.id} value={lineType.id}>
                  {lineType.name}
                  {` [${lineType.role}]`}
                  {lineType.visible ? '' : ' (hidden)'}
                </option>
              ))}
            </select>
            <button onClick={onToggleActiveLineTypeVisibility} disabled={!activeLineType}>
              {activeLineType?.visible ? 'Hide Type' : 'Show Type'}
            </button>
            <button onClick={onOpenLineTypePalette}>Palette</button>
          </div>
        )}

        {showStitchSection && (
          <div className="ribbon-section ribbon-stitch" data-section="Stitching">
            <StitchHolePanel
              holeType={stitchHoleType}
              onChangeHoleType={onSetStitchHoleType}
              pitchMm={stitchPitchMm}
              onChangePitchMm={(nextPitch) => onSetStitchPitchMm(clamp(nextPitch || 0, 0.2, 100))}
              variablePitchStartMm={stitchVariablePitchStartMm}
              variablePitchEndMm={stitchVariablePitchEndMm}
              onChangeVariablePitchStartMm={(nextPitch) => onSetStitchVariablePitchStartMm(clamp(nextPitch || 0, 0.2, 100))}
              onChangeVariablePitchEndMm={(nextPitch) => onSetStitchVariablePitchEndMm(clamp(nextPitch || 0, 0.2, 100))}
              onAutoPlaceFixedPitch={onAutoPlaceFixedPitchStitchHoles}
              onAutoPlaceVariablePitch={onAutoPlaceVariablePitchStitchHoles}
              onResequenceSelected={onResequenceSelectedStitchHoles}
              onReverseSelected={onReverseSelectedStitchHoles}
              onSelectNextHole={onSelectNextStitchHole}
              onFixOrderFromSelected={onFixStitchHoleOrderFromSelected}
              onFixReverseOrderFromSelected={onFixReverseStitchHoleOrderFromSelected}
              showSequenceLabels={showStitchSequenceLabels}
              onToggleSequenceLabels={onToggleStitchSequenceLabels}
              onCountSelected={onCountStitchHolesOnSelectedShapes}
              onDeleteOnSelected={onDeleteStitchHolesOnSelectedShapes}
              onClearAll={onClearAllStitchHoles}
              selectedShapeCount={selectedShapeCount}
              selectedHoleCount={selectedHoleCount}
              totalHoleCount={stitchHoleCount}
              hasSelectedHole={hasSelectedStitchHole}
            />
          </div>
        )}

        {showLayerSection && (
          <div className="group layer-controls ribbon-section" data-section="Layers">
            <span className="layer-label">Layer</span>
            <select
              className="layer-select"
              value={activeLayer?.id ?? ''}
              onChange={(event) => {
                onSetActiveLayerId(event.target.value)
                onClearDraft()
              }}
            >
              {layers.map((layer, index) => (
                <option key={layer.id} value={layer.id}>
                  {index + 1}. {layer.name}
                  {` [z${layerStackLevels[layer.id] ?? index}]`}
                  {layer.visible ? '' : ' (hidden)'}
                  {layer.locked ? ' (locked)' : ''}
                </option>
              ))}
            </select>
            {isMobileLayout ? (
              <div className="group mobile-action-row">
                <select
                  className="action-select"
                  value={mobileLayerAction}
                  onChange={(event) => onSetMobileLayerAction(event.target.value as MobileLayerAction)}
                >
                  <option value="add">Add Layer</option>
                  <option value="rename">Rename Layer</option>
                  <option value="toggle-visibility">{activeLayer?.visible ? 'Hide Layer' : 'Show Layer'}</option>
                  <option value="toggle-lock">{activeLayer?.locked ? 'Unlock Layer' : 'Lock Layer'}</option>
                  <option value="move-up">Move Layer Up</option>
                  <option value="move-down">Move Layer Down</option>
                  <option value="delete">Delete Layer</option>
                  <option value="colors">Layer Colors</option>
                </select>
                <button onClick={onRunMobileLayerAction} disabled={layers.length === 0}>
                  Apply
                </button>
              </div>
            ) : (
              <>
                <button onClick={onAddLayer}>+ Layer</button>
                <button onClick={onRenameActiveLayer} disabled={!activeLayer}>
                  Rename
                </button>
                <button onClick={onToggleLayerVisibility} disabled={!activeLayer}>
                  {activeLayer?.visible ? 'Hide' : 'Show'}
                </button>
                <button onClick={onToggleLayerLock} disabled={!activeLayer}>
                  {activeLayer?.locked ? 'Unlock' : 'Lock'}
                </button>
                <button onClick={onMoveLayerUp} disabled={!activeLayer || layers.length < 2}>
                  Up
                </button>
                <button onClick={onMoveLayerDown} disabled={!activeLayer || layers.length < 2}>
                  Down
                </button>
                <button onClick={onDeleteLayer} disabled={!activeLayer || layers.length < 2}>
                  Delete
                </button>
                <button onClick={onOpenLayerColorModal} disabled={layers.length === 0}>
                  Colors
                </button>
              </>
            )}
          </div>
        )}

        {showFileSection && (
          <div className="group file-controls ribbon-section" data-section="Output">
            {isMobileLayout ? (
              <div className="group mobile-action-row">
                <select
                  className="action-select"
                  value={mobileFileAction}
                  onChange={(event) => onSetMobileFileAction(event.target.value as MobileFileAction)}
                >
                  <option value="save-json">Save JSON</option>
                  <option value="load-json">Load JSON</option>
                  <option value="import-svg">Import SVG</option>
                  <option value="load-preset">Load Preset</option>
                  <option value="export-svg">Export SVG</option>
                  <option value="export-pdf">Export PDF</option>
                  <option value="export-dxf">Export DXF</option>
                  <option value="export-options">Export Options</option>
                  <option value="template-repository">Template Repository</option>
                  <option value="pattern-tools">Pattern Tools</option>
                  <option value="import-tracing">Import Tracing</option>
                  <option value="print-preview">Print Preview</option>
                  <option value="undo">Undo</option>
                  <option value="redo">Redo</option>
                  <option value="copy">Copy Selection</option>
                  <option value="paste">Paste</option>
                  <option value="delete">Delete Selection</option>
                  <option value="toggle-3d">{showThreePreview ? 'Hide 3D Panel' : 'Show 3D Panel'}</option>
                  <option value="clear">Clear Document</option>
                </select>
                <button onClick={onRunMobileFileAction}>Apply</button>
              </div>
            ) : (
              <>
                <button onClick={onSaveJson}>Save JSON</button>
                <button onClick={onOpenLoadJson}>Load JSON</button>
                <button onClick={onOpenImportSvg}>Import SVG</button>
                <button onClick={onLoadPreset}>Load Preset</button>
                <button onClick={onExportSvg}>Export SVG</button>
                <button onClick={onExportPdf}>Export PDF</button>
                <button onClick={onExportDxf}>Export DXF</button>
                <button onClick={onOpenExportOptionsModal}>Export Options</button>
                <button onClick={onOpenPatternToolsModal}>Pattern Tools</button>
                <button onClick={onOpenTemplateRepositoryModal}>Templates</button>
                <button onClick={onOpenTracingImport}>Tracing</button>
                <button onClick={onOpenTracingModal} disabled={!hasTracingOverlays}>
                  Tracing Controls
                </button>
                <button onClick={onOpenPrintPreviewModal}>Print Preview</button>
                <button onClick={onTogglePrintAreas}>{showPrintAreas ? 'Hide Print Areas' : 'Show Print Areas'}</button>
                <button onClick={onToggleThreePreview}>{showThreePreview ? 'Hide 3D' : 'Show 3D'}</button>
                <button onClick={onResetDocument}>Clear</button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
