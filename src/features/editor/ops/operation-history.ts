/**
 * Operation-based history system.
 *
 * Instead of deep-cloning the entire EditorSnapshot for each undo step,
 * this system records discrete operations with forward/reverse functions.
 *
 * Benefits:
 *  - Much lower memory footprint (stores deltas, not full copies)
 *  - Operation compression (merge consecutive same-type ops)
 *  - Meaningful operation descriptions in undo menu
 *
 * Falls back to snapshot-based undo for operations that are hard to reverse.
 */

import type { Point, Shape, FoldLine, StitchHole, HardwareMarker } from '../cad/cad-types'
import type { EditorSnapshot } from '../editor-types'
import { deepClone } from './history-ops'

// ---------------------------------------------------------------------------
// Operation types
// ---------------------------------------------------------------------------

export type AddShapesOp = {
  type: 'add-shapes'
  label: string
  shapes: Shape[]
}

export type RemoveShapesOp = {
  type: 'remove-shapes'
  label: string
  shapes: Shape[]
}

export type MoveShapesOp = {
  type: 'move-shapes'
  label: string
  shapeIds: string[]
  dx: number
  dy: number
}

export type ModifyShapeOp = {
  type: 'modify-shape'
  label: string
  shapeId: string
  oldShape: Shape
  newShape: Shape
}

export type AddFoldLineOp = {
  type: 'add-fold-line'
  label: string
  foldLine: FoldLine
}

export type RemoveFoldLineOp = {
  type: 'remove-fold-line'
  label: string
  foldLine: FoldLine
}

export type AddStitchHolesOp = {
  type: 'add-stitch-holes'
  label: string
  holes: StitchHole[]
}

export type RemoveStitchHolesOp = {
  type: 'remove-stitch-holes'
  label: string
  holes: StitchHole[]
}

export type AddHardwareOp = {
  type: 'add-hardware'
  label: string
  marker: HardwareMarker
}

export type RemoveHardwareOp = {
  type: 'remove-hardware'
  label: string
  marker: HardwareMarker
}

export type BooleanOpOp = {
  type: 'boolean-op'
  label: string
  removedShapes: Shape[]
  addedShapes: Shape[]
}

export type OffsetOpOp = {
  type: 'offset-op'
  label: string
  addedShapes: Shape[]
}

export type SnapshotOp = {
  type: 'snapshot'
  label: string
  beforeSnapshot: EditorSnapshot
}

export type EditorOperation =
  | AddShapesOp
  | RemoveShapesOp
  | MoveShapesOp
  | ModifyShapeOp
  | AddFoldLineOp
  | RemoveFoldLineOp
  | AddStitchHolesOp
  | RemoveStitchHolesOp
  | AddHardwareOp
  | RemoveHardwareOp
  | BooleanOpOp
  | OffsetOpOp
  | SnapshotOp

// ---------------------------------------------------------------------------
// Operation history state
// ---------------------------------------------------------------------------

export type OperationHistoryState = {
  past: EditorOperation[]
  future: EditorOperation[]
  maxOps: number
  maxBytes: number
}

const DEFAULT_MAX_OPS = 500
const DEFAULT_MAX_BYTES = 30 * 1024 * 1024

export function createOperationHistory(
  maxOps = DEFAULT_MAX_OPS,
  maxBytes = DEFAULT_MAX_BYTES,
): OperationHistoryState {
  return {
    past: [],
    future: [],
    maxOps,
    maxBytes,
  }
}

// ---------------------------------------------------------------------------
// Estimate size
// ---------------------------------------------------------------------------

