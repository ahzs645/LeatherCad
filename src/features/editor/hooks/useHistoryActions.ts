import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { applyRedo, applyUndo, type HistoryState } from '../ops/history-ops'
import type { EditorSnapshot } from '../editor-types'

type UseHistoryActionsParams = {
  historyState: HistoryState<EditorSnapshot>
  currentSnapshot: EditorSnapshot
  applyEditorSnapshot: (snapshot: EditorSnapshot) => void
  applyingHistoryRef: MutableRefObject<boolean>
  setHistoryState: Dispatch<SetStateAction<HistoryState<EditorSnapshot>>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useHistoryActions(params: UseHistoryActionsParams) {
  const {
    historyState,
    currentSnapshot,
    applyEditorSnapshot,
    applyingHistoryRef,
    setHistoryState,
    setStatus,
  } = params

  const handleUndo = useCallback(() => {
    const result = applyUndo(historyState, currentSnapshot)
    if (!result.snapshot) {
      setStatus('Nothing to undo')
      return
    }
    applyingHistoryRef.current = true
    setHistoryState(result.history)
    applyEditorSnapshot(result.snapshot)
    setStatus('Undo applied')
  }, [historyState, currentSnapshot, applyEditorSnapshot, applyingHistoryRef, setHistoryState, setStatus])

  const handleRedo = useCallback(() => {
    const result = applyRedo(historyState, currentSnapshot)
    if (!result.snapshot) {
      setStatus('Nothing to redo')
      return
    }
    applyingHistoryRef.current = true
    setHistoryState(result.history)
    applyEditorSnapshot(result.snapshot)
    setStatus('Redo applied')
  }, [historyState, currentSnapshot, applyEditorSnapshot, applyingHistoryRef, setHistoryState, setStatus])

  return {
    handleUndo,
    handleRedo,
  }
}
