import { useMemo, type ComponentProps, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { HardwareMarker, Layer, Shape, SketchGroup, TracingOverlay } from '../cad/cad-types'
import { DEFAULT_BACK_LAYER_COLOR, DEFAULT_FRONT_LAYER_COLOR } from '../editor-constants'
import { normalizeHexColor } from '../editor-utils'
import { EditorModalStack } from '../components/EditorModalStack'
import type { TemplateRepositoryEntry, TemplateRepositoryMoveDirection, TemplateRepositorySortKey } from '../templates/template-repository'
import type { CatalogRepositoryMoveDirection, CatalogRepositoryShop, CatalogRepositorySortKey } from '../templates/catalog-repository'
import type { PrintPlan } from '../preview/print-preview'
import { useEditorDocumentActions, useEditorDocumentSelector } from '../state/providers/EditorDocumentStateProvider'
import { useEditorLayerActions, useEditorLayerSelector } from '../state/providers/EditorLayerStateProvider'
import { useEditorPanelActions, useEditorPanelSelector } from '../state/providers/EditorPanelStateProvider'
import { useEditorToolActions, useEditorToolSelector } from '../state/providers/EditorToolStateProvider'
import { useEditorUIActions, useEditorUISelector } from '../state/providers/EditorUIStateProvider'

export type UseEditorModalStackPropsParams = {
  shapeCountsByLineType: Record<string, number>
  selectedShapeCount: number
  handleShowAllLineTypes: () => void
  handleIsolateActiveLineType: () => void
  handleUpdateActiveLineTypeRole: (role: import('../cad/cad-types').LineTypeRole) => void
  handleUpdateActiveLineTypeStyle: (style: import('../cad/cad-types').LineTypeStyle) => void
  handleUpdateActiveLineTypeColor: (color: string) => void
  handleUpdateActiveLineTypeStrokeWidthMm: (strokeWidthMm: number) => void
  handleUpdateActiveLineTypeIgnoreInPrint: (ignoreInPrint: boolean) => void
  handleSelectShapesByActiveLineType: () => void
  handleAssignSelectedToActiveLineType: () => void
  handleClearShapeSelection: () => void
  handleLinePaletteSelectAllVisible: () => void
  handleLinePaletteUnselectActive: () => void
  handleLinePaletteUnselectOtherThanActive: () => void
  layerColorsById: Record<string, string>
  handleSetLayerColorOverride: (layerId: string, nextColor: string) => void
  handleClearLayerColorOverride: (layerId: string) => void
  handleResetLayerColors: () => void
  handleSaveJson: () => void
  handleExportGarmentJson: () => void
  handleSaveLcc: () => void
  handleExportSvg: () => void
  handleExportPdf: () => void
  handleExportDxf: () => void
  handleExportLaserSvg: () => void
  activeExportRoleCount: number
  handleResetExportOptions: () => void
  templateRepository: TemplateRepositoryEntry[]
  catalogRepository: CatalogRepositoryShop[]
  selectedTemplateEntryId: string | null
  selectedTemplateEntry: TemplateRepositoryEntry | null
  selectedCatalogShopId: string | null
  setSelectedTemplateEntryId: Dispatch<SetStateAction<string | null>>
  setSelectedCatalogShopId: Dispatch<SetStateAction<string | null>>
  handleSaveTemplateToRepository: () => void
  handleExportTemplateRepository: () => void
  templateImportInputRef: RefObject<HTMLInputElement | null>
  catalogImportInputRef: RefObject<HTMLInputElement | null>
  handleLoadPreset: () => void
  handleLoadTemplateAsDocument: () => void
  handleInsertTemplateIntoDocument: () => void
  handleDeleteTemplateFromRepository: (entryId: string) => void
  handleMoveTemplateEntry: (entryId: string, direction: TemplateRepositoryMoveDirection) => void
  handleSortTemplates: (sortKey: TemplateRepositorySortKey) => void
  handleDeleteCatalogShop: (shopId: string) => void
  handleMoveCatalogShop: (shopId: string, direction: CatalogRepositoryMoveDirection) => void
  handleSortCatalogShops: (sortKey: CatalogRepositorySortKey) => void
  handleAlignSelection: (axis: 'x' | 'y' | 'both') => void
  handleAlignSelectionToGrid: () => void
  activeLayer: Layer | null
  handleCreateSketchGroupFromSelection: () => void
  handleCreateLinkedSketchGroup: (mode: NonNullable<SketchGroup['linkMode']>) => void
  handleDuplicateActiveSketchGroup: () => void
  handleRenameActiveSketchGroup: () => void
  handleToggleActiveSketchGroupVisibility: () => void
  handleToggleActiveSketchGroupLock: () => void
  handleSetActiveSketchLink: (patch: {
    baseGroupId?: string | null
    linkMode?: SketchGroup['linkMode']
    linkOffsetX?: number
    linkOffsetY?: number
  }) => void
  handleClearActiveSketchLink: () => void
  handleClearActiveSketchGroup: () => void
  handleDeleteActiveSketchGroup: () => void
  handleSetActiveLayerAnnotation: (annotation: string) => void
  handleSetActiveSketchAnnotation: (annotation: string) => void
  handleAddEdgeConstraintFromSelection: () => void
  handleAddAlignConstraintsFromSelection: () => void
  handleApplyConstraints: () => void
  handleToggleConstraintEnabled: (constraintId: string) => void
  handleDeleteConstraint: (constraintId: string) => void
  handleApplySeamAllowanceToSelection: () => void
  handleClearSeamAllowanceOnSelection: () => void
  handleClearAllSeamAllowances: () => void
  handleBevelSelectedCorner: () => void
  handleRoundSelectedCorner: () => void
  handleCreateOffsetGeometryFromSelection: () => void
  handleCreateBoxStitchFromSelection: () => void
  selectedEditableShape: Shape | null
  handleUpdateSelectedShapePoint: (
    pointKey: 'start' | 'mid' | 'control' | 'end',
    axis: 'x' | 'y',
    value: number,
  ) => void
  handleApplyTextDefaultsToSelection: () => void
  selectedHardwareMarker: HardwareMarker | null
  handleUpdateSelectedHardwareMarker: (patch: Partial<HardwareMarker>) => void
  handleDeleteSelectedHardwareMarker: () => void
  handleBooleanOp: (op: import('../ops/clipper-ops').BooleanOp) => void
  handleClipperOffset: (offsetMm: number, joinType: import('../ops/clipper-ops').OffsetJoinType) => void
  handleTextToPath: () => void
  handleOpenNesting: () => void
  tracingInputRef: RefObject<HTMLInputElement | null>
  handleDeleteTracingOverlay: (overlayId: string) => void
  handleUpdateTracingOverlay: (overlayId: string, patch: Partial<TracingOverlay>) => void
  handleSetPdfTracingPage: (overlay: TracingOverlay, pageNumber: number) => void
  printPlan: PrintPlan | null
  handleFitView: () => void
  handleOpenPrintTiles: () => void
  handleLoadAiBuilderDocument: (doc: import('../cad/cad-types').DocFile, documentName: string) => void
  handleInsertAiBuilderDocument: (doc: import('../cad/cad-types').DocFile, documentName: string) => void
}

export function useEditorModalStackProps(params: UseEditorModalStackPropsParams): ComponentProps<typeof EditorModalStack> {
  const {
    shapeCountsByLineType,
    selectedShapeCount,
    handleShowAllLineTypes,
    handleIsolateActiveLineType,
    handleUpdateActiveLineTypeRole,
    handleUpdateActiveLineTypeStyle,
    handleUpdateActiveLineTypeColor,
    handleUpdateActiveLineTypeStrokeWidthMm,
    handleUpdateActiveLineTypeIgnoreInPrint,
    handleSelectShapesByActiveLineType,
    handleAssignSelectedToActiveLineType,
    handleClearShapeSelection,
    handleLinePaletteSelectAllVisible,
    handleLinePaletteUnselectActive,
    handleLinePaletteUnselectOtherThanActive,
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
    catalogRepository,
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
    handleMoveTemplateEntry,
    handleSortTemplates,
    handleDeleteCatalogShop,
    handleMoveCatalogShop,
    handleSortCatalogShops,
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
    handleCreateBoxStitchFromSelection,
    selectedEditableShape,
    handleUpdateSelectedShapePoint,
    handleApplyTextDefaultsToSelection,
    selectedHardwareMarker,
    handleUpdateSelectedHardwareMarker,
    handleDeleteSelectedHardwareMarker,
    handleBooleanOp,
    handleClipperOffset,
    handleTextToPath,
    handleOpenNesting,
    tracingInputRef,
    handleDeleteTracingOverlay,
    handleUpdateTracingOverlay,
    handleSetPdfTracingPage,
    printPlan,
    handleFitView,
    handleOpenPrintTiles,
    handleLoadAiBuilderDocument,
    handleInsertAiBuilderDocument,
  } = params

  const {
    textDraftValue,
    textFontFamily,
    textFontSizeMm,
    textTransformMode,
    textRadiusMm,
    textSweepDeg,
  } = useEditorToolSelector((state) => ({
    textDraftValue: state.textDraftValue,
    textFontFamily: state.textFontFamily,
    textFontSizeMm: state.textFontSizeMm,
    textTransformMode: state.textTransformMode,
    textRadiusMm: state.textRadiusMm,
    textSweepDeg: state.textSweepDeg,
  }))
  const {
    setTextDraftValue,
    setTextFontFamily,
    setTextFontSizeMm,
    setTextTransformMode,
    setTextRadiusMm,
    setTextSweepDeg,
    setActiveTool,
  } = useEditorToolActions()
  const {
    showLineTypePalette,
    showHelpModal,
    showLayerColorModal,
    showExportModal,
    showExportOptionsModal,
    exportOnlySelectedShapes,
    exportOnlyVisibleLineTypes,
    exportForceSolidStrokes,
    exportStitchHoleRenderMode,
    exportStitchDotRadiusMm,
    exportRoleFilters,
    dxfVersion,
    dxfFlipY,
    showTemplateRepositoryModal,
    showPatternToolsModal,
    showAiBuilderModal,
    constraintEdge,
    constraintOffsetMm,
    constraintAxis,
    seamAllowanceInputMm,
    hardwarePreset,
    customHardwareDiameterMm,
    customHardwareSpacingMm,
    showTracingModal,
    showPrintPreviewModal,
    printPaper,
    printScalePercent,
    printCalibrationXPercent,
    printCalibrationYPercent,
    printTileX,
    printTileY,
    printOverlapMm,
    printMarginMm,
    printSelectedOnly,
    printRulerInside,
    printInColor,
    printStitchAsDots,
    printLineThicknessScalePercent,
    printShowIgnoredLineTypes,
    showPrintAreas,
  } = useEditorPanelSelector((state) => ({
    showLineTypePalette: state.showLineTypePalette,
    showHelpModal: state.showHelpModal,
    showLayerColorModal: state.showLayerColorModal,
    showExportModal: state.showExportModal,
    showExportOptionsModal: state.showExportOptionsModal,
    exportOnlySelectedShapes: state.exportOnlySelectedShapes,
    exportOnlyVisibleLineTypes: state.exportOnlyVisibleLineTypes,
    exportForceSolidStrokes: state.exportForceSolidStrokes,
    exportStitchHoleRenderMode: state.exportStitchHoleRenderMode,
    exportStitchDotRadiusMm: state.exportStitchDotRadiusMm,
    exportRoleFilters: state.exportRoleFilters,
    dxfVersion: state.dxfVersion,
    dxfFlipY: state.dxfFlipY,
    showTemplateRepositoryModal: state.showTemplateRepositoryModal,
    showPatternToolsModal: state.showPatternToolsModal,
    showAiBuilderModal: state.showAiBuilderModal,
    constraintEdge: state.constraintEdge,
    constraintOffsetMm: state.constraintOffsetMm,
    constraintAxis: state.constraintAxis,
    seamAllowanceInputMm: state.seamAllowanceInputMm,
    hardwarePreset: state.hardwarePreset,
    customHardwareDiameterMm: state.customHardwareDiameterMm,
    customHardwareSpacingMm: state.customHardwareSpacingMm,
    showTracingModal: state.showTracingModal,
    showPrintPreviewModal: state.showPrintPreviewModal,
    printPaper: state.printPaper,
    printScalePercent: state.printScalePercent,
    printCalibrationXPercent: state.printCalibrationXPercent,
    printCalibrationYPercent: state.printCalibrationYPercent,
    printTileX: state.printTileX,
    printTileY: state.printTileY,
    printOverlapMm: state.printOverlapMm,
    printMarginMm: state.printMarginMm,
    printSelectedOnly: state.printSelectedOnly,
    printRulerInside: state.printRulerInside,
    printInColor: state.printInColor,
    printStitchAsDots: state.printStitchAsDots,
    printLineThicknessScalePercent: state.printLineThicknessScalePercent,
    printShowIgnoredLineTypes: state.printShowIgnoredLineTypes,
    showPrintAreas: state.showPrintAreas,
  }))
  const {
    setShowLineTypePalette,
    setShowHelpModal,
    setShowLayerColorModal,
    setShowExportModal,
    setShowExportOptionsModal,
    setExportOnlySelectedShapes,
    setExportOnlyVisibleLineTypes,
    setExportForceSolidStrokes,
    setExportStitchHoleRenderMode,
    setExportStitchDotRadiusMm,
    setExportRoleFilters,
    setDxfVersion,
    setDxfFlipY,
    setShowTemplateRepositoryModal,
    setShowPatternToolsModal,
    setShowAiBuilderModal,
    setConstraintEdge,
    setConstraintOffsetMm,
    setConstraintAxis,
    setSeamAllowanceInputMm,
    setHardwarePreset,
    setCustomHardwareDiameterMm,
    setCustomHardwareSpacingMm,
    setShowTracingModal,
    setShowPrintPreviewModal,
    setPrintPaper,
    setPrintScalePercent,
    setPrintCalibrationXPercent,
    setPrintCalibrationYPercent,
    setPrintTileX,
    setPrintTileY,
    setPrintOverlapMm,
    setPrintMarginMm,
    setPrintSelectedOnly,
    setPrintRulerInside,
    setPrintInColor,
    setPrintStitchAsDots,
    setPrintLineThicknessScalePercent,
    setPrintShowIgnoredLineTypes,
    setShowPrintAreas,
  } = useEditorPanelActions()
  const {
    layers,
    activeLayerId,
    layerColorOverrides,
    frontLayerColor,
    backLayerColor,
  } = useEditorLayerSelector((state) => ({
    layers: state.layers,
    activeLayerId: state.activeLayerId,
    layerColorOverrides: state.layerColorOverrides,
    frontLayerColor: state.frontLayerColor,
    backLayerColor: state.backLayerColor,
  }))
  const {
    setFrontLayerColor,
    setBackLayerColor,
  } = useEditorLayerActions()
  const {
    lineTypes,
    activeLineTypeId,
    snapSettings,
    sketchGroups,
    activeSketchGroupId,
    showAnnotations,
    constraints,
    tracingOverlays,
    activeTracingOverlayId,
    seamAllowanceCount,
  } = useEditorDocumentSelector((state) => ({
    lineTypes: state.lineTypes,
    activeLineTypeId: state.activeLineTypeId,
    snapSettings: state.snapSettings,
    sketchGroups: state.sketchGroups,
    activeSketchGroupId: state.activeSketchGroupId,
    showAnnotations: state.showAnnotations,
    constraints: state.constraints,
    tracingOverlays: state.tracingOverlays,
    activeTracingOverlayId: state.activeTracingOverlayId,
    seamAllowanceCount: state.seamAllowances.length,
  }))
  const {
    setLineTypes,
    setActiveLineTypeId,
    setSnapSettings,
    setActiveSketchGroupId,
    setShowAnnotations,
    setActiveTracingOverlayId,
  } = useEditorDocumentActions()
  const { selectedPresetId } = useEditorUISelector((state) => ({
    selectedPresetId: state.selectedPresetId,
  }))
  const { setSelectedPresetId, setStatus } = useEditorUIActions()

  const activeLineType = useMemo(
    () => lineTypes.find((lineType) => lineType.id === activeLineTypeId) ?? lineTypes[0] ?? null,
    [activeLineTypeId, lineTypes],
  )
  const activeSketchGroup = useMemo(
    () => (activeSketchGroupId ? sketchGroups.find((group) => group.id === activeSketchGroupId) ?? null : null),
    [activeSketchGroupId, sketchGroups],
  )
  const activeTracingOverlay = useMemo(
    () => (activeTracingOverlayId ? tracingOverlays.find((overlay) => overlay.id === activeTracingOverlayId) ?? null : null),
    [activeTracingOverlayId, tracingOverlays],
  )

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
      onUpdateActiveLineTypeStrokeWidthMm: handleUpdateActiveLineTypeStrokeWidthMm,
      onUpdateActiveLineTypeIgnoreInPrint: handleUpdateActiveLineTypeIgnoreInPrint,
      onSelectShapesByActiveType: handleSelectShapesByActiveLineType,
      onAssignSelectedToActiveType: handleAssignSelectedToActiveLineType,
      onClearSelection: handleClearShapeSelection,
      onSelectAllOnVisibleLineTypes: handleLinePaletteSelectAllVisible,
      onUnselectActiveLineType: handleLinePaletteUnselectActive,
      onUnselectOtherLineTypes: handleLinePaletteUnselectOtherThanActive,
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
    exportModalProps: {
      open: showExportModal,
      onClose: () => setShowExportModal(false),
      showPrintAreas,
      onTogglePrintAreas: () => setShowPrintAreas((previous) => !previous),
      onOpenExportOptions: () => setShowExportOptionsModal(true),
      onOpenPrintPreview: () => setShowPrintPreviewModal(true),
      onSaveJson: handleSaveJson,
      onExportGarmentJson: handleExportGarmentJson,
      onSaveLcc: handleSaveLcc,
      onExportSvg: handleExportSvg,
      onExportPdf: handleExportPdf,
      onExportDxf: handleExportDxf,
      onExportLaserSvg: handleExportLaserSvg,
    },
    exportOptionsModalProps: {
      open: showExportOptionsModal,
      onClose: () => setShowExportOptionsModal(false),
      activeExportRoleCount,
      exportOnlySelectedShapes,
      exportOnlyVisibleLineTypes,
      exportForceSolidStrokes,
      exportStitchHoleRenderMode,
      exportStitchDotRadiusMm,
      exportRoleFilters,
      dxfVersion,
      dxfFlipY,
      onExportOnlySelectedShapesChange: setExportOnlySelectedShapes,
      onExportOnlyVisibleLineTypesChange: setExportOnlyVisibleLineTypes,
      onExportForceSolidStrokesChange: setExportForceSolidStrokes,
      onExportStitchHoleRenderModeChange: setExportStitchHoleRenderMode,
      onExportStitchDotRadiusMmChange: setExportStitchDotRadiusMm,
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
      catalogRepository,
      selectedTemplateEntryId,
      selectedTemplateEntry,
      selectedCatalogShopId,
      selectedPresetId,
      onSelectTemplateEntry: setSelectedTemplateEntryId,
      onSelectCatalogShop: setSelectedCatalogShopId,
      onSelectPreset: setSelectedPresetId,
      onSaveTemplate: handleSaveTemplateToRepository,
      onExportRepository: handleExportTemplateRepository,
      onImportRepository: () => templateImportInputRef.current?.click(),
      onImportCatalog: () => catalogImportInputRef.current?.click(),
      onLoadPreset: handleLoadPreset,
      onLoadAsDocument: handleLoadTemplateAsDocument,
      onInsertIntoDocument: handleInsertTemplateIntoDocument,
      onDeleteTemplate: handleDeleteTemplateFromRepository,
      onMoveTemplate: handleMoveTemplateEntry,
      onSortTemplates: handleSortTemplates,
      onDeleteCatalogShop: handleDeleteCatalogShop,
      onMoveCatalogShop: handleMoveCatalogShop,
      onSortCatalogShops: handleSortCatalogShops,
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
      onCreateLinkedSketchGroup: handleCreateLinkedSketchGroup,
      onDuplicateActiveSketchGroup: handleDuplicateActiveSketchGroup,
      onRenameActiveSketchGroup: handleRenameActiveSketchGroup,
      onToggleActiveSketchGroupVisibility: handleToggleActiveSketchGroupVisibility,
      onToggleActiveSketchGroupLock: handleToggleActiveSketchGroupLock,
      onSetActiveSketchLink: handleSetActiveSketchLink,
      onClearActiveSketchLink: handleClearActiveSketchLink,
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
      seamAllowanceCount,
      onBevelSelectedCorner: handleBevelSelectedCorner,
      onRoundSelectedCorner: handleRoundSelectedCorner,
      onCreateOffsetGeometryFromSelection: handleCreateOffsetGeometryFromSelection,
      onCreateBoxStitchFromSelection: handleCreateBoxStitchFromSelection,
      selectedEditableShape,
      onUpdateSelectedShapePoint: handleUpdateSelectedShapePoint,
      textDraftValue,
      onSetTextDraftValue: setTextDraftValue,
      textFontFamily,
      onSetTextFontFamily: setTextFontFamily,
      textFontSizeMm,
      onSetTextFontSizeMm: setTextFontSizeMm,
      textTransformMode,
      onSetTextTransformMode: setTextTransformMode,
      textRadiusMm,
      onSetTextRadiusMm: setTextRadiusMm,
      textSweepDeg,
      onSetTextSweepDeg: setTextSweepDeg,
      onApplyTextDefaultsToSelection: handleApplyTextDefaultsToSelection,
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
      onBooleanOp: handleBooleanOp,
      onClipperOffset: handleClipperOffset,
      onTextToPath: handleTextToPath,
      onOpenAiBuilder: () => {
        setShowPatternToolsModal(false)
        setShowAiBuilderModal(true)
      },
      onOpenNesting: handleOpenNesting,
    },
    aiBuilderModalProps: {
      open: showAiBuilderModal,
      onClose: () => setShowAiBuilderModal(false),
      onLoadDocument: handleLoadAiBuilderDocument,
      onInsertDocument: handleInsertAiBuilderDocument,
      onSetStatus: setStatus,
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
      onSetPdfTracingPage: handleSetPdfTracingPage,
    },
    printPreviewModalProps: {
      open: showPrintPreviewModal,
      onClose: () => setShowPrintPreviewModal(false),
      printPaper,
      onSetPrintPaper: setPrintPaper,
      printScalePercent,
      onSetPrintScalePercent: setPrintScalePercent,
      printCalibrationXPercent,
      onSetPrintCalibrationXPercent: setPrintCalibrationXPercent,
      printCalibrationYPercent,
      onSetPrintCalibrationYPercent: setPrintCalibrationYPercent,
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
      printLineThicknessScalePercent,
      onSetPrintLineThicknessScalePercent: setPrintLineThicknessScalePercent,
      printShowIgnoredLineTypes,
      onSetPrintShowIgnoredLineTypes: setPrintShowIgnoredLineTypes,
      printPlan,
      showPrintAreas,
      onTogglePrintAreas: () => setShowPrintAreas((previous) => !previous),
      onFitView: handleFitView,
      onOpenPrintTiles: handleOpenPrintTiles,
    },
  }
}
