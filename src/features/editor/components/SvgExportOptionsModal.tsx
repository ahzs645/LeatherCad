import { useState } from 'react'

export type SvgExportConfig = {
  onlySelected: boolean
  onlyVisibleLineTypes: boolean
  forceSolidStrokes: boolean
  includeFoldLines: boolean
  includeAnnotations: boolean
  unit: 'mm' | 'in'
}

type SvgExportOptionsModalProps = {
  open: boolean
  onClose: () => void
  onApply: (config: SvgExportConfig) => void
  currentConfig: SvgExportConfig
}

export function SvgExportOptionsModal({
  open,
  onClose,
  onApply,
  currentConfig,
}: SvgExportOptionsModalProps) {
  const [onlySelected, setOnlySelected] = useState(currentConfig.onlySelected)
  const [onlyVisibleLineTypes, setOnlyVisibleLineTypes] = useState(currentConfig.onlyVisibleLineTypes)
  const [forceSolidStrokes, setForceSolidStrokes] = useState(currentConfig.forceSolidStrokes)
  const [includeFoldLines, setIncludeFoldLines] = useState(currentConfig.includeFoldLines)
  const [includeAnnotations, setIncludeAnnotations] = useState(currentConfig.includeAnnotations)
  const [unit, setUnit] = useState<'mm' | 'in'>(currentConfig.unit)

  if (!open) {
    return null
  }

  function handleApply() {
    onApply({
      onlySelected,
      onlyVisibleLineTypes,
      forceSolidStrokes,
      includeFoldLines,
      includeAnnotations,
      unit,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="SVG Export Options">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>SVG Export Options</h3>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={(e) => setOnlySelected(e.target.checked)}
          />
          <span>Export only selected shapes</span>
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={onlyVisibleLineTypes}
            onChange={(e) => setOnlyVisibleLineTypes(e.target.checked)}
          />
          <span>Export only visible line types</span>
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={forceSolidStrokes}
            onChange={(e) => setForceSolidStrokes(e.target.checked)}
          />
          <span>Force solid strokes</span>
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={includeFoldLines}
            onChange={(e) => setIncludeFoldLines(e.target.checked)}
          />
          <span>Include fold lines</span>
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={includeAnnotations}
            onChange={(e) => setIncludeAnnotations(e.target.checked)}
          />
          <span>Include annotations</span>
        </label>

        <label className="field-row">
          <span>Unit</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value as 'mm' | 'in')}>
            <option value="mm">Millimeters (mm)</option>
            <option value="in">Inches (in)</option>
          </select>
        </label>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
