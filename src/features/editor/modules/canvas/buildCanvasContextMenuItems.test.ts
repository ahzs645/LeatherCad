import { describe, expect, it, vi } from 'vitest'
import type { Shape } from '../../cad/cad-types'
import { buildCanvasContextMenuItems } from './buildCanvasContextMenuItems'

const line = (id: string, extra: Partial<Shape> = {}): Shape => ({ id, type: 'line', layerId: 'a', lineTypeId: 't', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, ...extra } as Shape)
const arc = (id: string): Shape => ({ id, type: 'arc', layerId: 'a', lineTypeId: 't', start: { x: 0, y: 0 }, mid: { x: 5, y: 5 }, end: { x: 10, y: 0 } })

function handlers() {
  const noop = () => undefined
  return {
    handleBringSelectionToFront: noop, handleSendSelectionToBack: noop, handleDuplicateSelection: noop,
    handleConvertSelectionToPath: noop, handleDeleteSelection: noop, handleMakeBezierCpFlat: noop,
    handleMakeBezierCpSameLength: noop, handleMakeBezierCpSymmetric: noop, handleClearSelectedStitchHoleEnd: noop,
    handleMarkSelectedStitchHoleAsEnd: noop, handleCopySelection: noop, handleCutSelection: noop,
    handlePasteClipboard: noop, handleSelectAllShapes: noop, handleGroupSelection: noop, handleUngroupSelection: noop,
    handleRotateSelection: vi.fn(), handleFlipSelection: vi.fn(), handleSetAsRotationCenter: noop,
    handleClearRotationCenter: noop, handleMakeSelectedLineHorizontal: noop, handleMakeSelectedLineVertical: noop,
    handleConvertArcToBezier: noop, handleSetSelectionLocked: vi.fn(), handleMoveSelectedShapesToLayerBelow: noop,
    handleDuplicateSelectedShapesOnBelowLayer: noop, handleMoveSelectedShapesToActiveLayer: noop,
    handleActivateLayerOfSelectedShape: noop, handleFitView: noop,
  }
}

const ids = (items: ReturnType<typeof buildCanvasContextMenuItems>) => items.map((item) => item.id)

describe('selection-aware canvas menu', () => {
  it('offers paste, select all and fit when nothing is selected', () => {
    const items = buildCanvasContextMenuItems({ ...handlers(), shapes: [line('l1')], selectedShapeIdSet: new Set(), selectedStitchHole: null })
    expect(ids(items)).toEqual(['paste', 'select-all', 'fit-view'])
  })

  it('adds line-axis actions only for a single line and arc conversion only for arcs', () => {
    const single = ids(buildCanvasContextMenuItems({ ...handlers(), shapes: [line('l1')], selectedShapeIdSet: new Set(['l1']), selectedStitchHole: null }))
    expect(single).toContain('line-horizontal')
    expect(single).not.toContain('arcs-to-bezier')
    expect(single).not.toContain('group')
    const mixed = buildCanvasContextMenuItems({ ...handlers(), shapes: [line('l1'), arc('a1')], selectedShapeIdSet: new Set(['l1', 'a1']), selectedStitchHole: null })
    expect(ids(mixed)).not.toContain('line-horizontal')
    expect(ids(mixed)).toContain('arcs-to-bezier')
    expect(ids(mixed)).toContain('group')
    expect(mixed.find((item) => item.id === 'delete')?.label).toBe('Delete (2)')
  })

  it('shows lock or unlock according to the selection and wires the handler', () => {
    const h = handlers()
    const unlocked = buildCanvasContextMenuItems({ ...h, shapes: [line('l1')], selectedShapeIdSet: new Set(['l1']), selectedStitchHole: null })
    expect(ids(unlocked)).toContain('lock')
    expect(ids(unlocked)).not.toContain('unlock')
    unlocked.find((item) => item.id === 'lock')!.onSelect()
    expect(h.handleSetSelectionLocked).toHaveBeenCalledWith(true)
    const locked = ids(buildCanvasContextMenuItems({ ...h, shapes: [line('l1', { locked: true })], selectedShapeIdSet: new Set(['l1']), selectedStitchHole: null }))
    expect(locked).toContain('unlock')
    expect(locked).not.toContain('lock')
  })

  it('offers layer moves only when there is another layer to move to', () => {
    const base = { ...handlers(), shapes: [line('l1')], selectedShapeIdSet: new Set(['l1']), selectedStitchHole: null }
    expect(ids(buildCanvasContextMenuItems({ ...base, layerCount: 1, activeLayerId: 'a' }))).not.toContain('layer-move-below')
    const many = ids(buildCanvasContextMenuItems({ ...base, layerCount: 3, activeLayerId: 'b' }))
    expect(many).toEqual(expect.arrayContaining(['layer-move-below', 'layer-move-active', 'layer-activate']))
  })

  it('groups items so separators can be drawn between sections', () => {
    const items = buildCanvasContextMenuItems({ ...handlers(), shapes: [line('l1')], selectedShapeIdSet: new Set(['l1']), selectedStitchHole: null })
    expect(new Set(items.map((item) => item.group))).toEqual(new Set(['clipboard', 'transform', 'geometry', 'order', 'organize', 'delete']))
    expect(items.filter((item) => item.bar).map((item) => item.id)).toContain('rotate-cw')
  })
})
