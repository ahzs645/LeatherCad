import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import type {
  HardwareMarker,
  Layer,
  LeatherImageFill,
  LineType,
  LineTypeRole,
  LineTypeStyle,
  PatternPiece,
  PieceGrainline,
  PieceLabel,
  PieceNotch,
  PiecePlacementLabel,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
  SnapSettings,
  StitchHole,
} from '../cad/cad-types'
import type { DisplayUnit } from '../ops/unit-ops'
import type { SketchWorkspaceMode, ThemeMode } from '../editor-types'
import type { PieceInspectorContentProps } from '../components/PieceInspectorContent'
import type { DocumentInspectorPanelProps } from '../workbench/DocumentInspectorPanel'
import type { SelectionInspectorPanelProps } from '../workbench/SelectionInspectorPanel'

type BuildSelectionInspectorPropsInput = {
  context: SelectionInspectorPanelProps['context']
  selectedShapeCount: number
  selectedEditableShape: Shape | null
  selectedStitchHole: StitchHole | null
  selectedHardwareMarker: HardwareMarker | null
  shapeCount: number
  layerCount: number
  handleAlignSelection: (axis: 'x' | 'y' | 'both') => void
  handleAlignSelectionToGrid: () => void
  handleCreateOffsetGeometryFromSelection: () => void
  handleConvertSelectionToPaintedPart: () => void
  handleOpenBoxStitchHelperModal: () => void
  handleBevelSelectedCorner: () => void
  handleRoundSelectedCorner: () => void
  handleAddEdgeConstraintFromSelection: () => void
  handleAddAlignConstraintsFromSelection: () => void
  handleApplyConstraints: () => void
  handleCreatePatternPieceFromSelection: () => void
  openSelectedPatternPieceInspector: () => void
  canOpenPieceTab: boolean
  handleApplySeamAllowanceToSelection: () => void
  handleClearSeamAllowanceOnSelection: () => void
  handleApplyTextDefaultsToSelection: () => void
  handleExtractSelectedBoxStitchSources: () => void
  handleClearSelectedBoxStitchSources: () => void
  handleUpdateSelectedShapePoint: SelectionInspectorPanelProps['onUpdateSelectedShapePoint']
  handleUpdateSelectedStitchHole: (patch: Partial<StitchHole>) => void
  handleMarkSelectedStitchHoleAsEnd: () => void
  handleClearSelectedStitchHoleEnd: () => void
  handleUpdateSelectedHardwareMarker: (patch: Partial<HardwareMarker>) => void
  handleDeleteSelectedHardwareMarker: () => void
}

