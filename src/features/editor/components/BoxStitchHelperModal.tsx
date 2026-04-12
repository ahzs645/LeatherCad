import { useState } from 'react'
import type { BoxStitchHelperSettings } from '../ops/box-stitch-settings'

type BoxStitchHelperModalProps = {
  open: boolean
  onClose: () => void
  onApply: (settings: BoxStitchHelperSettings) => void
  settings: BoxStitchHelperSettings
  selectedShapeCount: number
}

export function BoxStitchHelperModal({
  open,
  onClose,
  onApply,
  settings,
  selectedShapeCount,
}: BoxStitchHelperModalProps) {
  const [draftSettings, setDraftSettings] = useState<BoxStitchHelperSettings>(settings)

  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Box Stitch Helper">
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3>Box Stitch Helper</h3>
        <p>
          Selected shapes: <strong>{selectedShapeCount}</strong>
        </p>
        <p>
          Project stitch guides and stitch holes from the current selection. If the selection includes extracted
          box stitch sources, the helper uses only those marked paths. Search distance controls edge pairing, and
          stretch compensation expands or contracts paired overlap ranges for rounded or stretched constructions.
        </p>

        <label className="field-row">
          <span>Search Distance (mm)</span>
          <input
            type="number"
            min={0.1}
            max={200}
            step={0.1}
            value={draftSettings.distanceMm}
            onChange={(event) =>
              setDraftSettings((previous) => ({
                ...previous,
                distanceMm: Math.max(0.1, Math.min(200, Number(event.target.value) || 0.1)),
              }))
            }
          />
        </label>

        <label className="field-row">
          <span>Stretch Compensation (%)</span>
          <input
            type="number"
            min={25}
            max={250}
            step={5}
            value={draftSettings.stretchCompensationPercent}
            onChange={(event) =>
              setDraftSettings((previous) => ({
                ...previous,
                stretchCompensationPercent: Math.max(25, Math.min(250, Number(event.target.value) || 25)),
              }))
            }
          />
        </label>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => onApply(draftSettings)} disabled={selectedShapeCount === 0}>
            Create Stitch Path
          </button>
        </div>
      </div>
    </div>
  )
}
