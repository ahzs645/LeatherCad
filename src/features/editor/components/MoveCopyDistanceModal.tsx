import { useState } from 'react'

export type MoveCopyDistanceMode = 'move' | 'copy'

type MoveCopyDistanceModalProps = {
  open: boolean
  mode: MoveCopyDistanceMode
  selectedShapeCount: number
  onClose: () => void
  onApply: (dx: number, dy: number, mode: MoveCopyDistanceMode) => void
}

export function MoveCopyDistanceModal({
  open,
  mode,
  selectedShapeCount,
  onClose,
  onApply,
}: MoveCopyDistanceModalProps) {
  const [dx, setDx] = useState(10)
  const [dy, setDy] = useState(0)
  const [operation, setOperation] = useState<MoveCopyDistanceMode>(mode)

  if (!open) {
    return null
  }

  const canApply = selectedShapeCount > 0 && Number.isFinite(dx) && Number.isFinite(dy)

  function handleReset() {
    setDx(0)
    setDy(0)
  }

  function handleApply() {
    if (!canApply) {
      return
    }
    onApply(dx, dy, operation)
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Move or Copy by Distance">
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3>{operation === 'copy' ? 'Copy by Distance' : 'Move by Distance'}</h3>

        <p>
          {selectedShapeCount} selected shape{selectedShapeCount === 1 ? '' : 's'}
        </p>

        <div className="view-mode-toggle" role="tablist" aria-label="Move or copy operation">
          <button className={operation === 'move' ? 'active' : ''} onClick={() => setOperation('move')}>
            Move
          </button>
          <button className={operation === 'copy' ? 'active' : ''} onClick={() => setOperation('copy')}>
            Copy
          </button>
        </div>

        <label className="field-row">
          <span>X distance (mm)</span>
          <input
            type="number"
            step={0.1}
            value={dx}
            onChange={(event) => setDx(Number(event.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Y distance (mm)</span>
          <input
            type="number"
            step={0.1}
            value={dy}
            onChange={(event) => setDy(Number(event.target.value))}
          />
        </label>

        <div className="modal-actions">
          <button onClick={handleReset}>Reset</button>
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleApply} disabled={!canApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
