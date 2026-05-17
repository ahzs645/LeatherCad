import { useEffect, useMemo, useRef, useState } from 'react'
import { STITCH_LINE_TYPE_ID } from './cad/line-types'
import { checkForNewerVersion } from './version-check'
import type { EditorScreenShellActions } from './editorScreenShellTypes'
import { saveCatalogRepository } from './templates/catalog-repository'
import { saveTemplateRepositoryFolders } from './templates/template-repository'

import { detectOutlines, type OutlineChain } from './ops/outline-detection'
import type { ResolvedThemeMode } from './editor-types'
import { useEditorDerivedState } from './hooks/useEditorDerivedState'
import { useExportActions } from './hooks/useExportActions'
import { useLayerActions } from './hooks/useLayerActions'
import { useConstraintActions } from './hooks/useConstraintActions'
import { useStitchActions } from './hooks/useStitchActions'
import { useFileActions } from './hooks/useFileActions'
import { useTemplateActions } from './hooks/useTemplateActions'
import { useTracingActions } from './hooks/useTracingActions'
import { useBackdropActions } from './hooks/useBackdropActions'
import { useMobileActions } from './hooks/useMobileActions'
import { useResponsiveLayout } from './hooks/useResponsiveLayout'
import { useEditorAutomationEffects } from './hooks/useEditorAutomationEffects'
import { useLeatherImageFillActions } from './hooks/useLeatherImageFillActions'
import { useLineTypeActions } from './hooks/useLineTypeActions'
import { useLayerColorActions } from './hooks/useLayerColorActions'
import { useEditorConsistencyEffects } from './hooks/useEditorConsistencyEffects'
import { useCombinedDraftAndSnapElement } from './hooks/useDraftCanvasElements'
import { useHardwareMarkerActions } from './hooks/useHardwareMarkerActions'
import { useLoadedDocumentActions } from './hooks/useLoadedDocumentActions'
import { useSketchGroupActions } from './hooks/useSketchGroupActions'
import { useHistoryActions } from './hooks/useHistoryActions'
import { useEditorStateActions } from './hooks/useEditorStateActions'
import { useSelectionActions } from './hooks/useSelectionActions'
import { useTransformActions } from './hooks/useTransformActions'
import { useAutoSave } from './hooks/useAutoSave'
import { useThemeActions } from './hooks/useThemeActions'
import { useEditorPanelState } from './hooks/useEditorPanelState'
import { useEditorViewport } from './hooks/useEditorViewport'
import { useEditorLayers } from './hooks/useEditorLayers'
import { useEditorTools } from './hooks/useEditorTools'
import { useEditorDocumentState } from './hooks/useEditorDocumentState'
import { useEditorUIState } from './hooks/useEditorUIState'
import { useEditorSelectionState } from './hooks/useEditorSelectionState'
import { useEditorRepositoryState } from './hooks/useEditorRepositoryState'
import { useAiBuilderActions } from './hooks/useAiBuilderActions'
import { useGeometryEditingActions } from './hooks/useGeometryEditingActions'
import { type StitchSimulatorSettings } from './ops/stitch-simulator-ops'
import { loadStitchSimulatorSettings, saveStitchSimulatorSettings } from './ops/stitch-simulator-settings'
import { loadBoxStitchHelperSettings, type BoxStitchHelperSettings } from './ops/box-stitch-settings'
import { useWorkbenchShellState } from './workbench/useWorkbenchShellState'
import { useWorkbenchRouteSync } from './workbench/useWorkbenchRouteSync'
import { usePatternPieceSelection } from './state/selectors/usePatternPieceSelection'
import { usePatternPieceCommands } from './controllers/usePatternPieceCommands'
import { usePrintPreviewState } from './state/selectors/usePrintPreviewState'
import { useEditorCreationController } from './controllers/useEditorCreationController'
import { useEditorDocumentBootstrap } from './controllers/useEditorDocumentBootstrap'
import { useEditorCanvasController } from './modules/canvas/useEditorCanvasController'
import { useEditorGlobalShortcuts } from './modules/canvas/useEditorGlobalShortcuts'
import { useEditorScreenOverlay } from './modules/overlays/useEditorScreenOverlay'
import { useEditorScreenRefs } from './controllers/useEditorScreenRefs'
import { useEditorScreenShells } from './controllers/useEditorScreenShells'
import { useEditorDocumentCommands } from './useEditorDocumentCommands'
import { useEditorAssetCommands } from './useEditorAssetCommands'

export type EditorScreenLayoutModel = {
  isMobileLayout: boolean
  resolvedThemeMode: ResolvedThemeMode
  shouldLoadThreeWorkbench: boolean
}

