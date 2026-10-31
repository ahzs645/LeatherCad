import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import type { DocFile } from '../cad/cad-types'
import { useTranslate } from '../hooks/useTranslate'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { buildStlExport, DEFAULT_STL_EXPORT_OPTIONS, type StlExportOptions, type StlExportResult } from '../io/io-stl'
import { serializeAsciiStl } from '../io/stl-mesh'

const StlMeshPreview = lazy(() => import('./StlMeshPreview'))

export type StlExportModalProps = {
  open: boolean
  onClose: () => void
  doc: DocFile
  selectedShapeIds?: ReadonlySet<string>
  onExported?: (result: StlExportResult) => void
}

export function StlExportModal({ open, onClose, doc, selectedShapeIds, onExported }: StlExportModalProps) {
  const t = useTranslate()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open, onClose })
  const [options, setOptions] = useState<StlExportOptions>(DEFAULT_STL_EXPORT_OPTIONS)
  const [onlySelected, setOnlySelected] = useState(false)
  const generated = useMemo(() => {
    if (!open) return null
    try {
      return { result: buildStlExport(doc, { ...options, selectedShapeIds: onlySelected ? selectedShapeIds ?? new Set() : undefined }), error: '' }
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : t('stl.failed', 'Could not generate the STL.') }
    }
  }, [open, doc, options, onlySelected, selectedShapeIds, t])

  if (!open || !generated) return null
  const { result, error } = generated
  const setNumber = (key: keyof StlExportOptions, value: string) => setOptions((current) => ({ ...current, [key]: Number(value) }))
  const numberInput = (key: keyof StlExportOptions, label: string, min: number, step = 0.1) => <label className="field-row">
    <span>{label}</span>
    <input type="number" min={min} max={1_000} step={step} value={options[key] as number} onChange={(event) => setNumber(key, event.target.value)} />
  </label>
  const download = () => {
    if (!result) return
    const base = [...(doc.documentName ?? 'LeatherCad').replace(/[<>:"/\\|?*]/g, '_')]
      .map((character) => character.charCodeAt(0) < 32 ? '_' : character).join('')
    const blob = new Blob([serializeAsciiStl(result.mesh, `${base}_mm`)], { type: 'model/stl' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${base}-${options.mode}.stl`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    onExported?.(result)
  }

  return <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="stl-export-title" ref={dialogRef} tabIndex={-1} onClick={(event) => event.stopPropagation()} style={{ width: 'min(720px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
      <h3 id="stl-export-title">{t('stl.title', 'STL Export')}</h3>
      <p>{t('stl.description', 'Create a flat 3D pattern or a positioning jig from closed, visible cut outlines. STL coordinates are in millimetres.')}</p>
      <label className="field-row">
        <span>{t('stl.mode', 'Mode')}</span>
        <select aria-label={t('stl.mode', 'Mode')} value={options.mode} onChange={(event) => setOptions((current) => ({ ...current, mode: event.target.value as StlExportOptions['mode'] }))}>
          <option value="pattern">{t('stl.pattern', '3D pattern')}</option>
          <option value="jig">{t('stl.jig', 'Positioning jig')}</option>
        </select>
      </label>
      <label className="layer-toggle-item">
        <input type="checkbox" checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)} />
        <span>{t('stl.selected', 'Use selected shapes only')}</span>
      </label>
      {options.mode === 'pattern' ? <>
        {numberInput('thicknessMm', t('stl.thickness', 'Thickness (mm)'), 0.1)}
        <label className="field-row">
          <span>{t('stl.holes', 'Stitch holes')}</span>
          <select value={options.stitchHoles} onChange={(event) => setOptions((current) => ({ ...current, stitchHoles: event.target.value as StlExportOptions['stitchHoles'] }))}>
            <option value="none">{t('stl.noHoles', 'None')}</option>
            <option value="round">{t('stl.roundHoles', 'Round through holes')}</option>
            <option value="original">{t('stl.originalHoles', 'Original hole shapes')}</option>
          </select>
        </label>
        {options.stitchHoles === 'round' && numberInput('roundHoleDiameterMm', t('stl.holeDiameter', 'Hole diameter (mm)'), 0.1)}
      </> : <>
        {numberInput('jigBaseThicknessMm', t('stl.floor', 'Solid floor thickness (mm)'), 0.1)}
        {numberInput('jigWallHeightMm', t('stl.pocketDepth', 'Pocket depth (mm)'), 0.1)}
        {numberInput('jigMarginMm', t('stl.margin', 'Outer margin (mm)'), 0.1)}
        {numberInput('jigClearanceMm', t('stl.clearance', 'Pocket clearance (mm)'), 0, 0.05)}
      </>}
      {error && <p role="alert">{error}</p>}
      {result && <>
        <Suspense fallback={<p>{t('stl.loading', 'Loading 3D preview…')}</p>}>
          <StlMeshPreview mesh={result.mesh} label={t('stl.preview', 'STL mesh preview')} unavailableMessage={t('stl.previewUnavailable', '3D preview is unavailable in this browser. The validated STL can still be downloaded.')} />
        </Suspense>
        <p>{t('stl.size', 'Size')}: {result.dimensionsMm.width.toFixed(2)} × {result.dimensionsMm.height.toFixed(2)} × {result.dimensionsMm.depth.toFixed(2)} mm</p>
        <p>{result.triangleCount.toLocaleString()} {t('stl.triangles', 'triangles')} · {result.stitchHoleCount} {t('stl.exportedHoles', 'stitch holes')} · {t('stl.watertight', 'Watertight mesh')}</p>
        {result.warnings.length > 0 && <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      </>}
      <p className="hint">{t('stl.limits', 'The model is placed at the print origin. Curves are sampled; text engraving, bevels and fillets are not included. Check the dimensions and your slicer’s units before printing.')}</p>
      <div className="modal-actions">
        <button onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
        <button onClick={download} disabled={!result}>{t('stl.download', 'Download STL')}</button>
      </div>
    </div>
  </div>
}
