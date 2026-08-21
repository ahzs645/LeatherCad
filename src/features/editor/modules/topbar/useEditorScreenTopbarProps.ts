import type { UseEditorScreenShellsParams } from '../../editorScreenShellTypes'
import { useEditorTopbarViewModel } from '../../view-models/useEditorTopbarViewModel'
import { resolveSeamSpans } from '../../assembly/seam-spans'

export type EditorScreenTopbarLayout = {
  topbarClassName: string
  showToolSection: boolean
  showZoomSection: boolean
  showEditSection: boolean
  showLineTypeSection: boolean
  showStitchSection: boolean
  showLayerSection: boolean
  showFileSection: boolean
}

type UseEditorScreenTopbarPropsParams = UseEditorScreenShellsParams & {
  layout: EditorScreenTopbarLayout
}

export function useEditorScreenTopbarProps({
  documentState,
  uiState,
  selectionState,
  panelState,
  screenRefs,
  derivedState,
  actions,
  layout,
  repositoryState,
  patternPieceSelection,
}: UseEditorScreenTopbarPropsParams) {
  const {
    shapes,
    setShapes,
    foldLines,
    setFoldLines,
    stitchHoles,
    setStitchHoles,
    setHardwareMarkers,
    setDimensionLines,
    setSketchGroups,
    setActiveSketchGroupId,
    setPatternPieces,
    setPieceInterfaces,
    setAssemblyConnections,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setConstraints,
    setBackdrops,
    setActiveBackdropId,
    setTracingOverlays,
  } = documentState
  const {
    setStatus,
    customRotationPivot,
    customSnapPoint,
    setShowFontListModal,
    setShowWizardModal,
    setShowBackdropModal,
    setShowOptionsModal,
    setShowLengthAdjustModal,
    setShowDimensionInspectorModal,
    setShowMoveCopyDistanceModal,
    setMoveCopyDistanceMode,
    continuousDistanceMarking,
    notchAngleDeg,
    notchDepthMm,
    markingDistanceMm,
  } = uiState
  const {
    selectedShapeIds,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    selectedSeamId,
    setSelectedSeamId,
  } = selectionState
  const { setShowLayerColorModal } = panelState
  const { fileInputRef, svgInputRef, tracingInputRef, translationInputRef } = screenRefs
  const {
    activeLayer,
    layerStackLevels,
    selectedShapeCount,
    selectedStitchHoleCount,
    selectedShapeIdSet,
    selectedStitchHole,
    canUndo,
    canRedo,
  } = derivedState
  const {
    editorStateActions,
    documentCommands,
    exportActions,
    fileActions,
    historyActions,
    selectionActions,
    transformActions,
    layerActions,
    lineTypeActions,
    stitchActions,
    geometryActions,
    mobileActions,
    themeActions,
  } = actions
  const { resetDocument } = editorStateActions
  const { handleEnableStitchOnSelection, handleDisableStitchOnSelection } = documentCommands
  const { handleExportSvg, handleExportPdf, handleExportDxf, handleExportLaserSvg } = exportActions
  const { handleSaveJson, handleLoadPreset, handleOpenInNewTab } = fileActions
  const { handleUndo, handleRedo } = historyActions
  const {
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    handleSelectAllShapes,
    handleDuplicateSelection,
    handleDeleteSelection,
    handleGroupSelection,
    handleUngroupSelection,
    handleRotateSelection,
    handleScaleSelection,
    handleMoveSelectionBackward,
    handleMoveSelectionForward,
    handleSendSelectionToBack,
    handleBringSelectionToFront,
  } = selectionActions
  const {
    handleAlignSelectionToEdge,
    handleFlipSelection,
    handleReverseSelectedPaths,
    handleOpenSpecifyRotationModal,
    handleOpenSpecifyScaleModal,
    handleSetAsRotationCenter,
    handleClearRotationCenter,
    handleSetAsSnapPoint,
    handleClearSnapPoint,
    handleMakeSelectedLineHorizontal,
    handleMakeSelectedLineVertical,
  } = transformActions
  const {
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
    handleShowAllLayers,
    handleHideOtherLayers,
    handleMergeActiveLayerIntoBelow,
    handleFlattenAllLayers,
    handleActivateLayerOfSelectedShape,
    handleDuplicateSelectedShapesOnBelowLayer,
    handleMoveSelectedShapesToLayerBelow,
    handleMoveSelectedShapesToAnotherLayer,
    handleHighlightShapesOnCurrentLayer,
    handleToggleLayerIgnored,
    handleToggleIndependentLayer,
  } = layerActions
  const { handleToggleActiveLineTypeVisibility } = lineTypeActions
  const {
    handleAutoPlacePreferredPitchStitchHoles,
    handleAutoPlaceFixedPitchStitchHoles,
    handleAutoPlaceVariablePitchStitchHoles,
    handleAutoPlaceEvenlySpacedStitchHoles,
    handleResequenceSelectedStitchHoles,
    handleSelectNextStitchHole,
    handleFixStitchHoleOrderFromSelected,
    handleCountStitchHolesOnSelectedShapes,
    handleDeleteStitchHolesOnSelectedShapes,
    handleChangeStitchHoleShapeOnSelectedShapes,
    handleClearAllStitchHoles,
  } = stitchActions
  const {
    handleEditSelectedLineAngle,
    handleDeleteDuplicates,
    handleSplitIntoN,
    handleFilletSelectedCorner,
    handleDistanceMarkSelectedPath,
    handleConvertSelectionToPath,
    handleNotchSelectedShape,
    handleLineSymmetry,
    handleCenterLineBetweenSelection,
    handleDrawBoundaryAroundSelection,
  } = geometryActions
  const { handleRunMobileLayerAction, handleRunMobileFileAction } = mobileActions
  const { handleSetThemeMode } = themeActions
  const handleOpenMoveCopyDistanceModal = (mode: 'move' | 'copy') => {
    if (selectedShapeCount === 0) {
      setStatus('Select one or more shapes first')
      return
    }
    setMoveCopyDistanceMode(mode)
    setShowMoveCopyDistanceModal(true)
  }

  const { patternPieces, seamConnections } = documentState
  const topbarViewModel = useEditorTopbarViewModel({
    tracingInputRef,
    translationInputRef,
    shapes,
    stitchHoles,
    foldLines,
    selectedShapeIds,
    selectedShapeIdSet,
    setShapes,
    setStitchHoles,
    setFoldLines,
    setSelectedShapeIds,
    setSelectedStitchHoleId,
    setSelectedHardwareMarkerId,
    setHardwareMarkers,
    setDimensionLines,
    setSketchGroups,
    setActiveSketchGroupId,
    setPatternPieces,
    setPieceInterfaces,
    setAssemblyConnections,
    setPieceGrainlines,
    setPieceLabels,
    setPiecePlacementLabels,
    setPiecePlacements3d,
    setSeamConnections,
    setSeamAllowances,
    setPieceNotches,
    setConstraints,
    setBackdrops,
    setActiveBackdropId,
    setTracingOverlays,
    setStatus,
    resetDocument,
    setShowFontListModal,
    setShowWizardModal,
    setShowBackdropModal,
    setShowOptionsModal,
    setShowLengthAdjustModal,
    setShowDimensionInspectorModal,
    handleEditSelectedLineAngle,
    handleDeleteDuplicates,
    handleSplitIntoN,
    handleFilletSelectedCorner,
    handleDistanceMarkSelectedPath,
    handleConvertSelectionToPath,
    handleNotchSelectedShape,
    continuousDistanceMarking,
    notchAngleDeg,
    notchDepthMm,
    markingDistanceMm,
    topbarClassName: layout.topbarClassName,
    selectedShapeCount,
    selectedStitchHoleCount,
    showToolSection: layout.showToolSection,
    handleLoadPreset,
    handleSetThemeMode,
    showZoomSection: layout.showZoomSection,
    showEditSection: layout.showEditSection,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handleCutSelection,
    handlePasteClipboard,
    canPaste: true,
    handleSelectAllShapes,
    handleDuplicateSelection,
    handleDeleteSelection,
    handleGroupSelection,
    handleUngroupSelection,
    handleMoveSelectionByDistance: () => handleOpenMoveCopyDistanceModal('move'),
    handleCopySelectionByDistance: () => handleOpenMoveCopyDistanceModal('copy'),
    handleRotateSelection,
    handleScaleSelection,
    handleAlignSelectionToEdge,
    handleFlipSelection,
    handleReverseSelectedPaths,
    handleOpenSpecifyRotationModal,
    handleOpenSpecifyScaleModal,
    handleSetAsRotationCenter,
    handleClearRotationCenter,
    handleSetAsSnapPoint,
    handleClearSnapPoint,
    handleMakeSelectedLineHorizontal,
    handleMakeSelectedLineVertical,
    hasCustomRotationPivot: customRotationPivot !== null,
    hasCustomSnapPoint: customSnapPoint !== null,
    handleLineSymmetry,
    handleCenterLineBetweenSelection,
    catalogRepository: repositoryState.catalogRepository,
    selectedCatalogShopId: repositoryState.selectedCatalogShopId,
    onSelectCatalogShop: repositoryState.setSelectedCatalogShopId,
    handleDrawBoundaryAroundSelection,
    handleActivateLayerOfSelectedShape,
    handleDuplicateSelectedShapesOnBelowLayer,
    handleMoveSelectedShapesToLayerBelow,
    handleMoveSelectedShapesToAnotherLayer,
    handleHighlightShapesOnCurrentLayer,
    handleToggleLayerIgnored,
    handleToggleIndependentLayer,
    handleEnableStitchOnSelection,
    handleDisableStitchOnSelection,
    handleMoveSelectionBackward,
    handleMoveSelectionForward,
    handleSendSelectionToBack,
    handleBringSelectionToFront,
    showLineTypeSection: layout.showLineTypeSection,
    handleToggleActiveLineTypeVisibility,
    showStitchSection: layout.showStitchSection,
    handleAutoPlacePreferredPitchStitchHoles,
    handleAutoPlaceFixedPitchStitchHoles,
    handleAutoPlaceVariablePitchStitchHoles,
    handleAutoPlaceEvenlySpacedStitchHoles,
    handleResequenceSelectedStitchHoles,
    handleSelectNextStitchHole,
    handleFixStitchHoleOrderFromSelected,
    handleCountStitchHolesOnSelectedShapes,
    handleDeleteStitchHolesOnSelectedShapes,
    handleChangeStitchHoleShapeOnSelectedShapes,
    handleClearAllStitchHoles,
    stitchHolesLength: stitchHoles.length,
    hasSelectedStitchHole: selectedStitchHole !== null,
    showLayerSection: layout.showLayerSection,
    activeLayer,
    layerStackLevels,
    handleRunMobileLayerAction,
    handleAddLayer,
    handleRenameActiveLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleMoveLayer,
    handleDeleteLayer,
    handleShowAllLayers,
    handleHideOtherLayers,
    handleMergeActiveLayerIntoBelow,
    handleFlattenAllLayers,
    setShowLayerColorModal,
    showFileSection: layout.showFileSection,
    handleRunMobileFileAction,
    handleSaveJson,
    fileInputRef,
    svgInputRef,
    handleExportSvg,
    handleExportPdf,
    handleExportDxf,
    handleExportLaserSvg,
    handleOpenInNewTab,
  })

  // Pieces and seams for the compact shell. The workbench document tree that
  // normally carries these is not rendered below 768px, and every route to
  // creating a piece or opening its inspector ran through it.
  return {
    ...topbarViewModel,
    patternPieces,
    seamConnections,
    selectedPatternPieceId: patternPieceSelection.selectedPatternPiece?.id ?? null,
    selectedSeamId,
    canCreatePatternPiece: selectedShapeCount > 0,
    onCreatePatternPieceFromSelection: actions.patternPieceCommands.handleCreatePatternPieceFromSelection,
    onOpenPieceInspector: actions.patternPieceCommands.openSelectedPatternPieceInspector,
    onSelectPatternPiece: (pieceId: string) => {
      const piece = patternPieces.find((entry) => entry.id === pieceId)
      if (!piece) {
        return
      }
      setSelectedShapeIds([piece.boundaryShapeId])
    },
    onSelectSeam: (seamId: string) => {
      const seam = seamConnections.find((entry) => entry.id === seamId)
      setSelectedSeamId(seamId)
      if (!seam) {
        return
      }
      const boundaryShapeIds = Array.from(
        new Set(
          [...resolveSeamSpans(seam, 'from'), ...resolveSeamSpans(seam, 'to')]
            .map((span) => patternPieces.find((entry) => entry.id === span.pieceId)?.boundaryShapeId)
            .filter((shapeId): shapeId is string => Boolean(shapeId)),
        ),
      )
      setSelectedShapeIds(boundaryShapeIds)
    },
    onDeleteSeamConnection: (seamId: string) => {
      setSeamConnections((previous) => previous.filter((entry) => entry.id !== seamId))
      setSelectedSeamId((previous) => (previous === seamId ? null : previous))
    },
  }
}
