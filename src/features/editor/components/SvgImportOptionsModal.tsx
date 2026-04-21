import { useState } from 'react'

export type SvgImportMode = 'grouped' | 'exploded'

type SvgImportOptionsModalProps = {
  open: boolean
  fileName: string
  shapeCount: number
  warningCount: number
  sourceWidthMm: number
  sourceHeightMm: number
  onClose: () => void
  onApply: (targetWidthMm: number, mode: SvgImportMode) => void
}

export function SvgImportOptionsModal({
  open,
  fileName,
  shapeCount,
  warningCount,
  sourceWidthMm,
  sourceHeightMm,
  onClose,
  onApply,
}: SvgImportOptionsModalProps) {
  const [targetWidthMm, setTargetWidthMm] = useState(Math.max(0.01, sourceWidthMm))
  const [mode, setMode] = useState<SvgImportMode>('grouped')

  if (!open) {
    return null
  }

  const scalePercent = sourceWidthMm > 0 ? (targetWidthMm / sourceWidthMm) * 100 : 100
  const targetHeightMm = sourceWidthMm > 0 ? sourceHeightMm * (targetWidthMm / sourceWidthMm) : sourceHeightMm
  const canApply = Number.isFinite(targetWidthMm) && targetWidthMm > 0

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="SVG Import Options">
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3>SVG Import Options</h3>

        <p>
          {fileName}: {shapeCount} shape{shapeCount === 1 ? '' : 's'}
          {warningCount > 0 ? `, ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}
        </p>

        <label className="field-row">
          <span>Import width (mm)</span>
          <input
            type="number"
            min={0.01}
            step={0.1}
            value={targetWidthMm}
            onChange={(event) => setTargetWidthMm(Number(event.target.value))}
          />
        </label>

        <p>
          Height: {targetHeightMm.toFixed(2)} mm | Scale: {scalePercent.toFixed(1)}%
        </p>

        <div className="view-mode-toggle" role="tablist" aria-label="SVG import mode">
          <button className={mode === 'grouped' ? 'active' : ''} onClick={() => setMode('grouped')}>
            Grouped
          </button>
          <button className={mode === 'exploded' ? 'active' : ''} onClick={() => setMode('exploded')}>
            Exploded
          </button>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => onApply(targetWidthMm, mode)} disabled={!canApply}>
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
