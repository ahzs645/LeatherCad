import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { DEFAULT_EXPORT_ROLE_FILTERS, DEFAULT_SEAM_ALLOWANCE_MM } from '../../editor-constants'
import type { EditorPanelState } from '../editor-domain-types'
import {
  propertyStateReducer,
  useRequiredContext,
  type PropertyAction,
} from './property-state'

const initialEditorPanelState: EditorPanelState = {
  showLayerColorModal: false,
  showLineTypePalette: false,
  showExportModal: false,
  showExportOptionsModal: false,
  exportOnlySelectedShapes: false,
  exportOnlyVisibleLineTypes: true,
  exportRoleFilters: { ...DEFAULT_EXPORT_ROLE_FILTERS },
  exportForceSolidStrokes: false,
  exportStitchHoleRenderMode: 'native',
  exportStitchDotRadiusMm: 0.6,
  dxfFlipY: false,
  dxfVersion: 'r12',
  showTracingModal: false,
  showPatternToolsModal: false,
  showAiBuilderModal: false,
  showHelpModal: false,
  showTemplateRepositoryModal: false,
  showLocalProjectsModal: false,
  printPaper: 'letter',
  printOrientation: 'portrait',
  printIntoMargin: false,
  printTileX: 1,
  printTileY: 1,
  printOverlapMm: 4,
  printMarginMm: 8,
  printScalePercent: 100,
  printCalibrationXPercent: 100,
  printCalibrationYPercent: 100,
  printSelectedOnly: false,
  printRulerInside: false,
  printInColor: true,
  printStitchAsDots: false,
  printLineThicknessScalePercent: 100,
  printShowIgnoredLineTypes: false,
  showPrintAreas: false,
  showPrintPreviewModal: false,
  seamAllowanceInputMm: DEFAULT_SEAM_ALLOWANCE_MM,
  constraintEdge: 'left',
  constraintOffsetMm: 10,
  constraintAxis: 'x',
  hardwarePreset: 'snap',
  customHardwareDiameterMm: 4,
  customHardwareSpacingMm: 0,
  dimensionDefaults: {
    fontSizeMm: 5,
    precision: 1,
    arrowOnly: false,
    singleLine: false,
    textInside: true,
    textReverse: false,
  },
  forceFitLastPrick: false,
  autoHideSidebar: false,
  loadDemoOnStartup: true,
  printRulerAnchorTileIndex: null,
}

