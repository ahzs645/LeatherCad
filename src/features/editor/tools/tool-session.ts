import type { Point, Tool } from '../cad/cad-types'

export type PendingSeamSelection = {
  pieceId: string
  pieceName: string
  edgeIndex: number
}

export interface EditorToolSession {
  getReferencePoint(): Point
  setReferencePoint(point: Point): void
  getPendingSeamSelection(): PendingSeamSelection | null
  setPendingSeamSelection(selection: PendingSeamSelection): void
  clearPendingSeamSelection(): void
  resetForTool(nextTool?: Tool): void
}

const DEFAULT_REFERENCE_POINT: Point = { x: 0, y: 0 }

export class DefaultEditorToolSession implements EditorToolSession {
  private referencePoint: Point = DEFAULT_REFERENCE_POINT
  private pendingSeamSelection: PendingSeamSelection | null = null

  getReferencePoint() {
    return this.referencePoint
  }

  setReferencePoint(point: Point) {
    this.referencePoint = point
  }

  getPendingSeamSelection() {
    return this.pendingSeamSelection
  }

  setPendingSeamSelection(selection: PendingSeamSelection) {
    this.pendingSeamSelection = selection
  }

  clearPendingSeamSelection() {
    this.pendingSeamSelection = null
  }

  resetForTool(nextTool?: Tool) {
    if (nextTool !== 'seam') {
      this.pendingSeamSelection = null
    }
  }
}
