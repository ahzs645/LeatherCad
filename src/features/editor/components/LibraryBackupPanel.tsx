import { useRef, useState } from 'react'
import { getEditorLocalDataClient } from '../localdb/editor-local-data-client'
import { createLibraryBackup, parseLibraryBackup, restoreLibraryBackup, type LibraryBackup } from '../localdb/library-backup'
import { useTranslate } from '../hooks/useTranslate'

function downloadBackup(backup: LibraryBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = `leathercad-library-${backup.createdAt.slice(0, 10)}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function LibraryBackupPanel({ onStatus }: { onStatus: (message: string) => void }) {
  const t = useTranslate()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<LibraryBackup | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setMessage('')
    try { await operation() } catch (error) { const failure = error instanceof Error ? error.message : t('Library operation failed.'); setMessage(failure); onStatus(failure) } finally { setBusy(false) }
  }
  const requireClient = () => { const client = getEditorLocalDataClient(); if (!client) throw new Error(t('Local library storage is unavailable.')); return client }
  return <section className="control-block">
    <h3>{t('Local library backup')}</h3>
    <p>{t('Back up saved local projects, templates, catalogs, template folders and app preferences. Save the open drawing first. Sign-in state and recovery drafts are excluded.')}</p>
    <div className="line-type-modal-actions">
      <button type="button" disabled={busy} onClick={() => void run(async () => { downloadBackup(await createLibraryBackup(requireClient())); setMessage(t('Downloaded local library backup.')) })}>{t('Download library backup')}</button>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>{t('Choose library backup')}</button>
    </div>
    <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(async () => { if (file.size > 100 * 1024 * 1024) throw new Error(t('Library backup exceeds the 100 MB limit.')); setPending(parseLibraryBackup(await file.text())); setConfirmed(false) }) }} />
    {pending ? <>
      <p>{pending.data.documents.length} {t('projects')}, {pending.data.templateRepository.length} {t('templates')}, {pending.data.catalogRepository.length} {t('catalogs')} · {pending.createdAt}</p>
      <label>{t('Restore mode')}{' '}<select value={mode} disabled={busy} onChange={(event) => { setMode(event.target.value as 'merge' | 'replace'); setConfirmed(false) }}><option value="merge">{t('Merge — keep current records on ID conflicts')}</option><option value="replace">{t('Replace the saved local library')}</option></select></label>
      <p>{mode === 'replace' ? t('Replace removes the saved local library and restores this backup. Download a current backup before proceeding.') : t('Merge adds missing IDs. Existing projects, templates, catalogs and setting keys are kept.')}</p>
      <p>{t('Database restore uses one transaction. Browser preferences are restored separately with rollback on reported failures; keep the backup until you verify the result.')}</p>
      <label className="field-row"><input type="checkbox" disabled={busy} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{t('I reviewed the backup and restore mode')}</label>
      <div className="line-type-modal-actions"><button type="button" disabled={busy} onClick={() => setPending(null)}>{t('Cancel restore')}</button><button type="button" disabled={busy || !confirmed} onClick={() => void run(async () => { await restoreLibraryBackup(requireClient(), pending, mode); setPending(null); const text = t('Local library restored. Reopen library tools to see the restored records.'); setMessage(text); onStatus(text) })}>{t('Restore library')}</button></div>
    </> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>
}
