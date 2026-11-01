import { describe, expect, it } from 'vitest'
import type { CubicShape, EllipseShape, LineShape } from '../../cad/cad-types'
import { nativeCurvePointAt } from '../../cad/native-curve-ops'
import { nativeCurveSubsegment } from './native-curve-editing'
import { extendLineToShape, nearestPointOnShape, shapesCoincide, trimShapeAtPoint } from './line-editing'
import { convertShapeToPathBeziers, stampTemplateAlongShape } from './path-editing'
import { evaluateShapeAt } from './path-core'

const cubic: CubicShape = { id: 'c', type: 'cubic', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, control1: { x: 100, y: 230 }, control2: { x: -45, y: 80 }, end: { x: 65, y: -20 }, strokeWidthOverride: 0.35, opacity: 0.6 }
const ellipse: EllipseShape = { id: 'e', type: 'ellipse', layerId: 'layer', lineTypeId: 'cut', center: { x: 20, y: -35 }, radiusX: 80, radiusY: 15, rotationDeg: 37, startAngleDeg: 12, sweepDeg: -270, opacity: 0.4 }

describe('native curve editing', () => {
  for (const curve of [cubic, ellipse]) {
    it(`retains exact ${curve.type} geometry when taking an arbitrary parameter interval`, () => {
      const part = nativeCurveSubsegment(curve, 0.17, 0.82)
      expect(part.type).toBe(curve.type)
      expect(part.opacity).toBe(curve.opacity)
      for (let index = 0; index <= 100; index++) {
        const actual = nativeCurvePointAt(part, index / 100), expected = nativeCurvePointAt(curve, 0.17 + index / 100 * 0.65)
        expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThan(1e-10)
      }
    })
    it(`trims ${curve.type} without demoting the primitive or losing its style`, () => {
      const cut = nativeCurvePointAt(curve, 0.37)
      const part = trimShapeAtPoint(curve, cut, 'start')
      expect(part.type).toBe(curve.type)
      expect(part.opacity).toBe(curve.opacity)
      const endpoint = evaluateShapeAt(part, 1)
      expect(Math.hypot(endpoint.x - cut.x, endpoint.y - cut.y)).toBeLessThan(1e-6)
      expect(nearestPointOnShape(curve, cut)?.distance).toBeLessThan(1e-6)
    })
  }
  it('only approximates native curves for an explicit convert-to-path operation', () => {
    const parts = convertShapeToPathBeziers(cubic)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((part) => part.type === 'bezier' && part.strokeWidthOverride === 0.35 && part.opacity === 0.6)).toBe(true)
    expect(cubic.type).toBe('cubic')
    const filled = { ...ellipse, fillColor: '#aabbcc' }
    expect(convertShapeToPathBeziers(filled)).toEqual([filled])
  })
  it('keeps a native curve intact when trimming at an existing endpoint', () => {
    expect(trimShapeAtPoint(ellipse, nativeCurvePointAt(ellipse, 0), 'start')).toEqual(ellipse)
    expect(trimShapeAtPoint(cubic, cubic.end, 'end')).toEqual(cubic)
  })
  it('keeps native geometry while stamping a template along a path', () => {
    const host: LineShape = { id: 'line', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, end: { x: 0, y: 100 } }
    const stamped = stampTemplateAlongShape(host, [cubic, ellipse], [25], { layerId: 'copies', lineTypeId: 'guide' })
    expect(stamped.map((shape) => shape.type)).toEqual(['cubic', 'ellipse'])
    expect(stamped.every((shape) => shape.layerId === 'copies')).toBe(true)
    expect(stamped[0].id).not.toBe(cubic.id)
    if (stamped[1].type !== 'ellipse') throw new Error('Expected native ellipse')
    expect(stamped[1].radiusX).toBeCloseTo(ellipse.radiusX)
    expect(stamped[1].radiusY).toBeCloseTo(ellipse.radiusY)
  })
  it('does not mistake a rotated partial ellipse for the opposite arc', () => {
    expect(shapesCoincide(ellipse, { ...ellipse, rotationDeg: ellipse.rotationDeg + 180 })).toBe(false)
    expect(shapesCoincide({ ...ellipse, sweepDeg: 360 }, { ...ellipse, rotationDeg: ellipse.rotationDeg + 180, sweepDeg: 360 })).toBe(true)
  })
  it('extends to an exact ellipse tangency that chord sampling can miss', () => {
    const target: EllipseShape = { ...ellipse, center: { x: 20, y: 0 }, radiusX: 5, radiusY: 3, rotationDeg: 0, startAngleDeg: 17, sweepDeg: 360 }
    const line: LineShape = { id: 'line', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 3 }, end: { x: 10, y: 3 } }
    const extended = extendLineToShape(line, target, 'end')
    expect(extended?.end.x).toBeCloseTo(20, 8)
    expect(extended?.end.y).toBeCloseTo(3, 8)
  })
})
