import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { DocFile } from '../cad/cad-types'
import { parseImportedJsonDocument } from '../editor-json-import'
import { downloadFile } from '../editor-utils'
import { registerEditorDraftCapture } from '../localdb/editor-draft-bridge'
import { writeAutoSaveSnapshot } from '../ops/autosave'
import { consumeSignInDraft, discardRecoveryDrafts, readRecoveryDrafts, type RecoveryDraft } from '../ops/draft-recovery'

type RecoveryParams = {
  buildDoc: () => DocFile
  applyLoadedDocument: (doc: DocFile, status: string) => void
  activeLocalDocumentId: string | null
  setActiveLocalDocumentId: (id: string | null) => void
  setStatus: (status: string) => void
}

function documentFromDraft(draft: RecoveryDraft): DocFile {
  if (!draft.snapshot) throw new Error(draft.error ?? 'This recovery draft is damaged.')
  // Preserve stable shape IDs so stitch runs, constraints and named projects
  // remain associated with exactly the drawing saved before navigation.
  return parseImportedJsonDocument(draft.snapshot.serializedDoc, { preserveShapeIds: true }).doc
}

export function useDraftRecovery(params: RecoveryParams) {
  const latest = useRef(params)
  useLayoutEffect(() => { latest.current = params })
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<RecoveryDraft[]>([])
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(false)
  const [failure, setFailure] = useState('')
  const [checked, setChecked] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [explicitTransfer] = useState(() => typeof window !== 'undefined' &&
    (new URL(window.location.href).searchParams.has('openDoc') || new URL(window.location.href).searchParams.has('openLocalDoc')))
  const blocked = loading || drafts.length > 0 || busy || !checked
  const blockedRef = useRef(blocked)
  useLayoutEffect(() => { blockedRef.current = blocked })

  useEffect(() => registerEditorDraftCapture(() => {
    if (blockedRef.current) throw new Error('Resolve the saved recovery draft before starting sign-in.')
    const url = new URL(window.location.href)
    if (url.searchParams.has('openDoc') || url.searchParams.has('openLocalDoc')) throw new Error('Wait for the project to finish opening before starting sign-in.')
    return { doc: latest.current.buildDoc(), localDocumentId: latest.current.activeLocalDocumentId }
  }), [])

  useEffect(() => {
    let cancelled = false
    const initialDocument = JSON.stringify(latest.current.buildDoc())
    void (async () => {
      try {
        const found = await readRecoveryDrafts()
        if (cancelled) return
        setChecked(true); setFailure('')
        const signin = found.find(draft => draft.snapshot?.reason === 'signin')
        const newest = Math.max(0, ...found.map(draft => draft.snapshot?.savedAt ?? 0))
        const url = new URL(window.location.href)
        const projectOpened = explicitTransfer || url.searchParams.has('openDoc') || url.searchParams.has('openLocalDoc')
        const drawingChanged = JSON.stringify(latest.current.buildDoc()) !== initialDocument
        if (signin?.snapshot && signin.snapshot.savedAt >= newest && !projectOpened && !drawingChanged && !found.some(item => item.warning)) {
          try {
            const doc = documentFromDraft(signin)
            if (cancelled) return
            const localDocumentId = signin.snapshot.localDocumentId
            // This continuation runs after the effect returned. Commit the old
            // recovery application now so it cannot remain queued behind a
            // subsequent explicit file-open action at another React priority.
            flushSync(() => {
              latest.current.applyLoadedDocument(doc, 'Restored your drawing after sign-in.')
              latest.current.setActiveLocalDocumentId(localDocumentId)
              setRestored(true)
            })
            // Keep a durable ordinary recovery copy before consuming the one-use
            // marker; callback failure and reload use the same restoration path.
            await writeAutoSaveSnapshot(JSON.stringify(doc), signin.snapshot.localDocumentId)
            if (cancelled) return
            await consumeSignInDraft(signin.snapshot.id)
          } catch (cause) {
            if (cancelled) return
            setError(cause instanceof Error ? cause.message : 'Could not restore the sign-in draft.')
            setDrafts(found)
          }
        } else {
          if (drawingChanged && found.length) setError('The current drawing changed while drafts were checked. Recover only if you want to replace it.')
          setDrafts(found)
        }
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : 'Saved drafts could not be checked. Automatic saving is paused; download a backup or check again.'
          setFailure(message); latest.current.setStatus(message)
        }
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [explicitTransfer, attempt])

  const draft = drafts[selected] ?? drafts[0]
  const downloadDraft = () => {
    if (!draft) return
    downloadFile(draft.snapshot ? 'leathercad-recovery.json' : 'leathercad-damaged-recovery.txt',
      draft.snapshot?.serializedDoc ?? draft.raw, draft.snapshot ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8')
  }
  const downloadCurrent = () => downloadFile('leathercad-backup.json', JSON.stringify(latest.current.buildDoc(), null, 2), 'application/json;charset=utf-8')
  const recover = async () => {
    if (!draft || busy) return
    setBusy(true); setError('')
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('openDoc') || url.searchParams.has('openLocalDoc')) throw new Error('Wait for the explicitly opened project to finish loading before replacing it with a recovered draft.')
      const doc = documentFromDraft(draft)
      flushSync(() => {
        latest.current.applyLoadedDocument(doc, 'Recovered saved drawing.')
        latest.current.setActiveLocalDocumentId(draft.snapshot?.localDocumentId ?? null)
        setRestored(true)
      })
      // Retain the draft if writing a replacement fails. It remains downloadable
      // even though the recovered document is now visible behind the dialog.
      await writeAutoSaveSnapshot(JSON.stringify(doc), draft.snapshot?.localDocumentId)
      if (draft.snapshot?.reason === 'signin') await consumeSignInDraft(draft.snapshot.id)
      setDrafts([])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not recover this draft.') }
    finally { setBusy(false) }
  }
  const discard = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { await discardRecoveryDrafts(); setDrafts([]); latest.current.setStatus('Discarded stored recovery drafts; current drawing kept.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not discard stored drafts.') }
    finally { setBusy(false) }
  }
  return {
    ready: !blocked,
    restored,
    onAutoSaveFailure: (_raw: string, message: string) => setFailure(message),
    props: { loading, draft, drafts, selected, onSelect: setSelected, error, busy, failure, canDismissFailure: checked,
      onRetry: () => { setLoading(true); setChecked(false); setDrafts([]); setSelected(0); setError(''); setAttempt(value => value + 1) },
      explicitTransfer, onRecover: recover, onDiscard: discard, onDownloadDraft: downloadDraft,
      onDownloadCurrent: downloadCurrent, onDismissFailure: () => setFailure('') },
  }
}

export type DraftRecoveryDialogProps = ReturnType<typeof useDraftRecovery>['props']
