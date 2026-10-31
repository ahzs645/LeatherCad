import { useState } from 'react'
import type { ManufacturingFace } from '../io/manufacturing/manufacturing-regions'
import type { ManufacturingSettings } from '../io/manufacturing/manufacturing-settings'

type Props = { settings: ManufacturingSettings; onChange: (settings: ManufacturingSettings) => void; faces: ManufacturingFace[] }
export function StlManufacturingControls({ settings: s, onChange, faces }: Props) {
  const [regionId, setRegionId] = useState('')
  const set = <K extends keyof ManufacturingSettings>(key: K, value: ManufacturingSettings[K]) => onChange({ ...s, [key]: value })
  const number = (key: keyof ManufacturingSettings, label: string, min = 0.1, max = 1000, step = 0.1) => <label className="field-row"><span>{label}</span><input type="number" min={min} max={max} step={step} value={s[key] as number} onChange={(e) => set(key, Number(e.target.value))} /></label>
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
    <fieldset><legend>Geometry accuracy and targets</legend>
      {number('toleranceMm', 'Curve tolerance (mm)', 0.001, 1, 0.001)}
      <p className="hint">Maximum curve approximation tolerance in millimetres. Smaller values create larger meshes.</p>
      {(['cut', 'stitch', 'fold', 'guide', 'mark'] as const).map((role) => <label key={role} className="layer-toggle-item"><input type="checkbox" checked={s.targetRoles.includes(role)} onChange={(e) => set('targetRoles', e.target.checked ? [...s.targetRoles, role] : s.targetRoles.filter((value) => value !== role))} /><span>{role} outlines</span></label>)}
    </fieldset>
    {s.mode === 'pattern' ? <fieldset><legend>Pattern and stitch holes</legend>
      {number('thicknessMm', 'Thickness (mm)')}
      <label className="field-row"><span>Stitch holes</span><select aria-label="Stitch holes" value={s.stitchHoles} onChange={(e) => set('stitchHoles', e.target.value as ManufacturingSettings['stitchHoles'])}><option value="none">None</option><option value="round">Round through holes</option><option value="original">Original hole shapes</option></select></label>
      {s.stitchHoles === 'round' && number('roundHoleDiameterMm', 'Hole diameter (mm)', 0.1, 100)}
      {s.stitchHoles === 'original' && <><label className="layer-toggle-item"><input type="checkbox" checked={s.holeSizeOverrides} onChange={(e) => set('holeSizeOverrides', e.target.checked)} /><span>Override export hole sizes</span></label>
        {s.holeSizeOverrides && <>{number('diamondLengthMm', 'Diamond length (mm)', 0.01, 100)}{number('diamondWidthMm', 'Diamond width (mm)', 0.01, 100)}{number('frenchLengthMm', 'European length (mm)', 0.01, 100)}{number('frenchWidthMm', 'European width (mm)', 0.01, 100)}{number('flatLengthMm', 'Flat length (mm)', 0.01, 100)}{number('flatWidthMm', 'Flat width (mm)', 0.01, 100)}</>}
      </>}
    </fieldset> : <fieldset><legend>Jig body and holes</legend>
      {number('jigBaseThicknessMm', 'Solid floor thickness (mm)')}{number('jigWallHeightMm', 'Pocket depth (mm)')}
      <label className="field-row"><span>Outside shape</span><select aria-label="Outside shape" value={s.jigOuterMode} onChange={(e) => set('jigOuterMode', e.target.value as ManufacturingSettings['jigOuterMode'])}><option value="margin">Rectangle with margin</option><option value="dimensions">Explicit width × height</option><option value="offset">Pattern offset</option></select></label>
      {s.jigOuterMode === 'dimensions' ? <>{number('jigWidthMm', 'Jig width (mm)')}{number('jigHeightMm', 'Jig height (mm)')}</> : number('jigMarginMm', 'Outer margin (mm)')}
      {number('jigClearanceMm', 'Pocket clearance (mm)', -100, 100, 0.05)}
      <p className="hint">Negative clearance makes an interference fit. Calibrate with your printer and material.</p>
      <label className="layer-toggle-item"><input type="checkbox" checked={s.jigStitchThrough} onChange={(e) => set('jigStitchThrough', e.target.checked)} /><span>Drill stitch holes through the jig floor</span></label>
      {s.jigStitchThrough && number('jigStitchDiameterMm', 'Jig drill diameter (mm)', 0.1, 100)}
      <details><summary>Finger holes ({s.fingerHoles.length})</summary>
        <p className="hint">Positions use the drawing coordinates in millimetres.</p>
        {s.fingerHoles.map((hole, i) => <div key={hole.id}><strong>Finger hole {i + 1}</strong>{(['x', 'y', 'diameterMm'] as const).map((key) => <label className="field-row" key={key}><span>{key === 'diameterMm' ? 'Diameter (mm)' : `${key.toUpperCase()} (mm)`}</span><input type="number" step="0.1" value={hole[key]} onChange={(e) => set('fingerHoles', s.fingerHoles.map((candidate) => candidate.id === hole.id ? { ...hole, [key]: Number(e.target.value) } : candidate))} /></label>)}<button type="button" onClick={() => set('fingerHoles', s.fingerHoles.filter((candidate) => candidate.id !== hole.id))}>Remove finger hole {i + 1}</button></div>)}
        <button type="button" onClick={() => set('fingerHoles', [...s.fingerHoles, { id: crypto.randomUUID(), x: selected?.at.x ?? 0, y: selected?.at.y ?? 0, diameterMm: 10 }])}>Add finger hole</button>
      </details>
    </fieldset>}
    <fieldset><legend>Region thickness and through cuts</legend>
      <p className="hint">Select a face in the drawing or list, then set its remaining thickness. A through region removes all material at that face.</p>
      {faces.length > 0 && <><svg viewBox={`${minX - 1} ${minY - 1} ${Math.max(width + 2, 2)} ${Math.max(height + 2, 2)}`} style={{ width: '100%', height: 180, background: '#f0f0f0' }} aria-label="Manufacturing face selection">
        {faces.map((face, i) => <path key={face.id} d={face.rings.map((ring) => `M${ring.map((p) => `${p.x},${p.y}`).join('L')}Z`).join('')} fillRule="evenodd" fill={selected?.id === face.id ? '#3989bc' : face.through ? '#dadada' : '#cfad78'} stroke="#333" strokeWidth={Math.max(width, height) / 400} role="button" tabIndex={0} aria-label={`Select manufacturing face ${i + 1}`} onClick={() => setRegionId(face.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRegionId(face.id) } }} />)}
      </svg><label className="field-row"><span>Manufacturing region</span><select aria-label="Manufacturing region" value={selected?.id ?? ''} onChange={(e) => setRegionId(e.target.value)}>{faces.map((face, i) => <option key={face.id} value={face.id}>Face {i + 1}: {face.heightMm.toFixed(2)} mm{face.through ? ' (through)' : ''}</option>)}</select></label>
        <label className="field-row"><span>Region thickness (mm)</span><input type="number" min="0" max="1000" step="0.1" value={override?.heightMm ?? selected?.heightMm ?? 0} onChange={(e) => updateRegion(Number(e.target.value), override?.through ?? false)} /></label>
        <label className="layer-toggle-item"><input type="checkbox" checked={override?.through ?? selected?.through ?? false} onChange={(e) => updateRegion(override?.heightMm ?? selected?.heightMm ?? s.thicknessMm, e.target.checked)} /><span>Through region</span></label>
      </>}
      <button type="button" disabled={!s.regions.length} onClick={() => set('regions', [])}>Reset all region overrides</button>
    </fieldset>
    <fieldset><legend>Text engraving</legend>
      <label className="field-row"><span>Engraving face</span><select aria-label="Engraving face" value={s.textEngrave} onChange={(e) => set('textEngrave', e.target.value as ManufacturingSettings['textEngrave'])}><option value="none">None</option><option value="top">Top</option><option value="bottom">Bottom</option></select></label>
      {s.textEngrave !== 'none' && number('textDepthMm', 'Engraving depth (mm)', 0.01, 100)}
    </fieldset>
    {s.mode === 'pattern' && <fieldset><legend>Edge finishing</legend>
      <label className="field-row"><span>Edge finish</span><select aria-label="Edge finish" value={s.edgeFinish} onChange={(e) => set('edgeFinish', e.target.value as ManufacturingSettings['edgeFinish'])}><option value="none">None</option><option value="chamfer">45° chamfer</option><option value="fillet">Fillet</option></select></label>
      {s.edgeFinish !== 'none' && <>{number('edgeSizeMm', 'Edge size (mm)', 0.01, 100)}{s.edgeFinish === 'fillet' && number('filletSteps', 'Fillet divisions', 2, 32, 1)}<p className="hint">Applies to top and bottom edges of a uniform pattern. Disable finishing when using region depth changes or text engraving.</p></>}
    </fieldset>}
    <fieldset><legend>Preview appearance</legend>
      <label className="field-row"><span>Preview material</span><select aria-label="Preview material" value={s.materialPreset} onChange={(e) => set('materialPreset', e.target.value as ManufacturingSettings['materialPreset'])}><option value="leather">Leather</option><option value="acrylic">Acrylic</option><option value="metal">Metal</option><option value="matte">Matte</option></select></label>
      <label className="field-row"><span>Preview color</span><input type="color" value={s.previewColor} onChange={(e) => set('previewColor', e.target.value)} /></label>
      <p className="hint">Appearance changes the preview. STL stores geometry only.</p>
    </fieldset>
  </>
}
