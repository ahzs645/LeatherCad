import { useTranslate } from '../hooks/useTranslate'
import { useState } from 'react'
import type { StitchType, StitchSimulatorSettings } from '../ops/stitch-simulator-ops'

type StitchSimulatorModalProps = {
  open: boolean
  onClose: () => void
  settings: StitchSimulatorSettings
  onApply: (settings: StitchSimulatorSettings) => void
  stitchHoleCount: number
  threadLength: number | null
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
  selectedHoleLabel,
  terminalHoleLabel,
}: StitchSimulatorModalProps) {
  const t = useTranslate()
  const [draftSettings, setDraftSettings] = useState<StitchSimulatorSettings>(settings)

  if (!open) {
    return null
  }

  function handleApply() {
    onApply(draftSettings)
  }

  return (
    <div className="modal-overlay" onClick={onClose} aria-label={t('Stitch Simulator')}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{t('Stitch Simulator')}</h3>

        <p>
          {t('Stitch holes:')} <strong>{stitchHoleCount}</strong>
          {threadLength !== null && (
            <> {t('| Estimated thread length:')} <strong>{threadLength.toFixed(1)} {t('mm')}</strong></>
          )}
        </p>
        <p>
          {t('Selected hole:')} <strong>{selectedHoleLabel ?? 'None'}</strong>
          {' '}{t('| Active stitch end:')} <strong>{terminalHoleLabel ?? 'Path end'}</strong>
        </p>
        <p className="hint">{t('Use the stitch-hole inspector to set or clear the terminal stitch hole.')}</p>

        <label className="field-row">
          <span>{t('Stitch Type')}</span>
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
              <option key={st.value} value={st.value}>{t(st.label)}</option>
            ))}
          </select>
        </label>

        <label className="field-row">
          <span>{t('Thread Color')}</span>
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
          <input
            type="text"
            value={draftSettings.threadColor}
            onChange={(e) =>
              setDraftSettings((previous) => ({
                ...previous,
                threadColor: e.target.value,
              }))
            }
            placeholder={t('#000000')}
            style={{ width: 96 }}
            aria-label={t('Thread color (hex)')}
          />
        </label>

        {draftSettings.stitchType === 'saddle' && (
          <label className="field-row">
            <span>{t('Second Thread Color')}</span>
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
            <input
              type="text"
              value={draftSettings.secondThreadColor}
              onChange={(e) =>
                setDraftSettings((previous) => ({
                  ...previous,
                  secondThreadColor: e.target.value,
                }))
              }
              placeholder={t('#000000')}
              style={{ width: 96 }}
              aria-label={t('Second thread color (hex)')}
            />
          </label>
        )}

        <label className="field-row">
          <span>{t('Thread Width (mm)')}</span>
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
          <span>{t('Show stitch pattern')}</span>
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
          <span>{t('Show back stitches')}</span>
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
          <span>{t('Show even stitches')}</span>
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
          <span>{t('Show odd stitches')}</span>
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
          <span>{t('Show direction arrows')}</span>
        </label>

        <div className="modal-actions">
          <button onClick={onClose}>{t('Cancel')}</button>
          <button onClick={handleApply}>{t('Apply')}</button>
        </div>
      </div>
    </div>
  )
}
