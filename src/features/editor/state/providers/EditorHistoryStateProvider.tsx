import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { EditorSnapshot } from '../../editor-types'
import type { HistoryState } from '../../ops/history-ops'
import {
  createOperationHistory,
  type OperationHistoryState,
} from '../../ops/operation-history'
import { useRequiredContext } from './property-state'

type EditorHistoryState = {
  historyState: HistoryState<EditorSnapshot>
  opHistory: OperationHistoryState
}

type EditorHistoryActions = {
  setHistoryState: React.Dispatch<React.SetStateAction<HistoryState<EditorSnapshot>>>
  setOpHistory: React.Dispatch<React.SetStateAction<OperationHistoryState>>
}

type EditorHistoryRefs = {
  lastSnapshotRef: React.MutableRefObject<EditorSnapshot | null>
  lastSnapshotSignatureRef: React.MutableRefObject<string | null>
  applyingHistoryRef: React.MutableRefObject<boolean>
  /** When true, snapshot pushes are coalesced (last-known signature still tracked but no history entries). */
  suspendHistoryCaptureRef: React.MutableRefObject<boolean>
}

type EditorHistoryStateApi = EditorHistoryState & EditorHistoryActions & EditorHistoryRefs

const EditorHistoryStateContext = createContext<EditorHistoryState | null>(null)
const EditorHistoryActionsContext = createContext<EditorHistoryActions | null>(null)
const EditorHistoryRefsContext = createContext<EditorHistoryRefs | null>(null)

export function EditorHistoryStateProvider({ children }: { children: ReactNode }) {
  const [historyState, setHistoryState] = useState<HistoryState<EditorSnapshot>>({ past: [], future: [] })
  const [opHistory, setOpHistory] = useState<OperationHistoryState>(() => createOperationHistory())
  const lastSnapshotRef = useRef<EditorSnapshot | null>(null)
  const lastSnapshotSignatureRef = useRef<string | null>(null)
  const applyingHistoryRef = useRef(false)
  const suspendHistoryCaptureRef = useRef(false)

  const state = useMemo(
    () => ({
      historyState,
      opHistory,
    }),
    [historyState, opHistory],
  )
  const actions = useMemo(
    () => ({
      setHistoryState,
      setOpHistory,
    }),
    [],
  )
  const refs = useMemo(
    () => ({
      lastSnapshotRef,
      lastSnapshotSignatureRef,
      applyingHistoryRef,
      suspendHistoryCaptureRef,
    }),
    [],
  )

  return (
    <EditorHistoryStateContext.Provider value={state}>
      <EditorHistoryActionsContext.Provider value={actions}>
        <EditorHistoryRefsContext.Provider value={refs}>
          {children}
        </EditorHistoryRefsContext.Provider>
      </EditorHistoryActionsContext.Provider>
    </EditorHistoryStateContext.Provider>
  )
}

export function useEditorHistorySelector<T>(selector: (state: EditorHistoryState) => T) {
  const state = useRequiredContext(useContext(EditorHistoryStateContext), 'EditorHistoryStateContext')
  return selector(state)
}

export function useEditorHistoryActions() {
  return useRequiredContext(useContext(EditorHistoryActionsContext), 'EditorHistoryActionsContext')
}

export function useEditorHistoryRefs() {
  return useRequiredContext(useContext(EditorHistoryRefsContext), 'EditorHistoryRefsContext')
}

export function useEditorHistoryStateApi(): EditorHistoryStateApi {
  const state = useRequiredContext(useContext(EditorHistoryStateContext), 'EditorHistoryStateContext')
  const actions = useRequiredContext(useContext(EditorHistoryActionsContext), 'EditorHistoryActionsContext')
  const refs = useRequiredContext(useContext(EditorHistoryRefsContext), 'EditorHistoryRefsContext')

  return useMemo(
    () => ({
      ...state,
      ...actions,
      ...refs,
    }),
    [state, actions, refs],
  )
}
