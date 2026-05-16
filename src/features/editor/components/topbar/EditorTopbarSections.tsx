import { clamp } from '../../cad/cad-geometry'
import { MOBILE_OPTIONS_TABS } from '../../editor-constants'
import type {
  MobileFileAction,
  MobileLayerAction,
} from '../../editor-types'
import { StitchHolePanel } from '../StitchHolePanel'
import type { EditorTopbarProps } from './EditorTopbar.types'
import { ThemeModeToggle } from './ThemeModeToggle'

export function MobileOptionsTabs({
  mobileOptionsTab,
  onSetMobileOptionsTab,
}: EditorTopbarProps) {
  return (
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
  )
}

export function WorkspaceViewSection({
  sketchWorkspaceMode,
  onSetSketchWorkspaceMode,
  showDimensions,
  onToggleDimensions,
  gridBackgroundMode,
  onSetGridBackgroundLight,
  onSetGridBackgroundDark,
  isMobileLayout,
  themeMode,
  onSetThemeMode,
}: EditorTopbarProps) {
  return (
    <div className="group zoom-controls ribbon-section" data-section="View">
      <div className="view-mode-toggle" role="tablist" aria-label="Workspace view mode">
        <button className={sketchWorkspaceMode === 'assembly' ? 'active' : ''} onClick={() => onSetSketchWorkspaceMode('assembly')}>
          Assembly
        </button>
        <button className={sketchWorkspaceMode === 'sketch' ? 'active' : ''} onClick={() => onSetSketchWorkspaceMode('sketch')}>
          Sketch Focus
        </button>
      </div>
      <button onClick={onToggleDimensions}>{showDimensions ? 'Hide Dimensions' : 'Show Dimensions'}</button>
      <div className="view-mode-toggle" role="group" aria-label="Grid background">
        <button
          className={gridBackgroundMode === 'light' ? 'active' : ''}
          onClick={onSetGridBackgroundLight}
          title="Set grid background to white"
        >
          Grid: White
        </button>
        <button
          className={gridBackgroundMode === 'dark' ? 'active' : ''}
          onClick={onSetGridBackgroundDark}
          title="Set grid background to black"
        >
          Grid: Black
        </button>
      </div>
      {isMobileLayout && (
        <ThemeModeToggle
          themeMode={themeMode}
          onSetThemeMode={onSetThemeMode}
          className="mobile-theme-toggle"
        />
      )}
    </div>
  )
}

