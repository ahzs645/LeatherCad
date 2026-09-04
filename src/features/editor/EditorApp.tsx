import { EditorDesktopShell } from './components/EditorDesktopShell'
import { EditorMobileShell } from './components/EditorMobileShell'
import { EditorOverlayHost } from './components/EditorOverlayHost'
import { EditorStateProviders } from './state/providers/EditorStateProviders'
import { useEditorScreenController } from './useEditorScreenController'
import { WebMcpPanel } from './webmcp/WebMcpPanel'

export function EditorApp() {
  return (
    <EditorStateProviders>
      <EditorAppContent />
    </EditorStateProviders>
  )
}

function EditorAppContent() {
  const controller = useEditorScreenController()

  return (
    <div
      className={`app-shell ${controller.layout.resolvedThemeMode === 'light' ? 'theme-light' : 'theme-dark'} ${!controller.layout.isMobileLayout ? 'app-shell-workbench' : ''}`}
    >
      {controller.layout.isMobileLayout ? (
        <EditorMobileShell {...controller.mobileShell} />
      ) : (
        <EditorDesktopShell {...controller.desktopShell} />
      )}
      <EditorOverlayHost {...controller.overlay} />
      <WebMcpPanel state={controller.webMcp} />
    </div>
  )
}

export default EditorApp
