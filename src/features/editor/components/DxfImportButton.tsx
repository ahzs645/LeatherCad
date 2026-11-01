import { useTranslate } from '../hooks/useTranslate'
import { useDxfImportActions, type DxfImportActionsParams } from '../hooks/useDxfImportActions'
import { DocumentTransferReviewModal } from './DocumentTransferReviewModal'

/** A self-contained import action that can live in either desktop or mobile output controls. */
export function DxfImportButton(props: DxfImportActionsParams) {
  const t = useTranslate()
  const { inputRef, units, setUnits, isImporting, feedback, review, handleImportDxf, openImportDxf } = useDxfImportActions(props)
  return (
    <div className="dxf-import-actions">
      <select aria-label={t('DXF import units')} value={units} onChange={(event) => setUnits(event.target.value as typeof units)} disabled={isImporting}>
        <option value="auto">{t('DXF file units')}</option>
        <option value="mm">{t('Millimetres')}</option>
        <option value="in">{t('Inches')}</option>
        <option value="cm">{t('Centimetres')}</option>
        <option value="m">{t('Metres')}</option>
      </select>
      <button type="button" onClick={openImportDxf} disabled={isImporting}>{isImporting ? t('Importing DXF…') : t('Import DXF')}</button>
      <input ref={inputRef} type="file" accept=".dxf,application/dxf,image/vnd.dxf" className="hidden-input" onChange={handleImportDxf} />
      {review && <DocumentTransferReviewModal key={review.fileName} review={review} />}
      {feedback ? (
        <div className="dxf-import-feedback" role={feedback.kind === 'error' ? 'alert' : 'status'}>
          <p>{feedback.message}</p>
          {feedback.warnings.length ? <ul>{feedback.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
        </div>
      ) : null}
    </div>
  )
}
