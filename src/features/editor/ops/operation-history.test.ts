import { describe, it, expect } from 'vitest'
import {
  createOperationHistory,
  pushOperation,
  compressLastOps,
  undoOperation,
  redoOperation,
  getUndoLabels,
  getRedoLabels,
  applyOperationForward,
  applyOperationReverse,
  type OperationHistoryState,
  type AddShapesOp,
  type MoveShapesOp,
  type RemoveShapesOp,
} from './operation-history'
import type { EditorSnapshot } from '../editor-types'

function makeSnapshot(shapes: { id: string }[] = []): EditorSnapshot {
  return {
    layers: [{ id: 'l1', name: 'Layer 1', visible: true, locked: false }],
    activeLayerId: 'l1',
    sketchGroups: [],
    activeSketchGroupId: null,
    lineTypes: [],
    activeLineTypeId: 'lt1',
    shapes: shapes.map((s) => ({
      id: s.id,
      type: 'line' as const,
      layerId: 'l1',
      lineTypeId: 'lt1',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    })),
    foldLines: [],
    stitchHoles: [],
    constraints: [],
    seamAllowances: [],
    hardwareMarkers: [],
    snapSettings: { gridSnap: false, endpointSnap: true, midpointSnap: false, gridSizeMm: 5, angleLock: false, angleLockDeg: 45 },
    showAnnotations: true,
    tracingOverlays: [],
    projectMemo: '',
    stitchAlwaysShapeIds: [],
    stitchThreadColor: '#ffffff',
    threeTextureSource: null,
    threeTextureShapeIds: [],
    showCanvasRuler: true,
    showDimensions: true,
    layerColorOverrides: {},
    frontLayerColor: '#3b82f6',
    backLayerColor: '#ef4444',
  }
}

describe('createOperationHistory', () => {
  it('creates empty history', () => {
    const h = createOperationHistory()
    expect(h.past).toHaveLength(0)
    expect(h.future).toHaveLength(0)
    expect(h.maxOps).toBe(500)
  })
})

describe('pushOperation', () => {
  it('adds operation to past and clears future', () => {
    let h = createOperationHistory()
    const op: AddShapesOp = {
      type: 'add-shapes',
      label: 'Draw line',
      shapes: [{ id: 's1', type: 'line', layerId: 'l1', lineTypeId: 'lt1', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }],
    }
    h = pushOperation(h, op)
    expect(h.past).toHaveLength(1)
    expect(h.future).toHaveLength(0)
  })

  it('evicts oldest ops when exceeding maxOps', () => {
    let h = createOperationHistory(3)
    for (let i = 0; i < 5; i++) {
      h = pushOperation(h, { type: 'add-shapes', label: `op ${i}`, shapes: [] })
    }
    expect(h.past.length).toBeLessThanOrEqual(3)
  })
})

describe('compressLastOps', () => {
  it('merges consecutive moves on same shapes', () => {
    const move1: MoveShapesOp = { type: 'move-shapes', label: 'Move', shapeIds: ['s1'], dx: 5, dy: 0 }
    const move2: MoveShapesOp = { type: 'move-shapes', label: 'Move', shapeIds: ['s1'], dx: 0, dy: 3 }
    let h = createOperationHistory()
    h = pushOperation(h, move1)
    h = pushOperation(h, move2)
    h = compressLastOps(h)
    expect(h.past).toHaveLength(1)
    const merged = h.past[0] as MoveShapesOp
    expect(merged.dx).toBe(5)
    expect(merged.dy).toBe(3)
  })

  it('does not merge moves on different shapes', () => {
    const move1: MoveShapesOp = { type: 'move-shapes', label: 'Move', shapeIds: ['s1'], dx: 5, dy: 0 }
    const move2: MoveShapesOp = { type: 'move-shapes', label: 'Move', shapeIds: ['s2'], dx: 0, dy: 3 }
    let h = createOperationHistory()
    h = pushOperation(h, move1)
    h = pushOperation(h, move2)
    h = compressLastOps(h)
    expect(h.past).toHaveLength(2)
  })
})

describe('applyOperationForward / applyOperationReverse', () => {
  it('add-shapes forward adds, reverse removes', () => {
    const snap = makeSnapshot()
    const op: AddShapesOp = {
      type: 'add-shapes',
      label: 'Add',
      shapes: [{ id: 'new1', type: 'line', layerId: 'l1', lineTypeId: 'lt1', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }],
    }
    const after = applyOperationForward(snap, op)
    expect(after.shapes).toHaveLength(1)
    expect(after.shapes[0].id).toBe('new1')

    const reverted = applyOperationReverse(after, op)
    expect(reverted.shapes).toHaveLength(0)
  })

  it('move-shapes forward moves, reverse reverts', () => {
    const snap = makeSnapshot([{ id: 's1' }])
    const op: MoveShapesOp = { type: 'move-shapes', label: 'Move', shapeIds: ['s1'], dx: 10, dy: 20 }

    const after = applyOperationForward(snap, op)
    expect(after.shapes[0].start.x).toBe(10)
    expect(after.shapes[0].start.y).toBe(20)

    const reverted = applyOperationReverse(after, op)
    expect(reverted.shapes[0].start.x).toBe(0)
    expect(reverted.shapes[0].start.y).toBe(0)
  })
})

describe('undoOperation / redoOperation', () => {
  it('undo pops last op and applies reverse', () => {
    const snap = makeSnapshot()
    const op: AddShapesOp = {
      type: 'add-shapes',
      label: 'Draw',
      shapes: [{ id: 's1', type: 'line', layerId: 'l1', lineTypeId: 'lt1', start: { x: 0, y: 0 }, end: { x: 5, y: 5 } }],
    }
    let h = createOperationHistory()
    h = pushOperation(h, op)

    const afterAdd = applyOperationForward(snap, op)
    const result = undoOperation(h, afterAdd)
    expect(result.snapshot).not.toBeNull()
    expect(result.snapshot!.shapes).toHaveLength(0)
    expect(result.history.past).toHaveLength(0)
    expect(result.history.future).toHaveLength(1)
  })

  it('redo restores undone operation', () => {
    const snap = makeSnapshot()
    const op: AddShapesOp = {
      type: 'add-shapes',
      label: 'Draw',
      shapes: [{ id: 's1', type: 'line', layerId: 'l1', lineTypeId: 'lt1', start: { x: 0, y: 0 }, end: { x: 5, y: 5 } }],
    }
    let h = createOperationHistory()
    h = pushOperation(h, op)

    const afterAdd = applyOperationForward(snap, op)
    const undoResult = undoOperation(h, afterAdd)
    const redoResult = redoOperation(undoResult.history, undoResult.snapshot!)
    expect(redoResult.snapshot).not.toBeNull()
    expect(redoResult.snapshot!.shapes).toHaveLength(1)
  })

  it('returns null snapshot when nothing to undo', () => {
    const h = createOperationHistory()
    const snap = makeSnapshot()
    const result = undoOperation(h, snap)
    expect(result.snapshot).toBeNull()
  })
})

describe('getUndoLabels / getRedoLabels', () => {
  it('returns labels in reverse order for undo', () => {
    let h = createOperationHistory()
    h = pushOperation(h, { type: 'add-shapes', label: 'First', shapes: [] })
    h = pushOperation(h, { type: 'add-shapes', label: 'Second', shapes: [] })
    const labels = getUndoLabels(h)
    expect(labels).toEqual(['Second', 'First'])
  })

  it('returns empty array for empty history', () => {
    const h = createOperationHistory()
    expect(getRedoLabels(h)).toEqual([])
  })
})
