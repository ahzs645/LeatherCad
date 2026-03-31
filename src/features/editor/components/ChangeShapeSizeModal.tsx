import { useState, useEffect } from 'react'

type ChangeShapeSizeModalProps = {
  open: boolean
  onClose: () => void
  onApply: (width: number, height: number, lockAspectRatio: boolean) => void
  currentWidth: number
  currentHeight: number
}

export function ChangeShapeSizeModal({
  open,
  onClose,
  onApply,
  currentWidth,
  currentHeight,
}: ChangeShapeSizeModalProps) {
  const [newWidth, setNewWidth] = useState(currentWidth)
  const [newHeight, setNewHeight] = useState(currentHeight)
  const [lockAspectRatio, setLockAspectRatio] = useState(false)

  useEffect(() => {
    setNewWidth(currentWidth)
    setNewHeight(currentHeight)
  }, [currentWidth, currentHeight])

  if (!open) {
    return null
  }

  const aspectRatio = currentWidth !== 0 ? currentHeight / currentWidth : 1

  function handleWidthChange(value: number) {
    setNewWidth(value)
    if (lockAspectRatio && value > 0) {
      setNewHeight(Math.round(value * aspectRatio * 1000) / 1000)
    }
  }

  function handleHeightChange(value: number) {
    setNewHeight(value)
    if (lockAspectRatio && aspectRatio !== 0 && value > 0) {
      setNewWidth(Math.round((value / aspectRatio) * 1000) / 1000)
    }
  }

  function handleApply() {
    onApply(newWidth, newHeight, lockAspectRatio)
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Change Shape Size">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Change Shape Size</h3>

        <p>
          Current size: {currentWidth.toFixed(2)} x {currentHeight.toFixed(2)} mm
        </p>

        <label className="field-row">
          <span>Width (mm)</span>
          <input
            type="number"
            min={0.01}
            step={0.1}
            value={newWidth}
            onChange={(e) => handleWidthChange(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Height (mm)</span>
          <input
            type="number"
            min={0.01}
            step={0.1}
            value={newHeight}
            onChange={(e) => handleHeightChange(Number(e.target.value))}
          />
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={lockAspectRatio}
            onChange={(e) => setLockAspectRatio(e.target.checked)}
          />
          <span>Lock aspect ratio</span>
        </label>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
