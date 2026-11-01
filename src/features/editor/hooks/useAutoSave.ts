import { useEffect, useRef } from 'react'
import { writeAutoSaveSnapshot } from '../ops/autosave'
import { persistExitDraft } from '../ops/draft-recovery'

type UseAutoSaveParams<TDoc> = {
  enabled: boolean
  intervalMs?: number
  buildDoc: () => TDoc
  setStatus: (value: string) => void
  localDocumentId?: string | null
  onFailure?: (serializedDoc: string, message: string) => void
}

const DEFAULT_INTERVAL_MS = 60_000

/**
 * A saved status follows an acknowledged localStorage or IndexedDB write.
 * Startup recovery must resolve before this hook is enabled.
 */
export function useAutoSave<TDoc>(params: UseAutoSaveParams<TDoc>) {
  const { enabled, intervalMs = DEFAULT_INTERVAL_MS, buildDoc, setStatus } = params
  const buildDocRef = useRef(buildDoc)
  const setStatusRef = useRef(setStatus)
  const optionsRef = useRef(params)
  const acknowledged = useRef<{ raw: string; localDocumentId: string | null } | null>(null)

  useEffect(() => {
    buildDocRef.current = buildDoc
    setStatusRef.current = setStatus
    optionsRef.current = params
  })

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }
    let saving = false, disposed = false
    const tick = async () => {
      if (saving) return
      saving = true
      let serialized = ''
      try {
        serialized = JSON.stringify(buildDocRef.current())
        const localDocumentId = optionsRef.current.localDocumentId ?? null
        await writeAutoSaveSnapshot(serialized, localDocumentId)
        acknowledged.current = { raw: serialized, localDocumentId }
        if (!disposed) setStatusRef.current(`Auto-saved at ${new Date().toLocaleTimeString()}`)
      } catch {
        if (!disposed) {
          const message = 'Auto-save failed. Download a backup of your drawing before leaving this page.'
          setStatusRef.current(message)
          optionsRef.current.onFailure?.(serialized, message)
        }
      } finally { saving = false }
    }
    const handle = window.setInterval(() => { void tick() }, intervalMs)
    const handleVisibility = () => { if (document.visibilityState === 'hidden') void tick() }
    const saveAtExit = () => {
      try {
        const raw = JSON.stringify(buildDocRef.current()), localDocumentId = optionsRef.current.localDocumentId ?? null
        if (acknowledged.current?.raw === raw && acknowledged.current.localDocumentId === localDocumentId) return true
        const saved = persistExitDraft(raw, localDocumentId)
        if (saved) acknowledged.current = { raw, localDocumentId }
        return saved
      }
      catch { return false }
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!saveAtExit()) { event.preventDefault(); event.returnValue = '' }
    }
    const handlePageHide = () => { saveAtExit() }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      disposed = true; window.clearInterval(handle)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [enabled, intervalMs])
}
