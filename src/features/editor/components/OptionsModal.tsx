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
  onChangePrintCalibrationXPercent: (value: number) => void
  onChangePrintCalibrationYPercent: (value: number) => void
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
  printCalibrationXPercent,
  printCalibrationYPercent,
  onChangePrintCalibrationXPercent,
  onChangePrintCalibrationYPercent,
  onClose,
}: OptionsModalProps) {
  const updateDimensionDefaults = <K extends keyof DimensionDefaults>(key: K, value: DimensionDefaults[K]) => {
    onChangeDimensionDefaults({ ...dimensionDefaults, [key]: value })
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
        </section>

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
