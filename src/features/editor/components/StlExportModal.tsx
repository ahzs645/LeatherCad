import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { DocFile } from '../cad/cad-types'
import { useTranslate } from '../hooks/useTranslate'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { useStlGeneration } from '../hooks/useStlGeneration'
import type { StlExportOptions, StlExportResult } from '../io/io-stl'
import { DEFAULT_MANUFACTURING_SETTINGS, parseManufacturingSettings, type ManufacturingSettings } from '../io/manufacturing/manufacturing-settings'
import { serializeAsciiStl } from '../io/stl-mesh'
import { StlManufacturingControls } from './StlManufacturingControls'
import { StlCalibrationDownload } from './StlCalibrationDownload'
import { embedManufacturingFont, manufacturingFontBuffer, MAX_MANUFACTURING_FONT_BYTES } from '../io/manufacturing/manufacturing-font-data'

const StlMeshPreview = lazy(() => import('./StlMeshPreview'))
export type StlExportModalProps = {
  open: boolean; onClose: () => void; doc: DocFile; selectedShapeIds?: ReadonlySet<string>
  onExported?: (result: StlExportResult) => void
  onManufacturingSettingsChange?: (settings: ManufacturingSettings) => void
}

export function StlExportModal({ open, onClose, doc, selectedShapeIds, onExported, onManufacturingSettingsChange }: StlExportModalProps) {
  const t = useTranslate()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open, onClose })
  const [options, setOptions] = useState<ManufacturingSettings>(() => parseManufacturingSettings(doc.manufacturing ?? DEFAULT_MANUFACTURING_SETTINGS))
  const [onlySelected, setOnlySelected] = useState(false)
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | undefined>(() => doc.manufacturing?.engravingFont ? manufacturingFontBuffer(doc.manufacturing.engravingFont) : undefined)
  const [fontName, setFontName] = useState(doc.manufacturing?.engravingFont?.name ?? '')
  const [fontError, setFontError] = useState('')
  const fontRequest = useRef(0)
  useEffect(() => () => { fontRequest.current++ }, [])
  const [saved, setSaved] = useState(false)
  // Appearance is kept outside geometry request identity, so changing color never reruns a Boolean job.
  const geometryKey = JSON.stringify({ ...options, engravingFont: undefined, materialPreset: undefined, previewColor: undefined, selectedIds: onlySelected ? [...selectedShapeIds ?? []] : undefined })
  const generationOptions = useMemo<Partial<StlExportOptions>>(() => {
    const { selectedIds, ...settings } = JSON.parse(geometryKey) as ManufacturingSettings & { selectedIds?: string[] }
    return { ...settings, engravingFont: undefined, selectedShapeIds: selectedIds ? new Set(selectedIds) : undefined }
  }, [geometryKey])
  const { result, error, pending, faces } = useStlGeneration(doc, generationOptions, open, fontBuffer)
  if (!open) return null
  const updateOptions = (settings: ManufacturingSettings) => { setOptions(settings); setSaved(false) }
  const saveSettings = () => {
    if (!result) return
    onManufacturingSettingsChange?.(parseManufacturingSettings(options)); setSaved(true)
  }
  const download = () => {
    if (!result) return
    const base = [...(doc.documentName ?? 'LeatherCad').replace(/[<>:"/\\|?*]/g, '_')].map((character) => character.charCodeAt(0) < 32 ? '_' : character).join('')
    const blob = new Blob([serializeAsciiStl(result.mesh, `${base}_mm`)], { type: 'model/stl' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = `${base}-${options.mode}.stl`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    saveSettings(); onExported?.(result)
  }
  return <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="stl-export-title" ref={dialogRef} tabIndex={-1} onClick={(event) => event.stopPropagation()} style={{ width: 'min(900px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
      <h3 id="stl-export-title">{t('stl.title', 'STL Export')}</h3>
      <p>{t('stl.description', 'Create a flat 3D pattern or a positioning jig from closed, visible cut outlines. STL coordinates are in millimetres.')}</p>
      <label className="field-row"><span>{t('stl.mode', 'Mode')}</span><select aria-label={t('stl.mode', 'Mode')} value={options.mode} onChange={(event) => updateOptions({ ...options, mode: event.target.value as ManufacturingSettings['mode'], regions: [] })}><option value="pattern">{t('stl.pattern', '3D pattern')}</option><option value="jig">{t('stl.jig', 'Positioning jig')}</option></select></label>
      <label className="layer-toggle-item"><input type="checkbox" checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)} /><span>{t('stl.selected', 'Use selected shapes only')}</span></label>
      <StlManufacturingControls settings={options} onChange={updateOptions} faces={faces} />
      {options.textEngrave !== 'none' && <label className="field-row"><span>{t('Engraving font (.ttf/.otf)')}</span><input type="file" aria-label={t('Engraving font (.ttf/.otf)')} accept=".ttf,.otf" onChange={(event) => {
        const file = event.target.files?.[0]; if (!file) return
        const request = ++fontRequest.current
        setFontError(''); setFontBuffer(undefined); setFontName(''); setOptions((current) => ({ ...current, engravingFont: undefined }))
        if (file.size > MAX_MANUFACTURING_FONT_BYTES) { setFontError('Choose an engraving font no larger than 4 MB.'); return }
        void file.arrayBuffer().then(async (buffer) => {
          const { loadFontFromBuffer } = await import('../ops/opentype-ops')
          if (request !== fontRequest.current) return
          const embedded = embedManufacturingFont(file.name, buffer)
          loadFontFromBuffer(buffer, 'manufacturing-engraving'); setFontBuffer(buffer); setFontName(embedded.name)
          setOptions((current) => ({ ...current, engravingFont: embedded })); setSaved(false)
        }).catch(() => { if (request === fontRequest.current) setFontError('Could not read this font. Choose a valid .ttf or .otf font.') })
      }} /><span>{fontName || t('Load the exact font. It will be embedded when you save manufacturing settings.')}</span></label>}
      {fontError && <p role="alert">{t(fontError)}</p>}
      {pending && <p role="status">{t('Generating manufacturing mesh… You can keep changing settings or close to cancel.')}</p>}
      {error && <p role="alert">{t(error)}</p>}
      {result && <>
        <Suspense fallback={<p>{t('stl.loading', 'Loading 3D preview…')}</p>}><StlMeshPreview mesh={result.mesh} color={options.previewColor} materialPreset={options.materialPreset} label={t('stl.preview', 'STL mesh preview')} unavailableMessage={t('stl.previewUnavailable', '3D preview is unavailable in this browser. The validated STL can still be downloaded.')} /></Suspense>
        <p>{t('stl.size', 'Size')}: {result.dimensionsMm.width.toFixed(2)} × {result.dimensionsMm.height.toFixed(2)} × {result.dimensionsMm.depth.toFixed(2)} mm</p>
        <p>{result.triangleCount.toLocaleString()} {t('stl.triangles', 'triangles')} · {result.stitchHoleCount} {t('stl.exportedHoles', 'stitch holes')} · {t('stl.watertight', 'Watertight mesh')}</p>
        <p>{t('manufacturing.curveWarning', 'Curve tolerance: {tolerance} mm. Mesh checks do not replace slicer inspection or fit calibration.').replace('{tolerance}', String(result.toleranceMm))}</p>
        {result.warnings.length > 0 && <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      </>}
      {saved && <p role="status">{t('Manufacturing settings saved with this drawing.')}</p>}
      <StlCalibrationDownload />
      <div className="modal-actions"><button onClick={onClose}>{t('common.cancel', 'Cancel')}</button>{onManufacturingSettingsChange && <button onClick={saveSettings} disabled={!result}>{t('Save manufacturing settings')}</button>}<button onClick={download} disabled={!result}>{t('stl.download', 'Download STL')}</button></div>
    </div>
  </div>
}
