import { useTranslate } from '../hooks/useTranslate'
import { lazy, Suspense, useRef, useState, type ComponentProps } from 'react'
import { DocumentTransferReviewModal, type DocumentTransferReview } from './DocumentTransferReviewModal'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
const PatternPdfReviewModal = lazy(() => import('./PatternPdfReviewModal').then(module => ({ default: module.PatternPdfReviewModal })))

export type SvgImportMode = 'grouped' | 'exploded'

type SvgImportOptionsModalProps = {
  open: boolean
  fileName: string
  shapeCount: number
  warningCount: number
  warnings?: string[]
  sourceWidthMm: number
  sourceHeightMm: number
  onClose: () => void
  onApply: (targetWidthMm: number, mode: SvgImportMode) => void
  transferReview?: DocumentTransferReview
  patternPdfReview?: ComponentProps<typeof PatternPdfReviewModal>
}

export function SvgImportOptionsModal({
  open,
  fileName,
  shapeCount,
  warningCount,
  warnings,
  sourceWidthMm,
  sourceHeightMm,
  onClose,
  onApply,
  transferReview,
  patternPdfReview,
}: SvgImportOptionsModalProps) {
  const t = useTranslate()
  const [targetWidthMm, setTargetWidthMm] = useState(Math.max(0.01, sourceWidthMm))
  const [mode, setMode] = useState<SvgImportMode>('grouped')
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDialogFocus({ dialogRef, open: open && !transferReview && !patternPdfReview, onClose })

  if (!open) {
    return null
  }
  if (transferReview) return <DocumentTransferReviewModal review={transferReview} />
  if (patternPdfReview) return <Suspense fallback={<p>{t('Loading PDF review…')}</p>}><PatternPdfReviewModal {...patternPdfReview} /></Suspense>

  const scalePercent = sourceWidthMm > 0 ? (targetWidthMm / sourceWidthMm) * 100 : 100
  const targetHeightMm = sourceWidthMm > 0 ? sourceHeightMm * (targetWidthMm / sourceWidthMm) : sourceHeightMm
  const canApply = Number.isFinite(targetWidthMm) && targetWidthMm > 0

  return (
    <div className="modal-overlay" onClick={onClose} aria-label={t('SVG Import Options')}>
      <div className="modal-content" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="svg-import-title" onClick={(event) => event.stopPropagation()}>
        <h3 id="svg-import-title">{t('SVG Import Options')}</h3>

        <p>
          {fileName}: {shapeCount} {t('shape')}{t(shapeCount === 1 ? '' : 's')}
          {warningCount > 0 ? `, ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}
        </p>
        {warnings && warnings.length > 0 && <ul role="status">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}

        <label className="field-row">
          <span>{t('Import width (mm)')}</span>
          <input
            type="number"
            min={0.01}
            step={0.1}
            value={targetWidthMm}
            onChange={(event) => setTargetWidthMm(Number(event.target.value))}
          />
        </label>

        <p>
          {t('Height:')} {targetHeightMm.toFixed(2)} {t('mm | Scale:')} {scalePercent.toFixed(1)}%
        </p>

        <div className="view-mode-toggle" role="tablist" aria-label={t('SVG import mode')}>
          <button className={mode === 'grouped' ? 'active' : ''} onClick={() => setMode('grouped')}>
            {t('Grouped')}
          </button>
          <button className={mode === 'exploded' ? 'active' : ''} onClick={() => setMode('exploded')}>
            {t('Exploded')}
          </button>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>{t('Cancel')}</button>
          <button onClick={() => onApply(targetWidthMm, mode)} disabled={!canApply}>
            {t('Import')}
          </button>
        </div>
      </div>
    </div>
  )
}