function estimateOpSize(op: EditorOperation): number {
  switch (op.type) {
    case 'add-shapes':
    case 'remove-shapes':
      return op.shapes.length * 200
    case 'move-shapes':
      return op.shapeIds.length * 50 + 100
    case 'modify-shape':
      return 500
    case 'add-fold-line':
    case 'remove-fold-line':
      return 300
    case 'add-stitch-holes':
    case 'remove-stitch-holes':
      return op.holes.length * 150
    case 'add-hardware':
    case 'remove-hardware':
      return 300
    case 'boolean-op':
      return (op.removedShapes.length + op.addedShapes.length) * 200
    case 'offset-op':
      return op.addedShapes.length * 200
    case 'snapshot': {
      try {
        return JSON.stringify(op.beforeSnapshot).length * 2
      } catch {
        return 100000
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Push operation
// ---------------------------------------------------------------------------

export function pushOperation(
  history: OperationHistoryState,
  op: EditorOperation,
): OperationHistoryState {
  let nextPast = [...history.past, op]

  // Count-based eviction
  if (nextPast.length > history.maxOps) {
    nextPast = nextPast.slice(nextPast.length - history.maxOps)
  }

  // Size-based eviction
  let totalSize = 0
  for (let i = nextPast.length - 1; i >= 0; i--) {
    totalSize += estimateOpSize(nextPast[i])
    if (totalSize > history.maxBytes && i > 0) {
      nextPast = nextPast.slice(i)
      break
    }
  }

  return {
    ...history,
    past: nextPast,
    future: [], // Clear redo stack on new operation
  }
}

// ---------------------------------------------------------------------------
// Operation compression
// ---------------------------------------------------------------------------

/**
 * Tries to merge the last two operations if they're compatible.
 * E.g., two consecutive move operations on the same shapes.
 */
export function compressLastOps(history: OperationHistoryState): OperationHistoryState {
  if (history.past.length < 2) return history

  const last = history.past[history.past.length - 1]
  const prev = history.past[history.past.length - 2]

  // Merge consecutive moves
  if (last.type === 'move-shapes' && prev.type === 'move-shapes') {
    const lastIds = new Set(last.shapeIds)
    const prevIds = new Set(prev.shapeIds)
    if (lastIds.size === prevIds.size && [...lastIds].every((id) => prevIds.has(id))) {
      const merged: MoveShapesOp = {
        type: 'move-shapes',
        label: prev.label,
        shapeIds: prev.shapeIds,
        dx: prev.dx + last.dx,
        dy: prev.dy + last.dy,
      }
      return {
        ...history,
        past: [...history.past.slice(0, -2), merged],
      }
    }
  }

  // Merge consecutive offset ops (within 500ms would need timestamp, skip)
  return history
}

// ---------------------------------------------------------------------------
// Apply operation (forward)
// ---------------------------------------------------------------------------

export function applyOperationForward(
  snapshot: EditorSnapshot,
  op: EditorOperation,
): EditorSnapshot {
  switch (op.type) {
    case 'add-shapes':
      return { ...snapshot, shapes: [...snapshot.shapes, ...op.shapes] }

    case 'remove-shapes': {
      const ids = new Set(op.shapes.map((s) => s.id))
      return { ...snapshot, shapes: snapshot.shapes.filter((s) => !ids.has(s.id)) }
    }

    case 'move-shapes': {
      const moveSet = new Set(op.shapeIds)
      return {
        ...snapshot,
        shapes: snapshot.shapes.map((s) => {
          if (!moveSet.has(s.id)) return s
          return moveShape(s, op.dx, op.dy)
        }),
      }
    }

    case 'modify-shape':
      return {
        ...snapshot,
        shapes: snapshot.shapes.map((s) => (s.id === op.shapeId ? op.newShape : s)),
      }

    case 'add-fold-line':
      return { ...snapshot, foldLines: [...snapshot.foldLines, op.foldLine] }

    case 'remove-fold-line':
      return {
        ...snapshot,
        foldLines: snapshot.foldLines.filter((f) => f.id !== op.foldLine.id),
      }

    case 'add-stitch-holes':
      return { ...snapshot, stitchHoles: [...snapshot.stitchHoles, ...op.holes] }

    case 'remove-stitch-holes': {
      const ids = new Set(op.holes.map((h) => h.id))
      return {
        ...snapshot,
        stitchHoles: snapshot.stitchHoles.filter((h) => !ids.has(h.id)),
      }
    }

    case 'add-hardware':
      return {
        ...snapshot,
        hardwareMarkers: [...snapshot.hardwareMarkers, op.marker],
      }

    case 'remove-hardware':
      return {
        ...snapshot,
        hardwareMarkers: snapshot.hardwareMarkers.filter((m) => m.id !== op.marker.id),
      }

    case 'boolean-op': {
      const removedIds = new Set(op.removedShapes.map((s) => s.id))
      return {
        ...snapshot,
        shapes: snapshot.shapes
          .filter((s) => !removedIds.has(s.id))
          .concat(op.addedShapes),
      }
    }

    case 'offset-op':
      return { ...snapshot, shapes: [...snapshot.shapes, ...op.addedShapes] }

    case 'snapshot':
      // Forward re-apply not meaningful for snapshot ops
      return snapshot
  }
}

// ---------------------------------------------------------------------------
// Apply operation (reverse / undo)
// ---------------------------------------------------------------------------

export function applyOperationReverse(
  snapshot: EditorSnapshot,
  op: EditorOperation,
): EditorSnapshot {
  switch (op.type) {
    case 'add-shapes': {
      const ids = new Set(op.shapes.map((s) => s.id))
      return { ...snapshot, shapes: snapshot.shapes.filter((s) => !ids.has(s.id)) }
    }

    case 'remove-shapes':
      return { ...snapshot, shapes: [...snapshot.shapes, ...op.shapes] }

    case 'move-shapes': {
      const moveSet = new Set(op.shapeIds)
      return {
        ...snapshot,
        shapes: snapshot.shapes.map((s) => {
          if (!moveSet.has(s.id)) return s
          return moveShape(s, -op.dx, -op.dy)
        }),
      }
    }

    case 'modify-shape':
      return {
        ...snapshot,
        shapes: snapshot.shapes.map((s) => (s.id === op.shapeId ? op.oldShape : s)),
      }

    case 'add-fold-line':
      return {
        ...snapshot,
        foldLines: snapshot.foldLines.filter((f) => f.id !== op.foldLine.id),
      }

    case 'remove-fold-line':
      return { ...snapshot, foldLines: [...snapshot.foldLines, op.foldLine] }

    case 'add-stitch-holes': {
      const ids = new Set(op.holes.map((h) => h.id))
      return {
        ...snapshot,
        stitchHoles: snapshot.stitchHoles.filter((h) => !ids.has(h.id)),
      }
    }

    case 'remove-stitch-holes':
      return { ...snapshot, stitchHoles: [...snapshot.stitchHoles, ...op.holes] }

    case 'add-hardware':
      return {
        ...snapshot,
        hardwareMarkers: snapshot.hardwareMarkers.filter((m) => m.id !== op.marker.id),
      }

    case 'remove-hardware':
      return {
        ...snapshot,
        hardwareMarkers: [...snapshot.hardwareMarkers, op.marker],
      }

    case 'boolean-op': {
      const addedIds = new Set(op.addedShapes.map((s) => s.id))
      return {
        ...snapshot,
        shapes: snapshot.shapes
          .filter((s) => !addedIds.has(s.id))
          .concat(op.removedShapes),
      }
    }

    case 'offset-op': {
      const ids = new Set(op.addedShapes.map((s) => s.id))
      return { ...snapshot, shapes: snapshot.shapes.filter((s) => !ids.has(s.id)) }
    }

    case 'snapshot':
      return deepClone(op.beforeSnapshot)
  }
}

// ---------------------------------------------------------------------------
// Undo / Redo
// ---------------------------------------------------------------------------

export function undoOperation(
  history: OperationHistoryState,
  currentSnapshot: EditorSnapshot,
): { history: OperationHistoryState; snapshot: EditorSnapshot | null } {
  if (history.past.length === 0) {
    return { history, snapshot: null }
  }

  const op = history.past[history.past.length - 1]
  const newSnapshot = applyOperationReverse(currentSnapshot, op)

  return {
    history: {
      ...history,
      past: history.past.slice(0, -1),
      future: [op, ...history.future],
    },
    snapshot: newSnapshot,
  }
}

export function redoOperation(
  history: OperationHistoryState,
  currentSnapshot: EditorSnapshot,
): { history: OperationHistoryState; snapshot: EditorSnapshot | null } {
  if (history.future.length === 0) {
    return { history, snapshot: null }
  }

  const [op, ...rest] = history.future
  const newSnapshot = applyOperationForward(currentSnapshot, op)

  return {
    history: {
      ...history,
      past: [...history.past, op],
      future: rest,
    },
    snapshot: newSnapshot,
  }
}

/**
 * Gets a list of operation labels for the undo history display.
 */
export function getUndoLabels(history: OperationHistoryState): string[] {
  return history.past.map((op) => op.label).reverse()
}

export function getRedoLabels(history: OperationHistoryState): string[] {
  return history.future.map((op) => op.label)
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function moveShape(shape: Shape, dx: number, dy: number): Shape {
  const move = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy })

  switch (shape.type) {
    case 'line':
      return { ...shape, start: move(shape.start), end: move(shape.end) }
    case 'arc':
      return { ...shape, start: move(shape.start), mid: move(shape.mid), end: move(shape.end) }
    case 'bezier':
      return { ...shape, start: move(shape.start), control: move(shape.control), end: move(shape.end) }
    case 'text':
      return { ...shape, start: move(shape.start), end: move(shape.end) }
  }
}
