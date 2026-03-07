import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import '../../app/styles/App.css'
import type {
  DocFile,
  FoldLine,
  HardwareMarker,
  LineType,
  ParametricConstraint,
  SeamAllowance,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  TextureSource,
  TracingOverlay,
} from './cad/cad-types'
import { EditorCanvasPane } from './components/EditorCanvasPane'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EditorHiddenInputs } from './components/EditorHiddenInputs'
import { EditorModalStack } from './components/EditorModalStack'
import { EditorPreviewPane } from './components/EditorPreviewPane'
import { EditorStatusBar } from './components/EditorStatusBar'
import { EditorTopbar } from './components/EditorTopbar'
import { ContextualActionsPanel } from './components/ContextualActionsPanel'
import { PrecisionCommandPanel } from './components/PrecisionCommandPanel'
const ProjectMemoModal = lazy(() =>
  import('./components/ProjectMemoModal').then((mod) => ({ default: mod.ProjectMemoModal })),
)
import {
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  STITCH_LINE_TYPE_ID,
  createDefaultLineTypes,
} from './cad/line-types'
import { DEFAULT_PRESET_ID } from './data/sample-doc'
import { safeLocalStorageGet, safeLocalStorageRemove } from './ops/safe-storage'
import { parseImportedJsonDocument } from './editor-json-import'
import {
  hasTemplateRepositoryStorage,
  loadTemplateRepository,
  type TemplateRepositoryEntry,
} from './templates/template-repository'
import { createBuiltinTemplateRepository } from './templates/template-builtins'
import {
  loadBundledCatalogRepository,
  loadCatalogRepository,
  saveCatalogRepository,
  type CatalogRepositoryShop,
} from './templates/catalog-repository'
import type { ClipboardPayload } from './ops/shape-selection-ops'