function createEditorPanelStateActions(dispatch: React.Dispatch<PropertyAction<EditorPanelState>>) {
  return {
    setShowLayerColorModal: (value: React.SetStateAction<EditorPanelState['showLayerColorModal']>) =>
      dispatch({ type: 'showLayerColorModal', value }),
    setShowLineTypePalette: (value: React.SetStateAction<EditorPanelState['showLineTypePalette']>) =>
      dispatch({ type: 'showLineTypePalette', value }),
    setShowExportModal: (value: React.SetStateAction<EditorPanelState['showExportModal']>) =>
      dispatch({ type: 'showExportModal', value }),
    setShowExportOptionsModal: (value: React.SetStateAction<EditorPanelState['showExportOptionsModal']>) =>
      dispatch({ type: 'showExportOptionsModal', value }),
    setExportOnlySelectedShapes: (value: React.SetStateAction<EditorPanelState['exportOnlySelectedShapes']>) =>
      dispatch({ type: 'exportOnlySelectedShapes', value }),
    setExportOnlyVisibleLineTypes: (value: React.SetStateAction<EditorPanelState['exportOnlyVisibleLineTypes']>) =>
      dispatch({ type: 'exportOnlyVisibleLineTypes', value }),
    setExportRoleFilters: (value: React.SetStateAction<EditorPanelState['exportRoleFilters']>) =>
      dispatch({ type: 'exportRoleFilters', value }),
    setExportForceSolidStrokes: (value: React.SetStateAction<EditorPanelState['exportForceSolidStrokes']>) =>
      dispatch({ type: 'exportForceSolidStrokes', value }),
    setExportStitchHoleRenderMode: (value: React.SetStateAction<EditorPanelState['exportStitchHoleRenderMode']>) =>
      dispatch({ type: 'exportStitchHoleRenderMode', value }),
    setExportStitchDotRadiusMm: (value: React.SetStateAction<EditorPanelState['exportStitchDotRadiusMm']>) =>
      dispatch({ type: 'exportStitchDotRadiusMm', value }),
    setDxfFlipY: (value: React.SetStateAction<EditorPanelState['dxfFlipY']>) =>
      dispatch({ type: 'dxfFlipY', value }),
    setDxfVersion: (value: React.SetStateAction<EditorPanelState['dxfVersion']>) =>
      dispatch({ type: 'dxfVersion', value }),
    setShowTracingModal: (value: React.SetStateAction<EditorPanelState['showTracingModal']>) =>
      dispatch({ type: 'showTracingModal', value }),
    setShowPatternToolsModal: (value: React.SetStateAction<EditorPanelState['showPatternToolsModal']>) =>
      dispatch({ type: 'showPatternToolsModal', value }),
    setShowAiBuilderModal: (value: React.SetStateAction<EditorPanelState['showAiBuilderModal']>) =>
      dispatch({ type: 'showAiBuilderModal', value }),
    setShowHelpModal: (value: React.SetStateAction<EditorPanelState['showHelpModal']>) =>
      dispatch({ type: 'showHelpModal', value }),
    setShowTemplateRepositoryModal: (value: React.SetStateAction<EditorPanelState['showTemplateRepositoryModal']>) =>
      dispatch({ type: 'showTemplateRepositoryModal', value }),
    setShowLocalProjectsModal: (value: React.SetStateAction<EditorPanelState['showLocalProjectsModal']>) =>
      dispatch({ type: 'showLocalProjectsModal', value }),
    setPrintPaper: (value: React.SetStateAction<EditorPanelState['printPaper']>) =>
      dispatch({ type: 'printPaper', value }),
    setPrintOrientation: (value: React.SetStateAction<EditorPanelState['printOrientation']>) =>
      dispatch({ type: 'printOrientation', value }),
    setPrintIntoMargin: (value: React.SetStateAction<EditorPanelState['printIntoMargin']>) =>
      dispatch({ type: 'printIntoMargin', value }),
    setPrintTileX: (value: React.SetStateAction<EditorPanelState['printTileX']>) =>
      dispatch({ type: 'printTileX', value }),
    setPrintTileY: (value: React.SetStateAction<EditorPanelState['printTileY']>) =>
      dispatch({ type: 'printTileY', value }),
    setPrintOverlapMm: (value: React.SetStateAction<EditorPanelState['printOverlapMm']>) =>
      dispatch({ type: 'printOverlapMm', value }),
    setPrintMarginMm: (value: React.SetStateAction<EditorPanelState['printMarginMm']>) =>
      dispatch({ type: 'printMarginMm', value }),
    setPrintScalePercent: (value: React.SetStateAction<EditorPanelState['printScalePercent']>) =>
      dispatch({ type: 'printScalePercent', value }),
    setPrintCalibrationXPercent: (value: React.SetStateAction<EditorPanelState['printCalibrationXPercent']>) =>
      dispatch({ type: 'printCalibrationXPercent', value }),
    setPrintCalibrationYPercent: (value: React.SetStateAction<EditorPanelState['printCalibrationYPercent']>) =>
      dispatch({ type: 'printCalibrationYPercent', value }),
    setPrintSelectedOnly: (value: React.SetStateAction<EditorPanelState['printSelectedOnly']>) =>
      dispatch({ type: 'printSelectedOnly', value }),
    setPrintRulerInside: (value: React.SetStateAction<EditorPanelState['printRulerInside']>) =>
      dispatch({ type: 'printRulerInside', value }),
    setPrintInColor: (value: React.SetStateAction<EditorPanelState['printInColor']>) =>
      dispatch({ type: 'printInColor', value }),
    setPrintStitchAsDots: (value: React.SetStateAction<EditorPanelState['printStitchAsDots']>) =>
      dispatch({ type: 'printStitchAsDots', value }),
    setPrintLineThicknessScalePercent: (
      value: React.SetStateAction<EditorPanelState['printLineThicknessScalePercent']>,
    ) => dispatch({ type: 'printLineThicknessScalePercent', value }),
    setPrintShowIgnoredLineTypes: (
      value: React.SetStateAction<EditorPanelState['printShowIgnoredLineTypes']>,
    ) => dispatch({ type: 'printShowIgnoredLineTypes', value }),
    setShowPrintAreas: (value: React.SetStateAction<EditorPanelState['showPrintAreas']>) =>
      dispatch({ type: 'showPrintAreas', value }),
    setShowPrintPreviewModal: (value: React.SetStateAction<EditorPanelState['showPrintPreviewModal']>) =>
      dispatch({ type: 'showPrintPreviewModal', value }),
    setSeamAllowanceInputMm: (value: React.SetStateAction<EditorPanelState['seamAllowanceInputMm']>) =>
      dispatch({ type: 'seamAllowanceInputMm', value }),
    setConstraintEdge: (value: React.SetStateAction<EditorPanelState['constraintEdge']>) =>
      dispatch({ type: 'constraintEdge', value }),
    setConstraintOffsetMm: (value: React.SetStateAction<EditorPanelState['constraintOffsetMm']>) =>
      dispatch({ type: 'constraintOffsetMm', value }),
    setConstraintAxis: (value: React.SetStateAction<EditorPanelState['constraintAxis']>) =>
      dispatch({ type: 'constraintAxis', value }),
    setHardwarePreset: (value: React.SetStateAction<EditorPanelState['hardwarePreset']>) =>
      dispatch({ type: 'hardwarePreset', value }),
    setCustomHardwareDiameterMm: (value: React.SetStateAction<EditorPanelState['customHardwareDiameterMm']>) =>
      dispatch({ type: 'customHardwareDiameterMm', value }),
    setCustomHardwareSpacingMm: (value: React.SetStateAction<EditorPanelState['customHardwareSpacingMm']>) =>
      dispatch({ type: 'customHardwareSpacingMm', value }),
    setDimensionDefaults: (value: React.SetStateAction<EditorPanelState['dimensionDefaults']>) =>
      dispatch({ type: 'dimensionDefaults', value }),
    setForceFitLastPrick: (value: React.SetStateAction<EditorPanelState['forceFitLastPrick']>) =>
      dispatch({ type: 'forceFitLastPrick', value }),
    setAutoHideSidebar: (value: React.SetStateAction<EditorPanelState['autoHideSidebar']>) =>
      dispatch({ type: 'autoHideSidebar', value }),
    setLoadDemoOnStartup: (value: React.SetStateAction<EditorPanelState['loadDemoOnStartup']>) =>
      dispatch({ type: 'loadDemoOnStartup', value }),
    setPrintRulerAnchorTileIndex: (value: React.SetStateAction<EditorPanelState['printRulerAnchorTileIndex']>) =>
      dispatch({ type: 'printRulerAnchorTileIndex', value }),
  }
}

