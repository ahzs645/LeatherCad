import { useState } from 'react'
import type { BoxStitchHelperSettings } from '../ops/box-stitch-settings'
import type { StitchAutoPitchSettings } from '../editor-types'
import type { DimensionDefaults } from '../state/editor-domain-types'

type OptionsModalProps = {
  open: boolean
  autoSaveEnabled: boolean
  reverseZoomDirection: boolean
  incrementalSelection: boolean
  mentoriWithoutCtrl: boolean
  exportIncludeText: boolean
  exportIncludeTemplateMetadata: boolean
  lineToolConstraint: 'none' | 'horizontal' | 'vertical'
  gridBackgroundMode: 'theme' | 'light' | 'dark'
  dimensionDefaults: DimensionDefaults
  forceFitLastPrick: boolean
  autoPitchSettings: StitchAutoPitchSettings
  boxStitchHelperSettings: BoxStitchHelperSettings
  printCalibrationXPercent: number
  printCalibrationYPercent: number
  onChangeAutoSaveEnabled: (value: boolean) => void
  onChangeReverseZoomDirection: (value: boolean) => void
  onChangeIncrementalSelection: (value: boolean) => void
  onChangeMentoriWithoutCtrl: (value: boolean) => void
  onChangeExportIncludeText: (value: boolean) => void
  onChangeExportIncludeTemplateMetadata: (value: boolean) => void
  onChangeLineToolConstraint: (value: 'none' | 'horizontal' | 'vertical') => void
  onChangeGridBackgroundMode: (value: 'theme' | 'light' | 'dark') => void
  onChangeDimensionDefaults: (next: DimensionDefaults) => void
  onChangeForceFitLastPrick: (value: boolean) => void
  onChangeAutoPitchSettings: (next: StitchAutoPitchSettings) => void
  onChangeBoxStitchHelperSettings: (next: BoxStitchHelperSettings) => void
  onChangePrintCalibrationXPercent: (value: number) => void
  onChangePrintCalibrationYPercent: (value: number) => void
  onOpenDimensionInspector?: () => void
  onClose: () => void
}

export function OptionsModal({
  open,
  autoSaveEnabled,
  reverseZoomDirection,
  incrementalSelection,
  mentoriWithoutCtrl,
  exportIncludeText,
  exportIncludeTemplateMetadata,
  onChangeAutoSaveEnabled,
  onChangeReverseZoomDirection,
  onChangeIncrementalSelection,
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
        </section>

        <section className="help-section">
          <h4>Line tool constraint</h4>
          {(['none', 'horizontal', 'vertical'] as const).map((mode) => (
            <label className="layer-toggle-item" key={mode}>
              <input
                type="radio"
                name="line-tool-constraint"
                checked={lineToolConstraint === mode}
                onChange={() => onChangeLineToolConstraint(mode)}
              />
              <span>{mode === 'none' ? 'Free' : mode === 'horizontal' ? 'Horizontal only' : 'Vertical only'}</span>
            </label>
          ))}
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
          <h4>Zoom &amp; Scroll</h4>
          <label className="layer-toggle-item">
            <input
              type="checkbox"
              checked={reverseZoomDirection}
              onChange={(e) => onChangeReverseZoomDirection(e.target.checked)}
            />
            <span>Reverse wheel-zoom direction</span>
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
