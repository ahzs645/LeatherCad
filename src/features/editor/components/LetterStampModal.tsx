import { useState } from 'react'
import type { LetterStampParams } from '../ops/letter-stamp-ops'
import { getDefaultLetterStampParams } from '../ops/letter-stamp-ops'

type LetterStampModalProps = {
  open: boolean
  onClose: () => void
  onGenerate: (params: LetterStampParams) => void
  defaultLayerId: string
  defaultLineTypeId: string
}

export function LetterStampModal({
  open,
  onClose,
  onGenerate,
  defaultLayerId,
  defaultLineTypeId,
}: LetterStampModalProps) {
  const defaults = getDefaultLetterStampParams()

  const [text, setText] = useState(defaults.text)
  const [stampSizeMm, setStampSizeMm] = useState(defaults.stampSizeMm)
  const [spacingMm, setSpacingMm] = useState(defaults.spacingMm)
  const [lineSpacingMm, setLineSpacingMm] = useState(defaults.lineSpacingMm)
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(defaults.alignment)
  const [baselineAngleDeg, setBaselineAngleDeg] = useState(defaults.baselineAngleDeg)
  const [fontFamily, setFontFamily] = useState(defaults.fontFamily)

  if (!open) {
    return null
  }

  function handleGenerate() {
    onGenerate({
      text,
      stampSizeMm,
      spacingMm,
      lineSpacingMm,
      alignment,
      baselineAngleDeg,
      origin: { x: 0, y: 0 },
      fontFamily,
      layerId: defaultLayerId,
      lineTypeId: defaultLineTypeId,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Letter Stamp">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Letter Stamp</h3>

        <label className="field-row">
          <span>Text</span>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </label>

        <label className="field-row">
          <span>Stamp Size (mm)</span>
          <input
            type="number"
            min={4}
            max={20}
            step={0.5}
            value={stampSizeMm}
            onChange={(e) => setStampSizeMm(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Spacing (mm)</span>
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={spacingMm}
            onChange={(e) => setSpacingMm(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Line Spacing (mm)</span>
          <input
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={lineSpacingMm}
            onChange={(e) => setLineSpacingMm(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Alignment</span>
          <select value={alignment} onChange={(e) => setAlignment(e.target.value as 'left' | 'center' | 'right')}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>

        <label className="field-row">
          <span>Baseline Angle (deg)</span>
          <input
            type="number"
            min={0}
            max={360}
            step={1}
            value={baselineAngleDeg}
            onChange={(e) => setBaselineAngleDeg(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Font Family</span>
          <input
            type="text"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          />
        </label>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleGenerate}>Generate</button>
        </div>
      </div>
    </div>
  )
}
