import { useState } from 'react'
import type { StitchType, StitchSimulatorSettings } from '../ops/stitch-simulator-ops'

type StitchSimulatorModalProps = {
  open: boolean
  onClose: () => void
  settings: StitchSimulatorSettings
  onApply: (settings: StitchSimulatorSettings) => void
  stitchHoleCount: number
  threadLength: number | null
}

const STITCH_TYPES: { value: StitchType; label: string }[] = [
  { value: 'saddle', label: 'Saddle Stitch' },
  { value: 'running', label: 'Running Stitch' },
  { value: 'cross', label: 'Cross Stitch' },
  { value: 'backstitch', label: 'Backstitch' },
]

export function StitchSimulatorModal({
  open,
  onClose,
  settings,
  onApply,
  stitchHoleCount,
  threadLength,
}: StitchSimulatorModalProps) {
  const [stitchType, setStitchType] = useState<StitchType>(settings.stitchType)
  const [threadColor, setThreadColor] = useState(settings.threadColor)
  const [secondThreadColor, setSecondThreadColor] = useState(settings.secondThreadColor)
  const [threadWidthMm, setThreadWidthMm] = useState(settings.threadWidthMm)
  const [showBackStitches, setShowBackStitches] = useState(settings.showBackStitches)

  if (!open) {
    return null
  }

  function handleApply() {
    onApply({
      stitchType,
      threadColor,
      secondThreadColor,
      threadWidthMm,
      showBackStitches,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Stitch Simulator">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Stitch Simulator</h3>

        <p>
          Stitch holes: <strong>{stitchHoleCount}</strong>
          {threadLength !== null && (
            <> | Estimated thread length: <strong>{threadLength.toFixed(1)} mm</strong></>
          )}
        </p>

        <label className="field-row">
          <span>Stitch Type</span>
          <select value={stitchType} onChange={(e) => setStitchType(e.target.value as StitchType)}>
            {STITCH_TYPES.map((st) => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>
        </label>

        <label className="field-row">
          <span>Thread Color</span>
          <input
            type="color"
            value={threadColor}
            onChange={(e) => setThreadColor(e.target.value)}
          />
        </label>

        {stitchType === 'saddle' && (
          <label className="field-row">
            <span>Second Thread Color</span>
            <input
              type="color"
              value={secondThreadColor}
              onChange={(e) => setSecondThreadColor(e.target.value)}
            />
          </label>
        )}

        <label className="field-row">
          <span>Thread Width (mm)</span>
          <input
            type="number"
            min={0.3}
            max={2.0}
            step={0.1}
            value={threadWidthMm}
            onChange={(e) => setThreadWidthMm(Number(e.target.value))}
          />
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={showBackStitches}
            onChange={(e) => setShowBackStitches(e.target.checked)}
          />
          <span>Show back stitches</span>
        </label>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
