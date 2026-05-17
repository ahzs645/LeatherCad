import type { ChangeEvent } from 'react'
import type { Layer, LeatherImageFill, LineTypeRole, LineTypeStyle, SnapSettings } from '../cad/cad-types'
import type { DisplayUnit } from '../ops/unit-ops'
import type { SketchWorkspaceMode, ThemeMode } from '../editor-types'
import { GRID_SPACING_OPTIONS } from '../editor-constants'
import { LayerColorSettingsSection } from '../components/LayerColorSettingsSection'
import { LeatherImageFillSection } from '../components/LeatherImageFillSection'
import { LineTypeManagerSection } from '../components/LineTypeManagerSection'

export type DocumentInspectorPanelProps = {
  displayUnit: DisplayUnit
  onSetDisplayUnit: (unit: DisplayUnit) => void
  gridSpacing: number
  onSetGridSpacing: (spacing: number) => void
  showCanvasRuler: boolean
  onToggleCanvasRuler: () => void
  showDimensions: boolean
  onToggleDimensions: () => void
  showAnnotations: boolean
  onToggleAnnotations: () => void
  sketchWorkspaceMode: SketchWorkspaceMode
  onSetSketchWorkspaceMode: (mode: SketchWorkspaceMode) => void
  themeMode: ThemeMode
  onSetThemeMode: (mode: ThemeMode) => void
  snapSettings: SnapSettings
  onUpdateSnapSettings: (patch: Partial<SnapSettings>) => void
  projectMemo: string
  onProjectMemoChange: (value: string) => void
  activeLineType: import('../cad/cad-types').LineType | null
  lineTypes: import('../cad/cad-types').LineType[]
  shapeCountsByLineType: Record<string, number>
  selectedShapeCount: number
  onAssignSelectedToActiveType: () => void
  onClearSelection: () => void
  onIsolateActiveType: () => void
  onSelectShapesByActiveType: () => void
  onSetActiveLineTypeId: (lineTypeId: string) => void
  onShowAllTypes: () => void
  onToggleLineTypeVisibility: (lineTypeId: string) => void
  onUpdateActiveLineTypeColor: (color: string) => void
  onUpdateActiveLineTypeIgnoreInPrint: (ignoreInPrint: boolean) => void
  onUpdateActiveLineTypeRole: (role: LineTypeRole) => void
  onUpdateActiveLineTypeStyle: (style: LineTypeStyle) => void
  onUpdateActiveLineTypeStrokeWidthMm: (strokeWidthMm: number) => void
  leatherImageFills: LeatherImageFill[]
  activeLeatherImageFill: LeatherImageFill | null
  onSetActiveLeatherImageFillId: (fillId: string | null) => void
  onImportLeatherImageFill: (event: ChangeEvent<HTMLInputElement>) => void
  onUpdateLeatherImageFill: (fillId: string, patch: Partial<LeatherImageFill>) => void
  onDeleteActiveLeatherImageFill: () => void
  onAssignSelectedToActiveLeatherImageFill: () => void
  onClearSelectedFromActiveLeatherImageFill: () => void
  layers: Layer[]
  activeLayer: Layer | null
  onShowAllLayers: () => void
  onHideOtherLayers: () => void
  onMergeActiveLayerIntoBelow: () => void
  onFlattenAllLayers: () => void
  layerColorsById: Record<string, string>
  layerColorOverrides: Record<string, string>
  frontLayerColor: string
  backLayerColor: string
  onFrontLayerColorChange: (color: string) => void
  onBackLayerColorChange: (color: string) => void
  onSetLayerColorOverride: (layerId: string, color: string) => void
  onClearLayerColorOverride: (layerId: string) => void
  onResetLayerColors: () => void
}

