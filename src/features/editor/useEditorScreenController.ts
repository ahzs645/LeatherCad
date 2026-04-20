import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type ComponentProps,
  type RefObject,
} from 'react'
import type {
  Shape,
} from './cad/cad-types'
import { EditorModalStack } from './components/EditorModalStack'
import type { EditorHiddenInputsProps } from './components/EditorHiddenInputs'
import type { NestingModalProps } from './components/NestingModal'
import type { PieceInspectorModalProps } from './components/PieceInspectorModal'
import type { ProjectMemoModalProps } from './components/ProjectMemoModal'
import {
  STITCH_LINE_TYPE_ID,
} from './cad/line-types'
import {
  saveCatalogRepository,
} from './templates/catalog-repository'

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
import { useEditorAutomationEffects } from './hooks/useEditorAutomationEffects'
import { useEditorGlobalBindings } from './hooks/useEditorGlobalBindings'
import { useLineTypeActions } from './hooks/useLineTypeActions'
import { useLayerColorActions } from './hooks/useLayerColorActions'
import { useEditorConsistencyEffects } from './hooks/useEditorConsistencyEffects'
import { useCombinedDraftAndSnapElement } from './hooks/useDraftCanvasElements'
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
import { useTransformActions } from './hooks/useTransformActions'
import { addFontToList, removeFontFromList, saveFontList } from './ops/font-list-ops'
import { saveAutoSaveEnabled } from './ops/autosave'
import { saveEditorPreferences, getDefaultEditorPreferences } from './ops/editor-prefs'
import { useAutoSave } from './hooks/useAutoSave'
import {
  getLineLengthMm,
  scaleLineLengthByRatio,
  setLineLength,
} from './ops/geometry-editing-ops'
import type { LineShape } from './cad/cad-types'
import type { LengthAdjustMode } from './components/LengthAdjustModal'
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
import { useWorkbenchShellState } from './workbench/useWorkbenchShellState'
import { useWorkbenchRouteSync } from './workbench/useWorkbenchRouteSync'
import { usePatternPieceSelection } from './state/selectors/usePatternPieceSelection'
import { usePatternPieceCommands } from './controllers/usePatternPieceCommands'
import { usePrintPreviewState } from './state/selectors/usePrintPreviewState'
import { useEditorCreationController } from './controllers/useEditorCreationController'
import { useEditorDocumentBootstrap } from './controllers/useEditorDocumentBootstrap'
import { useEditorWorkbenchController } from './controllers/useEditorWorkbenchController'
import { useEditorDocumentCommands } from './useEditorDocumentCommands'
import { useEditorAssetCommands } from './useEditorAssetCommands'
import { useEditorWorkbenchProps } from './useEditorWorkbenchProps'

export type EditorScreenLayoutModel = {
  isMobileLayout: boolean
  resolvedThemeMode: ResolvedThemeMode
  shouldLoadThreeWorkbench: boolean
}

export type EditorOverlayProps = {
  modalStackProps: ComponentProps<typeof EditorModalStack>
  projectMemoModalProps: ProjectMemoModalProps
  pieceInspectorModalProps: PieceInspectorModalProps | null
  nestingModalProps: NestingModalProps
  hiddenInputsProps: EditorHiddenInputsProps
  fontInputRef: RefObject<HTMLInputElement | null>
  onFontInputChange: ChangeEventHandler<HTMLInputElement>
}

