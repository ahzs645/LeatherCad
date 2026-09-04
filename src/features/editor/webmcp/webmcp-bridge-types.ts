/**
 * The seam between the WebMCP tools and the live editor.
 *
 * The tools are pure functions of this interface, so they can be built and
 * tested without React, a canvas or a browser that has WebMCP at all. The hook
 * that owns the editor's state is the only thing that implements it.
 */

import type { AiBuilderDocumentV1, AiBuilderPreflightIssue } from '../ai-builder/ai-builder-types'
import type { DocFile } from '../cad/cad-types'

export type ApplyOutcome = {
  ok: boolean
  message: string
  /** Problems the compiler's preflight found in what was just written. */
  preflight: AiBuilderPreflightIssue[]
  insertedPieceIds: string[]
  insertedShapeCount: number
  insertedStitchHoleCount: number
}

export type ExportFormat = 'svg' | 'pdf' | 'dxf' | 'json'

export type WebMcpBridge = {
  /** The document as the editor currently holds it. */
  getDocument: () => DocFile
  /** Merge a fragment into the open document, keeping everything already there. */
  applyDocument: (document: AiBuilderDocumentV1, label: string) => ApplyOutcome
  /** Replace the open document outright. Destructive, and only ever explicit. */
  replaceDocument: (document: AiBuilderDocumentV1, label: string) => ApplyOutcome
  /** Empty the document outright. Destructive, and only ever explicit. */
  clearDocument: () => void
  renameDocument: (name: string) => void
  /** Highlight pieces on the canvas so the person can see what the agent means. */
  selectPieces: (pieceIds: string[]) => number
  undo: () => void
  exportDocument: (format: ExportFormat) => { ok: boolean; message: string }
  setStatus: (message: string) => void
}