export function TransformSection({
  selectedShapeCount,
  onAlignSelectionLeft,
  onAlignSelectionRight,
  onAlignSelectionTop,
  onAlignSelectionBottom,
  onAlignSelectionMiddleH,
  onAlignSelectionMiddleV,
  onFlipSelectionHorizontally,
  onFlipSelectionVertically,
  onReverseSelectedPaths,
  onSpecifyRotationAngle,
  onSpecifyScaleRatio,
  onSpecifyScaleRatioVertically,
  onSpecifyScaleRatioHorizontally,
  hasCustomRotationPivot,
  onClearRotationCenter,
  onSetAsRotationCenter,
  hasCustomSnapPoint,
  onClearSnapPoint,
  onSetAsSnapPoint,
  onMakeSelectedLineHorizontal,
  onMakeSelectedLineVertical,
  onLineSymmetry,
  onCenterLineBetweenSelection,
  onEditSelectedLineAngle,
  onDeleteDuplicates,
  onSplitIntoN,
  onDrawBoundaryAroundSelection,
  onFilletSelectedCorner,
  onDistanceMarkSelectedPath,
  onConvertSelectionToPath,
  onConvertACopyToPath,
  onNotchSelectedShape,
}: EditorTopbarProps) {
  return (
    <div className="group transform-controls ribbon-section" data-section="Transform">
      <button onClick={onAlignSelectionLeft} disabled={selectedShapeCount < 2}>Align L</button>
      <button onClick={onAlignSelectionRight} disabled={selectedShapeCount < 2}>Align R</button>
      <button onClick={onAlignSelectionTop} disabled={selectedShapeCount < 2}>Align T</button>
      <button onClick={onAlignSelectionBottom} disabled={selectedShapeCount < 2}>Align B</button>
      <button onClick={onAlignSelectionMiddleH} disabled={selectedShapeCount < 2}>Center H</button>
      <button onClick={onAlignSelectionMiddleV} disabled={selectedShapeCount < 2}>Center V</button>
      <button onClick={onFlipSelectionHorizontally} disabled={selectedShapeCount === 0}>Flip H</button>
      <button onClick={onFlipSelectionVertically} disabled={selectedShapeCount === 0}>Flip V</button>
      <button onClick={onReverseSelectedPaths} disabled={selectedShapeCount === 0}>Reverse Path</button>
      <button onClick={onSpecifyRotationAngle} disabled={selectedShapeCount === 0}>Rotate…</button>
      <button onClick={onSpecifyScaleRatio} disabled={selectedShapeCount === 0}>Scale…</button>
      <button onClick={onSpecifyScaleRatioHorizontally} disabled={selectedShapeCount === 0}>Scale X…</button>
      <button onClick={onSpecifyScaleRatioVertically} disabled={selectedShapeCount === 0}>Scale Y…</button>
      <button
        onClick={hasCustomRotationPivot ? onClearRotationCenter : onSetAsRotationCenter}
        disabled={selectedShapeCount === 0 && !hasCustomRotationPivot}
        title={hasCustomRotationPivot ? 'Custom rotation pivot active — click to clear' : 'Set selection center as rotation pivot'}
      >
        {hasCustomRotationPivot ? 'Clear Pivot' : 'Set Pivot'}
      </button>
      <button
        onClick={hasCustomSnapPoint ? onClearSnapPoint : onSetAsSnapPoint}
        disabled={selectedShapeCount === 0 && !hasCustomSnapPoint}
        title={hasCustomSnapPoint ? 'Custom snap anchor active — click to clear' : 'Set selection center as snap anchor'}
      >
        {hasCustomSnapPoint ? 'Clear Snap Pt' : 'Set Snap Pt'}
      </button>
      <button onClick={onMakeSelectedLineHorizontal} disabled={selectedShapeCount === 0}>Make Horiz</button>
      <button onClick={onMakeSelectedLineVertical} disabled={selectedShapeCount === 0}>Make Vert</button>
      <button onClick={onLineSymmetry} disabled={selectedShapeCount === 0}>Line Symmetry</button>
      <button onClick={onCenterLineBetweenSelection} disabled={selectedShapeCount !== 2}>Center Line</button>
      <button onClick={onEditSelectedLineAngle} disabled={selectedShapeCount === 0}>Edit Angle…</button>
      <button onClick={onDeleteDuplicates}>Dedupe</button>
      <button onClick={onSplitIntoN} disabled={selectedShapeCount === 0}>Split N…</button>
      <button onClick={onDrawBoundaryAroundSelection} disabled={selectedShapeCount === 0}>Boundary</button>
      <button onClick={onFilletSelectedCorner} disabled={selectedShapeCount !== 2}>Fillet…</button>
      <button onClick={onDistanceMarkSelectedPath} disabled={selectedShapeCount !== 1}>
        Distance Marks…
      </button>
      <button onClick={onConvertSelectionToPath} disabled={selectedShapeCount === 0}>
        → Path
      </button>
      <button onClick={onConvertACopyToPath} disabled={selectedShapeCount === 0}>
        Copy → Path
      </button>
      <button onClick={onNotchSelectedShape} disabled={selectedShapeCount !== 1}>
        Notch (Kama)…
      </button>
    </div>
  )
}

export function LineTypeSection({
  activeLineType,
  lineTypes,
  onSetActiveLineTypeId,
  onToggleActiveLineTypeVisibility,
  onOpenLineTypePalette,
}: EditorTopbarProps) {
  return (
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
  )
}

