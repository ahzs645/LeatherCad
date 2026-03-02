import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { MobileFileAction, MobileLayerAction } from '../editor-types'

type UseMobileActionsParams = {
  mobileLayerAction: MobileLayerAction
  mobileFileAction: MobileFileAction
  fileInputRef: RefObject<HTMLInputElement | null>
  svgInputRef: RefObject<HTMLInputElement | null>
  tracingInputRef: RefObject<HTMLInputElement | null>
  handleAddLayer: () => void
  handleRenameActiveLayer: () => void
  handleToggleLayerVisibility: () => void
  handleToggleLayerLock: () => void
  handleMoveLayer: (direction: -1 | 1) => void
  handleDeleteLayer: () => void
  handleSaveJson: () => void
  handleLoadPreset: () => void
  handleExportSvg: () => void
  handleExportPdf: () => void
  handleExportDxf: () => void
  handleUndo: () => void
  handleRedo: () => void
  handleCopySelection: () => void
  handlePasteClipboard: () => void
  handleDeleteSelection: () => void
  resetDocument: () => void
  setShowLayerColorModal: Dispatch<SetStateAction<boolean>>
  setShowExportOptionsModal: Dispatch<SetStateAction<boolean>>
  setShowTemplateRepositoryModal: Dispatch<SetStateAction<boolean>>
  setShowPatternToolsModal: Dispatch<SetStateAction<boolean>>
  setShowPrintPreviewModal: Dispatch<SetStateAction<boolean>>
  setShowThreePreview: Dispatch<SetStateAction<boolean>>
}

export function useMobileActions(params: UseMobileActionsParams) {
  const {
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
  } = params

  const handleRunMobileLayerAction = () => {
    if (mobileLayerAction === 'add') {
      handleAddLayer()
      return
    }

    if (mobileLayerAction === 'rename') {
      handleRenameActiveLayer()
      return
    }

    if (mobileLayerAction === 'toggle-visibility') {
      handleToggleLayerVisibility()
      return
    }

    if (mobileLayerAction === 'toggle-lock') {
      handleToggleLayerLock()
      return
    }

    if (mobileLayerAction === 'move-up') {
      handleMoveLayer(-1)
      return
    }

    if (mobileLayerAction === 'move-down') {
      handleMoveLayer(1)
      return
    }

    if (mobileLayerAction === 'delete') {
      handleDeleteLayer()
      return
    }

    setShowLayerColorModal(true)
  }

  const handleRunMobileFileAction = () => {
    if (mobileFileAction === 'save-json') {
      handleSaveJson()
      return
    }

    if (mobileFileAction === 'load-json') {
      fileInputRef.current?.click()
      return
    }

    if (mobileFileAction === 'import-svg') {
      svgInputRef.current?.click()
      return
    }

    if (mobileFileAction === 'load-preset') {
      handleLoadPreset()
      return
    }

    if (mobileFileAction === 'export-svg') {
      handleExportSvg()
      return
    }

    if (mobileFileAction === 'export-pdf') {
      handleExportPdf()
      return
    }

    if (mobileFileAction === 'export-dxf') {
      handleExportDxf()
      return
    }

    if (mobileFileAction === 'export-options') {
      setShowExportOptionsModal(true)
      return
    }

    if (mobileFileAction === 'template-repository') {
      setShowTemplateRepositoryModal(true)
      return
    }

    if (mobileFileAction === 'pattern-tools') {
      setShowPatternToolsModal(true)
      return
    }

    if (mobileFileAction === 'import-tracing') {
      tracingInputRef.current?.click()
      return
    }

    if (mobileFileAction === 'print-preview') {
      setShowPrintPreviewModal(true)
      return
    }

    if (mobileFileAction === 'undo') {
      handleUndo()
      return
    }

    if (mobileFileAction === 'redo') {
      handleRedo()
      return
    }

    if (mobileFileAction === 'copy') {
      handleCopySelection()
      return
    }

    if (mobileFileAction === 'paste') {
      handlePasteClipboard()
      return
    }

    if (mobileFileAction === 'delete') {
      handleDeleteSelection()
      return
    }

    if (mobileFileAction === 'toggle-3d') {
      setShowThreePreview((previous) => !previous)
      return
    }

    resetDocument()
  }

  return {
    handleRunMobileLayerAction,
    handleRunMobileFileAction,
  }
}
