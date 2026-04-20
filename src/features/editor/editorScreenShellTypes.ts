import type { useEditorCanvasController } from './modules/canvas/useEditorCanvasController'
import type { useEditorCreationController } from './controllers/useEditorCreationController'
import type { useConstraintActions } from './hooks/useConstraintActions'
import type { useEditorDerivedState } from './hooks/useEditorDerivedState'
import type { useEditorDocumentCommands } from './useEditorDocumentCommands'
import type { useEditorDocumentState } from './hooks/useEditorDocumentState'
import type { useEditorLayers } from './hooks/useEditorLayers'
import type { useEditorPanelState } from './hooks/useEditorPanelState'
import type { useEditorRepositoryState } from './hooks/useEditorRepositoryState'
import type { useEditorScreenRefs } from './controllers/useEditorScreenRefs'
import type { useEditorSelectionState } from './hooks/useEditorSelectionState'
import type { useEditorStateActions } from './hooks/useEditorStateActions'
import type { useEditorTools } from './hooks/useEditorTools'
import type { useEditorUIState } from './hooks/useEditorUIState'
import type { useEditorViewport } from './hooks/useEditorViewport'
import type { useExportActions } from './hooks/useExportActions'
import type { useFileActions } from './hooks/useFileActions'
import type { useGeometryEditingActions } from './hooks/useGeometryEditingActions'
import type { useHardwareMarkerActions } from './hooks/useHardwareMarkerActions'
import type { useHistoryActions } from './hooks/useHistoryActions'
import type { useLayerActions } from './hooks/useLayerActions'
import type { useLayerColorActions } from './hooks/useLayerColorActions'
import type { useLineTypeActions } from './hooks/useLineTypeActions'
import type { useMobileActions } from './hooks/useMobileActions'
import type { usePatternPieceCommands } from './controllers/usePatternPieceCommands'
import type { usePatternPieceSelection } from './state/selectors/usePatternPieceSelection'
import type { usePrintPreviewState } from './state/selectors/usePrintPreviewState'
import type { useSelectionActions } from './hooks/useSelectionActions'
import type { useSketchGroupActions } from './hooks/useSketchGroupActions'
import type { useStitchActions } from './hooks/useStitchActions'
import type { useThemeActions } from './hooks/useThemeActions'
import type { useTransformActions } from './hooks/useTransformActions'
import type { useWorkbenchShellState } from './workbench/useWorkbenchShellState'
import type { useCombinedDraftAndSnapElement } from './hooks/useDraftCanvasElements'
import type { OutlineChain } from './ops/outline-detection'
import type { ResolvedThemeMode } from './editor-types'
import type { Shape } from './cad/cad-types'
import type { StitchSimulatorSettings } from './ops/stitch-simulator-ops'

export type EditorScreenShellActions = {
  editorStateActions: ReturnType<typeof useEditorStateActions>
  documentCommands: ReturnType<typeof useEditorDocumentCommands>
  exportActions: ReturnType<typeof useExportActions>
  fileActions: ReturnType<typeof useFileActions>
  historyActions: ReturnType<typeof useHistoryActions>
  selectionActions: ReturnType<typeof useSelectionActions>
  transformActions: ReturnType<typeof useTransformActions>
  layerActions: ReturnType<typeof useLayerActions>
  lineTypeActions: ReturnType<typeof useLineTypeActions>
  layerColorActions: ReturnType<typeof useLayerColorActions>
  constraintActions: ReturnType<typeof useConstraintActions>
  sketchGroupActions: ReturnType<typeof useSketchGroupActions>
  patternPieceCommands: ReturnType<typeof usePatternPieceCommands>
  hardwareMarkerActions: ReturnType<typeof useHardwareMarkerActions>
  stitchActions: ReturnType<typeof useStitchActions>
  geometryActions: ReturnType<typeof useGeometryEditingActions>
  creationController: ReturnType<typeof useEditorCreationController>
  mobileActions: ReturnType<typeof useMobileActions>
  themeActions: ReturnType<typeof useThemeActions>
}

export type UseEditorScreenShellsParams = {
  resolvedThemeMode: ResolvedThemeMode
  documentState: ReturnType<typeof useEditorDocumentState>
  uiState: ReturnType<typeof useEditorUIState>
  selectionState: ReturnType<typeof useEditorSelectionState>
  repositoryState: ReturnType<typeof useEditorRepositoryState>
  panelState: ReturnType<typeof useEditorPanelState>
  layerState: ReturnType<typeof useEditorLayers>
  toolState: ReturnType<typeof useEditorTools>
  viewportState: ReturnType<typeof useEditorViewport>
  workbenchShellState: ReturnType<typeof useWorkbenchShellState>
  screenRefs: ReturnType<typeof useEditorScreenRefs>
  derivedState: ReturnType<typeof useEditorDerivedState>
  canvasController: ReturnType<typeof useEditorCanvasController>
  patternPieceSelection: ReturnType<typeof usePatternPieceSelection>
  printPreviewState: ReturnType<typeof usePrintPreviewState>
  previewElement: ReturnType<typeof useCombinedDraftAndSnapElement>
  outlineChains: OutlineChain[]
  selectedEditableShape: Shape | null
  stitchSimulatorSettings: StitchSimulatorSettings
  actions: EditorScreenShellActions
}
