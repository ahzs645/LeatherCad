import { useState } from 'react'

type SpecifyScaleModalProps = {
  open: boolean
  axis: 'both' | 'vertical' | 'horizontal'
  onClose: () => void
  onApply: (factorX: number, factorY: number) => void
}

export function SpecifyScaleModal({ open, axis, onClose, onApply }: SpecifyScaleModalProps) {
  const [percentX, setPercentX] = useState('100')
  const [percentY, setPercentY] = useState('100')
  const [uniform, setUniform] = useState(axis === 'both')

  if (!open) {
    return null
  }

  const apply = () => {
    if (axis === 'vertical') {
      const fy = Number(percentY) / 100
      if (Number.isFinite(fy) && fy > 0) {
        onApply(1, fy)
      }
      return
    }
    if (axis === 'horizontal') {
      const fx = Number(percentX) / 100
      if (Number.isFinite(fx) && fx > 0) {
        onApply(fx, 1)
      }
      return
    }
    const fx = Number(percentX) / 100
    const fy = uniform ? fx : Number(percentY) / 100
    if (Number.isFinite(fx) && Number.isFinite(fy) && fx > 0 && fy > 0) {
      onApply(fx, fy)
    }
  }

  const title =
    axis === 'vertical'
      ? 'Specify Vertical Scale Ratio'
      : axis === 'horizontal'
        ? 'Specify Horizontal Scale Ratio'
        : 'Specify Scale Ratio'

  return (
    <div className="modal-overlay" onClick={onClose} aria-label={title}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>

        {axis === 'both' ? (
          <>
            <label className="field-row">
              <span>Horizontal scale (%)</span>
              <input
                type="number"
                min={0.01}
                step={1}
                value={percentX}
                autoFocus
                onChange={(e) => {
                  setPercentX(e.target.value)
                  if (uniform) {
                    setPercentY(e.target.value)
                  }
                }}
              />
            </label>
            <label className="field-row">
              <span>Vertical scale (%)</span>
              <input
                type="number"
                min={0.01}
                step={1}
                value={percentY}
                disabled={uniform}
                onChange={(e) => setPercentY(e.target.value)}
              />
            </label>
            <label className="layer-toggle-item">
              <input
                type="checkbox"
                checked={uniform}
                onChange={(e) => {
                  setUniform(e.target.checked)
                  if (e.target.checked) {
                    setPercentY(percentX)
                  }
                }}
              />
              <span>Uniform (same X and Y)</span>
            </label>
          </>
        ) : axis === 'vertical' ? (
          <label className="field-row">
            <span>Vertical scale (%)</span>
            <input
              type="number"
              min={0.01}
              step={1}
              value={percentY}
              autoFocus
              onChange={(e) => setPercentY(e.target.value)}
            />
          </label>
        ) : (
          <label className="field-row">
            <span>Horizontal scale (%)</span>
            <input
              type="number"
              min={0.01}
              step={1}
              value={percentX}
              autoFocus
              onChange={(e) => setPercentX(e.target.value)}
            />
          </label>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={apply}>Scale</button>
        </div>
      </div>
    </div>
  )
}