export function buildSelectionInspectorProps({
  context,
  selectedShapeCount,
  selectedEditableShape,
  selectedStitchHole,
  selectedHardwareMarker,
  shapeCount,
  layerCount,
  handleAlignSelection,
  handleAlignSelectionToGrid,
  handleCreateOffsetGeometryFromSelection,
  handleConvertSelectionToPaintedPart,
  handleOpenBoxStitchHelperModal,
  handleBevelSelectedCorner,
  handleRoundSelectedCorner,
  handleAddEdgeConstraintFromSelection,
  handleAddAlignConstraintsFromSelection,
  handleApplyConstraints,
  handleCreatePatternPieceFromSelection,
  openSelectedPatternPieceInspector,
  canOpenPieceTab,
  handleApplySeamAllowanceToSelection,
  handleClearSeamAllowanceOnSelection,
  handleApplyTextDefaultsToSelection,
  handleExtractSelectedBoxStitchSources,
  handleClearSelectedBoxStitchSources,
  handleUpdateSelectedShapePoint,
  handleUpdateSelectedStitchHole,
  handleMarkSelectedStitchHoleAsEnd,
  handleClearSelectedStitchHoleEnd,
  handleUpdateSelectedHardwareMarker,
  handleDeleteSelectedHardwareMarker,
}: BuildSelectionInspectorPropsInput): SelectionInspectorPanelProps {
  return {
    context,
    selectedShapeCount,
    selectedEditableShape,
    selectedStitchHole,
    selectedHardwareMarker,
    shapeCount,
    layerCount,
    onAlignX: () => handleAlignSelection('x'),
    onAlignY: () => handleAlignSelection('y'),
    onAlignBoth: () => handleAlignSelection('both'),
    onAlignToGrid: handleAlignSelectionToGrid,
    onCreateOffset: handleCreateOffsetGeometryFromSelection,
    onConvertSelectionToPaintedPart: handleConvertSelectionToPaintedPart,
    onCreateBoxStitch: handleOpenBoxStitchHelperModal,
    onBevelCorner: handleBevelSelectedCorner,
    onRoundCorner: handleRoundSelectedCorner,
    onAddEdgeConstraint: handleAddEdgeConstraintFromSelection,
    onAddAlignConstraints: handleAddAlignConstraintsFromSelection,
    onApplyConstraints: handleApplyConstraints,
    onCreatePatternPiece: handleCreatePatternPieceFromSelection,
    onOpenPieceTab: openSelectedPatternPieceInspector,
    canOpenPieceTab,
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
}

type BuildPieceInspectorContentPropsInput = {
  selectedPatternPiece: PatternPiece | null
  selectedPieceGrainline: PieceGrainline | null
  selectedPieceLabel: PieceLabel | null
  selectedPatternLabel: PieceLabel | null
  selectedPieceSeamAllowance: PieceSeamAllowance | null
  selectedPieceSeamConnections: PieceInspectorContentProps['seamConnections']
  selectedPieceNotches: PieceNotch[]
  selectedPiecePlacementLabels: PiecePlacementLabel[]
  selectedPatternPieceEdgeCount: number
  selectedPieceAvailableInternalShapes: Shape[]
  selectedPieceInternalShapeIdSet: Set<string>
  handleUpdateSelectedPatternPiece: (patch: Partial<PatternPiece>) => void
  handleToggleSelectedPieceInternalShape: (shapeId: string, included: boolean) => void
  handleUpdateSelectedPieceGrainline: (patch: Partial<PieceGrainline>) => void
  updateSelectedLabel: (kind: 'piece' | 'pattern', patch: Partial<PieceLabel>) => void
  handleUpdateSelectedPieceSeamAllowance: (patch: Partial<PieceSeamAllowance>) => void
  handleUpdateSelectedPieceSeamConnection: (connectionId: string, patch: Partial<SeamConnection>) => void
  setSeamConnections: Dispatch<SetStateAction<SeamConnection[]>>
  handleUpdateSelectedPieceNotch: (notchId: string, patch: Partial<PieceNotch>) => void
  setPieceNotches: Dispatch<SetStateAction<PieceNotch[]>>
  handleAddSelectedPiecePlacementLabel: () => void
  handleUpdateSelectedPiecePlacementLabel: (labelId: string, patch: Partial<PiecePlacementLabel>) => void
  handleDeleteSelectedPiecePlacementLabel: (labelId: string) => void
}

export function buildPieceInspectorContentProps({
  selectedPatternPiece,
  selectedPieceGrainline,
  selectedPieceLabel,
  selectedPatternLabel,
  selectedPieceSeamAllowance,
  selectedPieceSeamConnections,
  selectedPieceNotches,
  selectedPiecePlacementLabels,
  selectedPatternPieceEdgeCount,
  selectedPieceAvailableInternalShapes,
  selectedPieceInternalShapeIdSet,
  handleUpdateSelectedPatternPiece,
  handleToggleSelectedPieceInternalShape,
  handleUpdateSelectedPieceGrainline,
  updateSelectedLabel,
  handleUpdateSelectedPieceSeamAllowance,
  handleUpdateSelectedPieceSeamConnection,
  setSeamConnections,
  handleUpdateSelectedPieceNotch,
  setPieceNotches,
  handleAddSelectedPiecePlacementLabel,
  handleUpdateSelectedPiecePlacementLabel,
  handleDeleteSelectedPiecePlacementLabel,
}: BuildPieceInspectorContentPropsInput): PieceInspectorContentProps {
  return {
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
    onUpdatePieceLabel: (patch: Partial<PieceLabel>) => updateSelectedLabel('piece', patch),
    onUpdatePatternLabel: (patch: Partial<PieceLabel>) => updateSelectedLabel('pattern', patch),
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
}

type BuildDocumentInspectorPropsInput = {
  displayUnit: DisplayUnit
  setDisplayUnit: (unit: DisplayUnit) => void
  gridSpacing: number
  setGridSpacing: (spacing: number) => void
  showCanvasRuler: boolean
  setShowCanvasRuler: Dispatch<SetStateAction<boolean>>
  showDimensions: boolean
  setShowDimensions: Dispatch<SetStateAction<boolean>>
  showAnnotations: boolean
  setShowAnnotations: Dispatch<SetStateAction<boolean>>
  sketchWorkspaceMode: SketchWorkspaceMode
  setSketchWorkspaceMode: (mode: SketchWorkspaceMode) => void
  themeMode: ThemeMode
  handleSetThemeMode: (mode: ThemeMode) => void
  snapSettings: SnapSettings
  setSnapSettings: Dispatch<SetStateAction<SnapSettings>>
  projectMemo: string
  setProjectMemo: (value: string) => void
  activeLineType: LineType | null
  lineTypes: LineType[]
  shapeCountsByLineType: Record<string, number>
  selectedShapeCount: number
  handleAssignSelectedToActiveLineType: () => void
  handleClearShapeSelection: () => void
  handleIsolateActiveLineType: () => void
  handleSelectShapesByActiveLineType: () => void
  setActiveLineTypeId: (lineTypeId: string) => void
  handleShowAllLineTypes: () => void
  setLineTypes: Dispatch<SetStateAction<LineType[]>>
  handleUpdateActiveLineTypeColor: (color: string) => void
  handleUpdateActiveLineTypeIgnoreInPrint: (ignoreInPrint: boolean) => void
  handleUpdateActiveLineTypeRole: (role: LineTypeRole) => void
  handleUpdateActiveLineTypeStyle: (style: LineTypeStyle) => void
  handleUpdateActiveLineTypeStrokeWidthMm: (strokeWidthMm: number) => void
  leatherImageFills: LeatherImageFill[]
  activeLeatherImageFill: LeatherImageFill | null
  setActiveLeatherImageFillId: (fillId: string | null) => void
  handleImportLeatherImageFill: (event: ChangeEvent<HTMLInputElement>) => void
  handleUpdateLeatherImageFill: (fillId: string, patch: Partial<LeatherImageFill>) => void
  handleDeleteActiveLeatherImageFill: () => void
  handleAssignSelectedToActiveLeatherImageFill: () => void
  handleClearSelectedFromActiveLeatherImageFill: () => void
  layers: Layer[]
  activeLayer: Layer | null
  handleShowAllLayers: () => void
  handleHideOtherLayers: () => void
  handleMergeActiveLayerIntoBelow: () => void
  handleFlattenAllLayers: () => void
  layerColorsById: Record<string, string>
  layerColorOverrides: Record<string, string>
  frontLayerColor: string
  backLayerColor: string
  setFrontLayerColor: (color: string) => void
  setBackLayerColor: (color: string) => void
  handleSetLayerColorOverride: (layerId: string, color: string) => void
  handleClearLayerColorOverride: (layerId: string) => void
  handleResetLayerColors: () => void
  onRunCadCommand: (command: string) => string
}

export function buildDocumentInspectorProps({
  displayUnit,
  setDisplayUnit,
  gridSpacing,
  setGridSpacing,
  showCanvasRuler,
  setShowCanvasRuler,
  showDimensions,
  setShowDimensions,
  showAnnotations,
  setShowAnnotations,
  sketchWorkspaceMode,
  setSketchWorkspaceMode,
  themeMode,
  handleSetThemeMode,
  snapSettings,
  setSnapSettings,
  projectMemo,
  setProjectMemo,
  activeLineType,
  lineTypes,
  shapeCountsByLineType,
  selectedShapeCount,
  handleAssignSelectedToActiveLineType,
  handleClearShapeSelection,
  handleIsolateActiveLineType,
  handleSelectShapesByActiveLineType,
  setActiveLineTypeId,
  handleShowAllLineTypes,
  setLineTypes,
  handleUpdateActiveLineTypeColor,
  handleUpdateActiveLineTypeIgnoreInPrint,
  handleUpdateActiveLineTypeRole,
  handleUpdateActiveLineTypeStyle,
  handleUpdateActiveLineTypeStrokeWidthMm,
  leatherImageFills,
  activeLeatherImageFill,
  setActiveLeatherImageFillId,
  handleImportLeatherImageFill,
  handleUpdateLeatherImageFill,
  handleDeleteActiveLeatherImageFill,
  handleAssignSelectedToActiveLeatherImageFill,
  handleClearSelectedFromActiveLeatherImageFill,
  layers,
  activeLayer,
  handleShowAllLayers,
  handleHideOtherLayers,
  handleMergeActiveLayerIntoBelow,
  handleFlattenAllLayers,
  layerColorsById,
  layerColorOverrides,
  frontLayerColor,
  backLayerColor,
  setFrontLayerColor,
  setBackLayerColor,
  handleSetLayerColorOverride,
  handleClearLayerColorOverride,
  handleResetLayerColors,
  onRunCadCommand,
}: BuildDocumentInspectorPropsInput): DocumentInspectorPanelProps {
  return {
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
    onUpdateSnapSettings: (patch: Partial<SnapSettings>) =>
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
    onUpdateActiveLineTypeIgnoreInPrint: handleUpdateActiveLineTypeIgnoreInPrint,
    onUpdateActiveLineTypeRole: handleUpdateActiveLineTypeRole,
    onUpdateActiveLineTypeStyle: handleUpdateActiveLineTypeStyle,
    onUpdateActiveLineTypeStrokeWidthMm: handleUpdateActiveLineTypeStrokeWidthMm,
    leatherImageFills,
    activeLeatherImageFill,
    onSetActiveLeatherImageFillId: setActiveLeatherImageFillId,
    onImportLeatherImageFill: handleImportLeatherImageFill,
    onUpdateLeatherImageFill: handleUpdateLeatherImageFill,
    onDeleteActiveLeatherImageFill: handleDeleteActiveLeatherImageFill,
    onAssignSelectedToActiveLeatherImageFill: handleAssignSelectedToActiveLeatherImageFill,
    onClearSelectedFromActiveLeatherImageFill: handleClearSelectedFromActiveLeatherImageFill,
    layers,
    activeLayer,
    onShowAllLayers: handleShowAllLayers,
    onHideOtherLayers: handleHideOtherLayers,
    onMergeActiveLayerIntoBelow: handleMergeActiveLayerIntoBelow,
    onFlattenAllLayers: handleFlattenAllLayers,
    layerColorsById,
    layerColorOverrides,
    frontLayerColor,
    backLayerColor,
    onFrontLayerColorChange: setFrontLayerColor,
    onBackLayerColorChange: setBackLayerColor,
    onSetLayerColorOverride: handleSetLayerColorOverride,
    onClearLayerColorOverride: handleClearLayerColorOverride,
    onResetLayerColors: handleResetLayerColors,
    onRunCadCommand,
  }
}
