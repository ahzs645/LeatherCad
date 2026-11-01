import { describe, expect, it } from 'vitest'
import type { ArcShape, CubicShape, EllipseShape, LineShape, Point, Shape, SketchGroup } from '../cad/cad-types'
import { nativeCurvePointAt, nativeCurveTangentAt } from '../cad/native-curve-ops'
import { applyRedo, applyUndo, pushHistorySnapshot } from '../ops/history-ops'
import { solveConstraints, getAnchorPoint, type SolverConstraint } from './constraint-solver'

const cubic: CubicShape = { id: 'c', type: 'cubic', layerId: 'main', lineTypeId: 'cut', opacity: 0.7, start: { x: 0, y: 0 }, control1: { x: 0, y: 100 }, control2: { x: 100, y: 100 }, end: { x: 100, y: 0 } }
const ellipse: EllipseShape = { id: 'e', type: 'ellipse', layerId: 'main', lineTypeId: 'cut', center: { x: 40, y: 50 }, radiusX: 30, radiusY: 10, rotationDeg: 35, startAngleDeg: 20, sweepDeg: -220 }
const line = (id = 'line', length = 100): LineShape => ({ id, type: 'line', layerId: 'main', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: length, y: 0 } })
const cross = (a: Point, b: Point) => (a.x * b.y - a.y * b.x) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y))
const chord = (shape: Shape) => { const a = getAnchorPoint(shape, 'start'), b = getAnchorPoint(shape, 'end'); return { x: b.x - a.x, y: b.y - a.y } }
function solved(shapes: Shape[], constraint: SolverConstraint): Shape[] {
  const result = solveConstraints(shapes, [constraint])
  expect(result.conflicts).toEqual([])
  expect(result.converged).toBe(true)
  return shapes.map(shape => result.shapeUpdates.get(shape.id) ?? shape)
}
function sampledLength(shape: CubicShape | EllipseShape): number {
  let total = 0, previous = nativeCurvePointAt(shape, 0)
  for (let i = 1; i <= 20000; i++) {
    const p = nativeCurvePointAt(shape, i / 20000)
    total += Math.hypot(p.x - previous.x, p.y - previous.y); previous = p
  }
  return total
}

