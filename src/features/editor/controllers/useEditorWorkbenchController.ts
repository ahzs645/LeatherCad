import { useEffect, useMemo } from 'react'
import type {
  AvatarSpec,
  HardwareMarker,
  Layer,
  PatternPiece,
  PieceLabel,
  PieceNotch,
  PiecePlacementLabel,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  TextureSource,
  TracingOverlay,
} from '../cad/cad-types'
import {
  useDocumentBrowserModel,
  useInspectorModel,
  useQuickActions,
  useRibbonModel,
} from '../workbench/workbench-hooks'
import type { DocumentBrowserNode, WorkbenchRibbonTab, WorkspaceMode } from '../workbench/workbench-types'
import { resolveSeamSpans } from '../assembly/seam-spans'
import {
  useEditorSelectionActions,
  useEditorSelectionSelector,
} from '../state/providers/EditorSelectionStateProvider'

type UseEditorWorkbenchControllerParams = {
  documentName: string | null
  patternPieces: PatternPiece[]
  patternPiecesById: Record<string, PatternPiece | undefined>
  pieceLabels: PieceLabel[]
  seamAllowances: PieceSeamAllowance[]
  pieceNotches: PieceNotch[]
  piecePlacementLabels: PiecePlacementLabel[]
  seamConnections: SeamConnection[]
  layers: Layer[]
  activeLayerId: string
  sketchGroups: SketchGroup[]
  activeSketchGroupId: string | null
  tracingOverlays: TracingOverlay[]
  activeTracingOverlayId: string | null
  avatars: AvatarSpec[]
  threeTextureSource: TextureSource | null
  selectedShapes: Shape[]
  selectedPatternPiece: PatternPiece | null
  selectedStitchHole: StitchHole | null
  selectedHardwareMarker: HardwareMarker | null
  selectedShapeCount: number
  selectedShapeIdSet: Set<string>
  snapSettings: SnapSettings
  setSnapSettings: React.Dispatch<React.SetStateAction<SnapSettings>>
  canUndo: boolean
  canRedo: boolean
  workbenchRibbonTab: WorkbenchRibbonTab
  setActiveInspectorTab: (tab: 'inspect' | 'piece' | 'preview3d' | 'document') => void
  isMobileLayout: boolean
  workspaceMode: WorkspaceMode
  handleSaveJson: () => void
  handleUndo: () => void
  handleRedo: () => void
  setShowHelpModal: React.Dispatch<React.SetStateAction<boolean>>
  handleFitView: () => void
  handleResetView: () => void
  setShowCanvasRuler: React.Dispatch<React.SetStateAction<boolean>>
  setShowDimensions: React.Dispatch<React.SetStateAction<boolean>>
  handleLoadPreset: (presetId?: string) => void | Promise<void>
  setShowAnnotations: React.Dispatch<React.SetStateAction<boolean>>
  handleCopySelection: () => void
  handlePasteClipboard: () => void | Promise<void>
  handleDeleteSelection: () => void
  handleMoveSelectionByDistance: () => void
  handleRotateSelection: (degrees: number) => void
  handleScaleSelection: (factor: number) => void
  handleOpenSpecifyRotationModal: () => void
  handleOpenSpecifyScaleModal: (axis: 'both' | 'vertical' | 'horizontal') => void
  handleSetAsRotationCenter: () => void
  handleClearRotationCenter: () => void
  handleSetAsSnapPoint: () => void
  handleClearSnapPoint: () => void
  handleCreatePatternPieceFromSelection: () => void
  openSelectedPatternPieceInspector: () => void
  handleApplySeamAllowanceToSelection: () => void
  setShowNestingModal: React.Dispatch<React.SetStateAction<boolean>>
  handleAutoPlaceFixedPitchStitchHoles: () => void
  handleAutoPlaceVariablePitchStitchHoles: () => void
  handleCountStitchHolesOnSelectedShapes: () => void
  handleResequenceSelectedStitchHoles: (keepSelection: boolean) => void
  handleSelectNextStitchHole: () => void
  handleClearAllStitchHoles: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  svgInputRef: React.RefObject<HTMLInputElement | null>
  handleExportSvg: () => void
  handleExportPdf: () => void
  handleExportDxf: () => void
  setShowExportModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowExportOptionsModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowPrintPreviewModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowOptionsModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowLocalProjectsModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowTemplateRepositoryModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowTracingModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowAiBuilderModal: React.Dispatch<React.SetStateAction<boolean>>
  handleConvertArcToBezier: () => void
  handleExtendOrTrimLines: () => void
  handleMirrorShapes: () => void
  handleLineSymmetry: () => void
  handleMakeBezierCpSymmetric: () => void
  handleToggleBezierOffsetLines: () => void
  setShowChangeShapeSizeModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowStitchSimulatorModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowBoxStitchHelperModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowBoxStitchModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowWizardModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowMandalaModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowLetterStampModal: React.Dispatch<React.SetStateAction<boolean>>
  ensurePatternPieceSupportRecords: (piece: PatternPiece) => void
  setSelectedShapeIds: React.Dispatch<React.SetStateAction<string[]>>
  setActiveLayerId: React.Dispatch<React.SetStateAction<string>>
  clearDraft: () => void
  setActiveSketchGroupId: React.Dispatch<React.SetStateAction<string | null>>
  setActiveTracingOverlayId: React.Dispatch<React.SetStateAction<string | null>>
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>
  setTracingOverlays: React.Dispatch<React.SetStateAction<TracingOverlay[]>>
  setSecondaryPreviewMode: React.Dispatch<React.SetStateAction<'hidden' | '2d-peek' | '3d-peek'>>
  setWorkspaceMode: React.Dispatch<React.SetStateAction<WorkspaceMode>>
  runPrecisionCommand: (command: string) => string
}