export type { EditorOverlayProps } from './controllers/buildEditorOverlayProps'

export function useEditorScreenController() {
  // Document state: shapes, constraints, layers, overlays, etc.
  const documentState = useEditorDocumentState()
  const {
    documentName, setDocumentName,
    activeLocalDocumentId, setActiveLocalDocumentId,
    lineTypes, setLineTypes,
    activeLineTypeId, setActiveLineTypeId,
    shapes, setShapes,
    foldLines, setFoldLines,
    stitchHoles, setStitchHoles,
    sketchGroups, setSketchGroups,
    activeSketchGroupId, setActiveSketchGroupId,
    constraints, setConstraints, patternPieces, setPatternPieces,
    pieceInterfaces, setPieceInterfaces, assemblyConnections, setAssemblyConnections,
    pieceGrainlines, setPieceGrainlines, pieceLabels, setPieceLabels,
    piecePlacementLabels, setPiecePlacementLabels, piecePlacements3d, setPiecePlacements3d,
    seamConnections, setSeamConnections, seamAllowances, setSeamAllowances,
    pieceNotches, setPieceNotches, hardwareMarkers, setHardwareMarkers,
    dimensionLines, setDimensionLines, printAreas, setPrintAreas,
    snapSettings, setSnapSettings, showAnnotations, setShowAnnotations,
    tracingOverlays, setTracingOverlays,
    setActiveTracingOverlayId,
    backdrops, setBackdrops,
    activeBackdropId, setActiveBackdropId,
    projectMemo, setProjectMemo,
    stitchAlwaysShapeIds, setStitchAlwaysShapeIds,
    stitchThreadColor, setStitchThreadColor,
    threePreviewSettings, setThreePreviewSettings,
    avatars, setAvatars,
    threeTextureSource, setThreeTextureSource,
    threeTextureShapeIds, setThreeTextureShapeIds,
    leatherImageFills, setLeatherImageFills,
    activeLeatherImageFillId, setActiveLeatherImageFillId,
    showCanvasRuler, setShowCanvasRuler,
    showDimensions, setShowDimensions,
  } = documentState

  // UI state: layout, modals, theme, display settings
  const uiState = useEditorUIState()
  const {
    setStatus,
    showThreePreview, setShowThreePreview,
    isMobileLayout, setIsMobileLayout,
    setMobileViewMode,
    setShowMobileMenu,
    setMobileOptionsTab,
    workspaceMode, setWorkspaceMode,
    secondaryPreviewMode, setSecondaryPreviewMode,
    mobileLayerAction,
    mobileFileAction,
    displayUnit,
    selectedPresetId, setSelectedPresetId,
    themeMode, setThemeMode,
    systemThemeMode, setSystemThemeMode,
    loadedFontUrl, setLoadedFontUrl,
    constraintSuggestions, setConstraintSuggestions,
    autoConstraintSettings,
    showStitchSimulatorModal, setShowStitchSimulatorModal,
    setShowBoxStitchHelperModal,
    setShowBoxStitchModal,
    setShowMandalaModal,
    setShowWizardModal,
    setShowLetterStampModal,
    showBezierOffsetLines, setShowBezierOffsetLines,
    customRotationPivot, setCustomRotationPivot,
    customSnapPoint, setCustomSnapPoint,
    setShowSpecifyRotationModal,
    setShowSpecifyScaleModal,
    setSpecifyScaleModalAxis,
    autoSaveEnabled,
    reverseZoomDirection,
    incrementalSelection,
    lineToolConstraint,
    leatherSimEnabled,
    setShowGrid,
  } = uiState

  // Selection state: selected shapes, stitch holes, hardware markers, clipboard
  const selectionState = useEditorSelectionState()
  const {
    selectedShapeIds, setSelectedShapeIds,
    selectedStitchHoleId, setSelectedStitchHoleId,
    selectedHardwareMarkerId, setSelectedHardwareMarkerId,
    clipboardPayload, setClipboardPayload,
  } = selectionState

  // Repository state: templates, catalogs
  const repositoryState = useEditorRepositoryState()
  const {
    templateRepository, setTemplateRepository,
    selectedTemplateEntryId, setSelectedTemplateEntryId,
    templateRepositoryFolders, setTemplateRepositoryFolders,
    selectedTemplateFolderId, setSelectedTemplateFolderId,
    catalogRepository, setCatalogRepository,
    bundledCatalogRepository,
    selectedCatalogShopId, setSelectedCatalogShopId,
    localDbHydrated,
  } = repositoryState
  const panelState = useEditorPanelState()
  const {
    setShowLayerColorModal,
    setShowExportOptionsModal,
    setExportOnlySelectedShapes,
    setExportOnlyVisibleLineTypes,
    setExportRoleFilters,
    setExportForceSolidStrokes,
    setExportStitchHoleRenderMode,
    setExportStitchDotRadiusMm,
    setDxfFlipY,
    setDxfVersion,
    setShowTracingModal,
    setShowPatternToolsModal,
    setShowTemplateRepositoryModal,
    setShowLocalProjectsModal,
    setShowPrintAreas,
    setShowPrintPreviewModal,
  } = panelState
  const layerState = useEditorLayers()
  const {
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    setFrontLayerColor,
    setBackLayerColor,
    setLayerColorOverrides,
  } = layerState

  const toolState = useEditorTools()
  const {
    tool,
    setTool,
    clearDraft,
    setActiveTool,
    textDraftValue,
    textFontFamily,
    textFontSizeMm,
    textTransformMode,
    textRadiusMm,
    textSweepDeg,
  } = toolState

  const viewportState = useEditorViewport({ isMobileLayout, showThreePreview })
  const {
    viewport,
    setViewport,
  } = viewportState
  const workbenchShellState = useWorkbenchShellState({
    enabled: !isMobileLayout,
    secondaryPreviewMode,
    autoHideSidebar: panelState.autoHideSidebar,
  })
  const {
    effectiveLayout,
    setActiveInspectorTab,
  } = workbenchShellState

  const resolvedThemeMode: ResolvedThemeMode = themeMode === 'system' ? systemThemeMode : themeMode

  useWorkbenchRouteSync({
    enabled: !isMobileLayout,
    workspaceMode,
    setWorkspaceMode,
    setSecondaryPreviewMode,
    activeInspectorTab: effectiveLayout.activeInspectorTab,
    setActiveInspectorTab,
  })

  const screenRefs = useEditorScreenRefs()
  const {
    svgRef,
    fileInputRef,
    svgInputRef,
    tracingInputRef,
    fontInputRef,
    pasteCountRef,
    tracingObjectUrlsRef,
    panRef,
  } = screenRefs
  const [showPieceInspectorModal, setShowPieceInspectorModal] = useState(false)
  const derivedState = useEditorDerivedState({
    templateRepository,
    selectedTemplateEntryId,
    themeMode: resolvedThemeMode,
  })
  const {
    activeLayer,
    sketchGroupsById,
    activeSketchGroup,
    activeLineType,
    lineTypesById,
    shapesById,
    patternPiecesById,
    patternPieceByBoundaryShapeId,
    patternPieceChains,
    selectedShapeIdSet,
    stitchHoleCountsByShape,
    selectedStitchHoleCount,
    selectedStitchHole,
    selectedHardwareMarker,
    selectedTemplateEntry,
    assemblyShapes,
    visibleLayerIdSet,
    workspaceShapes,
    workspaceEditableShapes,
    workspaceHardwareMarkers,
    annotationLabels,
    pieceGrainlineSegments,
    pieceNotchLines,
    piecePlacementGuides,
    lineTypeStylesById,
    printableShapes,
    layerColorsById,
    activeLineTypeStrokeColor,
    activeLineTypeDasharray,
    currentSnapshot,
    currentSnapshotSignature,
  } = derivedState

  // Detect closed outlines and open paths for canvas labels
  const outlineChains = useMemo<OutlineChain[]>(
    () => detectOutlines(workspaceEditableShapes, lineTypes),
    [workspaceEditableShapes, lineTypes],
  )

  const editorStateActions = useEditorStateActions({
    activeLayer,
    activeSketchGroup,
    activeLineType,
    clearDraft,
    setActiveLocalDocumentId,
    setDocumentName,
    setLayers,
    setActiveLayerId,
    setSketchGroups,
    setActiveSketchGroupId,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setConstraints,
    setPatternPieces,
    setPieceInterfaces,
    setAssemblyConnections,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setBackdrops,
    setActiveBackdropId,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setLeatherImageFills,
    setActiveLeatherImageFillId,
    setShowCanvasRuler,
    setShowDimensions,
    setLayerColorOverrides,
    setFrontLayerColor,
    setBackLayerColor,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setShowPrintAreas,
    setStatus,
  })
  const {
    applyEditorSnapshot,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
    resetDocument,
  } = editorStateActions

  const { applyLoadedDocument } = useLoadedDocumentActions({
    clearDraft,
    setDocumentName,
    setActiveLocalDocumentId,
    setLayers,
    setActiveLayerId,
    setSketchGroups,
    setActiveSketchGroupId,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setConstraints,
    setPatternPieces,
    setPieceInterfaces,
    setAssemblyConnections,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setBackdrops,
    setActiveBackdropId,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setLeatherImageFills,
    setActiveLeatherImageFillId,
    setShowCanvasRuler,
    setShowDimensions,
    setDimensionLines,
    setPrintAreas,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setViewport,
    svgRef,
    setTool,
    setShowPrintAreas,
    setStatus,
  })
  const { mergedCatalogRepository } = useEditorDocumentBootstrap({
    bundledCatalogRepository,
    catalogRepository,
    setSystemThemeMode,
    setActiveLocalDocumentId,
    applyLoadedDocument,
  })

  const previewElement = useCombinedDraftAndSnapElement({
    activeLineTypeStrokeColor,
    activeLineTypeDasharray,
  })

  const historyActions = useHistoryActions({
    currentSnapshot,
    applyEditorSnapshot,
  })
  const { handleUndo, handleRedo } = historyActions

  const selectionActions = useSelectionActions({
    selectedShapeIdSet,
    selectedHardwareMarkerId,
    shapes,
    stitchHoles,
    patternPieces,
    pieceGrainlines,
    pieceLabels,
    piecePlacementLabels,
    seamAllowances,
    pieceNotches,
    activeLayerId: activeLayer?.id ?? null,
    customRotationPivot,
    clipboardPayload,
    pasteCountRef,
    setClipboardPayload,
    setShapes,
    setStitchHoles,
    setPatternPieces,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setConstraints,
    setSketchGroups,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setHardwareMarkers,
    setStatus,
  })
  const {
    handleCopySelection,
    handleDeleteSelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleSelectAllShapes,
    handleRotateSelection,
    handleScaleSelection,
  } = selectionActions

  const transformActions = useTransformActions({
    shapes,
    selectedShapeIdSet,
    customRotationPivot,
    setShapes,
    setStitchHoles,
    setCustomRotationPivot,
    setCustomSnapPoint,
    setShowSpecifyRotationModal,
    setShowSpecifyScaleModal,
    setSpecifyScaleModalAxis,
    setStatus,
  })

  const selectedEditableShape =
    selectedShapeIds.length === 1 ? (shapesById[selectedShapeIds[0]] ?? null) : null
  const documentCommands = useEditorDocumentCommands({
    documentName,
    layers,
    activeLayerId,
    sketchGroups,
    activeSketchGroupId,
    lineTypes,
    activeLineTypeId,
    shapes,
    foldLines,
    stitchHoles,
    constraints,
    patternPieces,
    pieceInterfaces,
    assemblyConnections,
    pieceGrainlines,
    pieceLabels,
    piecePlacementLabels,
    piecePlacements3d,
    seamConnections,
    seamAllowances,
    pieceNotches,
    hardwareMarkers,
    snapSettings,
    showAnnotations,
    tracingOverlays,
    backdrops,
    projectMemo,
    stitchAlwaysShapeIds,
    stitchThreadColor,
    threePreviewSettings,
    avatars,
    threeTextureSource,
    threeTextureShapeIds,
    leatherImageFills,
    activeLeatherImageFillId,
    showCanvasRuler,
    showDimensions,
    dimensionLines,
    printAreas,
    selectedShapeIdSet,
    selectedEditableShape,
    selectedStitchHole,
    setShapes,
    setStitchHoles,
    setStitchAlwaysShapeIds,
    setExportOnlySelectedShapes,
    setExportOnlyVisibleLineTypes,
    setExportRoleFilters,
    setExportForceSolidStrokes,
    setExportStitchHoleRenderMode,
    setExportStitchDotRadiusMm,
    setDxfFlipY,
    setDxfVersion,
    setFoldLines,
    setStatus,
  })
  const {
    buildCurrentDocFile,
  } = documentCommands
  const templateActions = useTemplateActions({
    templateRepository,
    templateRepositoryFolders,
    selectedTemplateFolderId,
    catalogRepository,
    selectedTemplateEntry,
    selectedTemplateEntryId,
    selectedCatalogShopId,
    buildCurrentDocFile,
    applyLoadedDocument,
    layers,
    lineTypes,
    shapes,
    foldLines,
    stitchHoles,
    sketchGroups,
    selectedShapeIdSet,
    clearDraft,
    setTemplateRepository,
    setTemplateRepositoryFolders,
    setSelectedTemplateFolderId,
    setCatalogRepository,
    setSelectedTemplateEntryId,
    setSelectedCatalogShopId,
    setLayers,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setSketchGroups,
    setSelectedShapeIds,
    setActiveLayerId,
    setStatus,
  })
  const aiBuilderActions = useAiBuilderActions({
    applyLoadedDocument,
    layers,
    lineTypes,
    shapes,
    foldLines,
    stitchHoles,
    clearDraft,
    setLayers,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setPatternPieces,
    setSeamAllowances,
    setSeamConnections,
    setHardwareMarkers,
    setSelectedShapeIds,
    setActiveLayerId,
    setStatus,
  })

  useEffect(() => {
    if (!localDbHydrated) {
      return
    }
    saveCatalogRepository(catalogRepository)
  }, [catalogRepository, localDbHydrated])

  useEffect(() => {
    if (!localDbHydrated) {
      return
    }
    saveTemplateRepositoryFolders(templateRepositoryFolders)
  }, [localDbHydrated, templateRepositoryFolders])

  const tracingActions = useTracingActions({
    setTracingOverlays,
    setActiveTracingOverlayId,
    setShowTracingModal,
    setStatus,
  })

  const backdropActions = useBackdropActions({
    backdrops,
    setBackdrops,
    activeBackdropId,
    setActiveBackdropId,
    setStatus,
  })

  useResponsiveLayout({
    setIsMobileLayout,
    setMobileViewMode,
    setShowMobileMenu,
    setMobileOptionsTab,
    setTool,
  })

  useEditorConsistencyEffects({
    layers,
    activeLayerId,
    setActiveLayerId,
    sketchGroups,
    setSketchGroups,
    setActiveSketchGroupId,
    lineTypes,
    activeLineTypeId,
    setLineTypes,
    setActiveLineTypeId,
    shapes,
    setSelectedShapeIds,
    setPatternPieces,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setConstraints,
    setStitchHoles,
    stitchHoles,
    setSelectedStitchHoleId,
    hardwareMarkers,
    setSelectedHardwareMarkerId,
    setHardwareMarkers,
    setLayerColorOverrides,
    tracingOverlays,
    leatherImageFills,
    setLeatherImageFills,
    activeLeatherImageFillId,
    setActiveLeatherImageFillId,
    setThreeTextureShapeIds,
    setActiveTracingOverlayId,
    tracingObjectUrlsRef,
    templateRepository,
    localDbHydrated,
    setSelectedTemplateEntryId,
    currentSnapshot,
    currentSnapshotSignature,
  })

  useEditorGlobalShortcuts({
    handleDeleteSelection,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleSelectAllShapes,
    selectedShapeIdSet,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setShowCanvasRuler,
    setShowBezierOffsetLines,
    setShowGrid,
    setTracingOverlays,
    setActiveTool,
    handleRotateSelection,
    setShapes,
    setStatus,
  })

  useEditorAutomationEffects({
    shapes,
    autoConstraintSettings,
    constraintSuggestions,
    setConstraintSuggestions,
  })

  const canvasController = useEditorCanvasController({
    svgRef,
    panRef,
    viewport,
    activeLayerId,
    activeLineTypeId,
    activeSketchGroup,
    snapSettings,
    foldLines,
    displayShapes: workspaceShapes,
    snapShapes: workspaceShapes,
    customSnapPoint,
    reverseZoomDirection,
    incrementalSelection,
    lineToolConstraint,
    stitchTargetShapes: workspaceEditableShapes,
    visibleHardwareMarkers: workspaceHardwareMarkers,
    lineTypesById,
    shapesById,
    layers,
    stitchHoles,
    patternPieces,
    pieceNotches,
    seamConnections,
    hardwareMarkers,
    selectedShapeIds,
    selectedShapeIdSet,
    selectedStitchHoleId,
    selectedHardwareMarkerId,
    setViewport,
    setShapes,
    setStitchHoles,
    setSelectedStitchHoleId,
    setPieceNotches,
    setSeamConnections,
    setHardwareMarkers,
    setSelectedHardwareMarkerId,
    setFoldLines,
    setDimensionLines,
    setSelectedShapeIds,
    setActiveLineTypeId,
    setStatus,
    handleRotateSelection,
    handleScaleSelection,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
  })
  const exportActions = useExportActions({
    shapes: assemblyShapes,
    foldLines,
    stitchHoles,
    lineTypes,
    lineTypesById,
    patternPiecesById,
    lineTypeStylesById,
    sketchGroupsById,
    selectedShapeIdSet,
    visibleLayerIdSet,
    showAnnotations,
    annotationLabels,
    pieceGrainlineSegments,
    pieceNotchLines,
    piecePlacementGuides,
    stitchAlwaysShapeIdSet: new Set(stitchAlwaysShapeIds),
    exportUnit: displayUnit,
  })
  const { handleExportSvg, handleExportDxf, handleExportPdf } = exportActions

  const fileActions = useFileActions({
    buildCurrentDocFile,
    applyLoadedDocument,
    activeLocalDocumentId,
    setActiveLocalDocumentId,
    selectedPresetId,
    setSelectedPresetId,
    isMobileLayout,
    activeLayer,
    activeLineTypeId,
    activeSketchGroup,
    setShapes,
    setSketchGroups,
    setActiveSketchGroupId,
    setSelectedShapeIds,
    setStatus,
    setShowThreePreview,
    setMobileViewMode,
    setShowMobileMenu,
  })
  const { handleSaveJson, handleSaveLcc, handleLoadPreset } = fileActions

  useAutoSave({
    enabled: autoSaveEnabled,
    buildDoc: () => buildCurrentDocFile(),
    setStatus,
  })

  // Auto-load the demo project on first launch when the option is enabled
  // (source-app v2.0.7 default-on, toggleable in Options).
  const demoAutoLoadedRef = useRef(false)
  useEffect(() => {
    if (demoAutoLoadedRef.current) return
    if (!panelState.loadDemoOnStartup) return
    if (shapes.length > 0 || foldLines.length > 0 || stitchHoles.length > 0) return
    demoAutoLoadedRef.current = true
    void handleLoadPreset()
  }, [panelState.loadDemoOnStartup, shapes.length, foldLines.length, stitchHoles.length, handleLoadPreset])

  // Surface a one-shot status banner if a newer build is bundled (source v1.7.0).
  const versionCheckRanRef = useRef(false)
  useEffect(() => {
    if (versionCheckRanRef.current) return
    versionCheckRanRef.current = true
    const result = checkForNewerVersion()
    if (result.isOutdated) {
      setStatus(`A newer LeatherCad release is available (${result.latest}). You are running ${result.current}.`)
    }
  }, [setStatus])

  // Leather-sim ↔ stitch-sim coupling: when leather-sim turns on, auto-open the
  // stitch simulator (source-app v2.5.6 behavior).
  useEffect(() => {
    if (leatherSimEnabled && !showStitchSimulatorModal) {
      setShowStitchSimulatorModal(true)
    }
  }, [leatherSimEnabled, showStitchSimulatorModal, setShowStitchSimulatorModal])

  const layerActions = useLayerActions({
    activeLayer,
    layers,
    shapes,
    selectedShapeIdSet,
    setLayers,
    setActiveLayerId,
    setShapes,
    setSketchGroups,
    setHardwareMarkers,
    setConstraints,
    setSelectedShapeIds,
    setStatus,
  })
  const {
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
    handleShowAllLayers,
    handleHideOtherLayers,
    handleMergeActiveLayerIntoBelow,
    handleFlattenAllLayers,
  } = layerActions

  const lineTypeActions = useLineTypeActions({
    activeLineType,
    shapes,
    selectedShapeIdSet,
    setLineTypes,
    setShapes,
    setSelectedShapeIds,
    setStatus,
  })

  const leatherImageFillActions = useLeatherImageFillActions({
    leatherImageFills, activeLeatherImageFill: leatherImageFills.find((fill) => fill.id === activeLeatherImageFillId) ?? null,
    shapes, lineTypes, selectedShapeIdSet, setLeatherImageFills, setActiveLeatherImageFillId, setStatus,
  })

  const layerColorActions = useLayerColorActions({
    layerColorsById,
    setLayerColorOverrides,
    setFrontLayerColor,
    setBackLayerColor,
    setStatus,
  })

  const sketchGroupActions = useSketchGroupActions({
    activeLayer,
    activeSketchGroup,
    selectedShapeIdSet,
    sketchGroups,
    shapes,
    stitchHoles,
    patternPieces,
    pieceGrainlines,
    pieceLabels,
    piecePlacementLabels,
    seamAllowances,
    pieceNotches,
    hardwareMarkers,
    setSketchGroups,
    setShapes,
    setStitchHoles,
    setPatternPieces,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setSeamAllowances,
    setPieceNotches,
    setHardwareMarkers,
    setSelectedShapeIds,
    setActiveSketchGroupId,
    setLayers,
    setStatus,
  })
  const [stitchSimulatorSettings, setStitchSimulatorSettings] = useState<StitchSimulatorSettings>(() =>
    loadStitchSimulatorSettings(),
  )
  useEffect(() => {
    if (!leatherSimEnabled || stitchSimulatorSettings.showSimulatorPattern) {
      return
    }
    queueMicrotask(() => {
      setStitchSimulatorSettings((previous) => {
        if (previous.showSimulatorPattern) {
          return previous
        }
        const next = { ...previous, showSimulatorPattern: true }
        saveStitchSimulatorSettings(next)
        return next
      })
    })
  }, [leatherSimEnabled, stitchSimulatorSettings.showSimulatorPattern])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingContext = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT'
      if (isTypingContext || event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      if (event.key === 'F6') {
        event.preventDefault()
        setShowStitchSimulatorModal((previous) => !previous)
        setStitchSimulatorSettings((previous) => {
          const next = { ...previous, showSimulatorPattern: !previous.showSimulatorPattern }
          saveStitchSimulatorSettings(next)
          return next
        })
        setStatus('Toggled stitching simulator')
        return
      }
      if (event.key === '+' || event.key === '-') {
        event.preventDefault()
        const delta = event.key === '+' ? 0.1 : -0.1
        setStitchSimulatorSettings((previous) => {
          const next = {
            ...previous,
            threadWidthMm: Math.max(0.3, Math.min(2, Number((previous.threadWidthMm + delta).toFixed(2)))),
          }
          saveStitchSimulatorSettings(next)
          setStatus(`Thread width ${next.threadWidthMm.toFixed(1)} mm`)
          return next
        })
        return
      }
      if (event.key === '=') {
        event.preventDefault()
        setStitchSimulatorSettings((previous) => {
          const next =
            previous.showEvenStitches && previous.showOddStitches
              ? { ...previous, showOddStitches: false }
              : previous.showEvenStitches
                ? { ...previous, showEvenStitches: false, showOddStitches: true }
                : { ...previous, showEvenStitches: true, showOddStitches: true }
          saveStitchSimulatorSettings(next)
          setStatus(
            next.showEvenStitches && next.showOddStitches
              ? 'Showing even and odd stitches'
              : next.showEvenStitches
                ? 'Showing even stitches'
                : 'Showing odd stitches',
          )
          return next
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setShowStitchSimulatorModal, setStatus])
  const [boxStitchHelperSettings, setBoxStitchHelperSettings] = useState<BoxStitchHelperSettings>(() =>
    loadBoxStitchHelperSettings(),
  )
  const constraintActions = useConstraintActions({
    activeLayer,
    activeLayerId: activeLayer?.id ?? null,
    activeLineTypeId,
    stitchLineTypeId: STITCH_LINE_TYPE_ID,
    layers,
    shapes,
    stitchHoles,
    selectedShapeIds,
    selectedShapeIdSet,
    constraints,
    patternPieces,
    seamAllowances,
    snapSettings,
    boxStitchHelperSettings,
    setShapes,
    setStitchHoles,
    setSelectedShapeIds,
    setConstraints,
    setSeamAllowances,
  })
  const {
    preloadBoxStitchGeneration,
    applyBoxStitchToSelection,
  } = constraintActions

  const patternPieceSelection = usePatternPieceSelection({
    isPieceInspectorOpen: showPieceInspectorModal,
    tool,
    selectedShapeIds,
    shapesById,
    shapes,
    patternPieces,
    patternPiecesById,
    patternPieceByBoundaryShapeId,
    patternPieceChains,
    pieceGrainlines,
    pieceLabels,
    seamAllowances,
    seamConnections,
    pieceNotches,
    piecePlacementLabels,
    visibleLayerIdSet,
  })
  const {
    selectedPatternPiece,
    selectedPatternPieceEdgeCount,
  } = patternPieceSelection

  const patternPieceCommands = usePatternPieceCommands({
    isMobileLayout,
    selectedShapeIds,
    shapesById,
    patternPieces,
    patternPieceByBoundaryShapeId,
    patternPieceChainsByShapeId: patternPieceChains.byShapeId,
    selectedPatternPiece,
    selectedPatternPieceEdgeCount,
    pieceGrainlines,
    pieceLabels,
    seamAllowances,
    setPatternPieces,
    setPieceGrainlines,
    setPieceLabels,
    setSeamAllowances,
    setSeamConnections,
    setPieceNotches,
    setPiecePlacementLabels,
    setShowPieceInspectorModal,
    setActiveInspectorTab,
    setStatus,
  })
  const hardwareMarkerActions = useHardwareMarkerActions({
    selectedHardwareMarker,
    setHardwareMarkers,
    setSelectedHardwareMarkerId,
    setStatus,
  })
  const stitchActions = useStitchActions({
    selectedShapeIdSet,
    selectedStitchHoleCount,
    stitchHoles,
    setStitchHoles,
    setSelectedStitchHoleId,
    shapes,
    lineTypesById,
    selectedStitchHole,
    shapesById,
    layers,
    stitchHoleCountsByShape,
  })
  const geometryActions = useGeometryEditingActions({
    shapes,
    setShapes,
    selectedShapeIdSet,
    setSelectedShapeIds,
    activeLayerId,
    activeLineTypeId,
    setStatus,
    showBezierOffsetLines,
    setShowBezierOffsetLines,
  })
  const creationController = useEditorCreationController({
    shapes,
    setShapes,
    stitchHoles,
    setStitchHoles,
    selectedShapeIdSet,
    selectedStitchHole,
    activeLayerId,
    activeLineTypeId,
    textDraftValue,
    textFontFamily,
    textFontSizeMm,
    textTransformMode,
    textRadiusMm,
    textSweepDeg,
    showStitchSimulatorModal,
    stitchSimulatorSettings,
    setStitchSimulatorSettings,
    setBoxStitchHelperSettings,
    setShowBoxStitchModal,
    setShowBoxStitchHelperModal,
    setShowMandalaModal,
    setShowWizardModal,
    setShowLetterStampModal,
    setStatus,
    preloadBoxStitchGeneration,
    applyBoxStitchToSelection,
  })

  const mobileActions = useMobileActions({
    mobileLayerAction,
    mobileFileAction,
    fileInputRef,
    svgInputRef,
    tracingInputRef,
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
    handleShowAllLayers,
    handleHideOtherLayers,
    handleMergeActiveLayerIntoBelow,
    handleFlattenAllLayers,
    handleSaveJson,
    handleSaveLcc,
    handleLoadPreset,
    handleExportSvg,
    handleExportPdf,
    handleExportDxf,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handlePasteClipboard,
    handleDeleteSelection,
    resetDocument,
    setShowLayerColorModal,
    setShowExportOptionsModal,
    setShowTemplateRepositoryModal,
    setShowLocalProjectsModal,
    setShowPatternToolsModal,
    setShowPrintPreviewModal,
    setShowThreePreview,
  })
  const themeActions = useThemeActions({
    setThemeMode,
    setStatus,
  })
  const assetCommands = useEditorAssetCommands({
    loadedFontUrl,
    shapes,
    selectedShapeIds,
    selectedShapeIdSet,
    activeLayerId: activeLayer?.id ?? '',
    activeLineTypeId,
    setShapes,
    setSelectedShapeIds,
    setLoadedFontUrl,
    setStatus,
    fontInputRef,
  })

  const printPreviewState = usePrintPreviewState({
    lineTypes,
    activeLineTypeId,
    activeLayerId,
    showAnnotations,
    selectedShapeIdSet,
    patternPiecesById,
    annotationLabels,
    pieceGrainlineSegments,
    pieceNotchLines,
    piecePlacementGuides,
    printableShapes,
    stitchHoles,
    foldLines,
    lineTypesById,
  })
  const screenActions: EditorScreenShellActions = {
    editorStateActions, documentCommands, exportActions, fileActions, historyActions, selectionActions, transformActions,
    layerActions, lineTypeActions, leatherImageFillActions, layerColorActions, constraintActions, sketchGroupActions,
    patternPieceCommands, hardwareMarkerActions, stitchActions, geometryActions, creationController, mobileActions, themeActions,
  }

  const {
    mobileShell,
    desktopShell,
    pieceInspectorContentProps,
    shouldLoadThreeWorkbench,
  } = useEditorScreenShells({
    resolvedThemeMode,
    documentState,
    uiState,
    selectionState,
    repositoryState,
    panelState,
    layerState,
    toolState,
    viewportState,
    workbenchShellState,
    screenRefs,
    derivedState,
    canvasController,
    patternPieceSelection,
    printPreviewState,
    previewElement,
    outlineChains,
    selectedEditableShape,
    stitchSimulatorSettings,
    actions: screenActions,
  })

  const overlay = useEditorScreenOverlay({
    resolvedThemeMode,
    documentState,
    uiState,
    selectionState,
    repositoryState,
    panelState,
    layerState,
    toolState,
    viewportState,
    workbenchShellState,
    screenRefs,
    derivedState,
    canvasController,
    patternPieceSelection,
    printPreviewState,
    previewElement,
    outlineChains,
    selectedEditableShape,
    stitchSimulatorSettings,
    actions: screenActions,
    mergedCatalogRepository,
    setStitchSimulatorSettings,
    boxStitchHelperSettings,
    setBoxStitchHelperSettings,
    showPieceInspectorModal,
    setShowPieceInspectorModal,
    pieceInspectorContentProps,
    templateActions,
    aiBuilderActions,
    tracingActions,
    backdropActions,
    assetCommands,
  })

  return {
    layout: {
      isMobileLayout,
      resolvedThemeMode,
      shouldLoadThreeWorkbench,
    },
    mobileShell,
    desktopShell,
    overlay,
  }
}
