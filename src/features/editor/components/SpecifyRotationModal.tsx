import { useState } from 'react'

type SpecifyRotationModalProps = {
  open: boolean
  onClose: () => void
  onApply: (angleDeg: number) => void
}

export function SpecifyRotationModal({ open, onClose, onApply }: SpecifyRotationModalProps) {
  const [angleDeg, setAngleDeg] = useState('0')

  if (!open) {
    return null
  }

  const apply = () => {
    const parsed = Number(angleDeg)
    if (Number.isFinite(parsed)) {
      onApply(parsed)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Specify rotation angle">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Specify Rotation Angle</h3>
        <label className="field-row">
          <span>Angle (degrees, CCW positive)</span>
          <input
            type="number"
            step={0.1}
            value={angleDeg}
            autoFocus
            onChange={(e) => setAngleDeg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                apply()
              }
            }}
          />
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={apply}>Rotate</button>
        </div>
      </div>
    </div>
  )
}
