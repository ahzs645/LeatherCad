import { useState } from 'react'

type ExportFormat = 'json' | 'svg' | 'pdf' | 'dxf' | 'laser-svg'

type ExportModalProps = {
  open: boolean
  onClose: () => void
  showPrintAreas: boolean
  onTogglePrintAreas: () => void
  onOpenExportOptions: () => void
  onOpenPrintPreview: () => void
  onSaveJson: () => void
  onExportSvg: () => void
  onExportPdf: () => void
  onExportDxf: () => void
  onExportLaserSvg: () => void
}

const FORMAT_OPTIONS: Array<{ value: ExportFormat; label: string; description: string }> = [
  { value: 'json', label: 'JSON Document', description: 'Saves the editable project state as a JSON file.' },
  { value: 'svg', label: 'SVG', description: 'Vector export for editing, plotting, and browser preview.' },
  { value: 'pdf', label: 'PDF', description: 'Print-friendly export for sharing and archive workflows.' },
  { value: 'dxf', label: 'DXF', description: 'CAD export for CAM/CNC workflows with DXF options.' },
  { value: 'laser-svg', label: 'Laser SVG', description: 'Laser-cut optimized SVG with black stroke geometry.' },
]

export function ExportModal({
  open,
  onClose,
  showPrintAreas,
  onTogglePrintAreas,
  onOpenExportOptions,
  onOpenPrintPreview,
  onSaveJson,
  onExportSvg,
  onExportPdf,
  onExportDxf,
  onExportLaserSvg,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('svg')

  if (!open) {
    return null
  }

  const selectedFormat = FORMAT_OPTIONS.find((option) => option.value === format) ?? FORMAT_OPTIONS[0]
  const primaryActionLabel = format === 'json' ? 'Save JSON' : `Export ${selectedFormat.label}`

  const handleRunExport = () => {
    if (format === 'json') {
      onSaveJson()
      onClose()
      return
    }

    if (format === 'svg') {
      onExportSvg()
      onClose()
      return
    }

    if (format === 'pdf') {
      onExportPdf()
      onClose()
      return
    }

    if (format === 'dxf') {
      onExportDxf()
      onClose()
      return
    }

    onExportLaserSvg()
    onClose()
  }

  const handleOpenExportOptions = () => {
    onClose()
    onOpenExportOptions()
  }

  const handleOpenPrintPreview = () => {
    onClose()
    onOpenPrintPreview()
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }}
      role="presentation"
    >
      <div className="export-options-modal export-hub-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="layer-color-modal-header">
          <h2>Export Center</h2>
          <button onClick={onClose}>Done</button>
        </div>

        <p className="hint">Pick an output format, then run export. Configure filters and print settings from here as needed.</p>

        <div className="line-type-edit-grid export-hub-grid">
          <label className="field-row">
            <span>Format</span>
            <select className="action-select" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="print-preview-summary">
            <div>Selected: {selectedFormat.label}</div>
            <div>{selectedFormat.description}</div>
          </div>
        </div>

        <div className="line-type-modal-actions">
          <button onClick={handleRunExport}>{primaryActionLabel}</button>
          <button onClick={handleOpenExportOptions}>Export Options</button>
          <button onClick={handleOpenPrintPreview}>Print Preview</button>
          <button onClick={onTogglePrintAreas}>{showPrintAreas ? 'Hide Print Areas' : 'Show Print Areas'}</button>
        </div>
      </div>
    </div>
  )
}
