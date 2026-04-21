import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import {
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  createDefaultLineTypes,
} from '../../cad/line-types'
import { DEFAULT_SNAP_SETTINGS, DEFAULT_THREE_PREVIEW_SETTINGS } from '../../editor-constants'
import type { EditorDocumentState } from '../editor-domain-types'
import {
  propertyStateReducer,
  useRequiredContext,
  type PropertyAction,
} from './property-state'

const initialEditorDocumentState: EditorDocumentState = {
  documentName: null,
  lineTypes: createDefaultLineTypes(),
  activeLineTypeId: DEFAULT_ACTIVE_LINE_TYPE_ID,
  shapes: [],
  foldLines: [],
  stitchHoles: [],
  sketchGroups: [],
  activeSketchGroupId: null,
  constraints: [],
  patternPieces: [],
  pieceGrainlines: [],
  pieceLabels: [],
  piecePlacementLabels: [],
  piecePlacements3d: [],
  seamConnections: [],
  seamAllowances: [],
  pieceNotches: [],
  hardwareMarkers: [],
  dimensionLines: [],
  printAreas: [],
  snapSettings: DEFAULT_SNAP_SETTINGS,
  showAnnotations: true,
  tracingOverlays: [],
  activeTracingOverlayId: null,
  backdrops: [],
  activeBackdropId: null,
  projectMemo: '',
  stitchAlwaysShapeIds: [],
  stitchThreadColor: '#fb923c',
  threePreviewSettings: DEFAULT_THREE_PREVIEW_SETTINGS,
  avatars: [],
  threeTextureSource: null,
  threeTextureShapeIds: [],
  leatherImageFills: [],
  activeLeatherImageFillId: null,
  showCanvasRuler: true,
  showDimensions: false,
}

