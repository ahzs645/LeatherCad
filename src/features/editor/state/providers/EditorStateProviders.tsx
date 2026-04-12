import type { ReactNode } from 'react'
import { EditorDocumentStateProvider } from './EditorDocumentStateProvider'
import { EditorLayerStateProvider } from './EditorLayerStateProvider'
import { EditorPanelStateProvider } from './EditorPanelStateProvider'
import { EditorSelectionStateProvider } from './EditorSelectionStateProvider'
import { EditorUIStateProvider } from './EditorUIStateProvider'

export function EditorStateProviders({ children }: { children: ReactNode }) {
  return (
    <EditorLayerStateProvider>
      <EditorDocumentStateProvider>
        <EditorUIStateProvider>
          <EditorPanelStateProvider>
            <EditorSelectionStateProvider>
              {children}
            </EditorSelectionStateProvider>
          </EditorPanelStateProvider>
        </EditorUIStateProvider>
      </EditorDocumentStateProvider>
    </EditorLayerStateProvider>
  )
}
