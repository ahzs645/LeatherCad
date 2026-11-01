import { useMemo, useRef, useState } from 'react'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { useTranslate } from '../hooks/useTranslate'
import { buildPatternPdfImportFromPage, type PatternPdfImport } from '../ops/pattern-pdf/pattern-pdf-import'
import type { PatternPdfReview } from '../ops/pattern-pdf/pattern-pdf-review'
import './PatternPdfReviewModal.css'

export type PatternPdfReviewModalProps = {
  review: PatternPdfReview
  onConfirm: (result: PatternPdfImport) => void
  onClose: () => void
}

export function PatternPdfReviewModal({ review, onConfirm, onClose }: PatternPdfReviewModalProps) {
  const t = useTranslate()
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open: true, onClose })
  const [pageNumber, setPageNumber] = useState(review.suggestedPageNumber)
  const [stitching, setStitching] = useState(true)
  const [folds, setFolds] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)
  const selected = review.pages.find((page) => page.pageNumber === pageNumber) ?? review.pages[0]
  const result = useMemo(() => selected?.page ? buildPatternPdfImportFromPage(selected.page, { documentName: review.fileName.replace(/\.pdf$/i, ''), build: { inferFoldLines: folds } }, stitching) : null, [selected, review.fileName, stitching, folds])
  const analysis = result?.analysis
  const canImport = !!analysis?.pieces.length && acknowledged

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="export-options-modal pattern-pdf-review-modal" role="dialog" aria-modal="true" aria-labelledby="pattern-pdf-review-title" ref={dialogRef} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <h2 id="pattern-pdf-review-title">{t('Review pattern PDF')}</h2>
        <p>{review.fileName}</p>
        <label>{t('Pattern page')}{' '}<select aria-label={t('Pattern page')} value={pageNumber} onChange={(event) => { setPageNumber(Number(event.target.value)); setAcknowledged(false) }}>
          {review.pages.map((page) => <option value={page.pageNumber} key={page.pageNumber}>{t('Page')} {page.pageNumber} — {page.result?.analysis.pieces.length ?? 0} {t('pieces')}{page.issues.length ? ` · ${t('review warnings')}` : ''}</option>)}
        </select></label>
        {analysis ? <>
          <p role="status">{result?.summary}</p>
          <svg role="img" aria-label={t('Detected pattern pieces and stitch marks')} viewBox={`0 0 ${analysis.page.widthMm} ${analysis.page.heightMm}`} style={{ width: '100%', height: 240, background: '#fff', border: '1px solid #777' }}>
            {analysis.pieces.map((piece) => <g key={piece.id}><polygon points={piece.outline.polygon.map((point) => `${point.x},${point.y}`).join(' ')} fill="#d5b183" stroke="#352313" strokeWidth={0.5} /><title>{piece.name || piece.id}: {piece.widthMm.toFixed(1)} × {piece.heightMm.toFixed(1)} mm</title>{piece.stitchRuns.flatMap((run) => run.dots.map((dot) => <circle key={`${run.id}-${dot.id}`} cx={dot.center.x} cy={dot.center.y} r={Math.max(0.5, dot.diameterMm / 2)} fill="#154fa0" />))}</g>)}
          </svg>
          <p>{result?.doc.foldLines.length ?? 0} {t('inferred folds')}, {result?.doc.seamConnections?.length ?? 0} {t('inferred seams')}. {t('Dimensions use PDF millimetres; verify the printed scale before cutting.')}</p>
          <label className="field-row"><input type="checkbox" checked={stitching} onChange={(event) => { setStitching(event.target.checked); setAcknowledged(false) }} />{t('Use inferred stitching and seam matches')}</label>
          <label className="field-row"><input type="checkbox" checked={folds} onChange={(event) => { setFolds(event.target.checked); setAcknowledged(false) }} />{t('Use inferred fold lines')}</label>
        </> : null}
        {selected?.issues.length ? <ul aria-label={t('Import warnings')}>{selected.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : null}
        <p>{t('Detection is a suggestion. Check outlines, stitch pitch, folds and seams before replacing the drawing.')}</p>
        <label className="field-row"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />{t('I reviewed this page and its inferred geometry')}</label>
        <div className="line-type-modal-actions"><button type="button" onClick={onClose}>{t('Cancel')}</button><button type="button" disabled={!canImport} onClick={() => result && onConfirm(result)}>{t('Import reviewed page')}</button></div>
      </div>
    </div>
  )
}
