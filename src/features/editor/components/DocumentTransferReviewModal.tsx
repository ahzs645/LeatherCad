import { useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Shape } from '../cad/cad-types'
import { sampleShapePoints } from '../cad/cad-geometry'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { useTranslate } from '../hooks/useTranslate'
import './DocumentTransferReviewModal.css'

export type DocumentTransferReview = {
  fileName: string
  title: string
  actionLabel: string
  summary: Array<{ label: string; value: string }>
  warnings: string[]
  shapes: Shape[]
  layers?: Array<{ id: string; name: string; count: number }>
  onApply: (layerIds?: ReadonlySet<string>) => void
  onClose: () => void
}

export function DocumentTransferReviewModal({ review }: { review: DocumentTransferReview }) {
  const t = useTranslate(), titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [layerIds, setLayerIds] = useState(() => new Set(review.layers?.map(layer => layer.id)))
  useModalDialogFocus({ dialogRef, open: true, onClose: review.onClose })
  const preview = useMemo(() => {
    const shown = review.shapes.filter(shape => !review.layers || layerIds.has(shape.layerId)).slice(0, 500)
    const paths = shown.map(shape => sampleShapePoints(shape, 20))
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const path of paths) for (const point of path) { minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y) }
    return { paths, viewBox: paths.length ? `${minX - 1} ${minY - 1} ${Math.max(2, maxX - minX + 2)} ${Math.max(2, maxY - minY + 2)}` : '0 0 10 10' }
  }, [review, layerIds])
  return createPortal(<div className="modal-overlay document-transfer-review" onClick={review.onClose}>
    <div className="modal-content" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
      <h3 id={titleId}>{t(review.title)}</h3><p>{review.fileName}</p>
      <dl>{review.summary.map(item => <div key={item.label}><dt>{t(item.label)}</dt><dd>{item.value}</dd></div>)}</dl>
      <svg role="img" aria-label={t('Drawing preview')} viewBox={preview.viewBox} style={{ width: '100%', height: 220, border: '1px solid currentColor' }}>
        {preview.paths.map((points, index) => <polyline key={index} points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      </svg>
      {review.shapes.length > 500 && <p>{t('Preview shows the first 500 shapes. All selected geometry will be imported.')}</p>}
      {review.layers && <fieldset style={{ maxHeight: 240, overflowY: 'auto' }}><legend>{t('Layers to append')}</legend>{review.layers.map(layer => <label className="layer-toggle-item" key={layer.id}>
        <input type="checkbox" checked={layerIds.has(layer.id)} onChange={event => setLayerIds(previous => { const next = new Set(previous); if (event.target.checked) next.add(layer.id); else next.delete(layer.id); return next })} />{layer.name} ({layer.count})
      </label>)}</fieldset>}
      {review.warnings.length > 0 && <div role="status"><h4>{t('Transfer warnings')}</h4><ul>{review.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
      <p>{t('Cancel keeps the current drawing unchanged.')}</p>
      <div className="modal-actions"><button type="button" onClick={review.onClose}>{t('Cancel')}</button><button type="button" disabled={Boolean(review.layers && !layerIds.size)} onClick={() => review.onApply(review.layers ? layerIds : undefined)}>{t(review.actionLabel)}</button></div>
    </div>
  </div>, document.body)
}
