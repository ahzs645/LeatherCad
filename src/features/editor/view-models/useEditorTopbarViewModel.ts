import {
  createEditorTopbarCommandHandlers,
  type CreateEditorTopbarCommandHandlersParams,
} from '../controllers/editor-topbar-command-handlers'
import {
  useEditorTopbarProps,
  type UseEditorTopbarPropsParams,
} from '../hooks/useEditorTopbarProps'

type TopbarPromptHandlerKeys =
  | 'handleEditSelectedLineAnglePrompt'
  | 'handleDeleteDuplicatesSelection'
  | 'handleSplitIntoNPrompt'
  | 'handleAddBackdrop'
  | 'handleOpenFontListModal'
  | 'handleCloseProject'
  | 'handleOpenSecretFeatures'
  | 'handleImportTranslation'
  | 'handleClearAll'
  | 'handleSelectConnectedChain'
  | 'handleStampSimulator'
  | 'handleOpenOptionsModal'
  | 'handleOpenLengthAdjustModal'
  | 'handleFilletSelectedCornerPrompt'
  | 'handleDistanceMarkSelectedPathPrompt'
  | 'handleConvertSelectionToPath'
  | 'handleConvertACopyToPath'
  | 'handleNotchSelectedShapePrompt'

type UseEditorTopbarViewModelParams = CreateEditorTopbarCommandHandlersParams &
  Omit<
    UseEditorTopbarPropsParams,
    TopbarPromptHandlerKeys | 'handleAutoPlaceEvenlySpacedStitchHolesPrompt'
  > & {
    handleAutoPlaceEvenlySpacedStitchHoles: (spacingMm: number) => void
  }

export function useEditorTopbarViewModel({
  handleAutoPlaceEvenlySpacedStitchHoles,
  ...params
}: UseEditorTopbarViewModelParams) {
  const commandHandlers = createEditorTopbarCommandHandlers(params)

  return useEditorTopbarProps({
    ...params,
    handleEditSelectedLineAnglePrompt: commandHandlers.handleEditSelectedLineAnglePrompt,
    handleDeleteDuplicatesSelection: commandHandlers.handleDeleteDuplicatesSelection,
    handleSplitIntoNPrompt: commandHandlers.handleSplitIntoNPrompt,
    handleDrawBoundaryAroundSelection: params.handleDrawBoundaryAroundSelection,
    handleAddBackdrop: commandHandlers.handleAddBackdrop,
    handleOpenFontListModal: commandHandlers.handleOpenFontListModal,
    handleCloseProject: commandHandlers.handleCloseProject,
    handleOpenSecretFeatures: commandHandlers.handleOpenSecretFeatures,
    handleImportTranslation: commandHandlers.handleImportTranslation,
    handleClearAll: commandHandlers.handleClearAll,
    handleSelectConnectedChain: commandHandlers.handleSelectConnectedChain,
    handleStampSimulator: commandHandlers.handleStampSimulator,
    handleOpenOptionsModal: commandHandlers.handleOpenOptionsModal,
    handleOpenLengthAdjustModal: commandHandlers.handleOpenLengthAdjustModal,
    handleFilletSelectedCornerPrompt: commandHandlers.handleFilletSelectedCornerPrompt,
    handleDistanceMarkSelectedPathPrompt: commandHandlers.handleDistanceMarkSelectedPathPrompt,
    handleConvertSelectionToPath: commandHandlers.handleConvertSelectionToPath,
    handleConvertACopyToPath: commandHandlers.handleConvertACopyToPath,
    handleNotchSelectedShapePrompt: commandHandlers.handleNotchSelectedShapePrompt,
    handleAutoPlaceEvenlySpacedStitchHolesPrompt: () =>
      commandHandlers.handleAutoPlaceEvenlySpacedStitchHolesPrompt(handleAutoPlaceEvenlySpacedStitchHoles),
  })
}
