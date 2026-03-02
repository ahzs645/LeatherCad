import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import '../../app/styles/App.css'
import {
  uid,
} from './cad/cad-geometry'
import type {
  DocFile,
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  ParametricConstraint,
  Point,
  SeamAllowance,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  StitchHoleType,
  TracingOverlay,
  Tool,
  Viewport,
} from './cad/cad-types'
import { EditorCanvasPane } from './components/EditorCanvasPane'
import { EditorHiddenInputs } from './components/EditorHiddenInputs'
import { EditorModalStack } from './components/EditorModalStack'
import { EditorPreviewPane } from './components/EditorPreviewPane'
import { EditorStatusBar } from './components/EditorStatusBar'
import { EditorTopbar } from './components/EditorTopbar'
import {
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  createDefaultLineTypes,
} from './cad/line-types'
import { DEFAULT_PRESET_ID } from './data/sample-doc'
import { type HistoryState } from './ops/history-ops'
import {
  loadTemplateRepository,
  type TemplateRepositoryEntry,
} from './templates/template-repository'
import type { ClipboardPayload } from './ops/shape-selection-ops'

import {
  DEFAULT_BACK_LAYER_COLOR,
  DEFAULT_EXPORT_ROLE_FILTERS,
  DEFAULT_FRONT_LAYER_COLOR,
  DEFAULT_SNAP_SETTINGS,
} from './editor-constants'
import type {
  DesktopRibbonTab,
  EditorSnapshot,
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

const DESKTOP_PREVIEW_MIN_WIDTH_PX = 300
const DESKTOP_CANVAS_MIN_WIDTH_PX = 420
const DESKTOP_SPLITTER_WIDTH_PX = 12

const getSystemThemeMode = (): ResolvedThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function EditorApp() {
  const [initialLayerId] = useState(() => uid())
  const [lineTypes, setLineTypes] = useState<LineType[]>(() => createDefaultLineTypes())
  const [activeLineTypeId, setActiveLineTypeId] = useState(DEFAULT_ACTIVE_LINE_TYPE_ID)
  const [stitchHoleType, setStitchHoleType] = useState<StitchHoleType>('round')
  const [stitchPitchMm, setStitchPitchMm] = useState(4)
  const [stitchVariablePitchStartMm, setStitchVariablePitchStartMm] = useState(3)
  const [stitchVariablePitchEndMm, setStitchVariablePitchEndMm] = useState(5)
  const [showStitchSequenceLabels, setShowStitchSequenceLabels] = useState(false)
  const [tool, setTool] = useState<Tool>('pan')
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
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      id: initialLayerId,
      name: 'Layer 1',
      visible: true,
      locked: false,
      stackLevel: 0,
    },
  ])
  const [activeLayerId, setActiveLayerId] = useState<string>(initialLayerId)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null)
  const [status, setStatus] = useState('Ready')
  const [showThreePreview, setShowThreePreview] = useState(true)
  const [desktopPreviewWidthPx, setDesktopPreviewWidthPx] = useState(420)
  const [isDesktopPreviewResizing, setIsDesktopPreviewResizing] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('editor')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [mobileOptionsTab, setMobileOptionsTab] = useState<MobileOptionsTab>('view')
  const [desktopRibbonTab, setDesktopRibbonTab] = useState<DesktopRibbonTab>('build')
  const [mobileLayerAction, setMobileLayerAction] = useState<MobileLayerAction>('add')
  const [mobileFileAction, setMobileFileAction] = useState<MobileFileAction>('save-json')
  const {
    showLayerColorModal,
    setShowLayerColorModal,
    showLineTypePalette,
    setShowLineTypePalette,
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
  const [frontLayerColor, setFrontLayerColor] = useState(DEFAULT_FRONT_LAYER_COLOR)
  const [backLayerColor, setBackLayerColor] = useState(DEFAULT_BACK_LAYER_COLOR)
  const [layerColorOverrides, setLayerColorOverrides] = useState<Record<string, string>>({})
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_ID)
  const [tracingOverlays, setTracingOverlays] = useState<TracingOverlay[]>([])
  const [activeTracingOverlayId, setActiveTracingOverlayId] = useState<string | null>(null)
  const [templateRepository, setTemplateRepository] = useState<TemplateRepositoryEntry[]>(() => loadTemplateRepository())
  const [selectedTemplateEntryId, setSelectedTemplateEntryId] = useState<string | null>(null)
  const [clipboardPayload, setClipboardPayload] = useState<ClipboardPayload | null>(null)
  const [historyState, setHistoryState] = useState<HistoryState<EditorSnapshot>>({ past: [], future: [] })
  const [viewport, setViewport] = useState<Viewport>({ x: 560, y: 360, scale: 1 })
  const resolvedThemeMode: ResolvedThemeMode = themeMode === 'system' ? systemThemeMode : themeMode

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
  const workspaceRef = useRef<HTMLElement | null>(null)
  const lastSnapshotRef = useRef<EditorSnapshot | null>(null)
  const lastSnapshotSignatureRef = useRef<string | null>(null)
  const applyingHistoryRef = useRef(false)
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

  const clearDraft = () => {
    setDraftPoints([])
    setCursorPoint(null)
  }
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
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setLayerColorOverrides,
    setTool,
    setShowPrintAreas,
    setStatus,
  })

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
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setHardwareMarkers,
    setStatus,
  })

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
  })
  const {
    handleSaveTemplateToRepository,
    handleDeleteTemplateFromRepository,
    handleLoadTemplateAsDocument,
    handleInsertTemplateIntoDocument,
    handleExportTemplateRepository,
    handleImportTemplateRepositoryFile,
  } = useTemplateActions({
    templateRepository,
    selectedTemplateEntry,
    selectedTemplateEntryId,
    buildCurrentDocFile,
    applyLoadedDocument,
    layers,
    lineTypes,
    shapes,
    foldLines,
    stitchHoles,
    clearDraft,
    setTemplateRepository,
    setSelectedTemplateEntryId,
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
    handleUpdateTracingOverlay,
    handleDeleteTracingOverlay,
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
  })

  const {
    handleZoomStep,
    handleResetView,
    handleFitView,
    handlePointerDown,
    handleShapePointerDown,
    handleStitchHolePointerDown,
    handleHardwarePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
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
    stitchHoles,
    hardwareMarkers,
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
  const { handleExportSvg, handleExportDxf, handleExportPdf } = useExportActions({
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
    setStatus,
  })

  const { handleSaveJson, handleLoadJson, handleImportSvg, handleLoadPreset } = useFileActions({
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
  } = useConstraintActions({
    activeLayer,
    layers,
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
    setConstraints,
    setSeamAllowances,
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

  const setActiveTool = (nextTool: Tool) => {
    setTool(nextTool)
    clearDraft()
    setStatus(`Tool selected: ${toolLabel(nextTool)}`)
  }

  const clampDesktopPreviewWidth = useCallback((value: number) => {
    const workspaceWidth = workspaceRef.current?.clientWidth ?? 0
    if (workspaceWidth <= 0) {
      return Math.max(value, DESKTOP_PREVIEW_MIN_WIDTH_PX)
    }

    const computedMax = workspaceWidth - DESKTOP_CANVAS_MIN_WIDTH_PX - DESKTOP_SPLITTER_WIDTH_PX
    const maxPreviewWidth = Math.max(DESKTOP_PREVIEW_MIN_WIDTH_PX, computedMax)
    return Math.min(Math.max(value, DESKTOP_PREVIEW_MIN_WIDTH_PX), maxPreviewWidth)
  }, [])

  const handleDesktopSplitterPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isMobileLayout || !showThreePreview) {
        return
      }

      event.preventDefault()
      setIsDesktopPreviewResizing(true)
      event.currentTarget.setPointerCapture(event.pointerId)

      const updateFromPointer = (clientX: number) => {
        const workspaceRect = workspaceRef.current?.getBoundingClientRect()
        if (!workspaceRect) {
          return
        }

        const nextWidth = workspaceRect.right - clientX - DESKTOP_SPLITTER_WIDTH_PX / 2
        setDesktopPreviewWidthPx(clampDesktopPreviewWidth(nextWidth))
      }

      const handlePointerMove = (pointerEvent: PointerEvent) => {
        updateFromPointer(pointerEvent.clientX)
      }

      const finishResize = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', finishResize)
        window.removeEventListener('pointercancel', finishResize)
        setIsDesktopPreviewResizing(false)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', finishResize)
      window.addEventListener('pointercancel', finishResize)
      updateFromPointer(event.clientX)
    },
    [clampDesktopPreviewWidth, isMobileLayout, showThreePreview],
  )

  useEffect(() => {
    if (isMobileLayout || !showThreePreview) {
      return
    }

    const syncPreviewWidth = () => {
      setDesktopPreviewWidthPx((current) => clampDesktopPreviewWidth(current))
    }

    syncPreviewWidth()
    window.addEventListener('resize', syncPreviewWidth)
    return () => window.removeEventListener('resize', syncPreviewWidth)
  }, [clampDesktopPreviewWidth, isMobileLayout, showThreePreview])

  useEffect(() => {
    if (!isDesktopPreviewResizing) {
      return
    }

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isDesktopPreviewResizing])

  const {
    workspaceClassName,
    topbarClassName,
    hideCanvasPane,
    hidePreviewPane,
    showToolSection,
    showPresetSection,
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
    showPresetSection,
    selectedPresetId,
    setSelectedPresetId,
    handleLoadPreset,
    handleSetThemeMode,
    themeMode,
    showZoomSection,
    sketchWorkspaceMode,
    setSketchWorkspaceMode,
    handleZoomStep,
    handleFitView,
    handleResetView,
    showEditSection,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    canPaste: Boolean(clipboardPayload && clipboardPayload.shapes.length > 0),
    handleDuplicateSelection,
    handleDeleteSelection,
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
    showExportOptionsModal,
    setShowExportOptionsModal,
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
    selectedTemplateEntryId,
    selectedTemplateEntry,
    setSelectedTemplateEntryId,
    handleSaveTemplateToRepository,
    handleExportTemplateRepository,
    templateImportInputRef,
    handleLoadTemplateAsDocument,
    handleInsertTemplateIntoDocument,
    handleDeleteTemplateFromRepository,
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
    showPrintPreviewModal,
    setShowPrintPreviewModal,
    printPaper,
    setPrintPaper,
    printScalePercent,
    setPrintScalePercent,
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
  })
  const previewPaneProps = useEditorPreviewPaneProps({
    showThreePreview,
    hidePreviewPane,
    isMobileLayout,
    mobileViewMode,
    shapes: sketchWorkspaceMode === 'assembly' ? assemblyShapes : workspaceShapes,
    stitchHoles: sketchWorkspaceMode === 'assembly' ? visibleStitchHoles : workspaceStitchHoles,
    foldLines,
    layers,
    lineTypes,
    themeMode: resolvedThemeMode,
    setFoldLines,
  })
  const statusBarProps = useEditorStatusBarProps({
    toolLabel: toolLabel(tool),
    status,
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
        <EditorCanvasPane
          hideCanvasPane={hideCanvasPane}
          svgRef={svgRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          viewport={viewport}
          gridLines={gridLines}
          tracingOverlays={tracingOverlays}
          themeMode={resolvedThemeMode}
          showPrintAreas={showPrintAreas}
          printPlan={printPlan}
          seamGuides={seamGuides}
          showAnnotations={showAnnotations}
          visibleShapes={workspaceEditableShapes}
          linkedShapes={workspaceLinkedShapes}
          sketchWorkspaceMode={sketchWorkspaceMode}
          lineTypesById={lineTypesById}
          selectedShapeIdSet={selectedShapeIdSet}
          stitchStrokeColor={stitchStrokeColor}
          foldStrokeColor={foldStrokeColor}
          cutStrokeColor={cutStrokeColor}
          displayLayerColorsById={displayLayerColorsById}
          onShapePointerDown={handleShapePointerDown}
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

        {!isMobileLayout && showThreePreview && (
          <div
            className={`workspace-splitter ${isDesktopPreviewResizing ? 'active' : ''}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize 3D panel"
            onPointerDown={handleDesktopSplitterPointerDown}
          />
        )}

        <EditorPreviewPane {...previewPaneProps} />
      </main>

      <EditorModalStack {...modalStackProps} />

      <EditorStatusBar {...statusBarProps} />

      <EditorHiddenInputs
        fileInputRef={fileInputRef}
        svgInputRef={svgInputRef}
        tracingInputRef={tracingInputRef}
        templateImportInputRef={templateImportInputRef}
        onLoadJson={handleLoadJson}
        onImportSvg={handleImportSvg}
        onImportTracing={handleImportTracing}
        onImportTemplateRepositoryFile={handleImportTemplateRepositoryFile}
      />
    </div>
  )
}

export default EditorApp
