import { useState } from 'react'
import type { BoxStitchHelperSettings } from '../ops/box-stitch-settings'
import type { LineType } from '../cad/cad-types'
import type { StitchAutoPitchSettings } from '../editor-types'
import type { DimensionDefaults } from '../state/editor-domain-types'

type OptionsModalProps = {
  open: boolean
  autoSaveEnabled: boolean
  reverseZoomDirection: boolean
  reverseGridScrollDirection: boolean
  incrementalSelection: boolean
  mentoriWithoutCtrl: boolean
  continuousDistanceMarking: boolean
  reduceOneBlade: boolean
  highlightActiveLayer: boolean
  notchAngleDeg: number
  notchDepthMm: number
  relativeAngleStepDeg: number
  arcDrawMode: 'three-point' | 'radius' | 'half-moon'
  arcRadiusMm: number
  arcHalfMoonRatio: number
  tangentCircleMode: boolean
  tangentCircleDispStep: number
  dimensionLineTypeId: string | null
  lineTypes: LineType[]
  exportIncludeText: boolean
  exportIncludeTemplateMetadata: boolean
  lineToolConstraint: 'none' | 'horizontal' | 'vertical' | 'relative-angle'
  gridBackgroundMode: 'theme' | 'light' | 'dark'
  dimensionDefaults: DimensionDefaults
  forceFitLastPrick: boolean
  autoPitchSettings: StitchAutoPitchSettings
  boxStitchHelperSettings: BoxStitchHelperSettings
  printCalibrationXPercent: number
  printCalibrationYPercent: number
  autoHideSidebar: boolean
  pinSideBar: boolean
  loadDemoOnStartup: boolean
  translationEntryCount: number
  onImportTranslationFile: () => void
  onResetTranslation: () => void
  onChangeAutoSaveEnabled: (value: boolean) => void
  onChangeReverseZoomDirection: (value: boolean) => void
  onChangeReverseGridScrollDirection: (value: boolean) => void
  onChangeIncrementalSelection: (value: boolean) => void
  onChangeContinuousDistanceMarking: (value: boolean) => void
  onChangeReduceOneBlade: (value: boolean) => void
  onChangeHighlightActiveLayer: (value: boolean) => void
  onChangeNotchAngleDeg: (value: number) => void
  onChangeNotchDepthMm: (value: number) => void
  onChangeRelativeAngleStepDeg: (value: number) => void
  onChangeArcDrawMode: (value: 'three-point' | 'radius' | 'half-moon') => void
  onChangeArcRadiusMm: (value: number) => void
  onChangeArcHalfMoonRatio: (value: number) => void
  onChangeTangentCircleMode: (value: boolean) => void
  onChangeTangentCircleDispStep: (value: number) => void
  onChangeDimensionLineTypeId: (value: string | null) => void
  onChangeMentoriWithoutCtrl: (value: boolean) => void
  onChangeExportIncludeText: (value: boolean) => void
  onChangeExportIncludeTemplateMetadata: (value: boolean) => void
  onChangeLineToolConstraint: (value: 'none' | 'horizontal' | 'vertical' | 'relative-angle') => void
  onChangeGridBackgroundMode: (value: 'theme' | 'light' | 'dark') => void
  onChangeDimensionDefaults: (next: DimensionDefaults) => void
  onChangeForceFitLastPrick: (value: boolean) => void
  onChangeAutoPitchSettings: (next: StitchAutoPitchSettings) => void
  onChangeBoxStitchHelperSettings: (next: BoxStitchHelperSettings) => void
  onChangePrintCalibrationXPercent: (value: number) => void
  onChangePrintCalibrationYPercent: (value: number) => void
  onChangeAutoHideSidebar: (value: boolean) => void
  onChangePinSideBar: (value: boolean) => void
  onChangeLoadDemoOnStartup: (value: boolean) => void
  onOpenDimensionInspector?: () => void
  onClose: () => void
}

