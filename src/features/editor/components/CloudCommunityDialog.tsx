import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { DocFile } from '../cad/cad-types'
import { emptyCloudPage, mergeCloudPage, type PatternLicense, type PublishedPatternSummary } from '../localdb/cloud-types'
import { getEditorLocalDataClient } from '../localdb/editor-local-data-client'
import {
  getEditorCloudClients, getEditorCloudState, signInToEditorCloud, signOutOfEditorCloud, subscribeEditorCloudState,
} from '../localdb/editor-cloud-connection'
import { makeAttributedPatternCopy, uploadLocalProjects } from '../localdb/cloud-sync'
import type { EditorCloudState } from '../localdb/editor-cloud-connection'
import { useTranslate } from '../hooks/useTranslate'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { CloudStoragePanel } from './CloudStoragePanel'
import { CloudLibraryPanel } from './CloudLibraryPanel'
import { CloudWorkspacePanel } from './CloudWorkspacePanel'
import { CommunityReportButton } from './CommunityReportButton'
import { CommunityOperationsPanel } from './CommunityOperationsPanel'
import { CommunityBoardPanel } from './CommunityBoardPanel'

type CloudCommunityDialogProps = {
  open: boolean
  onClose: () => void
  currentDoc: DocFile
  onLoadDocument?: (doc: DocFile) => void
  onStatus?: (message: string) => void
}

export function CloudCommunityDialog(props: CloudCommunityDialogProps) {
  const cloud = useSyncExternalStore(subscribeEditorCloudState, getEditorCloudState)
  return <CloudCommunitySession key={cloud.sessionKey} {...props} cloud={cloud} />
}