export function useEditorScreenController() {
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
    customRotationPivot, setCustomRotationPivot,
    customSnapPoint, setCustomSnapPoint,
    showSpecifyRotationModal, setShowSpecifyRotationModal,
    showSpecifyScaleModal, setShowSpecifyScaleModal,
    specifyScaleModalAxis, setSpecifyScaleModalAxis,
    showFontListModal, setShowFontListModal,
    fontList, setFontList,
    autoSaveEnabled, setAutoSaveEnabled,
    reverseZoomDirection, setReverseZoomDirection,
    incrementalSelection, setIncrementalSelection,
    mentoriWithoutCtrl, setMentoriWithoutCtrl,
    lineToolConstraint, setLineToolConstraint,
    showLengthAdjustModal, setShowLengthAdjustModal,
    showOptionsModal, setShowOptionsModal,
    leatherSimTextureRotationDeg,
    exportIncludeText, setExportIncludeText,
    exportIncludeTemplateMetadata, setExportIncludeTemplateMetadata,
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
    setTextFontFamily,
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

  useWorkbenchRouteSync({
    enabled: !isMobileLayout,
    workspaceMode,
    setWorkspaceMode,
    setSecondaryPreviewMode,
    activeInspectorTab: effectiveLayout.activeInspectorTab,
    setActiveInspectorTab,
  })

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

  const previewElement = useCombinedDraftAndSnapElement({
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

  const {
    handleAlignSelectionToEdge,
    handleFlipSelection,
    handleReverseSelectedPaths,
    handleSpecifyRotation,
    handleSpecifyScale,
    handleOpenSpecifyRotationModal,
    handleOpenSpecifyScaleModal,
    handleSetAsRotationCenter,
    handleClearRotationCenter,
    handleSetAsSnapPoint,
    handleClearSnapPoint,
    handleMakeSelectedLineHorizontal,
    handleMakeSelectedLineVertical,
  } = useTransformActions({
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
  const {
    buildCurrentDocFile,
    handleEnableStitchOnSelection,
    handleDisableStitchOnSelection,
    handleUpdateSelectedShapePoint,
    handleUpdateSelectedStitchHole,
    handleResetExportOptions,
    updateFoldLine,
  } = useEditorDocumentCommands({
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
    projectMemo,
    stitchAlwaysShapeIds,
    stitchThreadColor,
    threePreviewSettings,
    avatars,
    threeTextureSource,
    threeTextureShapeIds,
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

  useEditorGlobalBindings({
    handleDeleteSelection,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    handleDuplicateSelection,
    handleSelectAllShapes,
    handleDeselectAll: () => {
      setSelectedShapeIds([])
      setSelectedStitchHoleId(null)
      setSelectedHardwareMarkerId(null)
    },
    handleToggleCanvasRuler: () => {
      setShowCanvasRuler((previous) => !previous)
    },
    handleHideBezierOffsetGuides: () => {
      setShowBezierOffsetLines(false)
      setStatus('Bezier offset guides hidden')
    },
    handleNudgeSelection: (dxMm: number, dyMm: number) => {
      if (selectedShapeIdSet.size === 0) return
      setShapes((previous) =>
        previous.map((shape) => {
          if (!selectedShapeIdSet.has(shape.id)) return shape
          const offset = (point: { x: number; y: number }) => ({
            x: point.x + dxMm,
            y: point.y + dyMm,
          })
          if (shape.type === 'line' || shape.type === 'text') {
            return { ...shape, start: offset(shape.start), end: offset(shape.end) }
          }
          if (shape.type === 'arc') {
            return { ...shape, start: offset(shape.start), mid: offset(shape.mid), end: offset(shape.end) }
          }
          return { ...shape, start: offset(shape.start), control: offset(shape.control), end: offset(shape.end) }
        }),
      )
    },
  })

  useEditorAutomationEffects({
    shapes,
    autoConstraintSettings,
    constraintSuggestions,
    setConstraintSuggestions,
  })

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
    customSnapPoint,
    reverseZoomDirection,
    incrementalSelection,
    lineToolConstraint,
    onWheelRotateSelection: (deltaDeg: number) => {
      if (selectedShapeIdSet.size === 0) return
      handleRotateSelection(deltaDeg)
    },
    onWheelScaleSelection: (factor: number) => {
      if (selectedShapeIdSet.size === 0) return
      handleScaleSelection(factor)
    },
    onPickLineTypeFromShape: (shapeId: string) => {
      const shape = shapesById[shapeId]
      if (!shape) return
      setActiveLineTypeId(shape.lineTypeId)
      const lineType = lineTypesById[shape.lineTypeId]
      setStatus(`Active line type set to "${lineType?.name ?? shape.lineTypeId}"`)
    },
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

  useAutoSave({
    enabled: autoSaveEnabled,
    buildDoc: () => buildCurrentDocFile(),
    setStatus,
  })

  const {
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
    handleActivateLayerOfSelectedShape,
    handleDuplicateSelectedShapesOnBelowLayer,
    handleMoveSelectedShapesToLayerBelow,
    handleMoveSelectedShapesToAnotherLayer,
    handleHighlightShapesOnCurrentLayer,
    handleToggleLayerIgnored,
    handleToggleIndependentLayer,
  } = useLayerActions({
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
    handleToggleActiveLineTypeVisibility,
    handleShowAllLineTypes,
    handleIsolateActiveLineType,
    handleUpdateActiveLineTypeRole,
    handleUpdateActiveLineTypeStyle,
    handleUpdateActiveLineTypeColor,
    handleSelectShapesByActiveLineType,
    handleAssignSelectedToActiveLineType,
    handleClearShapeSelection,
    handleLinePaletteSelectAll,
    handleLinePaletteUnselectLineType,
    handleLinePaletteUnselectOthers,
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
    handleAutoPlaceEvenlySpacedStitchHoles,
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
    handleCenterLineBetweenSelection,
    handleEditSelectedLineAngle,
    handleDeleteDuplicates,
    handleSplitIntoN,
    handleDrawBoundaryAroundSelection,
    handleFilletSelectedCorner,
    handleDistanceMarkSelectedPath,
    handleConvertSelectionToPath,
  } = useGeometryEditingActions({
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
    handleGenerateWhiteSilverGuides,
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
  const {
    handleBooleanOp,
    handleClipperOffset,
    handleTextToPath,
    handleFontInputChange,
  } = useEditorAssetCommands({
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
    handleAlignSelectionToEdge,
    handleFlipSelection,
    handleReverseSelectedPaths,
    handleOpenSpecifyRotationModal,
    handleOpenSpecifyScaleModal,
    handleSetAsRotationCenter,
    handleClearRotationCenter,
    handleSetAsSnapPoint,
    handleClearSnapPoint,
    handleMakeSelectedLineHorizontal,
    handleMakeSelectedLineVertical,
    hasCustomRotationPivot: customRotationPivot !== null,
    hasCustomSnapPoint: customSnapPoint !== null,
    handleCenterLineBetweenSelection,
    handleEditSelectedLineAnglePrompt: () => {
      const raw = window.prompt('Enter new line angle (degrees, CCW from +X)', '0')
      if (raw === null) {
        setStatus('Edit angle cancelled')
        return
      }
      const angle = Number(raw)
      if (!Number.isFinite(angle)) {
        setStatus('Invalid angle')
        return
      }
      handleEditSelectedLineAngle(angle)
    },
    handleDeleteDuplicatesSelection: () => handleDeleteDuplicates(),
    handleSplitIntoNPrompt: () => {
      const raw = window.prompt('Split into how many equal segments?', '2')
      if (raw === null) {
        setStatus('Split cancelled')
        return
      }
      const count = Number(raw)
      if (!Number.isInteger(count) || count < 2) {
        setStatus('Segment count must be an integer ≥ 2')
        return
      }
      handleSplitIntoN(count)
    },
    handleDrawBoundaryAroundSelection,
    handleAddBackdrop: () => {
      tracingInputRef.current?.click()
      setStatus('Choose an image to add as a backdrop')
    },
    handleOpenFontListModal: () => setShowFontListModal(true),
    handleCloseProject: () => {
      const confirmed = window.confirm(
        'Close the current project? Unsaved changes will be lost unless you save first.',
      )
      if (confirmed) {
        resetDocument()
      }
    },
    handleOpenSecretFeatures: () => setShowWizardModal(true),
    handleOpenOptionsModal: () => setShowOptionsModal(true),
    handleOpenLengthAdjustModal: () => setShowLengthAdjustModal(true),
    handleActivateLayerOfSelectedShape,
    handleDuplicateSelectedShapesOnBelowLayer,
    handleMoveSelectedShapesToLayerBelow,
    handleMoveSelectedShapesToAnotherLayer,
    handleHighlightShapesOnCurrentLayer,
    handleToggleLayerIgnored,
    handleToggleIndependentLayer,
    handleFilletSelectedCornerPrompt: () => {
      const raw = window.prompt('Fillet (chamfer) radius in mm?', '2')
      if (raw === null) {
        setStatus('Fillet cancelled')
        return
      }
      const radius = Number(raw)
      if (!Number.isFinite(radius) || radius <= 0) {
        setStatus('Fillet radius must be positive')
        return
      }
      handleFilletSelectedCorner(radius)
    },
    handleDistanceMarkSelectedPathPrompt: () => {
      const raw = window.prompt(
        'Distance(s) in mm from the start of the selected path (comma-separated):',
        '10, 30',
      )
      if (raw === null) {
        setStatus('Distance marking cancelled')
        return
      }
      const parsed = raw
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isFinite(entry) && entry >= 0)
      if (parsed.length === 0) {
        setStatus('No valid distances provided')
        return
      }
      handleDistanceMarkSelectedPath(parsed)
    },
    handleConvertSelectionToPath: () => handleConvertSelectionToPath(false),
    handleConvertACopyToPath: () => handleConvertSelectionToPath(true),
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
    handleAutoPlaceEvenlySpacedStitchHolesPrompt: () => {
      const raw = window.prompt('How many holes to place evenly on the selected path?', '10')
      if (raw === null) {
        setStatus('Even placement cancelled')
        return
      }
      const count = Number(raw)
      if (!Number.isInteger(count) || count < 2) {
        setStatus('Hole count must be an integer ≥ 2')
        return
      }
      handleAutoPlaceEvenlySpacedStitchHoles(count)
    },
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
    handleLinePaletteSelectAllVisible: () => handleLinePaletteSelectAll(lineTypes),
    handleLinePaletteUnselectActive: () => {
      if (activeLineType) handleLinePaletteUnselectLineType(activeLineType.id)
    },
    handleLinePaletteUnselectOtherThanActive: () => {
      if (activeLineType) handleLinePaletteUnselectOthers(activeLineType.id)
    },
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
    handleBooleanOp,
    handleClipperOffset,
    handleTextToPath,
    handleOpenNesting: () => setShowNestingModal(true),
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
  const shouldLoadThreeWorkbench = workspaceMode === '3d'
  const selectionInspectorProps = {
    context: selectionContext,
    selectedShapeCount,
    selectedEditableShape,
    selectedStitchHole,
    selectedHardwareMarker,
    shapeCount: shapes.length,
    layerCount: layers.length,
    onAlignX: () => handleAlignSelection('x'),
    onAlignY: () => handleAlignSelection('y'),
    onAlignBoth: () => handleAlignSelection('both'),
    onAlignToGrid: handleAlignSelectionToGrid,
    onCreateOffset: handleCreateOffsetGeometryFromSelection,
    onCreateBoxStitch: handleOpenBoxStitchHelperModal,
    onBevelCorner: handleBevelSelectedCorner,
    onRoundCorner: handleRoundSelectedCorner,
    onAddEdgeConstraint: handleAddEdgeConstraintFromSelection,
    onAddAlignConstraints: handleAddAlignConstraintsFromSelection,
    onApplyConstraints: handleApplyConstraints,
    onCreatePatternPiece: handleCreatePatternPieceFromSelection,
    onOpenPieceTab: openSelectedPatternPieceInspector,
    canOpenPieceTab: selectedPatternPiece !== null,
    onApplySeamAllowance: handleApplySeamAllowanceToSelection,
    onClearSeamAllowance: handleClearSeamAllowanceOnSelection,
    onApplyTextDefaults: handleApplyTextDefaultsToSelection,
    onExtractBoxStitchSource: handleExtractSelectedBoxStitchSources,
    onClearBoxStitchSource: handleClearSelectedBoxStitchSources,
    onUpdateSelectedShapePoint: handleUpdateSelectedShapePoint,
    onUpdateSelectedStitchHole: handleUpdateSelectedStitchHole,
    onMarkSelectedStitchHoleAsEnd: handleMarkSelectedStitchHoleAsEnd,
    onClearSelectedStitchHoleEnd: handleClearSelectedStitchHoleEnd,
    onUpdateSelectedHardwareMarker: handleUpdateSelectedHardwareMarker,
    onDeleteSelectedHardwareMarker: handleDeleteSelectedHardwareMarker,
  }
  const pieceInspectorContentProps = {
    piece: selectedPatternPiece,
    grainline: selectedPieceGrainline,
    pieceLabel: selectedPieceLabel,
    patternLabel: selectedPatternLabel,
    seamAllowance: selectedPieceSeamAllowance,
    seamConnections: selectedPieceSeamConnections,
    notches: selectedPieceNotches,
    placementLabels: selectedPiecePlacementLabels,
    edgeCount: selectedPatternPieceEdgeCount,
    availableInternalShapes: selectedPieceAvailableInternalShapes,
    selectedInternalShapeIds: selectedPieceInternalShapeIdSet,
    onUpdatePiece: handleUpdateSelectedPatternPiece,
    onToggleInternalShape: handleToggleSelectedPieceInternalShape,
    onUpdateGrainline: handleUpdateSelectedPieceGrainline,
    onUpdatePieceLabel: (patch: Parameters<typeof updateSelectedLabel>[1]) => updateSelectedLabel('piece', patch),
    onUpdatePatternLabel: (patch: Parameters<typeof updateSelectedLabel>[1]) => updateSelectedLabel('pattern', patch),
    onUpdateSeamAllowance: handleUpdateSelectedPieceSeamAllowance,
    onUpdateSeamConnection: handleUpdateSelectedPieceSeamConnection,
    onDeleteSeamConnection: (connectionId: string) =>
      setSeamConnections((previous) => previous.filter((entry) => entry.id !== connectionId)),
    onUpdateNotch: handleUpdateSelectedPieceNotch,
    onDeleteNotch: (notchId: string) => setPieceNotches((previous) => previous.filter((entry) => entry.id !== notchId)),
    onAddPlacementLabel: handleAddSelectedPiecePlacementLabel,
    onUpdatePlacementLabel: handleUpdateSelectedPiecePlacementLabel,
    onDeletePlacementLabel: handleDeleteSelectedPiecePlacementLabel,
  }
  const documentInspectorProps = {
    displayUnit,
    onSetDisplayUnit: setDisplayUnit,
    gridSpacing,
    onSetGridSpacing: setGridSpacing,
    showCanvasRuler,
    onToggleCanvasRuler: () => setShowCanvasRuler((previous) => !previous),
    showDimensions,
    onToggleDimensions: () => setShowDimensions((previous) => !previous),
    showAnnotations,
    onToggleAnnotations: () => setShowAnnotations((previous) => !previous),
    sketchWorkspaceMode,
    onSetSketchWorkspaceMode: setSketchWorkspaceMode,
    themeMode,
    onSetThemeMode: handleSetThemeMode,
    snapSettings,
    onUpdateSnapSettings: (patch: Partial<typeof snapSettings>) =>
      setSnapSettings((previous) => ({ ...previous, ...patch })),
    projectMemo,
    onProjectMemoChange: setProjectMemo,
    activeLineType,
    lineTypes,
    shapeCountsByLineType,
    selectedShapeCount,
    onAssignSelectedToActiveType: handleAssignSelectedToActiveLineType,
    onClearSelection: handleClearShapeSelection,
    onIsolateActiveType: handleIsolateActiveLineType,
    onSelectShapesByActiveType: handleSelectShapesByActiveLineType,
    onSetActiveLineTypeId: setActiveLineTypeId,
    onShowAllTypes: handleShowAllLineTypes,
    onToggleLineTypeVisibility: (lineTypeId: string) =>
      setLineTypes((previous) =>
        previous.map((lineType) =>
          lineType.id === lineTypeId ? { ...lineType, visible: !lineType.visible } : lineType,
        ),
      ),
    onUpdateActiveLineTypeColor: handleUpdateActiveLineTypeColor,
    onUpdateActiveLineTypeRole: handleUpdateActiveLineTypeRole,
    onUpdateActiveLineTypeStyle: handleUpdateActiveLineTypeStyle,
    layers,
    layerColorsById,
    layerColorOverrides,
    frontLayerColor,
    backLayerColor,
    onFrontLayerColorChange: setFrontLayerColor,
    onBackLayerColorChange: setBackLayerColor,
    onSetLayerColorOverride: handleSetLayerColorOverride,
    onClearLayerColorOverride: handleClearLayerColorOverride,
    onResetLayerColors: handleResetLayerColors,
  }
  const workbenchProps = {
    docLabel,
    shellRef,
    workspaceMode,
    secondaryPreviewMode: effectiveSecondaryPreviewMode,
    showPeek,
    browserWidth: effectiveLayout.browserWidth,
    inspectorWidth: effectiveLayout.inspectorWidth,
    peekWidth: effectiveLayout.peekWidth,
    splitterWidth,
    toolRailWidth,
    quickActions,
    onInvokeQuickAction: handleWorkbenchQuickAction,
    onSetWorkspaceMode: handleSetWorkbenchMode,
    onTogglePeek: handleToggleWorkbenchPeek,
    activeRibbonTab: workbenchRibbonTab,
    themeMode,
    ribbonGroups,
    onSetRibbonTab: setWorkbenchRibbonTab,
    onInvokeRibbonCommand: handleWorkbenchRibbonCommand,
    onSetThemeMode: handleSetThemeMode,
    browserNodes,
    onActivateNode: handleWorkbenchActivateNode,
    onToggleLayerVisibility: handleToggleLayerVisibilityById,
    onToggleLayerGroupVisibility: (layerIds: string[]) => {
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
    },
    onToggleLayerLock: handleToggleLayerLockById,
    onToggleTracingVisibility: handleToggleTracingVisibilityById,
    onToggleTracingLock: handleToggleTracingLockById,
    tool,
    onSetActiveTool: setActiveTool,
    activeInspectorTab: effectiveLayout.activeInspectorTab,
    onSetActiveInspectorTab: setActiveInspectorTab,
    onStartBrowserResize: handleBrowserResizeStart,
    onStartPeekResize: handlePeekResizeStart,
    onStartInspectorResize: handleInspectorResizeStart,
    toolLabel: toolLabel(tool),
    selectionText,
    zoomPercent: Math.round(viewport.scale * 100),
    displayUnit,
    activeLayerName: activeLayer?.name ?? 'None',
    activeLineTypeName: activeLineType?.name ?? 'None',
    onTogglePrecision: () => setShowPrecisionModal((previous) => !previous),
  }
  const workbenchThreeWorkspaceProps = {
    workspaceMode,
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
    onUpdateFoldLine: updateFoldLine,
  }
  const { mobileShell, desktopShell } = useEditorWorkbenchProps({
    workspaceRef,
    workspaceClassName,
    topbarProps,
    hideCanvasPane,
    previewPaneProps,
    statusBarProps,
    toolHint,
    runPrecisionCommand,
    showPrecisionModal,
    setShowPrecisionModal,
    workbenchProps,
    selectionInspectorProps,
    pieceInspectorContentProps,
    documentInspectorProps,
    workbenchThreeWorkspaceProps,
    onOpenThreeWorkspace: () => handleSetWorkbenchMode('3d'),
    shouldLoadThreeWorkbench,
    canvasPaneParams: {
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
    },
  })

  return {
    layout: {
      isMobileLayout,
      resolvedThemeMode,
      shouldLoadThreeWorkbench,
    },
    mobileShell,
    desktopShell,
    overlay: {
      modalStackProps: {
        ...modalStackProps,
        stitchSimulatorModalProps: {
          open: showStitchSimulatorModal,
          onClose: () => setShowStitchSimulatorModal(false),
          settings: stitchSimulatorSettings,
          onApply: (settings: StitchSimulatorSettings) => {
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
        },
        boxStitchHelperModalProps: {
          open: showBoxStitchHelperModal,
          onClose: () => setShowBoxStitchHelperModal(false),
          onApply: handleApplyBoxStitchHelper,
          settings: boxStitchHelperSettings,
          selectedShapeCount,
        },
        boxStitchModalProps: {
          open: showBoxStitchModal,
          onClose: () => setShowBoxStitchModal(false),
          onGenerate: handleGenerateBoxStitch,
          defaultLayerId: activeLayerId,
          defaultLineTypeId: activeLineTypeId,
        },
        mandalaModalProps: {
          open: showMandalaModal,
          onClose: () => setShowMandalaModal(false),
          onGenerateRadial: handleGenerateMandalaRadial,
          onGenerateSpiral: handleGenerateSpiral,
          onGenerateGoldenGuides: handleGenerateGoldenGuides,
          onGenerateWhiteSilverGuides: handleGenerateWhiteSilverGuides,
          defaultLayerId: activeLayerId,
          defaultLineTypeId: activeLineTypeId,
        },
        wizardModalProps: {
          open: showWizardModal,
          onClose: () => setShowWizardModal(false),
          onGenerate: handleGenerateWizardPattern,
          defaultLayerId: activeLayerId,
          defaultLineTypeId: activeLineTypeId,
        },
        letterStampModalProps: {
          open: showLetterStampModal,
          onClose: () => setShowLetterStampModal(false),
          onGenerate: handleGenerateLetterStamp,
          defaultLayerId: activeLayerId,
          defaultLineTypeId: activeLineTypeId,
        },
        changeShapeSizeModalProps: {
          open: showChangeShapeSizeModal,
          onClose: () => setShowChangeShapeSizeModal(false),
          onApply: (width: number, height: number, lockAspect: boolean) => {
            handleResizeShapes(width, height, lockAspect)
            setShowChangeShapeSizeModal(false)
          },
          currentWidth: selectionBounds?.width ?? 0,
          currentHeight: selectionBounds?.height ?? 0,
        },
        specifyRotationModalProps: {
          open: showSpecifyRotationModal,
          onClose: () => setShowSpecifyRotationModal(false),
          onApply: (angleDeg: number) => {
            handleSpecifyRotation(angleDeg)
            setShowSpecifyRotationModal(false)
          },
        },
        specifyScaleModalProps: {
          open: showSpecifyScaleModal,
          axis: specifyScaleModalAxis,
          onClose: () => setShowSpecifyScaleModal(false),
          onApply: (factorX: number, factorY: number) => {
            handleSpecifyScale(factorX, factorY)
            setShowSpecifyScaleModal(false)
          },
        },
        fontListModalProps: {
          open: showFontListModal,
          fonts: fontList,
          onClose: () => setShowFontListModal(false),
          onAdd: (fontFamily: string) => {
            const next = addFontToList(fontList, fontFamily)
            setFontList(next)
            saveFontList(next)
          },
          onRemove: (fontFamily: string) => {
            const next = removeFontFromList(fontList, fontFamily)
            setFontList(next)
            saveFontList(next)
          },
          onSelect: (fontFamily: string) => {
            setTextFontFamily(fontFamily)
            setStatus(`Text font family set to ${fontFamily}`)
          },
        },
        optionsModalProps: {
          open: showOptionsModal,
          autoSaveEnabled,
          reverseZoomDirection,
          incrementalSelection,
          mentoriWithoutCtrl,
          exportIncludeText,
          exportIncludeTemplateMetadata,
          onClose: () => setShowOptionsModal(false),
          onChangeAutoSaveEnabled: (value: boolean) => {
            setAutoSaveEnabled(value)
            saveAutoSaveEnabled(value)
          },
          onChangeReverseZoomDirection: (value: boolean) => {
            setReverseZoomDirection(value)
            saveEditorPreferences({
              ...getDefaultEditorPreferences(),
              reverseZoomDirection: value,
              incrementalSelection,
              mentoriWithoutCtrl,
              exportIncludeText,
              exportIncludeTemplateMetadata,
              leatherSimTextureRotationDeg,
            })
          },
          onChangeIncrementalSelection: (value: boolean) => {
            setIncrementalSelection(value)
            saveEditorPreferences({
              ...getDefaultEditorPreferences(),
              reverseZoomDirection,
              incrementalSelection: value,
              mentoriWithoutCtrl,
              exportIncludeText,
              exportIncludeTemplateMetadata,
              leatherSimTextureRotationDeg,
            })
          },
          onChangeMentoriWithoutCtrl: (value: boolean) => {
            setMentoriWithoutCtrl(value)
            saveEditorPreferences({
              ...getDefaultEditorPreferences(),
              reverseZoomDirection,
              incrementalSelection,
              mentoriWithoutCtrl: value,
              exportIncludeText,
              exportIncludeTemplateMetadata,
              leatherSimTextureRotationDeg,
            })
          },
          onChangeExportIncludeText: (value: boolean) => {
            setExportIncludeText(value)
            saveEditorPreferences({
              ...getDefaultEditorPreferences(),
              reverseZoomDirection,
              incrementalSelection,
              mentoriWithoutCtrl,
              exportIncludeText: value,
              exportIncludeTemplateMetadata,
              leatherSimTextureRotationDeg,
            })
          },
          onChangeExportIncludeTemplateMetadata: (value: boolean) => {
            setExportIncludeTemplateMetadata(value)
            saveEditorPreferences({
              ...getDefaultEditorPreferences(),
              reverseZoomDirection,
              incrementalSelection,
              mentoriWithoutCtrl,
              exportIncludeText,
              exportIncludeTemplateMetadata: value,
              leatherSimTextureRotationDeg,
              lineToolConstraint,
            })
          },
          lineToolConstraint,
          onChangeLineToolConstraint: (value: 'none' | 'horizontal' | 'vertical') => {
            setLineToolConstraint(value)
            saveEditorPreferences({
              ...getDefaultEditorPreferences(),
              reverseZoomDirection,
              incrementalSelection,
              mentoriWithoutCtrl,
              exportIncludeText,
              exportIncludeTemplateMetadata,
              leatherSimTextureRotationDeg,
              lineToolConstraint: value,
            })
          },
        },
        lengthAdjustModalProps: {
          open: showLengthAdjustModal,
          currentLengthMm: (() => {
            const line = shapes.find(
              (s): s is LineShape => s.type === 'line' && selectedShapeIdSet.has(s.id),
            )
            return line ? getLineLengthMm(line) : 0
          })(),
          onClose: () => setShowLengthAdjustModal(false),
          onApply: (mode: LengthAdjustMode, value: number) => {
            const targets = shapes.filter(
              (s): s is LineShape => s.type === 'line' && selectedShapeIdSet.has(s.id),
            )
            if (targets.length === 0) {
              setStatus('Select one or more lines to adjust')
              setShowLengthAdjustModal(false)
              return
            }
            if (mode === 'none') {
              setShowLengthAdjustModal(false)
              setStatus('Length adjustment skipped')
              return
            }
            setShapes((prev) =>
              prev.map((shape) => {
                if (shape.type !== 'line' || !selectedShapeIdSet.has(shape.id)) {
                  return shape
                }
                return mode === 'length'
                  ? setLineLength(shape, value)
                  : scaleLineLengthByRatio(shape, value)
              }),
            )
            setShowLengthAdjustModal(false)
            setStatus(
              mode === 'length'
                ? `Set length to ${value.toFixed(2)}mm on ${targets.length} line(s)`
                : `Scaled length by ${(value * 100).toFixed(1)}% on ${targets.length} line(s)`,
            )
          },
        },
      },
      projectMemoModalProps: {
        open: showProjectMemoModal,
        onClose: () => setShowProjectMemoModal(false),
        value: projectMemo,
        onChange: (nextValue: string) => setProjectMemo(nextValue.slice(0, 8000)),
      },
      pieceInspectorModalProps: isMobileLayout
        ? {
            ...pieceInspectorContentProps,
            open: showPieceInspectorModal && selectedPatternPiece !== null,
            onClose: () => setShowPieceInspectorModal(false),
          }
        : null,
      nestingModalProps: {
        open: showNestingModal,
        onClose: () => setShowNestingModal(false),
        patternPieces,
        pieceGrainlines,
        patternPieceChainsByShapeId: patternPieceChains.byShapeId,
        selectedShapeIds: selectedShapeIdSet,
        activeLayerId,
        activeLineTypeId,
        onApplyNesting: (createdShapes: Shape[]) => {
          setShapes((prev) => [...prev, ...createdShapes])
          setShowNestingModal(false)
          setStatus(`Nesting applied: ${createdShapes.length} shapes created`)
        },
      },
      hiddenInputsProps: {
        fileInputRef,
        svgInputRef,
        tracingInputRef,
        templateImportInputRef,
        catalogImportInputRef,
        onLoadJson: handleLoadJson,
        onImportSvg: handleImportSvg,
        onImportTracing: handleImportTracing,
        onImportTemplateRepositoryFile: handleImportTemplateRepositoryFile,
        onImportCatalogFile: handleImportCatalogFile,
      },
      fontInputRef,
      onFontInputChange: handleFontInputChange,
    },
  }
}
