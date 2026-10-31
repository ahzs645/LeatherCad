import { useRef } from 'react'
import type { DraftRecoveryDialogProps } from '../hooks/useDraftRecovery'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { useTranslate } from '../hooks/useTranslate'
import './DraftRecoveryDialog.css'

export function DraftRecoveryDialog(props: DraftRecoveryDialogProps) {
  const t = useTranslate(), ref = useRef<HTMLDivElement>(null)
  const open = props.loading || Boolean(props.draft)
  useModalDialogFocus({ dialogRef: ref, open, onClose: () => undefined, closeOnEscape: false })
  return <>
    {props.failure ? <aside className="draft-recovery-failure" role="alert">
      <span>{t(props.failure)}</span>
      <button onClick={props.onDownloadCurrent}>{t('Download current drawing')}</button>
      <button onClick={props.onRetry}>{t('Check stored drafts again')}</button>
      {props.canDismissFailure ? <button onClick={props.onDismissFailure}>{t('Dismiss')}</button> : null}
    </aside> : null}
    {open ? <div className="modal-backdrop draft-recovery-backdrop">
      <div className="line-type-modal draft-recovery-dialog" ref={ref} role="dialog" aria-modal="true" aria-label={t('Recover saved drawing')} tabIndex={-1} onKeyDown={event => event.stopPropagation()}>
        <h2>{t('Recover saved drawing')}</h2>
        {props.loading ? <p role="status">{t('Checking saved drafts…')}</p> : <>
          <p>{t('A saved draft is available. Recover it, download a backup, or discard stored drafts and keep the current drawing. Automatic saving is paused until you choose.')}</p>
          {props.explicitTransfer ? <p>{t('Your explicitly opened project takes precedence. Recovery will replace it only if you choose Recover.')}</p> : null}
          {props.drafts.length > 1 ? <label>{t('Saved draft')}<select value={props.selected} onChange={event => props.onSelect(Number(event.target.value))} disabled={props.busy}>
            {props.drafts.map((item, index) => <option key={item.key} value={index}>{item.snapshot?.reason === 'signin' ? t('Before sign-in') : t('Automatic save')}</option>)}
          </select></label> : null}
          {props.draft?.snapshot?.savedAt ? <p>{t('Saved')} {new Date(props.draft.snapshot.savedAt).toLocaleString()}</p> : null}
          {props.error || props.draft?.error ? <p role="alert">{t(props.error || props.draft?.error || '')}</p> : null}
          {props.draft?.warning ? <p role="alert">{t(props.draft.warning)} <button onClick={props.onRetry} disabled={props.busy}>{t('Check stored drafts again')}</button></p> : null}
          <div className="line-type-modal-actions">
            <button onClick={() => { void props.onRecover() }} disabled={props.busy || !props.draft?.snapshot}>{t('Recover')}</button>
            <button onClick={props.onDownloadDraft} disabled={props.busy}>{t('Download saved draft')}</button>
            <button onClick={props.onDownloadCurrent} disabled={props.busy}>{t('Download current drawing')}</button>
            <button onClick={() => { void props.onDiscard() }} disabled={props.busy}>{t('Discard stored drafts')}</button>
          </div>
        </>}
      </div>
    </div> : null}
  </>
}
