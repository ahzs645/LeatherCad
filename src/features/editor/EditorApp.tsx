import { useRef, useState } from 'react'
import '../../app/styles/App.css'
import {
  uid,
} from './cad/cad-geometry'
import type {
  ConstraintAxis,
  ConstraintEdge,
  DocFile,
  FoldLine,
  HardwareKind,
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
import type { PrintPaper } from './preview/print-preview'
import {
  loadTemplateRepository,
  type TemplateRepositoryEntry,
} from './templates/template-repository'
import type { ClipboardPayload } from './ops/shape-selection-ops'

import {
  DEFAULT_BACK_LAYER_COLOR,
  DEFAULT_EXPORT_ROLE_FILTERS,
  DEFAULT_FRONT_LAYER_COLOR,
  DEFAULT_SEAM_ALLOWANCE_MM,
  DEFAULT_SNAP_SETTINGS,
} from './editor-constants'
import {
  sanitizeFoldLine,
} from './editor-parsers'
import type {
  DesktopRibbonTab,
  DxfVersion,
  EditorSnapshot,
  ExportRoleFilters,
  LegendMode,
  MobileFileAction,
  MobileLayerAction,
  MobileOptionsTab,
  MobileViewMode,
  ThemeMode,
} from './editor-types'
import {
  normalizeHexColor,
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
import { useLoadedDocumentActions } from './hooks/useLoadedDocumentActions'
import { useSketchGroupActions } from './hooks/useSketchGroupActions'
import { useHistoryActions } from './hooks/useHistoryActions'
import { useEditorStateActions } from './hooks/useEditorStateActions'
import { useSelectionActions } from './hooks/useSelectionActions'
import { useThemeActions } from './hooks/useThemeActions'

export function EditorApp() {
  const initialLayerIdRef = useRef(uid())
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
      id: initialLayerIdRef.current,
      name: 'Layer 1',
      visible: true,
      locked: false,
      stackLevel: 0,
    },
  ])
  const [activeLayerId, setActiveLayerId] = useState<string>(initialLayerIdRef.current)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null)
  const [status, setStatus] = useState('Ready')
  const [isPanning, setIsPanning] = useState(false)
  const [showThreePreview, setShowThreePreview] = useState(true)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('editor')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [mobileOptionsTab, setMobileOptionsTab] = useState<MobileOptionsTab>('view')
  const [desktopRibbonTab, setDesktopRibbonTab] = useState<DesktopRibbonTab>('build')
  const [mobileLayerAction, setMobileLayerAction] = useState<MobileLayerAction>('add')
  const [mobileFileAction, setMobileFileAction] = useState<MobileFileAction>('save-json')
  const [showLayerColorModal, setShowLayerColorModal] = useState(false)
  const [showLineTypePalette, setShowLineTypePalette] = useState(false)
  const [showExportOptionsModal, setShowExportOptionsModal] = useState(false)
  const [exportOnlySelectedShapes, setExportOnlySelectedShapes] = useState(false)
  const [exportOnlyVisibleLineTypes, setExportOnlyVisibleLineTypes] = useState(true)
  const [exportRoleFilters, setExportRoleFilters] = useState<ExportRoleFilters>({ ...DEFAULT_EXPORT_ROLE_FILTERS })
  const [exportForceSolidStrokes, setExportForceSolidStrokes] = useState(false)
  const [dxfFlipY, setDxfFlipY] = useState(false)
  const [dxfVersion, setDxfVersion] = useState<DxfVersion>('r12')
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([])
  const [selectedStitchHoleId, setSelectedStitchHoleId] = useState<string | null>(null)
  const [selectedHardwareMarkerId, setSelectedHardwareMarkerId] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark')
  const [legendMode, setLegendMode] = useState<LegendMode>('layer')
  const [frontLayerColor, setFrontLayerColor] = useState(DEFAULT_FRONT_LAYER_COLOR)
  const [backLayerColor, setBackLayerColor] = useState(DEFAULT_BACK_LAYER_COLOR)
  const [layerColorOverrides, setLayerColorOverrides] = useState<Record<string, string>>({})
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET_ID)
  const [tracingOverlays, setTracingOverlays] = useState<TracingOverlay[]>([])
  const [activeTracingOverlayId, setActiveTracingOverlayId] = useState<string | null>(null)
  const [showTracingModal, setShowTracingModal] = useState(false)
  const [showPatternToolsModal, setShowPatternToolsModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [templateRepository, setTemplateRepository] = useState<TemplateRepositoryEntry[]>(() => loadTemplateRepository())
  const [selectedTemplateEntryId, setSelectedTemplateEntryId] = useState<string | null>(null)
  const [showTemplateRepositoryModal, setShowTemplateRepositoryModal] = useState(false)
  const [printPaper, setPrintPaper] = useState<PrintPaper>('letter')
  const [printTileX, setPrintTileX] = useState(1)
  const [printTileY, setPrintTileY] = useState(1)
  const [printOverlapMm, setPrintOverlapMm] = useState(4)
  const [printMarginMm, setPrintMarginMm] = useState(8)
  const [printScalePercent, setPrintScalePercent] = useState(100)
  const [printSelectedOnly, setPrintSelectedOnly] = useState(false)
  const [printRulerInside, setPrintRulerInside] = useState(false)
  const [printInColor, setPrintInColor] = useState(true)
  const [printStitchAsDots, setPrintStitchAsDots] = useState(false)
  const [showPrintAreas, setShowPrintAreas] = useState(false)
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false)
  const [seamAllowanceInputMm, setSeamAllowanceInputMm] = useState(DEFAULT_SEAM_ALLOWANCE_MM)
  const [constraintEdge, setConstraintEdge] = useState<ConstraintEdge>('left')
  const [constraintOffsetMm, setConstraintOffsetMm] = useState(10)
  const [constraintAxis, setConstraintAxis] = useState<ConstraintAxis>('x')
  const [hardwarePreset, setHardwarePreset] = useState<HardwareKind>('snap')
  const [customHardwareDiameterMm, setCustomHardwareDiameterMm] = useState(4)
  const [customHardwareSpacingMm, setCustomHardwareSpacingMm] = useState(0)
  const [clipboardPayload, setClipboardPayload] = useState<ClipboardPayload | null>(null)
  const [historyState, setHistoryState] = useState<HistoryState<EditorSnapshot>>({ past: [], future: [] })
  const [viewport, setViewport] = useState<Viewport>({ x: 560, y: 360, scale: 1 })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const svgInputRef = useRef<HTMLInputElement | null>(null)
  const tracingInputRef = useRef<HTMLInputElement | null>(null)
  const templateImportInputRef = useRef<HTMLInputElement | null>(null)
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
    visibleShapes,
    visibleStitchHoles,
    visibleLayerIdSet,
    visibleHardwareMarkers,
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
    themeMode,
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
    isPanning,
    activeLayerId,
    activeLineTypeId,
    activeSketchGroup,
    snapSettings,
    foldLines,
    visibleShapes,
    visibleHardwareMarkers,
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
    setIsPanning,
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
    shapes,
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
    handleRenameActiveSketchGroup,
    handleToggleActiveSketchGroupVisibility,
    handleToggleActiveSketchGroupLock,
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

  const { handleToggleTheme } = useThemeActions({
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

  const workspaceClassName = `workspace ${isMobileLayout ? `mobile-${mobileViewMode}` : 'desktop'}`
  const topbarClassName = `topbar ${isMobileLayout ? 'topbar-mobile' : `desktop-ribbon-tab-${desktopRibbonTab}`} ${
    isMobileLayout && !showMobileMenu ? 'topbar-compact' : ''
  }`
  const hideCanvasPane = isMobileLayout && showThreePreview && mobileViewMode === 'preview'
  const hidePreviewPane = isMobileLayout && (mobileViewMode === 'editor' || !showThreePreview)
  const showViewOptions = showMobileMenu && mobileOptionsTab === 'view'
  const showLayerOptions = showMobileMenu && mobileOptionsTab === 'layers'
  const showFileOptions = showMobileMenu && mobileOptionsTab === 'file'
  const showDesktopToolSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'edit' || desktopRibbonTab === 'stitch'
  const showDesktopPresetSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'view'
  const showDesktopZoomSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'view'
  const showDesktopEditSection = desktopRibbonTab === 'edit'
  const showDesktopLineTypeSection = desktopRibbonTab === 'build' || desktopRibbonTab === 'edit' || desktopRibbonTab === 'stitch'
  const showDesktopStitchSection = desktopRibbonTab === 'stitch'
  const showDesktopLayerSection =
    desktopRibbonTab === 'build' ||
    desktopRibbonTab === 'edit' ||
    desktopRibbonTab === 'stitch' ||
    desktopRibbonTab === 'layers'
  const showDesktopFileSection = desktopRibbonTab === 'output'
  const showToolSection = isMobileLayout || showDesktopToolSection
  const showPresetSection = isMobileLayout ? showViewOptions : showDesktopPresetSection
  const showZoomSection = isMobileLayout ? showViewOptions : showDesktopZoomSection
  const showEditSection = isMobileLayout ? showViewOptions : showDesktopEditSection
  const showLineTypeSection = isMobileLayout ? showViewOptions : showDesktopLineTypeSection
  const showStitchSection = isMobileLayout ? showViewOptions : showDesktopStitchSection
  const showLayerSection = isMobileLayout ? showLayerOptions : showDesktopLayerSection
  const showFileSection = isMobileLayout ? showFileOptions : showDesktopFileSection
  const showLayerLegend = !(isMobileLayout && mobileViewMode === 'split')

  return (
    <div className={`app-shell ${themeMode === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <EditorTopbar
        topbarClassName={topbarClassName}
        isMobileLayout={isMobileLayout}
        desktopRibbonTab={desktopRibbonTab}
        onDesktopRibbonTabChange={setDesktopRibbonTab}
        selectedShapeCount={selectedShapeCount}
        selectedStitchHoleCount={selectedStitchHoleCount}
        showThreePreview={showThreePreview}
        onOpenHelpModal={() => setShowHelpModal(true)}
        showToolSection={showToolSection}
        tool={tool}
        onSetActiveTool={setActiveTool}
        mobileViewMode={mobileViewMode}
        onSetMobileViewMode={setMobileViewMode}
        showMobileMenu={showMobileMenu}
        onToggleMobileMenu={() =>
          setShowMobileMenu((previous) => {
            const next = !previous
            if (next) {
              setMobileOptionsTab('view')
            }
            return next
          })
        }
        mobileOptionsTab={mobileOptionsTab}
        onSetMobileOptionsTab={setMobileOptionsTab}
        showPresetSection={showPresetSection}
        selectedPresetId={selectedPresetId}
        onSetSelectedPresetId={setSelectedPresetId}
        onLoadPreset={handleLoadPreset}
        onToggleTheme={handleToggleTheme}
        themeMode={themeMode}
        showZoomSection={showZoomSection}
        onZoomOut={() => handleZoomStep(0.85)}
        onZoomIn={() => handleZoomStep(1.15)}
        onFitView={handleFitView}
        onResetView={handleResetView}
        showEditSection={showEditSection}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCopySelection={handleCopySelection}
        onCutSelection={handleCutSelection}
        onPasteClipboard={handlePasteClipboard}
        canPaste={Boolean(clipboardPayload && clipboardPayload.shapes.length > 0)}
        onDuplicateSelection={handleDuplicateSelection}
        onDeleteSelection={handleDeleteSelection}
        onMoveSelectionBackward={handleMoveSelectionBackward}
        onMoveSelectionForward={handleMoveSelectionForward}
        onSendSelectionToBack={handleSendSelectionToBack}
        onBringSelectionToFront={handleBringSelectionToFront}
        showLineTypeSection={showLineTypeSection}
        activeLineType={activeLineType}
        lineTypes={lineTypes}
        onSetActiveLineTypeId={setActiveLineTypeId}
        onToggleActiveLineTypeVisibility={handleToggleActiveLineTypeVisibility}
        onOpenLineTypePalette={() => setShowLineTypePalette(true)}
        showStitchSection={showStitchSection}
        stitchHoleType={stitchHoleType}
        onSetStitchHoleType={setStitchHoleType}
        stitchPitchMm={stitchPitchMm}
        onSetStitchPitchMm={setStitchPitchMm}
        stitchVariablePitchStartMm={stitchVariablePitchStartMm}
        stitchVariablePitchEndMm={stitchVariablePitchEndMm}
        onSetStitchVariablePitchStartMm={setStitchVariablePitchStartMm}
        onSetStitchVariablePitchEndMm={setStitchVariablePitchEndMm}
        onAutoPlaceFixedPitchStitchHoles={handleAutoPlaceFixedPitchStitchHoles}
        onAutoPlaceVariablePitchStitchHoles={handleAutoPlaceVariablePitchStitchHoles}
        onResequenceSelectedStitchHoles={() => handleResequenceSelectedStitchHoles(false)}
        onReverseSelectedStitchHoles={() => handleResequenceSelectedStitchHoles(true)}
        onSelectNextStitchHole={handleSelectNextStitchHole}
        onFixStitchHoleOrderFromSelected={() => handleFixStitchHoleOrderFromSelected(false)}
        onFixReverseStitchHoleOrderFromSelected={() => handleFixStitchHoleOrderFromSelected(true)}
        showStitchSequenceLabels={showStitchSequenceLabels}
        onToggleStitchSequenceLabels={() => setShowStitchSequenceLabels((previous) => !previous)}
        onCountStitchHolesOnSelectedShapes={handleCountStitchHolesOnSelectedShapes}
        onDeleteStitchHolesOnSelectedShapes={handleDeleteStitchHolesOnSelectedShapes}
        onClearAllStitchHoles={handleClearAllStitchHoles}
        selectedHoleCount={selectedStitchHoleCount}
        stitchHoleCount={stitchHoles.length}
        hasSelectedStitchHole={selectedStitchHole !== null}
        showLayerSection={showLayerSection}
        activeLayer={activeLayer}
        layers={layers}
        layerStackLevels={layerStackLevels}
        onSetActiveLayerId={setActiveLayerId}
        onClearDraft={clearDraft}
        mobileLayerAction={mobileLayerAction}
        onSetMobileLayerAction={setMobileLayerAction}
        onRunMobileLayerAction={handleRunMobileLayerAction}
        onAddLayer={handleAddLayer}
        onRenameActiveLayer={handleRenameActiveLayer}
        onToggleLayerVisibility={handleToggleLayerVisibility}
        onToggleLayerLock={handleToggleLayerLock}
        onMoveLayerUp={() => handleMoveLayer(-1)}
        onMoveLayerDown={() => handleMoveLayer(1)}
        onDeleteLayer={handleDeleteLayer}
        onOpenLayerColorModal={() => setShowLayerColorModal(true)}
        showFileSection={showFileSection}
        mobileFileAction={mobileFileAction}
        onSetMobileFileAction={setMobileFileAction}
        onRunMobileFileAction={handleRunMobileFileAction}
        onSaveJson={handleSaveJson}
        onOpenLoadJson={() => fileInputRef.current?.click()}
        onOpenImportSvg={() => svgInputRef.current?.click()}
        onExportSvg={handleExportSvg}
        onExportPdf={handleExportPdf}
        onExportDxf={handleExportDxf}
        onOpenExportOptionsModal={() => setShowExportOptionsModal(true)}
        onOpenPatternToolsModal={() => setShowPatternToolsModal(true)}
        onOpenTemplateRepositoryModal={() => setShowTemplateRepositoryModal(true)}
        onOpenTracingImport={() => tracingInputRef.current?.click()}
        onOpenTracingModal={() => setShowTracingModal(true)}
        hasTracingOverlays={tracingOverlays.length > 0}
        onOpenPrintPreviewModal={() => setShowPrintPreviewModal(true)}
        showPrintAreas={showPrintAreas}
        onTogglePrintAreas={() => setShowPrintAreas((previous) => !previous)}
        onToggleThreePreview={() => setShowThreePreview((previous) => !previous)}
        onResetDocument={resetDocument}
      />

      <main className={workspaceClassName}>
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
          themeMode={themeMode}
          showPrintAreas={showPrintAreas}
          printPlan={printPlan}
          seamGuides={seamGuides}
          showAnnotations={showAnnotations}
          visibleShapes={visibleShapes}
          lineTypesById={lineTypesById}
          selectedShapeIdSet={selectedShapeIdSet}
          stitchStrokeColor={stitchStrokeColor}
          foldStrokeColor={foldStrokeColor}
          cutStrokeColor={cutStrokeColor}
          displayLayerColorsById={displayLayerColorsById}
          onShapePointerDown={handleShapePointerDown}
          visibleStitchHoles={visibleStitchHoles}
          selectedStitchHoleId={selectedStitchHoleId}
          showStitchSequenceLabels={showStitchSequenceLabels}
          onStitchHolePointerDown={handleStitchHolePointerDown}
          visibleHardwareMarkers={visibleHardwareMarkers}
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

        <EditorPreviewPane
          showThreePreview={showThreePreview}
          hidePreviewPane={hidePreviewPane}
          isMobileLayout={isMobileLayout}
          mobileViewMode={mobileViewMode}
          shapes={visibleShapes}
          stitchHoles={visibleStitchHoles}
          foldLines={foldLines}
          layers={layers}
          lineTypes={lineTypes}
          themeMode={themeMode}
          onUpdateFoldLine={(foldLineId, updates) =>
            setFoldLines((previous) =>
              previous.map((foldLine) =>
                foldLine.id === foldLineId
                  ? sanitizeFoldLine({
                      ...foldLine,
                      ...updates,
                    })
                  : foldLine,
              ),
            )
          }
        />
      </main>

      <EditorModalStack
        lineTypePaletteProps={{
          open: showLineTypePalette,
          lineTypes,
          activeLineType,
          shapeCountsByLineType,
          selectedShapeCount,
          onClose: () => setShowLineTypePalette(false),
          onSetActiveLineTypeId: setActiveLineTypeId,
          onToggleLineTypeVisibility: (lineTypeId) =>
            setLineTypes((previous) =>
              previous.map((lineType) =>
                lineType.id === lineTypeId
                  ? {
                      ...lineType,
                      visible: !lineType.visible,
                    }
                  : lineType,
              ),
            ),
          onShowAllTypes: handleShowAllLineTypes,
          onIsolateActiveType: handleIsolateActiveLineType,
          onUpdateActiveLineTypeRole: handleUpdateActiveLineTypeRole,
          onUpdateActiveLineTypeStyle: handleUpdateActiveLineTypeStyle,
          onUpdateActiveLineTypeColor: handleUpdateActiveLineTypeColor,
          onSelectShapesByActiveType: handleSelectShapesByActiveLineType,
          onAssignSelectedToActiveType: handleAssignSelectedToActiveLineType,
          onClearSelection: handleClearShapeSelection,
        }}
        helpModalProps={{
          open: showHelpModal,
          onClose: () => setShowHelpModal(false),
        }}
        layerColorModalProps={{
          open: showLayerColorModal,
          onClose: () => setShowLayerColorModal(false),
          layers,
          layerColorsById,
          layerColorOverrides,
          frontLayerColor,
          backLayerColor,
          onFrontLayerColorChange: (color) => setFrontLayerColor(normalizeHexColor(color, DEFAULT_FRONT_LAYER_COLOR)),
          onBackLayerColorChange: (color) => setBackLayerColor(normalizeHexColor(color, DEFAULT_BACK_LAYER_COLOR)),
          onSetLayerColorOverride: handleSetLayerColorOverride,
          onClearLayerColorOverride: handleClearLayerColorOverride,
          onResetLayerColors: handleResetLayerColors,
        }}
        exportOptionsModalProps={{
          open: showExportOptionsModal,
          onClose: () => setShowExportOptionsModal(false),
          activeExportRoleCount,
          exportOnlySelectedShapes,
          exportOnlyVisibleLineTypes,
          exportForceSolidStrokes,
          exportRoleFilters,
          dxfVersion,
          dxfFlipY,
          onExportOnlySelectedShapesChange: setExportOnlySelectedShapes,
          onExportOnlyVisibleLineTypesChange: setExportOnlyVisibleLineTypes,
          onExportForceSolidStrokesChange: setExportForceSolidStrokes,
          onExportRoleFilterChange: (role, enabled) =>
            setExportRoleFilters((previous) => ({
              ...previous,
              [role]: enabled,
            })),
          onDxfVersionChange: setDxfVersion,
          onDxfFlipYChange: setDxfFlipY,
          onResetDefaults: handleResetExportOptions,
        }}
        templateRepositoryModalProps={{
          open: showTemplateRepositoryModal,
          onClose: () => setShowTemplateRepositoryModal(false),
          templateRepository,
          selectedTemplateEntryId,
          selectedTemplateEntry,
          onSelectTemplateEntry: setSelectedTemplateEntryId,
          onSaveTemplate: handleSaveTemplateToRepository,
          onExportRepository: handleExportTemplateRepository,
          onImportRepository: () => templateImportInputRef.current?.click(),
          onLoadAsDocument: handleLoadTemplateAsDocument,
          onInsertIntoDocument: handleInsertTemplateIntoDocument,
          onDeleteTemplate: handleDeleteTemplateFromRepository,
        }}
        patternToolsModalProps={{
          open: showPatternToolsModal,
          onClose: () => setShowPatternToolsModal(false),
          snapSettings,
          onSetSnapSettings: setSnapSettings,
          selectedShapeCount,
          onAlignSelection: handleAlignSelection,
          onAlignSelectionToGrid: handleAlignSelectionToGrid,
          activeLayer,
          activeLayerId,
          sketchGroups,
          activeSketchGroup,
          onSetActiveSketchGroupId: setActiveSketchGroupId,
          onCreateSketchGroupFromSelection: handleCreateSketchGroupFromSelection,
          onDuplicateActiveSketchGroup: handleDuplicateActiveSketchGroup,
          onRenameActiveSketchGroup: handleRenameActiveSketchGroup,
          onToggleActiveSketchGroupVisibility: handleToggleActiveSketchGroupVisibility,
          onToggleActiveSketchGroupLock: handleToggleActiveSketchGroupLock,
          onClearActiveSketchGroup: handleClearActiveSketchGroup,
          onDeleteActiveSketchGroup: handleDeleteActiveSketchGroup,
          onSetActiveLayerAnnotation: handleSetActiveLayerAnnotation,
          onSetActiveSketchAnnotation: handleSetActiveSketchAnnotation,
          showAnnotations,
          onSetShowAnnotations: setShowAnnotations,
          constraintEdge,
          onSetConstraintEdge: setConstraintEdge,
          constraintOffsetMm,
          onSetConstraintOffsetMm: setConstraintOffsetMm,
          constraintAxis,
          onSetConstraintAxis: setConstraintAxis,
          onAddEdgeConstraintFromSelection: handleAddEdgeConstraintFromSelection,
          onAddAlignConstraintsFromSelection: handleAddAlignConstraintsFromSelection,
          onApplyConstraints: handleApplyConstraints,
          constraints,
          onToggleConstraintEnabled: handleToggleConstraintEnabled,
          onDeleteConstraint: handleDeleteConstraint,
          seamAllowanceInputMm,
          onSetSeamAllowanceInputMm: setSeamAllowanceInputMm,
          onApplySeamAllowanceToSelection: handleApplySeamAllowanceToSelection,
          onClearSeamAllowanceOnSelection: handleClearSeamAllowanceOnSelection,
          onClearAllSeamAllowances: handleClearAllSeamAllowances,
          seamAllowanceCount: seamAllowances.length,
          hardwarePreset,
          onSetHardwarePreset: setHardwarePreset,
          customHardwareDiameterMm,
          onSetCustomHardwareDiameterMm: setCustomHardwareDiameterMm,
          customHardwareSpacingMm,
          onSetCustomHardwareSpacingMm: setCustomHardwareSpacingMm,
          onSetActiveTool: setActiveTool,
          selectedHardwareMarker,
          onUpdateSelectedHardwareMarker: handleUpdateSelectedHardwareMarker,
          onDeleteSelectedHardwareMarker: handleDeleteSelectedHardwareMarker,
        }}
        tracingModalProps={{
          open: showTracingModal,
          onClose: () => setShowTracingModal(false),
          tracingOverlays,
          activeTracingOverlay,
          onImportTracing: () => tracingInputRef.current?.click(),
          onDeleteActiveTracing: () => {
            if (activeTracingOverlay) {
              handleDeleteTracingOverlay(activeTracingOverlay.id)
            }
          },
          onSetActiveTracingOverlayId: setActiveTracingOverlayId,
          onUpdateTracingOverlay: handleUpdateTracingOverlay,
        }}
        printPreviewModalProps={{
          open: showPrintPreviewModal,
          onClose: () => setShowPrintPreviewModal(false),
          printPaper,
          onSetPrintPaper: setPrintPaper,
          printScalePercent,
          onSetPrintScalePercent: setPrintScalePercent,
          printTileX,
          onSetPrintTileX: setPrintTileX,
          printTileY,
          onSetPrintTileY: setPrintTileY,
          printOverlapMm,
          onSetPrintOverlapMm: setPrintOverlapMm,
          printMarginMm,
          onSetPrintMarginMm: setPrintMarginMm,
          printSelectedOnly,
          onSetPrintSelectedOnly: setPrintSelectedOnly,
          printRulerInside,
          onSetPrintRulerInside: setPrintRulerInside,
          printInColor,
          onSetPrintInColor: setPrintInColor,
          printStitchAsDots,
          onSetPrintStitchAsDots: setPrintStitchAsDots,
          printPlan,
          showPrintAreas,
          onTogglePrintAreas: () => setShowPrintAreas((previous) => !previous),
          onFitView: handleFitView,
        }}
      />

      <EditorStatusBar
        toolLabel={toolLabel(tool)}
        status={status}
        zoomPercent={Math.round(viewport.scale * 100)}
        visibleShapeCount={visibleShapes.length}
        shapeCount={shapes.length}
        layerCount={layers.length}
        sketchGroupCount={sketchGroups.length}
        visibleLineTypeCount={lineTypes.filter((lineType) => lineType.visible).length}
        lineTypeCount={lineTypes.length}
        foldLineCount={foldLines.length}
        stitchHoleCount={stitchHoles.length}
        seamAllowanceCount={seamAllowances.length}
        constraintCount={constraints.length}
        hardwareMarkerCount={hardwareMarkers.length}
        tracingOverlayCount={tracingOverlays.length}
        templateCount={templateRepository.length}
      />

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
