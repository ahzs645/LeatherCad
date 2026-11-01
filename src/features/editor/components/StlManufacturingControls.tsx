import { useState } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import type { ManufacturingFace } from '../io/manufacturing/manufacturing-regions'
import type { ManufacturingSettings } from '../io/manufacturing/manufacturing-settings'

type Props = { settings: ManufacturingSettings; onChange: (settings: ManufacturingSettings) => void; faces: ManufacturingFace[] }
const MANUFACTURING_ROLE_LABELS: Record<ManufacturingSettings['targetRoles'][number], string> = { cut: 'Cut outlines', stitch: 'Stitch outlines', fold: 'Fold outlines', guide: 'Guide outlines', mark: 'Mark outlines' }
export function StlManufacturingControls({ settings: s, onChange, faces }: Props) {
  const t = useTranslate()
  const [regionId, setRegionId] = useState('')
  const set = <K extends keyof ManufacturingSettings>(key: K, value: ManufacturingSettings[K]) => onChange({ ...s, [key]: value })
  const number = (key: keyof ManufacturingSettings, label: string, min = 0.1, max = 1000, step = 0.1) => <label className="field-row"><span>{t(label)}</span><input type="number" min={min} max={max} step={step} value={s[key] as number} onChange={(e) => set(key, Number(e.target.value))} /></label>
  const selected = faces.find((face) => face.id === regionId) ?? faces[0]
  const override = selected && s.regions.find((region) => region.at.x === selected.at.x && region.at.y === selected.at.y)
  const updateRegion = (heightMm: number, through: boolean) => {
    if (!selected) return
    set('regions', [...s.regions.filter((region) => region.id !== selected.id && (region.at.x !== selected.at.x || region.at.y !== selected.at.y)), { id: selected.id, at: selected.at, heightMm, through }])
  }
  const allPoints = faces.flatMap((face) => face.rings.flat())
  const minX = Math.min(...allPoints.map((p) => p.x)), minY = Math.min(...allPoints.map((p) => p.y))
  const width = Math.max(...allPoints.map((p) => p.x)) - minX, height = Math.max(...allPoints.map((p) => p.y)) - minY
  return <>
    <fieldset><legend>{t('Geometry accuracy and targets')}</legend>
      {number('toleranceMm', 'Curve tolerance (mm)', 0.001, 1, 0.001)}
      <p className="hint">{t('Maximum curve approximation tolerance in millimetres. Smaller values create larger meshes.')}</p>
      {(['cut', 'stitch', 'fold', 'guide', 'mark'] as const).map((role) => <label key={role} className="layer-toggle-item"><input type="checkbox" checked={s.targetRoles.includes(role)} onChange={(e) => set('targetRoles', e.target.checked ? [...s.targetRoles, role] : s.targetRoles.filter((value) => value !== role))} /><span>{t(MANUFACTURING_ROLE_LABELS[role])}</span></label>)}
    </fieldset>
    {s.mode === 'pattern' ? <fieldset><legend>{t('Pattern and stitch holes')}</legend>
      {number('thicknessMm', 'Thickness (mm)')}
      <label className="field-row"><span>{t('Stitch holes')}</span><select aria-label={t('Stitch holes')} value={s.stitchHoles} onChange={(e) => set('stitchHoles', e.target.value as ManufacturingSettings['stitchHoles'])}><option value="none">{t('None')}</option><option value="round">{t('Round through holes')}</option><option value="original">{t('Original hole shapes')}</option></select></label>
      {s.stitchHoles === 'round' && number('roundHoleDiameterMm', 'Hole diameter (mm)', 0.1, 100)}
      {s.stitchHoles === 'original' && <><label className="layer-toggle-item"><input type="checkbox" checked={s.holeSizeOverrides} onChange={(e) => set('holeSizeOverrides', e.target.checked)} /><span>{t('Override export hole sizes')}</span></label>
        {s.holeSizeOverrides && <>{number('diamondLengthMm', 'Diamond length (mm)', 0.01, 100)}{number('diamondWidthMm', 'Diamond width (mm)', 0.01, 100)}{number('frenchLengthMm', 'European length (mm)', 0.01, 100)}{number('frenchWidthMm', 'European width (mm)', 0.01, 100)}{number('flatLengthMm', 'Flat length (mm)', 0.01, 100)}{number('flatWidthMm', 'Flat width (mm)', 0.01, 100)}</>}
      </>}
    </fieldset> : <fieldset><legend>{t('Jig body and holes')}</legend>
      {number('jigBaseThicknessMm', 'Solid floor thickness (mm)')}{number('jigWallHeightMm', 'Pocket depth (mm)')}
      <label className="field-row"><span>{t('Outside shape')}</span><select aria-label={t('Outside shape')} value={s.jigOuterMode} onChange={(e) => set('jigOuterMode', e.target.value as ManufacturingSettings['jigOuterMode'])}><option value="margin">{t('Rectangle with margin')}</option><option value="dimensions">{t('Explicit width × height')}</option><option value="offset">{t('Pattern offset')}</option></select></label>
      {s.jigOuterMode === 'dimensions' ? <>{number('jigWidthMm', 'Jig width (mm)')}{number('jigHeightMm', 'Jig height (mm)')}</> : number('jigMarginMm', 'Outer margin (mm)')}
      {number('jigClearanceMm', 'Pocket clearance (mm)', -100, 100, 0.05)}
      <p className="hint">{t('Negative clearance makes an interference fit. Calibrate with your printer and material.')}</p>
      <label className="layer-toggle-item"><input type="checkbox" checked={s.jigStitchThrough} onChange={(e) => set('jigStitchThrough', e.target.checked)} /><span>{t('Drill stitch holes through the jig floor')}</span></label>
      {s.jigStitchThrough && number('jigStitchDiameterMm', 'Jig drill diameter (mm)', 0.1, 100)}
      <details><summary>{t('manufacturing.fingerCount', 'Finger holes ({count})').replace('{count}', String(s.fingerHoles.length))}</summary>
        <p className="hint">{t('Positions use the drawing coordinates in millimetres.')}</p>
        {s.fingerHoles.map((hole, i) => <div key={hole.id}><strong>{t('manufacturing.finger', 'Finger hole {count}').replace('{count}', String(i + 1))}</strong>{(['x', 'y', 'diameterMm'] as const).map((key) => <label className="field-row" key={key}><span>{key === 'diameterMm' ? t('Diameter (mm)') : `${key.toUpperCase()} (mm)`}</span><input type="number" step="0.1" value={hole[key]} onChange={(e) => set('fingerHoles', s.fingerHoles.map((candidate) => candidate.id === hole.id ? { ...hole, [key]: Number(e.target.value) } : candidate))} /></label>)}<button type="button" onClick={() => set('fingerHoles', s.fingerHoles.filter((candidate) => candidate.id !== hole.id))}>{t('manufacturing.removeFinger', 'Remove finger hole {count}').replace('{count}', String(i + 1))}</button></div>)}
        <button type="button" onClick={() => set('fingerHoles', [...s.fingerHoles, { id: crypto.randomUUID(), x: selected?.at.x ?? 0, y: selected?.at.y ?? 0, diameterMm: 10 }])}>{t('Add finger hole')}</button>
      </details>
    </fieldset>}
    <fieldset><legend>{t('Region thickness and through cuts')}</legend>
      <p className="hint">{t('Select a face in the drawing or list, then set its remaining thickness. A through region removes all material at that face.')}</p>
      {faces.length > 0 && <><svg viewBox={`${minX - 1} ${minY - 1} ${Math.max(width + 2, 2)} ${Math.max(height + 2, 2)}`} style={{ width: '100%', height: 180, background: '#f0f0f0' }} aria-label={t('Manufacturing face selection')}>
        {faces.map((face, i) => <path key={face.id} d={face.rings.map((ring) => `M${ring.map((p) => `${p.x},${p.y}`).join('L')}Z`).join('')} fillRule="evenodd" fill={selected?.id === face.id ? '#3989bc' : face.through ? '#dadada' : '#cfad78'} stroke="#333" strokeWidth={Math.max(width, height) / 400} role="button" tabIndex={0} aria-label={t('manufacturing.selectFace', 'Select manufacturing face {count}').replace('{count}', String(i + 1))} onClick={() => setRegionId(face.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRegionId(face.id) } }} />)}
      </svg><label className="field-row"><span>{t('Manufacturing region')}</span><select aria-label={t('Manufacturing region')} value={selected?.id ?? ''} onChange={(e) => setRegionId(e.target.value)}>{faces.map((face, i) => <option key={face.id} value={face.id}>{t('manufacturing.face', 'Face {count}: {height} mm{through}').replace('{count}', String(i + 1)).replace('{height}', face.heightMm.toFixed(2)).replace('{through}', face.through ? t(' (through)') : '')}</option>)}</select></label>
        <label className="field-row"><span>{t('Region thickness (mm)')}</span><input type="number" min="0" max="1000" step="0.1" value={override?.heightMm ?? selected?.heightMm ?? 0} onChange={(e) => updateRegion(Number(e.target.value), override?.through ?? false)} /></label>
        <label className="layer-toggle-item"><input type="checkbox" checked={override?.through ?? selected?.through ?? false} onChange={(e) => updateRegion(override?.heightMm ?? selected?.heightMm ?? s.thicknessMm, e.target.checked)} /><span>{t('Through region')}</span></label>
      </>}
      <button type="button" disabled={!s.regions.length} onClick={() => set('regions', [])}>{t('Reset all region overrides')}</button>
    </fieldset>
    <fieldset><legend>{t('Text engraving')}</legend>
      <label className="field-row"><span>{t('Engraving face')}</span><select aria-label={t('Engraving face')} value={s.textEngrave} onChange={(e) => set('textEngrave', e.target.value as ManufacturingSettings['textEngrave'])}><option value="none">{t('None')}</option><option value="top">{t('Top')}</option><option value="bottom">{t('Bottom')}</option></select></label>
      {s.textEngrave !== 'none' && number('textDepthMm', 'Engraving depth (mm)', 0.01, 100)}
    </fieldset>
    <fieldset><legend>{t('Edge finishing')}</legend>
      <label className="field-row"><span>{t('Edge finish')}</span><select aria-label={t('Edge finish')} value={s.edgeFinish} onChange={(e) => set('edgeFinish', e.target.value as ManufacturingSettings['edgeFinish'])}><option value="none">{t('None')}</option><option value="chamfer">{t('45° chamfer')}</option><option value="fillet">{t('Fillet')}</option></select></label>
      {s.edgeFinish !== 'none' && <>{number('edgeSizeMm', 'Edge size (mm)', 0.01, 100)}{s.edgeFinish === 'fillet' && number('filletSteps', 'Fillet divisions', 2, 32, 1)}<p className="hint">{t('Finishes exposed pattern edges and the outside of jig bodies. Jig pockets and bores retain their fit dimensions. Edge size must fit the material thickness and height steps; engraving depth is measured from each flat face.')}</p></>}
    </fieldset>
    <fieldset><legend>{t('Preview appearance')}</legend>
      <label className="field-row"><span>{t('Preview material')}</span><select aria-label={t('Preview material')} value={s.materialPreset} onChange={(e) => set('materialPreset', e.target.value as ManufacturingSettings['materialPreset'])}><option value="leather">{t('Leather')}</option><option value="acrylic">{t('Acrylic')}</option><option value="metal">{t('Metal')}</option><option value="matte">{t('Matte')}</option></select></label>
      <label className="field-row"><span>{t('Preview color')}</span><input type="color" value={s.previewColor} onChange={(e) => set('previewColor', e.target.value)} /></label>
      <p className="hint">{t('Appearance changes the preview. STL stores geometry only.')}</p>
    </fieldset>
  </>
}