export function StitchSection({
  stitchHoleDefaults,
  onUpdateStitchHoleDefaults,
  displayUnit,
  stitchPitchMm,
  onSetStitchPitchMm,
  stitchVariablePitchStartMm,
  stitchVariablePitchEndMm,
  onSetStitchVariablePitchStartMm,
  onSetStitchVariablePitchEndMm,
  stitchAutoPitchSettings,
  onUpdateStitchAutoPitchSettings,
  onAutoPlacePreferredPitchStitchHoles,
  onAutoPlaceFixedPitchStitchHoles,
  onAutoPlaceVariablePitchStitchHoles,
  onAutoPlaceEvenlySpacedStitchHoles,
  onResequenceSelectedStitchHoles,
  onReverseSelectedStitchHoles,
  onSelectNextStitchHole,
  onFixStitchHoleOrderFromSelected,
  onFixReverseStitchHoleOrderFromSelected,
  showStitchSequenceLabels,
  onToggleStitchSequenceLabels,
  onCountStitchHolesOnSelectedShapes,
  onDeleteStitchHolesOnSelectedShapes,
  onChangeStitchHoleShapeOnSelectedShapes,
  onClearAllStitchHoles,
  selectedShapeCount,
  selectedHoleCount,
  stitchHoleCount,
  hasSelectedStitchHole,
}: EditorTopbarProps) {
  return (
    <div className="ribbon-section ribbon-stitch" data-section="Stitching">
      <StitchHolePanel
        holeDefaults={stitchHoleDefaults}
        onUpdateHoleDefaults={onUpdateStitchHoleDefaults}
        displayUnit={displayUnit}
        pitchMm={stitchPitchMm}
        onChangePitchMm={(nextPitch) => onSetStitchPitchMm(clamp(nextPitch || 0, 0.2, 100))}
        variablePitchStartMm={stitchVariablePitchStartMm}
        variablePitchEndMm={stitchVariablePitchEndMm}
        onChangeVariablePitchStartMm={(nextPitch) => onSetStitchVariablePitchStartMm(clamp(nextPitch || 0, 0.2, 100))}
        onChangeVariablePitchEndMm={(nextPitch) => onSetStitchVariablePitchEndMm(clamp(nextPitch || 0, 0.2, 100))}
        autoPitchSettings={stitchAutoPitchSettings}
        onUpdateAutoPitchSettings={onUpdateStitchAutoPitchSettings}
        onAutoPlacePreferredPitch={onAutoPlacePreferredPitchStitchHoles}
        onAutoPlaceFixedPitch={onAutoPlaceFixedPitchStitchHoles}
        onAutoPlaceVariablePitch={onAutoPlaceVariablePitchStitchHoles}
        onAutoPlaceEvenlySpaced={onAutoPlaceEvenlySpacedStitchHoles}
        onResequenceSelected={onResequenceSelectedStitchHoles}
        onReverseSelected={onReverseSelectedStitchHoles}
        onSelectNextHole={onSelectNextStitchHole}
        onFixOrderFromSelected={onFixStitchHoleOrderFromSelected}
        onFixReverseOrderFromSelected={onFixReverseStitchHoleOrderFromSelected}
        showSequenceLabels={showStitchSequenceLabels}
        onToggleSequenceLabels={onToggleStitchSequenceLabels}
        onCountSelected={onCountStitchHolesOnSelectedShapes}
        onDeleteOnSelected={onDeleteStitchHolesOnSelectedShapes}
        onChangeShapeOnSelected={onChangeStitchHoleShapeOnSelectedShapes}
        onClearAll={onClearAllStitchHoles}
        selectedShapeCount={selectedShapeCount}
        selectedHoleCount={selectedHoleCount}
        totalHoleCount={stitchHoleCount}
        hasSelectedHole={hasSelectedStitchHole}
      />
    </div>
  )
}