type EditorPanelStateActions = ReturnType<typeof createEditorPanelStateActions>
type EditorPanelStateApi = EditorPanelState & EditorPanelStateActions

const EditorPanelStateContext = createContext<EditorPanelState | null>(null)
const EditorPanelActionsContext = createContext<EditorPanelStateActions | null>(null)

export function EditorPanelStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(propertyStateReducer<EditorPanelState>, initialEditorPanelState)
  const actions = useMemo(() => createEditorPanelStateActions(dispatch), [dispatch])

  return (
    <EditorPanelStateContext.Provider value={state}>
      <EditorPanelActionsContext.Provider value={actions}>
        {children}
      </EditorPanelActionsContext.Provider>
    </EditorPanelStateContext.Provider>
  )
}

export function useEditorPanelSelector<T>(selector: (state: EditorPanelState) => T) {
  const state = useRequiredContext(useContext(EditorPanelStateContext), 'EditorPanelStateContext')
  return selector(state)
}

export function useEditorPanelActions() {
  return useRequiredContext(useContext(EditorPanelActionsContext), 'EditorPanelActionsContext')
}

export function useEditorPanelStateApi(): EditorPanelStateApi {
  const state = useRequiredContext(useContext(EditorPanelStateContext), 'EditorPanelStateContext')
  const actions = useRequiredContext(useContext(EditorPanelActionsContext), 'EditorPanelActionsContext')

  return useMemo(
    () => ({
      ...state,
      ...actions,
    }),
    [state, actions],
  )
}
