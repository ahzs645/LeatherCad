import type { Layer, LineType, PatternPiece, SeamConnection, StitchHoleDefaults, Tool } from '../../cad/cad-types'
import type { DisplayUnit } from '../../ops/unit-ops'
import type {
  DesktopRibbonTab,
  MobileFileAction,
  MobileLayerAction,
  MobileOptionsTab,
  MobileViewMode,
  SketchWorkspaceMode,
  StitchAutoPitchSettings,
  ThemeMode,
} from '../../editor-types'

export type EditorTopbarProps = {
  topbarClassName: string
  isMobileLayout: boolean
  desktopRibbonTab: DesktopRibbonTab
  onDesktopRibbonTabChange: (tab: DesktopRibbonTab) => void
  selectedShapeCount: number
  selectedStitchHoleCount: number
  showThreePreview: boolean
  onOpenPrecisionModal: () => void
  onOpenProjectMemoModal: () => void
  onOpenHelpModal: () => void
  showToolSection: boolean
  tool: Tool
  onSetActiveTool: (tool: Tool) => void
  mobileViewMode: MobileViewMode
  onSetMobileViewMode: (mode: MobileViewMode) => void
  showMobileMenu: boolean
  onToggleMobileMenu: () => void
  mobileOptionsTab: MobileOptionsTab
  onSetMobileOptionsTab: (tab: MobileOptionsTab) => void
  /**
   * Pieces and seams on the compact shell. Without these the phone had the Seam
   * tool in its tool list and no way to make a piece for it to connect, nor any
   * way to see what it had connected.
   */
  patternPieces: PatternPiece[]
  seamConnections: SeamConnection[]
  selectedPatternPieceId: string | null
  selectedSeamId: string | null
  canCreatePatternPiece: boolean
  onCreatePatternPieceFromSelection: () => void
  onSelectPatternPiece: (pieceId: string) => void
  onOpenPieceInspector: () => void
  onSelectSeam: (seamId: string) => void
  onDeleteSeamConnection: (seamId: string) => void
  onLoadPreset: () => void
  onSetThemeMode: (mode: ThemeMode) => void
  themeMode: ThemeMode
  showZoomSection: boolean
  displayUnit: DisplayUnit
  onSetDisplayUnit: (unit: DisplayUnit) => void
  showCanvasRuler: boolean
  onToggleCanvasRuler: () => void
  showDimensions: boolean
  onToggleDimensions: () => void
  gridBackgroundMode: 'theme' | 'light' | 'dark'
  onSetGridBackgroundLight: () => void
  onSetGridBackgroundDark: () => void
  gridSpacing: number
  onSetGridSpacing: (spacing: number) => void
  sketchWorkspaceMode: SketchWorkspaceMode
  onSetSketchWorkspaceMode: (mode: SketchWorkspaceMode) => void
  showEditSection: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onCopySelection: () => void
  onCutSelection: () => void
  onPasteClipboard: () => void
  canPaste: boolean
  onSelectAllShapes: () => void
  onDuplicateSelection: () => void
  onDeleteSelection: () => void
  onGroupSelection: () => void
  onUngroupSelection: () => void
  onMoveSelectionByDistance: () => void
  onCopySelectionByDistance: () => void
  onRotateSelectionCw1: () => void
  onRotateSelectionCw5: () => void
  onRotateSelectionCcw1: () => void
  onRotateSelectionCcw5: () => void
  onScaleSelectionUp1: () => void
  onScaleSelectionDown1: () => void
  onScaleSelectionUp5: () => void
  onScaleSelectionDown5: () => void
  onAlignSelectionLeft: () => void
  onAlignSelectionRight: () => void
  onAlignSelectionTop: () => void
  onAlignSelectionBottom: () => void
  onAlignSelectionMiddleH: () => void
  onAlignSelectionMiddleV: () => void
  onFlipSelectionHorizontally: () => void
  onFlipSelectionVertically: () => void
  onReverseSelectedPaths: () => void
  onSpecifyRotationAngle: () => void
  onSpecifyScaleRatio: () => void
  onSpecifyScaleRatioVertically: () => void
  onSpecifyScaleRatioHorizontally: () => void
  onSetAsRotationCenter: () => void
  onClearRotationCenter: () => void
  onSetAsSnapPoint: () => void
  onClearSnapPoint: () => void
  onMakeSelectedLineHorizontal: () => void
  onMakeSelectedLineVertical: () => void
  hasCustomRotationPivot: boolean
  hasCustomSnapPoint: boolean
  onLineSymmetry: () => void
  onCenterLineBetweenSelection: () => void
  onEditSelectedLineAngle: () => void
  onDeleteDuplicates: () => void
  onSplitIntoN: () => void
  onDrawBoundaryAroundSelection: () => void
  onFilletSelectedCorner: () => void
  onDistanceMarkSelectedPath: () => void
  onConvertSelectionToPath: () => void
  onConvertACopyToPath: () => void
  onNotchSelectedShape: () => void
  onAddBackdrop: () => void
  onOpenFontListModal: () => void
  onCloseProject: () => void
  onOpenSecretFeatures: () => void
  onOpenOptionsModal: () => void
  onOpenLengthAdjustModal: () => void
  onImportTranslation: () => void
  onStampSimulator: () => void
  onClearAll: () => void
  onSelectConnectedChain: () => void
  onActivateLayerOfSelectedShape: () => void
  onDuplicateSelectionOnLayerBelow: () => void
  onMoveSelectionToLayerBelow: () => void
  onMoveSelectionToAnotherLayer: () => void
  onHighlightShapesOnCurrentLayer: () => void
  onToggleLayerIgnored: () => void
  onToggleIndependentLayer: () => void
  onEnableStitchOnSelection: () => void
  onDisableStitchOnSelection: () => void
  onMoveSelectionBackward: () => void
  onMoveSelectionForward: () => void
  onSendSelectionToBack: () => void
  onBringSelectionToFront: () => void
  showLineTypeSection: boolean
  activeLineType: LineType | null
  lineTypes: LineType[]
  onSetActiveLineTypeId: (lineTypeId: string) => void
  onToggleActiveLineTypeVisibility: () => void
  onOpenLineTypePalette: () => void
  showStitchSection: boolean
  stitchHoleDefaults: StitchHoleDefaults
  onUpdateStitchHoleDefaults: (patch: Partial<StitchHoleDefaults>) => void
  stitchPitchMm: number
  onSetStitchPitchMm: (value: number) => void
  stitchVariablePitchStartMm: number
  stitchVariablePitchEndMm: number
  onSetStitchVariablePitchStartMm: (value: number) => void
  onSetStitchVariablePitchEndMm: (value: number) => void
  stitchAutoPitchSettings: StitchAutoPitchSettings
  onUpdateStitchAutoPitchSettings: (patch: Partial<StitchAutoPitchSettings>) => void
  onAutoPlacePreferredPitchStitchHoles: () => void
  onAutoPlaceFixedPitchStitchHoles: () => void
  onAutoPlaceVariablePitchStitchHoles: () => void
  onAutoPlaceEvenlySpacedStitchHoles: () => void
  onResequenceSelectedStitchHoles: () => void
  onReverseSelectedStitchHoles: () => void
  onSelectNextStitchHole: () => void
  onFixStitchHoleOrderFromSelected: () => void
  onFixReverseStitchHoleOrderFromSelected: () => void
  showStitchSequenceLabels: boolean
  onToggleStitchSequenceLabels: () => void
  onCountStitchHolesOnSelectedShapes: () => void
  onDeleteStitchHolesOnSelectedShapes: () => void
  onChangeStitchHoleShapeOnSelectedShapes: (renderShape: import('../../cad/cad-types').StitchHoleRenderShape) => void
  onClearAllStitchHoles: () => void
  selectedHoleCount: number
  stitchHoleCount: number
  hasSelectedStitchHole: boolean
  showLayerSection: boolean
  activeLayer: Layer | null
  layers: Layer[]
  layerStackLevels: Record<string, number>
  onSetActiveLayerId: (layerId: string) => void
  onClearDraft: () => void
  mobileLayerAction: MobileLayerAction
  onSetMobileLayerAction: (action: MobileLayerAction) => void
  onRunMobileLayerAction: () => void
  onAddLayer: () => void
  onRenameActiveLayer: () => void
  onToggleLayerVisibility: () => void
  onToggleLayerLock: () => void
  onMoveLayerUp: () => void
  onMoveLayerDown: () => void
  onDeleteLayer: () => void
  onShowAllLayers: () => void
  onHideOtherLayers: () => void
  onMergeActiveLayerIntoBelow: () => void
  onFlattenAllLayers: () => void
  onOpenLayerColorModal: () => void
  showFileSection: boolean
  mobileFileAction: MobileFileAction
  onSetMobileFileAction: (action: MobileFileAction) => void
  onRunMobileFileAction: () => void
  onSaveJson: () => void
  onOpenLoadJson: () => void
  onOpenImportSvg: () => void
  onExportSvg: () => void
  onExportPdf: () => void
  onExportDxf: () => void
  onExportLaserSvg: () => void
  onOpenInNewTab: () => void
  onOpenExportModal: () => void
  onOpenExportOptionsModal: () => void
  onOpenLocalProjectsModal: () => void
  onOpenPatternToolsModal: () => void
  onOpenTemplateRepositoryModal: () => void
  catalogRepository: import('../../templates/catalog-repository').CatalogRepositoryShop[]
  selectedCatalogShopId: string | null
  onSelectCatalogShop: (shopId: string) => void
  onOpenTracingImport: () => void
  onOpenPatternPdfImport: () => void
  onOpenTracingModal: () => void
  hasTracingOverlays: boolean
  onOpenPrintPreviewModal: () => void
  showPrintAreas: boolean
  onTogglePrintAreas: () => void
  onToggleThreePreview: () => void
  onResetDocument: () => void
}
