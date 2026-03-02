import type { ComponentProps, Dispatch, RefObject, SetStateAction } from 'react'
import type { Layer, LineType, StitchHoleType, Tool } from '../cad/cad-types'
import { EditorTopbar } from '../components/EditorTopbar'
import type { DisplayUnit } from '../ops/unit-ops'
import type {
  DesktopRibbonTab,
  MobileFileAction,
  MobileLayerAction,
  MobileOptionsTab,
  MobileViewMode,
  SketchWorkspaceMode,
  ThemeMode,
} from '../editor-types'

type UseEditorTopbarPropsParams = {
  topbarClassName: string
  isMobileLayout: boolean
  desktopRibbonTab: DesktopRibbonTab
  setDesktopRibbonTab: Dispatch<SetStateAction<DesktopRibbonTab>>
  selectedShapeCount: number
  selectedStitchHoleCount: number
  showThreePreview: boolean
  onOpenPrecisionModal: () => void
  onOpenProjectMemoModal: () => void
  setShowHelpModal: Dispatch<SetStateAction<boolean>>
  showToolSection: boolean
  tool: Tool
  setActiveTool: (tool: Tool) => void
  mobileViewMode: MobileViewMode
  setMobileViewMode: Dispatch<SetStateAction<MobileViewMode>>
  showMobileMenu: boolean
  setShowMobileMenu: Dispatch<SetStateAction<boolean>>
  mobileOptionsTab: MobileOptionsTab
  setMobileOptionsTab: Dispatch<SetStateAction<MobileOptionsTab>>
  showPresetSection: boolean
  selectedPresetId: string
  setSelectedPresetId: Dispatch<SetStateAction<string>>
  handleLoadPreset: () => void
  handleSetThemeMode: (mode: ThemeMode) => void
  themeMode: ThemeMode
  showZoomSection: boolean
  displayUnit: DisplayUnit
  setDisplayUnit: Dispatch<SetStateAction<DisplayUnit>>
  showCanvasRuler: boolean
  setShowCanvasRuler: Dispatch<SetStateAction<boolean>>
  showDimensions: boolean
  setShowDimensions: Dispatch<SetStateAction<boolean>>
  sketchWorkspaceMode: SketchWorkspaceMode
  setSketchWorkspaceMode: Dispatch<SetStateAction<SketchWorkspaceMode>>
  showEditSection: boolean
  canUndo: boolean
  canRedo: boolean
  handleUndo: () => void
  handleRedo: () => void
  handleCopySelection: () => void
  handleCutSelection: () => void
  handlePasteClipboard: () => void
  canPaste: boolean
  handleSelectAllShapes: () => void
  handleDuplicateSelection: () => void
  handleDeleteSelection: () => void
  handleGroupSelection: () => void
  handleUngroupSelection: () => void
  handleMoveSelectionByDistance: () => void
  handleCopySelectionByDistance: () => void
  handleRotateSelection: (angleDeg: number) => void
  handleScaleSelection: (factor: number) => void
  handleEnableStitchOnSelection: () => void
  handleDisableStitchOnSelection: () => void
  handleMoveSelectionBackward: () => void
  handleMoveSelectionForward: () => void
  handleSendSelectionToBack: () => void
  handleBringSelectionToFront: () => void
  showLineTypeSection: boolean
  activeLineType: LineType | null
  lineTypes: LineType[]
  setActiveLineTypeId: Dispatch<SetStateAction<string>>
  handleToggleActiveLineTypeVisibility: () => void
  setShowLineTypePalette: Dispatch<SetStateAction<boolean>>
  showStitchSection: boolean
  stitchHoleType: StitchHoleType
  setStitchHoleType: Dispatch<SetStateAction<StitchHoleType>>
  stitchPitchMm: number
  setStitchPitchMm: Dispatch<SetStateAction<number>>
  stitchVariablePitchStartMm: number
  stitchVariablePitchEndMm: number
  setStitchVariablePitchStartMm: Dispatch<SetStateAction<number>>
  setStitchVariablePitchEndMm: Dispatch<SetStateAction<number>>
  handleAutoPlaceFixedPitchStitchHoles: () => void
  handleAutoPlaceVariablePitchStitchHoles: () => void
  handleResequenceSelectedStitchHoles: (reverse: boolean) => void
  handleSelectNextStitchHole: () => void
  handleFixStitchHoleOrderFromSelected: (reverse: boolean) => void
  showStitchSequenceLabels: boolean
  setShowStitchSequenceLabels: Dispatch<SetStateAction<boolean>>
  handleCountStitchHolesOnSelectedShapes: () => void
  handleDeleteStitchHolesOnSelectedShapes: () => void
  handleClearAllStitchHoles: () => void
  stitchHolesLength: number
  hasSelectedStitchHole: boolean
  showLayerSection: boolean
  activeLayer: Layer | null
  layers: Layer[]
  layerStackLevels: Record<string, number>
  setActiveLayerId: Dispatch<SetStateAction<string>>
  clearDraft: () => void
  mobileLayerAction: MobileLayerAction
  setMobileLayerAction: Dispatch<SetStateAction<MobileLayerAction>>
  handleRunMobileLayerAction: () => void
  handleAddLayer: () => void
  handleRenameActiveLayer: () => void
  handleToggleLayerVisibility: () => void
  handleToggleLayerLock: () => void
  handleMoveLayer: (direction: -1 | 1) => void
  handleDeleteLayer: () => void
  setShowLayerColorModal: Dispatch<SetStateAction<boolean>>
  showFileSection: boolean
  mobileFileAction: MobileFileAction
  setMobileFileAction: Dispatch<SetStateAction<MobileFileAction>>
  handleRunMobileFileAction: () => void
  handleSaveJson: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  svgInputRef: RefObject<HTMLInputElement | null>
  tracingInputRef: RefObject<HTMLInputElement | null>
  handleExportSvg: () => void
  handleExportPdf: () => void
  handleExportDxf: () => void
  handleExportLaserSvg: () => void
  handleOpenInNewTab: () => void
  setShowExportModal: Dispatch<SetStateAction<boolean>>
  setShowExportOptionsModal: Dispatch<SetStateAction<boolean>>
  setShowPatternToolsModal: Dispatch<SetStateAction<boolean>>
  setShowTemplateRepositoryModal: Dispatch<SetStateAction<boolean>>
  setShowTracingModal: Dispatch<SetStateAction<boolean>>
  tracingOverlaysLength: number
  setShowPrintPreviewModal: Dispatch<SetStateAction<boolean>>
  showPrintAreas: boolean
  setShowPrintAreas: Dispatch<SetStateAction<boolean>>
  setShowThreePreview: Dispatch<SetStateAction<boolean>>
  resetDocument: () => void
}