import {
  DESKTOP_TOOL_ICON_ITEMS,
  DEFAULT_EXPORT_ROLE_FILTERS,
  DEFAULT_SNAP_SETTINGS,
} from './editor-constants'
import { openPrintTilesWindow } from './preview/print-output'
import type {
  DesktopRibbonTab,
  LegendMode,
  MobileFileAction,
  MobileLayerAction,
  MobileOptionsTab,
  MobileViewMode,
  ResolvedThemeMode,
  SketchWorkspaceMode,
  ThemeMode,
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
import { useEditorViewport, DESKTOP_SPLITTER_WIDTH_PX } from './hooks/useEditorViewport'
import { useEditorLayers } from './hooks/useEditorLayers'
import { useEditorTools } from './hooks/useEditorTools'
import { useEditorHistory } from './hooks/useEditorHistory'
import type { DisplayUnit } from './ops/unit-ops'

const OPEN_DOC_TRANSFER_PREFIX = 'leathercraft-open-doc-'

const getSystemThemeMode = (): ResolvedThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function EditorApp() {
  const [lineTypes, setLineTypes] = useState<LineType[]>(() => createDefaultLineTypes())
  const [activeLineTypeId, setActiveLineTypeId] = useState(DEFAULT_ACTIVE_LINE_TYPE_ID)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [foldLines, setFoldLines] = useState<FoldLine[]>([])
  const [stitchHoles, setStitchHoles] = useState<StitchHole[]>([])
  const [sketchGroups, setSketchGroups] = useState<SketchGroup[]>([])
  const [activeSketchGroupId, setActiveSketchGroupId] = useState<string | null>(null)
  const [constraints, setConstraints] = useState<ParametricConstraint[]>([])
  const [seamAllowances, setSeamAllowances] = useState<SeamAllowance[]>([])
  const [hardwareMarkers, setHardwareMarkers] = useState<HardwareMarker[]>([])
  const [snapSettings, setSnapSettings] = useState<SnapSettings>(DEFAULT_SNAP_SETTINGS)
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [status, setStatus] = useState('Ready')
  const [showThreePreview, setShowThreePreview] = useState(true)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('editor')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [mobileOptionsTab, setMobileOptionsTab] = useState<MobileOptionsTab>('view')
  const [showPrecisionModal, setShowPrecisionModal] = useState(false)
  const [showProjectMemoModal, setShowProjectMemoModal] = useState(false)
  const [desktopRibbonTab, setDesktopRibbonTab] = useState<DesktopRibbonTab>('build')
  const [mobileLayerAction, setMobileLayerAction] = useState<MobileLayerAction>('add')
  const [mobileFileAction, setMobileFileAction] = useState<MobileFileAction>('save-json')
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>('mm')
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
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([])
  const [selectedStitchHoleId, setSelectedStitchHoleId] = useState<string | null>(null)
  const [selectedHardwareMarkerId, setSelectedHardwareMarkerId] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [systemThemeMode, setSystemThemeMode] = useState<ResolvedThemeMode>(() => getSystemThemeMode())
  const [legendMode, setLegendMode] = useState<LegendMode>('layer')
  const [sketchWorkspaceMode, setSketchWorkspaceMode] = useState<SketchWorkspaceMode>('assembly')
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_ID)
  const [projectMemo, setProjectMemo] = useState('')
  const [stitchAlwaysShapeIds, setStitchAlwaysShapeIds] = useState<string[]>([])
  const [stitchThreadColor, setStitchThreadColor] = useState('#fb923c')
  const [threeTextureSource, setThreeTextureSource] = useState<TextureSource | null>(null)
  const [threeTextureShapeIds, setThreeTextureShapeIds] = useState<string[]>([])
  const [showCanvasRuler, setShowCanvasRuler] = useState(true)
  const [showDimensions, setShowDimensions] = useState(false)
  const [tracingOverlays, setTracingOverlays] = useState<TracingOverlay[]>([])
  const [activeTracingOverlayId, setActiveTracingOverlayId] = useState<string | null>(null)
  const [templateRepository, setTemplateRepository] = useState<TemplateRepositoryEntry[]>(() => {
    const saved = loadTemplateRepository()
    if (saved.length > 0 || hasTemplateRepositoryStorage()) {
      return saved
    }
    return createBuiltinTemplateRepository()
  })
  const [selectedTemplateEntryId, setSelectedTemplateEntryId] = useState<string | null>(null)
  const [catalogRepository, setCatalogRepository] = useState<CatalogRepositoryShop[]>(() => loadCatalogRepository())
  const [bundledCatalogRepository] = useState<CatalogRepositoryShop[]>(() => loadBundledCatalogRepository())
  const [selectedCatalogShopId, setSelectedCatalogShopId] = useState<string | null>(
    () => catalogRepository[0]?.id ?? bundledCatalogRepository[0]?.id ?? null,
  )
  const [clipboardPayload, setClipboardPayload] = useState<ClipboardPayload | null>(null)
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
    lastSnapshotRef,
    lastSnapshotSignatureRef,
    applyingHistoryRef,
  } = useEditorHistory()

  const {
    viewport,
    setViewport,
    desktopPreviewWidthPx,
    isDesktopPreviewResizing,
    workspaceRef,
    handleDesktopSplitterPointerDown,
  } = useEditorViewport({ isMobileLayout, showThreePreview })

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
  }, [])

  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const svgInputRef = useRef<HTMLInputElement | null>(null)
  const tracingInputRef = useRef<HTMLInputElement | null>(null)
  const templateImportInputRef = useRef<HTMLInputElement | null>(null)
  const catalogImportInputRef = useRef<HTMLInputElement | null>(null)
  const pasteCountRef = useRef(0)
  const tracingObjectUrlsRef = useRef<Set<string>>(new Set())
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
    lineTypeStylesById,
    printableShapes,
    printPlan,
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
    seamAllowances,
    hardwareMarkers,
    snapSettings,
    showAnnotations,
    tracingOverlays,
    projectMemo,
    stitchAlwaysShapeIds,
    stitchThreadColor,
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
    setSeamAllowances,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
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
    setSeamAllowances,
    setHardwareMarkers,
    setSnapSettings,
    setShowAnnotations,
    setTracingOverlays,
    setProjectMemo,
    setStitchAlwaysShapeIds,
    setStitchThreadColor,
    setThreeTextureSource,
    setThreeTextureShapeIds,
    setShowCanvasRuler,
    setShowDimensions,
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

  const gridLines = useGridLines()
  const previewElement = useDraftPreviewElement({
    cursorPoint,
    draftPoints,
    tool,
    activeLineTypeStrokeColor,
    activeLineTypeDasharray,
  })

  const { handleUndo, handleRedo } = useHistoryActions({
    historyState,
    currentSnapshot,
    applyEditorSnapshot,
    applyingHistoryRef,
    setHistoryState,
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
    activeLayerId: activeLayer?.id ?? null,
    clipboardPayload,
    pasteCountRef,
    setClipboardPayload,
    setShapes,
    setStitchHoles,
    setSeamAllowances,
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
    seamAllowances,
    hardwareMarkers,
    snapSettings,
    showAnnotations,
    tracingOverlays,
    projectMemo,
    stitchAlwaysShapeIds: stitchAlwaysShapeIds.filter((shapeId) => shapes.some((shape) => shape.id === shapeId)),
    stitchThreadColor,
    threeTextureSource,
    threeTextureShapeIds: threeTextureShapeIds.filter((shapeId) => shapes.some((shape) => shape.id === shapeId)),
    showCanvasRuler,
    showDimensions,
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
    setSeamAllowances,
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
    handleWheel,
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
    lineTypeStylesById,
    sketchGroupsById,
    selectedShapeIdSet,
    visibleLayerIdSet,
    exportOnlySelectedShapes,
    exportOnlyVisibleLineTypes,
    exportRoleFilters,
    exportForceSolidStrokes,
    dxfFlipY,
    dxfVersion,
    exportUnit: displayUnit,
    setStatus,
  })

  const { handleSaveJson, handleLoadJson, handleImportSvg, handleLoadPreset, handleOpenInNewTab } = useFileActions({
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
    seamAllowances,
    hardwareMarkers,
    setSketchGroups,
    setShapes,
    setStitchHoles,
    setSeamAllowances,
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

  const handleOpenPrintTiles = () => {
    if (!printPlan || printableShapes.length === 0) {
      setStatus('No printable content available')
      return
    }

    const opened = openPrintTilesWindow({
      shapes: printableShapes,
      foldLines,
      lineTypesById,
      printPlan,
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

    setStatus(`Opened printable tiles (${printPlan.tiles.length} page${printPlan.tiles.length === 1 ? '' : 's'})`)
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
  const effectiveDesktopPreviewWidthPx = desktopPreviewWidthPx
  const workspaceStyle: CSSProperties | undefined = isMobileLayout
    ? undefined
    : showThreePreview
      ? {
          gridTemplateColumns: `minmax(0, 1fr) ${DESKTOP_SPLITTER_WIDTH_PX}px ${effectiveDesktopPreviewWidthPx}px`,
        }
      : {
          gridTemplateColumns: 'minmax(0, 1fr)',
        }

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
    printPlan,
    showPrintAreas,
    setShowPrintAreas,
    handleFitView,
    handleOpenPrintTiles,
  })
  const previewPaneProps = useEditorPreviewPaneProps({
    showThreePreview,
    hidePreviewPane,
    isMobileLayout,
    mobileViewMode,
    shapes: sketchWorkspaceMode === 'assembly' ? assemblyShapes : workspaceShapes,
    selectedShapeIds,
    stitchHoles: sketchWorkspaceMode === 'assembly' ? visibleStitchHoles : workspaceStitchHoles,
    stitchThreadColor,
    onSetStitchThreadColor: setStitchThreadColor,
    threeTextureSource,
    onSetThreeTextureSource: setThreeTextureSource,
    threeTextureShapeIds,
    onSetThreeTextureShapeIds: setThreeTextureShapeIds,
    foldLines,
    layers,
    lineTypes,
    themeMode: resolvedThemeMode,
    setFoldLines,
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

  return (
    <div className={`app-shell ${resolvedThemeMode === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <EditorTopbar {...topbarProps} />

      <main ref={workspaceRef} className={workspaceClassName} style={workspaceStyle}>
        <div className="canvas-stage">
          {!isMobileLayout && (
            <aside className="canvas-tool-rail" aria-label="Geometry tools">
              <div className="group tool-group ribbon-section canvas-tool-sidebar">
                <div className="tool-icon-grid">
                  {DESKTOP_TOOL_ICON_ITEMS.map((toolItem) => (
                    <button
                      key={toolItem.value}
                      type="button"
                      className={tool === toolItem.value ? 'tool-icon-button active' : 'tool-icon-button'}
                      onClick={() => setActiveTool(toolItem.value)}
                      title={toolItem.label}
                      aria-label={toolItem.label}
                      data-tooltip={toolItem.label}
                    >
                      <span className="tool-icon-badge" aria-hidden="true">
                        <img src={toolItem.iconSrc} alt="" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}

          <ErrorBoundary>
            <EditorCanvasPane
              hideCanvasPane={hideCanvasPane}
              svgRef={svgRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
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
              printPlan={printPlan}
              seamGuides={seamGuides}
              showAnnotations={showAnnotations}
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
              previewElement={previewElement}
              showLayerLegend={showLayerLegend}
              legendMode={legendMode}
              onSetLegendMode={setLegendMode}
              layers={layers}
              layerColorsById={layerColorsById}
              fallbackLayerStroke={fallbackLayerStroke}
              stackLegendEntries={stackLegendEntries}
            />
          </ErrorBoundary>
        </div>

        {!isMobileLayout && showThreePreview && (
          <div
            className={`workspace-splitter ${isDesktopPreviewResizing ? 'active' : ''}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize 3D panel"
            onPointerDown={handleDesktopSplitterPointerDown}
          />
        )}

        <ErrorBoundary>
          <EditorPreviewPane {...previewPaneProps} />
        </ErrorBoundary>
      </main>

      <ErrorBoundary>
        <EditorModalStack {...modalStackProps} />
      </ErrorBoundary>

      <ContextualActionsPanel
        selectedShapes={selectedShapes}
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
        onApplySeamAllowance={handleApplySeamAllowanceToSelection}
        onClearSeamAllowance={handleClearSeamAllowanceOnSelection}
        onApplyTextDefaults={handleApplyTextDefaultsToSelection}
      />

      <PrecisionCommandPanel
        open={showPrecisionModal}
        onClose={() => setShowPrecisionModal(false)}
        toolHint={toolHint}
        onRunCommand={runPrecisionCommand}
      />

      <Suspense fallback={null}>
        <ProjectMemoModal
          open={showProjectMemoModal}
          onClose={() => setShowProjectMemoModal(false)}
          value={projectMemo}
          onChange={(nextValue) => setProjectMemo(nextValue.slice(0, 8000))}
        />
      </Suspense>

      <EditorStatusBar {...statusBarProps} />

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
    </div>
  )
}

export default EditorApp
