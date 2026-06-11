import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { EditorToolState } from '../editor-domain-types'
import { toolLabel } from '../../editor-utils'
import {
  getDefaultStitchAutoPitchSettings,
  loadStitchAutoPitchSettings,
  saveStitchAutoPitchSettings,
} from '../../ops/stitch-auto-pitch-settings'
import {
  propertyStateReducer,
  resolveSetStateAction,
  useRequiredContext,
  type PropertyAction,
} from './property-state'
import { useEditorUIActions } from './EditorUIStateProvider'

const initialEditorToolState: EditorToolState = {
  tool: 'pan',
  draftPoints: [],
  cursorPoint: null,
  snapIndicator: null,
  markedSnapPoints: [],
  angleGuideLines: [],
  cadCommandMode: null,
  commandPreviewShapes: [],
  textDraftValue: 'Leathercraft CAD',
  textFontFamily: 'Georgia, serif',
  textFontSizeMm: 14,
  textTransformMode: 'none',
  textRadiusMm: 40,
  textSweepDeg: 140,
  stitchHoleDefaults: {
    holeType: 'round',
    renderShape: 'round',
    diameterMm: 1.2,
    widthMm: 1.2,
    heightMm: 1.2,
    tiltDeg: 0,
    inverted: false,
  },
  stitchPitchMm: 4,
  stitchVariablePitchStartMm: 3,
  stitchVariablePitchEndMm: 5,
  stitchAutoPitchSettings: loadStitchAutoPitchSettings(),
  showStitchSequenceLabels: false,
}

function createEditorToolStateActions(
  state: EditorToolState,
  dispatch: React.Dispatch<PropertyAction<EditorToolState>>,
  setStatus: (value: React.SetStateAction<string>) => void,
) {
  const clearDraft = () => {
    dispatch({ type: 'draftPoints', value: [] })
    dispatch({ type: 'cursorPoint', value: null })
    dispatch({ type: 'snapIndicator', value: null })
    dispatch({ type: 'markedSnapPoints', value: [] })
    dispatch({ type: 'angleGuideLines', value: [] })
    dispatch({ type: 'cadCommandMode', value: null })
    dispatch({ type: 'commandPreviewShapes', value: [] })
  }

  return {
    setTool: (value: React.SetStateAction<EditorToolState['tool']>) =>
      dispatch({ type: 'tool', value }),
    setDraftPoints: (value: React.SetStateAction<EditorToolState['draftPoints']>) =>
      dispatch({ type: 'draftPoints', value }),
    setCursorPoint: (value: React.SetStateAction<EditorToolState['cursorPoint']>) =>
      dispatch({ type: 'cursorPoint', value }),
    setSnapIndicator: (value: React.SetStateAction<EditorToolState['snapIndicator']>) =>
      dispatch({ type: 'snapIndicator', value }),
    setMarkedSnapPoints: (value: React.SetStateAction<EditorToolState['markedSnapPoints']>) =>
      dispatch({ type: 'markedSnapPoints', value }),
    setAngleGuideLines: (value: React.SetStateAction<EditorToolState['angleGuideLines']>) =>
      dispatch({ type: 'angleGuideLines', value }),
    setCadCommandMode: (value: React.SetStateAction<EditorToolState['cadCommandMode']>) =>
      dispatch({ type: 'cadCommandMode', value }),
    setCommandPreviewShapes: (value: React.SetStateAction<EditorToolState['commandPreviewShapes']>) =>
      dispatch({ type: 'commandPreviewShapes', value }),
    clearDraft,
    setActiveTool: (nextTool: EditorToolState['tool']) => {
      dispatch({ type: 'tool', value: nextTool })
      clearDraft()
      setStatus(`Tool selected: ${toolLabel(nextTool)}`)
    },
    setTextDraftValue: (value: React.SetStateAction<EditorToolState['textDraftValue']>) =>
      dispatch({ type: 'textDraftValue', value }),
    setTextFontFamily: (value: React.SetStateAction<EditorToolState['textFontFamily']>) =>
      dispatch({ type: 'textFontFamily', value }),
    setTextFontSizeMm: (value: React.SetStateAction<EditorToolState['textFontSizeMm']>) =>
      dispatch({ type: 'textFontSizeMm', value }),
    setTextTransformMode: (value: React.SetStateAction<EditorToolState['textTransformMode']>) =>
      dispatch({ type: 'textTransformMode', value }),
    setTextRadiusMm: (value: React.SetStateAction<EditorToolState['textRadiusMm']>) =>
      dispatch({ type: 'textRadiusMm', value }),
    setTextSweepDeg: (value: React.SetStateAction<EditorToolState['textSweepDeg']>) =>
      dispatch({ type: 'textSweepDeg', value }),
    setStitchHoleDefaults: (value: React.SetStateAction<EditorToolState['stitchHoleDefaults']>) =>
      dispatch({ type: 'stitchHoleDefaults', value }),
    setStitchPitchMm: (value: React.SetStateAction<EditorToolState['stitchPitchMm']>) =>
      dispatch({ type: 'stitchPitchMm', value }),
    setStitchVariablePitchStartMm: (value: React.SetStateAction<EditorToolState['stitchVariablePitchStartMm']>) =>
      dispatch({ type: 'stitchVariablePitchStartMm', value }),
    setStitchVariablePitchEndMm: (value: React.SetStateAction<EditorToolState['stitchVariablePitchEndMm']>) =>
      dispatch({ type: 'stitchVariablePitchEndMm', value }),
    setShowStitchSequenceLabels: (value: React.SetStateAction<EditorToolState['showStitchSequenceLabels']>) =>
      dispatch({ type: 'showStitchSequenceLabels', value }),
    setStitchAutoPitchSettings: (value: React.SetStateAction<EditorToolState['stitchAutoPitchSettings']>) => {
      const merged = {
        ...getDefaultStitchAutoPitchSettings(),
        ...resolveSetStateAction(state.stitchAutoPitchSettings, value),
      }
      saveStitchAutoPitchSettings(merged)
      dispatch({ type: 'stitchAutoPitchSettings', value: merged })
    },
  }
}

type EditorToolStateActions = ReturnType<typeof createEditorToolStateActions>
type EditorToolStateApi = EditorToolState & EditorToolStateActions

const EditorToolStateContext = createContext<EditorToolState | null>(null)
const EditorToolActionsContext = createContext<EditorToolStateActions | null>(null)

export function EditorToolStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(propertyStateReducer<EditorToolState>, initialEditorToolState)
  const { setStatus } = useEditorUIActions()
  const actions = useMemo(
    () => createEditorToolStateActions(state, dispatch, setStatus),
    [state, dispatch, setStatus],
  )

  return (
    <EditorToolStateContext.Provider value={state}>
      <EditorToolActionsContext.Provider value={actions}>
        {children}
      </EditorToolActionsContext.Provider>
    </EditorToolStateContext.Provider>
  )
}

export function useEditorToolSelector<T>(selector: (state: EditorToolState) => T) {
  const state = useRequiredContext(useContext(EditorToolStateContext), 'EditorToolStateContext')
  return selector(state)
}

export function useEditorToolActions() {
  return useRequiredContext(useContext(EditorToolActionsContext), 'EditorToolActionsContext')
}

export function useEditorToolStateApi(): EditorToolStateApi {
  const state = useRequiredContext(useContext(EditorToolStateContext), 'EditorToolStateContext')
  const actions = useRequiredContext(useContext(EditorToolActionsContext), 'EditorToolActionsContext')

  return useMemo(
    () => ({
      ...state,
      ...actions,
    }),
    [state, actions],
  )
}
