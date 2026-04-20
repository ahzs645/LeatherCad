import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { DEFAULT_GRID_SPACING } from '../../editor-constants'
import { DEFAULT_PRESET_ID } from '../../data/sample-doc-meta'
import { loadFontList } from '../../ops/font-list-ops'
import { loadAutoSaveEnabled } from '../../ops/autosave'
import { loadEditorPreferences } from '../../ops/editor-prefs'
import type { EditorUIState } from '../editor-domain-types'
import {
  propertyStateReducer,
  useRequiredContext,
  type PropertyAction,
} from './property-state'

const getSystemThemeMode = () => {
  if (typeof window === 'undefined') {
    return 'dark' as const
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const initialEditorUIState: EditorUIState = {
  status: 'Ready',
  showThreePreview: true,
  sidePanelTab: '3d',
  show3dInMain: false,
  isMobileLayout: false,
  mobileViewMode: 'editor',
  showMobileMenu: false,
  mobileOptionsTab: 'view',
  showPrecisionModal: false,
  showProjectMemoModal: false,
  showNestingModal: false,
  desktopRibbonTab: 'build',
  workbenchRibbonTab: 'draft',
  workspaceMode: '2d',
  secondaryPreviewMode: '3d-peek',
  mobileLayerAction: 'add',
  mobileFileAction: 'save-json',
  displayUnit: 'mm',
  gridSpacing: DEFAULT_GRID_SPACING,
  legendMode: 'layer',
  sketchWorkspaceMode: 'assembly',
  selectedPresetId: DEFAULT_PRESET_ID,
  themeMode: 'system',
  systemThemeMode: getSystemThemeMode(),
  loadedFontUrl: null,
  constraintSuggestions: [],
  showStitchSimulatorModal: false,
  showBoxStitchHelperModal: false,
  showBoxStitchModal: false,
  showMandalaModal: false,
  showWizardModal: false,
  showLetterStampModal: false,
  showChangeShapeSizeModal: false,
  showBezierOffsetLines: false,
  customRotationPivot: null,
  customSnapPoint: null,
  showSpecifyRotationModal: false,
  showSpecifyScaleModal: false,
  specifyScaleModalAxis: 'both',
  showFontListModal: false,
  fontList: loadFontList(),
  autoSaveEnabled: loadAutoSaveEnabled(),
  reverseZoomDirection: loadEditorPreferences().reverseZoomDirection,
  incrementalSelection: loadEditorPreferences().incrementalSelection,
  mentoriWithoutCtrl: loadEditorPreferences().mentoriWithoutCtrl,
  lineToolConstraint: loadEditorPreferences().lineToolConstraint,
  showLengthAdjustModal: false,
  showOptionsModal: false,
  leatherSimTextureRotationDeg: loadEditorPreferences().leatherSimTextureRotationDeg,
  exportIncludeText: loadEditorPreferences().exportIncludeText,
  exportIncludeTemplateMetadata: loadEditorPreferences().exportIncludeTemplateMetadata,
}

const autoConstraintSettings = {
  enabled: true,
  horizontal: true,
  vertical: true,
  parallel: true,
  perpendicular: true,
  equalLength: true,
  tangent: true,
  angleTolerance: 3,
  distanceTolerance: 0.5,
}

function createEditorUIStateActions(dispatch: React.Dispatch<PropertyAction<EditorUIState>>) {
  return {
    setStatus: (value: React.SetStateAction<EditorUIState['status']>) =>
      dispatch({ type: 'status', value }),
    setShowThreePreview: (value: React.SetStateAction<EditorUIState['showThreePreview']>) =>
      dispatch({ type: 'showThreePreview', value }),
    setSidePanelTab: (value: React.SetStateAction<EditorUIState['sidePanelTab']>) =>
      dispatch({ type: 'sidePanelTab', value }),
    setShow3dInMain: (value: React.SetStateAction<EditorUIState['show3dInMain']>) =>
      dispatch({ type: 'show3dInMain', value }),
    setIsMobileLayout: (value: React.SetStateAction<EditorUIState['isMobileLayout']>) =>
      dispatch({ type: 'isMobileLayout', value }),
    setMobileViewMode: (value: React.SetStateAction<EditorUIState['mobileViewMode']>) =>
      dispatch({ type: 'mobileViewMode', value }),
    setShowMobileMenu: (value: React.SetStateAction<EditorUIState['showMobileMenu']>) =>
      dispatch({ type: 'showMobileMenu', value }),
    setMobileOptionsTab: (value: React.SetStateAction<EditorUIState['mobileOptionsTab']>) =>
      dispatch({ type: 'mobileOptionsTab', value }),
    setShowPrecisionModal: (value: React.SetStateAction<EditorUIState['showPrecisionModal']>) =>
      dispatch({ type: 'showPrecisionModal', value }),
    setShowProjectMemoModal: (value: React.SetStateAction<EditorUIState['showProjectMemoModal']>) =>
      dispatch({ type: 'showProjectMemoModal', value }),
    setShowNestingModal: (value: React.SetStateAction<EditorUIState['showNestingModal']>) =>
      dispatch({ type: 'showNestingModal', value }),
    setDesktopRibbonTab: (value: React.SetStateAction<EditorUIState['desktopRibbonTab']>) =>
      dispatch({ type: 'desktopRibbonTab', value }),
    setWorkbenchRibbonTab: (value: React.SetStateAction<EditorUIState['workbenchRibbonTab']>) =>
      dispatch({ type: 'workbenchRibbonTab', value }),
    setWorkspaceMode: (value: React.SetStateAction<EditorUIState['workspaceMode']>) =>
      dispatch({ type: 'workspaceMode', value }),
    setSecondaryPreviewMode: (value: React.SetStateAction<EditorUIState['secondaryPreviewMode']>) =>
      dispatch({ type: 'secondaryPreviewMode', value }),
    setMobileLayerAction: (value: React.SetStateAction<EditorUIState['mobileLayerAction']>) =>
      dispatch({ type: 'mobileLayerAction', value }),
    setMobileFileAction: (value: React.SetStateAction<EditorUIState['mobileFileAction']>) =>
      dispatch({ type: 'mobileFileAction', value }),
    setDisplayUnit: (value: React.SetStateAction<EditorUIState['displayUnit']>) =>
      dispatch({ type: 'displayUnit', value }),
    setGridSpacing: (value: React.SetStateAction<EditorUIState['gridSpacing']>) =>
      dispatch({ type: 'gridSpacing', value }),
    setLegendMode: (value: React.SetStateAction<EditorUIState['legendMode']>) =>
      dispatch({ type: 'legendMode', value }),
    setSketchWorkspaceMode: (value: React.SetStateAction<EditorUIState['sketchWorkspaceMode']>) =>
      dispatch({ type: 'sketchWorkspaceMode', value }),
    setSelectedPresetId: (value: React.SetStateAction<EditorUIState['selectedPresetId']>) =>
      dispatch({ type: 'selectedPresetId', value }),
    setThemeMode: (value: React.SetStateAction<EditorUIState['themeMode']>) =>
      dispatch({ type: 'themeMode', value }),
    setSystemThemeMode: (value: React.SetStateAction<EditorUIState['systemThemeMode']>) =>
      dispatch({ type: 'systemThemeMode', value }),
    setLoadedFontUrl: (value: React.SetStateAction<EditorUIState['loadedFontUrl']>) =>
      dispatch({ type: 'loadedFontUrl', value }),
    setConstraintSuggestions: (value: React.SetStateAction<EditorUIState['constraintSuggestions']>) =>
      dispatch({ type: 'constraintSuggestions', value }),
    setShowStitchSimulatorModal: (value: React.SetStateAction<EditorUIState['showStitchSimulatorModal']>) =>
      dispatch({ type: 'showStitchSimulatorModal', value }),
    setShowBoxStitchHelperModal: (value: React.SetStateAction<EditorUIState['showBoxStitchHelperModal']>) =>
      dispatch({ type: 'showBoxStitchHelperModal', value }),
    setShowBoxStitchModal: (value: React.SetStateAction<EditorUIState['showBoxStitchModal']>) =>
      dispatch({ type: 'showBoxStitchModal', value }),
    setShowMandalaModal: (value: React.SetStateAction<EditorUIState['showMandalaModal']>) =>
      dispatch({ type: 'showMandalaModal', value }),
    setShowWizardModal: (value: React.SetStateAction<EditorUIState['showWizardModal']>) =>
      dispatch({ type: 'showWizardModal', value }),
    setShowLetterStampModal: (value: React.SetStateAction<EditorUIState['showLetterStampModal']>) =>
      dispatch({ type: 'showLetterStampModal', value }),
    setShowChangeShapeSizeModal: (value: React.SetStateAction<EditorUIState['showChangeShapeSizeModal']>) =>
      dispatch({ type: 'showChangeShapeSizeModal', value }),
    setShowBezierOffsetLines: (value: React.SetStateAction<EditorUIState['showBezierOffsetLines']>) =>
      dispatch({ type: 'showBezierOffsetLines', value }),
    setCustomRotationPivot: (value: React.SetStateAction<EditorUIState['customRotationPivot']>) =>
      dispatch({ type: 'customRotationPivot', value }),
    setCustomSnapPoint: (value: React.SetStateAction<EditorUIState['customSnapPoint']>) =>
      dispatch({ type: 'customSnapPoint', value }),
    setShowSpecifyRotationModal: (value: React.SetStateAction<EditorUIState['showSpecifyRotationModal']>) =>
      dispatch({ type: 'showSpecifyRotationModal', value }),
    setShowSpecifyScaleModal: (value: React.SetStateAction<EditorUIState['showSpecifyScaleModal']>) =>
      dispatch({ type: 'showSpecifyScaleModal', value }),
    setSpecifyScaleModalAxis: (value: React.SetStateAction<EditorUIState['specifyScaleModalAxis']>) =>
      dispatch({ type: 'specifyScaleModalAxis', value }),
    setShowFontListModal: (value: React.SetStateAction<EditorUIState['showFontListModal']>) =>
      dispatch({ type: 'showFontListModal', value }),
    setFontList: (value: React.SetStateAction<EditorUIState['fontList']>) =>
      dispatch({ type: 'fontList', value }),
    setAutoSaveEnabled: (value: React.SetStateAction<EditorUIState['autoSaveEnabled']>) =>
      dispatch({ type: 'autoSaveEnabled', value }),
    setReverseZoomDirection: (value: React.SetStateAction<EditorUIState['reverseZoomDirection']>) =>
      dispatch({ type: 'reverseZoomDirection', value }),
    setIncrementalSelection: (value: React.SetStateAction<EditorUIState['incrementalSelection']>) =>
      dispatch({ type: 'incrementalSelection', value }),
    setMentoriWithoutCtrl: (value: React.SetStateAction<EditorUIState['mentoriWithoutCtrl']>) =>
      dispatch({ type: 'mentoriWithoutCtrl', value }),
    setLineToolConstraint: (value: React.SetStateAction<EditorUIState['lineToolConstraint']>) =>
      dispatch({ type: 'lineToolConstraint', value }),
    setShowLengthAdjustModal: (value: React.SetStateAction<EditorUIState['showLengthAdjustModal']>) =>
      dispatch({ type: 'showLengthAdjustModal', value }),
    setShowOptionsModal: (value: React.SetStateAction<EditorUIState['showOptionsModal']>) =>
      dispatch({ type: 'showOptionsModal', value }),
    setLeatherSimTextureRotationDeg: (
      value: React.SetStateAction<EditorUIState['leatherSimTextureRotationDeg']>,
    ) => dispatch({ type: 'leatherSimTextureRotationDeg', value }),
    setExportIncludeText: (value: React.SetStateAction<EditorUIState['exportIncludeText']>) =>
      dispatch({ type: 'exportIncludeText', value }),
    setExportIncludeTemplateMetadata: (
      value: React.SetStateAction<EditorUIState['exportIncludeTemplateMetadata']>,
    ) => dispatch({ type: 'exportIncludeTemplateMetadata', value }),
  }
}

type EditorUIStateActions = ReturnType<typeof createEditorUIStateActions>
type EditorUIStateApi = EditorUIStateActions & EditorUIState & {
  autoConstraintSettings: typeof autoConstraintSettings
}

const EditorUIStateContext = createContext<EditorUIState | null>(null)
const EditorUIActionsContext = createContext<EditorUIStateActions | null>(null)

export function EditorUIStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(propertyStateReducer<EditorUIState>, initialEditorUIState)
  const actions = useMemo(() => createEditorUIStateActions(dispatch), [dispatch])

  return (
    <EditorUIStateContext.Provider value={state}>
      <EditorUIActionsContext.Provider value={actions}>
        {children}
      </EditorUIActionsContext.Provider>
    </EditorUIStateContext.Provider>
  )
}

export function useEditorUISelector<T>(selector: (state: EditorUIState) => T) {
  const state = useRequiredContext(useContext(EditorUIStateContext), 'EditorUIStateContext')
  return selector(state)
}

export function useEditorUIActions() {
  return useRequiredContext(useContext(EditorUIActionsContext), 'EditorUIActionsContext')
}

export function useEditorUIStateApi(): EditorUIStateApi {
  const state = useRequiredContext(useContext(EditorUIStateContext), 'EditorUIStateContext')
  const actions = useRequiredContext(useContext(EditorUIActionsContext), 'EditorUIActionsContext')

  return useMemo(
    () => ({
      ...state,
      ...actions,
      autoConstraintSettings,
    }),
    [state, actions],
  )
}
