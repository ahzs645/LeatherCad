import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { DocFile } from '../cad/cad-types'
import type { StoredEditorDocument } from '../localdb/app-data-client'
import type { PatternLicense, PublishedPatternSummary } from '../localdb/cloud-types'
import { getEditorLocalDataClient } from '../localdb/editor-local-data-client'
import {
  getEditorCloudClients, getEditorCloudState, signInToEditorCloud, signOutOfEditorCloud, subscribeEditorCloudState,
} from '../localdb/editor-cloud-connection'
import { makeAttributedPatternCopy, uploadLocalProjects } from '../localdb/cloud-sync'
import type { EditorCloudState } from '../localdb/editor-cloud-connection'
import { useModalDialogFocus } from '../hooks/useModalDialogFocus'
import { CloudWorkspacePanel } from './CloudWorkspacePanel'
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
  const [projects, setProjects] = useState<StoredEditorDocument[]>([])
  const [patterns, setPatterns] = useState<PublishedPatternSummary[]>([])
  const [mine, setMine] = useState<PublishedPatternSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [license, setLicense] = useState<PatternLicense>('CC-BY-4.0')
  const [isPublic, setIsPublic] = useState(false)
  const [attribution, setAttribution] = useState('')
  const [description, setDescription] = useState('')
  const [versions, setVersions] = useState<Record<string, number>>({})
  const dialogRef = useRef<HTMLElement>(null)
  useModalDialogFocus({ dialogRef, open, onClose, closeOnEscape: !busy })
  const assertCurrentSession = () => {
    if (getEditorCloudState().sessionKey !== cloud.sessionKey) throw new Error('Your sign-in session changed; refresh the cloud library')
  }

  const refresh = useCallback(async () => {
    if (!cloud.configured) return
    const clients = getEditorCloudClients()
    const [gallery, library, published] = await Promise.all([
      clients.community.listPublic(),
      getEditorCloudState().user ? clients.documents.documents.list() : Promise.resolve([]),
      getEditorCloudState().user ? clients.community.listMine() : Promise.resolve([]),
    ])
    if (getEditorCloudState().sessionKey !== cloud.sessionKey) return
    setPatterns(gallery); setProjects(library); setMine(published)
  }, [cloud.configured, cloud.sessionKey])
  const run = async (operation: () => Promise<string | void>) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await operation()
      assertCurrentSession()
      if (result) { setMessage(result); onStatus?.(result) }
      await refresh()
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
  const saveLocalCopy = async (doc: DocFile, name: string) => {
    assertCurrentSession()
    const local = getEditorLocalDataClient()
    if (!local) throw new Error('Local project storage is unavailable; no copy was opened')
    const copy = { ...doc, documentName: name }
    const created = await local.documents.create({ name, doc: copy })
    if (getEditorCloudState().sessionKey !== cloud.sessionKey) {
      await local.documents.delete(created.id)
      throw new Error('Your sign-in session changed; the pending copy was cancelled')
    }
    onLoadDocument?.(copy)
    return `Created local copy: ${name}`
  }
  const copyPattern = (pattern: PublishedPatternSummary) => run(async () => {
    const full = await getEditorCloudClients().community.get(pattern.id, versions[pattern.id] ?? pattern.version)
    if (!full) throw new Error('This pattern is no longer available')
    const copy = makeAttributedPatternCopy(full)
    return saveLocalCopy(copy, copy.documentName ?? `${pattern.title} (copy)`)
  })
  const publish = (existing?: PublishedPatternSummary) => run(async () => {
    const published = await getEditorCloudClients().community.publish({
      id: existing?.id, expectedVersion: existing?.version, title: existing?.title ?? currentDoc.documentName ?? 'Untitled pattern',
      description: existing?.description ?? description, license: existing?.license ?? license,
      attribution: existing?.attribution ?? attribution, visibility: existing?.visibility ?? (isPublic ? 'public' : 'private'), doc: currentDoc,
    })
    return `Saved ${published.visibility} pattern: ${published.title}, version ${published.version}`
  })

  return (
    <div className="modal-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <section ref={dialogRef} tabIndex={-1} className="line-type-modal" role="dialog" aria-modal="true" aria-label="Cloud & Community"
        onClick={event => event.stopPropagation()} style={{ maxHeight: '90dvh', overflow: 'auto', width: 'min(760px, 95vw)' }}>
        <div className="line-type-modal-header"><h2>Cloud & Community</h2><button onClick={onClose} disabled={busy}>Done</button></div>
        {!cloud.configured ? <p>Cloud sharing is not available in this installation. Your projects remain on this device.</p> : <>
          <div className="line-type-modal-actions">
            {cloud.user ? <><span>Signed in as {cloud.user.displayName}</span><button disabled={busy} onClick={() => void run(signOutOfEditorCloud)}>Sign out</button></>
              : <button disabled={busy || !cloud.authConfigured} onClick={() => void run(signInToEditorCloud)}>Sign in</button>}
            <button disabled={busy} onClick={() => void run(refresh)}>Refresh</button>
          </div>
          {!cloud.user && <p className="hint">Browse public patterns below. Sign in to save private drawings and share your work.</p>}
          {!cloud.authConfigured && <p className="hint">Sign-in is not available in this installation.</p>}
          {cloud.user && <>
            <h3>My cloud drawings</h3>
            <p className="hint">Cloud saves and local copies are separate. Opening a copy preserves existing local projects.</p>
            <div className="line-type-modal-actions">
              <button disabled={busy} onClick={() => void run(async () => {
                const saved = await getEditorCloudClients().documents.documents.create({ name: currentDoc.documentName ?? 'Untitled project', doc: currentDoc })
                return `Saved a private cloud copy: ${saved.name}`
              })}>Save current drawing to cloud</button>
              <button disabled={busy} onClick={() => void run(async () => {
                const local = getEditorLocalDataClient()
                if (!local) throw new Error('Local project storage is unavailable')
                const result = await uploadLocalProjects(local, getEditorCloudClients().documents)
                return `Uploaded ${result.uploaded}; unchanged ${result.unchanged}; conflicts skipped ${result.conflicts.length}`
              })}>Upload local projects</button>
            </div>
            {projects.length === 0 ? <p className="hint">No cloud drawings yet.</p> : projects.map(project => <article key={project.id} className="template-item">
              <span>{project.name}</span><button disabled={busy} onClick={() => void run(() => saveLocalCopy(project.doc, `${project.name} (cloud copy)`))}>Open a local copy</button>
            </article>)}
            <CloudWorkspacePanel key={cloud.sessionKey} onLoadDocument={onLoadDocument} onStatus={onStatus} onChanged={refresh} />
            <h3>Share the current drawing</h3>
            <label>Attribution <input value={attribution} maxLength={1000} onChange={event => setAttribution(event.target.value)} placeholder="Your preferred credit" /></label>
            <label>Description <textarea value={description} maxLength={2000} onChange={event => setDescription(event.target.value)} /></label>
            <label>License <select value={license} onChange={event => setLicense(event.target.value as PatternLicense)}>
              <option value="CC-BY-4.0">CC BY 4.0 — credit required</option><option value="CC-BY-NC-4.0">CC BY-NC 4.0 — noncommercial, credit required</option><option value="CC0-1.0">CC0 — public domain dedication</option>
            </select></label>
            <label><input type="checkbox" checked={isPublic} onChange={event => setIsPublic(event.target.checked)} />Make this pattern public</label>
            <p className="hint">Public patterns can be copied by everyone under the chosen license. Existing downloaded copies keep their license after you make a pattern private.</p>
            <button disabled={busy || !attribution.trim()} onClick={() => void publish()}>Save {isPublic ? 'public' : 'private'} pattern</button>
            {mine.length > 0 && <><h3>My shared patterns</h3>{mine.map(pattern => <article key={pattern.id} className="template-item">
              <span>{pattern.title} · v{pattern.version} · {pattern.visibility}</span>
              <button disabled={busy} onClick={() => void publish(pattern)}>Publish current drawing as next version</button>
              <button disabled={busy} onClick={() => void run(async () => {
                await getEditorCloudClients().community.setVisibility(pattern.id, pattern.visibility === 'public' ? 'private' : 'public')
                return 'Pattern visibility updated'
              })}>Make {pattern.visibility === 'public' ? 'private' : 'public'}</button>
            </article>)}</>}
          </>}
          <h3>Public pattern gallery</h3>
          {patterns.length === 0 ? <p className="hint">No public patterns available.</p> : patterns.map(pattern => <article key={pattern.id} className="template-item">
            <div><strong>{pattern.title}</strong><p>{pattern.description}</p><small>By {pattern.author} · {pattern.license} · {pattern.attribution}</small></div>
            <label>Version <input type="number" min={1} max={pattern.version} value={versions[pattern.id] ?? pattern.version}
              onChange={event => setVersions(previous => ({ ...previous, [pattern.id]: Math.max(1, Math.min(pattern.version, Number(event.target.value) || 1)) }))} /></label>
            <button disabled={busy} onClick={() => void copyPattern(pattern)}>Open an attributed local copy</button>
          </article>)}
          <CommunityBoardPanel onStatus={onStatus} />
        </>}
        {busy && <p role="status">Working…</p>}{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
      </section>
    </div>
  )
}
