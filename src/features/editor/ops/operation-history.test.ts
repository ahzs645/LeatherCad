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
  type AddShapesOp,
  type MoveShapesOp,
} from './operation-history'
import type { EditorSnapshot } from '../editor-types'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import type { CubicShape, EllipseShape } from '../cad/cad-types'

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
    patternPieces: [],
    pieceInterfaces: [],
    assemblyConnections: [],
    pieceGrainlines: [],
    pieceLabels: [],
    piecePlacementLabels: [],
    piecePlacements3d: [],
    seamConnections: [],
    seamAllowances: [],
    pieceNotches: [],
    hardwareMarkers: [],
    snapSettings: { enabled: false, grid: false, gridStep: 5, endpoints: true, midpoints: false, quarterPoints: false, guides: false, hardware: false },
    showAnnotations: true,
    tracingOverlays: [],
    backdrops: [],
    projectMemo: '',
    stitchAlwaysShapeIds: [],
    stitchThreadColor: '#ffffff',
    threePreviewSettings: DEFAULT_THREE_PREVIEW_SETTINGS,
    avatars: [],
    threeTextureSource: null,
    threeTextureShapeIds: [],
    leatherImageFills: [],
    activeLeatherImageFillId: null,
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

describe('native curve operation history', () => {
  it('moves and undoes native controls/ellipse centers without flattening or losing style metadata', () => {
    const cubic: CubicShape = { id: 'cubic', type: 'cubic', layerId: 'l1', lineTypeId: 'lt1', start: { x: 0, y: 0 }, control1: { x: 5, y: 20 }, control2: { x: 30, y: -10 }, end: { x: 40, y: 0 }, opacity: 0.5, locked: true }
    const ellipse: EllipseShape = { id: 'ellipse', type: 'ellipse', layerId: 'l1', lineTypeId: 'lt1', center: { x: 80, y: 20 }, radiusX: 20, radiusY: 8, rotationDeg: 30, startAngleDeg: 0, sweepDeg: 360, strokeWidthOverride: 0.35 }
    const snapshot = { ...makeSnapshot(), shapes: [cubic, ellipse] }
    const op: MoveShapesOp = { type: 'move-shapes', label: 'Move curves', shapeIds: ['cubic', 'ellipse'], dx: 12, dy: -3 }
    const changed = applyOperationForward(snapshot, op)
    const changedCubic = changed.shapes[0]
    if (changedCubic.type !== 'cubic') throw new Error('Expected cubic')
    expect(changedCubic.control1).toEqual({ x: 17, y: 17 })
    expect(changedCubic.locked).toBe(true)
    const changedEllipse = changed.shapes[1]
    if (changedEllipse.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(changedEllipse.center).toEqual({ x: 92, y: 17 })
    expect(changedEllipse.strokeWidthOverride).toBe(0.35)
    const restored = applyOperationReverse(changed, op)
    const restoredCubic = restored.shapes[0], restoredEllipse = restored.shapes[1]
    expect(restoredCubic).toEqual(cubic)
    if (restoredEllipse.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(restoredEllipse.center.x).toBeCloseTo(ellipse.center.x, 8)
    expect(restoredEllipse.center.y).toBeCloseTo(ellipse.center.y, 8)
    expect(restoredEllipse.radiusX).toBeCloseTo(ellipse.radiusX, 8)
    expect(restoredEllipse.radiusY).toBeCloseTo(ellipse.radiusY, 8)
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
    if (after.shapes[0].type !== 'line') throw new Error('Expected moved line')
    expect(after.shapes[0].start.x).toBe(10)
    expect(after.shapes[0].start.y).toBe(20)

    const reverted = applyOperationReverse(after, op)
    if (reverted.shapes[0].type !== 'line') throw new Error('Expected restored line')
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

describe('snapshot edit redo', () => {
  it('redoes a generic snapshot edit after it is undone', () => {
    const before = makeSnapshot([{ id: 'a' }])
    const after = makeSnapshot([{ id: 'a' }, { id: 'b' }])
    const history = pushOperation(createOperationHistory(), { type: 'snapshot', label: 'Edit', beforeSnapshot: before })
    const undone = undoOperation(history, after)
    expect(undone.snapshot?.shapes.map((shape) => shape.id)).toEqual(['a'])
    const redone = redoOperation(undone.history, undone.snapshot!)
    expect(redone.snapshot?.shapes.map((shape) => shape.id)).toEqual(['a', 'b'])
    const undoneAgain = undoOperation(redone.history, redone.snapshot!)
    expect(undoneAgain.snapshot?.shapes.map((shape) => shape.id)).toEqual(['a'])
  })
})
