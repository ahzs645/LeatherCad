import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { DefaultEditorToolSession, type EditorToolSession } from '../../tools/tool-session'
import { useRequiredContext } from './property-state'

/**
 * One tool session for the whole editor.
 *
 * It used to be created inside the 2D canvas hook, which made it unreachable
 * from the 3D preview — and the seam tool's in-progress picks live on it. A
 * seam can now be started by clicking a flat edge and finished by clicking the
 * matching edge on the assembled model, which is only possible if both views
 * are pushing picks into the same state machine.
 *
 * The session is deliberately mutable and outside React state: tool sessions are
 * per-gesture scratch space, and re-rendering the canvas on every intermediate
 * pick is not wanted. Views that need to reflect it read it when they act.
 */
const EditorToolSessionContext = createContext<EditorToolSession | null>(null)

export function EditorToolSessionProvider({ children }: { children: ReactNode }) {
  const session = useMemo(() => new DefaultEditorToolSession(), [])
  return <EditorToolSessionContext.Provider value={session}>{children}</EditorToolSessionContext.Provider>
}

export function useEditorToolSession() {
  return useRequiredContext(useContext(EditorToolSessionContext), 'EditorToolSessionProvider')
}
