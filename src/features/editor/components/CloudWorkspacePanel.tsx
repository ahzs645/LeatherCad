import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { DocFile } from '../cad/cad-types'
import { useTranslate } from '../hooks/useTranslate'
import { createCloudWorkspaceClient, type CloudDocumentRevision, type CloudFolder, type CloudWorkspaceDocument } from '../localdb/cloud-workspace-client'
import { getEditorCloudState, getEditorCloudTransport, subscribeEditorCloudState } from '../localdb/editor-cloud-connection'
import { getEditorLocalDataClient } from '../localdb/editor-local-data-client'

export type CloudWorkspacePanelProps = {
  onLoadDocument?: (doc: DocFile) => void
  onStatus?: (message: string) => void
  onChanged?: () => void | Promise<void>
}

export function CloudWorkspacePanel({ onLoadDocument, onStatus, onChanged }: CloudWorkspacePanelProps) {
  const t = useTranslate()
  const cloud = useSyncExternalStore(subscribeEditorCloudState, getEditorCloudState)
  const client = useMemo(() => cloud.configured && cloud.user && getEditorCloudState().sessionKey === cloud.sessionKey ? createCloudWorkspaceClient(getEditorCloudTransport()) : null,
    [cloud.configured, cloud.sessionKey, cloud.user])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<CloudFolder[]>([])
  const [documents, setDocuments] = useState<CloudWorkspaceDocument[]>([])
  const [selected, setSelected] = useState<CloudWorkspaceDocument | null>(null)
  const [history, setHistory] = useState<CloudDocumentRevision[]>([])
  const [destination, setDestination] = useState('')
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [rename, setRename] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const generation = useRef(0), request = useRef(0)
  const invalidateRequests = useCallback(() => { request.current++ }, [])
  const cancelPending = useCallback(() => { generation.current++; request.current++ }, [])
  useEffect(() => {
    generation.current++
    return cancelPending
  }, [cloud.sessionKey, cancelPending])
  const refresh = useCallback(async () => {
    if (!client) return
    const id = ++request.current
    const [allFolders, drawings] = await Promise.all([client.folders.listAll(), client.documents.list(folderId)])
    if (id !== request.current || getEditorCloudState().sessionKey !== cloud.sessionKey) return
    setFolders(allFolders)
    setDocuments(drawings)
    setSelected(current => current ? drawings.find(doc => doc.id === current.id) ?? null : null)
  }, [client, folderId, cloud.sessionKey])
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void refresh().catch(reason => { if (active && getEditorCloudState().sessionKey === cloud.sessionKey) setError(reason instanceof Error ? reason.message : t('cloudWorkspace.loadFailed', 'Could not load folders')) })
    }, 0)
    return () => { active = false; invalidateRequests(); window.clearTimeout(timer) }
  }, [refresh, t, cloud.sessionKey, invalidateRequests])
  useEffect(() => {
    if (!client || !selected) return
    let active = true
    void client.documents.history(selected.id).then(rows => { if (active && getEditorCloudState().sessionKey === cloud.sessionKey) setHistory(rows) })
      .catch(reason => { if (active && getEditorCloudState().sessionKey === cloud.sessionKey) setError(reason instanceof Error ? reason.message : t('cloudWorkspace.historyFailed', 'Could not load revision history')) })
    return () => { active = false }
  }, [client, selected, t, cloud.sessionKey])
  const run = async (operation: () => Promise<string | void>) => {
    const current = generation.current
    setBusy(true); setMessage(''); setError('')
    try {
      const result = await operation()
      if (generation.current !== current || getEditorCloudState().sessionKey !== cloud.sessionKey) return
      if (result) { setMessage(result); onStatus?.(result) }
      await refresh()
      await onChanged?.()
    } catch (reason) {
      if (generation.current === current && getEditorCloudState().sessionKey === cloud.sessionKey) setError(reason instanceof Error ? reason.message : t('cloudWorkspace.operationFailed', 'Cloud operation did not complete'))
    } finally { if (generation.current === current && getEditorCloudState().sessionKey === cloud.sessionKey) setBusy(false) }
  }
  const folderPath = (id: string | null) => {
    const names: string[] = [], seen = new Set<string>()
    let next = id
    while (next && !seen.has(next)) {
      seen.add(next)
      const entry = folders.find(item => item.id === next)
      if (!entry) break
      names.unshift(entry.name)
      next = entry.parentId
    }
    return [t('cloudWorkspace.root', 'Root folder'), ...names].join(' / ')
  }
  const openFolder = (id: string | null) => { setFolderId(id); setSelected(null); setHistory([]); setError(''); setMessage('') }
  const openCopy = (revision: CloudDocumentRevision) => run(async () => {
    if (!client || !selected) return
    const current = generation.current
    const snapshot = await client.documents.readRevision(selected.id, revision.revision)
    if (!snapshot) throw new Error(t('cloudWorkspace.revisionGone', 'This revision is no longer available'))
    if (generation.current !== current || getEditorCloudState().sessionKey !== cloud.sessionKey) return
    const local = getEditorLocalDataClient()
    if (!local) throw new Error(t('cloudWorkspace.localUnavailable', 'Local storage is unavailable; the revision was not opened'))
    const name = `${snapshot.name} (${t('cloudWorkspace.revision', 'revision')} ${snapshot.revision})`
    const doc = { ...snapshot.doc, documentName: name }
    const created = await local.documents.create({ name, doc })
    if (generation.current !== current || getEditorCloudState().sessionKey !== cloud.sessionKey) {
      await local.documents.delete(created.id)
      throw new Error(t('cloudWorkspace.copyCancelled', 'Sign-in changed; the revision copy was cancelled'))
    }
    onLoadDocument?.(doc)
    return `${t('cloudWorkspace.copyOpened', 'Created local copy')}: ${name}`
  })

  if (!client) return <p>{t('cloudWorkspace.signIn', 'Sign in to organize cloud drawings and view revision history.')}</p>
  const here = folders.find(item => item.id === folderId)
  const children = folders.filter(item => item.parentId === folderId).sort((a, b) => a.name.localeCompare(b.name))
  return <section aria-label={t('cloudWorkspace.title', 'Folders and revision history')} className="control-block">
    <h3>{t('cloudWorkspace.title', 'Folders and revision history')}</h3>
    <p>{folderPath(folderId)}</p>
    <div className="modal-actions">
      <button disabled={busy || folderId === null} onClick={() => openFolder(null)}>{t('cloudWorkspace.root', 'Root folder')}</button>
      <button disabled={busy || !here} onClick={() => openFolder(here?.parentId ?? null)}>{t('cloudWorkspace.up', 'Up one folder')}</button>
      <button disabled={busy} onClick={() => void run(refresh)}>{t('cloudWorkspace.refresh', 'Refresh')}</button>
    </div>
    <form onSubmit={event => { event.preventDefault(); void run(async () => { await client.folders.create(newName, folderId); setNewName(''); return t('cloudWorkspace.created', 'Folder created') }) }}>
      <label className="field-row"><span>{t('cloudWorkspace.newFolder', 'New folder')}</span><input maxLength={120} value={newName} onChange={event => setNewName(event.target.value)} disabled={busy} /></label>
      <button disabled={busy || !newName.trim()}>{t('cloudWorkspace.create', 'Create folder')}</button>
    </form>
    <label className="field-row"><span>{t('cloudWorkspace.destination', 'Move destination')}</span>
      <select value={destination} disabled={busy} onChange={event => setDestination(event.target.value)}>
        <option value="">{t('cloudWorkspace.root', 'Root folder')}</option>
        {[...folders].sort((a, b) => folderPath(a.id).localeCompare(folderPath(b.id))).map(item => <option key={item.id} value={item.id}>{folderPath(item.id)}</option>)}
      </select>
    </label>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <ul aria-label={t('cloudWorkspace.folders', 'Folders')}>
      {children.map(item => <li key={item.id}>
        <button disabled={busy} onClick={() => openFolder(item.id)}>{item.name}</button>{' '}
        {renaming === item.id ? <form onSubmit={event => { event.preventDefault(); void run(async () => { await client.folders.rename(item, rename); setRenaming(null); return t('cloudWorkspace.renamed', 'Folder renamed') }) }}>
          <label>{t('cloudWorkspace.folderName', 'Folder name')} <input maxLength={120} value={rename} onChange={event => setRename(event.target.value)} disabled={busy} /></label>
          <button disabled={busy || !rename.trim()}>{t('common.save', 'Save')}</button>
          <button type="button" disabled={busy} onClick={() => setRenaming(null)}>{t('common.cancel', 'Cancel')}</button>
        </form> : <button disabled={busy} onClick={() => { setRenaming(item.id); setRename(item.name) }}>{t('cloudWorkspace.rename', 'Rename')}</button>}{' '}
        <button disabled={busy || destination === item.id || (destination || null) === item.parentId} onClick={() => void run(async () => { await client.folders.move(item, destination || null); return t('cloudWorkspace.moved', 'Folder moved') })}>{t('cloudWorkspace.moveFolder', 'Move folder')}</button>{' '}
        <button disabled={busy} onClick={() => void run(async () => { await client.folders.remove(item); return t('cloudWorkspace.deleted', 'Empty folder deleted') })}>{t('cloudWorkspace.deleteEmpty', 'Delete empty folder')}</button>
      </li>)}
    </ul>
    <ul aria-label={t('cloudWorkspace.drawings', 'Drawings in this folder')}>
      {documents.map(doc => <li key={doc.id}>
        <button disabled={busy} onClick={() => { setSelected(doc); setHistory([]) }}>{doc.name} · {t('cloudWorkspace.revision', 'revision')} {doc.revision}</button>{' '}
        <button disabled={busy || (destination || null) === doc.folderId} onClick={() => void run(async () => { await client.documents.move(doc, destination || null); return t('cloudWorkspace.drawingMoved', 'Drawing moved') })}>{t('cloudWorkspace.moveDrawing', 'Move drawing')}</button>
      </li>)}
    </ul>
    {documents.length === 0 && <p>{t('cloudWorkspace.empty', 'No drawings in this folder.')}</p>}
    {selected && <section aria-label={t('cloudWorkspace.history', 'Revision history')}>
      <h4>{selected.name}: {t('cloudWorkspace.history', 'Revision history')}</h4>
      <p>{t('cloudWorkspace.historyHint', 'Open a revision as a separate local copy, or restore it as a new cloud revision. Earlier revisions are kept.')}</p>
      {history.length === 0 && <p>{t('cloudWorkspace.noHistory', 'No saved revisions are available yet. The next cloud save will record this drawing’s history.')}</p>}
      <ul>{history.map(revision => <li key={revision.revision}>
        {t('cloudWorkspace.revision', 'Revision')} {revision.revision} · {new Date(revision.savedAt).toLocaleString()}{' '}
        {revision.restoredFromRevision !== null && <span>({t('cloudWorkspace.restoredFrom', 'restored from revision')} {revision.restoredFromRevision}) </span>}
        <button disabled={busy} onClick={() => void openCopy(revision)}>{t('cloudWorkspace.openCopy', 'Open local copy')}</button>{' '}
        <button disabled={busy || revision.revision === selected.revision} onClick={() => void run(async () => { const restored = await client.documents.restore(selected, revision.revision); return `${t('cloudWorkspace.restored', 'Restored as new revision')} ${restored.revision}` })}>{t('cloudWorkspace.restore', 'Restore as new revision')}</button>
      </li>)}</ul>
    </section>}
  </section>
}
