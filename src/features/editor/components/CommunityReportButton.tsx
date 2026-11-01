import { useState } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import { getEditorCloudTransport } from '../localdb/editor-cloud-connection'

export type CommunityReportTarget = { kind: 'topic' | 'post' | 'pattern'; id: string }
export function CommunityReportButton({ target }: { target: CommunityReportTarget }) {
  const t = useTranslate()
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  return <span>
    <button type="button" disabled={busy} onClick={() => setOpen(value => !value)}>{t('community.report', 'Report content')}</button>
    {open && <form onSubmit={event => {
      event.preventDefault(); setBusy(true); setMessage('')
      void (async () => { await getEditorCloudTransport().mutation('communityModeration:report', { target, reason }) })().then(() => { setOpen(false); setReason(''); setMessage(t('community.reported', 'Report submitted for review')) })
        .catch(error => setMessage(error instanceof Error ? error.message : 'Report could not be submitted')).finally(() => setBusy(false))
    }}><label>{t('community.reportReason', 'Reason for reporting')} <textarea maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
      <button disabled={busy || !reason.trim()}>{t('community.submitReport', 'Submit report')}</button>
      <button type="button" disabled={busy} onClick={() => setOpen(false)}>{t('common.cancel', 'Cancel')}</button>
    </form>}
    {message && <span role="status">{message}</span>}
  </span>
}
