import { useState } from 'react'

export type LengthAdjustMode = 'none' | 'length' | 'ratio'

type LengthAdjustModalProps = {
  open: boolean
  currentLengthMm: number
  onApply: (mode: LengthAdjustMode, value: number) => void
  onClose: () => void
}

export function LengthAdjustModal({
  open,
  currentLengthMm,
  onApply,
  onClose,
}: LengthAdjustModalProps) {
  const [mode, setMode] = useState<LengthAdjustMode>('length')
  const [lengthMm, setLengthMm] = useState(String(currentLengthMm.toFixed(2)))
  const [ratioPercent, setRatioPercent] = useState('100')

  if (!open) {
    return null
  }

  const apply = () => {
    if (mode === 'none') {
      onApply('none', currentLengthMm)
      return
    }
    if (mode === 'length') {
      const parsed = Number(lengthMm)
      if (Number.isFinite(parsed) && parsed > 0) {
        onApply('length', parsed)
      }
      return
    }
    const parsed = Number(ratioPercent) / 100
    if (Number.isFinite(parsed) && parsed > 0) {
      onApply('ratio', parsed)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Length adjust">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Adjust Length</h3>
        <p>Current length: {currentLengthMm.toFixed(2)} mm</p>

        <label className="layer-toggle-item">
          <input
            type="radio"
            name="length-adjust-mode"
            checked={mode === 'none'}
            onChange={() => setMode('none')}
          />
          <span>No adjustment</span>
        </label>

        <label className="layer-toggle-item">
          <input
            type="radio"
            name="length-adjust-mode"
            checked={mode === 'length'}
            onChange={() => setMode('length')}
          />
          <span>Use length (mm)</span>
        </label>
        <label className="field-row">
          <span>Target length</span>
          <input
            type="number"
            min={0.01}
            step={0.1}
            value={lengthMm}
            disabled={mode !== 'length'}
            onChange={(e) => setLengthMm(e.target.value)}
          />
        </label>

        <label className="layer-toggle-item">
          <input
            type="radio"
            name="length-adjust-mode"
            checked={mode === 'ratio'}
            onChange={() => setMode('ratio')}
          />
          <span>Use ratio (%)</span>
        </label>
        <label className="field-row">
          <span>Scale percent</span>
          <input
            type="number"
            min={0.01}
            step={1}
            value={ratioPercent}
            disabled={mode !== 'ratio'}
            onChange={(e) => setRatioPercent(e.target.value)}
          />
        </label>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={apply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
