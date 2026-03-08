import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { applyRedo, applyUndo, type HistoryState } from '../ops/history-ops'
import {
  undoOperation,
  redoOperation,
  getUndoLabels,
  type OperationHistoryState,
} from '../ops/operation-history'
import type { EditorSnapshot } from '../editor-types'

type UseHistoryActionsParams = {
  historyState: HistoryState<EditorSnapshot>
  opHistory: OperationHistoryState
  currentSnapshot: EditorSnapshot
  applyEditorSnapshot: (snapshot: EditorSnapshot) => void
  applyingHistoryRef: MutableRefObject<boolean>
  setHistoryState: Dispatch<SetStateAction<HistoryState<EditorSnapshot>>>
  setOpHistory: Dispatch<SetStateAction<OperationHistoryState>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useHistoryActions(params: UseHistoryActionsParams) {
  const {
    historyState,
    opHistory,
    currentSnapshot,
    applyEditorSnapshot,
    applyingHistoryRef,
    setHistoryState,
    setOpHistory,
    setStatus,
  } = params

  const handleUndo = useCallback(() => {
    // Try operation-based undo first
    if (opHistory.past.length > 0) {
      const result = undoOperation(opHistory, currentSnapshot)
      if (result.snapshot) {
        applyingHistoryRef.current = true
        setOpHistory(result.history)
        applyEditorSnapshot(result.snapshot)
        const labels = getUndoLabels(opHistory)
        setStatus(labels[0] ? `Undo: ${labels[0]}` : 'Undo applied')
        return
      }
    }
    // Fall back to snapshot-based undo
    const result = applyUndo(historyState, currentSnapshot)
    if (!result.snapshot) {
      setStatus('Nothing to undo')
      return
    }
    applyingHistoryRef.current = true
    setHistoryState(result.history)
    applyEditorSnapshot(result.snapshot)
    setStatus('Undo applied')
  }, [historyState, opHistory, currentSnapshot, applyEditorSnapshot, applyingHistoryRef, setHistoryState, setOpHistory, setStatus])

  const handleRedo = useCallback(() => {
    // Try operation-based redo first
    if (opHistory.future.length > 0) {
      const result = redoOperation(opHistory, currentSnapshot)
      if (result.snapshot) {
        applyingHistoryRef.current = true
        setOpHistory(result.history)
        applyEditorSnapshot(result.snapshot)
        setStatus('Redo applied')
        return
      }
    }
    // Fall back to snapshot-based redo
    const result = applyRedo(historyState, currentSnapshot)
    if (!result.snapshot) {
      setStatus('Nothing to redo')
      return
    }
    applyingHistoryRef.current = true
    setHistoryState(result.history)
    applyEditorSnapshot(result.snapshot)
    setStatus('Redo applied')
  }, [historyState, opHistory, currentSnapshot, applyEditorSnapshot, applyingHistoryRef, setHistoryState, setOpHistory, setStatus])

  return {
    handleUndo,
    handleRedo,
  }
}
