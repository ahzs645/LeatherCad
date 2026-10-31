import { useId, useState, type InputHTMLAttributes } from 'react'
import { fromDisplayValue, toDisplayValue, type DisplayUnit } from '../ops/unit-ops'
import { useTranslate } from '../hooks/useTranslate'

/** Values cross the component boundary in millimetres, including while inch
 * display is selected. Empty/invalid fields report NaN so callers can validate. */
export function LengthInput({ valueMm, onChangeMm, unit, minMm, maxMm, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'> & { valueMm: number; onChangeMm: (mm: number) => void; unit: DisplayUnit; minMm?: number; maxMm?: number }) {
  const t = useTranslate()
  const errorId = useId()
  const format = (value: number) => Number.isFinite(value) ? String(Number(toDisplayValue(value, unit).toFixed(unit === 'in' ? 8 : 6))) : ''
  const [draft, setDraft] = useState({ unit, valueMm, text: format(valueMm), edited: false })
  const changed = draft.unit !== unit || !Object.is(draft.valueMm, valueMm)
  if (changed) setDraft({ unit, valueMm, text: format(valueMm), edited: draft.edited })
  const text = changed ? format(valueMm) : draft.text
  const parsed = text.trim() === '' ? Number.NaN : fromDisplayValue(Number(text), unit)
  const valid = Number.isFinite(parsed) && (minMm === undefined || parsed >= minMm - 1e-9) && (maxMm === undefined || parsed <= maxMm + 1e-9)
  return <><input {...props} type="number" step={unit === 'in' ? 0.001 : 0.1} aria-invalid={draft.edited && !valid} aria-describedby={draft.edited && !valid ? errorId : props['aria-describedby']}
    min={minMm === undefined ? undefined : toDisplayValue(minMm, unit)} max={maxMm === undefined ? undefined : toDisplayValue(maxMm, unit)}
    value={text} onChange={event => {
      setDraft({ unit, valueMm, text: event.target.value, edited: true })
      onChangeMm(event.target.value.trim() === '' ? Number.NaN : fromDisplayValue(Number(event.target.value), unit))
    }} />{draft.edited && !valid && <span id={errorId} className="numeric-dialog-error" role="alert">{t('Enter a finite length within the field limits.')}</span>}</>
}
