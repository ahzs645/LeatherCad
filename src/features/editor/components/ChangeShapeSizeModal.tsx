import { useRef, useState } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { useOptionalDisplayUnit } from '../state/providers/EditorUIStateProvider'
import { formatDisplayDistance } from '../ops/unit-ops'
import { LengthInput } from './LengthInput'

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
  selectedTextTrackingMm?: number | null
  onApplyTextGeometry?: (radiusMm: number, sweepDeg: number, trackingMm: number) => void
}

export function ChangeShapeSizeModal(props: ChangeShapeSizeModalProps) {
  const { open, onClose, onApply, currentWidth, currentHeight } = props
  const t = useTranslate()
  const [unit] = useOptionalDisplayUnit()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open, onClose })
  const [width, setWidth] = useState(currentWidth)
  const [height, setHeight] = useState(currentHeight)
  const [lockAspectRatio, setLockAspectRatio] = useState(false)
  const [lineLength, setLineLength] = useState(props.selectedLineLengthMm ?? 0)
  const [lineAngle, setLineAngle] = useState(props.selectedLineAngleDeg ?? 0)
  const [arcRadius, setArcRadius] = useState(props.selectedArcRadiusMm ?? 0)
  const [arcSweep, setArcSweep] = useState(props.selectedArcSweepDeg ?? 0)
  const [textRadius, setTextRadius] = useState(props.selectedTextRadiusMm ?? 0)
  const [textSweep, setTextSweep] = useState(props.selectedTextSweepDeg ?? 0)
  const [tracking, setTracking] = useState(props.selectedTextTrackingMm ?? 0)
  if (!open) return null
  const positive = (value: number) => Number.isFinite(value) && value > 0
  const showLine = props.onApplyLineGeometry && props.selectedLineLengthMm != null
  const validSize = positive(width) && positive(height) || Boolean(showLine) && Number.isFinite(width) && Number.isFinite(height) && width >= 0 && height >= 0 && (width > 0 || height > 0)
  const validLine = positive(lineLength) && Number.isFinite(lineAngle)
  const validArc = positive(arcRadius) && Number.isFinite(arcSweep) && Math.abs(arcSweep) > 0 && Math.abs(arcSweep) < 360
  const validText = positive(textRadius) && Number.isFinite(textSweep) && Number.isFinite(tracking) && tracking >= -20 && tracking <= 100
  const showArc = props.onApplyArcGeometry && props.selectedArcRadiusMm != null
  const showText = props.onApplyTextGeometry && props.selectedTextRadiusMm != null
  function changeWidth(value: number) {
    setWidth(value)
    if (lockAspectRatio && currentWidth > 0) setHeight(value * currentHeight / currentWidth)
  }
  function changeHeight(value: number) {
    setHeight(value)
    if (lockAspectRatio && currentHeight > 0) setWidth(value * currentWidth / currentHeight)
  }
  function distance(label: string, value: number, update: (mm: number) => void, minMm = 0.001) {
    return <label className="field-row"><span>{t(label)} ({unit})</span><LengthInput unit={unit} valueMm={value} onChangeMm={update} minMm={minMm} /></label>
  }
  function angle(label: string, value: number, update: (degrees: number) => void) {
    return <label className="field-row"><span>{t(label)} ({t('deg')})</span><input type="number" step="0.1" value={Number.isFinite(value) ? value : ''} onChange={event => update(event.target.value === '' ? Number.NaN : Number(event.target.value))} /></label>
  }
  return <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="change-size-title" tabIndex={-1} ref={dialogRef} onClick={event => event.stopPropagation()}>
      <h3 id="change-size-title">{t('Change Shape Size')}</h3>
      <p>{t('Current size')}: {formatDisplayDistance(currentWidth, unit)} × {formatDisplayDistance(currentHeight, unit)}</p>
      <p>{t('Apply Size scales the selection. Geometry controls change the selected line, arc or text curve. Internal geometry stays in millimetres.')}</p>
      {distance('Width', width, changeWidth, showLine ? 0 : 0.001)}{distance('Height', height, changeHeight, showLine ? 0 : 0.001)}
      <label className="layer-toggle-item"><input type="checkbox" checked={lockAspectRatio} onChange={event => setLockAspectRatio(event.target.checked)} /><span>{t('Lock aspect ratio')}</span></label>
      {!validSize && <p role="alert">{t('Width and height must be finite positive lengths.')}</p>}
      {showLine && <section><h4>{t('Line Geometry')}</h4>{distance('Line length', lineLength, setLineLength)}{angle('Line angle', lineAngle, setLineAngle)}
        {!validLine && <p role="alert">{t('Enter a positive length and a finite angle.')}</p>}
        <button type="button" disabled={!validLine} onClick={() => { if (validLine) props.onApplyLineGeometry?.(lineLength, lineAngle) }}>{t('Apply Line')}</button>
      </section>}
      {showArc && <section><h4>{t('Arc Geometry')}</h4>{distance('Arc radius', arcRadius, setArcRadius)}{angle('Arc angle', arcSweep, setArcSweep)}
        {!validArc && <p role="alert">{t('Enter a positive radius and a nonzero sweep smaller than 360 degrees.')}</p>}
        <button type="button" disabled={!validArc} onClick={() => { if (validArc) props.onApplyArcGeometry?.(arcRadius, arcSweep) }}>{t('Apply Arc')}</button>
      </section>}
      {showText && <section><h4>{t('Text Curve')}</h4>{distance('Text radius', textRadius, setTextRadius)}{angle('Text sweep', textSweep, setTextSweep)}{distance('Tracking', tracking, setTracking, -20)}
        {!validText && <p role="alert">{t('Enter a positive radius, finite sweep and tracking between -20 and 100 mm.')}</p>}
        <button type="button" disabled={!validText} onClick={() => { if (validText) props.onApplyTextGeometry?.(textRadius, textSweep, tracking) }}>{t('Apply Text')}</button>
      </section>}
      <div className="modal-actions"><button type="button" onClick={onClose}>{t('Cancel')}</button><button type="button" disabled={!validSize} onClick={() => { if (validSize) onApply(width, height, lockAspectRatio) }}>{t('Apply Size')}</button></div>
    </div>
  </div>
}
