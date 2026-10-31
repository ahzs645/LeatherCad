import { describe, expect, it } from 'vitest'
import type { CubicShape, EllipseShape, Layer, ParametricConstraint, Point, Shape, SketchGroup } from '../cad/cad-types'
import { nativeCurveBounds, nativeCurvePointAt, type NativeCurve } from '../cad/native-curve-ops'
import { applyDimensionBindings, measureDimension, type DimensionBinding } from '../cad/parametric-dimensions'
import { applyRedo, applyUndo, pushHistorySnapshot } from './history-ops'
import { mirrorShape, resizeShapeToDimensions, splitShapeIntoN } from './geometry/shape-transform'
import { applyParametricConstraints, getShapeAnchorPoint } from './pattern-ops'
import { copySelectionToClipboard, parseClipboardPayload, pasteClipboardPayload, serializeClipboardPayload, translateSelection } from './shape-selection-ops'
import { mirrorSelectionAcrossAxis, reverseShapePath, rotateSelectionAround, scaleSelectionNonUniform } from './transform-ops'

const cubic: CubicShape = { id: 'cubic', type: 'cubic', layerId: 'main', lineTypeId: 'cut', start: { x: 5, y: 4 }, control1: { x: 30, y: 80 }, control2: { x: 90, y: -15 }, end: { x: 105, y: 12 }, opacity: 0.4, strokeWidthOverride: 0.35, locked: false }
const ellipse: EllipseShape = { id: 'ellipse', type: 'ellipse', layerId: 'main', lineTypeId: 'cut', center: { x: 80, y: 40 }, radiusX: 35, radiusY: 12, rotationDeg: 31, startAngleDeg: -21, sweepDeg: 247, opacity: 0.7, strokeWidthOverride: 0.22, locked: false }
const selected = new Set([cubic.id, ellipse.id])
function native(shape: Shape): NativeCurve {
  if (shape.type !== 'cubic' && shape.type !== 'ellipse') throw new Error('Expected an analytic native curve')
  return shape
}
function expectGeometry(shape: Shape, source: NativeCurve, map: (point: Point) => Point) {
  const actual = native(shape)
  expect(actual.type).toBe(source.type)
  for (let index = 0; index <= 32; index++) {
    const expected = map(nativeCurvePointAt(source, index / 32)), point = nativeCurvePointAt(actual, index / 32)
    expect(point.x).toBeCloseTo(expected.x, 7)
    expect(point.y).toBeCloseTo(expected.y, 7)
  }
  expect(actual.opacity).toBe(source.opacity)
  expect(actual.strokeWidthOverride).toBe(source.strokeWidthOverride)
  expect(actual.locked).toBe(source.locked)
}

