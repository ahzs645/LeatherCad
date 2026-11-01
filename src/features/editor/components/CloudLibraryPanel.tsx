import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DocFile } from '../cad/cad-types'
import { useTranslate } from '../hooks/useTranslate'
import { createCloudLifecycleClient, type CloudDrawingSummary } from '../localdb/cloud-lifecycle-client'
import { emptyCloudPage, mergeCloudPage } from '../localdb/cloud-types'
import { getEditorCloudState, getEditorCloudTransport } from '../localdb/editor-cloud-connection'

type Props = { currentDoc: DocFile; saveLocalCopy(doc: DocFile, name: string): Promise<string>; onChanged(): Promise<void>; onStatus?(text: string): void }
export function CloudLibraryPanel({ currentDoc, saveLocalCopy, onChanged, onStatus }: Props) {
  const t = useTranslate()
  const session = getEditorCloudState().sessionKey
  const client = useMemo(() => createCloudLifecycleClient(getEditorCloudTransport()), [])
  const [page, setPage] = useState(emptyCloudPage<CloudDrawingSummary>)
  const [trash, setTrash] = useState(false)
  const [target, setTarget] = useState<CloudDrawingSummary | null>(null)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const active = useRef(true), generation = useRef(0)
  const invalidate = useCallback(() => { generation.current++ }, [])
  useEffect(() => { active.current = true; return () => { active.current = false; invalidate() } }, [invalidate])
  const current = useCallback(() => active.current && session === getEditorCloudState().sessionKey, [session])
  const load = useCallback(async (cursor: string | null = null) => {
    const request = ++generation.current
    const next = await client.listPage(trash, cursor)
    if (current() && request === generation.current) setPage(previous => cursor ? mergeCloudPage(previous, next) : next)
  }, [client, trash, current])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(reason => { if (current()) setError(reason instanceof Error ? reason.message : 'Could not load drawings') }) }, 0)
    return () => { window.clearTimeout(timer); invalidate() }
  }, [load, current, invalidate])
  const run = async (operation: () => Promise<string | void>, refreshAfter = true) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await operation()
      if (!current()) return
      if (result) { setMessage(result); onStatus?.(result) }
      if (refreshAfter) { await load(); await onChanged() }
    } catch (reason) { if (current()) setError(reason instanceof Error ? reason.message : 'Cloud operation did not complete') }
    finally { if (current()) setBusy(false) }
  }
  const select = (row: CloudDrawingSummary) => { setTarget(row); setName(row.name); setConfirmDelete(false); setError(''); setMessage('') }
  return <section className="control-block" aria-label={t('cloudLibrary.title', 'Cloud drawing library')}>
    <h3>{t('cloudLibrary.title', 'Cloud drawing library')}</h3>
    <p>{t('cloudLibrary.copyHint', 'Local projects and cloud drawings remain separate. Select a cloud drawing before updating it; refreshing the list does not replace the revision you selected.')}</p>
    <div className="modal-actions">
      <button disabled={busy} aria-pressed={!trash} onClick={() => { setTrash(false); setTarget(null); setConfirmDelete(false) }}>{t('cloudLibrary.drawings', 'Drawings')}</button>
      <button disabled={busy} aria-pressed={trash} onClick={() => { setTrash(true); setTarget(null); setConfirmDelete(false) }}>{t('cloudLibrary.trash', 'Trash')}</button>
      <button disabled={busy} onClick={() => void run(async () => {
        let cursor: string | null = null, count = 0
        const seen = new Set<string>()
        for (let page = 0; page < 2000; page++) {
          const result = await client.indexLegacyPage(cursor); count += result.indexed
          if (result.isDone) return `${count} drawings indexed`
          if (!result.continueCursor || seen.has(result.continueCursor)) throw new Error('Cloud indexing did not advance')
          seen.add(result.continueCursor); cursor = result.continueCursor
        }
        throw new Error('Cloud indexing exceeds this operation’s page limit')
      })}>{t('cloudLibrary.indexLegacy', 'Index older cloud drawings')}</button>
      <button disabled={busy} onClick={() => void run(() => load())}>{t('common.refresh', 'Refresh')}</button>
    </div>
    <ul>{page.page.map(row => <li key={row.id}><button disabled={busy} aria-pressed={target?.id === row.id} onClick={() => select(row)}>{row.name} · {t('cloudWorkspace.revision', 'revision')} {row.revision}</button></li>)}</ul>
    {page.page.length === 0 && <p>{t('cloudLibrary.empty', 'No drawings in this page.')}</p>}
    {!page.isDone && <button disabled={busy} onClick={() => void run(() => load(page.continueCursor), false)}>{t('cloudLibrary.more', 'Load more drawings')}</button>}
    {target && <section aria-label={t('cloudLibrary.selected', 'Selected cloud drawing')}>
      <h4>{target.name} · {t('cloudWorkspace.revision', 'revision')} {target.revision}</h4>
      {trash ? <><button disabled={busy} onClick={() => void run(async () => { await client.restore(target); setTarget(null); return t('cloudLibrary.restored', 'Drawing restored in the root folder. The newest 100 revisions are kept.') })}>{t('cloudLibrary.restore', 'Restore drawing')}</button>
        {confirmDelete ? <div><p>{t('cloudLibrary.purgeWarning', 'Permanently delete this cloud drawing and every retained revision? This cannot be undone. Local copies and published patterns remain separate.')}</p><button disabled={busy} onClick={() => void run(async () => { await client.purge(target); setTarget(null); setConfirmDelete(false); return t('cloudLibrary.purging', 'Permanent deletion started. Refresh after it completes to see the released quota.') })}>{t('cloudLibrary.confirmPurge', 'Permanently delete drawing and history')}</button><button disabled={busy} onClick={() => setConfirmDelete(false)}>{t('common.cancel', 'Cancel')}</button></div> : <button disabled={busy} onClick={() => setConfirmDelete(true)}>{t('cloudLibrary.purge', 'Delete permanently')}</button>}
      </> : <>
        <button disabled={busy} onClick={() => void run(async () => {
          const drawing = await client.get(target.id)
          if (!drawing) throw new Error(t('cloudLibrary.gone', 'Drawing is no longer available'))
          if (!current()) return
          const result = await saveLocalCopy(drawing.doc, `${drawing.name} (cloud copy)`)
          if (current()) setTarget({ ...target, revision: drawing.revision, name: drawing.name })
          return result
        })}>{t('cloudLibrary.open', 'Open a local copy')}</button>
        <button disabled={busy} onClick={() => void run(async () => {
          const saved = await client.update(target, currentDoc)
          setTarget({ ...target, name: saved.name, revision: saved.revision, updatedAt: saved.updatedAt }); setName(saved.name)
          return t('cloudLibrary.updated', 'Current drawing saved as a new cloud revision')
        })}>{t('cloudLibrary.update', 'Update selected cloud drawing with current drawing')}</button>
        <form onSubmit={event => { event.preventDefault(); void run(async () => { const renamed = await client.rename(target, name); setTarget(renamed); return t('cloudLibrary.renamed', 'Cloud drawing renamed') }) }}>
          <label>{t('cloudLibrary.name', 'Cloud drawing name')} <input maxLength={200} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
          <button disabled={busy || !name.trim()}>{t('cloudLibrary.rename', 'Rename drawing')}</button>
        </form>
        {confirmDelete ? <div><p>{t('cloudLibrary.deleteHint', 'Move this cloud drawing to Trash? Local projects stay on this device. You can restore the cloud drawing later.')}</p>
          <button disabled={busy} onClick={() => void run(async () => { await client.remove(target); setTarget(null); setConfirmDelete(false); return t('cloudLibrary.deleted', 'Cloud drawing moved to Trash') })}>{t('cloudLibrary.confirmDelete', 'Move to Trash')}</button>
          <button disabled={busy} onClick={() => setConfirmDelete(false)}>{t('common.cancel', 'Cancel')}</button>
        </div> : <button disabled={busy} onClick={() => setConfirmDelete(true)}>{t('cloudLibrary.delete', 'Delete cloud drawing')}</button>}
      </>}
    </section>}
    {error && <p role="alert">{error}</p>}
    {error.includes('changed') && <p>{t('cloudLibrary.conflictHint', 'Your local drawing is unchanged. Refresh the list, select the latest cloud revision to retry, or use Save new private cloud copy to keep both versions.')}</p>}
    {message && <p role="status">{message}</p>}{busy && <p role="status">{t('common.working', 'Working…')}</p>}
  </section>
}
