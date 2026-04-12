import { EditorDesktopShell } from './components/EditorDesktopShell'
import { EditorMobileShell } from './components/EditorMobileShell'
import { EditorOverlayHost } from './components/EditorOverlayHost'
import { EditorStateProviders } from './state/providers/EditorStateProviders'
import { useEditorScreenModel } from './useEditorScreenModel'

export function EditorApp() {
  return (
    <EditorStateProviders>
      <EditorAppContent />
    </EditorStateProviders>
  )
}

function EditorAppContent() {
  const screen = useEditorScreenModel()

  return (
    <div
      className={`app-shell ${screen.layout.resolvedThemeMode === 'light' ? 'theme-light' : 'theme-dark'} ${!screen.layout.isMobileLayout ? 'app-shell-workbench' : ''}`}
    >
      {screen.layout.isMobileLayout ? (
        <EditorMobileShell {...screen.workbench.mobileShellProps} />
      ) : (
        <EditorDesktopShell
          shouldLoadThreeWorkbench={screen.layout.shouldLoadThreeWorkbench}
          renderDesktopWorkbench={screen.workbench.renderDesktopWorkbench}
          threeWorkspaceLoadingState={screen.workbench.threeWorkspaceLoadingState}
          threeWorkspaceRoutePrompt={screen.workbench.threeWorkspaceRoutePrompt}
          workbenchProps={screen.workbench.workbenchThreeWorkspaceProps}
        />
      )}
      <EditorOverlayHost
        modalStack={screen.modals.modalStack}
        projectMemoModal={screen.modals.projectMemoModal}
        pieceInspectorModal={screen.modals.pieceInspectorModal}
        nestingModal={screen.modals.nestingModal}
        hiddenInputs={screen.inputs.hiddenInputs}
        fontInput={screen.inputs.fontInput}
      />
    </div>
  )
}

export default EditorApp
