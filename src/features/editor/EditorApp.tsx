import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type {
  DocFile,
  Shape,
} from './cad/cad-types'
import { EditorCanvasPane } from './components/EditorCanvasPane'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EditorHiddenInputs } from './components/EditorHiddenInputs'
import { EditorModalStack } from './components/EditorModalStack'
import { PieceInspectorModal } from './components/PieceInspectorModal'
import { PieceInspectorContent } from './components/PieceInspectorContent'
import { EditorPreviewPane } from './components/EditorPreviewPane'
import { EditorStatusBar } from './components/EditorStatusBar'
import { EditorTopbar } from './components/EditorTopbar'
import { PrecisionCommandPanel } from './components/PrecisionCommandPanel'
const ProjectMemoModal = lazy(() =>
  import('./components/ProjectMemoModal').then((mod) => ({ default: mod.ProjectMemoModal })),
)
const NestingModal = lazy(() =>
  import('./components/NestingModal').then((mod) => ({ default: mod.NestingModal })),
)
import {
  STITCH_LINE_TYPE_ID,
} from './cad/line-types'
import {
  saveCatalogRepository,
} from './templates/catalog-repository'

import {
  DEFAULT_EXPORT_ROLE_FILTERS,
} from './editor-constants'
import { detectOutlines, type OutlineChain } from './ops/outline-detection'
import type {
  ResolvedThemeMode,
} from './editor-types'
import {
  toolLabel,
} from './editor-utils'
import { useEditorDerivedState } from './hooks/useEditorDerivedState'
import { useExportActions } from './hooks/useExportActions'
import { useLayerActions } from './hooks/useLayerActions'
import { useConstraintActions } from './hooks/useConstraintActions'
import { useStitchActions } from './hooks/useStitchActions'
import { useFileActions } from './hooks/useFileActions'
import { useTemplateActions } from './hooks/useTemplateActions'
import { useTracingActions } from './hooks/useTracingActions'
import { useMobileActions } from './hooks/useMobileActions'
import { useCanvasInteractions } from './hooks/useCanvasInteractions'
import { useResponsiveLayout } from './hooks/useResponsiveLayout'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useLineTypeActions } from './hooks/useLineTypeActions'
import { useLayerColorActions } from './hooks/useLayerColorActions'
import { useEditorConsistencyEffects } from './hooks/useEditorConsistencyEffects'
import { useDraftPreviewElement } from './hooks/useDraftCanvasElements'
import { useHardwareMarkerActions } from './hooks/useHardwareMarkerActions'
import { useEditorLayoutFlags } from './hooks/useEditorLayoutFlags'
import { useLoadedDocumentActions } from './hooks/useLoadedDocumentActions'
import { useEditorPreviewPaneProps } from './hooks/useEditorPreviewPaneProps'
import { useSketchGroupActions } from './hooks/useSketchGroupActions'
import { useHistoryActions } from './hooks/useHistoryActions'
import { useEditorStateActions } from './hooks/useEditorStateActions'
import { useEditorModalStackProps } from './hooks/useEditorModalStackProps'
import { useEditorStatusBarProps } from './hooks/useEditorStatusBarProps'
import { useEditorTopbarProps } from './hooks/useEditorTopbarProps'
import { useSelectionActions } from './hooks/useSelectionActions'
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
import {
  loadBoxStitchHelperSettings,
  type BoxStitchHelperSettings,
} from './ops/box-stitch-settings'
import {
  getTerminalStitchHoleIdForShape,
} from './ops/stitch-hole-ops'
import { DocumentInspectorPanel } from './workbench/DocumentInspectorPanel'
import { EditorWorkbench } from './workbench/EditorWorkbench'
import { SelectionInspectorPanel } from './workbench/SelectionInspectorPanel'
import { useWorkbenchShellState } from './workbench/useWorkbenchShellState'
import {
  WorkbenchThreePreviewInspector,
  WorkbenchThreePreviewViewport,
} from './workbench/WorkbenchThreePreview'
import { useWorkbenchThreePreviewController } from './workbench/useWorkbenchThreePreviewController'
import { usePatternPieceSelection } from './state/selectors/usePatternPieceSelection'
import { usePatternPieceCommands } from './controllers/usePatternPieceCommands'
import { usePrintPreviewState } from './state/selectors/usePrintPreviewState'
import { useEditorCanvasPaneProps } from './view-models/useEditorCanvasPaneProps'
import { EditorStateProviders } from './state/providers/EditorStateProviders'
import { useEditorCreationController } from './controllers/useEditorCreationController'
import { useEditorDocumentBootstrap } from './controllers/useEditorDocumentBootstrap'
import { useEditorWorkbenchController } from './controllers/useEditorWorkbenchController'

export function EditorApp() {
  return (
    <EditorStateProviders>
      <EditorAppContent />
    </EditorStateProviders>
  )
}

