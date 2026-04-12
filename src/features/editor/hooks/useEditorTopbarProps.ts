import { useMemo, type ComponentProps, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { Layer, StitchHoleDefaults, Tool } from '../cad/cad-types'
import { EditorTopbar } from '../components/EditorTopbar'
import type {
  StitchAutoPitchSettings,
  ThemeMode,
} from '../editor-types'
import { useEditorDocumentActions, useEditorDocumentSelector } from '../state/providers/EditorDocumentStateProvider'
import { useEditorLayerActions, useEditorLayerSelector } from '../state/providers/EditorLayerStateProvider'
import { useEditorUIActions, useEditorUISelector } from '../state/providers/EditorUIStateProvider'

type UseEditorTopbarPropsParams = {
  topbarClassName: string
  selectedShapeCount: number
  selectedStitchHoleCount: number
  setShowHelpModal: Dispatch<SetStateAction<boolean>>
  showToolSection: boolean
  tool: Tool
  setActiveTool: (tool: Tool) => void
  handleLoadPreset: () => void
  handleSetThemeMode: (mode: ThemeMode) => void
  showZoomSection: boolean
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
  handleToggleActiveLineTypeVisibility: () => void
  setShowLineTypePalette: Dispatch<SetStateAction<boolean>>
  showStitchSection: boolean
  stitchHoleDefaults: StitchHoleDefaults
  setStitchHoleDefaults: Dispatch<SetStateAction<StitchHoleDefaults>>
  stitchPitchMm: number
  setStitchPitchMm: Dispatch<SetStateAction<number>>
  stitchVariablePitchStartMm: number
  stitchVariablePitchEndMm: number
  setStitchVariablePitchStartMm: Dispatch<SetStateAction<number>>
  setStitchVariablePitchEndMm: Dispatch<SetStateAction<number>>
  stitchAutoPitchSettings: StitchAutoPitchSettings
  setStitchAutoPitchSettings: Dispatch<SetStateAction<StitchAutoPitchSettings>>
  handleAutoPlacePreferredPitchStitchHoles: () => void
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
  layerStackLevels: Record<string, number>
  clearDraft: () => void
  handleRunMobileLayerAction: () => void
  handleAddLayer: () => void
  handleRenameActiveLayer: () => void
  handleToggleLayerVisibility: () => void
  handleToggleLayerLock: () => void
  handleMoveLayer: (direction: -1 | 1) => void
  handleDeleteLayer: () => void
  setShowLayerColorModal: Dispatch<SetStateAction<boolean>>
  showFileSection: boolean
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
  setShowPrintPreviewModal: Dispatch<SetStateAction<boolean>>
  showPrintAreas: boolean
  setShowPrintAreas: Dispatch<SetStateAction<boolean>>
  resetDocument: () => void
}

export function useEditorTopbarProps(params: UseEditorTopbarPropsParams): ComponentProps<typeof EditorTopbar> {
  const {
    topbarClassName,
    selectedShapeCount,
    selectedStitchHoleCount,
    setShowHelpModal,
    showToolSection,
    tool,
    setActiveTool,
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
    handleToggleActiveLineTypeVisibility,
    setShowLineTypePalette,
    showStitchSection,
    stitchHoleDefaults,
    setStitchHoleDefaults,
    stitchPitchMm,
    setStitchPitchMm,
    stitchVariablePitchStartMm,
    stitchVariablePitchEndMm,
    setStitchVariablePitchStartMm,
    setStitchVariablePitchEndMm,
    stitchAutoPitchSettings,
    setStitchAutoPitchSettings,
    handleAutoPlacePreferredPitchStitchHoles,
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
    layerStackLevels,
    clearDraft,
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
    setShowExportModal,
    setShowExportOptionsModal,
    setShowPatternToolsModal,
    setShowTemplateRepositoryModal,
    setShowTracingModal,
    setShowPrintPreviewModal,
    showPrintAreas,
    setShowPrintAreas,
    resetDocument,
  } = params
  const {
    lineTypes,
    activeLineTypeId,
    showCanvasRuler,
    showDimensions,
    tracingOverlays,
  } = useEditorDocumentSelector((state) => ({
    lineTypes: state.lineTypes,
    activeLineTypeId: state.activeLineTypeId,
    showCanvasRuler: state.showCanvasRuler,
    showDimensions: state.showDimensions,
    tracingOverlays: state.tracingOverlays,
  }))
  const {
    setActiveLineTypeId,
    setShowCanvasRuler,
    setShowDimensions,
  } = useEditorDocumentActions()
  const { layers } = useEditorLayerSelector((state) => ({
    layers: state.layers,
  }))
  const { setActiveLayerId } = useEditorLayerActions()
  const {
    isMobileLayout,
    desktopRibbonTab,
    showThreePreview,
    mobileViewMode,
    showMobileMenu,
    mobileOptionsTab,
    themeMode,
    displayUnit,
    gridSpacing,
    sketchWorkspaceMode,
    mobileLayerAction,
    mobileFileAction,
  } = useEditorUISelector((state) => ({
    isMobileLayout: state.isMobileLayout,
    desktopRibbonTab: state.desktopRibbonTab,
    showThreePreview: state.showThreePreview,
    mobileViewMode: state.mobileViewMode,
    showMobileMenu: state.showMobileMenu,
    mobileOptionsTab: state.mobileOptionsTab,
    themeMode: state.themeMode,
    displayUnit: state.displayUnit,
    gridSpacing: state.gridSpacing,
    sketchWorkspaceMode: state.sketchWorkspaceMode,
    mobileLayerAction: state.mobileLayerAction,
    mobileFileAction: state.mobileFileAction,
  }))
  const {
    setDesktopRibbonTab,
    setShowPrecisionModal,
    setShowProjectMemoModal,
    setMobileViewMode,
    setShowMobileMenu,
    setMobileOptionsTab,
    setDisplayUnit,
    setGridSpacing,
    setSketchWorkspaceMode,
    setMobileLayerAction,
    setMobileFileAction,
    setShowThreePreview,
  } = useEditorUIActions()
  const activeLineType = useMemo(
    () => lineTypes.find((lineType) => lineType.id === activeLineTypeId) ?? lineTypes[0] ?? null,
    [activeLineTypeId, lineTypes],
  )

  return {
    topbarClassName,
    isMobileLayout,
    desktopRibbonTab,
    onDesktopRibbonTabChange: setDesktopRibbonTab,
    selectedShapeCount,
    selectedStitchHoleCount,
    showThreePreview,
    onOpenPrecisionModal: () => setShowPrecisionModal(true),
    onOpenProjectMemoModal: () => setShowProjectMemoModal(true),
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
    gridSpacing,
    onSetGridSpacing: setGridSpacing,
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
    stitchHoleDefaults,
    onUpdateStitchHoleDefaults: (patch) => setStitchHoleDefaults((previous) => ({ ...previous, ...patch })),
    stitchPitchMm,
    onSetStitchPitchMm: setStitchPitchMm,
    stitchVariablePitchStartMm,
    stitchVariablePitchEndMm,
    onSetStitchVariablePitchStartMm: setStitchVariablePitchStartMm,
    onSetStitchVariablePitchEndMm: setStitchVariablePitchEndMm,
    stitchAutoPitchSettings,
    onUpdateStitchAutoPitchSettings: (patch) =>
      setStitchAutoPitchSettings((previous) => ({
        ...previous,
        ...patch,
      })),
    onAutoPlacePreferredPitchStitchHoles: handleAutoPlacePreferredPitchStitchHoles,
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
    hasTracingOverlays: tracingOverlays.length > 0,
    onOpenPrintPreviewModal: () => setShowPrintPreviewModal(true),
    showPrintAreas,
    onTogglePrintAreas: () => setShowPrintAreas((previous) => !previous),
    onToggleThreePreview: () => setShowThreePreview((previous) => !previous),
    onResetDocument: resetDocument,
  }
}
