import type { ReactNode } from 'react'
import { EditorDocumentStateProvider } from './EditorDocumentStateProvider'
import { EditorSelectionStateProvider } from './EditorSelectionStateProvider'
import { EditorUIStateProvider } from './EditorUIStateProvider'

export function EditorStateProviders({ children }: { children: ReactNode }) {
  return (
    <EditorDocumentStateProvider>
      <EditorUIStateProvider>
        <EditorSelectionStateProvider>
          {children}
        </EditorSelectionStateProvider>
      </EditorUIStateProvider>
    </EditorDocumentStateProvider>
  )
}
