import { useId, useState, type InputHTMLAttributes } from 'react'
import { toDisplayValue, type DisplayUnit } from '../ops/unit-ops'
import { evaluateLengthExpressionMm, isComputedExpression } from '../ops/numeric-expression'
import { useTranslate } from '../hooks/useTranslate'

/** Values cross the component boundary in millimetres, including while inch
 * display is selected. Empty/invalid fields report NaN so callers can validate.
 * The field accepts arithmetic and unit suffixes (`100/3`, `5/32in`, `1 1/4"`). */
export function LengthInput({ valueMm, onChangeMm, unit, minMm, maxMm, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'> & { valueMm: number; onChangeMm: (mm: number) => void; unit: DisplayUnit; minMm?: number; maxMm?: number }) {
  const t = useTranslate()
  const errorId = useId()
  const previewId = useId()
  const format = (value: number) => Number.isFinite(value) ? String(Number(toDisplayValue(value, unit).toFixed(unit === 'in' ? 8 : 6))) : ''
  const [draft, setDraft] = useState({ unit, valueMm, text: format(valueMm), edited: false })
  const changed = draft.unit !== unit || !Object.is(draft.valueMm, valueMm)
  if (changed) setDraft({ unit, valueMm, text: format(valueMm), edited: draft.edited })
  const text = changed ? format(valueMm) : draft.text
  const parsed = text.trim() === '' ? Number.NaN : (evaluateLengthExpressionMm(text, unit) ?? Number.NaN)
  const valid = Number.isFinite(parsed) && (minMm === undefined || parsed >= minMm - 1e-9) && (maxMm === undefined || parsed <= maxMm + 1e-9)
  const showPreview = valid && isComputedExpression(text)
  const describedBy = [draft.edited && !valid ? errorId : null, showPreview ? previewId : null, props['aria-describedby'] ?? null].filter(Boolean).join(' ') || undefined
  return <><input {...props} type="text" inputMode="decimal" autoComplete="off" spellCheck={false} aria-invalid={draft.edited && !valid} aria-describedby={describedBy}
    value={text} onChange={event => {
      const nextText = event.target.value
      setDraft({ unit, valueMm, text: nextText, edited: true })
      onChangeMm(nextText.trim() === '' ? Number.NaN : (evaluateLengthExpressionMm(nextText, unit) ?? Number.NaN))
    }} />{showPreview && <span id={previewId} className="numeric-expression-preview">= {format(parsed)} {unit}</span>}{draft.edited && !valid && <span id={errorId} className="numeric-dialog-error" role="alert">{t('Enter a finite length within the field limits.')}</span>}</>
}
