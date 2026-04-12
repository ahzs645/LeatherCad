import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { uid } from '../../cad/cad-geometry'
import { DEFAULT_BACK_LAYER_COLOR, DEFAULT_FRONT_LAYER_COLOR } from '../../editor-constants'
import type { EditorLayerState } from '../editor-domain-types'
import {
  propertyStateReducer,
  useRequiredContext,
  type PropertyAction,
} from './property-state'

const createInitialEditorLayerState = (): EditorLayerState => {
  const initialLayerId = uid()

  return {
    layers: [
      {
        id: initialLayerId,
        name: 'Layer 1',
        visible: true,
        locked: false,
        stackLevel: 0,
      },
    ],
    activeLayerId: initialLayerId,
    frontLayerColor: DEFAULT_FRONT_LAYER_COLOR,
    backLayerColor: DEFAULT_BACK_LAYER_COLOR,
    layerColorOverrides: {},
  }
}

function createEditorLayerStateActions(dispatch: React.Dispatch<PropertyAction<EditorLayerState>>) {
  return {
    setLayers: (value: React.SetStateAction<EditorLayerState['layers']>) =>
      dispatch({ type: 'layers', value }),
    setActiveLayerId: (value: React.SetStateAction<EditorLayerState['activeLayerId']>) =>
      dispatch({ type: 'activeLayerId', value }),
    setFrontLayerColor: (value: React.SetStateAction<EditorLayerState['frontLayerColor']>) =>
      dispatch({ type: 'frontLayerColor', value }),
    setBackLayerColor: (value: React.SetStateAction<EditorLayerState['backLayerColor']>) =>
      dispatch({ type: 'backLayerColor', value }),
    setLayerColorOverrides: (value: React.SetStateAction<EditorLayerState['layerColorOverrides']>) =>
      dispatch({ type: 'layerColorOverrides', value }),
  }
}

type EditorLayerStateActions = ReturnType<typeof createEditorLayerStateActions>
type EditorLayerStateApi = EditorLayerState & EditorLayerStateActions

const EditorLayerStateContext = createContext<EditorLayerState | null>(null)
const EditorLayerActionsContext = createContext<EditorLayerStateActions | null>(null)

export function EditorLayerStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(propertyStateReducer<EditorLayerState>, undefined, createInitialEditorLayerState)
  const actions = useMemo(() => createEditorLayerStateActions(dispatch), [dispatch])

  return (
    <EditorLayerStateContext.Provider value={state}>
      <EditorLayerActionsContext.Provider value={actions}>
        {children}
      </EditorLayerActionsContext.Provider>
    </EditorLayerStateContext.Provider>
  )
}

export function useEditorLayerSelector<T>(selector: (state: EditorLayerState) => T) {
  const state = useRequiredContext(useContext(EditorLayerStateContext), 'EditorLayerStateContext')
  return selector(state)
}

export function useEditorLayerActions() {
  return useRequiredContext(useContext(EditorLayerActionsContext), 'EditorLayerActionsContext')
}

export function useEditorLayerStateApi(): EditorLayerStateApi {
  const state = useRequiredContext(useContext(EditorLayerStateContext), 'EditorLayerStateContext')
  const actions = useRequiredContext(useContext(EditorLayerActionsContext), 'EditorLayerActionsContext')

  return useMemo(
    () => ({
      ...state,
      ...actions,
    }),
    [state, actions],
  )
}