function CloudCommunitySession({ open, onClose, currentDoc, onLoadDocument, onStatus, cloud }: CloudCommunityDialogProps & { cloud: EditorCloudState }) {
  const t = useTranslate()
  const [title, setTitle] = useState(currentDoc.documentName ?? '')
  const [retiringPattern, setRetiringPattern] = useState<PublishedPatternSummary | null>(null)
  const [editingPattern, setEditingPattern] = useState<PublishedPatternSummary | null>(null)
  const [patterns, setPatterns] = useState(emptyCloudPage<PublishedPatternSummary>)
  const [mine, setMine] = useState(emptyCloudPage<PublishedPatternSummary>)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [license, setLicense] = useState<PatternLicense>('CC-BY-4.0')
  const [isPublic, setIsPublic] = useState(false)
  const [attribution, setAttribution] = useState('')
  const [search, setSearch] = useState('')
  const [gallerySearch, setGallerySearch] = useState('')
  const [description, setDescription] = useState('')
  const [versions, setVersions] = useState<Record<string, number>>({})
  const dialogRef = useRef<HTMLElement>(null)
  const refreshRequest = useRef(0)
  const copyLifetime = useRef({ active: true, open, doc: currentDoc, generation: 0 })
  useLayoutEffect(() => { copyLifetime.current.open = open; copyLifetime.current.doc = currentDoc }, [open, currentDoc])
  useLayoutEffect(() => { copyLifetime.current.generation++ }, [open])
  useLayoutEffect(() => { const lifetime = copyLifetime.current; lifetime.active = true; return () => { lifetime.active = false; lifetime.generation++ } }, [])
  const close = useCallback(() => { copyLifetime.current.generation++; onClose() }, [onClose])
  useModalDialogFocus({ dialogRef, open, onClose: close, closeOnEscape: !busy })
  const assertCurrentSession = () => {
    if (getEditorCloudState().sessionKey !== cloud.sessionKey) throw new Error('Your sign-in session changed; refresh the cloud library')
  }

  const refresh = useCallback(async () => {
    if (!cloud.configured) return
    const request = ++refreshRequest.current
    const clients = getEditorCloudClients()
    const [gallery, published] = await Promise.all([
      clients.community.listPublicPage(null, gallerySearch),
      getEditorCloudState().user ? clients.community.listMinePage() : Promise.resolve(emptyCloudPage<PublishedPatternSummary>()),
    ])
    if (getEditorCloudState().sessionKey !== cloud.sessionKey || request !== refreshRequest.current) return
    setPatterns(gallery); setMine(published)
  }, [cloud.configured, cloud.sessionKey, gallerySearch])
  const run = async (operation: () => Promise<string | void>, refreshAfter = true) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await operation()
      assertCurrentSession()
      if (result) { setMessage(result); onStatus?.(result) }
      if (refreshAfter) await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cloud operation did not complete')
    } finally { setBusy(false) }
  }
  useEffect(() => {
    if (!open || !cloud.configured) return
    let active = true
    const timer = window.setTimeout(() => {
      void refresh().catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load cloud library') })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [open, cloud.configured, refresh])

  if (!open) return null
  const saveLocalCopy = async (doc: DocFile, name: string, expectedGeneration = copyLifetime.current.generation) => {
    assertCurrentSession()
    const baseline = JSON.stringify(currentDoc)
    const current = () => copyLifetime.current.active && copyLifetime.current.open && copyLifetime.current.generation === expectedGeneration && JSON.stringify(copyLifetime.current.doc) === baseline
    if (!current()) throw new Error('The drawing or cloud dialog changed; the pending copy was cancelled')
    const local = getEditorLocalDataClient()
    if (!local) throw new Error('Local project storage is unavailable; no copy was opened')
    const copy = { ...doc, documentName: name }
    const created = await local.documents.create({ name, doc: copy })
    if (getEditorCloudState().sessionKey !== cloud.sessionKey || !current()) {
      await local.documents.delete(created.id)
      throw new Error('The drawing, cloud dialog or sign-in session changed; the pending copy was cancelled')
    }
    onLoadDocument?.(copy)
    return `Created local copy: ${name}`
  }
  const copyPattern = (pattern: PublishedPatternSummary) => run(async () => {
    const generation = copyLifetime.current.generation
    const full = await getEditorCloudClients().community.get(pattern.id, versions[pattern.id] ?? pattern.version)
    if (!full) throw new Error('This pattern is no longer available')
    const copy = makeAttributedPatternCopy(full)
    return saveLocalCopy(copy, copy.documentName ?? `${pattern.title} (copy)`, generation)
  })
  const publish = (existing?: PublishedPatternSummary, useForm = false) => run(async () => {
    const published = await getEditorCloudClients().community.publish({
      id: existing?.id, expectedVersion: existing?.version, expectedVisibilityRevision: existing?.visibilityRevision, title: useForm ? title : existing?.title ?? currentDoc.documentName ?? 'Untitled pattern',
      description: useForm ? description : existing?.description ?? description, license: useForm ? license : existing?.license ?? license,
      attribution: useForm ? attribution : existing?.attribution ?? attribution, visibility: useForm ? (isPublic ? 'public' : 'private') : existing?.visibility ?? (isPublic ? 'public' : 'private'), doc: currentDoc,
    })
    return `Saved ${published.visibility} pattern: ${published.title}, version ${published.version}`
  })

  return (
    <div className="modal-backdrop" role="presentation" onClick={busy ? undefined : close}>
      <section ref={dialogRef} tabIndex={-1} className="line-type-modal" role="dialog" aria-modal="true" aria-label={t('Cloud & Community')}
        onClick={event => event.stopPropagation()} style={{ maxHeight: '90dvh', overflow: 'auto', width: 'min(760px, 95vw)' }}>
        <div className="line-type-modal-header"><h2>{t('Cloud & Community')}</h2><button onClick={close} disabled={busy}>{t('Done')}</button></div>
        {!cloud.configured ? <p>{t('Cloud sharing is not available in this installation. Your projects remain on this device.')}</p> : <>
          <div className="line-type-modal-actions">
            {cloud.user ? <><span>Signed in as {cloud.user.displayName}</span><button disabled={busy} onClick={() => void run(signOutOfEditorCloud)}>{t('Sign out')}</button></>
              : <button disabled={busy || !cloud.authConfigured} onClick={() => void run(signInToEditorCloud)}>{t('Sign in')}</button>}
            <button disabled={busy} onClick={() => void run(refresh)}>{t('Refresh')}</button>
          </div>
          {!cloud.user && <p className="hint">{t('Browse public patterns below. Sign in to save private drawings and share your work.')}</p>}
          {!cloud.authConfigured && <p className="hint">{t('Sign-in is not available in this installation.')}</p>}
          {cloud.user && <>
            <h3>{t('My cloud drawings')}</h3>
            <p className="hint">{t('Cloud saves and local copies are separate. Opening a copy preserves existing local projects.')}</p>
            <div className="line-type-modal-actions">
              <button disabled={busy} onClick={() => void run(async () => {
                const saved = await getEditorCloudClients().documents.documents.create({ name: currentDoc.documentName ?? 'Untitled project', doc: currentDoc })
                return `Saved a private cloud copy: ${saved.name}`
              })}>{t('Save new private cloud copy')}</button>
              <button disabled={busy} onClick={() => void run(async () => {
                const local = getEditorLocalDataClient()
                if (!local) throw new Error('Local project storage is unavailable')
                const result = await uploadLocalProjects(local, getEditorCloudClients().documents)
                return `Uploaded ${result.uploaded}; unchanged ${result.unchanged}; conflicts skipped ${result.conflicts.length}`
              })}>{t('Upload local projects')}</button>
            </div>
            <CloudLibraryPanel currentDoc={currentDoc} saveLocalCopy={saveLocalCopy} onChanged={refresh} onStatus={onStatus} />
            <CloudWorkspacePanel key={cloud.sessionKey} onLoadDocument={onLoadDocument} onStatus={onStatus} onChanged={refresh} />
            <CloudStoragePanel />
            <h3>{t('Share the current drawing')}</h3>
            {editingPattern && <p>{t('Editing pattern')}: {editingPattern.title} · v{editingPattern.version} <button disabled={busy} onClick={() => { setEditingPattern(null); setTitle(currentDoc.documentName ?? ''); setDescription(''); setAttribution(''); setLicense('CC-BY-4.0'); setIsPublic(false) }}>{t('Create a new pattern instead')}</button></p>}
            <label>{t('Pattern title')} <input maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
            <label>{t('Attribution ')}<input value={attribution} maxLength={1000} onChange={event => setAttribution(event.target.value)} placeholder={t('Your preferred credit')} /></label>
            <label>{t('Description ')}<textarea value={description} maxLength={2000} onChange={event => setDescription(event.target.value)} /></label>
            <label>{t('License ')}<select value={license} onChange={event => setLicense(event.target.value as PatternLicense)}>
              <option value="CC-BY-4.0">{t('CC BY 4.0 — credit required')}</option><option value="CC-BY-NC-4.0">{t('CC BY-NC 4.0 — noncommercial, credit required')}</option><option value="CC0-1.0">{t('CC0 — public domain dedication')}</option>
            </select></label>
            <label><input type="checkbox" checked={isPublic} onChange={event => setIsPublic(event.target.checked)} />{t('Make this pattern public')}</label>
            <p className="hint">{t('Public patterns can be copied by everyone under the chosen license. Existing downloaded copies keep their license after you make a pattern private.')}</p>
            <button disabled={busy || !title.trim() || !attribution.trim()} onClick={() => void publish(editingPattern ?? undefined, true)}>{editingPattern ? t('Save next pattern version') : t('Save pattern')}</button>
            {mine.page.length > 0 && <><h3>{t('My shared patterns')}</h3>{mine.page.map(pattern => <article key={pattern.id} className="template-item">
              <span>{pattern.title} · v{pattern.version} · {pattern.retired ? t('content retired') : pattern.visibility}</span>
              <button disabled={busy || pattern.retired} onClick={() => { setEditingPattern(pattern); setTitle(pattern.title); setDescription(pattern.description); setLicense(pattern.license); setAttribution(pattern.attribution); setIsPublic(pattern.visibility === 'public') }}>{t('Edit pattern details')}</button>
              <button disabled={busy || pattern.retired} onClick={() => void publish(pattern)}>{t('Publish current drawing as next version')}</button>
              <button disabled={busy || pattern.retired} onClick={() => void run(async () => {
                await getEditorCloudClients().community.setVisibility(pattern.id, pattern.visibility === 'public' ? 'private' : 'public', pattern)
                return 'Pattern visibility updated'
              })}>Make {pattern.visibility === 'public' ? 'private' : 'public'}</button>
              {!pattern.retired && <button disabled={busy} onClick={() => setRetiringPattern(pattern)}>{t('Retire downloadable content')}</button>}
            </article>)}</>}
            {retiringPattern && <div role="group" aria-label={t('Confirm publication retirement')}><p>{t('Remove downloadable content and image references for every version of this pattern? Credits and license history remain. Existing copies keep their license. This cannot be undone.')}</p><button disabled={busy} onClick={() => void run(async () => { const retire = getEditorCloudClients().community.retire; if (!retire) throw new Error('Publication retirement is unavailable'); await retire(retiringPattern); if (editingPattern?.id === retiringPattern.id) setEditingPattern(null); setRetiringPattern(null); return t('Publication retirement started. Refresh after cleanup completes to see released quota.') })}>{t('Confirm content retirement')}</button><button disabled={busy} onClick={() => setRetiringPattern(null)}>{t('Cancel')}</button></div>}
          </>}
          <h3>{t('Public pattern gallery')}</h3>
          <form onSubmit={event => { event.preventDefault(); setGallerySearch(search.trim()) }}><label>{t('Search public pattern titles ')}<input maxLength={160} value={search} onChange={event => setSearch(event.target.value)} /></label><button disabled={busy}>{t('Search patterns')}</button></form>
          {patterns.page.length === 0 ? <p className="hint">{t('No public patterns available.')}</p> : patterns.page.map(pattern => <article key={pattern.id} className="template-item">
            <div><strong>{pattern.title}</strong><p>{pattern.description}</p><small>By {pattern.author} · {pattern.license} · {pattern.attribution}</small></div>
            <label>{t('Version ')}<input type="number" min={1} max={pattern.version} value={versions[pattern.id] ?? pattern.version}
              onChange={event => setVersions(previous => ({ ...previous, [pattern.id]: Math.max(1, Math.min(pattern.version, Number(event.target.value) || 1)) }))} /></label>
            <button disabled={busy} onClick={() => void copyPattern(pattern)}>{t('Open an attributed local copy')}</button>
            {cloud.user && <CommunityReportButton target={{ kind: 'pattern', id: pattern.id }} />}
          </article>)}
          {!patterns.isDone && <button disabled={busy} onClick={() => void run(async () => { const next = await getEditorCloudClients().community.listPublicPage(patterns.continueCursor, gallerySearch); assertCurrentSession(); setPatterns(previous => mergeCloudPage(previous, next)) }, false)}>{t('Load more public patterns')}</button>}
          {!mine.isDone && <button disabled={busy} onClick={() => void run(async () => { const next = await getEditorCloudClients().community.listMinePage(mine.continueCursor); assertCurrentSession(); setMine(previous => mergeCloudPage(previous, next)) }, false)}>{t('Load more shared patterns')}</button>}
          <CommunityBoardPanel onStatus={onStatus} />
          {cloud.user && <CommunityOperationsPanel />}
        </>}
        {busy && <p role="status">{t('Working…')}</p>}{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
      </section>
    </div>
  )
}