function EditorAppContent() {
  // Document state: shapes, constraints, layers, overlays, etc.
  const {
    documentName, setDocumentName,
    lineTypes, setLineTypes,
    activeLineTypeId, setActiveLineTypeId,
    shapes, setShapes,
    foldLines, setFoldLines,
    stitchHoles, setStitchHoles,
    sketchGroups, setSketchGroups,
    activeSketchGroupId, setActiveSketchGroupId,
    constraints, setConstraints,
    patternPieces, setPatternPieces,
    pieceGrainlines, setPieceGrainlines,
    pieceLabels, setPieceLabels,
    piecePlacementLabels, setPiecePlacementLabels,
    piecePlacements3d, setPiecePlacements3d,
    seamConnections, setSeamConnections,
    seamAllowances, setSeamAllowances,
    pieceNotches, setPieceNotches,
    hardwareMarkers, setHardwareMarkers,
    dimensionLines, setDimensionLines,
    printAreas, setPrintAreas,
    snapSettings, setSnapSettings,
    showAnnotations, setShowAnnotations,
    tracingOverlays, setTracingOverlays,
    activeTracingOverlayId, setActiveTracingOverlayId,
    projectMemo, setProjectMemo,
    stitchAlwaysShapeIds, setStitchAlwaysShapeIds,
    stitchThreadColor, setStitchThreadColor,
    threePreviewSettings, setThreePreviewSettings,
    avatars, setAvatars,
    threeTextureSource, setThreeTextureSource,
    threeTextureShapeIds, setThreeTextureShapeIds,
    showCanvasRuler, setShowCanvasRuler,
    showDimensions, setShowDimensions,
  } = useEditorDocumentState()

  // UI state: layout, modals, theme, display settings
  const {
    setStatus,
    showThreePreview, setShowThreePreview,
    isMobileLayout, setIsMobileLayout,
    mobileViewMode, setMobileViewMode,
    showMobileMenu, setShowMobileMenu,
    mobileOptionsTab, setMobileOptionsTab,
    showPrecisionModal, setShowPrecisionModal,
    showProjectMemoModal, setShowProjectMemoModal,
    showNestingModal, setShowNestingModal,
    desktopRibbonTab,
    workbenchRibbonTab, setWorkbenchRibbonTab,
    workspaceMode, setWorkspaceMode,
    secondaryPreviewMode, setSecondaryPreviewMode,
    mobileLayerAction,
    mobileFileAction,
    displayUnit, setDisplayUnit,
    gridSpacing, setGridSpacing,
    legendMode, setLegendMode,
    sketchWorkspaceMode, setSketchWorkspaceMode,
    selectedPresetId, setSelectedPresetId,
    themeMode, setThemeMode,
    systemThemeMode, setSystemThemeMode,
    loadedFontUrl, setLoadedFontUrl,
    constraintSuggestions, setConstraintSuggestions,
    autoConstraintSettings,
    showStitchSimulatorModal, setShowStitchSimulatorModal,
    showBoxStitchHelperModal, setShowBoxStitchHelperModal,
    showBoxStitchModal, setShowBoxStitchModal,
    showMandalaModal, setShowMandalaModal,
    showWizardModal, setShowWizardModal,
    showLetterStampModal, setShowLetterStampModal,
    showChangeShapeSizeModal, setShowChangeShapeSizeModal,
    showBezierOffsetLines, setShowBezierOffsetLines,
  } = useEditorUIState()

  // Selection state: selected shapes, stitch holes, hardware markers, clipboard
  const {
    selectedShapeIds, setSelectedShapeIds,
    selectedStitchHoleId, setSelectedStitchHoleId,
    selectedHardwareMarkerId, setSelectedHardwareMarkerId,
    clipboardPayload, setClipboardPayload,
  } = useEditorSelectionState()

  // Repository state: templates, catalogs
  const {
    templateRepository, setTemplateRepository,
    selectedTemplateEntryId, setSelectedTemplateEntryId,
    catalogRepository, setCatalogRepository,
    bundledCatalogRepository,
    selectedCatalogShopId, setSelectedCatalogShopId,
  } = useEditorRepositoryState()
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
    setShowAiBuilderModal,
    setShowHelpModal,
    setShowTemplateRepositoryModal,
    showPrintAreas,
    setShowPrintAreas,
    setShowPrintPreviewModal,
  } = useEditorPanelState()
  const {
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    frontLayerColor,
    setFrontLayerColor,
    backLayerColor,
    setBackLayerColor,
    layerColorOverrides,
    setLayerColorOverrides,
  } = useEditorLayers()

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
    showStitchSequenceLabels,
  } = useEditorTools()

  const {
    viewport,
    setViewport,
    workspaceRef,
  } = useEditorViewport({ isMobileLayout, showThreePreview })
  const {
    shellRef,
    showPeek,
    effectiveSecondaryPreviewMode,
    effectiveLayout,
    setActiveInspectorTab,
    handleBrowserResizeStart,
    handlePeekResizeStart,
    handleInspectorResizeStart,
    splitterWidth,
    toolRailWidth,
  } = useWorkbenchShellState({
    enabled: !isMobileLayout,
    secondaryPreviewMode,
  })

  const resolvedThemeMode: ResolvedThemeMode = themeMode === 'system' ? systemThemeMode : themeMode

  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const svgInputRef = useRef<HTMLInputElement | null>(null)
  const tracingInputRef = useRef<HTMLInputElement | null>(null)
  const templateImportInputRef = useRef<HTMLInputElement | null>(null)
  const catalogImportInputRef = useRef<HTMLInputElement | null>(null)
  const fontInputRef = useRef<HTMLInputElement | null>(null)
  const pasteCountRef = useRef(0)
  const tracingObjectUrlsRef = useRef<Set<string>>(new Set())
  const [showPieceInspectorModal, setShowPieceInspectorModal] = useState(false)
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number; pointerId: number } | null>(
    null,
  )
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
    shapeCountsByLineType,
    stitchHoleCountsByShape,
    selectedShapeCount,
    selectedStitchHoleCount,
    selectedStitchHole,
    selectedHardwareMarker,
    selectedTemplateEntry,
    canUndo,
    canRedo,
    assemblyShapes,
    visibleStitchHoles,
    visibleLayerIdSet,
    workspaceShapes,
    workspaceEditableShapes,
    workspaceLinkedShapes,
    workspaceStitchHoles,
    workspaceHardwareMarkers,
    seamGuides,
    annotationLabels,
    pieceGrainlineSegments,
    pieceNotchLines,
    piecePlacementGuides,
    lineTypeStylesById,
    printableShapes,
    activeExportRoleCount,
    layerColorsById,
    layerStackLevels,
    stackLegendEntries,
    displayLayerColorsById,
    fallbackLayerStroke,
    cutStrokeColor,
    stitchStrokeColor,
    foldStrokeColor,
    activeLineTypeStrokeColor,
    activeLineTypeDasharray,
    currentSnapshot,
    currentSnapshotSignature,
  } = useEditorDerivedState({
    templateRepository,
    selectedTemplateEntryId,
    themeMode: resolvedThemeMode,
  })

  // Detect closed outlines and open paths for canvas labels
  const outlineChains = useMemo<OutlineChain[]>(
    () => detectOutlines(workspaceEditableShapes, lineTypes),
    [workspaceEditableShapes, lineTypes],
  )

  const {
    applyEditorSnapshot,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
    resetDocument,
  } = useEditorStateActions({
    activeLayer,
    activeSketchGroup,
    activeLineType,
    clearDraft,
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
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
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

  const { applyLoadedDocument } = useLoadedDocumentActions({
    clearDraft,
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
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreePreviewSettings,
    setAvatars,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setShowCanvasRuler,
    setShowDimensions,
    setDimensionLines,
    setPrintAreas,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setTool,
    setShowPrintAreas,
    setStatus,
  })
  const { mergedCatalogRepository } = useEditorDocumentBootstrap({
    bundledCatalogRepository,
    catalogRepository,
    setSystemThemeMode,
    applyLoadedDocument,
  })

  const previewElement = useDraftPreviewElement({
    activeLineTypeStrokeColor,
    activeLineTypeDasharray,
  })

  const { handleUndo, handleRedo } = useHistoryActions({
    currentSnapshot,
    applyEditorSnapshot,
  })

  const {
    handleCopySelection,
    handleDeleteSelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleSelectAllShapes,
    handleGroupSelection,
    handleUngroupSelection,
    handleMoveSelectionByDistance,
    handleCopySelectionByDistance,
    handleRotateSelection,
    handleScaleSelection,
    handleMoveSelectionForward,
    handleMoveSelectionBackward,
    handleBringSelectionToFront,
    handleSendSelectionToBack,
  } = useSelectionActions({
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

  const handleEnableStitchOnSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    const selectedIds = Array.from(selectedShapeIdSet)
    setStitchAlwaysShapeIds((previous) => Array.from(new Set([...previous, ...selectedIds])))
    setStatus(`Enabled stitch simulator override for ${selectedIds.length} shape${selectedIds.length === 1 ? '' : 's'}`)
  }

  const handleDisableStitchOnSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    const selectedIds = selectedShapeIdSet
    setStitchAlwaysShapeIds((previous) => previous.filter((shapeId) => !selectedIds.has(shapeId)))
    setStatus('Disabled stitch simulator override on selected shapes')
  }

  const buildCurrentDocFile = (): DocFile => ({
    version: 1,
    units: 'mm',
    ...(documentName ? { documentName } : {}),
    layers,
    activeLayerId,
    sketchGroups,
    activeSketchGroupId,
    lineTypes,
    activeLineTypeId,
    objects: shapes,
    foldLines,
    stitchHoles,
    constraints,
    patternPieces,
    pieceGrainlines,
    pieceLabels,
    piecePlacementLabels,
    seamAllowances,
    pieceNotches,
    hardwareMarkers,
    snapSettings,
    showAnnotations,
    tracingOverlays,
    projectMemo,
    stitchAlwaysShapeIds: stitchAlwaysShapeIds.filter((shapeId) => shapes.some((shape) => shape.id === shapeId)),
    stitchThreadColor,
    piecePlacements3d: piecePlacements3d.filter((placement) => patternPieces.some((piece) => piece.id === placement.pieceId)),
    seamConnections: seamConnections.filter(
      (connection) =>
        patternPieces.some((piece) => piece.id === connection.from.pieceId) &&
        patternPieces.some((piece) => piece.id === connection.to.pieceId),
    ),
    threePreviewSettings,
    avatars,
    threeTextureSource,
    threeTextureShapeIds: threeTextureShapeIds.filter((shapeId) => shapes.some((shape) => shape.id === shapeId)),
    showCanvasRuler,
    showDimensions,
    dimensionLines,
    printAreas,
  })
  const {
    handleSaveTemplateToRepository,
    handleDeleteTemplateFromRepository,
    handleLoadTemplateAsDocument,
    handleInsertTemplateIntoDocument,
    handleExportTemplateRepository,
    handleImportTemplateRepositoryFile,
    handleImportCatalogFile,
    handleDeleteCatalogShop,
  } = useTemplateActions({
    templateRepository,
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
    clearDraft,
    setTemplateRepository,
    setCatalogRepository,
    setSelectedTemplateEntryId,
    setSelectedCatalogShopId,
    setLayers,
    setLineTypes,
    setActiveLineTypeId,
    setShapes,
    setFoldLines,
    setStitchHoles,
    setSelectedShapeIds,
    setActiveLayerId,
    setStatus,
  })
  const {
    handleLoadAiBuilderDocument,
    handleInsertAiBuilderDocument,
  } = useAiBuilderActions({
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
    setSelectedShapeIds,
    setActiveLayerId,
    setStatus,
  })

  useEffect(() => {
    saveCatalogRepository(catalogRepository)
  }, [catalogRepository])

  const {
    handleUpdateTracingOverlay,
    handleDeleteTracingOverlay,
    handleSetPdfTracingPage,
    handleImportTracing,
  } = useTracingActions({
    setTracingOverlays,
    setActiveTracingOverlayId,
    setShowTracingModal,
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
    setThreeTextureShapeIds,
    setActiveTracingOverlayId,
    tracingObjectUrlsRef,
    templateRepository,
    setSelectedTemplateEntryId,
    currentSnapshot,
    currentSnapshotSignature,
  })

  useKeyboardShortcuts({
    handleDeleteSelection,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleSelectAllShapes,
  })

  // Auto-constraint detection: run when shapes change
  const prevShapeCountRef = useRef(0)
  useEffect(() => {
    if (!autoConstraintSettings.enabled || shapes.length === 0) {
      if (constraintSuggestions.length > 0) setConstraintSuggestions([])
      prevShapeCountRef.current = shapes.length
      return
    }
    // Only detect when a shape was just added
    if (shapes.length > prevShapeCountRef.current && shapes.length > 1) {
      const newest = shapes[shapes.length - 1]
      const rest = shapes.slice(0, -1)
      void import('./ops/auto-constraint-ops')
        .then(({ detectAutoConstraints }) => {
          const suggestions = detectAutoConstraints(newest, rest, autoConstraintSettings)
          setConstraintSuggestions(suggestions)
        })
        .catch(() => {
          setConstraintSuggestions([])
        })
    } else if (shapes.length < prevShapeCountRef.current) {
      // Shapes were removed, clear suggestions
      setConstraintSuggestions([])
    }
    prevShapeCountRef.current = shapes.length
  }, [shapes, autoConstraintSettings]) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    handleZoomStep,
    handleResetView,
    handleFitView,
    handlePointerDown,
    handleShapePointerDown,
    handleShapeHandlePointerDown,
    handleStitchHolePointerDown,
    handleHardwarePointerDown,
    handlePointerMove,
    handlePointerUp,
    interactionPreview,
    runPrecisionCommand,
    toolHint,
  } = useCanvasInteractions({
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
    setSelectedShapeIds,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
  })
  const { handleExportSvg, handleExportDxf, handleExportPdf, handleExportLaserSvg } = useExportActions({
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

  const {
    handleSaveJson,
    handleSaveLcc,
    handleExportGarmentJson,
    handleLoadJson,
    handleImportSvg,
    handleLoadPreset,
    handleOpenInNewTab,
  } = useFileActions({
    buildCurrentDocFile,
    applyLoadedDocument,
    selectedPresetId,
    setSelectedPresetId,
    isMobileLayout,
    activeLayer,
    activeLineTypeId,
    activeSketchGroup,
    setShapes,
    setSelectedShapeIds,
    setStatus,
    setShowThreePreview,
    setMobileViewMode,
    setShowMobileMenu,
  })
  const {
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
  } = useLayerActions({
    activeLayer,
    layers,
    setLayers,
    setActiveLayerId,
    setShapes,
    setSketchGroups,
    setHardwareMarkers,
    setConstraints,
    setStatus,
  })

  const {
    handleToggleActiveLineTypeVisibility,
    handleShowAllLineTypes,
    handleIsolateActiveLineType,
    handleUpdateActiveLineTypeRole,
    handleUpdateActiveLineTypeStyle,
    handleUpdateActiveLineTypeColor,
    handleSelectShapesByActiveLineType,
    handleAssignSelectedToActiveLineType,
    handleClearShapeSelection,
  } = useLineTypeActions({
    activeLineType,
    shapes,
    selectedShapeIdSet,
    setLineTypes,
    setShapes,
    setSelectedShapeIds,
    setStatus,
  })

  const {
    handleSetLayerColorOverride,
    handleClearLayerColorOverride,
    handleResetLayerColors,
  } = useLayerColorActions({
    layerColorsById,
    setLayerColorOverrides,
    setFrontLayerColor,
    setBackLayerColor,
    setStatus,
  })

  const {
    handleCreateSketchGroupFromSelection,
    handleCreateLinkedSketchGroup,
    handleRenameActiveSketchGroup,
    handleToggleActiveSketchGroupVisibility,
    handleToggleActiveSketchGroupLock,
    handleSetActiveSketchLink,
    handleClearActiveSketchLink,
    handleClearActiveSketchGroup,
    handleDeleteActiveSketchGroup,
    handleDuplicateActiveSketchGroup,
    handleSetActiveLayerAnnotation,
    handleSetActiveSketchAnnotation,
  } = useSketchGroupActions({
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
  const [boxStitchHelperSettings, setBoxStitchHelperSettings] = useState<BoxStitchHelperSettings>(() =>
    loadBoxStitchHelperSettings(),
  )
  const {
    handleAddEdgeConstraintFromSelection,
    handleAddAlignConstraintsFromSelection,
    handleApplyConstraints,
    handleAlignSelection,
    handleAlignSelectionToGrid,
    handleApplySeamAllowanceToSelection,
    handleClearSeamAllowanceOnSelection,
    handleClearAllSeamAllowances,
    handleToggleConstraintEnabled,
    handleDeleteConstraint,
    handleBevelSelectedCorner,
    handleRoundSelectedCorner,
    handleCreateOffsetGeometryFromSelection,
    preloadBoxStitchGeneration,
    applyBoxStitchToSelection,
  } = useConstraintActions({
    activeLayer,
    activeLayerId: activeLayer?.id ?? null,
    activeLineTypeId,
    stitchLineTypeId: STITCH_LINE_TYPE_ID,
    layers,
    shapes,
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

  const selectedEditableShape =
    selectedShapeIds.length === 1 ? (shapesById[selectedShapeIds[0]] ?? null) : null
  const {
    selectedShapes,
    selectionBounds,
    selectedPatternPiece,
    selectedPieceGrainline,
    selectedPieceLabel,
    selectedPatternLabel,
    selectedPieceSeamAllowance,
    selectedPieceSeamConnections,
    selectedPieceNotches,
    selectedPiecePlacementLabels,
    selectedPieceInternalShapeIdSet,
    selectedPatternPieceEdgeCount,
    pieceEdgeLabels,
    selectedPieceAvailableInternalShapes,
  } = usePatternPieceSelection({
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
    ensurePatternPieceSupportRecords,
    openSelectedPatternPieceInspector,
    handleCreatePatternPieceFromSelection,
    handleUpdateSelectedPatternPiece,
    handleToggleSelectedPieceInternalShape,
    updateSelectedLabel,
    handleUpdateSelectedPieceGrainline,
    handleUpdateSelectedPieceSeamAllowance,
    handleUpdateSelectedPieceSeamConnection,
    handleUpdateSelectedPieceNotch,
    handleAddSelectedPiecePlacementLabel,
    handleUpdateSelectedPiecePlacementLabel,
    handleDeleteSelectedPiecePlacementLabel,
  } = usePatternPieceCommands({
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

  const handleUpdateSelectedShapePoint = (
    pointKey: 'start' | 'mid' | 'control' | 'end',
    axis: 'x' | 'y',
    value: number,
  ) => {
    const targetShapeId = selectedEditableShape?.id
    if (!targetShapeId || !Number.isFinite(value)) {
      return
    }

    setShapes((previous) =>
      previous.map((shape) => {
        if (shape.id !== targetShapeId) {
          return shape
        }

        if ((shape.type === 'line' || shape.type === 'text') && (pointKey === 'start' || pointKey === 'end')) {
          return {
            ...shape,
            [pointKey]: {
              ...shape[pointKey],
              [axis]: value,
            },
          }
        }

        if (shape.type === 'arc' && (pointKey === 'start' || pointKey === 'mid' || pointKey === 'end')) {
          return {
            ...shape,
            [pointKey]: {
              ...shape[pointKey],
              [axis]: value,
            },
          }
        }

        if (shape.type === 'bezier' && (pointKey === 'start' || pointKey === 'control' || pointKey === 'end')) {
          return {
            ...shape,
            [pointKey]: {
              ...shape[pointKey],
              [axis]: value,
            },
          }
        }

        return shape
      }),
    )
  }

  const handleUpdateSelectedStitchHole = (patch: Partial<(typeof stitchHoles)[number]>) => {
    if (!selectedStitchHole) {
      return
    }
    setStitchHoles((previous) =>
      previous.map((entry) =>
        entry.id === selectedStitchHole.id
          ? {
              ...entry,
              ...patch,
              sequence:
                typeof patch.sequence === 'number'
                  ? Math.max(1, Math.round(patch.sequence))
                  : entry.sequence,
              diameterMm:
                typeof patch.diameterMm === 'number'
                  ? Math.max(0, patch.diameterMm)
                  : entry.diameterMm,
              widthMm:
                typeof patch.widthMm === 'number'
                  ? Math.max(0, patch.widthMm)
                  : entry.widthMm,
              heightMm:
                typeof patch.heightMm === 'number'
                  ? Math.max(0, patch.heightMm)
                  : entry.heightMm,
              tiltDeg:
                typeof patch.tiltDeg === 'number'
                  ? Math.max(-89, Math.min(89, patch.tiltDeg))
                  : entry.tiltDeg,
              inverted:
                typeof patch.inverted === 'boolean'
                  ? patch.inverted
                  : entry.inverted,
            }
          : entry,
      ),
    )
  }

  const { handleDeleteSelectedHardwareMarker, handleUpdateSelectedHardwareMarker } = useHardwareMarkerActions({
    selectedHardwareMarker,
    setHardwareMarkers,
    setSelectedHardwareMarkerId,
    setStatus,
  })
  const {
    handleCountStitchHolesOnSelectedShapes,
    handleDeleteStitchHolesOnSelectedShapes,
    handleClearAllStitchHoles,
    handleAutoPlacePreferredPitchStitchHoles,
    handleAutoPlaceFixedPitchStitchHoles,
    handleAutoPlaceVariablePitchStitchHoles,
    handleResequenceSelectedStitchHoles,
    handleSelectNextStitchHole,
    handleFixStitchHoleOrderFromSelected,
  } = useStitchActions({
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

  const {
    handleConvertArcToBezier,
    handleMakeBezierCpSymmetric,
    handleExtendOrTrimLines,
    handleMirrorShapes,
    handleToggleBezierOffsetLines,
    handleResizeShapes,
  } = useGeometryEditingActions({
    shapes,
    setShapes,
    selectedShapeIdSet,
    setStatus,
    showBezierOffsetLines,
    setShowBezierOffsetLines,
  })
  const {
    stitchSimulatorResult,
    handleMarkSelectedStitchHoleAsEnd,
    handleClearSelectedStitchHoleEnd,
    handleExtractSelectedBoxStitchSources,
    handleClearSelectedBoxStitchSources,
    handleApplyTextDefaultsToSelection,
    handleGenerateBoxStitch,
    handleOpenBoxStitchHelperModal,
    handleApplyBoxStitchHelper,
    handleGenerateMandalaRadial,
    handleGenerateSpiral,
    handleGenerateGoldenGuides,
    handleGenerateWizardPattern,
    handleGenerateLetterStamp,
  } = useEditorCreationController({
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

  const { handleRunMobileLayerAction, handleRunMobileFileAction } = useMobileActions({
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
    setShowPatternToolsModal,
    setShowPrintPreviewModal,
    setShowThreePreview,
  })

  const { handleSetThemeMode } = useThemeActions({
    setThemeMode,
    setStatus,
  })

  const handleResetExportOptions = () => {
    setExportOnlySelectedShapes(false)
    setExportOnlyVisibleLineTypes(true)
    setExportRoleFilters({ ...DEFAULT_EXPORT_ROLE_FILTERS })
    setExportForceSolidStrokes(false)
    setExportStitchHoleRenderMode('native')
    setExportStitchDotRadiusMm(0.6)
    setDxfFlipY(false)
    setDxfVersion('r12')
  }

  const {
    printOutputPlan,
    handleOpenPrintTiles,
  } = usePrintPreviewState({
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
    foldLines,
    lineTypesById,
  })

  const {
    workspaceClassName,
    topbarClassName,
    hideCanvasPane,
    hidePreviewPane,
    showToolSection,
    showZoomSection,
    showEditSection,
    showLineTypeSection,
    showStitchSection,
    showLayerSection,
    showFileSection,
    showLayerLegend,
  } = useEditorLayoutFlags({
    isMobileLayout,
    mobileViewMode,
    showThreePreview,
    showMobileMenu,
    mobileOptionsTab,
    desktopRibbonTab,
  })
  const topbarProps = useEditorTopbarProps({
    topbarClassName,
    selectedShapeCount,
    selectedStitchHoleCount,
    showToolSection,
    handleLoadPreset,
    handleSetThemeMode,
    showZoomSection,
    showEditSection,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    canPaste: true,
    handleSelectAllShapes,
    handleDuplicateSelection,
    handleDeleteSelection,
    handleGroupSelection,
    handleUngroupSelection,
    handleMoveSelectionByDistance,
    handleCopySelectionByDistance,
    handleRotateSelection,
    handleScaleSelection,
    handleEnableStitchOnSelection,
    handleDisableStitchOnSelection,
    handleMoveSelectionBackward,
    handleMoveSelectionForward,
    handleSendSelectionToBack,
    handleBringSelectionToFront,
    showLineTypeSection,
    handleToggleActiveLineTypeVisibility,
    showStitchSection,
    handleAutoPlacePreferredPitchStitchHoles,
    handleAutoPlaceFixedPitchStitchHoles,
    handleAutoPlaceVariablePitchStitchHoles,
    handleResequenceSelectedStitchHoles,
    handleSelectNextStitchHole,
    handleFixStitchHoleOrderFromSelected,
    handleCountStitchHolesOnSelectedShapes,
    handleDeleteStitchHolesOnSelectedShapes,
    handleClearAllStitchHoles,
    stitchHolesLength: stitchHoles.length,
    hasSelectedStitchHole: selectedStitchHole !== null,
    showLayerSection,
    activeLayer,
    layerStackLevels,
    handleRunMobileLayerAction,
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
    setShowLayerColorModal,
    showFileSection,
    handleRunMobileFileAction,
    handleSaveJson,
    fileInputRef,
    svgInputRef,
    tracingInputRef,
    handleExportSvg,
    handleExportPdf,
    handleExportDxf,
    handleExportLaserSvg,
    handleOpenInNewTab,
    resetDocument,
  })
  const modalStackProps = useEditorModalStackProps({
    shapeCountsByLineType,
    selectedShapeCount,
    handleShowAllLineTypes,
    handleIsolateActiveLineType,
    handleUpdateActiveLineTypeRole,
    handleUpdateActiveLineTypeStyle,
    handleUpdateActiveLineTypeColor,
    handleSelectShapesByActiveLineType,
    handleAssignSelectedToActiveLineType,
    handleClearShapeSelection,
    layerColorsById,
    handleSetLayerColorOverride,
    handleClearLayerColorOverride,
    handleResetLayerColors,
    handleSaveJson,
    handleExportGarmentJson,
    handleSaveLcc,
    handleExportSvg,
    handleExportPdf,
    handleExportDxf,
    handleExportLaserSvg,
    activeExportRoleCount,
    handleResetExportOptions,
    templateRepository,
    catalogRepository: mergedCatalogRepository,
    selectedTemplateEntryId,
    selectedTemplateEntry,
    selectedCatalogShopId,
    setSelectedTemplateEntryId,
    setSelectedCatalogShopId,
    handleSaveTemplateToRepository,
    handleExportTemplateRepository,
    templateImportInputRef,
    catalogImportInputRef,
    handleLoadPreset,
    handleLoadTemplateAsDocument,
    handleInsertTemplateIntoDocument,
    handleDeleteTemplateFromRepository,
    handleDeleteCatalogShop,
    handleAlignSelection,
    handleAlignSelectionToGrid,
    activeLayer,
    handleCreateSketchGroupFromSelection,
    handleCreateLinkedSketchGroup,
    handleDuplicateActiveSketchGroup,
    handleRenameActiveSketchGroup,
    handleToggleActiveSketchGroupVisibility,
    handleToggleActiveSketchGroupLock,
    handleSetActiveSketchLink,
    handleClearActiveSketchLink,
    handleClearActiveSketchGroup,
    handleDeleteActiveSketchGroup,
    handleSetActiveLayerAnnotation,
    handleSetActiveSketchAnnotation,
    handleAddEdgeConstraintFromSelection,
    handleAddAlignConstraintsFromSelection,
    handleApplyConstraints,
    handleToggleConstraintEnabled,
    handleDeleteConstraint,
    handleApplySeamAllowanceToSelection,
    handleClearSeamAllowanceOnSelection,
    handleClearAllSeamAllowances,
    handleBevelSelectedCorner,
    handleRoundSelectedCorner,
    handleCreateOffsetGeometryFromSelection,
    handleCreateBoxStitchFromSelection: handleOpenBoxStitchHelperModal,
    selectedEditableShape,
    handleUpdateSelectedShapePoint,
    handleApplyTextDefaultsToSelection,
    selectedHardwareMarker,
    handleUpdateSelectedHardwareMarker,
    handleDeleteSelectedHardwareMarker,
    handleBooleanOp: (op: import('./ops/clipper-ops').BooleanOp) => {
      void import('./ops/clipper-ops')
        .then(({ booleanOpOnShapes }) => {
          const result = booleanOpOnShapes(
            shapes,
            new Set(selectedShapeIds),
            op,
            activeLayer?.id ?? '',
            activeLineTypeId,
          )
          if (result.ok) {
            setShapes(result.nextShapes)
          }
          setStatus(result.message)
        })
        .catch(() => {
          setStatus('Boolean operation tools failed to load')
        })
    },
    handleClipperOffset: (offsetMm: number, joinType: import('./ops/clipper-ops').OffsetJoinType) => {
      void import('./ops/clipper-ops')
        .then(({ clipperOffsetForSelection }) => {
          const result = clipperOffsetForSelection(
            shapes,
            new Set(selectedShapeIds),
            offsetMm,
            joinType,
            activeLineTypeId,
          )
          if (result.ok) {
            setShapes((prev) => [...prev, ...result.created])
          }
          setStatus(result.message)
        })
        .catch(() => {
          setStatus('Offset tools failed to load')
        })
    },
    handleTextToPath: () => {
      if (!loadedFontUrl) {
        fontInputRef.current?.click()
        setStatus('Select a .ttf/.otf font file to enable text-to-path conversion')
        return
      }
      const textShapes = shapes.filter((s) => s.type === 'text' && selectedShapeIdSet.has(s.id))
      if (textShapes.length === 0) {
        setStatus('Select at least one text shape to convert')
        return
      }
      void import('./ops/opentype-ops')
        .then(({ textToPathShapes }) => {
          const created: Shape[] = []
          const convertedIds = new Set<string>()
          for (const ts of textShapes) {
            if (ts.type !== 'text') continue
            const result = textToPathShapes(ts, loadedFontUrl)
            if (result.ok) {
              created.push(...result.shapes)
              convertedIds.add(ts.id)
            }
          }
          if (created.length > 0) {
            setShapes((prev) => [...prev.filter((s) => !convertedIds.has(s.id)), ...created])
            setSelectedShapeIds([])
            setStatus(`Converted ${convertedIds.size} text shape(s) to ${created.length} path shapes`)
          } else {
            setStatus('No paths generated. Ensure font is loaded and text shapes are selected.')
          }
        })
        .catch(() => {
          setStatus('Text-to-path tools failed to load')
        })
    },
    handleOpenNesting: () => {
      setShowNestingModal(true)
    },
    tracingInputRef,
    handleDeleteTracingOverlay,
    handleUpdateTracingOverlay,
    handleSetPdfTracingPage,
    printPlan: printOutputPlan,
    handleFitView,
    handleOpenPrintTiles,
    handleLoadAiBuilderDocument,
    handleInsertAiBuilderDocument,
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
    onOpenLayerColorModal: () => setShowLayerColorModal(true),
  })
  const statusBarProps = useEditorStatusBarProps({
    toolLabel: toolLabel(tool),
    zoomPercent: Math.round(viewport.scale * 100),
    visibleShapeCount: workspaceShapes.length,
    layerCount: layers.length,
    templateCount: templateRepository.length,
  })
  const {
    selectionContext,
    browserNodes,
    quickActions,
    ribbonGroups,
    docLabel,
    selectionText,
    handleWorkbenchQuickAction,
    handleWorkbenchRibbonCommand,
    handleWorkbenchActivateNode,
    handleToggleLayerVisibilityById,
    handleToggleLayerLockById,
    handleToggleTracingVisibilityById,
    handleToggleTracingLockById,
    handleToggleWorkbenchPeek,
    handleSetWorkbenchMode,
  } = useEditorWorkbenchController({
    documentName,
    patternPieces,
    patternPiecesById,
    pieceLabels,
    seamAllowances,
    pieceNotches,
    piecePlacementLabels,
    seamConnections,
    layers,
    activeLayerId,
    sketchGroups,
    activeSketchGroupId,
    tracingOverlays,
    activeTracingOverlayId,
    avatars,
    threeTextureSource,
    selectedShapes,
    selectedPatternPiece,
    selectedStitchHole,
    selectedHardwareMarker,
    selectedShapeCount,
    selectedShapeIdSet,
    canUndo,
    canRedo,
    workbenchRibbonTab,
    setActiveInspectorTab,
    isMobileLayout,
    workspaceMode,
    handleSaveJson,
    handleUndo,
    handleRedo,
    setShowHelpModal,
    handleFitView,
    handleResetView,
    setShowCanvasRuler,
    setShowDimensions,
    handleLoadPreset,
    setShowAnnotations,
    handleCopySelection,
    handlePasteClipboard,
    handleDeleteSelection,
    handleMoveSelectionByDistance,
    handleRotateSelection,
    handleScaleSelection,
    handleCreatePatternPieceFromSelection,
    openSelectedPatternPieceInspector,
    handleApplySeamAllowanceToSelection,
    setShowNestingModal,
    handleAutoPlaceFixedPitchStitchHoles,
    handleAutoPlaceVariablePitchStitchHoles,
    handleCountStitchHolesOnSelectedShapes,
    handleResequenceSelectedStitchHoles,
    handleSelectNextStitchHole,
    handleClearAllStitchHoles,
    fileInputRef,
    svgInputRef,
    handleExportSvg,
    handleExportPdf,
    handleExportDxf,
    setShowPrintPreviewModal,
    setShowTemplateRepositoryModal,
    setShowTracingModal,
    setShowAiBuilderModal,
    handleConvertArcToBezier,
    handleExtendOrTrimLines,
    handleMirrorShapes,
    handleMakeBezierCpSymmetric,
    handleToggleBezierOffsetLines,
    setShowChangeShapeSizeModal,
    setShowStitchSimulatorModal,
    setShowBoxStitchHelperModal,
    setShowBoxStitchModal,
    setShowWizardModal,
    setShowMandalaModal,
    setShowLetterStampModal,
    ensurePatternPieceSupportRecords,
    setSelectedShapeIds,
    setActiveLayerId,
    clearDraft,
    setActiveSketchGroupId,
    setActiveTracingOverlayId,
    setLayers,
    setTracingOverlays,
    setSecondaryPreviewMode,
    setWorkspaceMode,
  })
  const threePreviewController = useWorkbenchThreePreviewController({
    shapes: sketchWorkspaceMode === 'assembly' ? assemblyShapes : workspaceShapes,
    selectedShapeIds,
    stitchHoles: sketchWorkspaceMode === 'assembly' ? visibleStitchHoles : workspaceStitchHoles,
    stitchThreadColor,
    onSetStitchThreadColor: setStitchThreadColor,
    patternPieces,
    piecePlacements3d,
    seamConnections,
    threePreviewSettings,
    avatars,
    onSetPiecePlacements3d: setPiecePlacements3d,
    onSetThreePreviewSettings: setThreePreviewSettings,
    onSetAvatars: setAvatars,
    threeTextureSource,
    onSetThreeTextureSource: setThreeTextureSource,
    threeTextureShapeIds,
    onSetThreeTextureShapeIds: setThreeTextureShapeIds,
    foldLines,
    layers,
    lineTypes,
    themeMode: resolvedThemeMode,
    onUpdateFoldLine: (foldLineId, updates) =>
      setFoldLines((previous) =>
        previous.map((foldLine) =>
          foldLine.id === foldLineId
            ? {
                ...foldLine,
                ...updates,
              }
            : foldLine,
        ),
      ),
  })

  const canvasPaneProps = useEditorCanvasPaneProps({
    hideCanvasPane: false,
    svgRef,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    viewport,
    displayUnit,
    gridSpacing,
    showCanvasRuler,
    showDimensions,
    onZoomOut: () => handleZoomStep(0.85),
    onZoomIn: () => handleZoomStep(1.15),
    onFitView: handleFitView,
    onResetView: handleResetView,
    tracingOverlays,
    showPrintAreas,
    dimensionLines,
    printPlan: printOutputPlan,
    seamGuides,
    pieceEdgeLabels,
    showAnnotations,
    pieceGrainlineSegments,
    pieceNotchLines,
    piecePlacementGuides,
    visibleShapes: workspaceEditableShapes,
    linkedShapes: workspaceLinkedShapes,
    sketchWorkspaceMode,
    lineTypes,
    lineTypesById,
    selectedShapeIdSet,
    stitchStrokeColor,
    foldStrokeColor,
    cutStrokeColor,
    displayLayerColorsById,
    onShapePointerDown: handleShapePointerDown,
    onShapeHandlePointerDown: handleShapeHandlePointerDown,
    showShapeHandles: tool === 'pan',
    visibleStitchHoles: workspaceStitchHoles,
    selectedStitchHoleId,
    showStitchSequenceLabels,
    onStitchHolePointerDown: handleStitchHolePointerDown,
    simulatedStitchSegments:
      stitchSimulatorSettings.showSimulatorPattern ? stitchSimulatorResult?.segments ?? [] : [],
    stitchSimulatorSettings,
    stitchSimulatorTerminalHoleId: stitchSimulatorResult?.terminalHoleId ?? null,
    visibleHardwareMarkers: workspaceHardwareMarkers,
    selectedHardwareMarkerId,
    onHardwarePointerDown: handleHardwarePointerDown,
    foldLines,
    annotationLabels,
    constraintSuggestions,
    previewElement,
    interactionPreview,
    showLayerLegend,
    legendMode,
    onSetLegendMode: setLegendMode,
    layers,
    layerColorsById,
    fallbackLayerStroke,
    stackLegendEntries,
    outlineChains,
  })

  const workbenchTwoDPane = (
    <ErrorBoundary>
      <EditorCanvasPane {...canvasPaneProps} />
    </ErrorBoundary>
  )

  const workbenchThreeDPane = (
    <ErrorBoundary>
      <WorkbenchThreePreviewViewport
        controller={threePreviewController}
        compact={workspaceMode !== '3d'}
        interactive={workspaceMode === '3d'}
      />
    </ErrorBoundary>
  )

  const workbenchInspectContent = (
    <SelectionInspectorPanel
      context={selectionContext}
      selectedShapeCount={selectedShapeCount}
      selectedEditableShape={selectedEditableShape}
      selectedStitchHole={selectedStitchHole}
      selectedHardwareMarker={selectedHardwareMarker}
      shapeCount={shapes.length}
      layerCount={layers.length}
      onAlignX={() => handleAlignSelection('x')}
      onAlignY={() => handleAlignSelection('y')}
      onAlignBoth={() => handleAlignSelection('both')}
      onAlignToGrid={handleAlignSelectionToGrid}
      onCreateOffset={handleCreateOffsetGeometryFromSelection}
      onCreateBoxStitch={handleOpenBoxStitchHelperModal}
      onBevelCorner={handleBevelSelectedCorner}
      onRoundCorner={handleRoundSelectedCorner}
      onAddEdgeConstraint={handleAddEdgeConstraintFromSelection}
      onAddAlignConstraints={handleAddAlignConstraintsFromSelection}
      onApplyConstraints={handleApplyConstraints}
      onCreatePatternPiece={handleCreatePatternPieceFromSelection}
      onOpenPieceTab={openSelectedPatternPieceInspector}
      canOpenPieceTab={selectedPatternPiece !== null}
      onApplySeamAllowance={handleApplySeamAllowanceToSelection}
      onClearSeamAllowance={handleClearSeamAllowanceOnSelection}
      onApplyTextDefaults={handleApplyTextDefaultsToSelection}
      onExtractBoxStitchSource={handleExtractSelectedBoxStitchSources}
      onClearBoxStitchSource={handleClearSelectedBoxStitchSources}
      onUpdateSelectedShapePoint={handleUpdateSelectedShapePoint}
      onUpdateSelectedStitchHole={handleUpdateSelectedStitchHole}
      onMarkSelectedStitchHoleAsEnd={handleMarkSelectedStitchHoleAsEnd}
      onClearSelectedStitchHoleEnd={handleClearSelectedStitchHoleEnd}
      onUpdateSelectedHardwareMarker={handleUpdateSelectedHardwareMarker}
      onDeleteSelectedHardwareMarker={handleDeleteSelectedHardwareMarker}
    />
  )

  const workbenchPieceContent = (
    <PieceInspectorContent
      piece={selectedPatternPiece}
      grainline={selectedPieceGrainline}
      pieceLabel={selectedPieceLabel}
      patternLabel={selectedPatternLabel}
      seamAllowance={selectedPieceSeamAllowance}
      seamConnections={selectedPieceSeamConnections}
      notches={selectedPieceNotches}
      placementLabels={selectedPiecePlacementLabels}
      edgeCount={selectedPatternPieceEdgeCount}
      availableInternalShapes={selectedPieceAvailableInternalShapes}
      selectedInternalShapeIds={selectedPieceInternalShapeIdSet}
      onUpdatePiece={handleUpdateSelectedPatternPiece}
      onToggleInternalShape={handleToggleSelectedPieceInternalShape}
      onUpdateGrainline={handleUpdateSelectedPieceGrainline}
      onUpdatePieceLabel={(patch) => updateSelectedLabel('piece', patch)}
      onUpdatePatternLabel={(patch) => updateSelectedLabel('pattern', patch)}
      onUpdateSeamAllowance={handleUpdateSelectedPieceSeamAllowance}
      onUpdateSeamConnection={handleUpdateSelectedPieceSeamConnection}
      onDeleteSeamConnection={(connectionId) =>
        setSeamConnections((previous) => previous.filter((entry) => entry.id !== connectionId))
      }
      onUpdateNotch={handleUpdateSelectedPieceNotch}
      onDeleteNotch={(notchId) => setPieceNotches((previous) => previous.filter((entry) => entry.id !== notchId))}
      onAddPlacementLabel={handleAddSelectedPiecePlacementLabel}
      onUpdatePlacementLabel={handleUpdateSelectedPiecePlacementLabel}
      onDeletePlacementLabel={handleDeleteSelectedPiecePlacementLabel}
    />
  )

  const workbenchPreviewContent = <WorkbenchThreePreviewInspector controller={threePreviewController} />

  const workbenchDocumentContent = (
    <DocumentInspectorPanel
      displayUnit={displayUnit}
      onSetDisplayUnit={setDisplayUnit}
      gridSpacing={gridSpacing}
      onSetGridSpacing={setGridSpacing}
      showCanvasRuler={showCanvasRuler}
      onToggleCanvasRuler={() => setShowCanvasRuler((previous) => !previous)}
      showDimensions={showDimensions}
      onToggleDimensions={() => setShowDimensions((previous) => !previous)}
      showAnnotations={showAnnotations}
      onToggleAnnotations={() => setShowAnnotations((previous) => !previous)}
      sketchWorkspaceMode={sketchWorkspaceMode}
      onSetSketchWorkspaceMode={setSketchWorkspaceMode}
      themeMode={themeMode}
      onSetThemeMode={handleSetThemeMode}
      snapSettings={snapSettings}
      onUpdateSnapSettings={(patch) => setSnapSettings((previous) => ({ ...previous, ...patch }))}
      projectMemo={projectMemo}
      onProjectMemoChange={setProjectMemo}
      activeLineType={activeLineType}
      lineTypes={lineTypes}
      shapeCountsByLineType={shapeCountsByLineType}
      selectedShapeCount={selectedShapeCount}
      onAssignSelectedToActiveType={handleAssignSelectedToActiveLineType}
      onClearSelection={handleClearShapeSelection}
      onIsolateActiveType={handleIsolateActiveLineType}
      onSelectShapesByActiveType={handleSelectShapesByActiveLineType}
      onSetActiveLineTypeId={setActiveLineTypeId}
      onShowAllTypes={handleShowAllLineTypes}
      onToggleLineTypeVisibility={(lineTypeId) =>
        setLineTypes((previous) =>
          previous.map((lineType) =>
            lineType.id === lineTypeId ? { ...lineType, visible: !lineType.visible } : lineType,
          ),
        )
      }
      onUpdateActiveLineTypeColor={handleUpdateActiveLineTypeColor}
      onUpdateActiveLineTypeRole={handleUpdateActiveLineTypeRole}
      onUpdateActiveLineTypeStyle={handleUpdateActiveLineTypeStyle}
      layers={layers}
      layerColorsById={layerColorsById}
      layerColorOverrides={layerColorOverrides}
      frontLayerColor={frontLayerColor}
      backLayerColor={backLayerColor}
      onFrontLayerColorChange={setFrontLayerColor}
      onBackLayerColorChange={setBackLayerColor}
      onSetLayerColorOverride={handleSetLayerColorOverride}
      onClearLayerColorOverride={handleClearLayerColorOverride}
      onResetLayerColors={handleResetLayerColors}
    />
  )

  return (
    <div className={`app-shell ${resolvedThemeMode === 'light' ? 'theme-light' : 'theme-dark'} ${!isMobileLayout ? 'app-shell-workbench' : ''}`}>
      {isMobileLayout ? (
        <>
          <EditorTopbar {...topbarProps} />

          <main ref={workspaceRef} className={workspaceClassName}>
            <div className="canvas-stage">
              <ErrorBoundary>
                <EditorCanvasPane {...canvasPaneProps} hideCanvasPane={hideCanvasPane} />
              </ErrorBoundary>
            </div>

            <ErrorBoundary>
              <EditorPreviewPane {...previewPaneProps} />
            </ErrorBoundary>
          </main>

          <PrecisionCommandPanel
            open={showPrecisionModal}
            onClose={() => setShowPrecisionModal(false)}
            toolHint={toolHint}
            onRunCommand={runPrecisionCommand}
          />

          <EditorStatusBar {...statusBarProps} />
        </>
      ) : (
        <EditorWorkbench
          docLabel={docLabel}
          shellRef={shellRef}
          workspaceMode={workspaceMode}
          secondaryPreviewMode={effectiveSecondaryPreviewMode}
          showPeek={showPeek}
          browserWidth={effectiveLayout.browserWidth}
          inspectorWidth={effectiveLayout.inspectorWidth}
          peekWidth={effectiveLayout.peekWidth}
          splitterWidth={splitterWidth}
          toolRailWidth={toolRailWidth}
          quickActions={quickActions}
          onInvokeQuickAction={handleWorkbenchQuickAction}
          onSetWorkspaceMode={handleSetWorkbenchMode}
          onTogglePeek={handleToggleWorkbenchPeek}
          activeRibbonTab={workbenchRibbonTab}
          themeMode={themeMode}
          ribbonGroups={ribbonGroups}
          onSetRibbonTab={setWorkbenchRibbonTab}
          onInvokeRibbonCommand={handleWorkbenchRibbonCommand}
          onSetThemeMode={handleSetThemeMode}
          browserNodes={browserNodes}
          onActivateNode={handleWorkbenchActivateNode}
          onToggleLayerVisibility={handleToggleLayerVisibilityById}
          onToggleLayerGroupVisibility={(layerIds) => {
            if (layerIds.length === 0) {
              return
            }
            setLayers((previous) => {
              const layerIdSet = new Set(layerIds)
              const targetLayers = previous.filter((layer) => layerIdSet.has(layer.id))
              if (targetLayers.length === 0) {
                return previous
              }
              const shouldShow = targetLayers.some((layer) => !layer.visible)
              return previous.map((layer) =>
                layerIdSet.has(layer.id)
                  ? {
                      ...layer,
                      visible: shouldShow,
                    }
                  : layer,
              )
            })
          }}
          onToggleLayerLock={handleToggleLayerLockById}
          onToggleTracingVisibility={handleToggleTracingVisibilityById}
          onToggleTracingLock={handleToggleTracingLockById}
          tool={tool}
          onSetActiveTool={setActiveTool}
          activeInspectorTab={effectiveLayout.activeInspectorTab}
          onSetActiveInspectorTab={setActiveInspectorTab}
          inspectContent={workbenchInspectContent}
          pieceContent={workbenchPieceContent}
          previewContent={workbenchPreviewContent}
          documentContent={workbenchDocumentContent}
          twoDPane={workbenchTwoDPane}
          threeDPane={workbenchThreeDPane}
          precisionDrawer={
            <PrecisionCommandPanel
              open={showPrecisionModal}
              onClose={() => setShowPrecisionModal(false)}
              toolHint={toolHint}
              onRunCommand={runPrecisionCommand}
              variant="drawer"
            />
          }
          onStartBrowserResize={handleBrowserResizeStart}
          onStartPeekResize={handlePeekResizeStart}
          onStartInspectorResize={handleInspectorResizeStart}
          toolLabel={toolLabel(tool)}
          selectionText={selectionText}
          zoomPercent={Math.round(viewport.scale * 100)}
          displayUnit={displayUnit}
          activeLayerName={activeLayer?.name ?? 'None'}
          activeLineTypeName={activeLineType?.name ?? 'None'}
          onTogglePrecision={() => setShowPrecisionModal((previous) => !previous)}
        />
      )}

      <ErrorBoundary>
        <EditorModalStack
          {...modalStackProps}
          stitchSimulatorModalProps={{
            open: showStitchSimulatorModal,
            onClose: () => setShowStitchSimulatorModal(false),
            settings: stitchSimulatorSettings,
            onApply: (settings) => {
              setStitchSimulatorSettings(settings)
              saveStitchSimulatorSettings(settings)
              setStatus('Stitch simulator settings updated')
            },
            stitchHoleCount: stitchHoles.length,
            threadLength: stitchSimulatorResult?.threadLength ?? null,
            selectedHoleLabel: selectedStitchHole ? `Hole ${selectedStitchHole.sequence + 1}` : null,
            terminalHoleLabel:
              (selectedStitchHole
                ? getTerminalStitchHoleIdForShape(stitchHoles, selectedStitchHole.shapeId)
                : stitchSimulatorResult?.terminalHoleId)
                ? `Hole ${
                    (
                      stitchHoles.find(
                        (hole) =>
                          hole.id ===
                          (selectedStitchHole
                            ? getTerminalStitchHoleIdForShape(stitchHoles, selectedStitchHole.shapeId)
                            : stitchSimulatorResult?.terminalHoleId),
                      )?.sequence ?? 0
                    ) + 1
                  }`
                : null,
          }}
          boxStitchHelperModalProps={{
            open: showBoxStitchHelperModal,
            onClose: () => setShowBoxStitchHelperModal(false),
            onApply: handleApplyBoxStitchHelper,
            settings: boxStitchHelperSettings,
            selectedShapeCount,
          }}
          boxStitchModalProps={{
            open: showBoxStitchModal,
            onClose: () => setShowBoxStitchModal(false),
            onGenerate: handleGenerateBoxStitch,
            defaultLayerId: activeLayerId,
            defaultLineTypeId: activeLineTypeId,
          }}
          mandalaModalProps={{
            open: showMandalaModal,
            onClose: () => setShowMandalaModal(false),
            onGenerateRadial: handleGenerateMandalaRadial,
            onGenerateSpiral: handleGenerateSpiral,
            onGenerateGoldenGuides: handleGenerateGoldenGuides,
            defaultLayerId: activeLayerId,
            defaultLineTypeId: activeLineTypeId,
          }}
          wizardModalProps={{
            open: showWizardModal,
            onClose: () => setShowWizardModal(false),
            onGenerate: handleGenerateWizardPattern,
            defaultLayerId: activeLayerId,
            defaultLineTypeId: activeLineTypeId,
          }}
          letterStampModalProps={{
            open: showLetterStampModal,
            onClose: () => setShowLetterStampModal(false),
            onGenerate: handleGenerateLetterStamp,
            defaultLayerId: activeLayerId,
            defaultLineTypeId: activeLineTypeId,
          }}
          changeShapeSizeModalProps={{
            open: showChangeShapeSizeModal,
            onClose: () => setShowChangeShapeSizeModal(false),
            onApply: (w, h, lock) => { handleResizeShapes(w, h, lock); setShowChangeShapeSizeModal(false) },
            currentWidth: selectionBounds?.width ?? 0,
            currentHeight: selectionBounds?.height ?? 0,
          }}
        />
      </ErrorBoundary>

      <Suspense fallback={null}>
        <ProjectMemoModal
          open={showProjectMemoModal}
          onClose={() => setShowProjectMemoModal(false)}
          value={projectMemo}
          onChange={(nextValue) => setProjectMemo(nextValue.slice(0, 8000))}
        />
      </Suspense>

      {isMobileLayout && (
        <PieceInspectorModal
          open={showPieceInspectorModal && selectedPatternPiece !== null}
          piece={selectedPatternPiece}
          grainline={selectedPieceGrainline}
          pieceLabel={selectedPieceLabel}
          patternLabel={selectedPatternLabel}
          seamAllowance={selectedPieceSeamAllowance}
          seamConnections={selectedPieceSeamConnections}
          notches={selectedPieceNotches}
          placementLabels={selectedPiecePlacementLabels}
          edgeCount={selectedPatternPieceEdgeCount}
          availableInternalShapes={selectedPieceAvailableInternalShapes}
          selectedInternalShapeIds={selectedPieceInternalShapeIdSet}
          onClose={() => setShowPieceInspectorModal(false)}
          onUpdatePiece={handleUpdateSelectedPatternPiece}
          onToggleInternalShape={handleToggleSelectedPieceInternalShape}
          onUpdateGrainline={handleUpdateSelectedPieceGrainline}
          onUpdatePieceLabel={(patch) => updateSelectedLabel('piece', patch)}
          onUpdatePatternLabel={(patch) => updateSelectedLabel('pattern', patch)}
          onUpdateSeamAllowance={handleUpdateSelectedPieceSeamAllowance}
          onUpdateSeamConnection={handleUpdateSelectedPieceSeamConnection}
          onDeleteSeamConnection={(connectionId) =>
            setSeamConnections((previous) => previous.filter((entry) => entry.id !== connectionId))
          }
          onUpdateNotch={handleUpdateSelectedPieceNotch}
          onDeleteNotch={(notchId) => setPieceNotches((previous) => previous.filter((entry) => entry.id !== notchId))}
          onAddPlacementLabel={handleAddSelectedPiecePlacementLabel}
          onUpdatePlacementLabel={handleUpdateSelectedPiecePlacementLabel}
          onDeletePlacementLabel={handleDeleteSelectedPiecePlacementLabel}
        />
      )}

      <Suspense fallback={null}>
        <NestingModal
          open={showNestingModal}
          onClose={() => setShowNestingModal(false)}
          patternPieces={patternPieces}
          pieceGrainlines={pieceGrainlines}
          patternPieceChainsByShapeId={patternPieceChains.byShapeId}
          selectedShapeIds={selectedShapeIdSet}
          activeLayerId={activeLayerId}
          activeLineTypeId={activeLineTypeId}
          onApplyNesting={(createdShapes) => {
            setShapes((prev) => [...prev, ...createdShapes])
            setShowNestingModal(false)
            setStatus(`Nesting applied: ${createdShapes.length} shapes created`)
          }}
        />
      </Suspense>

      <EditorHiddenInputs
        fileInputRef={fileInputRef}
        svgInputRef={svgInputRef}
        tracingInputRef={tracingInputRef}
        templateImportInputRef={templateImportInputRef}
        catalogImportInputRef={catalogImportInputRef}
        onLoadJson={handleLoadJson}
        onImportSvg={handleImportSvg}
        onImportTracing={handleImportTracing}
        onImportTemplateRepositoryFile={handleImportTemplateRepositoryFile}
        onImportCatalogFile={handleImportCatalogFile}
      />
      <input
        ref={fontInputRef}
        type="file"
        accept=".ttf,.otf,.woff"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            void import('./ops/opentype-ops')
              .then(({ loadFontFromBuffer }) => {
                try {
                  const key = `font:${file.name}`
                  loadFontFromBuffer(reader.result as ArrayBuffer, key)
                  setLoadedFontUrl(key)
                  setStatus(`Font loaded: ${file.name}`)
                } catch (err) {
                  setStatus(`Failed to load font: ${err instanceof Error ? err.message : 'unknown error'}`)
                }
              })
              .catch(() => {
                setStatus('Failed to load font: could not initialize font tools')
              })
          }
          reader.readAsArrayBuffer(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default EditorApp
