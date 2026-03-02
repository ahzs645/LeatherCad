import type { ComponentProps, Dispatch, RefObject, SetStateAction } from 'react'
import type {
  ConstraintAxis,
  ConstraintEdge,
  HardwareKind,
  HardwareMarker,
  Layer,
  LineType,
  ParametricConstraint,
  SketchGroup,
  SnapSettings,
  TracingOverlay,
} from '../cad/cad-types'
import { DEFAULT_BACK_LAYER_COLOR, DEFAULT_FRONT_LAYER_COLOR } from '../editor-constants'
import type { DxfVersion, ExportRoleFilters } from '../editor-types'
import { normalizeHexColor } from '../editor-utils'
import { EditorModalStack } from '../components/EditorModalStack'
import type { TemplateRepositoryEntry } from '../templates/template-repository'
import type { PrintPaper, PrintPlan } from '../preview/print-preview'

type UseEditorModalStackPropsParams = {
  showLineTypePalette: boolean
  setShowLineTypePalette: Dispatch<SetStateAction<boolean>>
  lineTypes: LineType[]
  setLineTypes: Dispatch<SetStateAction<LineType[]>>
  activeLineType: LineType | null
  shapeCountsByLineType: Record<string, number>
  selectedShapeCount: number
  setActiveLineTypeId: Dispatch<SetStateAction<string>>
  handleShowAllLineTypes: () => void
  handleIsolateActiveLineType: () => void
  handleUpdateActiveLineTypeRole: (role: import('../cad/cad-types').LineTypeRole) => void
  handleUpdateActiveLineTypeStyle: (style: import('../cad/cad-types').LineTypeStyle) => void
  handleUpdateActiveLineTypeColor: (color: string) => void
  handleSelectShapesByActiveLineType: () => void
  handleAssignSelectedToActiveLineType: () => void
  handleClearShapeSelection: () => void
  showHelpModal: boolean
  setShowHelpModal: Dispatch<SetStateAction<boolean>>
  showLayerColorModal: boolean
  setShowLayerColorModal: Dispatch<SetStateAction<boolean>>
  layers: Layer[]
  layerColorsById: Record<string, string>
  layerColorOverrides: Record<string, string>
  frontLayerColor: string
  backLayerColor: string
  setFrontLayerColor: Dispatch<SetStateAction<string>>
  setBackLayerColor: Dispatch<SetStateAction<string>>
  handleSetLayerColorOverride: (layerId: string, nextColor: string) => void
  handleClearLayerColorOverride: (layerId: string) => void
  handleResetLayerColors: () => void
  showExportOptionsModal: boolean
  setShowExportOptionsModal: Dispatch<SetStateAction<boolean>>
  activeExportRoleCount: number
  exportOnlySelectedShapes: boolean
  setExportOnlySelectedShapes: Dispatch<SetStateAction<boolean>>
  exportOnlyVisibleLineTypes: boolean
  setExportOnlyVisibleLineTypes: Dispatch<SetStateAction<boolean>>
  exportForceSolidStrokes: boolean
  setExportForceSolidStrokes: Dispatch<SetStateAction<boolean>>
  exportRoleFilters: ExportRoleFilters
  setExportRoleFilters: Dispatch<SetStateAction<ExportRoleFilters>>
  dxfVersion: DxfVersion
  setDxfVersion: Dispatch<SetStateAction<DxfVersion>>
  dxfFlipY: boolean
  setDxfFlipY: Dispatch<SetStateAction<boolean>>
  handleResetExportOptions: () => void
  showTemplateRepositoryModal: boolean
  setShowTemplateRepositoryModal: Dispatch<SetStateAction<boolean>>
  templateRepository: TemplateRepositoryEntry[]
  selectedTemplateEntryId: string | null
  selectedTemplateEntry: TemplateRepositoryEntry | null
  setSelectedTemplateEntryId: Dispatch<SetStateAction<string | null>>
  handleSaveTemplateToRepository: () => void
  handleExportTemplateRepository: () => void
  templateImportInputRef: RefObject<HTMLInputElement | null>
  handleLoadTemplateAsDocument: () => void
  handleInsertTemplateIntoDocument: () => void
  handleDeleteTemplateFromRepository: (entryId: string) => void
  showPatternToolsModal: boolean
  setShowPatternToolsModal: Dispatch<SetStateAction<boolean>>
  snapSettings: SnapSettings
  setSnapSettings: Dispatch<SetStateAction<SnapSettings>>
  handleAlignSelection: (axis: 'x' | 'y' | 'both') => void
  handleAlignSelectionToGrid: () => void
  activeLayer: Layer | null
  activeLayerId: string
  sketchGroups: SketchGroup[]
  activeSketchGroup: SketchGroup | null
  setActiveSketchGroupId: Dispatch<SetStateAction<string | null>>
  handleCreateSketchGroupFromSelection: () => void
  handleDuplicateActiveSketchGroup: () => void
  handleRenameActiveSketchGroup: () => void
  handleToggleActiveSketchGroupVisibility: () => void
  handleToggleActiveSketchGroupLock: () => void
  handleClearActiveSketchGroup: () => void
  handleDeleteActiveSketchGroup: () => void
  handleSetActiveLayerAnnotation: (annotation: string) => void
  handleSetActiveSketchAnnotation: (annotation: string) => void
  showAnnotations: boolean
  setShowAnnotations: Dispatch<SetStateAction<boolean>>
  constraintEdge: ConstraintEdge
  setConstraintEdge: Dispatch<SetStateAction<ConstraintEdge>>
  constraintOffsetMm: number
  setConstraintOffsetMm: Dispatch<SetStateAction<number>>
  constraintAxis: ConstraintAxis
  setConstraintAxis: Dispatch<SetStateAction<ConstraintAxis>>
  handleAddEdgeConstraintFromSelection: () => void
  handleAddAlignConstraintsFromSelection: () => void
  handleApplyConstraints: () => void
  constraints: ParametricConstraint[]
  handleToggleConstraintEnabled: (constraintId: string) => void
  handleDeleteConstraint: (constraintId: string) => void
  seamAllowanceInputMm: number
  setSeamAllowanceInputMm: Dispatch<SetStateAction<number>>
  handleApplySeamAllowanceToSelection: () => void
  handleClearSeamAllowanceOnSelection: () => void
  handleClearAllSeamAllowances: () => void
  seamAllowancesLength: number
  hardwarePreset: HardwareKind
  setHardwarePreset: Dispatch<SetStateAction<HardwareKind>>
  customHardwareDiameterMm: number
  setCustomHardwareDiameterMm: Dispatch<SetStateAction<number>>
  customHardwareSpacingMm: number
  setCustomHardwareSpacingMm: Dispatch<SetStateAction<number>>
  setActiveTool: (nextTool: import('../cad/cad-types').Tool) => void
  selectedHardwareMarker: HardwareMarker | null
  handleUpdateSelectedHardwareMarker: (patch: Partial<HardwareMarker>) => void
  handleDeleteSelectedHardwareMarker: () => void
  showTracingModal: boolean
  setShowTracingModal: Dispatch<SetStateAction<boolean>>
  tracingOverlays: TracingOverlay[]
  activeTracingOverlay: TracingOverlay | null
  tracingInputRef: RefObject<HTMLInputElement | null>
  handleDeleteTracingOverlay: (overlayId: string) => void
  setActiveTracingOverlayId: Dispatch<SetStateAction<string | null>>
  handleUpdateTracingOverlay: (overlayId: string, patch: Partial<TracingOverlay>) => void
  showPrintPreviewModal: boolean
  setShowPrintPreviewModal: Dispatch<SetStateAction<boolean>>
  printPaper: PrintPaper
  setPrintPaper: Dispatch<SetStateAction<PrintPaper>>
  printScalePercent: number
  setPrintScalePercent: Dispatch<SetStateAction<number>>
  printTileX: number
  setPrintTileX: Dispatch<SetStateAction<number>>
  printTileY: number
  setPrintTileY: Dispatch<SetStateAction<number>>
  printOverlapMm: number
  setPrintOverlapMm: Dispatch<SetStateAction<number>>
  printMarginMm: number
  setPrintMarginMm: Dispatch<SetStateAction<number>>
  printSelectedOnly: boolean
  setPrintSelectedOnly: Dispatch<SetStateAction<boolean>>
  printRulerInside: boolean
  setPrintRulerInside: Dispatch<SetStateAction<boolean>>
  printInColor: boolean
  setPrintInColor: Dispatch<SetStateAction<boolean>>
  printStitchAsDots: boolean
  setPrintStitchAsDots: Dispatch<SetStateAction<boolean>>
  printPlan: PrintPlan | null
  showPrintAreas: boolean
  setShowPrintAreas: Dispatch<SetStateAction<boolean>>
  handleFitView: () => void
}

