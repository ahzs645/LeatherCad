import { describe, expect, it } from 'vitest'
import type { CubicShape, EllipseShape, Shape, SketchGroup } from './cad-types'
import { nativeCurvePointAt } from './native-curve-ops'
import { applyDimensionBindings, measureDimension, type DimensionAnchor, type DimensionBinding } from './parametric-dimensions'

const ellipse: EllipseShape = { id: 'ellipse', type: 'ellipse', layerId: 'main', lineTypeId: 'cut', center: { x: 13, y: 27 }, radiusX: 30, radiusY: 10, rotationDeg: 25, startAngleDeg: 0, sweepDeg: 360, opacity: 0.5 }
const cubic: CubicShape = { id: 'cubic', type: 'cubic', layerId: 'main', lineTypeId: 'cut', start: { x: 2, y: 3 }, control1: { x: 5, y: 20 }, control2: { x: 70, y: -30 }, end: { x: 100, y: 2 } }
const binding = (shape: Shape, anchorFrom: DimensionAnchor, anchorTo: DimensionAnchor, axis: DimensionBinding['axis'] = 'distance', id = 'd'): DimensionBinding => ({ id, paramId: id, shapeId: shape.id, anchorFrom, anchorTo, axis })

describe('exact ellipse dimension anchors', () => {
  it('sets independent center-to-quarter and center-to-start radii on a rotated ellipse', () => {
    const a = binding(ellipse, 'center', 'start', 'distance', 'major'), b = binding(ellipse, 'center', 'quarter', 'distance', 'minor')
    const updated = applyDimensionBindings([ellipse], [a, b], new Map([['major', 60], ['minor', 25]]))[0]
    if (updated.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(updated.center.x).toBeCloseTo(ellipse.center.x, 8); expect(updated.center.y).toBeCloseTo(ellipse.center.y, 8)
    expect(measureDimension(updated, a)).toBeCloseTo(60, 7); expect(measureDimension(updated, b)).toBeCloseTo(25, 7)
    expect(updated.radiusX).toBeCloseTo(60, 7); expect(updated.radiusY).toBeCloseTo(25, 7)
    expect(updated.opacity).toBe(0.5); expect('start' in updated).toBe(false)
  })
  it.each([-220, 145])('fixes an elliptic arc source while changing endpoint distance at sweep %s', sweepDeg => {
    const original = { ...ellipse, sweepDeg, startAngleDeg: -15 }, b = binding(original, 'start', 'end'), start = nativeCurvePointAt(original, 0)
    const updated = applyDimensionBindings([original], [b], new Map([['d', 100]]))[0]
    if (updated.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(measureDimension(updated, b)).toBeCloseTo(100, 7)
    expect(nativeCurvePointAt(updated, 0).x).toBeCloseTo(start.x, 7); expect(nativeCurvePointAt(updated, 0).y).toBeCloseTo(start.y, 7)
    expect(updated.sweepDeg).toBe(sweepDeg)
  })
  it('supports a signed reflection dimension while keeping every parameter landmark analytic', () => {
    const original = { ...ellipse, rotationDeg: 0 }, b = binding(original, 'center', 'start', 'x')
    const updated = applyDimensionBindings([original], [b], new Map([['d', -60]]))[0]
    if (updated.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(measureDimension(updated, b)).toBeCloseTo(-60, 7)
    for (let i = 0; i <= 20; i++) {
      const before = nativeCurvePointAt(original, i / 20), after = nativeCurvePointAt(updated, i / 20)
      expect(after.x).toBeCloseTo(original.center.x - 2 * (before.x - original.center.x), 7)
      expect(after.y).toBeCloseTo(before.y, 7)
    }
    expect(updated.sweepDeg).toBe(-360)
  })
  it.each(['x', 'y'] as const)('allows zero %s projection without collapsing a radius', axis => {
    const original = { ...ellipse, rotationDeg: axis === 'x' ? 0 : 90 }, b = binding(original, 'center', 'start', axis)
    const updated = applyDimensionBindings([original], [b], new Map([['d', 0]]))[0]
    if (updated.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(measureDimension(updated, b)).toBeCloseTo(0, 7)
    expect(updated.radiusX).toBeGreaterThan(0); expect(updated.radiusY).toBeGreaterThan(0)
    expect(Math.hypot(nativeCurvePointAt(updated, 0).x - updated.center.x, nativeCurvePointAt(updated, 0).y - updated.center.y)).toBeCloseTo(30, 7)
  })
  it('measures quarter/threeQuarter landmarks along the actual partial sweep', () => {
    const original = { ...ellipse, sweepDeg: -120, startAngleDeg: 45 }, b = binding(original, 'quarter', 'threeQuarter')
    const from = nativeCurvePointAt(original, 0.25), to = nativeCurvePointAt(original, 0.75)
    expect(measureDimension(original, b)).toBeCloseTo(Math.hypot(to.x - from.x, to.y - from.y), 8)
  })
  it('rejects separating the coincident seam of a closed ellipse and collapsing a real radius', () => {
    expect(() => applyDimensionBindings([ellipse], [binding(ellipse, 'start', 'end')], new Map([['d', 10]]))).toThrow('Coincident ellipse landmarks')
    expect(() => applyDimensionBindings([ellipse], [binding(ellipse, 'center', 'start')], new Map([['d', 0]]))).toThrow('cannot collapse')
    expect(() => applyDimensionBindings([ellipse], [binding(ellipse, 'center', 'control2')], new Map([['d', 10]]))).toThrow('no control2 anchor')
  })
})

describe('cubic controls and virtual dimension anchors', () => {
  it.each(['control', 'control1', 'control2', 'mid', 'quarter', 'threeQuarter', 'center'] as const)('moves %s exactly while preserving its source anchor', anchor => {
    const b = binding(cubic, 'start', anchor, 'y'), updated = applyDimensionBindings([cubic], [b], new Map([['d', 40]]))[0]
    if (updated.type !== 'cubic') throw new Error('Expected cubic')
    expect(updated.start).toEqual(cubic.start)
    expect(measureDimension(updated, b)).toBeCloseTo(40, 7)
    if (anchor === 'control' || anchor === 'control1') expect(updated.control2).toEqual(cubic.control2)
    if (anchor === 'control2') expect(updated.control1).toEqual(cubic.control1)
  })
  it('keeps the actual cubic midpoint fixed while moving the endpoint', () => {
    const b = binding(cubic, 'mid', 'end', 'distance'), source = nativeCurvePointAt(cubic, 0.5)
    const updated = applyDimensionBindings([cubic], [b], new Map([['d', 150]]))[0]
    if (updated.type !== 'cubic') throw new Error('Expected cubic')
    expect(nativeCurvePointAt(updated, 0.5).x).toBeCloseTo(source.x, 7); expect(nativeCurvePointAt(updated, 0.5).y).toBeCloseTo(source.y, 7)
    expect(measureDimension(updated, b)).toBeCloseTo(150, 7)
  })
  it('sets both independent controls in one transaction', () => {
    const a = binding(cubic, 'start', 'control1', 'y', 'a'), b = binding(cubic, 'end', 'control2', 'x', 'b')
    const updated = applyDimensionBindings([cubic], [a, b], new Map([['a', 45], ['b', -20]]))[0]
    expect(measureDimension(updated, a)).toBeCloseTo(45, 7); expect(measureDimension(updated, b)).toBeCloseTo(-20, 7)
  })
  it('rejects nonzero distances between aliases of the same cubic anchor', () => {
    const b = binding(cubic, 'control', 'control1')
    expect(() => applyDimensionBindings([cubic], [b], new Map([['d', 10]]))).toThrow('Coincident cubic anchor definitions')
  })
})

describe('binding transactions, validation and inherited protection', () => {
  it.each([cubic, ellipse])('rejects inconsistent $type dimensions atomically', shape => {
    const original = structuredClone(shape), a = binding(shape, 'center', 'start', 'distance', 'one'), b = { ...a, id: 'two', paramId: 'two' }
    expect(() => applyDimensionBindings([shape], [a, b], new Map([['one', 20], ['two', 40]]), { maxIterations: 3 })).toThrow('Conflicting or nonconvergent')
    expect(shape).toEqual(original)
  })
  it('preserves own, parent group and layer locks; an already satisfied locked binding is allowed', () => {
    const groups: SketchGroup[] = [{ id: 'parent', name: 'P', layerId: 'main', visible: true, locked: true }, { id: 'child', name: 'C', parentId: 'parent', layerId: 'main', visible: true, locked: false }]
    const grouped = { ...ellipse, groupId: 'child' }, b = binding(grouped, 'center', 'start')
    for (const [shape, options] of [[{ ...grouped, locked: true }, {}], [grouped, { sketchGroups: groups }], [grouped, { layers: [{ id: 'main', name: 'Main', visible: true, locked: true }] }]] as const) {
      expect(() => applyDimensionBindings([shape], [b], new Map([['d', 60]]), options)).toThrow('locked shape')
      expect(applyDimensionBindings([shape], [b], new Map([['d', 30]]), options)[0]).toBe(shape)
    }
  })
  it.each([NaN, Infinity, -10])('rejects invalid Euclidean target %s', target => {
    expect(() => applyDimensionBindings([ellipse], [binding(ellipse, 'center', 'start')], new Map([['d', target]]))).toThrow('must be finite')
  })
  it('reports missing shape references and rejects out-of-bounds corrections', () => {
    expect(() => applyDimensionBindings([], [binding(ellipse, 'center', 'start')], new Map([['d', 10]]))).toThrow('missing shape')
    expect(() => applyDimensionBindings([cubic], [binding(cubic, 'start', 'control1')], new Map([['d', 1e12]]))).toThrow('valid geometry bounds')
  })
})