export function DocumentInspectorPanel({
  displayUnit,
  onSetDisplayUnit,
  gridSpacing,
  onSetGridSpacing,
  showCanvasRuler,
  onToggleCanvasRuler,
  showDimensions,
  onToggleDimensions,
  showAnnotations,
  onToggleAnnotations,
  sketchWorkspaceMode,
  onSetSketchWorkspaceMode,
  themeMode,
  onSetThemeMode,
  snapSettings,
  onUpdateSnapSettings,
  projectMemo,
  onProjectMemoChange,
  activeLineType,
  lineTypes,
  shapeCountsByLineType,
  selectedShapeCount,
  onAssignSelectedToActiveType,
  onClearSelection,
  onIsolateActiveType,
  onSelectShapesByActiveType,
  onSetActiveLineTypeId,
  onShowAllTypes,
  onToggleLineTypeVisibility,
  onUpdateActiveLineTypeColor,
  onUpdateActiveLineTypeIgnoreInPrint,
  onUpdateActiveLineTypeRole,
  onUpdateActiveLineTypeStyle,
  onUpdateActiveLineTypeStrokeWidthMm,
  leatherImageFills,
  activeLeatherImageFill,
  onSetActiveLeatherImageFillId,
  onImportLeatherImageFill,
  onUpdateLeatherImageFill,
  onDeleteActiveLeatherImageFill,
  onAssignSelectedToActiveLeatherImageFill,
  onClearSelectedFromActiveLeatherImageFill,
  layers,
  activeLayer,
  onShowAllLayers,
  onHideOtherLayers,
  onMergeActiveLayerIntoBelow,
  onFlattenAllLayers,
  layerColorsById,
  layerColorOverrides,
  frontLayerColor,
  backLayerColor,
  onFrontLayerColorChange,
  onBackLayerColorChange,
  onSetLayerColorOverride,
  onClearLayerColorOverride,
  onResetLayerColors,
}: DocumentInspectorPanelProps) {
  return (
    <>
      <div className="control-block">
        <h3>View + Grid</h3>
        <div className="workbench-field-grid">
          <label className="field-row">
            <span>Units</span>
            <select value={displayUnit} onChange={(event) => onSetDisplayUnit(event.target.value as DisplayUnit)}>
              <option value="mm">Millimeters</option>
              <option value="in">Inches</option>
            </select>
          </label>
          <label className="field-row">
            <span>Grid</span>
            <select value={gridSpacing} onChange={(event) => onSetGridSpacing(Number(event.target.value))}>
              {GRID_SPACING_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} mm
                </option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Workspace</span>
            <select
              value={sketchWorkspaceMode}
              onChange={(event) => onSetSketchWorkspaceMode(event.target.value as SketchWorkspaceMode)}
            >
              <option value="assembly">Assembly</option>
              <option value="sketch">Sketch</option>
            </select>
          </label>
          <label className="field-row">
            <span>Theme</span>
            <select value={themeMode} onChange={(event) => onSetThemeMode(event.target.value as ThemeMode)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
        </div>
        <div className="pattern-toggle-grid">
          <label className="layer-toggle-item">
            <input type="checkbox" checked={showCanvasRuler} onChange={onToggleCanvasRuler} />
            <span>Show ruler</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={showDimensions} onChange={onToggleDimensions} />
            <span>Show dimensions</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={showAnnotations} onChange={onToggleAnnotations} />
            <span>Show annotations</span>
          </label>
        </div>
      </div>

      <div className="control-block">
        <h3>Snap</h3>
        <div className="pattern-toggle-grid">
          <label className="layer-toggle-item">
            <input type="checkbox" checked={snapSettings.enabled} onChange={(event) => onUpdateSnapSettings({ enabled: event.target.checked })} />
            <span>Enable snapping</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={snapSettings.grid} onChange={(event) => onUpdateSnapSettings({ grid: event.target.checked })} />
            <span>Grid</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={snapSettings.endpoints} onChange={(event) => onUpdateSnapSettings({ endpoints: event.target.checked })} />
            <span>Endpoints</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={snapSettings.midpoints} onChange={(event) => onUpdateSnapSettings({ midpoints: event.target.checked })} />
            <span>Midpoints</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={snapSettings.quarterPoints ?? false}
              onChange={(event) => onUpdateSnapSettings({ quarterPoints: event.target.checked })}
            />
            <span>Quarter points (1/4 &amp; 3/4)</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={snapSettings.guides} onChange={(event) => onUpdateSnapSettings({ guides: event.target.checked })} />
            <span>Guides</span>
          </label>
          <label className="layer-toggle-item">
            <input type="checkbox" checked={snapSettings.hardware} onChange={(event) => onUpdateSnapSettings({ hardware: event.target.checked })} />
            <span>Hardware</span>
          </label>
        </div>
      </div>

      <div className="control-block">
        <h3>Project Memo</h3>
        <textarea
          className="project-memo-input workbench-project-memo"
          value={projectMemo}
          onChange={(event) => onProjectMemoChange(event.target.value.slice(0, 8000))}
          placeholder="Global project notes for this pattern..."
        />
      </div>

      <div className="control-block">
        <h3>Line Types</h3>
        <LineTypeManagerSection
          activeLineType={activeLineType}
          lineTypes={lineTypes}
          shapeCountsByLineType={shapeCountsByLineType}
          selectedShapeCount={selectedShapeCount}
          onAssignSelectedToActiveType={onAssignSelectedToActiveType}
          onClearSelection={onClearSelection}
          onIsolateActiveType={onIsolateActiveType}
          onSelectShapesByActiveType={onSelectShapesByActiveType}
          onSetActiveLineTypeId={onSetActiveLineTypeId}
          onShowAllTypes={onShowAllTypes}
          onToggleLineTypeVisibility={onToggleLineTypeVisibility}
          onUpdateActiveLineTypeColor={onUpdateActiveLineTypeColor}
          onUpdateActiveLineTypeIgnoreInPrint={onUpdateActiveLineTypeIgnoreInPrint}
          onUpdateActiveLineTypeRole={onUpdateActiveLineTypeRole}
          onUpdateActiveLineTypeStyle={onUpdateActiveLineTypeStyle}
          onUpdateActiveLineTypeStrokeWidthMm={onUpdateActiveLineTypeStrokeWidthMm}
        />
      </div>

      <div className="control-block">
        <h3>Leather Images</h3>
        <LeatherImageFillSection
          leatherImageFills={leatherImageFills}
          activeLeatherImageFill={activeLeatherImageFill}
          selectedShapeCount={selectedShapeCount}
          onSetActiveLeatherImageFillId={onSetActiveLeatherImageFillId}
          onImportLeatherImageFill={onImportLeatherImageFill}
          onUpdateLeatherImageFill={onUpdateLeatherImageFill}
          onDeleteActiveLeatherImageFill={onDeleteActiveLeatherImageFill}
          onAssignSelectedToActiveLeatherImageFill={onAssignSelectedToActiveLeatherImageFill}
          onClearSelectedFromActiveLeatherImageFill={onClearSelectedFromActiveLeatherImageFill}
        />
      </div>

      <div className="control-block">
        <h3>Layer Commands</h3>
        <div className="button-row">
          <button type="button" onClick={onShowAllLayers} disabled={layers.length === 0}>
            Show All
          </button>
          <button type="button" onClick={onHideOtherLayers} disabled={!activeLayer || layers.length < 2}>
            Hide Others
          </button>
          <button type="button" onClick={onMergeActiveLayerIntoBelow} disabled={!activeLayer || layers.length < 2}>
            Merge Below
          </button>
          <button type="button" onClick={onFlattenAllLayers} disabled={layers.length < 2}>
            Flatten All
          </button>
        </div>
      </div>

      <div className="control-block">
        <h3>Layer Colors</h3>
        <LayerColorSettingsSection
          layers={layers}
          layerColorsById={layerColorsById}
          layerColorOverrides={layerColorOverrides}
          frontLayerColor={frontLayerColor}
          backLayerColor={backLayerColor}
          onFrontLayerColorChange={onFrontLayerColorChange}
          onBackLayerColorChange={onBackLayerColorChange}
          onSetLayerColorOverride={onSetLayerColorOverride}
          onClearLayerColorOverride={onClearLayerColorOverride}
          onResetLayerColors={onResetLayerColors}
        />
      </div>
    </>
  )
}