export function useEditorModalStackProps(params: UseEditorModalStackPropsParams): ComponentProps<typeof EditorModalStack> {
  const {
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
    handleDuplicateActiveSketchGroup,
    handleRenameActiveSketchGroup,
    handleToggleActiveSketchGroupVisibility,
    handleToggleActiveSketchGroupLock,
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
    seamAllowancesLength,
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
  } = params

  return {
    lineTypePaletteProps: {
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
    },
    helpModalProps: {
      open: showHelpModal,
      onClose: () => setShowHelpModal(false),
    },
    layerColorModalProps: {
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
    },
    exportOptionsModalProps: {
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
    },
    templateRepositoryModalProps: {
      open: showTemplateRepositoryModal,
      onClose: () => setShowTemplateRepositoryModal(false),
      templateRepository,
      selectedTemplateEntryId,
      selectedTemplateEntry,
      onSelectTemplateEntry: setSelectedTemplateEntryId,
      onSaveTemplate: handleSaveTemplateToRepository,
      onExportRepository: handleExportTemplateRepository,
      onImportRepository: () => templateImportInputRef.current?.click(),
      onLoadAsDocument: handleLoadAsDocument,
      onInsertIntoDocument: handleInsertIntoDocument,
      onDeleteTemplate: handleDeleteTemplate,
    },
    patternToolsModalProps: {
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
      seamAllowanceCount: seamAllowancesLength,
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
    },
    tracingModalProps: {
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
    },
    printPreviewModalProps: {
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
    },
  }

  function handleLoadAsDocument() {
    handleLoadTemplateAsDocument()
  }

  function handleInsertIntoDocument() {
    handleInsertTemplateIntoDocument()
  }

  function handleDeleteTemplate(entryId: string) {
    handleDeleteTemplateFromRepository(entryId)
  }
}