export function LayerSection({
  isMobileLayout,
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
  onShowAllLayers,
  onHideOtherLayers,
  onMergeActiveLayerIntoBelow,
  onFlattenAllLayers,
  onOpenLayerColorModal,
  selectedShapeCount,
  onActivateLayerOfSelectedShape,
  onHighlightShapesOnCurrentLayer,
  onMoveSelectionToAnotherLayer,
  onMoveSelectionToLayerBelow,
  onDuplicateSelectionOnLayerBelow,
  onToggleLayerIgnored,
  onToggleIndependentLayer,
}: EditorTopbarProps) {
  return (
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
            <option value="show-all">Show All Layers</option>
            <option value="hide-others">Hide Other Layers</option>
            <option value="merge-below">Merge Into Below</option>
            <option value="flatten-all">Flatten All Layers</option>
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
          <button
            onClick={onShowAllLayers}
            disabled={layers.length === 0}
            title="Show every layer"
          >
            Show All
          </button>
          <button
            onClick={onHideOtherLayers}
            disabled={!activeLayer || layers.length < 2}
            title="Hide every layer except the active layer"
          >
            Hide Others
          </button>
          <button
            onClick={onMergeActiveLayerIntoBelow}
            disabled={!activeLayer || layers.length < 2}
            title="Merge the active layer into the layer directly below it"
          >
            Merge Below
          </button>
          <button
            onClick={onFlattenAllLayers}
            disabled={layers.length < 2}
            title="Move all layer contents onto the active layer and remove the other layers"
          >
            Flatten All
          </button>
          <button onClick={onOpenLayerColorModal} disabled={layers.length === 0}>
            Colors
          </button>
          <button
            onClick={onActivateLayerOfSelectedShape}
            disabled={selectedShapeCount === 0}
            title="Activate the layer containing the selected shape"
          >
            Activate Selected
          </button>
          <button
            onClick={onHighlightShapesOnCurrentLayer}
            disabled={!activeLayer}
            title="Select all shapes on the active layer"
          >
            Highlight Layer
          </button>
          <button
            onClick={onMoveSelectionToAnotherLayer}
            disabled={selectedShapeCount === 0 || layers.length < 2}
            title="Move selection to another layer by name"
          >
            Move To Layer…
          </button>
          <button
            onClick={onMoveSelectionToLayerBelow}
            disabled={selectedShapeCount === 0 || layers.length < 2}
            title="Move selection to the layer directly below the active one"
          >
            Move To Below
          </button>
          <button
            onClick={onDuplicateSelectionOnLayerBelow}
            disabled={selectedShapeCount === 0 || layers.length < 2}
            title="Duplicate selection onto the layer directly below the active one"
          >
            Duplicate To Below
          </button>
          <button
            onClick={onToggleLayerIgnored}
            disabled={!activeLayer}
            title="Toggle whether the active layer is ignored by operations"
          >
            {activeLayer?.ignored ? 'Unignore' : 'Ignore'}
          </button>
          <button
            onClick={onToggleIndependentLayer}
            disabled={!activeLayer}
            title="Toggle whether the active layer is independent of linked-group transforms"
          >
            {activeLayer?.independent ? 'Make Linked' : 'Make Independent'}
          </button>
        </>
      )}
    </div>
  )
}

