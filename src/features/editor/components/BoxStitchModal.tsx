import { useState } from 'react'
import type { BoxStitchParams } from '../ops/box-stitch-ops'

type BoxStitchModalProps = {
  open: boolean
  onClose: () => void
  onGenerate: (params: BoxStitchParams) => void
  defaultLayerId: string
  defaultLineTypeId: string
}

export function BoxStitchModal({
  open,
  onClose,
  onGenerate,
  defaultLayerId,
  defaultLineTypeId,
}: BoxStitchModalProps) {
  const [width, setWidth] = useState(100)
  const [depth, setDepth] = useState(80)
  const [height, setHeight] = useState(50)
  const [stitchPitchMm, setStitchPitchMm] = useState(4)
  const [cornerMarginMm, setCornerMarginMm] = useState(5)
  const [materialThicknessMm, setMaterialThicknessMm] = useState(2)

  if (!open) {
    return null
  }

  function handleGenerate() {
    onGenerate({
      width,
      depth,
      height,
      stitchPitchMm,
      cornerMarginMm,
      materialThicknessMm,
      layerId: defaultLayerId,
      lineTypeId: defaultLineTypeId,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Box Stitch Pattern">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Box Stitch Pattern</h3>

        <p>
          Generate stitch guide lines and holes for a box construction. The pattern creates
          four stitch lines offset from each edge of the bottom panel, with evenly spaced
          stitch holes along each line.
        </p>

        <label className="field-row">
          <span>Width (mm)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Depth (mm)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Height (mm)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Stitch Pitch (mm)</span>
          <input
            type="number"
            min={1}
            max={20}
            step={0.5}
            value={stitchPitchMm}
            onChange={(e) => setStitchPitchMm(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Corner Margin (mm)</span>
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={cornerMarginMm}
            onChange={(e) => setCornerMarginMm(Number(e.target.value))}
          />
        </label>

        <label className="field-row">
          <span>Material Thickness (mm)</span>
          <input
            type="number"
            min={0.5}
            max={10}
            step={0.5}
            value={materialThicknessMm}
            onChange={(e) => setMaterialThicknessMm(Number(e.target.value))}
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
