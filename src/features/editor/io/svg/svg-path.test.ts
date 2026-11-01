import { describe, expect, it } from 'vitest'
import { nativeCurvePointAt } from '../../cad/native-curve-ops'
import { parseNativeSvgPath } from './svg-path'
import { importSvgAsShapes } from '../io-svg'

describe('analytic SVG paths', () => {
  it('preserves absolute and relative cubic controls including smooth continuation', () => {
    const shapes = parseNativeSvgPath('M 10 20 c 1 30 40 -5 50 10 s 20 15 30 5', 'layer', 'cut')
    expect(shapes).toHaveLength(2)
    expect(shapes[0]).toMatchObject({ type: 'cubic', start: { x: 10, y: 20 }, control1: { x: 11, y: 50 }, control2: { x: 50, y: 15 }, end: { x: 60, y: 30 } })
    expect(shapes[1]).toMatchObject({ type: 'cubic', start: { x: 60, y: 30 }, control1: { x: 70, y: 45 }, control2: { x: 80, y: 45 }, end: { x: 90, y: 35 } })
  })
  it('preserves rotated elliptical arc endpoints and sweep instead of sampling chords', () => {
    const [shape] = parseNativeSvgPath('M 10 20 A 80 25 37 1 0 70 50', 'layer', 'cut')
    if (shape.type !== 'ellipse') throw new Error('Expected an analytic ellipse arc')
    expect(shape.rotationDeg).toBe(37)
    expect(shape.sweepDeg).toBeLessThan(-180)
    const start = nativeCurvePointAt(shape, 0), end = nativeCurvePointAt(shape, 1)
    expect(start.x).toBeCloseTo(10, 8); expect(start.y).toBeCloseTo(20, 8)
    expect(end.x).toBeCloseTo(70, 8); expect(end.y).toBeCloseTo(50, 8)
  })
  it('keeps native ellipses under nested nonuniform scale, skew and rotation', () => {
    const result = importSvgAsShapes('<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(12,5) scale(2,0.5)"><ellipse cx="20" cy="30" rx="40" ry="10" transform="rotate(37 20 30) skewX(10)" /></g></svg>', { layerId: 'layer', lineTypeId: 'cut' })
    expect(result.warnings).toEqual([])
    expect(result.shapes).toHaveLength(1)
    expect(result.shapes[0].type).toBe('ellipse')
    if (result.shapes[0].type !== 'ellipse') return
    expect(result.shapes[0].radiusX).toBeGreaterThan(0)
    expect(result.shapes[0].radiusY).toBeGreaterThan(0)
  })
  it('applies page units and nested transforms to every cubic control', () => {
    const result = importSvgAsShapes('<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="100mm" viewBox="0 0 100 50"><g transform="translate(5,3)"><path d="M10 10 C15 40 70 -10 80 20" /></g></svg>', { layerId: 'layer', lineTypeId: 'cut' })
    expect(result.warnings).toEqual([])
    expect(result.shapes[0]).toMatchObject({ type: 'cubic', start: { x: 30, y: 26 }, control1: { x: 40, y: 86 }, control2: { x: 150, y: -14 }, end: { x: 170, y: 46 } })
  })
  it('rejects malformed commands and flags without partial path output', () => {
    for (const data of ['M0 0 C1 2 3', 'M0 0 A10 10 0 2 0 20 0', 'M0 0 R10 10', 'M0 0 L1e400 2', 'M0 0 L nope nope']) expect(() => parseNativeSvgPath(data, 'layer', 'cut')).toThrow()
  })
})