export function FileSection({
  isMobileLayout,
  mobileFileAction,
  onSetMobileFileAction,
  onRunMobileFileAction,
  onOpenLoadJson,
  onOpenImportSvg,
  onLoadPreset,
  onOpenTracingImport,
  showThreePreview,
  onOpenInNewTab,
  onOpenExportModal,
  onOpenPatternToolsModal,
  onOpenLocalProjectsModal,
  onOpenTemplateRepositoryModal,
  onOpenTracingModal,
  hasTracingOverlays,
  onToggleThreePreview,
  onResetDocument,
  onCloseProject,
  onAddBackdrop,
  onOpenFontListModal,
  onOpenSecretFeatures,
  onOpenOptionsModal,
  onImportTranslation,
  onStampSimulator,
  selectedShapeCount,
  onClearAll,
  onSelectConnectedChain,
  onOpenLengthAdjustModal,
}: EditorTopbarProps) {
  return (
    <div className="group file-controls ribbon-section" data-section="Output">
      {isMobileLayout ? (
        <div className="group mobile-action-row">
          <select
            className="action-select"
            value={mobileFileAction}
            onChange={(event) => onSetMobileFileAction(event.target.value as MobileFileAction)}
          >
            <optgroup label="Inputs">
              <option value="load-json">Load JSON</option>
              <option value="import-svg">Import SVG</option>
              <option value="load-preset">Load Preset</option>
              <option value="import-tracing">Import Tracing</option>
            </optgroup>
            <optgroup label="Exports">
              <option value="save-json">Save JSON</option>
              <option value="save-lcc">Save LCC</option>
              <option value="export-svg">Export SVG</option>
              <option value="export-pdf">Export PDF</option>
              <option value="export-dxf">Export DXF</option>
              <option value="export-options">Export Options</option>
              <option value="print-preview">Print Preview</option>
            </optgroup>
            <optgroup label="Tools">
              <option value="local-projects">Local Projects</option>
              <option value="template-repository">Template Repository</option>
              <option value="pattern-tools">Pattern Tools</option>
            </optgroup>
            <optgroup label="Edit">
              <option value="undo">Undo</option>
              <option value="redo">Redo</option>
              <option value="copy">Copy Selection</option>
              <option value="paste">Paste</option>
              <option value="delete">Delete Selection</option>
            </optgroup>
            <optgroup label="View / Reset">
              <option value="toggle-3d">{showThreePreview ? 'Hide 3D Panel' : 'Show 3D Panel'}</option>
              <option value="clear">Clear Document</option>
            </optgroup>
          </select>
          <button onClick={onRunMobileFileAction}>Apply</button>
        </div>
      ) : (
        <>
          <div className="file-action-cluster" role="group" aria-label="Input actions">
            <span className="file-action-cluster-label">Inputs</span>
            <div className="file-action-row">
              <button onClick={onOpenLoadJson}>Load JSON</button>
              <button onClick={onOpenImportSvg}>Import SVG</button>
              <button onClick={onLoadPreset}>Load Preset</button>
              <button onClick={onOpenTracingImport}>Tracing</button>
            </div>
          </div>
          <div className="file-action-cluster" role="group" aria-label="Export actions">
            <span className="file-action-cluster-label">Exports</span>
            <div className="file-action-row">
              <button onClick={onOpenInNewTab}>Open in New Tab</button>
              <button onClick={onOpenLocalProjectsModal}>Projects</button>
              <button onClick={onOpenExportModal}>Open Export Center</button>
            </div>
          </div>
          <div className="file-action-cluster" role="group" aria-label="Output tools">
            <span className="file-action-cluster-label">Tools</span>
            <div className="file-action-row">
              <button onClick={onOpenPatternToolsModal}>Pattern Tools</button>
              <button onClick={onOpenTemplateRepositoryModal}>Templates</button>
              <button onClick={onOpenTracingModal} disabled={!hasTracingOverlays}>
                Tracing Controls
              </button>
              <button onClick={onToggleThreePreview}>{showThreePreview ? 'Hide 3D' : 'Show 3D'}</button>
              <button onClick={onResetDocument}>Clear</button>
              <button onClick={onCloseProject}>Close Project…</button>
              <button onClick={onAddBackdrop}>Add Backdrop</button>
              <button onClick={onOpenFontListModal}>Fonts…</button>
              <button onClick={onOpenSecretFeatures}>Secret Features…</button>
              <button onClick={onOpenOptionsModal}>Options…</button>
              <button onClick={onImportTranslation}>Load Translation…</button>
              <button onClick={onStampSimulator} disabled={selectedShapeCount === 0}>
                Stamp Simulator…
              </button>
              <button onClick={onClearAll}>Clear All</button>
              <button onClick={onSelectConnectedChain} disabled={selectedShapeCount !== 1}>
                Select Chain
              </button>
              <button onClick={onOpenLengthAdjustModal} disabled={selectedShapeCount === 0}>
                Length Adjust…
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
