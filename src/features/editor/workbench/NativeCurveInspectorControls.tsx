import { useState } from 'react'
import type { CubicShape, EllipseShape } from '../cad/cad-types'
import { useEditorDocumentActions, useEditorDocumentSelector } from '../state/providers/EditorDocumentStateProvider'
import { useOptionalEditorLayers } from '../state/providers/EditorLayerStateProvider'
import { useOptionalDisplayUnit } from '../state/providers/EditorUIStateProvider'
import { buildGroupAccess, isShapeLocked } from '../ops/shape-access'
import { useTranslate } from '../hooks/useTranslate'
import { LengthInput } from '../components/LengthInput'

type Curve = CubicShape | EllipseShape

/** Draft numeric values locally; one Apply changes the analytic primitive. */
export function NativeCurveInspectorControls({ shape }: { shape: Curve }) {
  const t = useTranslate()
  const [unit] = useOptionalDisplayUnit()
  const { setShapes } = useEditorDocumentActions()
  const groups = useEditorDocumentSelector(state => state.sketchGroups)
  const [draft, setDraft] = useState<Curve>(() => structuredClone(shape))
  const layers = useOptionalEditorLayers()
  const locked = isShapeLocked(shape, buildGroupAccess(groups)) || layers?.some(layer => layer.id === shape.layerId && layer.locked) === true
  const points = draft.type === 'cubic' ? ['start', 'control1', 'control2', 'end'] as const : ['center'] as const
  const coords = draft.type === 'cubic' ? [draft.start, draft.control1, draft.control2, draft.end] : [draft.center]
  const invalidCoordinates = coords.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 1_000_000 || Math.abs(point.y) > 1_000_000)
  const invalidEllipse = draft.type === 'ellipse' && (!(draft.radiusX > 0) || !(draft.radiusY > 0) || draft.radiusX > 1_000_000 || draft.radiusY > 1_000_000 || ![draft.rotationDeg, draft.startAngleDeg, draft.sweepDeg].every(Number.isFinite) || Math.abs(draft.sweepDeg) < 0.000001 || Math.abs(draft.sweepDeg) > 360)
  const error = invalidCoordinates ? t('curve.invalidCoordinates', 'Enter finite coordinates within the drawing limits.') : invalidEllipse ? t('curve.invalidEllipse', 'Enter positive radii, finite angles and a nonzero sweep up to 360°.') : ''
  const apply = () => {
    if (error) return
    setShapes(previous => previous.map(item => item.id === shape.id ? { ...item, ...draft } : item))
  }
  return <div className="control-block">
    <h3>{draft.type === 'cubic' ? t('curve.cubic', 'Cubic curve') : t('curve.ellipse', 'Ellipse')}</h3>
    <fieldset disabled={locked} style={{ border: 0, margin: 0, padding: 0 }}>
      <div className="workbench-field-grid">
        {points.flatMap(key => (['x', 'y'] as const).map(axis => {
          const point = key === 'center' && draft.type === 'ellipse' ? draft.center : draft.type === 'cubic' && key !== 'center' ? draft[key] : null
          if (!point) return null
          const label = `${t(`curve.${key}`, key === 'control1' ? 'Control 1' : key === 'control2' ? 'Control 2' : key === 'center' ? 'Center' : key === 'start' ? 'Start' : 'End')} ${axis.toUpperCase()} (${unit})`
          return <label className="field-row" key={`${key}-${axis}`}><span>{label}</span><LengthInput aria-label={label} unit={unit} valueMm={point[axis]} minMm={-1_000_000} maxMm={1_000_000} onChangeMm={value => setDraft(current => {
            if (current.type === 'ellipse' && key === 'center') return { ...current, center: { ...current.center, [axis]: value } }
            if (current.type === 'cubic' && key !== 'center') return { ...current, [key]: { ...current[key], [axis]: value } }
            return current
          })} /></label>
        }))}
        {draft.type === 'ellipse' ? <>
          {(['radiusX', 'radiusY'] as const).map(key => <label className="field-row" key={key}><span>{key === 'radiusX' ? t('curve.radiusX', 'Radius X') : t('curve.radiusY', 'Radius Y')} ({unit})</span><LengthInput unit={unit} minMm={0.000001} maxMm={1_000_000} valueMm={draft[key]} onChangeMm={value => setDraft(current => current.type === 'ellipse' ? { ...current, [key]: value } : current)} /></label>)}
          {(['rotationDeg', 'startAngleDeg', 'sweepDeg'] as const).map(key => <label className="field-row" key={key}><span>{key === 'rotationDeg' ? t('curve.rotation', 'Rotation (°)') : key === 'startAngleDeg' ? t('curve.startAngle', 'Start angle (°)') : t('curve.sweep', 'Sweep (°)')}</span><input type="number" step="any" value={Number.isFinite(draft[key]) ? draft[key] : ''} onChange={event => {
            const value = event.target.value.trim() ? Number(event.target.value) : Number.NaN
            setDraft(current => current.type === 'ellipse' ? { ...current, [key]: value } : current)
          }} /></label>)}
        </> : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" disabled={Boolean(error)} onClick={apply}>{t('curve.apply', 'Apply geometry')}</button>
    </fieldset>
  </div>
}