describe('native directional constraints', () => {
  it.each([cubic, ellipse])('rigidly aligns $type vertically with analytic controls, length and metadata intact', original => {
    const moved = solved([original], { id: 'v', type: 'vertical', shapeId: original.id })[0]
    expect(moved.type).toBe(original.type)
    expect(Math.abs(chord(moved).x)).toBeLessThan(1e-8)
    if (moved.type !== 'cubic' && moved.type !== 'ellipse') throw new Error('Expected native curve')
    expect(sampledLength(moved)).toBeCloseTo(sampledLength(original), 6)
    expect(moved.opacity).toBe(original.opacity)
    expect(original).not.toBe(moved)
  })
  it.each(['parallel', 'perpendicular', 'angle'] as const)('solves %s between cubic and elliptic chords with either fixed reference', type => {
    for (const lockA of [true, false]) {
      const a = { ...cubic, locked: lockA }, b = { ...ellipse, locked: !lockA }
      const result = solved([a, b], type === 'angle' ? { id: 'rel', type, shapeIdA: a.id, shapeIdB: b.id, targetAngleDeg: 37 } : { id: 'rel', type, shapeIdA: a.id, shapeIdB: b.id })
      const da = chord(result[0]), db = chord(result[1]), angle = Math.atan2(da.x * db.y - da.y * db.x, da.x * db.x + da.y * db.y) * 180 / Math.PI
      if (type === 'parallel') expect(Math.abs(cross(da, db))).toBeLessThan(1e-8)
      else if (type === 'perpendicular') expect(Math.abs(angle)).toBeCloseTo(90, 7)
      else expect(angle).toBeCloseTo(37, 7)
      expect(result[lockA ? 0 : 1]).toBe(lockA ? a : b)
    }
  })
  it('aligns the major axis of a closed ellipse and treats axis angles modulo 180', () => {
    const closed = { ...ellipse, sweepDeg: 360 }
    const moved = solved([closed], { id: 'h', type: 'horizontal', shapeId: closed.id })[0]
    if (moved.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(Math.sin(moved.rotationDeg * Math.PI / 180)).toBeCloseTo(0, 8)
    expect(moved.radiusX).toBeCloseTo(30); expect(moved.radiusY).toBeCloseTo(10)
    const axis = { ...line('axis'), locked: true }
    const angled = solved([axis, closed], { id: 'a', type: 'angle', shapeIdA: axis.id, shapeIdB: closed.id, targetAngleDeg: 120 })[1]
    if (angled.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(Math.sin((angled.rotationDeg - 120) * Math.PI / 180)).toBeCloseTo(0, 8)
  })
  it.each([{ ...ellipse, radiusY: 30, sweepDeg: 360 }, { ...cubic, end: cubic.start }])('rejects ambiguous closed directions for $type', curve => {
    const result = solveConstraints([curve], [{ id: 'h', type: 'horizontal', shapeId: curve.id }])
    expect(result.converged).toBe(false); expect(result.shapeUpdates.size).toBe(0)
    expect(result.conflicts.join(' ')).toContain('no unique direction')
  })
  it('does not rotate inherited group or layer locks and reports an actual unsatisfied constraint', () => {
    const grouped = { ...ellipse, groupId: 'child' }, groups: SketchGroup[] = [{ id: 'parent', name: 'Parent', layerId: 'main', visible: true, locked: true }, { id: 'child', name: 'Child', layerId: 'main', visible: true, locked: false, parentId: 'parent' }]
    for (const access of [{ sketchGroups: groups }, { layers: [{ id: 'main', name: 'Main', visible: true, locked: true }] }]) {
      const result = solveConstraints([grouped], [{ id: 'h', type: 'horizontal', shapeId: grouped.id }], 2, 0.001, access)
      expect(result.converged).toBe(false); expect(result.shapeUpdates.size).toBe(0)
      expect(result.conflicts.join(' ')).toContain('locked shapes')
    }
  })
})

describe('analytic endpoint tangency', () => {
  it.each([cubic, ellipse])('fixes tangent direction even when $type endpoints already touch', native => {
    const contact = nativeCurvePointAt(native, 0)
    const fixed: LineShape = { ...line(), locked: true, start: { x: contact.x - 50, y: contact.y }, end: contact }
    const result = solved([fixed, native], { id: 't', type: 'tangent', shapeIdA: fixed.id, shapeIdB: native.id, anchorA: 'end', anchorB: 'start' })
    const curve = result[1]
    if (curve.type !== 'cubic' && curve.type !== 'ellipse') throw new Error('Expected native')
    const start = nativeCurvePointAt(curve, 0)
    expect(start.x).toBeCloseTo(contact.x, 7); expect(start.y).toBeCloseTo(contact.y, 7)
    expect(Math.abs(cross(nativeCurveTangentAt(curve, 0), { x: 1, y: 0 }))).toBeLessThan(1e-8)
    expect(sampledLength(curve)).toBeCloseTo(sampledLength(native), 6)
    expect(result[0]).toBe(fixed)
  })
  it('joins two native endpoints and rotates the free reference when the second curve is locked', () => {
    const fixed = { ...ellipse, locked: true }, moved = solved([cubic, fixed], { id: 't', type: 'tangent', shapeIdA: cubic.id, shapeIdB: fixed.id, anchorA: 'end', anchorB: 'start' })[0]
    if (moved.type !== 'cubic') throw new Error('Expected cubic')
    const a = nativeCurvePointAt(moved, 1), b = nativeCurvePointAt(fixed, 0)
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-8)
    expect(Math.abs(cross(nativeCurveTangentAt(moved, 1), nativeCurveTangentAt(fixed, 0)))).toBeLessThan(1e-8)
  })
  it('uses circular arc tangents rather than the endpoint chord', () => {
    const arc: ArcShape = { ...line('arc'), type: 'arc', start: { x: 0, y: -10 }, mid: { x: 10, y: 0 }, end: { x: 0, y: 10 }, locked: true }
    const moved = solved([arc, cubic], { id: 't', type: 'tangent', shapeIdA: arc.id, shapeIdB: cubic.id, anchorA: 'end', anchorB: 'start' })[1]
    if (moved.type !== 'cubic') throw new Error('Expected cubic')
    expect(moved.start.x).toBeCloseTo(0, 7); expect(moved.start.y).toBeCloseTo(10, 7)
    expect(nativeCurveTangentAt(moved, 0).y).toBeCloseTo(0, 7)
  })
  it('supports the limiting tangent of a cubic with a repeated endpoint control', () => {
    const repeated = { ...cubic, control1: cubic.start }, reference = { ...line(), locked: true }
    const moved = solved([reference, repeated], { id: 't', type: 'tangent', shapeIdA: reference.id, shapeIdB: repeated.id, anchorA: 'end', anchorB: 'start' })[1]
    if (moved.type !== 'cubic') throw new Error('Expected cubic')
    expect(moved.control1).toEqual(moved.start)
    expect(moved.control2.y).toBeCloseTo(moved.start.y, 7)
  })
  it('can join a closed circle at its parameter seam despite its ambiguous major axis', () => {
    const circle = { ...ellipse, radiusY: 30, sweepDeg: 360 }, fixed = { ...line(), locked: true }
    const moved = solved([fixed, circle], { id: 't', type: 'tangent', shapeIdA: fixed.id, shapeIdB: circle.id, anchorA: 'end', anchorB: 'start' })[1]
    if (moved.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(nativeCurvePointAt(moved, 0).x).toBeCloseTo(100, 7)
    expect(nativeCurveTangentAt(moved, 0).y).toBeCloseTo(0, 7)
  })
  it('selects the closest endpoint pair once when explicit anchors are omitted', () => {
    const fixed = { ...line(), locked: true }, nearby = { ...cubic, start: { x: 101, y: 1 }, control1: { x: 101, y: 30 }, end: { x: 200, y: 50 } }
    const moved = solved([fixed, nearby], { id: 't', type: 'tangent', shapeIdA: fixed.id, shapeIdB: nearby.id })[1]
    if (moved.type !== 'cubic') throw new Error('Expected cubic')
    expect(moved.start.x).toBeCloseTo(100, 7); expect(moved.start.y).toBeCloseTo(0, 7)
    expect(nativeCurveTangentAt(moved, 0).y).toBeCloseTo(0, 7)
  })
  it('rejects collapsed tangent geometry and unsatisfied locked tangents', () => {
    const zero = { ...cubic, control1: cubic.start, control2: cubic.start, end: cubic.start }
    const invalid = solveConstraints([line(), zero], [{ id: 't', type: 'tangent', shapeIdA: 'line', shapeIdB: zero.id }])
    expect(invalid.converged).toBe(false); expect(invalid.conflicts.join(' ')).toContain('no tangent')
    const locked = solveConstraints([{ ...line(), locked: true }, { ...cubic, locked: true }], [{ id: 't', type: 'tangent', shapeIdA: 'line', shapeIdB: cubic.id }], 2)
    expect(locked.converged).toBe(false); expect(locked.shapeUpdates.size).toBe(0)
  })
})

describe('curve length, reflections, complete updates and failures', () => {
  it('matches true cubic arc length rather than its chord', () => {
    // This symmetric cubic has analytic length 200 mm, chord 100 mm.
    const fixed = { ...line('ref', 100), locked: true }, moved = solved([fixed, cubic], { id: 'l', type: 'equal-length', shapeIdA: fixed.id, shapeIdB: cubic.id })[1]
    if (moved.type !== 'cubic') throw new Error('Expected cubic')
    expect(sampledLength(moved)).toBeCloseTo(100, 5)
    expect(Math.hypot(chord(moved).x, chord(moved).y)).toBeCloseTo(50, 7)
    expect(moved.opacity).toBe(0.7)
  })
  it('uses the analytic circle perimeter even when the endpoint chord is zero', () => {
    const circle = { ...ellipse, radiusX: 10, radiusY: 10, sweepDeg: 360 }, reference = { ...line('ref', 20 * Math.PI), locked: true }
    const result = solveConstraints([reference, circle], [{ id: 'l', type: 'equal-length', shapeIdA: reference.id, shapeIdB: circle.id }])
    expect(result.converged).toBe(true); expect(result.shapeUpdates.size).toBe(0)
  })
  it('satisfies tangent plus equal-length projections on the same native pair', () => {
    const fixed = { ...line('ref', 80), locked: true }, result = solveConstraints([fixed, ellipse], [
      { id: 't', type: 'tangent', shapeIdA: fixed.id, shapeIdB: ellipse.id, anchorA: 'end', anchorB: 'start' },
      { id: 'l', type: 'equal-length', shapeIdA: fixed.id, shapeIdB: ellipse.id },
    ])
    expect(result.converged).toBe(true); expect(result.conflicts).toEqual([])
    const moved = result.shapeUpdates.get(ellipse.id)
    if (moved?.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(sampledLength(moved)).toBeCloseTo(80, 5)
    expect(nativeCurvePointAt(moved, 0).x).toBeCloseTo(80, 7); expect(nativeCurvePointAt(moved, 0).y).toBeCloseTo(0, 7)
    expect(nativeCurveTangentAt(moved, 0).y).toBeCloseTo(0, 7)
    expect(result.iterations).toBeGreaterThan(1)
  })
  it.each([ellipse, { ...ellipse, sweepDeg: 360 }, { ...ellipse, radiusY: 30, sweepDeg: -180 }])('equalizes elliptic length for sweep $sweepDeg without flattening', curve => {
    const fixed = { ...line('ref', 75), locked: true }, moved = solved([curve, fixed], { id: 'l', type: 'equal-length', shapeIdA: curve.id, shapeIdB: fixed.id })[0]
    if (moved.type !== 'ellipse') throw new Error('Expected ellipse')
    expect(sampledLength(moved)).toBeCloseTo(75, 5)
    expect(moved.radiusX / moved.radiusY).toBeCloseTo(curve.radiusX / curve.radiusY, 8)
  })
  it('supports a closed ellipse major axis as an independent symmetry reference', () => {
    const axis = { ...ellipse, id: 'axis', center: { x: 0, y: 0 }, rotationDeg: 0, sweepDeg: 360, locked: true }, fixed = { ...cubic, locked: true }
    const moved = solved([fixed, ellipse, axis], { id: 's', type: 'symmetric', shapeIdA: fixed.id, anchorA: 'end', shapeIdB: ellipse.id, anchorB: 'start', axisShapeId: axis.id })[1]
    expect(getAnchorPoint(moved, 'start').x).toBeCloseTo(100, 7)
    expect(getAnchorPoint(moved, 'start').y).toBeCloseTo(0, 7)
  })
  it('undoes and redoes complete native solver updates', () => {
    const initial: Shape[] = [cubic, ellipse], updated = solved(initial, { id: 'p', type: 'perpendicular', shapeIdA: cubic.id, shapeIdB: ellipse.id })
    const history = pushHistorySnapshot<Shape[]>({ past: [], future: [] }, initial), undo = applyUndo(history, updated), redo = applyRedo(undo.history, undo.snapshot!)
    expect(undo.snapshot).toEqual(initial); expect(redo.snapshot).toEqual(updated)
  })
  it('does not report conflicting horizontal/vertical relations as converged', () => {
    const result = solveConstraints([cubic], [{ id: 'h', type: 'horizontal', shapeId: cubic.id }, { id: 'v', type: 'vertical', shapeId: cubic.id }], 3)
    expect(result.converged).toBe(false); expect(result.residual).toBeCloseTo(90)
    expect(result.conflicts.join(' ')).toContain('h')
  })
  it.each([
    { id: 'bad', type: 'distance', shapeIdA: 'c', anchorA: 'start', shapeIdB: 'e', anchorB: 'end', targetDistance: -1 },
    { id: 'bad', type: 'angle', shapeIdA: 'c', shapeIdB: 'e', targetAngleDeg: Infinity },
    { id: 'bad', type: 'horizontal', shapeId: 'missing' },
  ] satisfies SolverConstraint[])('rejects invalid $type references or values explicitly', constraint => {
    const result = solveConstraints([cubic, ellipse], [constraint])
    expect(result.converged).toBe(false); expect(result.shapeUpdates.size).toBe(0)
    expect(result.conflicts.join(' ')).toContain('bad')
  })
  it('reports unsupported self-relations and zero-length inflation without partial corrections', () => {
    const same = solveConstraints([ellipse], [{ id: 'self', type: 'distance', shapeIdA: ellipse.id, anchorA: 'start', shapeIdB: ellipse.id, anchorB: 'end', targetDistance: 100 }])
    expect(same.converged).toBe(false); expect(same.shapeUpdates.size).toBe(0)
    expect(same.conflicts.join(' ')).toContain('self-relation')
    const zero = line('zero', 0), nonzero = line('nonzero', 10)
    const inflate = solveConstraints([zero, nonzero], [{ id: 'length', type: 'equal-length', shapeIdA: zero.id, shapeIdB: nonzero.id }])
    expect(inflate.converged).toBe(false); expect(inflate.shapeUpdates.size).toBe(0)
    expect(inflate.conflicts.join(' ')).toContain('zero-length')
  })
})
