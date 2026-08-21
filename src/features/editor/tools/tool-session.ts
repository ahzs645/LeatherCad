import type { Point, Tool } from '../cad/cad-types'
import { EMPTY_SEAM_TOOL_STATE, type SeamToolState } from './seam-tool-state'

/** @deprecated Kept for callers written against the single-edge seam tool. */
export type PendingSeamSelection = {
  pieceId: string
  pieceName: string
  edgeIndex: number
}

export const SEAM_TOOLS: readonly Tool[] = ['seam', 'seam-multi']

export interface EditorToolSession {
  getReferencePoint(): Point
  setReferencePoint(point: Point): void
  getSeamToolState(): SeamToolState
  setSeamToolState(state: SeamToolState): void
  clearSeamToolState(): void
  resetForTool(nextTool?: Tool): void
}

const DEFAULT_REFERENCE_POINT: Point = { x: 0, y: 0 }

export class DefaultEditorToolSession implements EditorToolSession {
  private referencePoint: Point = DEFAULT_REFERENCE_POINT
  private seamToolState: SeamToolState = EMPTY_SEAM_TOOL_STATE

  getReferencePoint() {
    return this.referencePoint
  }

  setReferencePoint(point: Point) {
    this.referencePoint = point
  }

  getSeamToolState() {
    return this.seamToolState
  }

  setSeamToolState(state: SeamToolState) {
    this.seamToolState = state
  }

  clearSeamToolState() {
    this.seamToolState = EMPTY_SEAM_TOOL_STATE
  }

  resetForTool(nextTool?: Tool) {
    // Switching between the single and multi seam tools keeps the in-progress
    // picks, so a selection can be widened without starting over. Leaving the
    // seam tools entirely discards it.
    if (!nextTool || !SEAM_TOOLS.includes(nextTool)) {
      this.seamToolState = EMPTY_SEAM_TOOL_STATE
    }
  }
}
