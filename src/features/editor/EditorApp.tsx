import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type {
  DocFile,
  PatternPiece,
  PiecePlacementLabel,
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
import { safeLocalStorageGet, safeLocalStorageRemove } from './ops/safe-storage'
import { parseImportedJsonDocument } from './editor-json-import'
import {
  saveCatalogRepository,
  type CatalogRepositoryShop,
} from './templates/catalog-repository'

import {
  DEFAULT_EXPORT_ROLE_FILTERS,
} from './editor-constants'
import { detectOutlines, type OutlineChain } from './ops/outline-detection'
import {
  createDefaultPatternPiece,
  createDefaultPieceGrainline,
  createDefaultPieceLabels,
  createDefaultPiecePlacementLabel,
  createDefaultPieceSeamAllowance,
  getPatternPieceChain,
} from './ops/pattern-piece-ops'
import { clamp } from './cad/cad-geometry'
import { buildAnnotationExportShapes } from './ops/annotation-export-shapes'
import { openPrintTilesWindow } from './preview/print-output'
import { buildPrintPlan } from './preview/print-preview'
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
import { useDraftPreviewElement, useGridLines } from './hooks/useDraftCanvasElements'
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
import { useEditorHistory } from './hooks/useEditorHistory'
import { useEditorDocumentState } from './hooks/useEditorDocumentState'
import { useEditorUIState } from './hooks/useEditorUIState'
import { useEditorSelectionState } from './hooks/useEditorSelectionState'
import { useEditorRepositoryState } from './hooks/useEditorRepositoryState'
import { useAiBuilderActions } from './hooks/useAiBuilderActions'
import { DocumentInspectorPanel } from './workbench/DocumentInspectorPanel'
import { EditorWorkbench } from './workbench/EditorWorkbench'
import { SelectionInspectorPanel } from './workbench/SelectionInspectorPanel'
import {
  useDocumentBrowserModel,
  useInspectorModel,
  useQuickActions,
  useRibbonModel,
} from './workbench/workbench-hooks'
import { useWorkbenchShellState } from './workbench/useWorkbenchShellState'
import type { DocumentBrowserNode } from './workbench/workbench-types'
import {
  WorkbenchThreePreviewInspector,
  WorkbenchThreePreviewViewport,
} from './workbench/WorkbenchThreePreview'
import { useWorkbenchThreePreviewController } from './workbench/useWorkbenchThreePreviewController'

const OPEN_DOC_TRANSFER_PREFIX = 'leathercraft-open-doc-'

export function EditorApp() {
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
    status, setStatus,
    showThreePreview, setShowThreePreview,
    sidePanelTab, setSidePanelTab,
    show3dInMain, setShow3dInMain,
    isMobileLayout, setIsMobileLayout,
    mobileViewMode, setMobileViewMode,
    showMobileMenu, setShowMobileMenu,
    mobileOptionsTab, setMobileOptionsTab,
    showPrecisionModal, setShowPrecisionModal,
    showProjectMemoModal, setShowProjectMemoModal,
    showNestingModal, setShowNestingModal,
    desktopRibbonTab, setDesktopRibbonTab,
    workbenchRibbonTab, setWorkbenchRibbonTab,
    workspaceMode, setWorkspaceMode,
    secondaryPreviewMode, setSecondaryPreviewMode,
    mobileLayerAction, setMobileLayerAction,
    mobileFileAction, setMobileFileAction,
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
    showLayerColorModal,
    setShowLayerColorModal,
    showLineTypePalette,
    setShowLineTypePalette,
    showExportModal,
    setShowExportModal,
    showExportOptionsModal,
    setShowExportOptionsModal,
    exportOnlySelectedShapes,
    setExportOnlySelectedShapes,
    exportOnlyVisibleLineTypes,
    setExportOnlyVisibleLineTypes,
    exportRoleFilters,
    setExportRoleFilters,
    exportForceSolidStrokes,
    setExportForceSolidStrokes,
    dxfFlipY,
    setDxfFlipY,
    dxfVersion,
    setDxfVersion,
    showTracingModal,
    setShowTracingModal,
    showPatternToolsModal,
    setShowPatternToolsModal,
    showAiBuilderModal,
    setShowAiBuilderModal,
    showHelpModal,
    setShowHelpModal,
    showTemplateRepositoryModal,
    setShowTemplateRepositoryModal,
    printPaper,
    setPrintPaper,
    printTileX,
    setPrintTileX,
    printTileY,
    setPrintTileY,
    printOverlapMm,
    setPrintOverlapMm,
    printMarginMm,
    setPrintMarginMm,
    printScalePercent,
    setPrintScalePercent,
    printCalibrationXPercent,
    setPrintCalibrationXPercent,
    printCalibrationYPercent,
    setPrintCalibrationYPercent,
    printSelectedOnly,
    setPrintSelectedOnly,
    printRulerInside,
    setPrintRulerInside,
    printInColor,
    setPrintInColor,
    printStitchAsDots,
    setPrintStitchAsDots,
    showPrintAreas,
    setShowPrintAreas,
    showPrintPreviewModal,
    setShowPrintPreviewModal,
    seamAllowanceInputMm,
    setSeamAllowanceInputMm,
    constraintEdge,
    setConstraintEdge,
    constraintOffsetMm,
    setConstraintOffsetMm,
    constraintAxis,
    setConstraintAxis,
    hardwarePreset,
    setHardwarePreset,
    customHardwareDiameterMm,
    setCustomHardwareDiameterMm,
    customHardwareSpacingMm,
    setCustomHardwareSpacingMm,
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
    draftPoints,
    setDraftPoints,
    cursorPoint,
    setCursorPoint,
    clearDraft,
    setActiveTool,
    textDraftValue,
    setTextDraftValue,
    textFontFamily,
    setTextFontFamily,
    textFontSizeMm,
    setTextFontSizeMm,
    textTransformMode,
    setTextTransformMode,
    textRadiusMm,
    setTextRadiusMm,
    textSweepDeg,
    setTextSweepDeg,
    stitchHoleType,
    setStitchHoleType,
    stitchPitchMm,
    setStitchPitchMm,
    stitchVariablePitchStartMm,
    setStitchVariablePitchStartMm,
    stitchVariablePitchEndMm,
    setStitchVariablePitchEndMm,
    showStitchSequenceLabels,
    setShowStitchSequenceLabels,
  } = useEditorTools({ setStatus })

  const {
    historyState,
    setHistoryState,
    opHistory,
    setOpHistory,
    lastSnapshotRef,
    lastSnapshotSignatureRef,
    applyingHistoryRef,
  } = useEditorHistory()

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
  const mergedCatalogRepository = useMemo(() => {
    if (bundledCatalogRepository.length === 0) {
      return catalogRepository
    }
    const byId = new Map<string, CatalogRepositoryShop>()
    bundledCatalogRepository.forEach((shop) => byId.set(shop.id, shop))
    catalogRepository.forEach((shop) => byId.set(shop.id, shop))
    return Array.from(byId.values()).sort((left, right) => (left.importedAt > right.importedAt ? -1 : 1))
  }, [bundledCatalogRepository, catalogRepository])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handlePreferenceChange = (event: MediaQueryListEvent) => {
      setSystemThemeMode(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handlePreferenceChange)
    return () => {
      mediaQuery.removeEventListener('change', handlePreferenceChange)
    }
  }, [setSystemThemeMode])

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
    activeTracingOverlay,
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
    activeTracingOverlayId,
    selectedShapeIds,
    selectedStitchHoleId,
    selectedHardwareMarkerId,
    templateRepository,
    selectedTemplateEntryId,
    historyState,
    opHistory,
    printSelectedOnly,
    printPaper,
    printMarginMm,
    printOverlapMm,
    printTileX,
    printTileY,
    printScalePercent,
    exportRoleFilters,
    frontLayerColor,
    backLayerColor,
    layerColorOverrides,
    legendMode,
    sketchWorkspaceMode,
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const url = new URL(window.location.href)
    const token = url.searchParams.get('openDoc')
    if (!token) {
      return
    }

    const storageKey = `${OPEN_DOC_TRANSFER_PREFIX}${token}`
    const raw = safeLocalStorageGet(storageKey)
    if (!raw) {
      return
    }

    try {
      const parsed = parseImportedJsonDocument(raw)
      applyLoadedDocument(parsed.doc, 'Loaded project from new tab transfer')
      safeLocalStorageRemove(storageKey)
      url.searchParams.delete('openDoc')
      window.history.replaceState(null, '', url.toString())
    } catch (error) {
      console.error('Open in new tab transfer failed', error)
    }
  }, [applyLoadedDocument])

  const gridLines = useGridLines(gridSpacing)
  const previewElement = useDraftPreviewElement({
    cursorPoint,
    draftPoints,
    tool,
    activeLineTypeStrokeColor,
    activeLineTypeDasharray,
  })

  const { handleUndo, handleRedo } = useHistoryActions({
    historyState,
    opHistory,
    currentSnapshot,
    applyEditorSnapshot,
    applyingHistoryRef,
    setHistoryState,
    setOpHistory,
    setStatus,
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
    applyingHistoryRef,
    lastSnapshotRef,
    lastSnapshotSignatureRef,
    currentSnapshot,
    currentSnapshotSignature,
    setHistoryState,
    setOpHistory,
  })

  useKeyboardShortcuts({
    clearDraft,
    setStatus,
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
    runPrecisionCommand,
    toolHint,
  } = useCanvasInteractions({
    svgRef,
    panRef,
    tool,
    draftPoints,
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
    hardwarePreset,
    customHardwareDiameterMm,
    customHardwareSpacingMm,
    stitchHoleType,
    textDraftValue,
    textFontFamily,
    textFontSizeMm,
    textTransformMode,
    textRadiusMm,
    textSweepDeg,
    stitchHoles,
    patternPieces,
    pieceNotches,
    seamConnections,
    hardwareMarkers,
    selectedShapeIds,
    selectedStitchHoleId,
    selectedHardwareMarkerId,
    setStatus,
    setViewport,
    setDraftPoints,
    setCursorPoint,
    setShapes,
    setStitchHoles,
    setSelectedStitchHoleId,
    setPieceNotches,
    setSeamConnections,
    setHardwareMarkers,
    setSelectedHardwareMarkerId,
    setFoldLines,
    setSelectedShapeIds,
    clearDraft,
    ensureActiveLayerWritable,
    ensureActiveLineTypeWritable,
  })
  const { handleExportSvg, handleExportDxf, handleExportPdf, handleExportLaserSvg } = useExportActions({
    shapes: assemblyShapes,
    foldLines,
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
    exportOnlySelectedShapes,
    exportOnlyVisibleLineTypes,
    exportRoleFilters,
    exportForceSolidStrokes,
    dxfFlipY,
    dxfVersion,
    exportUnit: displayUnit,
    setStatus,
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
    handleCreateBoxStitchFromSelection,
  } = useConstraintActions({
    activeLayer,
    activeLayerId: activeLayer?.id ?? null,
    activeLineTypeId,
    stitchLineTypeId: STITCH_LINE_TYPE_ID,
    layers,
    shapes,
    selectedShapeIds,
    selectedShapeIdSet,
    constraintEdge,
    constraintOffsetMm,
    constraintAxis,
    constraints,
    seamAllowanceInputMm,
    patternPieces,
    seamAllowances,
    snapSettings,
    setShapes,
    setSelectedShapeIds,
    setConstraints,
    setSeamAllowances,
    setStatus,
  })

  const selectedEditableShape =
    selectedShapeIds.length === 1 ? (shapesById[selectedShapeIds[0]] ?? null) : null
  const selectedShapes = useMemo(
    () => selectedShapeIds.map((shapeId) => shapesById[shapeId]).filter((shape): shape is Shape => shape !== undefined),
    [selectedShapeIds, shapesById],
  )
  const selectedPatternPiece = useMemo(() => {
    if (selectedShapeIds.length !== 1) {
      return null
    }
    const selectedShapeId = selectedShapeIds[0]
    return (
      patternPieces.find(
        (piece) => piece.boundaryShapeId === selectedShapeId || piece.internalShapeIds.includes(selectedShapeId),
      ) ?? null
    )
  }, [selectedShapeIds, patternPieces])
  const selectedPieceGrainline = useMemo(
    () => (selectedPatternPiece ? pieceGrainlines.find((entry) => entry.pieceId === selectedPatternPiece.id) ?? null : null),
    [selectedPatternPiece, pieceGrainlines],
  )
  const selectedPieceLabel = useMemo(
    () =>
      selectedPatternPiece
        ? pieceLabels.find((entry) => entry.pieceId === selectedPatternPiece.id && entry.kind === 'piece') ?? null
        : null,
    [selectedPatternPiece, pieceLabels],
  )
  const selectedPatternLabel = useMemo(
    () =>
      selectedPatternPiece
        ? pieceLabels.find((entry) => entry.pieceId === selectedPatternPiece.id && entry.kind === 'pattern') ?? null
        : null,
    [selectedPatternPiece, pieceLabels],
  )
  const selectedPieceSeamAllowance = useMemo(
    () => (selectedPatternPiece ? seamAllowances.find((entry) => entry.pieceId === selectedPatternPiece.id) ?? null : null),
    [selectedPatternPiece, seamAllowances],
  )
  const selectedPieceSeamConnections = useMemo(
    () =>
      selectedPatternPiece
        ? seamConnections
            .filter(
              (connection) =>
                connection.from.pieceId === selectedPatternPiece.id || connection.to.pieceId === selectedPatternPiece.id,
            )
            .map((connection) => {
              const counterpartId =
                connection.from.pieceId === selectedPatternPiece.id ? connection.to.pieceId : connection.from.pieceId
              return {
                connection,
                counterpartPieceName: patternPiecesById[counterpartId]?.name ?? 'Unknown piece',
              }
            })
        : [],
    [selectedPatternPiece, seamConnections, patternPiecesById],
  )
  const selectedPieceNotches = useMemo(
    () => (selectedPatternPiece ? pieceNotches.filter((entry) => entry.pieceId === selectedPatternPiece.id) : []),
    [selectedPatternPiece, pieceNotches],
  )
  const selectedPiecePlacementLabels = useMemo(
    () => (selectedPatternPiece ? piecePlacementLabels.filter((entry) => entry.pieceId === selectedPatternPiece.id) : []),
    [selectedPatternPiece, piecePlacementLabels],
  )
  const selectedPieceInternalShapeIdSet = useMemo(
    () => new Set(selectedPatternPiece?.internalShapeIds ?? []),
    [selectedPatternPiece],
  )
  const selectedPatternPieceEdgeCount = useMemo(() => {
    if (!selectedPatternPiece) {
      return 0
    }
    const chain = getPatternPieceChain(selectedPatternPiece, patternPieceChains.byShapeId)
    return chain ? Math.max(0, chain.polygon.length - 1) : 0
  }, [selectedPatternPiece, patternPieceChains.byShapeId])
  const pieceEdgeLabels = useMemo(() => {
    if (!(tool === 'seam' || showPieceInspectorModal)) {
      return []
    }

    return patternPieces
      .filter((piece) => visibleLayerIdSet.has(piece.layerId))
      .flatMap((piece) => {
        const chain = getPatternPieceChain(piece, patternPieceChains.byShapeId)
        if (!chain) {
          return []
        }
        return chain.polygon.slice(0, -1).map((point, index) => {
          const next = chain.polygon[index + 1]
          return {
            id: `${piece.id}-edge-${index}`,
            x: (point.x + next.x) / 2,
            y: (point.y + next.y) / 2,
            label: `${index + 1}`,
            active: piece.id === selectedPatternPiece?.id,
          }
        })
      })
  }, [tool, showPieceInspectorModal, patternPieces, visibleLayerIdSet, patternPieceChains.byShapeId, selectedPatternPiece])
  const selectedPieceAvailableInternalShapes = useMemo(() => {
    if (!selectedPatternPiece) {
      return []
    }
    const otherBoundaryShapeIdSet = new Set(
      patternPieces
        .filter((piece) => piece.id !== selectedPatternPiece.id)
        .map((piece) => piece.boundaryShapeId),
    )
    return shapes.filter(
      (shape) =>
        shape.layerId === selectedPatternPiece.layerId &&
        shape.id !== selectedPatternPiece.boundaryShapeId &&
        !otherBoundaryShapeIdSet.has(shape.id),
    )
  }, [selectedPatternPiece, patternPieces, shapes])

  const ensurePatternPieceSupportRecords = (piece: PatternPiece) => {
    if (!pieceGrainlines.some((entry) => entry.pieceId === piece.id)) {
      setPieceGrainlines((previous) => [...previous, createDefaultPieceGrainline(piece.id)])
    }
    if (!pieceLabels.some((entry) => entry.pieceId === piece.id && entry.kind === 'piece')) {
      const defaultPieceLabel = createDefaultPieceLabels(piece).find((entry) => entry.kind === 'piece')
      if (defaultPieceLabel) {
        setPieceLabels((previous) => [...previous, defaultPieceLabel])
      }
    }
    if (!pieceLabels.some((entry) => entry.pieceId === piece.id && entry.kind === 'pattern')) {
      const defaultPatternLabel = createDefaultPieceLabels(piece).find((entry) => entry.kind === 'pattern')
      if (defaultPatternLabel) {
        setPieceLabels((previous) => [...previous, defaultPatternLabel])
      }
    }
    if (!seamAllowances.some((entry) => entry.pieceId === piece.id)) {
      setSeamAllowances((previous) => [...previous, createDefaultPieceSeamAllowance(piece.id)])
    }
  }

  const openSelectedPatternPieceInspector = () => {
    if (!selectedPatternPiece) {
      setStatus('Select a pattern piece first')
      return
    }
    ensurePatternPieceSupportRecords(selectedPatternPiece)
    if (isMobileLayout) {
      setShowPieceInspectorModal(true)
    } else {
      setActiveInspectorTab('piece')
    }
  }

  const handleCreatePatternPieceFromSelection = () => {
    if (selectedShapeIds.length !== 1) {
      setStatus('Select exactly one closed outline to create a pattern piece')
      return
    }
    const boundaryShapeId = selectedShapeIds[0]
    const boundaryShape = shapesById[boundaryShapeId]
    if (!boundaryShape) {
      setStatus('Selected outline could not be resolved')
      return
    }
    const existingPiece = patternPieceByBoundaryShapeId[boundaryShapeId]
    if (existingPiece) {
      ensurePatternPieceSupportRecords(existingPiece)
      if (isMobileLayout) {
        setShowPieceInspectorModal(true)
      } else {
        setActiveInspectorTab('piece')
      }
      setStatus('Pattern piece already exists for this boundary')
      return
    }
    const chain = patternPieceChains.byShapeId.get(boundaryShapeId)
    if (!chain?.isClosed) {
      setStatus('Pattern pieces require a closed outline boundary')
      return
    }

    const piece = createDefaultPatternPiece(boundaryShapeId, boundaryShape.layerId, `Piece ${patternPieces.length + 1}`)
    setPatternPieces((previous) => [...previous, piece])
    setPieceGrainlines((previous) => [...previous, createDefaultPieceGrainline(piece.id)])
    setPieceLabels((previous) => [...previous, ...createDefaultPieceLabels(piece)])
    setSeamAllowances((previous) => [...previous, createDefaultPieceSeamAllowance(piece.id)])
    if (isMobileLayout) {
      setShowPieceInspectorModal(true)
    } else {
      setActiveInspectorTab('piece')
    }
    setStatus(`Created pattern piece "${piece.name}"`)
  }

  const handleUpdateSelectedPatternPiece = (patch: Partial<PatternPiece>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPatternPieces((previous) =>
      previous.map((piece) =>
        piece.id === selectedPatternPiece.id
          ? {
              ...piece,
              ...patch,
            }
          : piece,
      ),
    )
  }

  const handleToggleSelectedPieceInternalShape = (shapeId: string, included: boolean) => {
    if (!selectedPatternPiece) {
      return
    }
    setPatternPieces((previous) =>
      previous.map((piece) => {
        if (piece.id !== selectedPatternPiece.id) {
          return piece
        }
        const internalShapeIds = included
          ? Array.from(new Set([...piece.internalShapeIds, shapeId]))
          : piece.internalShapeIds.filter((entry) => entry !== shapeId)
        return {
          ...piece,
          internalShapeIds,
        }
      }),
    )
  }

  const updateSelectedLabel = (kind: 'piece' | 'pattern', patch: Partial<(typeof pieceLabels)[number]>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPieceLabels((previous) =>
      previous.map((label) =>
        label.pieceId === selectedPatternPiece.id && label.kind === kind
          ? {
              ...label,
              ...patch,
            }
          : label,
      ),
    )
  }

  const handleUpdateSelectedPieceGrainline = (patch: Partial<(typeof pieceGrainlines)[number]>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPieceGrainlines((previous) =>
      previous.map((entry) =>
        entry.pieceId === selectedPatternPiece.id
          ? {
              ...entry,
              ...patch,
            }
          : entry,
      ),
    )
  }

  const handleUpdateSelectedPieceSeamAllowance = (patch: Partial<(typeof seamAllowances)[number]>) => {
    if (!selectedPatternPiece) {
      return
    }
    const nextEdgeOverrides = Array.isArray(patch.edgeOverrides)
      ? patch.edgeOverrides
          .map((entry) => ({
            edgeIndex: Math.max(0, Math.min(Math.max(0, selectedPatternPieceEdgeCount - 1), Math.round(entry.edgeIndex))),
            offsetMm: Math.max(0.1, entry.offsetMm),
          }))
          .sort((left, right) => left.edgeIndex - right.edgeIndex)
      : undefined
    setSeamAllowances((previous) =>
      previous.map((entry) =>
        entry.pieceId === selectedPatternPiece.id
          ? {
              ...entry,
              ...patch,
              edgeOverrides: nextEdgeOverrides ?? entry.edgeOverrides,
            }
          : entry,
      ),
    )
  }

  const handleUpdateSelectedPieceSeamConnection = (connectionId: string, patch: Partial<(typeof seamConnections)[number]>) => {
    if (!selectedPatternPiece) {
      return
    }
    setSeamConnections((previous) =>
      previous.map((connection) => {
        if (
          connection.id !== connectionId ||
          (connection.from.pieceId !== selectedPatternPiece.id && connection.to.pieceId !== selectedPatternPiece.id)
        ) {
          return connection
        }
        return {
          ...connection,
          ...patch,
          stitchSpacingMm:
            'stitchSpacingMm' in patch
              ? typeof patch.stitchSpacingMm === 'number'
                ? Math.max(0, patch.stitchSpacingMm)
                : undefined
              : connection.stitchSpacingMm,
        }
      }),
    )
  }

  const handleUpdateSelectedPieceNotch = (notchId: string, patch: Partial<(typeof pieceNotches)[number]>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPieceNotches((previous) =>
      previous.map((entry) => {
        if (entry.id !== notchId || entry.pieceId !== selectedPatternPiece.id) {
          return entry
        }
        return {
          ...entry,
          ...patch,
          edgeIndex:
            typeof patch.edgeIndex === 'number'
              ? Math.max(0, Math.min(Math.max(0, selectedPatternPieceEdgeCount - 1), Math.round(patch.edgeIndex)))
              : entry.edgeIndex,
          t: typeof patch.t === 'number' ? clamp(patch.t, 0, 1) : entry.t,
          lengthMm: typeof patch.lengthMm === 'number' ? Math.max(0.5, patch.lengthMm) : entry.lengthMm,
          widthMm: typeof patch.widthMm === 'number' ? Math.max(0, patch.widthMm) : entry.widthMm,
        }
      }),
    )
  }

  const handleAddSelectedPiecePlacementLabel = () => {
    if (!selectedPatternPiece) {
      return
    }
    setPiecePlacementLabels((previous) => [...previous, createDefaultPiecePlacementLabel(selectedPatternPiece.id)])
  }

  const handleUpdateSelectedPiecePlacementLabel = (labelId: string, patch: Partial<PiecePlacementLabel>) => {
    if (!selectedPatternPiece) {
      return
    }
    setPiecePlacementLabels((previous) =>
      previous.map((entry) => {
        if (entry.id !== labelId || entry.pieceId !== selectedPatternPiece.id) {
          return entry
        }
        return {
          ...entry,
          ...patch,
          edgeIndex:
            typeof patch.edgeIndex === 'number'
              ? Math.max(0, Math.min(Math.max(0, selectedPatternPieceEdgeCount - 1), Math.round(patch.edgeIndex)))
              : entry.edgeIndex,
          t: typeof patch.t === 'number' ? clamp(patch.t, 0, 1) : entry.t,
          widthMm: typeof patch.widthMm === 'number' ? Math.max(0.5, patch.widthMm) : entry.widthMm,
          heightMm: typeof patch.heightMm === 'number' ? Math.max(0.5, patch.heightMm) : entry.heightMm,
        }
      }),
    )
  }

  const handleDeleteSelectedPiecePlacementLabel = (labelId: string) => {
    setPiecePlacementLabels((previous) => previous.filter((entry) => entry.id !== labelId))
  }

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
            }
          : entry,
      ),
    )
  }

  const handleApplyTextDefaultsToSelection = () => {
    if (selectedShapeIdSet.size === 0) {
      setStatus('Select one or more text shapes first')
      return
    }

    let updatedCount = 0
    setShapes((previous) =>
      previous.map((shape) => {
        if (!selectedShapeIdSet.has(shape.id) || shape.type !== 'text') {
          return shape
        }
        updatedCount += 1
        return {
          ...shape,
          text: textDraftValue.trim().length > 0 ? textDraftValue.trim() : shape.text,
          fontFamily: textFontFamily,
          fontSizeMm: Math.max(2, Math.min(120, textFontSizeMm)),
          transform: textTransformMode,
          radiusMm: Math.max(2, Math.min(2000, textRadiusMm)),
          sweepDeg: Math.max(-1080, Math.min(1080, textSweepDeg)),
        }
      }),
    )

    if (updatedCount === 0) {
      setStatus('Selected shapes do not include text')
      return
    }
    setStatus(`Updated ${updatedCount} text shape${updatedCount === 1 ? '' : 's'}`)
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
    setStatus,
    shapes,
    lineTypesById,
    stitchPitchMm,
    stitchVariablePitchStartMm,
    stitchVariablePitchEndMm,
    stitchHoleType,
    selectedStitchHole,
    shapesById,
    layers,
    stitchHoleCountsByShape,
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
    setDxfFlipY(false)
    setDxfVersion('r12')
  }

  const annotationLineTypeId = useMemo(
    () => lineTypes.find((lineType) => lineType.role === 'mark')?.id ?? lineTypes[0]?.id ?? activeLineTypeId,
    [lineTypes, activeLineTypeId],
  )
  const printableAnnotationShapes = useMemo(
    () =>
      buildAnnotationExportShapes({
        showAnnotations,
        onlySelected: printSelectedOnly,
        selectedShapeIdSet,
        patternPiecesById,
        annotationLabels,
        pieceGrainlineSegments,
        pieceNotchLines,
        piecePlacementGuides,
        fallbackLayerId: activeLayerId,
        annotationLineTypeId,
      }),
    [
      showAnnotations,
      printSelectedOnly,
      selectedShapeIdSet,
      patternPiecesById,
      annotationLabels,
      pieceGrainlineSegments,
      pieceNotchLines,
      piecePlacementGuides,
      activeLayerId,
      annotationLineTypeId,
    ],
  )
  const printOutputShapes = useMemo(
    () => [...printableShapes, ...printableAnnotationShapes],
    [printableShapes, printableAnnotationShapes],
  )
  const printOutputPlan = useMemo(
    () =>
      buildPrintPlan(printOutputShapes, {
        paper: printPaper,
        marginMm: printMarginMm,
        overlapMm: printOverlapMm,
        tileX: printTileX,
        tileY: printTileY,
        scalePercent: printScalePercent,
      }),
    [printOutputShapes, printPaper, printMarginMm, printOverlapMm, printTileX, printTileY, printScalePercent],
  )

  const handleOpenPrintTiles = () => {
    if (!printOutputPlan || printOutputShapes.length === 0) {
      setStatus('No printable content available')
      return
    }

    const opened = openPrintTilesWindow({
      shapes: printOutputShapes,
      foldLines,
      lineTypesById,
      printPlan: printOutputPlan,
      printInColor,
      printStitchAsDots,
      printRulerInside,
      calibrationXPercent: printCalibrationXPercent,
      calibrationYPercent: printCalibrationYPercent,
    })

    if (!opened) {
      setStatus('Could not open print window (popup may be blocked)')
      return
    }

    setStatus(`Opened printable tiles (${printOutputPlan.tiles.length} page${printOutputPlan.tiles.length === 1 ? '' : 's'})`)
  }

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
    isMobileLayout,
    desktopRibbonTab,
    setDesktopRibbonTab,
    selectedShapeCount,
    selectedStitchHoleCount,
    showThreePreview,
    onOpenPrecisionModal: () => setShowPrecisionModal(true),
    onOpenProjectMemoModal: () => setShowProjectMemoModal(true),
    setShowHelpModal,
    showToolSection,
    tool,
    setActiveTool,
    mobileViewMode,
    setMobileViewMode,
    showMobileMenu,
    setShowMobileMenu,
    mobileOptionsTab,
    setMobileOptionsTab,
    handleLoadPreset,
    handleSetThemeMode,
    themeMode,
    showZoomSection,
    displayUnit,
    setDisplayUnit,
    showCanvasRuler,
    setShowCanvasRuler,
    showDimensions,
    setShowDimensions,
    gridSpacing,
    setGridSpacing,
    sketchWorkspaceMode,
    setSketchWorkspaceMode,
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
    activeLineType,
    lineTypes,
    setActiveLineTypeId,
    handleToggleActiveLineTypeVisibility,
    setShowLineTypePalette,
    showStitchSection,
    stitchHoleType,
    setStitchHoleType,
    stitchPitchMm,
    setStitchPitchMm,
    stitchVariablePitchStartMm,
    stitchVariablePitchEndMm,
    setStitchVariablePitchStartMm,
    setStitchVariablePitchEndMm,
    handleAutoPlaceFixedPitchStitchHoles,
    handleAutoPlaceVariablePitchStitchHoles,
    handleResequenceSelectedStitchHoles,
    handleSelectNextStitchHole,
    handleFixStitchHoleOrderFromSelected,
    showStitchSequenceLabels,
    setShowStitchSequenceLabels,
    handleCountStitchHolesOnSelectedShapes,
    handleDeleteStitchHolesOnSelectedShapes,
    handleClearAllStitchHoles,
    stitchHolesLength: stitchHoles.length,
    hasSelectedStitchHole: selectedStitchHole !== null,
    showLayerSection,
    activeLayer,
    layers,
    layerStackLevels,
    setActiveLayerId,
    clearDraft,
    mobileLayerAction,
    setMobileLayerAction,
    handleRunMobileLayerAction,
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
    setShowLayerColorModal,
    showFileSection,
    mobileFileAction,
    setMobileFileAction,
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
    setShowExportModal,
    setShowExportOptionsModal,
    setShowPatternToolsModal,
    setShowTemplateRepositoryModal,
    setShowTracingModal,
    tracingOverlaysLength: tracingOverlays.length,
    setShowPrintPreviewModal,
    showPrintAreas,
    setShowPrintAreas,
    setShowThreePreview,
    resetDocument,
  })
  const modalStackProps = useEditorModalStackProps({
    showLineTypePalette,
    setShowLineTypePalette,
    lineTypes,
    setLineTypes,
    activeLineType,
    shapeCountsByLineType,
    selectedShapeCount,
    setActiveLineTypeId,
    handleShowAllLineTypes,
    handleIsolateActiveLineType,
    handleUpdateActiveLineTypeRole,
    handleUpdateActiveLineTypeStyle,
    handleUpdateActiveLineTypeColor,
    handleSelectShapesByActiveLineType,
    handleAssignSelectedToActiveLineType,
    handleClearShapeSelection,
    showHelpModal,
    setShowHelpModal,
    showLayerColorModal,
    setShowLayerColorModal,
    layers,
    layerColorsById,
    layerColorOverrides,
    frontLayerColor,
    backLayerColor,
    setFrontLayerColor,
    setBackLayerColor,
    handleSetLayerColorOverride,
    handleClearLayerColorOverride,
    handleResetLayerColors,
    showExportModal,
    setShowExportModal,
    showExportOptionsModal,
    setShowExportOptionsModal,
    handleSaveJson,
    handleExportGarmentJson,
    handleSaveLcc,
    handleExportSvg,
    handleExportPdf,
    handleExportDxf,
    handleExportLaserSvg,
    activeExportRoleCount,
    exportOnlySelectedShapes,
    setExportOnlySelectedShapes,
    exportOnlyVisibleLineTypes,
    setExportOnlyVisibleLineTypes,
    exportForceSolidStrokes,
    setExportForceSolidStrokes,
    exportRoleFilters,
    setExportRoleFilters,
    dxfVersion,
    setDxfVersion,
    dxfFlipY,
    setDxfFlipY,
    handleResetExportOptions,
    showTemplateRepositoryModal,
    setShowTemplateRepositoryModal,
    templateRepository,
    catalogRepository: mergedCatalogRepository,
    selectedTemplateEntryId,
    selectedTemplateEntry,
    selectedCatalogShopId,
    selectedPresetId,
    setSelectedTemplateEntryId,
    setSelectedCatalogShopId,
    setSelectedPresetId,
    handleSaveTemplateToRepository,
    handleExportTemplateRepository,
    templateImportInputRef,
    catalogImportInputRef,
    handleLoadPreset,
    handleLoadTemplateAsDocument,
    handleInsertTemplateIntoDocument,
    handleDeleteTemplateFromRepository,
    handleDeleteCatalogShop,
    showPatternToolsModal,
    setShowPatternToolsModal,
    showAiBuilderModal,
    setShowAiBuilderModal,
    snapSettings,
    setSnapSettings,
    handleAlignSelection,
    handleAlignSelectionToGrid,
    activeLayer,
    activeLayerId,
    sketchGroups,
    activeSketchGroup,
    setActiveSketchGroupId,
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
    showAnnotations,
    setShowAnnotations,
    constraintEdge,
    setConstraintEdge,
    constraintOffsetMm,
    setConstraintOffsetMm,
    constraintAxis,
    setConstraintAxis,
    handleAddEdgeConstraintFromSelection,
    handleAddAlignConstraintsFromSelection,
    handleApplyConstraints,
    constraints,
    handleToggleConstraintEnabled,
    handleDeleteConstraint,
    seamAllowanceInputMm,
    setSeamAllowanceInputMm,
    handleApplySeamAllowanceToSelection,
    handleClearSeamAllowanceOnSelection,
    handleClearAllSeamAllowances,
    seamAllowancesLength: seamAllowances.length,
    handleBevelSelectedCorner,
    handleRoundSelectedCorner,
    handleCreateOffsetGeometryFromSelection,
    handleCreateBoxStitchFromSelection,
    selectedEditableShape,
    handleUpdateSelectedShapePoint,
    textDraftValue,
    setTextDraftValue,
    textFontFamily,
    setTextFontFamily,
    textFontSizeMm,
    setTextFontSizeMm,
    textTransformMode,
    setTextTransformMode,
    textRadiusMm,
    setTextRadiusMm,
    textSweepDeg,
    setTextSweepDeg,
    handleApplyTextDefaultsToSelection,
    hardwarePreset,
    setHardwarePreset,
    customHardwareDiameterMm,
    setCustomHardwareDiameterMm,
    customHardwareSpacingMm,
    setCustomHardwareSpacingMm,
    setActiveTool,
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
    showTracingModal,
    setShowTracingModal,
    tracingOverlays,
    activeTracingOverlay,
    tracingInputRef,
    handleDeleteTracingOverlay,
    setActiveTracingOverlayId,
    handleUpdateTracingOverlay,
    handleSetPdfTracingPage,
    showPrintPreviewModal,
    setShowPrintPreviewModal,
    printPaper,
    setPrintPaper,
    printScalePercent,
    setPrintScalePercent,
    printCalibrationXPercent,
    setPrintCalibrationXPercent,
    printCalibrationYPercent,
    setPrintCalibrationYPercent,
    printTileX,
    setPrintTileX,
    printTileY,
    setPrintTileY,
    printOverlapMm,
    setPrintOverlapMm,
    printMarginMm,
    setPrintMarginMm,
    printSelectedOnly,
    setPrintSelectedOnly,
    printRulerInside,
    setPrintRulerInside,
    printInColor,
    setPrintInColor,
    printStitchAsDots,
    setPrintStitchAsDots,
    printPlan: printOutputPlan,
    showPrintAreas,
    setShowPrintAreas,
    handleFitView,
    handleOpenPrintTiles,
    handleLoadAiBuilderDocument,
    handleInsertAiBuilderDocument,
    setStatus,
  })
  const previewPaneProps = useEditorPreviewPaneProps({
    showSidePanel: showThreePreview,
    hidePreviewPane,
    isMobileLayout,
    mobileViewMode,
    sidePanelTab,
    onSetSidePanelTab: setSidePanelTab,
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
    setFoldLines,
    setLayers,
    activeLayer,
    layerStackLevels,
    layerColorsById,
    onSetActiveLayerId: setActiveLayerId,
    onClearDraft: clearDraft,
    onAddLayer: handleAddLayer,
    onRenameActiveLayer: handleRenameActiveLayer,
    onMoveLayerUp: () => handleMoveLayer(-1),
    onMoveLayerDown: () => handleMoveLayer(1),
    onDeleteLayer: handleDeleteLayer,
    onOpenLayerColorModal: () => setShowLayerColorModal(true),
    show3dInMain,
    onToggle3dInMain: () => {
      setShow3dInMain((prev) => {
        if (!prev) {
          setSidePanelTab('3d')
          setShowThreePreview(true)
        }
        return !prev
      })
    },
  })
  const statusBarProps = useEditorStatusBarProps({
    toolLabel: toolLabel(tool),
    status,
    displayUnit,
    zoomPercent: Math.round(viewport.scale * 100),
    visibleShapeCount: workspaceShapes.length,
    shapeCount: shapes.length,
    layerCount: layers.length,
    sketchGroupCount: sketchGroups.length,
    lineTypes,
    foldLineCount: foldLines.length,
    stitchHoleCount: stitchHoles.length,
    seamAllowanceCount: seamAllowances.length,
    constraintCount: constraints.length,
    hardwareMarkerCount: hardwareMarkers.length,
    tracingOverlayCount: tracingOverlays.length,
    templateCount: templateRepository.length,
  })
  const selectedPieceIds = useMemo(
    () =>
      patternPieces
        .filter((piece) => selectedShapeIdSet.has(piece.boundaryShapeId))
        .map((piece) => piece.id),
    [patternPieces, selectedShapeIdSet],
  )
  const selectionContext = useInspectorModel({
    selectedShapes,
    selectedPatternPiece,
    selectedStitchHole,
    selectedHardwareMarker,
  })
  const browserNodes = useDocumentBrowserModel({
    patternPieces,
    pieceLabels,
    seamAllowances,
    pieceNotches,
    piecePlacementLabels,
    seamConnections,
    selectedPieceIds,
    layers,
    activeLayerId,
    sketchGroups,
    activeSketchGroupId,
    tracingOverlays,
    activeTracingOverlayId,
    avatars,
    threeTextureSource,
  })
  const quickActions = useQuickActions({ canUndo, canRedo })
  const ribbonGroups = useRibbonModel({
    activeTab: workbenchRibbonTab,
    canUndo,
    canRedo,
    canPaste: true,
    selectedShapeCount,
    selectedPatternPiece: selectedPatternPiece !== null,
    selectedStitchHole: selectedStitchHole !== null,
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
  const docLabel = documentName ?? patternPieces[0]?.name ?? 'Current Draft'
  const selectionText =
    selectedShapeCount > 0
      ? `${selectedShapeCount} shape${selectedShapeCount === 1 ? '' : 's'}`
      : selectedStitchHole
        ? `Stitch hole ${selectedStitchHole.sequence}`
        : selectedHardwareMarker
          ? selectedHardwareMarker.label || 'Hardware marker'
          : 'No selection'

  useEffect(() => {
    if (!isMobileLayout && workspaceMode === '3d') {
      setActiveInspectorTab('preview3d')
    }
  }, [isMobileLayout, workspaceMode, setActiveInspectorTab])

  const handleWorkbenchQuickAction = (actionId: string) => {
    switch (actionId) {
      case 'save-json':
        handleSaveJson()
        break
      case 'undo':
        handleUndo()
        break
      case 'redo':
        handleRedo()
        break
      case 'help':
        setShowHelpModal(true)
        break
      default:
        break
    }
  }

  const handleWorkbenchRibbonCommand = (commandId: string) => {
    switch (commandId) {
      case 'fit-view':
        handleFitView()
        break
      case 'reset-view':
        handleResetView()
        break
      case 'toggle-ruler':
        setShowCanvasRuler((previous) => !previous)
        break
      case 'toggle-dimensions':
        setShowDimensions((previous) => !previous)
        break
      case 'load-preset':
        handleLoadPreset()
        break
      case 'toggle-annotations':
        setShowAnnotations((previous) => !previous)
        break
      case 'undo':
        handleUndo()
        break
      case 'redo':
        handleRedo()
        break
      case 'copy':
        handleCopySelection()
        break
      case 'paste':
        void handlePasteClipboard()
        break
      case 'delete':
        handleDeleteSelection()
        break
      case 'move-distance':
        handleMoveSelectionByDistance()
        break
      case 'rotate':
      case 'rotate-5':
        handleRotateSelection(5)
        break
      case 'scale-up':
        handleScaleSelection(1.05)
        break
      case 'create-piece':
        handleCreatePatternPieceFromSelection()
        break
      case 'open-piece':
      case 'piece-tab':
        openSelectedPatternPieceInspector()
        break
      case 'apply-seam-allowance':
        handleApplySeamAllowanceToSelection()
        break
      case 'open-nesting':
        setShowNestingModal(true)
        break
      case 'place-fixed-stitch':
        handleAutoPlaceFixedPitchStitchHoles()
        break
      case 'place-variable-stitch':
        handleAutoPlaceVariablePitchStitchHoles()
        break
      case 'count-stitches':
        handleCountStitchHolesOnSelectedShapes()
        break
      case 'resequence-stitches':
        handleResequenceSelectedStitchHoles(false)
        break
      case 'next-stitch':
        handleSelectNextStitchHole()
        break
      case 'clear-stitches':
        handleClearAllStitchHoles()
        break
      case 'save-json':
        handleSaveJson()
        break
      case 'load-json':
        fileInputRef.current?.click()
        break
      case 'import-svg':
        svgInputRef.current?.click()
        break
      case 'export-svg':
        handleExportSvg()
        break
      case 'export-pdf':
        handleExportPdf()
        break
      case 'export-dxf':
        handleExportDxf()
        break
      case 'print-preview':
        setShowPrintPreviewModal(true)
        break
      case 'template-repository':
        setShowTemplateRepositoryModal(true)
        break
      case 'tracing':
        setShowTracingModal(true)
        break
      case 'ai-builder':
        setShowAiBuilderModal(true)
        break
      default:
        break
    }
  }

  const handleWorkbenchActivateNode = (node: DocumentBrowserNode, multi: boolean) => {
    const parts = node.id.split(':')
    switch (node.kind) {
      case 'piece':
      case 'piece-label':
      case 'pattern-label':
      case 'seam-allowance':
      case 'notch':
      case 'placement-label':
      case 'seam-connection': {
        const pieceId = node.kind === 'piece' ? parts[1] : parts[1]
        const piece = patternPiecesById[pieceId]
        if (!piece) {
          return
        }
        ensurePatternPieceSupportRecords(piece)
        setSelectedShapeIds((previous) => {
          if (!multi) {
            return [piece.boundaryShapeId]
          }
          const next = previous.includes(piece.boundaryShapeId)
            ? previous.filter((entry) => entry !== piece.boundaryShapeId)
            : [...previous, piece.boundaryShapeId]
          return next
        })
        setActiveInspectorTab('piece')
        break
      }
      case 'layer': {
        const layerId = parts[1]
        setActiveLayerId(layerId)
        clearDraft()
        setActiveInspectorTab('document')
        break
      }
      case 'layer-group': {
        setActiveInspectorTab('document')
        break
      }
      case 'sketch': {
        const sketchId = parts[1]
        setActiveSketchGroupId(sketchId)
        setActiveInspectorTab('document')
        break
      }
      case 'tracing-overlay': {
        const overlayId = parts[1]
        setActiveTracingOverlayId(overlayId)
        setActiveInspectorTab('document')
        break
      }
      case 'avatar':
      case 'texture-source':
      case 'preview-settings':
        setActiveInspectorTab('preview3d')
        break
      default:
        break
    }
  }

  const handleToggleLayerVisibilityById = (layerId: string) =>
    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              visible: !layer.visible,
            }
          : layer,
      ),
    )

  const handleToggleLayerLockById = (layerId: string) =>
    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              locked: !layer.locked,
            }
          : layer,
      ),
    )

  const handleToggleTracingVisibilityById = (overlayId: string) =>
    setTracingOverlays((previous) =>
      previous.map((overlay) =>
        overlay.id === overlayId
          ? {
              ...overlay,
              visible: !overlay.visible,
            }
          : overlay,
      ),
    )

  const handleToggleTracingLockById = (overlayId: string) =>
    setTracingOverlays((previous) =>
      previous.map((overlay) =>
        overlay.id === overlayId
          ? {
              ...overlay,
              locked: !overlay.locked,
            }
          : overlay,
      ),
    )

  const handleToggleWorkbenchPeek = () => {
    setSecondaryPreviewMode((previous) => {
      if (previous !== 'hidden') {
        return 'hidden'
      }
      return workspaceMode === '2d' ? '3d-peek' : '2d-peek'
    })
  }

  const handleSetWorkbenchMode = (mode: '2d' | '3d') => {
    setWorkspaceMode(mode)
    setSecondaryPreviewMode((previous) => {
      if (previous === 'hidden') {
        return previous
      }
      return mode === '2d' ? '3d-peek' : '2d-peek'
    })
  }

  const workbenchTwoDPane = (
    <ErrorBoundary>
      <EditorCanvasPane
        hideCanvasPane={false}
        svgRef={svgRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        viewport={viewport}
        displayUnit={displayUnit}
        gridLines={gridLines}
        showCanvasRuler={showCanvasRuler}
        showDimensions={showDimensions}
        onZoomOut={() => handleZoomStep(0.85)}
        onZoomIn={() => handleZoomStep(1.15)}
        onFitView={handleFitView}
        onResetView={handleResetView}
        tracingOverlays={tracingOverlays}
        showPrintAreas={showPrintAreas}
        dimensionLines={dimensionLines}
        printPlan={printOutputPlan}
        seamGuides={seamGuides}
        pieceEdgeLabels={pieceEdgeLabels}
        showAnnotations={showAnnotations}
        pieceGrainlineSegments={pieceGrainlineSegments}
        pieceNotchLines={pieceNotchLines}
        piecePlacementGuides={piecePlacementGuides}
        visibleShapes={workspaceEditableShapes}
        linkedShapes={workspaceLinkedShapes}
        sketchWorkspaceMode={sketchWorkspaceMode}
        lineTypes={lineTypes}
        lineTypesById={lineTypesById}
        selectedShapeIdSet={selectedShapeIdSet}
        stitchStrokeColor={stitchStrokeColor}
        foldStrokeColor={foldStrokeColor}
        cutStrokeColor={cutStrokeColor}
        displayLayerColorsById={displayLayerColorsById}
        onShapePointerDown={handleShapePointerDown}
        onShapeHandlePointerDown={handleShapeHandlePointerDown}
        showShapeHandles={tool === 'pan'}
        visibleStitchHoles={workspaceStitchHoles}
        selectedStitchHoleId={selectedStitchHoleId}
        showStitchSequenceLabels={showStitchSequenceLabels}
        onStitchHolePointerDown={handleStitchHolePointerDown}
        visibleHardwareMarkers={workspaceHardwareMarkers}
        selectedHardwareMarkerId={selectedHardwareMarkerId}
        onHardwarePointerDown={handleHardwarePointerDown}
        foldLines={foldLines}
        annotationLabels={annotationLabels}
        constraintSuggestions={constraintSuggestions}
        previewElement={previewElement}
        showLayerLegend={showLayerLegend}
        legendMode={legendMode}
        onSetLegendMode={setLegendMode}
        layers={layers}
        layerColorsById={layerColorsById}
        fallbackLayerStroke={fallbackLayerStroke}
        stackLegendEntries={stackLegendEntries}
        outlineChains={outlineChains}
      />
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
      onCreateBoxStitch={handleCreateBoxStitchFromSelection}
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
      onUpdateSelectedShapePoint={handleUpdateSelectedShapePoint}
      onUpdateSelectedStitchHole={handleUpdateSelectedStitchHole}
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
                <EditorCanvasPane
                  hideCanvasPane={hideCanvasPane}
                  svgRef={svgRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  viewport={viewport}
                  displayUnit={displayUnit}
                  gridLines={gridLines}
                  showCanvasRuler={showCanvasRuler}
                  showDimensions={showDimensions}
                  onZoomOut={() => handleZoomStep(0.85)}
                  onZoomIn={() => handleZoomStep(1.15)}
                  onFitView={handleFitView}
                  onResetView={handleResetView}
                  tracingOverlays={tracingOverlays}
                  showPrintAreas={showPrintAreas}
                  dimensionLines={dimensionLines}
                  printPlan={printOutputPlan}
                  seamGuides={seamGuides}
                  pieceEdgeLabels={pieceEdgeLabels}
                  showAnnotations={showAnnotations}
                  pieceGrainlineSegments={pieceGrainlineSegments}
                  pieceNotchLines={pieceNotchLines}
                  piecePlacementGuides={piecePlacementGuides}
                  visibleShapes={workspaceEditableShapes}
                  linkedShapes={workspaceLinkedShapes}
                  sketchWorkspaceMode={sketchWorkspaceMode}
                  lineTypes={lineTypes}
                  lineTypesById={lineTypesById}
                  selectedShapeIdSet={selectedShapeIdSet}
                  stitchStrokeColor={stitchStrokeColor}
                  foldStrokeColor={foldStrokeColor}
                  cutStrokeColor={cutStrokeColor}
                  displayLayerColorsById={displayLayerColorsById}
                  onShapePointerDown={handleShapePointerDown}
                  onShapeHandlePointerDown={handleShapeHandlePointerDown}
                  showShapeHandles={tool === 'pan'}
                  visibleStitchHoles={workspaceStitchHoles}
                  selectedStitchHoleId={selectedStitchHoleId}
                  showStitchSequenceLabels={showStitchSequenceLabels}
                  onStitchHolePointerDown={handleStitchHolePointerDown}
                  visibleHardwareMarkers={workspaceHardwareMarkers}
                  selectedHardwareMarkerId={selectedHardwareMarkerId}
                  onHardwarePointerDown={handleHardwarePointerDown}
                  foldLines={foldLines}
                  annotationLabels={annotationLabels}
                  constraintSuggestions={constraintSuggestions}
                  previewElement={previewElement}
                  showLayerLegend={showLayerLegend}
                  legendMode={legendMode}
                  onSetLegendMode={setLegendMode}
                  layers={layers}
                  layerColorsById={layerColorsById}
                  fallbackLayerStroke={fallbackLayerStroke}
                  stackLegendEntries={stackLegendEntries}
                  outlineChains={outlineChains}
                />
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
        <EditorModalStack {...modalStackProps} />
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