export function useEditorWorkbenchController({
  documentName,
  patternPieces,
  patternPiecesById,
  pieceLabels,
  seamAllowances,
  pieceNotches,
  piecePlacementLabels,
  seamConnections,
  layers,
  activeLayerId,
  sketchGroups,
  activeSketchGroupId,
  tracingOverlays,
  activeTracingOverlayId,
  avatars,
  threeTextureSource,
  selectedShapes,
  selectedPatternPiece,
  selectedStitchHole,
  selectedHardwareMarker,
  selectedShapeCount,
  selectedShapeIdSet,
  snapSettings,
  setSnapSettings,
  canUndo,
  canRedo,
  workbenchRibbonTab,
  setActiveInspectorTab,
  isMobileLayout,
  workspaceMode,
  handleSaveJson,
  handleUndo,
  handleRedo,
  setShowHelpModal,
  handleFitView,
  handleResetView,
  setShowCanvasRuler,
  setShowDimensions,
  handleLoadPreset,
  setShowAnnotations,
  handleCopySelection,
  handlePasteClipboard,
  handleDeleteSelection,
  handleMoveSelectionByDistance,
  handleRotateSelection,
  handleScaleSelection,
  handleOpenSpecifyRotationModal,
  handleOpenSpecifyScaleModal,
  handleSetAsRotationCenter,
  handleClearRotationCenter,
  handleSetAsSnapPoint,
  handleClearSnapPoint,
  handleCreatePatternPieceFromSelection,
  openSelectedPatternPieceInspector,
  handleApplySeamAllowanceToSelection,
  setShowNestingModal,
  handleAutoPlaceFixedPitchStitchHoles,
  handleAutoPlaceVariablePitchStitchHoles,
  handleCountStitchHolesOnSelectedShapes,
  handleResequenceSelectedStitchHoles,
  handleSelectNextStitchHole,
  handleClearAllStitchHoles,
  fileInputRef,
  svgInputRef,
  handleExportSvg,
  handleExportPdf,
  handleExportDxf,
  setShowExportModal,
  setShowExportOptionsModal,
  setShowPrintPreviewModal,
  setShowOptionsModal,
  setShowLocalProjectsModal,
  setShowTemplateRepositoryModal,
  setShowTracingModal,
  setShowAiBuilderModal,
  handleConvertArcToBezier,
  handleExtendOrTrimLines,
  handleMirrorShapes,
  handleLineSymmetry,
  handleMakeBezierCpSymmetric,
  handleToggleBezierOffsetLines,
  setShowChangeShapeSizeModal,
  setShowStitchSimulatorModal,
  setShowBoxStitchHelperModal,
  setShowBoxStitchModal,
  setShowWizardModal,
  setShowMandalaModal,
  setShowLetterStampModal,
  ensurePatternPieceSupportRecords,
  setSelectedShapeIds,
  setActiveLayerId,
  clearDraft,
  setActiveSketchGroupId,
  setActiveTracingOverlayId,
  setLayers,
  setTracingOverlays,
  setSecondaryPreviewMode,
  setWorkspaceMode,
  runPrecisionCommand,
}: UseEditorWorkbenchControllerParams) {
  const selectedPieceIds = useMemo(
    () =>
      patternPieces
        .filter((piece) => selectedShapeIdSet.has(piece.boundaryShapeId))
        .map((piece) => piece.id),
    [patternPieces, selectedShapeIdSet],
  )

  const selectionContext = useInspectorModel({
    selectedShapes,
    selectedPatternPiece,
    selectedStitchHole,
    selectedHardwareMarker,
  })

  // Read seam selection from the provider rather than threading it through the
  // param chain: it is shared with the canvas and the 3D preview, not owned here.
  const selectedSeamId = useEditorSelectionSelector((state) => state.selectedSeamId)
  const { setSelectedSeamId } = useEditorSelectionActions()

  const browserNodes = useDocumentBrowserModel({
    patternPieces,
    pieceLabels,
    seamAllowances,
    pieceNotches,
    piecePlacementLabels,
    seamConnections,
    selectedPieceIds,
    selectedSeamId,
    layers,
    activeLayerId,
    sketchGroups,
    activeSketchGroupId,
    tracingOverlays,
    activeTracingOverlayId,
    avatars,
    threeTextureSource,
  })

  const quickActions = useQuickActions({ canUndo, canRedo })
  const ribbonGroups = useRibbonModel({
    activeTab: workbenchRibbonTab,
    canUndo,
    canRedo,
    canPaste: true,
    selectedShapeCount,
    selectedPatternPiece: selectedPatternPiece !== null,
    selectedStitchHole: selectedStitchHole !== null,
    gridSnapEnabled: snapSettings.enabled && snapSettings.grid,
    objectSnapEnabled: snapSettings.enabled && (snapSettings.endpoints || snapSettings.midpoints || snapSettings.hardware),
    guideSnapEnabled: snapSettings.enabled && snapSettings.guides,
  })

  const docLabel = documentName ?? patternPieces[0]?.name ?? 'Current Draft'
  const selectionText =
    selectedShapeCount > 0
      ? `${selectedShapeCount} shape${selectedShapeCount === 1 ? '' : 's'}`
      : selectedStitchHole
        ? `Stitch hole ${selectedStitchHole.sequence}`
        : selectedHardwareMarker
          ? selectedHardwareMarker.label || 'Hardware marker'
          : 'No selection'

  useEffect(() => {
    if (!isMobileLayout && workspaceMode === '3d') {
      setActiveInspectorTab('preview3d')
    }
  }, [isMobileLayout, workspaceMode, setActiveInspectorTab])

  const handleWorkbenchQuickAction = (actionId: string) => {
    switch (actionId) {
      case 'save-json':
        handleSaveJson()
        break
      case 'undo':
        handleUndo()
        break
      case 'redo':
        handleRedo()
        break
      case 'help':
        setShowHelpModal(true)
        break
      case 'options':
        setShowOptionsModal(true)
        break
      default:
        break
    }
  }

  const handleWorkbenchRibbonCommand = (commandId: string) => {
    switch (commandId) {
      case 'fit-view':
        handleFitView()
        break
      case 'reset-view':
        handleResetView()
        break
      case 'toggle-ruler':
        setShowCanvasRuler((previous) => !previous)
        break
      case 'toggle-dimensions':
        setShowDimensions((previous) => !previous)
        break
      case 'load-preset':
        void handleLoadPreset()
        break
      case 'load-compact-clasp-preset':
        void handleLoadPreset('compact-clasp-wallet')
        break
      case 'toggle-annotations':
        setShowAnnotations((previous) => !previous)
        break
      case 'toggle-grid-snap':
        setSnapSettings((previous) => ({ ...previous, enabled: true, grid: !previous.grid }))
        break
      case 'toggle-object-snap':
        setSnapSettings((previous) => {
          const nextEnabled = !(previous.endpoints || previous.midpoints || previous.hardware)
          return {
            ...previous,
            enabled: true,
            endpoints: nextEnabled,
            midpoints: nextEnabled,
            hardware: nextEnabled,
          }
        })
        break
      case 'toggle-guide-snap':
        setSnapSettings((previous) => ({ ...previous, enabled: true, guides: !previous.guides }))
        break
      case 'undo':
        handleUndo()
        break
      case 'redo':
        handleRedo()
        break
      case 'copy':
        handleCopySelection()
        break
      case 'paste':
        void handlePasteClipboard()
        break
      case 'delete':
        handleDeleteSelection()
        break
      case 'move-distance':
        handleMoveSelectionByDistance()
        break
      case 'rotate-ccw-5':
        handleRotateSelection(-5)
        break
      case 'rotate-ccw-1':
        handleRotateSelection(-1)
        break
      case 'rotate-cw-1':
        handleRotateSelection(1)
        break
      case 'rotate-cw-5':
      case 'rotate':
      case 'rotate-5':
        handleRotateSelection(5)
        break
      case 'specify-rotation':
        handleOpenSpecifyRotationModal()
        break
      case 'scale-down-5':
        handleScaleSelection(0.95)
        break
      case 'scale-down-1':
        handleScaleSelection(0.99)
        break
      case 'scale-up-1':
        handleScaleSelection(1.01)
        break
      case 'scale-up-5':
      case 'scale-up':
        handleScaleSelection(1.05)
        break
      case 'specify-scale':
        handleOpenSpecifyScaleModal('both')
        break
      case 'specify-scale-x':
        handleOpenSpecifyScaleModal('horizontal')
        break
      case 'specify-scale-y':
        handleOpenSpecifyScaleModal('vertical')
        break
      case 'set-rotation-pivot':
        handleSetAsRotationCenter()
        break
      case 'clear-rotation-pivot':
        handleClearRotationCenter()
        break
      case 'set-snap-point':
        handleSetAsSnapPoint()
        break
      case 'clear-snap-point':
        handleClearSnapPoint()
        break
      case 'create-piece':
        handleCreatePatternPieceFromSelection()
        break
      case 'open-piece':
      case 'piece-tab':
        openSelectedPatternPieceInspector()
        break
      case 'apply-seam-allowance':
        handleApplySeamAllowanceToSelection()
        break
      case 'open-nesting':
        setShowNestingModal(true)
        break
      case 'place-fixed-stitch':
        handleAutoPlaceFixedPitchStitchHoles()
        break
      case 'place-variable-stitch':
        handleAutoPlaceVariablePitchStitchHoles()
        break
      case 'count-stitches':
        handleCountStitchHolesOnSelectedShapes()
        break
      case 'resequence-stitches':
        handleResequenceSelectedStitchHoles(false)
        break
      case 'next-stitch':
        handleSelectNextStitchHole()
        break
      case 'clear-stitches':
        handleClearAllStitchHoles()
        break
      case 'save-json':
        handleSaveJson()
        break
      case 'local-projects':
        setShowLocalProjectsModal(true)
        break
      case 'load-json':
        fileInputRef.current?.click()
        break
      case 'import-svg':
        svgInputRef.current?.click()
        break
      case 'export-center':
        setShowExportModal(true)
        break
      case 'export-options':
        setShowExportOptionsModal(true)
        break
      case 'export-svg':
        handleExportSvg()
        break
      case 'export-pdf':
        handleExportPdf()
        break
      case 'export-dxf':
        handleExportDxf()
        break
      case 'print-preview':
        setShowPrintPreviewModal(true)
        break
      case 'options':
        setShowOptionsModal(true)
        break
      case 'template-repository':
        setShowTemplateRepositoryModal(true)
        break
      case 'tracing':
        setShowTracingModal(true)
        break
      case 'ai-builder':
        setShowAiBuilderModal(true)
        break
      case 'arc-to-bezier':
        handleConvertArcToBezier()
        break
      case 'cad-offset':
        runPrecisionCommand('offset')
        break
      case 'cad-trim':
        runPrecisionCommand('trim')
        break
      case 'cad-extend':
        runPrecisionCommand('extend')
        break
      case 'cad-mirror':
        runPrecisionCommand('mirror')
        break
      case 'extend-trim':
        handleExtendOrTrimLines()
        break
      case 'mirror-shapes':
        handleMirrorShapes()
        break
      case 'line-symmetry':
        handleLineSymmetry()
        break
      case 'bezier-cp-symmetric':
        handleMakeBezierCpSymmetric()
        break
      case 'toggle-bezier-lines':
        handleToggleBezierOffsetLines()
        break
      case 'resize-shape':
        setShowChangeShapeSizeModal(true)
        break
      case 'stitch-simulator':
        setShowStitchSimulatorModal(true)
        break
      case 'box-stitch':
        if (selectedShapeIdSet.size > 0) {
          setShowBoxStitchHelperModal(true)
        } else {
          setShowBoxStitchModal(true)
        }
        break
      case 'pattern-wizard':
        setShowWizardModal(true)
        break
      case 'mandala':
        setShowMandalaModal(true)
        break
      case 'letter-stamp':
        setShowLetterStampModal(true)
        break
      default:
        break
    }
  }

  const handleWorkbenchActivateNode = (node: DocumentBrowserNode, multi: boolean) => {
    const parts = node.id.split(':')
    switch (node.kind) {
      case 'seam-connection': {
        // Two node shapes reach here: `seam:<id>` from the Seams section and
        // `seam-connection:<pieceId>:<id>` from under a piece.
        const seamId = parts.length > 2 ? parts[2] : parts[1]
        const seam = seamConnections.find((entry) => entry.id === seamId)
        if (!seam) {
          return
        }
        setSelectedSeamId(seamId)
        const boundaryShapeIds = Array.from(
          new Set(
            [...resolveSeamSpans(seam, 'from'), ...resolveSeamSpans(seam, 'to')]
              .map((span) => patternPiecesById[span.pieceId]?.boundaryShapeId)
              .filter((shapeId): shapeId is string => Boolean(shapeId)),
          ),
        )
        setSelectedShapeIds((previous) =>
          multi ? Array.from(new Set([...previous, ...boundaryShapeIds])) : boundaryShapeIds,
        )
        setActiveInspectorTab('piece')
        break
      }
      case 'piece':
      case 'piece-label':
      case 'pattern-label':
      case 'seam-allowance':
      case 'notch':
      case 'placement-label': {
        const pieceId = parts[1]
        const piece = patternPiecesById[pieceId]
        if (!piece) {
          return
        }
        ensurePatternPieceSupportRecords(piece)
        setSelectedShapeIds((previous) => {
          if (!multi) {
            return [piece.boundaryShapeId]
          }
          return previous.includes(piece.boundaryShapeId)
            ? previous.filter((entry) => entry !== piece.boundaryShapeId)
            : [...previous, piece.boundaryShapeId]
        })
        setActiveInspectorTab('piece')
        break
      }
      case 'layer':
        setActiveLayerId(parts[1])
        clearDraft()
        setActiveInspectorTab('document')
        break
      case 'layer-group':
        setActiveInspectorTab('document')
        break
      case 'sketch':
        setActiveSketchGroupId(parts[1])
        setActiveInspectorTab('document')
        break
      case 'tracing-overlay':
        setActiveTracingOverlayId(parts[1])
        setActiveInspectorTab('document')
        break
      case 'avatar':
      case 'texture-source':
      case 'preview-settings':
        setActiveInspectorTab('preview3d')
        break
      default:
        break
    }
  }

  const handleToggleLayerVisibilityById = (layerId: string) =>
    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              visible: !layer.visible,
            }
          : layer,
      ),
    )

  const handleToggleLayerLockById = (layerId: string) =>
    setLayers((previous) =>
      previous.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              locked: !layer.locked,
            }
          : layer,
      ),
    )

  const handleToggleTracingVisibilityById = (overlayId: string) =>
    setTracingOverlays((previous) =>
      previous.map((overlay) =>
        overlay.id === overlayId
          ? {
              ...overlay,
              visible: !overlay.visible,
            }
          : overlay,
      ),
    )

  const handleToggleTracingLockById = (overlayId: string) =>
    setTracingOverlays((previous) =>
      previous.map((overlay) =>
        overlay.id === overlayId
          ? {
              ...overlay,
              locked: !overlay.locked,
            }
          : overlay,
      ),
    )

  const handleToggleWorkbenchPeek = () => {
    if (workspaceMode === '2d') {
      setWorkspaceMode('3d')
      setSecondaryPreviewMode('2d-peek')
      return
    }

    setSecondaryPreviewMode((previous) => {
      if (previous !== 'hidden') {
        return 'hidden'
      }
      return '2d-peek'
    })
  }

  /**
   * One control drives both which surface is primary and whether the other is
   * showing, so the header no longer needs a mode toggle and a separate peek
   * button that overlap.
   */
  const handleSetWorkbenchMode = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode)
    if (mode === 'both') {
      // 2D leads and the model rides alongside, which is the reading order for
      // drafting: draw on the flat, watch it close on the model.
      setSecondaryPreviewMode('3d-peek')
      return
    }
    setSecondaryPreviewMode(mode === '3d' ? '2d-peek' : 'hidden')
  }

  return {
    selectionContext,
    browserNodes,
    quickActions,
    ribbonGroups,
    docLabel,
    selectionText,
    handleWorkbenchQuickAction,
    handleWorkbenchRibbonCommand,
    handleWorkbenchActivateNode,
    handleToggleLayerVisibilityById,
    handleToggleLayerLockById,
    handleToggleTracingVisibilityById,
    handleToggleTracingLockById,
    handleToggleWorkbenchPeek,
    handleSetWorkbenchMode,
  }
}
