import type { ReactNode } from 'react'
import { EditorDocumentStateProvider } from './EditorDocumentStateProvider'
import { EditorLayerStateProvider } from './EditorLayerStateProvider'
import { EditorSelectionStateProvider } from './EditorSelectionStateProvider'
import { EditorUIStateProvider } from './EditorUIStateProvider'

export function EditorStateProviders({ children }: { children: ReactNode }) {
  return (
    <EditorLayerStateProvider>
      <EditorDocumentStateProvider>
        <EditorUIStateProvider>
          <EditorSelectionStateProvider>
            {children}
          </EditorSelectionStateProvider>
        </EditorUIStateProvider>
      </EditorDocumentStateProvider>
    </EditorLayerStateProvider>
  )
}
