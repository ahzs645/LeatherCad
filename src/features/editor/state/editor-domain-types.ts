import type {
  AvatarSpec,
  Backdrop,
  DimensionLine,
  FoldLine,
  HardwareMarker,
  Layer,
  LeatherImageFill,
  LineType,
  AssemblyConnection,
  PatternPiece,
  PieceInterface,
  PiecePlacement3D,
  ParametricConstraint,
  PieceGrainline,
  PieceLabel,
  PiecePlacementLabel,
  PieceNotch,
  PieceSeamAllowance,
  PrintArea,
  SeamConnection,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  TextureSource,
  ThreePreviewSettings,
  TracingOverlay,
} from '../cad/cad-types'
import type {
  DxfVersion,
  DesktopRibbonTab,
  ExportRoleFilters,
  LegendMode,
  MobileFileAction,
  MobileLayerAction,
  MobileOptionsTab,
  MobileViewMode,
  ResolvedThemeMode,
  SketchWorkspaceMode,
  StitchHoleExportRenderMode,
  ThemeMode,
} from '../editor-types'
import type { ClipboardPayload } from '../ops/shape-selection-ops'
import type { DisplayUnit } from '../ops/unit-ops'
import type { PrintOrientation, PrintPaper } from '../preview/print-preview'
import type { SecondaryPreviewMode, WorkbenchRibbonTab, WorkspaceMode } from '../workbench/workbench-types'

export type EditorDocumentState = {
  documentName: string | null
  activeLocalDocumentId: string | null
  lineTypes: LineType[]
  activeLineTypeId: string
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  sketchGroups: SketchGroup[]
  activeSketchGroupId: string | null
  constraints: ParametricConstraint[]
  patternPieces: PatternPiece[]
  pieceInterfaces: PieceInterface[]
  assemblyConnections: AssemblyConnection[]
  pieceGrainlines: PieceGrainline[]
  pieceLabels: PieceLabel[]
  piecePlacementLabels: PiecePlacementLabel[]
  piecePlacements3d: PiecePlacement3D[]
  seamConnections: SeamConnection[]
  seamAllowances: PieceSeamAllowance[]
  pieceNotches: PieceNotch[]
  hardwareMarkers: HardwareMarker[]
  dimensionLines: DimensionLine[]
  printAreas: PrintArea[]
  snapSettings: SnapSettings
  showAnnotations: boolean
  tracingOverlays: TracingOverlay[]
  activeTracingOverlayId: string | null
  backdrops: Backdrop[]
  activeBackdropId: string | null
  projectMemo: string
  stitchAlwaysShapeIds: string[]
  stitchThreadColor: string
  threePreviewSettings: ThreePreviewSettings
  avatars: AvatarSpec[]
  threeTextureSource: TextureSource | null
  threeTextureShapeIds: string[]
  leatherImageFills: LeatherImageFill[]
  activeLeatherImageFillId: string | null
  showCanvasRuler: boolean
  showDimensions: boolean
}

export type EditorUIState = {
  status: string
  showThreePreview: boolean
  sidePanelTab: '3d' | 'layers'
  show3dInMain: boolean
  isMobileLayout: boolean
  mobileViewMode: MobileViewMode
  showMobileMenu: boolean
  mobileOptionsTab: MobileOptionsTab
  showPrecisionModal: boolean
  showProjectMemoModal: boolean
  showNestingModal: boolean
  desktopRibbonTab: DesktopRibbonTab
  workbenchRibbonTab: WorkbenchRibbonTab
  workspaceMode: WorkspaceMode
  secondaryPreviewMode: SecondaryPreviewMode
  mobileLayerAction: MobileLayerAction
  mobileFileAction: MobileFileAction
  displayUnit: DisplayUnit
  gridSpacing: number
  legendMode: LegendMode
  sketchWorkspaceMode: SketchWorkspaceMode
  selectedPresetId: string
  themeMode: ThemeMode
  systemThemeMode: ResolvedThemeMode
  loadedFontUrl: string | null
  constraintSuggestions: import('../ops/auto-constraint-ops').ConstraintSuggestion[]
  showStitchSimulatorModal: boolean
  showBoxStitchHelperModal: boolean
  showBoxStitchModal: boolean
  showMandalaModal: boolean
  showWizardModal: boolean
  showBackdropModal: boolean
  showLetterStampModal: boolean
  showChangeShapeSizeModal: boolean
  showMoveCopyDistanceModal: boolean
  moveCopyDistanceMode: 'move' | 'copy'
  showBezierOffsetLines: boolean
  customRotationPivot: import('../cad/cad-types').Point | null
  customSnapPoint: import('../cad/cad-types').Point | null
  showSpecifyRotationModal: boolean
  showSpecifyScaleModal: boolean
  specifyScaleModalAxis: 'both' | 'vertical' | 'horizontal'
  showFontListModal: boolean
  fontList: string[]
  autoSaveEnabled: boolean
  reverseZoomDirection: boolean
  reverseGridScrollDirection: boolean
  incrementalSelection: boolean
  mentoriWithoutCtrl: boolean
  continuousDistanceMarking: boolean
  reduceOneBlade: boolean
  pinSideBar: boolean
  highlightActiveLayer: boolean
  printIntoMargin: boolean
  notchAngleDeg: number
  notchDepthMm: number
  dimensionLineTypeId: string | null
  lineToolConstraint: 'none' | 'horizontal' | 'vertical' | 'relative-angle'
  relativeAngleStepDeg: number
  /** Heading of the last drawn line (radians). Drives relative-angle snap. */
  lastLineAngleRad: number | null
  arcDrawMode: 'three-point' | 'radius' | 'half-moon'
  arcRadiusMm: number
  arcHalfMoonRatio: number
  tangentCircleMode: boolean
  tangentCircleDispStep: number
  leatherSimEnabled: boolean
  translationMap: Record<string, string>
  showGrid: boolean
  gridBackgroundMode: 'theme' | 'light' | 'dark'
  showLengthAdjustModal: boolean
  showOptionsModal: boolean
  showDimensionInspectorModal: boolean
  leatherSimTextureRotationDeg: number
  exportIncludeText: boolean
  exportIncludeTemplateMetadata: boolean
}

