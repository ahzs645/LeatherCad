import type { DocFile } from '../cad/cad-types'
import { createDraftSnapshot, persistDraftSnapshot } from '../ops/draft-recovery'

type EditorDraftCapture = () => { doc: DocFile; localDocumentId: string | null }
let capture: EditorDraftCapture | undefined

export function registerEditorDraftCapture(next: EditorDraftCapture): () => void {
  capture = next
  return () => { if (capture === next) capture = undefined }
}

/** Await a local durable copy of the latest edits before any provider can leave
 * the page, regardless of the user's optional periodic-autosave preference. */
export async function preserveEditorDraftForSignIn(): Promise<void> {
  if (!capture) throw new Error('The editor is not ready to preserve your drawing. Try sign-in again after recovery finishes.')
  const { doc, localDocumentId } = capture()
  await persistDraftSnapshot(createDraftSnapshot(JSON.stringify(doc), 'signin', localDocumentId))
}