export function useEditorTopbarProps(params: UseEditorTopbarPropsParams): ComponentProps<typeof EditorTopbar> {
  const {
    topbarClassName,
    isMobileLayout,
    desktopRibbonTab,
    setDesktopRibbonTab,
    selectedShapeCount,
    selectedStitchHoleCount,
    showThreePreview,
    onOpenPrecisionModal,
    onOpenProjectMemoModal,
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
    canPaste,
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
    stitchHolesLength,
    hasSelectedStitchHole,
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
    tracingOverlaysLength,
    setShowPrintPreviewModal,
    showPrintAreas,
    setShowPrintAreas,
    setShowThreePreview,
    resetDocument,
  } = params

  return {
    topbarClassName,
    isMobileLayout,
    desktopRibbonTab,
    onDesktopRibbonTabChange: setDesktopRibbonTab,
    selectedShapeCount,
    selectedStitchHoleCount,
    showThreePreview,
    onOpenPrecisionModal,
    onOpenProjectMemoModal,
    onOpenHelpModal: () => setShowHelpModal(true),
    showToolSection,
    tool,
    onSetActiveTool: setActiveTool,
    mobileViewMode,
    onSetMobileViewMode: setMobileViewMode,
    showMobileMenu,
    onToggleMobileMenu: () =>
      setShowMobileMenu((previous) => {
        const next = !previous
        if (next) {
          setMobileOptionsTab('view')
        }
        return next
      }),
    mobileOptionsTab,
    onSetMobileOptionsTab: setMobileOptionsTab,
    showPresetSection,
    selectedPresetId,
    onSetSelectedPresetId: setSelectedPresetId,
    onLoadPreset: handleLoadPreset,
    onSetThemeMode: handleSetThemeMode,
    themeMode,
    showZoomSection,
    displayUnit,
    onSetDisplayUnit: setDisplayUnit,
    showCanvasRuler,
    onToggleCanvasRuler: () => setShowCanvasRuler((previous) => !previous),
    showDimensions,
    onToggleDimensions: () => setShowDimensions((previous) => !previous),
    sketchWorkspaceMode,
    onSetSketchWorkspaceMode: setSketchWorkspaceMode,
    showEditSection,
    canUndo,
    canRedo,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onCopySelection: handleCopySelection,
    onCutSelection: handleCutSelection,
    onPasteClipboard: handlePasteClipboard,
    canPaste,
    onSelectAllShapes: handleSelectAllShapes,
    onDuplicateSelection: handleDuplicateSelection,
    onDeleteSelection: handleDeleteSelection,
    onGroupSelection: handleGroupSelection,
    onUngroupSelection: handleUngroupSelection,
    onMoveSelectionByDistance: handleMoveSelectionByDistance,
    onCopySelectionByDistance: handleCopySelectionByDistance,
    onRotateSelectionCw1: () => handleRotateSelection(1),
    onRotateSelectionCw5: () => handleRotateSelection(5),
    onRotateSelectionCcw1: () => handleRotateSelection(-1),
    onRotateSelectionCcw5: () => handleRotateSelection(-5),
    onScaleSelectionUp1: () => handleScaleSelection(1.01),
    onScaleSelectionDown1: () => handleScaleSelection(0.99),
    onScaleSelectionUp5: () => handleScaleSelection(1.05),
    onScaleSelectionDown5: () => handleScaleSelection(0.95),
    onEnableStitchOnSelection: handleEnableStitchOnSelection,
    onDisableStitchOnSelection: handleDisableStitchOnSelection,
    onMoveSelectionBackward: handleMoveSelectionBackward,
    onMoveSelectionForward: handleMoveSelectionForward,
    onSendSelectionToBack: handleSendSelectionToBack,
    onBringSelectionToFront: handleBringSelectionToFront,
    showLineTypeSection,
    activeLineType,
    lineTypes,
    onSetActiveLineTypeId: setActiveLineTypeId,
    onToggleActiveLineTypeVisibility: handleToggleActiveLineTypeVisibility,
    onOpenLineTypePalette: () => setShowLineTypePalette(true),
    showStitchSection,
    stitchHoleType,
    onSetStitchHoleType: setStitchHoleType,
    stitchPitchMm,
    onSetStitchPitchMm: setStitchPitchMm,
    stitchVariablePitchStartMm,
    stitchVariablePitchEndMm,
    onSetStitchVariablePitchStartMm: setStitchVariablePitchStartMm,
    onSetStitchVariablePitchEndMm: setStitchVariablePitchEndMm,
    onAutoPlaceFixedPitchStitchHoles: handleAutoPlaceFixedPitchStitchHoles,
    onAutoPlaceVariablePitchStitchHoles: handleAutoPlaceVariablePitchStitchHoles,
    onResequenceSelectedStitchHoles: () => handleResequenceSelectedStitchHoles(false),
    onReverseSelectedStitchHoles: () => handleResequenceSelectedStitchHoles(true),
    onSelectNextStitchHole: handleSelectNextStitchHole,
    onFixStitchHoleOrderFromSelected: () => handleFixStitchHoleOrderFromSelected(false),
    onFixReverseStitchHoleOrderFromSelected: () => handleFixStitchHoleOrderFromSelected(true),
    showStitchSequenceLabels,
    onToggleStitchSequenceLabels: () => setShowStitchSequenceLabels((previous) => !previous),
    onCountStitchHolesOnSelectedShapes: handleCountStitchHolesOnSelectedShapes,
    onDeleteStitchHolesOnSelectedShapes: handleDeleteStitchHolesOnSelectedShapes,
    onClearAllStitchHoles: handleClearAllStitchHoles,
    selectedHoleCount: selectedStitchHoleCount,
    stitchHoleCount: stitchHolesLength,
    hasSelectedStitchHole,
    showLayerSection,
    activeLayer,
    layers,
    layerStackLevels,
    onSetActiveLayerId: setActiveLayerId,
    onClearDraft: clearDraft,
    mobileLayerAction,
    onSetMobileLayerAction: setMobileLayerAction,
    onRunMobileLayerAction: handleRunMobileLayerAction,
    onAddLayer: handleAddLayer,
    onRenameActiveLayer: handleRenameActiveLayer,
    onToggleLayerVisibility: handleToggleLayerVisibility,
    onToggleLayerLock: handleToggleLayerLock,
    onMoveLayerUp: () => handleMoveLayer(-1),
    onMoveLayerDown: () => handleMoveLayer(1),
    onDeleteLayer: handleDeleteLayer,
    onOpenLayerColorModal: () => setShowLayerColorModal(true),
    showFileSection,
    mobileFileAction,
    onSetMobileFileAction: setMobileFileAction,
    onRunMobileFileAction: handleRunMobileFileAction,
    onSaveJson: handleSaveJson,
    onOpenLoadJson: () => fileInputRef.current?.click(),
    onOpenImportSvg: () => svgInputRef.current?.click(),
    onExportSvg: handleExportSvg,
    onExportPdf: handleExportPdf,
    onExportDxf: handleExportDxf,
    onExportLaserSvg: handleExportLaserSvg,
    onOpenInNewTab: handleOpenInNewTab,
    onOpenExportModal: () => setShowExportModal(true),
    onOpenExportOptionsModal: () => setShowExportOptionsModal(true),
    onOpenPatternToolsModal: () => setShowPatternToolsModal(true),
    onOpenTemplateRepositoryModal: () => setShowTemplateRepositoryModal(true),
    onOpenTracingImport: () => tracingInputRef.current?.click(),
    onOpenTracingModal: () => setShowTracingModal(true),
    hasTracingOverlays: tracingOverlaysLength > 0,
    onOpenPrintPreviewModal: () => setShowPrintPreviewModal(true),
    showPrintAreas,
    onTogglePrintAreas: () => setShowPrintAreas((previous) => !previous),
    onToggleThreePreview: () => setShowThreePreview((previous) => !previous),
    onResetDocument: resetDocument,
  }
}
