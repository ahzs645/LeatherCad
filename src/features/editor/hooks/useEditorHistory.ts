import { useRef, useState } from 'react'
import { type HistoryState } from '../ops/history-ops'
import type { EditorSnapshot } from '../editor-types'

export function useEditorHistory() {
  const [historyState, setHistoryState] = useState<HistoryState<EditorSnapshot>>({ past: [], future: [] })
  const lastSnapshotRef = useRef<EditorSnapshot | null>(null)
  const lastSnapshotSignatureRef = useRef<string | null>(null)
  const applyingHistoryRef = useRef(false)

  return {
    historyState,
    setHistoryState,
    lastSnapshotRef,
    lastSnapshotSignatureRef,
    applyingHistoryRef,
  }
}