export type EditorSelectionState = {
  selectedShapeIds: string[]
  selectedStitchHoleId: string | null
  selectedHardwareMarkerId: string | null
  clipboardPayload: ClipboardPayload | null
}

export type EditorLayerState = {
  layers: Layer[]
  activeLayerId: string
  frontLayerColor: string
  backLayerColor: string
  layerColorOverrides: Record<string, string>
}

export type EditorPanelState = {
  showLayerColorModal: boolean
  showLineTypePalette: boolean
  showExportModal: boolean
  showExportOptionsModal: boolean
  exportOnlySelectedShapes: boolean
  exportOnlyVisibleLineTypes: boolean
  exportRoleFilters: ExportRoleFilters
  exportForceSolidStrokes: boolean
  exportStitchHoleRenderMode: StitchHoleExportRenderMode
  exportStitchDotRadiusMm: number
  dxfFlipY: boolean
  dxfVersion: DxfVersion
  showTracingModal: boolean
  showPatternToolsModal: boolean
  showAiBuilderModal: boolean
  showHelpModal: boolean
  showTemplateRepositoryModal: boolean
  showLocalProjectsModal: boolean
  printPaper: PrintPaper
  printOrientation: PrintOrientation
  printIntoMargin: boolean
  printTileX: number
  printTileY: number
  printOverlapMm: number
  printMarginMm: number
  printScalePercent: number
  printCalibrationXPercent: number
  printCalibrationYPercent: number
  printSelectedOnly: boolean
  printRulerInside: boolean
  printInColor: boolean
  printStitchAsDots: boolean
  printLineThicknessScalePercent: number
  printShowIgnoredLineTypes: boolean
  showPrintAreas: boolean
  showPrintPreviewModal: boolean
  seamAllowanceInputMm: number
  constraintEdge: import('../cad/cad-types').ConstraintEdge
  constraintOffsetMm: number
  constraintAxis: import('../cad/cad-types').ConstraintAxis
  hardwarePreset: import('../cad/cad-types').HardwareKind
  customHardwareDiameterMm: number
  customHardwareSpacingMm: number
  dimensionDefaults: DimensionDefaults
  forceFitLastPrick: boolean
  autoHideSidebar: boolean
  loadDemoOnStartup: boolean
  printRulerAnchorTileIndex: number | null
}

export type DimensionDefaults = {
  fontSizeMm: number
  precision: number
  arrowOnly: boolean
  singleLine: boolean
  textInside: boolean
  textReverse: boolean
}

export type EditorToolState = {
  tool: import('../cad/cad-types').Tool
  draftPoints: import('../cad/cad-types').Point[]
  cursorPoint: import('../cad/cad-types').Point | null
  snapIndicator: { point: import('../cad/cad-types').Point; reason: string } | null
  textDraftValue: string
  textFontFamily: string
  textFontSizeMm: number
  textTransformMode: import('../cad/cad-types').TextTransformMode
  textRadiusMm: number
  textSweepDeg: number
  stitchHoleDefaults: import('../cad/cad-types').StitchHoleDefaults
  stitchPitchMm: number
  stitchVariablePitchStartMm: number
  stitchVariablePitchEndMm: number
  stitchAutoPitchSettings: import('../editor-types').StitchAutoPitchSettings
  showStitchSequenceLabels: boolean
}

export type EditorWorkbenchState = {
  workspaceMode: WorkspaceMode
  secondaryPreviewMode: SecondaryPreviewMode
  workbenchRibbonTab: WorkbenchRibbonTab
}
