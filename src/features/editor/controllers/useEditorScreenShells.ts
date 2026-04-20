import { toolLabel } from '../editor-utils'
import type { UseEditorScreenShellsParams } from '../editorScreenShellTypes'
import { buildEditorScreenCanvasPaneParams } from '../modules/canvas/buildEditorScreenCanvasPaneParams'
import { useEditorLayoutFlags } from '../hooks/useEditorLayoutFlags'
import { useEditorPreviewPaneProps } from '../hooks/useEditorPreviewPaneProps'
import { useEditorScreenTopbarProps } from '../modules/topbar/useEditorScreenTopbarProps'
import { useEditorScreenWorkbenchModels } from '../modules/workbench/useEditorScreenWorkbenchModels'
import { useEditorStatusBarProps } from '../hooks/useEditorStatusBarProps'
import { useEditorWorkbenchProps } from '../useEditorWorkbenchProps'

export function useEditorScreenShells(params: UseEditorScreenShellsParams) {
  const {
    resolvedThemeMode,
    documentState,
    uiState,
    repositoryState,
    layerState,
    toolState,
    viewportState,
    derivedState,
    canvasController,
    actions,
  } = params
  const {
    showCanvasRuler,
    showDimensions,
  } = documentState
  const {
    showThreePreview,
    isMobileLayout,
    mobileViewMode,
    showMobileMenu,
    mobileOptionsTab,
    desktopRibbonTab,
    showPrecisionModal,
    setShowPrecisionModal,
    showGrid,
    sketchWorkspaceMode,
  } = uiState
  const { templateRepository } = repositoryState
  const { layers } = layerState
  const { tool, clearDraft } = toolState
  const { viewport, workspaceRef } = viewportState
  const {
    assemblyShapes,
    visibleStitchHoles,
    workspaceShapes,
    workspaceStitchHoles,
    activeLayer,
    layerStackLevels,
    layerColorsById,
  } = derivedState
  const { workspaceClassName, topbarClassName, hideCanvasPane, hidePreviewPane, ...layoutFlags } =
    useEditorLayoutFlags({
      isMobileLayout,
      mobileViewMode,
      showThreePreview,
      showMobileMenu,
      mobileOptionsTab,
      desktopRibbonTab,
    })
  const {
    layerActions: {
      handleAddLayer,
      handleRenameActiveLayer,
      handleMoveLayer,
      handleDeleteLayer,
    },
  } = actions

  const topbarProps = useEditorScreenTopbarProps({
    ...params,
    layout: {
      topbarClassName,
      showToolSection: layoutFlags.showToolSection,
      showZoomSection: layoutFlags.showZoomSection,
      showEditSection: layoutFlags.showEditSection,
      showLineTypeSection: layoutFlags.showLineTypeSection,
      showStitchSection: layoutFlags.showStitchSection,
      showLayerSection: layoutFlags.showLayerSection,
      showFileSection: layoutFlags.showFileSection,
    },
  })
  const previewPaneProps = useEditorPreviewPaneProps({
    hidePreviewPane,
    shapes: sketchWorkspaceMode === 'assembly' ? assemblyShapes : workspaceShapes,
    stitchHoles: sketchWorkspaceMode === 'assembly' ? visibleStitchHoles : workspaceStitchHoles,
    themeMode: resolvedThemeMode,
    activeLayer,
    layerStackLevels,
    layerColorsById,
    onClearDraft: clearDraft,
    onAddLayer: handleAddLayer,
    onRenameActiveLayer: handleRenameActiveLayer,
    onMoveLayerUp: () => handleMoveLayer(-1),
    onMoveLayerDown: () => handleMoveLayer(1),
    onDeleteLayer: handleDeleteLayer,
    onOpenLayerColorModal: () => params.panelState.setShowLayerColorModal(true),
  })
  const statusBarProps = useEditorStatusBarProps({
    toolLabel: toolLabel(tool),
    zoomPercent: Math.round(viewport.scale * 100),
    visibleShapeCount: workspaceShapes.length,
    layerCount: layers.length,
    templateCount: templateRepository.length,
  })
  const {
    workbenchController,
    shouldLoadThreeWorkbench,
    selectionInspectorProps,
    pieceInspectorContentProps,
    documentInspectorProps,
    workbenchProps,
    workbenchThreeWorkspaceProps,
  } = useEditorScreenWorkbenchModels(params)
  const canvasPaneParams = buildEditorScreenCanvasPaneParams(params)
  const { mobileShell, desktopShell } = useEditorWorkbenchProps({
    workspaceRef,
    workspaceClassName,
    topbarProps,
    hideCanvasPane,
    previewPaneProps,
    statusBarProps,
    toolHint: canvasController.toolHint,
    runPrecisionCommand: canvasController.runPrecisionCommand,
    showPrecisionModal,
    setShowPrecisionModal,
    workbenchProps,
    selectionInspectorProps,
    pieceInspectorContentProps,
    documentInspectorProps,
    workbenchThreeWorkspaceProps,
    onOpenThreeWorkspace: () => workbenchController.handleSetWorkbenchMode('3d'),
    shouldLoadThreeWorkbench,
    canvasPaneParams: {
      ...canvasPaneParams,
      hideCanvasPane,
      showLayerLegend: layoutFlags.showLayerLegend,
      showGrid,
      showCanvasRuler,
      showDimensions,
    },
  })

  return {
    mobileShell,
    desktopShell,
    pieceInspectorContentProps,
    shouldLoadThreeWorkbench,
  }
}
