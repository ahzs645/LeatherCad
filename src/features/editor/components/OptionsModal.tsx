type OptionsModalProps = {
  open: boolean
  autoSaveEnabled: boolean
  reverseZoomDirection: boolean
  incrementalSelection: boolean
  mentoriWithoutCtrl: boolean
  exportIncludeText: boolean
  exportIncludeTemplateMetadata: boolean
  onChangeAutoSaveEnabled: (value: boolean) => void
  onChangeReverseZoomDirection: (value: boolean) => void
  onChangeIncrementalSelection: (value: boolean) => void
  onChangeMentoriWithoutCtrl: (value: boolean) => void
  onChangeExportIncludeText: (value: boolean) => void
  onChangeExportIncludeTemplateMetadata: (value: boolean) => void
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
  onClose,
}: OptionsModalProps) {
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

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
