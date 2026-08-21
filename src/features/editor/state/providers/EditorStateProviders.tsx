import type { ReactNode } from 'react'
import { EditorDocumentStateProvider } from './EditorDocumentStateProvider'
import { EditorHistoryStateProvider } from './EditorHistoryStateProvider'
import { EditorLayerStateProvider } from './EditorLayerStateProvider'
import { EditorPanelStateProvider } from './EditorPanelStateProvider'
import { EditorSelectionStateProvider } from './EditorSelectionStateProvider'
import { EditorToolSessionProvider } from './EditorToolSessionProvider'
import { EditorToolStateProvider } from './EditorToolStateProvider'
import { EditorUIStateProvider } from './EditorUIStateProvider'

export function EditorStateProviders({ children }: { children: ReactNode }) {
  return (
    <EditorLayerStateProvider>
      <EditorDocumentStateProvider>
        <EditorUIStateProvider>
          <EditorPanelStateProvider>
            <EditorToolStateProvider>
              <EditorHistoryStateProvider>
                <EditorSelectionStateProvider>
                  <EditorToolSessionProvider>{children}</EditorToolSessionProvider>
                </EditorSelectionStateProvider>
              </EditorHistoryStateProvider>
            </EditorToolStateProvider>
          </EditorPanelStateProvider>
        </EditorUIStateProvider>
      </EditorDocumentStateProvider>
    </EditorLayerStateProvider>
  )
}
