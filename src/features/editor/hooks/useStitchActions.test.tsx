import { act, createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SetStateAction } from 'react'
import { click, cleanupRender, renderForTest } from '../../../test/render'
import type { LineShape, SketchGroup, StitchHole } from '../cad/cad-types'
import type { EditorToolState } from '../state/editor-domain-types'
import { useStitchActions } from './useStitchActions'

const feedback = vi.hoisted(() => ({ status: vi.fn() }))
vi.mock('../state/providers/EditorUIStateProvider', () => ({ useEditorUIActions: () => ({ setStatus: feedback.status }) }))
vi.mock('../state/providers/EditorToolStateProvider', () => ({
  useEditorToolSelector: (selector: (state: Partial<EditorToolState>) => unknown) => selector({
    stitchPitchMm: 4, stitchVariablePitchStartMm: 3, stitchVariablePitchEndMm: 5,
    stitchAutoPitchSettings: { defaultMode: 'fixed', forceFitLastHole: false, solverSteps: 6, precisionMm: 0.1, stopGapMm: 1, continueFromSelectedHole: false },
    stitchHoleDefaults: { holeType: 'round', diameterMm: 1.2, renderShape: 'round' },
  }),
}))
afterEach(() => feedback.status.mockClear())

function line(id: string, extra: Partial<LineShape> = {}): LineShape {
  return { id, type: 'line', layerId: 'L', lineTypeId: 'stitch', start: { x: 0, y: 0 }, end: { x: 20, y: 0 }, ...extra }
}
function hole(shapeId: string, chainId?: string): StitchHole {
  return { id: `hole-${shapeId}`, shapeId, chainId, point: { x: 0, y: 0 }, angleDeg: 0, sequence: 0, holeType: 'round', renderShape: 'round' }
}
function harness(shapes: LineShape[], initialHoles: StitchHole[], groups: SketchGroup[] = []) {
  let holes = initialHoles
  let actions: ReturnType<typeof useStitchActions>
  const update = vi.fn((value: SetStateAction<StitchHole[]>) => { holes = typeof value === 'function' ? value(holes) : value })
  const selected = new Set(shapes.map(shape => shape.id))
  function Harness() {
    actions = useStitchActions({ shapes, stitchHoles: holes, selectedShapeIdSet: selected, selectedStitchHoleCount: holes.length, setStitchHoles: update, setSelectedStitchHoleId() {}, lineTypesById: { stitch: { id: 'stitch', name: 'Stitch', role: 'stitch', style: 'solid', color: '#333', visible: true } }, selectedStitchHole: null, shapesById: Object.fromEntries(shapes.map(shape => [shape.id, shape])), layers: [{ id: 'L', name: 'Leather', visible: true, locked: false }, { id: 'locked-layer', name: 'Protected', visible: true, locked: true }], stitchHoleCountsByShape: {}, sketchGroups: groups })
    return createElement('button', { onClick: () => actions.handleClearAllStitchHoles() }, 'Clear')
  }
  const rendered = renderForTest(createElement(Harness))
  return { rendered, update, getHoles: () => holes, getActions: () => actions }
}

it('preserves holes on shape, ancestor-group and layer protected paths when clearing', () => {
  const groups = [{ id: 'parent', layerId: 'L', name: 'Parent', visible: true, locked: true }, { id: 'child', parentId: 'parent', layerId: 'L', name: 'Child', visible: true, locked: false }]
  const fixture = harness([line('own', { locked: true }), line('group', { groupId: 'child' }), line('layer', { layerId: 'locked-layer' }), line('editable')], ['own', 'group', 'layer', 'editable'].map(id => hole(id)), groups)
  click(fixture.rendered.container.querySelector('button'))
  expect(fixture.getHoles().map(entry => entry.shapeId)).toEqual(['own', 'group', 'layer'])
  cleanupRender(fixture.rendered)
})
it('protects the rest of a linked chain when a member path is locked', () => {
  const fixture = harness([line('protected', { locked: true }), line('linked'), line('other')], [hole('protected', 'shared'), hole('linked', 'shared'), hole('other')])
  act(() => fixture.getActions().handleDeleteStitchHolesOnSelectedShapes())
  expect(fixture.getHoles().map(entry => entry.shapeId)).toEqual(['protected', 'linked'])
  cleanupRender(fixture.rendered)
})
it('rejects excessive aggregate even-hole placement before changing any holes', () => {
  const fixture = harness(Array.from({ length: 11 }, (_, index) => line(`p${index}`)), [])
  act(() => fixture.getActions().handleAutoPlaceEvenlySpacedStitchHoles(10000))
  expect(fixture.update).not.toHaveBeenCalled()
  expect(feedback.status).toHaveBeenCalledWith(expect.stringContaining('at most 100000'))
  cleanupRender(fixture.rendered)
})
