import { act, createElement, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, renderForTest } from '../../../../test/render'
import type { CubicShape, EllipseShape, Shape } from '../../cad/cad-types'
import { useCanvasShapeDragInteractions } from './useCanvasShapeDragInteractions'

const cubic: CubicShape = { id: 'curve', type: 'cubic', layerId: 'main', lineTypeId: 'cut', start: { x: 1, y: 2 }, control1: { x: 3, y: 10 }, control2: { x: 9, y: 12 }, end: { x: 20, y: 2 }, opacity: 0.5 }
const ellipse: EllipseShape = { id: 'curve', type: 'ellipse', layerId: 'main', lineTypeId: 'cut', center: { x: 20, y: 30 }, radiusX: 12, radiusY: 5, rotationDeg: 31, startAngleDeg: 10, sweepDeg: 270 }
let rendered: ReturnType<typeof renderForTest> | null = null
afterEach(() => { cleanupRender(rendered); rendered = null })
function pointer(x: number, y: number, shiftKey = false) {
  return { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, shiftKey, stopPropagation: vi.fn(), currentTarget: { setPointerCapture: vi.fn() } } as unknown as ReactPointerEvent<SVGSVGElement> & ReactPointerEvent<SVGCircleElement>
}
function mount(initial: Shape) {
  let actions!: ReturnType<typeof useCanvasShapeDragInteractions>, current: Shape[] = []
  function Harness() {
    const [shapes, setShapes] = useState([initial]); current = shapes
    actions = useCanvasShapeDragInteractions({ tool: 'pan', selectedShapeIds: ['curve'], shapesById: { curve: shapes[0] }, setShapes,
      setSelectedShapeIds: vi.fn(), setSelectedStitchHoleId: vi.fn(), setSelectedHardwareMarkerId: vi.fn(), setCursorPoint: vi.fn(), setStatus: vi.fn(),
      toWorldPoint: (x, y) => ({ x, y }), getSnappedPoint: point => ({ point }) })
    return createElement('output', null, shapes[0].type)
  }
  rendered = renderForTest(createElement(Harness))
  return { actions: () => actions, shape: () => current[0] }
}
describe('native curve pointer editing', () => {
  it('moves the adjacent cubic control with an endpoint and advertises the same preview', () => {
    const view = mount(cubic)
    act(() => { view.actions().handleShapeHandlePointerDown(pointer(1, 2), 'curve', 'start') })
    act(() => { view.actions().handleDragPointerMove(pointer(12, 15)) })
    expect(view.actions().interactionPreview).toMatchObject({ kind: 'handle', pointKey: 'start', followControl: true })
    act(() => { view.actions().handleDragPointerUp(pointer(12, 15)) })
    const shape = view.shape()
    if (shape.type !== 'cubic') throw new Error('Expected cubic')
    expect(shape.start).toEqual({ x: 12, y: 15 })
    expect(shape.control1).toEqual({ x: 14, y: 23 })
    expect(shape.control2).toEqual(cubic.control2)
    expect(shape.opacity).toBe(0.5)
  })
  it('keeps controls fixed when Shift is held and edits a cubic control independently', () => {
    const view = mount(cubic)
    act(() => { view.actions().handleShapeHandlePointerDown(pointer(1, 2), 'curve', 'start') })
    act(() => { view.actions().handleDragPointerMove(pointer(12, 15, true)) })
    act(() => { view.actions().handleDragPointerUp(pointer(12, 15, true)) })
    let shape = view.shape()
    if (shape.type !== 'cubic') throw new Error('Expected cubic')
    expect(shape.control1).toEqual(cubic.control1)
    act(() => { view.actions().handleShapeHandlePointerDown(pointer(9, 12), 'curve', 'control2') })
    act(() => { view.actions().handleDragPointerMove(pointer(44, 55)) })
    act(() => { view.actions().handleDragPointerUp(pointer(44, 55)) })
    shape = view.shape()
    if (shape.type !== 'cubic') throw new Error('Expected cubic')
    expect(shape.control2).toEqual({ x: 44, y: 55 })
    expect(shape.start).toEqual({ x: 12, y: 15 })
  })
  it('moves an ellipse by its center without adding synthetic endpoint fields', () => {
    const view = mount(ellipse)
    act(() => { view.actions().handleShapeHandlePointerDown(pointer(20, 30), 'curve', 'center') })
    act(() => { view.actions().handleDragPointerMove(pointer(60, 70)) })
    act(() => { view.actions().handleDragPointerUp(pointer(60, 70)) })
    expect(view.shape()).toEqual({ ...ellipse, center: { x: 60, y: 70 } })
    expect('start' in view.shape()).toBe(false)
    expect('end' in view.shape()).toBe(false)
  })
  it('does not start a handle drag on an individually locked curve', () => {
    const locked = { ...cubic, locked: true }, view = mount(locked)
    act(() => { view.actions().handleShapeHandlePointerDown(pointer(1, 2), 'curve', 'control1') })
    act(() => { view.actions().handleDragPointerMove(pointer(60, 70)) })
    act(() => { view.actions().handleDragPointerUp(pointer(60, 70)) })
    expect(view.shape()).toBe(locked)
    expect(view.actions().interactionPreview).toBeNull()
  })
})