describe('native curve editing preserves analytic geometry', () => {
  it('moves every cubic control and the ellipse center without changing source records', () => {
    const before = structuredClone([cubic, ellipse])
    const moved = translateSelection([cubic, ellipse], selected, 13.25, -8.5)
    moved.forEach((shape, index) => expectGeometry(shape, before[index], point => ({ x: point.x + 13.25, y: point.y - 8.5 })))
    expect([cubic, ellipse]).toEqual(before)
  })
  it('rotates and nonuniformly scales a rotated elliptic arc while retaining its parameterization', () => {
    const scaled = scaleSelectionNonUniform([cubic, ellipse], selected, 2.3, 0.45, { x: -3, y: 7 })
    scaled.forEach((shape, index) => expectGeometry(shape, [cubic, ellipse][index], point => ({ x: -3 + (point.x + 3) * 2.3, y: 7 + (point.y - 7) * 0.45 })))
    const rotated = rotateSelectionAround([cubic, ellipse], selected, 90, { x: 2, y: 3 })
    rotated.forEach((shape, index) => expectGeometry(shape, [cubic, ellipse][index], point => ({ x: 2 - (point.y - 3), y: 3 + (point.x - 2) })))
  })
  it('mirrors twice across an arbitrary axis and reverses exact control order', () => {
    const mirrored = mirrorSelectionAcrossAxis([cubic, ellipse], selected, { x: 3, y: -4 }, 37)
    const twice = mirrorSelectionAcrossAxis(mirrored, selected, { x: 3, y: -4 }, 37)
    twice.forEach((shape, index) => expectGeometry(shape, [cubic, ellipse][index], point => point))
    const copied = mirrorShape(ellipse, { x: 0, y: 0 }, { x: 1, y: 0 })
    expectGeometry(copied, ellipse, point => ({ x: point.x, y: -point.y }))
    expect(copied.id).not.toBe(ellipse.id)
    for (const original of [cubic, ellipse]) {
      const reversed = native(reverseShapePath(original))
      for (let index = 0; index <= 16; index++) {
        const actual = nativeCurvePointAt(reversed, index / 16), expected = nativeCurvePointAt(original, 1 - index / 16)
        expect(actual.x).toBeCloseTo(expected.x, 8); expect(actual.y).toBeCloseTo(expected.y, 8)
      }
    }
  })
  it('resizes by actual curve bounds and splits without approximating either primitive', () => {
    for (const original of [cubic, ellipse]) {
      const resized = native(resizeShapeToDimensions(original, 120, 30)), bounds = nativeCurveBounds(resized)
      expect(bounds.maxX - bounds.minX).toBeCloseTo(120, 7)
      expect(bounds.maxY - bounds.minY).toBeCloseTo(30, 7)
      const segments = splitShapeIntoN(original, 4)
      expect(segments).toHaveLength(4)
      expect(new Set(segments.map(segment => segment.id)).size).toBe(4)
      for (let index = 0; index < 4; index++) {
        const segment = native(segments[index])
        for (let sample = 0; sample <= 8; sample++) {
          const actual = nativeCurvePointAt(segment, sample / 8), expected = nativeCurvePointAt(original, (index + sample / 8) / 4)
          expect(actual.x).toBeCloseTo(expected.x, 7); expect(actual.y).toBeCloseTo(expected.y, 7)
        }
        expect(segment.opacity).toBe(original.opacity)
      }
    }
  })
  it('copies, serializes and pastes native curves without shared control-point references', () => {
    const payload = copySelectionToClipboard([cubic, ellipse], [], [], [], [], [], [], [], selected)
    const copiedCubic = payload.shapes[0]
    if (copiedCubic.type !== 'cubic') throw new Error('Expected cubic copy')
    copiedCubic.control1.x += 1
    expect(cubic.control1.x).toBe(30)
    const parsed = parseClipboardPayload(serializeClipboardPayload(payload))
    if (!parsed) throw new Error('Clipboard roundtrip failed')
    const pasted = pasteClipboardPayload(parsed, { x: 9, y: 11 }, 'new-layer')
    pasted.shapes.forEach((shape, index) => {
      expectGeometry(shape, native(payload.shapes[index]), point => ({ x: point.x + 9, y: point.y + 11 }))
      expect(shape.id).not.toBe(payload.shapes[index].id)
      expect(shape.layerId).toBe('new-layer')
    })
  })
  it('rejects malformed native clipboard geometry before a paste can produce invalid coordinates', () => {
    const raw = JSON.stringify({ kind: 'leathercraft-shape-clipboard', version: 1, payload: { shapes: [{ ...ellipse, radiusX: -10 }], stitchHoles: [] } })
    expect(parseClipboardPayload(raw)).toBeNull()
  })
  it('undoes and redoes transformed analytic curves with all metadata and parameters intact', () => {
    const original = [cubic, ellipse], changed = scaleSelectionNonUniform(original, selected, 1.8, 0.7)
    const history = pushHistorySnapshot<Shape[]>({ past: [], future: [] }, original)
    const undo = applyUndo(history, changed)
    expect(undo.snapshot).toEqual(original)
    expect(undo.snapshot?.[0]).not.toBe(cubic)
    const redo = applyRedo(undo.history, undo.snapshot!)
    expect(redo.snapshot).toEqual(changed)
  })
})

describe('native anchors and constraints', () => {
  it('positions a cubic from an elliptic arc endpoint without changing its controls relative to the curve', () => {
    const constraint: ParametricConstraint = { id: 'align', name: 'Align endpoints', type: 'align', enabled: true, shapeId: cubic.id, referenceShapeId: ellipse.id, anchor: 'start', referenceAnchor: 'end', axis: 'both' }
    const layers: Layer[] = [{ id: 'main', name: 'Main', visible: true, locked: false, stackLevel: 0 }]
    const moved = applyParametricConstraints([cubic, ellipse], layers, [constraint])
    const target = getShapeAnchorPoint(ellipse, 'end'), delta = { x: target.x - cubic.start.x, y: target.y - cubic.start.y }
    expectGeometry(moved[0], cubic, point => ({ x: point.x + delta.x, y: point.y + delta.y }))
    const locked = { ...cubic, groupId: 'child' }
    const groups: SketchGroup[] = [{ id: 'parent', name: 'Locked parent', layerId: 'main', visible: true, locked: true }, { id: 'child', name: 'Child', layerId: 'main', parentId: 'parent', visible: true, locked: false }]
    expect(applyParametricConstraints([locked, ellipse], layers, [constraint], groups)[0]).toBe(locked)
    expect(applyParametricConstraints([{ ...cubic, locked: true }, ellipse], layers, [constraint])[0]).toEqual({ ...cubic, locked: true })
  })
  it('measures native virtual endpoints and rejects unsupported ellipse dimension mutation explicitly', () => {
    const binding: DimensionBinding = { id: 'dimension', paramId: 'width', shapeId: ellipse.id, anchorFrom: 'start', anchorTo: 'end', axis: 'distance' }
    const start = nativeCurvePointAt(ellipse, 0), end = nativeCurvePointAt(ellipse, 1)
    expect(measureDimension(ellipse, binding)).toBeCloseTo(Math.hypot(end.x - start.x, end.y - start.y), 8)
    expect(() => applyDimensionBindings([ellipse], [binding], new Map([['width', 100]]))).toThrow('virtual anchors')
    const updated = applyDimensionBindings([cubic], [{ ...binding, shapeId: cubic.id, anchorTo: 'control', axis: 'y' }], new Map([['width', 20]]))[0]
    if (updated.type !== 'cubic') throw new Error('Expected cubic')
    expect(updated.control1.y).toBe(cubic.start.y + 20)
    expect(updated.control2).toEqual(cubic.control2)
  })
})