export function OptionsModal({
  open,
  autoSaveEnabled,
  reverseZoomDirection,
  reverseGridScrollDirection,
  incrementalSelection,
  mentoriWithoutCtrl,
  continuousDistanceMarking,
  reduceOneBlade,
  highlightActiveLayer,
  notchAngleDeg,
  notchDepthMm,
  relativeAngleStepDeg,
  arcDrawMode,
  arcRadiusMm,
  arcHalfMoonRatio,
  tangentCircleMode,
  tangentCircleDispStep,
  dimensionLineTypeId,
  lineTypes,
  exportIncludeText,
  exportIncludeTemplateMetadata,
  onChangeAutoSaveEnabled,
  onChangeReverseZoomDirection,
  onChangeReverseGridScrollDirection,
  onChangeIncrementalSelection,
  onChangeContinuousDistanceMarking,
  onChangeReduceOneBlade,
  onChangeHighlightActiveLayer,
  onChangeNotchAngleDeg,
  onChangeNotchDepthMm,
  onChangeRelativeAngleStepDeg,
  onChangeArcDrawMode,
  onChangeArcRadiusMm,
  onChangeArcHalfMoonRatio,
  onChangeTangentCircleMode,
  onChangeTangentCircleDispStep,
  onChangeDimensionLineTypeId,
  onChangeMentoriWithoutCtrl,
  onChangeExportIncludeText,
  onChangeExportIncludeTemplateMetadata,
  lineToolConstraint,
  onChangeLineToolConstraint,
  gridBackgroundMode,
  onChangeGridBackgroundMode,
  dimensionDefaults,
  onChangeDimensionDefaults,
  forceFitLastPrick,
  onChangeForceFitLastPrick,
  autoPitchSettings,
  onChangeAutoPitchSettings,
  boxStitchHelperSettings,
  onChangeBoxStitchHelperSettings,
  printCalibrationXPercent,
  printCalibrationYPercent,
  onChangePrintCalibrationXPercent,
  onChangePrintCalibrationYPercent,
  autoHideSidebar,
  pinSideBar,
  loadDemoOnStartup,
  translationEntryCount,
  onImportTranslationFile,
  onResetTranslation,
  onChangeAutoHideSidebar,
  onChangePinSideBar,
  onChangeLoadDemoOnStartup,
  onOpenDimensionInspector,
  onClose,
}: OptionsModalProps) {
  const [calibrationReferenceMm, setCalibrationReferenceMm] = useState<number>(100)
  const [measuredXMm, setMeasuredXMm] = useState<string>('')
  const [measuredYMm, setMeasuredYMm] = useState<string>('')

  const updateDimensionDefaults = <K extends keyof DimensionDefaults>(key: K, value: DimensionDefaults[K]) => {
    onChangeDimensionDefaults({ ...dimensionDefaults, [key]: value })
  }

  const updateAutoPitch = <K extends keyof StitchAutoPitchSettings>(key: K, value: StitchAutoPitchSettings[K]) => {
    onChangeAutoPitchSettings({ ...autoPitchSettings, [key]: value })
  }

  const updateBoxStitchHelper = <K extends keyof BoxStitchHelperSettings>(
    key: K,
    value: BoxStitchHelperSettings[K],
  ) => {
    onChangeBoxStitchHelperSettings({ ...boxStitchHelperSettings, [key]: value })
  }

  const applyCalibrationFromMeasured = (axis: 'x' | 'y') => {
    if (!Number.isFinite(calibrationReferenceMm) || calibrationReferenceMm <= 0) {
      return
    }
    const measuredRaw = axis === 'x' ? measuredXMm : measuredYMm
    const measured = Number.parseFloat(measuredRaw)
    if (!Number.isFinite(measured) || measured <= 0) {
      return
    }
    const percent = (calibrationReferenceMm / measured) * 100
    const clamped = Math.min(150, Math.max(50, percent))
    if (axis === 'x') {
      onChangePrintCalibrationXPercent(clamped)
    } else {
      onChangePrintCalibrationYPercent(clamped)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Options">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Options</h3>

        <section className="help-section">
          <h4>Auto-save</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => onChangeAutoSaveEnabled(e.target.checked)}
            />
            <span>Periodically snapshot the current project to browser storage</span>
          </label>
        </section>

        <section className="help-section">
          <h4>Workspace</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={autoHideSidebar}
              disabled={pinSideBar}
              onChange={(e) => onChangeAutoHideSidebar(e.target.checked)}
            />
            <span>Auto-hide the inspector sidebar to widen the workspace</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={pinSideBar}
              onChange={(e) => onChangePinSideBar(e.target.checked)}
            />
            <span>Pin sidebar (force-keep the inspector open)</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={loadDemoOnStartup}
              onChange={(e) => onChangeLoadDemoOnStartup(e.target.checked)}
            />
            <span>Load the demo project at startup</span>
          </label>
        </section>

        <section className="help-section">
          <h4>Editing</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={incrementalSelection}
              onChange={(e) => onChangeIncrementalSelection(e.target.checked)}
            />
            <span>Incremental selection (click adds to selection without Shift)</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={mentoriWithoutCtrl}
              onChange={(e) => onChangeMentoriWithoutCtrl(e.target.checked)}
            />
            <span>Chamfer (mentori) acts without holding Ctrl</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={continuousDistanceMarking}
              onChange={(e) => onChangeContinuousDistanceMarking(e.target.checked)}
            />
            <span>Continuous distance marking (prompt loops until cancelled)</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={reduceOneBlade}
              onChange={(e) => onChangeReduceOneBlade(e.target.checked)}
            />
            <span>Reduce pricking-iron blade count by one (end-of-stitch helper)</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={highlightActiveLayer}
              onChange={(e) => onChangeHighlightActiveLayer(e.target.checked)}
            />
            <span>Highlight shapes on the active layer</span>
          </label>
        </section>

        <section className="help-section">
          <h4>Notch (Kama) defaults</h4>
          <label className="field-row">
            <span>Notch depth (mm)</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={notchDepthMm}
              onChange={(event) => onChangeNotchDepthMm(Math.max(0.1, Number(event.target.value) || 1))}
            />
          </label>
          <label className="field-row">
            <span>Notch angle (°)</span>
            <input
              type="number"
              min={5}
              max={170}
              step={1}
              value={notchAngleDeg}
              onChange={(event) => onChangeNotchAngleDeg(Math.max(5, Math.min(170, Number(event.target.value) || 60)))}
            />
          </label>
        </section>

        <section className="help-section">
          <h4>Line tool constraint</h4>
          {(['none', 'horizontal', 'vertical', 'relative-angle'] as const).map((mode) => (
            <label className="layer-toggle-item" key={mode}>
              <input
                type="radio"
                name="line-tool-constraint"
                checked={lineToolConstraint === mode}
                onChange={() => onChangeLineToolConstraint(mode)}
              />
              <span>
                {mode === 'none'
                  ? 'Free'
                  : mode === 'horizontal'
                    ? 'Horizontal only'
                    : mode === 'vertical'
                      ? 'Vertical only'
                      : 'Relative angle to last line (snaps to N° steps)'}
              </span>
            </label>
          ))}
          {lineToolConstraint === 'relative-angle' ? (
            <label className="field-row">
              <span>Angle step (°)</span>
              <input
                type="number"
                min={1}
                max={180}
                step={1}
                value={relativeAngleStepDeg}
                onChange={(event) => onChangeRelativeAngleStepDeg(Math.max(1, Math.min(180, Number(event.target.value) || 15)))}
              />
            </label>
          ) : null}
        </section>

        <section className="help-section">
          <h4>Arc tool</h4>
          {(['three-point', 'radius', 'half-moon'] as const).map((mode) => (
            <label className="layer-toggle-item" key={mode}>
              <input
                type="radio"
                name="arc-draw-mode"
                checked={arcDrawMode === mode}
                onChange={() => onChangeArcDrawMode(mode)}
              />
              <span>
                {mode === 'three-point'
                  ? '3-point (click start, mid, end)'
                  : mode === 'radius'
                    ? 'Radius (click start + end, fixed radius)'
                    : 'Half-moon ratio (click start + end, ratio of chord)'}
              </span>
            </label>
          ))}
          {arcDrawMode === 'radius' ? (
            <label className="field-row">
              <span>Arc radius (mm)</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={arcRadiusMm}
                onChange={(event) => onChangeArcRadiusMm(Math.max(0.5, Number(event.target.value) || 20))}
              />
            </label>
          ) : null}
          {arcDrawMode === 'half-moon' ? (
            <label className="field-row">
              <span>Half-moon ratio (height / chord)</span>
              <input
                type="number"
                min={0.05}
                max={5}
                step={0.05}
                value={arcHalfMoonRatio}
                onChange={(event) =>
                  onChangeArcHalfMoonRatio(Math.max(0.05, Math.min(5, Number(event.target.value) || 0.5)))
                }
              />
            </label>
          ) : null}
        </section>

        <section className="help-section">
          <h4>Tangent-circle mode</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={tangentCircleMode}
              onChange={(e) => onChangeTangentCircleMode(e.target.checked)}
            />
            <span>Bias drawing toward circle-tangent contact points</span>
          </label>
          {tangentCircleMode ? (
            <label className="field-row">
              <span>Display step (segments per circle)</span>
              <input
                type="number"
                min={2}
                max={64}
                step={1}
                value={tangentCircleDispStep}
                onChange={(event) =>
                  onChangeTangentCircleDispStep(Math.max(2, Math.min(64, Math.round(Number(event.target.value) || 6))))
                }
              />
            </label>
          ) : null}
        </section>

        <section className="help-section">
          <h4>Grid background</h4>
          {(['theme', 'light', 'dark'] as const).map((mode) => (
            <label className="layer-toggle-item" key={mode}>
              <input
                type="radio"
                name="grid-background-mode"
                checked={gridBackgroundMode === mode}
                onChange={() => onChangeGridBackgroundMode(mode)}
              />
              <span>{mode === 'theme' ? 'Follow app theme' : mode === 'light' ? 'Light' : 'Dark'}</span>
            </label>
          ))}
        </section>

        <section className="help-section">
          <h4>Language</h4>
          <p className="hint">
            {translationEntryCount > 0
              ? `${translationEntryCount} translation entries loaded.`
              : 'Using built-in English. Import a TSV or JSON translation file to switch language.'}
          </p>
          <div className="line-type-modal-actions">
            <button type="button" onClick={onImportTranslationFile}>
              Import Translation File…
            </button>
            <button type="button" onClick={onResetTranslation} disabled={translationEntryCount === 0}>
              Reset to English
            </button>
          </div>
        </section>

        <section className="help-section">
          <h4>Zoom &amp; Scroll</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={reverseZoomDirection}
              onChange={(e) => onChangeReverseZoomDirection(e.target.checked)}
            />
            <span>Reverse wheel-zoom direction</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={reverseGridScrollDirection}
              onChange={(e) => onChangeReverseGridScrollDirection(e.target.checked)}
            />
            <span>Reverse arrow-key pan direction</span>
          </label>
        </section>

        <section className="help-section">
          <h4>SVG Export</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportIncludeText}
              onChange={(e) => onChangeExportIncludeText(e.target.checked)}
            />
            <span>Include text shapes</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={exportIncludeTemplateMetadata}
              onChange={(e) => onChangeExportIncludeTemplateMetadata(e.target.checked)}
            />
            <span>Include template metadata</span>
          </label>
        </section>

        <section className="help-section">
          <h4>Dimension defaults</h4>
          <label className="field-row">
            <span>Line palette for new dimensions</span>
            <select
              className="action-select"
              value={dimensionLineTypeId ?? ''}
              onChange={(event) => onChangeDimensionLineTypeId(event.target.value || null)}
            >
              <option value="">Use active line type</option>
              {lineTypes.map((lineType) => (
                <option key={lineType.id} value={lineType.id}>
                  {lineType.name}
                </option>
              ))}
            </select>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={dimensionDefaults.arrowOnly}
              onChange={(e) => updateDimensionDefaults('arrowOnly', e.target.checked)}
            />
            <span>Arrow only (no value text)</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={dimensionDefaults.singleLine}
              onChange={(e) => updateDimensionDefaults('singleLine', e.target.checked)}
            />
            <span>Single measure line (do not split around label)</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={dimensionDefaults.textInside}
              onChange={(e) => updateDimensionDefaults('textInside', e.target.checked)}
            />
            <span>Place text inside the dimension line</span>
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={dimensionDefaults.textReverse}
              onChange={(e) => updateDimensionDefaults('textReverse', e.target.checked)}
            />
            <span>Reverse text orientation (180°)</span>
          </label>
          <label className="layer-toggle-item">
            <span>Default font size (mm)</span>
            <input
              type="number"
              min={1}
              max={50}
              step={0.5}
              value={dimensionDefaults.fontSizeMm}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  updateDimensionDefaults('fontSizeMm', next)
                }
              }}
            />
          </label>
          <label className="layer-toggle-item">
            <span>Default precision (decimals)</span>
            <input
              type="number"
              min={0}
              max={6}
              step={1}
              value={dimensionDefaults.precision}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10)
                if (Number.isFinite(next) && next >= 0) {
                  updateDimensionDefaults('precision', Math.min(6, next))
                }
              }}
            />
          </label>
          {onOpenDimensionInspector && (
            <button
              type="button"
              onClick={() => {
                onOpenDimensionInspector()
                onClose()
              }}
            >
              Open per-dimension inspector…
            </button>
          )}
        </section>

        <section className="help-section">
          <h4>Stitching defaults</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={forceFitLastPrick}
              onChange={(e) => onChangeForceFitLastPrick(e.target.checked)}
            />
            <span>Force last pricking iron tooth to land on path endpoint</span>
          </label>
        </section>

        <section className="help-section">
          <h4>Auto pitch</h4>
          <p className="options-modal-hint">
            Default behaviour for the auto-pitch hole solver (used when you draw a stitch line without an explicit
            pitch override).
          </p>
          <div className="control-block">
            <span>Default mode</span>
            {(['fixed', 'variable'] as const).map((mode) => (
              <label className="layer-toggle-item" key={mode}>
                <input
                  type="radio"
                  name="auto-pitch-default-mode"
                  checked={autoPitchSettings.defaultMode === mode}
                  onChange={() => updateAutoPitch('defaultMode', mode)}
                />
                <span>
                  {mode === 'fixed' ? 'Fixed pitch (every hole equal)' : 'Variable pitch (solver fits start → end)'}
                </span>
              </label>
            ))}
          </div>
          <label className="layer-toggle-item">
            <span>Solver steps</span>
            <input
              type="number"
              min={2}
              max={24}
              step={1}
              value={autoPitchSettings.solverSteps}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10)
                if (Number.isFinite(next) && next >= 2) {
                  updateAutoPitch('solverSteps', Math.min(24, Math.max(2, next)))
                }
              }}
            />
          </label>
          <label className="layer-toggle-item">
            <span>Precision (mm)</span>
            <input
              type="number"
              min={0.01}
              max={5}
              step={0.01}
              value={autoPitchSettings.precisionMm}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  updateAutoPitch('precisionMm', Math.min(5, Math.max(0.01, next)))
                }
              }}
            />
          </label>
          <label className="layer-toggle-item">
            <span>Stop gap allowance (mm)</span>
            <input
              type="number"
              min={0.1}
              max={25}
              step={0.1}
              value={autoPitchSettings.stopGapMm}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  updateAutoPitch('stopGapMm', Math.min(25, Math.max(0.1, next)))
                }
              }}
            />
          </label>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={autoPitchSettings.continueFromSelectedHole}
              onChange={(e) => updateAutoPitch('continueFromSelectedHole', e.target.checked)}
            />
            <span>Continue from the selected hole when re-running auto pitch</span>
          </label>
        </section>

        <section className="help-section">
          <h4>Box stitch helper</h4>
          <p className="options-modal-hint">
            Defaults used when opening the box stitch helper. Search distance gates how far guide candidates are
            accepted from a piece edge.
          </p>
          <label className="layer-toggle-item">
            <span>Search distance (mm)</span>
            <input
              type="number"
              min={0.1}
              max={50}
              step={0.1}
              value={boxStitchHelperSettings.distanceMm}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  updateBoxStitchHelper('distanceMm', Math.min(50, Math.max(0.1, next)))
                }
              }}
            />
          </label>
          <label className="layer-toggle-item">
            <span>Stretch compensation (%)</span>
            <input
              type="number"
              min={25}
              max={250}
              step={1}
              value={boxStitchHelperSettings.stretchCompensationPercent}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  updateBoxStitchHelper(
                    'stretchCompensationPercent',
                    Math.min(250, Math.max(25, next)),
                  )
                }
              }}
            />
          </label>
        </section>

        <section className="help-section">
          <h4>Print calibration</h4>
          <p className="options-modal-hint">
            Compensate for printer scale errors. 100 % matches the ruler test square exactly.
          </p>
          <label className="layer-toggle-item">
            <span>X-axis calibration (%)</span>
            <input
              type="number"
              min={50}
              max={150}
              step={0.1}
              value={printCalibrationXPercent}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  onChangePrintCalibrationXPercent(next)
                }
              }}
            />
          </label>
          <label className="layer-toggle-item">
            <span>Y-axis calibration (%)</span>
            <input
              type="number"
              min={50}
              max={150}
              step={0.1}
              value={printCalibrationYPercent}
              onChange={(e) => {
                const next = Number.parseFloat(e.target.value)
                if (Number.isFinite(next) && next > 0) {
                  onChangePrintCalibrationYPercent(next)
                }
              }}
            />
          </label>

          <div className="control-block">
            <h4>Derive from measured length</h4>
            <p className="options-modal-hint">
              Print a known reference (default 100 mm), measure it with a ruler, enter the measured X/Y here, then
              press Apply to update the corresponding calibration percentage.
            </p>
            <label className="layer-toggle-item">
              <span>Reference length (mm)</span>
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={calibrationReferenceMm}
                onChange={(e) => {
                  const next = Number.parseFloat(e.target.value)
                  if (Number.isFinite(next) && next > 0) {
                    setCalibrationReferenceMm(next)
                  }
                }}
              />
            </label>
            <label className="layer-toggle-item">
              <span>Measured X length (mm)</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={measuredXMm}
                onChange={(e) => setMeasuredXMm(e.target.value)}
              />
              <button type="button" onClick={() => applyCalibrationFromMeasured('x')}>
                Apply X
              </button>
            </label>
            <label className="layer-toggle-item">
              <span>Measured Y length (mm)</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={measuredYMm}
                onChange={(e) => setMeasuredYMm(e.target.value)}
              />
              <button type="button" onClick={() => applyCalibrationFromMeasured('y')}>
                Apply Y
              </button>
            </label>
          </div>
        </section>

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
