import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { EditorSelectionState } from '../editor-domain-types'
import {
  propertyStateReducer,
  useRequiredContext,
  type PropertyAction,
} from './property-state'

const initialEditorSelectionState: EditorSelectionState = {
  selectedShapeIds: [],
  selectedStitchHoleId: null,
  selectedHardwareMarkerId: null,
  clipboardPayload: null,
}

function createEditorSelectionStateActions(dispatch: React.Dispatch<PropertyAction<EditorSelectionState>>) {
  return {
    setSelectedShapeIds: (value: React.SetStateAction<EditorSelectionState['selectedShapeIds']>) =>
      dispatch({ type: 'selectedShapeIds', value }),
    setSelectedStitchHoleId: (value: React.SetStateAction<EditorSelectionState['selectedStitchHoleId']>) =>
      dispatch({ type: 'selectedStitchHoleId', value }),
    setSelectedHardwareMarkerId: (value: React.SetStateAction<EditorSelectionState['selectedHardwareMarkerId']>) =>
      dispatch({ type: 'selectedHardwareMarkerId', value }),
    setClipboardPayload: (value: React.SetStateAction<EditorSelectionState['clipboardPayload']>) =>
      dispatch({ type: 'clipboardPayload', value }),
  }
}

type EditorSelectionStateActions = ReturnType<typeof createEditorSelectionStateActions>
type EditorSelectionStateApi = EditorSelectionState & EditorSelectionStateActions

const EditorSelectionStateContext = createContext<EditorSelectionState | null>(null)
const EditorSelectionActionsContext = createContext<EditorSelectionStateActions | null>(null)

export function EditorSelectionStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(propertyStateReducer<EditorSelectionState>, initialEditorSelectionState)
  const actions = useMemo(() => createEditorSelectionStateActions(dispatch), [dispatch])

  return (
    <EditorSelectionStateContext.Provider value={state}>
      <EditorSelectionActionsContext.Provider value={actions}>
        {children}
      </EditorSelectionActionsContext.Provider>
    </EditorSelectionStateContext.Provider>
  )
}

export function useEditorSelectionSelector<T>(selector: (state: EditorSelectionState) => T) {
  const state = useRequiredContext(useContext(EditorSelectionStateContext), 'EditorSelectionStateContext')
  return selector(state)
}

export function useEditorSelectionActions() {
  return useRequiredContext(useContext(EditorSelectionActionsContext), 'EditorSelectionActionsContext')
}

export function useEditorSelectionStateApi(): EditorSelectionStateApi {
  const state = useRequiredContext(useContext(EditorSelectionStateContext), 'EditorSelectionStateContext')
  const actions = useRequiredContext(useContext(EditorSelectionActionsContext), 'EditorSelectionActionsContext')

  return useMemo(
    () => ({
      ...state,
      ...actions,
    }),
    [state, actions],
  )
}
