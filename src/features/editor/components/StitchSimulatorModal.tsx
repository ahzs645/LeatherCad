import { useState } from 'react'
import type { StitchType, StitchSimulatorSettings } from '../ops/stitch-simulator-ops'

type StitchSimulatorModalProps = {
  open: boolean
  onClose: () => void
  settings: StitchSimulatorSettings
  onApply: (settings: StitchSimulatorSettings) => void
  stitchHoleCount: number
  threadLength: number | null
  selectedHoleId: string | null
  selectedHoleLabel: string | null
  terminalHoleLabel: string | null
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
  selectedHoleId,
  selectedHoleLabel,
  terminalHoleLabel,
}: StitchSimulatorModalProps) {
  const [draftSettings, setDraftSettings] = useState<StitchSimulatorSettings>(settings)

  if (!open) {
    return null
  }

  function handleApply() {
    onApply(draftSettings)
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
        <p>
          Selected hole: <strong>{selectedHoleLabel ?? 'None'}</strong>
          {' '}| Active stitch end: <strong>{terminalHoleLabel ?? 'Path end'}</strong>
        </p>

        <label className="field-row">
          <span>Stitch Type</span>
          <select
            value={draftSettings.stitchType}
            onChange={(e) =>
              setDraftSettings((previous) => ({
                ...previous,
                stitchType: e.target.value as StitchType,
              }))
            }
          >
            {STITCH_TYPES.map((st) => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>
        </label>

        <label className="field-row">
          <span>Thread Color</span>
          <input
            type="color"
            value={draftSettings.threadColor}
            onChange={(e) =>
              setDraftSettings((previous) => ({
                ...previous,
                threadColor: e.target.value,
              }))
            }
          />
        </label>

        {draftSettings.stitchType === 'saddle' && (
          <label className="field-row">
            <span>Second Thread Color</span>
            <input
              type="color"
              value={draftSettings.secondThreadColor}
              onChange={(e) =>
                setDraftSettings((previous) => ({
                  ...previous,
                  secondThreadColor: e.target.value,
                }))
              }
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
            value={draftSettings.threadWidthMm}
            onChange={(e) =>
              setDraftSettings((previous) => ({
                ...previous,
                threadWidthMm: Number(e.target.value),
              }))
            }
          />
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={draftSettings.showSimulatorPattern}
            onChange={(e) =>
              setDraftSettings((previous) => ({
                ...previous,
                showSimulatorPattern: e.target.checked,
              }))
            }
          />
          <span>Show stitch pattern</span>
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={draftSettings.showBackStitches}
            onChange={(e) =>
              setDraftSettings((previous) => ({
                ...previous,
                showBackStitches: e.target.checked,
              }))
            }
          />
          <span>Show back stitches</span>
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={draftSettings.showEvenStitches}
            onChange={(e) =>
              setDraftSettings((previous) => ({
                ...previous,
                showEvenStitches: e.target.checked,
              }))
            }
          />
          <span>Show even stitches</span>
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={draftSettings.showOddStitches}
            onChange={(e) =>
              setDraftSettings((previous) => ({
                ...previous,
                showOddStitches: e.target.checked,
              }))
            }
          />
          <span>Show odd stitches</span>
        </label>

        <label className="layer-toggle-item">
          <input
            type="checkbox"
            checked={draftSettings.showDirectionArrows}
            onChange={(e) =>
              setDraftSettings((previous) => ({
                ...previous,
                showDirectionArrows: e.target.checked,
              }))
            }
          />
          <span>Show direction arrows</span>
        </label>

        <div className="modal-actions">
          <button
            type="button"
            onClick={() =>
              setDraftSettings((previous) => ({
                ...previous,
                endHoleId: selectedHoleId,
              }))
            }
            disabled={!selectedHoleId}
          >
            Use Selected Hole
          </button>
          <button
            type="button"
            onClick={() =>
              setDraftSettings((previous) => ({
                ...previous,
                endHoleId: null,
              }))
            }
            disabled={!draftSettings.endHoleId}
          >
            Clear Stitch End
          </button>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
