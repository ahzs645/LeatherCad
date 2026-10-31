import { describe, expect, it, vi } from 'vitest'
import type { Point, Shape } from '../cad/cad-types'
import type { ToolRuntime } from './tool-types'
import { executeToolCommand, executeToolPointerDown } from './tool-executor'

function drawingRuntime() {
  let shapes: Shape[] = []
  const runtime = {
    activeLayerId: 'layer', activeLineTypeId: 'cut', activeSketchGroup: null, draftPoints: [],
    ensureActiveLayerWritable: () => true, ensureActiveLineTypeWritable: () => true,
    toolSession: { setReferencePoint: vi.fn() }, setStatus: vi.fn(), setActiveTool: vi.fn(),
    setShapes: (next: Shape[] | ((previous: Shape[]) => Shape[])) => { shapes = typeof next === 'function' ? next(shapes) : next },
    setDraftPoints: (next: Point[] | ((previous: Point[]) => Point[])) => { runtime.draftPoints = typeof next === 'function' ? next(runtime.draftPoints) : next },
    clearDraft: () => { runtime.draftPoints = [] },
  } as unknown as ToolRuntime
  return { runtime, shapes: () => shapes }
}

describe('native drawing tools', () => {
  it('creates one exact ellipse instead of a polygon from two picked points', () => {
    const { runtime, shapes } = drawingRuntime()
    executeToolPointerDown('ellipse', { x: 12, y: 34 }, runtime)
    executeToolPointerDown('ellipse', { x: -18, y: 44 }, runtime)
    expect(shapes()).toHaveLength(1)
    expect(shapes()[0]).toMatchObject({ type: 'ellipse', center: { x: 12, y: 34 }, radiusX: 30, radiusY: 10, rotationDeg: 0, startAngleDeg: 0, sweepDeg: 360 })
    expect(runtime.draftPoints).toEqual([])
  })
  it('preserves both independently chosen cubic controls across the complete command path', () => {
    const { runtime, shapes } = drawingRuntime()
    const points = [{ x: 0, y: 0 }, { x: 7, y: 93 }, { x: 120, y: -38 }, { x: 80, y: 50 }]
    for (const point of points) executeToolPointerDown('cubic', point, runtime)
    expect(shapes()).toHaveLength(1)
    expect(shapes()[0]).toMatchObject({ type: 'cubic', start: points[0], control1: points[1], control2: points[2], end: points[3] })
    expect(runtime.draftPoints).toEqual([])
    expect(executeToolCommand('pan', 'cubic', runtime)).toBe('Tool selected: cubic')
    expect(runtime.setActiveTool).toHaveBeenCalledWith('cubic')
  })
  it('does not add a collapsed ellipse or a zero-size cubic', () => {
    const { runtime, shapes } = drawingRuntime()
    executeToolPointerDown('ellipse', { x: 0, y: 0 }, runtime)
    executeToolPointerDown('ellipse', { x: 20, y: 0 }, runtime)
    for (let index = 0; index < 4; index++) executeToolPointerDown('cubic', { x: 0, y: 0 }, runtime)
    expect(shapes()).toEqual([])
  })
})
