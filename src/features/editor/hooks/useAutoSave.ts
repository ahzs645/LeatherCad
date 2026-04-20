import { useEffect, useRef } from 'react'
import { writeAutoSaveSnapshot } from '../ops/autosave'

type UseAutoSaveParams<TDoc> = {
  enabled: boolean
  intervalMs?: number
  buildDoc: () => TDoc
  setStatus: (value: string) => void
}

const DEFAULT_INTERVAL_MS = 60_000

/**
 * Serializes the current document to localStorage on a recurring timer when
 * auto-save is enabled. Writes are `JSON.stringify(doc)` and are read back via
 * `readAutoSaveSnapshot` in ops/autosave.ts on next session.
 */
export function useAutoSave<TDoc>(params: UseAutoSaveParams<TDoc>) {
  const { enabled, intervalMs = DEFAULT_INTERVAL_MS, buildDoc, setStatus } = params
  const buildDocRef = useRef(buildDoc)
  const setStatusRef = useRef(setStatus)

  useEffect(() => {
    buildDocRef.current = buildDoc
    setStatusRef.current = setStatus
  })

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }
    const tick = () => {
      try {
        const serialized = JSON.stringify(buildDocRef.current())
        writeAutoSaveSnapshot(serialized)
        setStatusRef.current(`Auto-saved at ${new Date().toLocaleTimeString()}`)
      } catch {
        // Silent: auto-save should never interrupt the user.
      }
    }

    const handle = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(handle)
  }, [enabled, intervalMs])
}
