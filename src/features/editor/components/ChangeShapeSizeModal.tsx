import { useState } from 'react'

type ChangeShapeSizeModalProps = {
  open: boolean
  onClose: () => void
  onApply: (width: number, height: number, lockAspectRatio: boolean) => void
  currentWidth: number
  currentHeight: number
  selectedLineLengthMm?: number | null
  selectedLineAngleDeg?: number | null
  onApplyLineGeometry?: (lengthMm: number, angleDeg: number) => void
  selectedArcRadiusMm?: number | null
  selectedArcSweepDeg?: number | null
  onApplyArcGeometry?: (radiusMm: number, sweepDeg: number) => void
  selectedTextRadiusMm?: number | null
  selectedTextSweepDeg?: number | null
  onApplyTextGeometry?: (radiusMm: number, sweepDeg: number) => void
}

export function ChangeShapeSizeModal({
  open,
  onClose,
  onApply,
  currentWidth,
  currentHeight,
  selectedLineLengthMm,
  selectedLineAngleDeg,
  onApplyLineGeometry,
  selectedArcRadiusMm,
  selectedArcSweepDeg,
  onApplyArcGeometry,
  selectedTextRadiusMm,
  selectedTextSweepDeg,
  onApplyTextGeometry,
}: ChangeShapeSizeModalProps) {
  const [newWidth, setNewWidth] = useState(currentWidth)
  const [newHeight, setNewHeight] = useState(currentHeight)
  const [lockAspectRatio, setLockAspectRatio] = useState(false)
  const [lineLengthMm, setLineLengthMm] = useState(selectedLineLengthMm ?? 0)
  const [lineAngleDeg, setLineAngleDeg] = useState(selectedLineAngleDeg ?? 0)
  const [arcRadiusMm, setArcRadiusMm] = useState(selectedArcRadiusMm ?? 0)
  const [arcSweepDeg, setArcSweepDeg] = useState(selectedArcSweepDeg ?? 0)
  const [textRadiusMm, setTextRadiusMm] = useState(selectedTextRadiusMm ?? 0)
  const [textSweepDeg, setTextSweepDeg] = useState(selectedTextSweepDeg ?? 0)

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

  function handleApplyLineGeometry() {
    if (!onApplyLineGeometry || !Number.isFinite(lineLengthMm) || !Number.isFinite(lineAngleDeg)) {
      return
    }
    onApplyLineGeometry(lineLengthMm, lineAngleDeg)
  }

  function handleApplyArcGeometry() {
    if (!onApplyArcGeometry || !Number.isFinite(arcRadiusMm) || !Number.isFinite(arcSweepDeg)) {
      return
    }
    onApplyArcGeometry(arcRadiusMm, arcSweepDeg)
  }

  function handleApplyTextGeometry() {
    if (!onApplyTextGeometry || !Number.isFinite(textRadiusMm) || !Number.isFinite(textSweepDeg)) {
      return
    }
    onApplyTextGeometry(textRadiusMm, textSweepDeg)
  }

  const showLineGeometry = onApplyLineGeometry && selectedLineLengthMm !== null && selectedLineLengthMm !== undefined
  const showArcGeometry = onApplyArcGeometry && selectedArcRadiusMm !== null && selectedArcRadiusMm !== undefined
  const showTextGeometry = onApplyTextGeometry && selectedTextRadiusMm !== null && selectedTextRadiusMm !== undefined

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

        {showLineGeometry && (
          <>
            <h4>Line Geometry</h4>
            <label className="field-row">
              <span>Line length (mm)</span>
              <input
                type="number"
                min={0.01}
                step={0.1}
                value={lineLengthMm}
                onChange={(e) => setLineLengthMm(Number(e.target.value))}
              />
            </label>
            <label className="field-row">
              <span>Line angle (deg)</span>
              <input
                type="number"
                step={0.1}
                value={lineAngleDeg}
                onChange={(e) => setLineAngleDeg(Number(e.target.value))}
              />
            </label>
            <div className="button-row">
              <button onClick={handleApplyLineGeometry} disabled={lineLengthMm <= 0 || !Number.isFinite(lineAngleDeg)}>
                Apply Line
              </button>
            </div>
          </>
        )}

        {showArcGeometry && (
          <>
            <h4>Arc Geometry</h4>
            <label className="field-row">
              <span>Arc radius (mm)</span>
              <input
                type="number"
                min={0.01}
                step={0.1}
                value={arcRadiusMm}
                onChange={(e) => setArcRadiusMm(Number(e.target.value))}
              />
            </label>
            <label className="field-row">
              <span>Arc angle (deg)</span>
              <input
                type="number"
                min={0.1}
                max={359.9}
                step={0.1}
                value={arcSweepDeg}
                onChange={(e) => setArcSweepDeg(Number(e.target.value))}
              />
            </label>
            <div className="button-row">
              <button
                onClick={handleApplyArcGeometry}
                disabled={arcRadiusMm <= 0 || arcSweepDeg === 0 || !Number.isFinite(arcSweepDeg)}
              >
                Apply Arc
              </button>
            </div>
          </>
        )}

        {showTextGeometry && (
          <>
            <h4>Text Curve</h4>
            <label className="field-row">
              <span>Text radius (mm)</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={textRadiusMm}
                onChange={(e) => setTextRadiusMm(Number(e.target.value))}
              />
            </label>
            <label className="field-row">
              <span>Text sweep (deg)</span>
              <input
                type="number"
                step={1}
                value={textSweepDeg}
                onChange={(e) => setTextSweepDeg(Number(e.target.value))}
              />
            </label>
            <div className="button-row">
              <button onClick={handleApplyTextGeometry} disabled={textRadiusMm <= 0 || !Number.isFinite(textSweepDeg)}>
                Apply Text Curve
              </button>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleApply}>Apply Size</button>
        </div>
      </div>
    </div>
  )
}