function createEditorDocumentStateActions(dispatch: React.Dispatch<PropertyAction<EditorDocumentState>>) {
  return {
    setDocumentName: (value: React.SetStateAction<EditorDocumentState['documentName']>) =>
      dispatch({ type: 'documentName', value }),
    setLineTypes: (value: React.SetStateAction<EditorDocumentState['lineTypes']>) =>
      dispatch({ type: 'lineTypes', value }),
    setActiveLineTypeId: (value: React.SetStateAction<EditorDocumentState['activeLineTypeId']>) =>
      dispatch({ type: 'activeLineTypeId', value }),
    setShapes: (value: React.SetStateAction<EditorDocumentState['shapes']>) =>
      dispatch({ type: 'shapes', value }),
    setFoldLines: (value: React.SetStateAction<EditorDocumentState['foldLines']>) =>
      dispatch({ type: 'foldLines', value }),
    setStitchHoles: (value: React.SetStateAction<EditorDocumentState['stitchHoles']>) =>
      dispatch({ type: 'stitchHoles', value }),
    setSketchGroups: (value: React.SetStateAction<EditorDocumentState['sketchGroups']>) =>
      dispatch({ type: 'sketchGroups', value }),
    setActiveSketchGroupId: (value: React.SetStateAction<EditorDocumentState['activeSketchGroupId']>) =>
      dispatch({ type: 'activeSketchGroupId', value }),
    setConstraints: (value: React.SetStateAction<EditorDocumentState['constraints']>) =>
      dispatch({ type: 'constraints', value }),
    setPatternPieces: (value: React.SetStateAction<EditorDocumentState['patternPieces']>) =>
      dispatch({ type: 'patternPieces', value }),
    setPieceGrainlines: (value: React.SetStateAction<EditorDocumentState['pieceGrainlines']>) =>
      dispatch({ type: 'pieceGrainlines', value }),
    setPieceLabels: (value: React.SetStateAction<EditorDocumentState['pieceLabels']>) =>
      dispatch({ type: 'pieceLabels', value }),
    setPiecePlacementLabels: (value: React.SetStateAction<EditorDocumentState['piecePlacementLabels']>) =>
      dispatch({ type: 'piecePlacementLabels', value }),
    setPiecePlacements3d: (value: React.SetStateAction<EditorDocumentState['piecePlacements3d']>) =>
      dispatch({ type: 'piecePlacements3d', value }),
    setSeamConnections: (value: React.SetStateAction<EditorDocumentState['seamConnections']>) =>
      dispatch({ type: 'seamConnections', value }),
    setSeamAllowances: (value: React.SetStateAction<EditorDocumentState['seamAllowances']>) =>
      dispatch({ type: 'seamAllowances', value }),
    setPieceNotches: (value: React.SetStateAction<EditorDocumentState['pieceNotches']>) =>
      dispatch({ type: 'pieceNotches', value }),
    setHardwareMarkers: (value: React.SetStateAction<EditorDocumentState['hardwareMarkers']>) =>
      dispatch({ type: 'hardwareMarkers', value }),
    setDimensionLines: (value: React.SetStateAction<EditorDocumentState['dimensionLines']>) =>
      dispatch({ type: 'dimensionLines', value }),
    setPrintAreas: (value: React.SetStateAction<EditorDocumentState['printAreas']>) =>
      dispatch({ type: 'printAreas', value }),
    setSnapSettings: (value: React.SetStateAction<EditorDocumentState['snapSettings']>) =>
      dispatch({ type: 'snapSettings', value }),
    setShowAnnotations: (value: React.SetStateAction<EditorDocumentState['showAnnotations']>) =>
      dispatch({ type: 'showAnnotations', value }),
    setTracingOverlays: (value: React.SetStateAction<EditorDocumentState['tracingOverlays']>) =>
      dispatch({ type: 'tracingOverlays', value }),
    setActiveTracingOverlayId: (value: React.SetStateAction<EditorDocumentState['activeTracingOverlayId']>) =>
      dispatch({ type: 'activeTracingOverlayId', value }),
    setBackdrops: (value: React.SetStateAction<EditorDocumentState['backdrops']>) =>
      dispatch({ type: 'backdrops', value }),
    setActiveBackdropId: (value: React.SetStateAction<EditorDocumentState['activeBackdropId']>) =>
      dispatch({ type: 'activeBackdropId', value }),
    setProjectMemo: (value: React.SetStateAction<EditorDocumentState['projectMemo']>) =>
      dispatch({ type: 'projectMemo', value }),
    setStitchAlwaysShapeIds: (value: React.SetStateAction<EditorDocumentState['stitchAlwaysShapeIds']>) =>
      dispatch({ type: 'stitchAlwaysShapeIds', value }),
    setStitchThreadColor: (value: React.SetStateAction<EditorDocumentState['stitchThreadColor']>) =>
      dispatch({ type: 'stitchThreadColor', value }),
    setThreePreviewSettings: (value: React.SetStateAction<EditorDocumentState['threePreviewSettings']>) =>
      dispatch({ type: 'threePreviewSettings', value }),
    setAvatars: (value: React.SetStateAction<EditorDocumentState['avatars']>) =>
      dispatch({ type: 'avatars', value }),
    setThreeTextureSource: (value: React.SetStateAction<EditorDocumentState['threeTextureSource']>) =>
      dispatch({ type: 'threeTextureSource', value }),
    setThreeTextureShapeIds: (value: React.SetStateAction<EditorDocumentState['threeTextureShapeIds']>) =>
      dispatch({ type: 'threeTextureShapeIds', value }),
    setLeatherImageFills: (value: React.SetStateAction<EditorDocumentState['leatherImageFills']>) =>
      dispatch({ type: 'leatherImageFills', value }),
    setActiveLeatherImageFillId: (value: React.SetStateAction<EditorDocumentState['activeLeatherImageFillId']>) =>
      dispatch({ type: 'activeLeatherImageFillId', value }),
    setShowCanvasRuler: (value: React.SetStateAction<EditorDocumentState['showCanvasRuler']>) =>
      dispatch({ type: 'showCanvasRuler', value }),
    setShowDimensions: (value: React.SetStateAction<EditorDocumentState['showDimensions']>) =>
      dispatch({ type: 'showDimensions', value }),
  }
}

type EditorDocumentStateActions = ReturnType<typeof createEditorDocumentStateActions>
type EditorDocumentStateApi = EditorDocumentState & EditorDocumentStateActions

const EditorDocumentStateContext = createContext<EditorDocumentState | null>(null)
const EditorDocumentActionsContext = createContext<EditorDocumentStateActions | null>(null)

export function EditorDocumentStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(propertyStateReducer<EditorDocumentState>, initialEditorDocumentState)
  const actions = useMemo(() => createEditorDocumentStateActions(dispatch), [dispatch])

  return (
    <EditorDocumentStateContext.Provider value={state}>
      <EditorDocumentActionsContext.Provider value={actions}>
        {children}
      </EditorDocumentActionsContext.Provider>
    </EditorDocumentStateContext.Provider>
  )
}

export function useEditorDocumentSelector<T>(selector: (state: EditorDocumentState) => T) {
  const state = useRequiredContext(useContext(EditorDocumentStateContext), 'EditorDocumentStateContext')
  return selector(state)
}

export function useEditorDocumentActions() {
  return useRequiredContext(useContext(EditorDocumentActionsContext), 'EditorDocumentActionsContext')
}

export function useEditorDocumentStateApi(): EditorDocumentStateApi {
  const state = useRequiredContext(useContext(EditorDocumentStateContext), 'EditorDocumentStateContext')
  const actions = useRequiredContext(useContext(EditorDocumentActionsContext), 'EditorDocumentActionsContext')

  return useMemo(
    () => ({
      ...state,
      ...actions,
    }),
    [state, actions],
  )
}
