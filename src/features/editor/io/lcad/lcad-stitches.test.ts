import { describe, expect, it } from 'vitest'
import type { StitchHole } from '../../cad/cad-types'
import { createStitchHolePrimitive } from '../../ops/stitch-hole-render'
import { exportLcadStitchParameters, importLcadStitchParameters } from './lcad-stitches'

const holeFor = (native: Record<string, unknown>): StitchHole => ({ id: 'hole', shapeId: 'anchor', sequence: 0, point: { x: 3, y: 4 }, ...importLcadStitchParameters(native) })
const rotate = (x: number, y: number, degrees: number) => ({ x: 3 + x * Math.cos(degrees * Math.PI / 180) - y * Math.sin(degrees * Math.PI / 180), y: 4 + x * Math.sin(degrees * Math.PI / 180) + y * Math.cos(degrees * Math.PI / 180) })

describe('LCAD stitch blade geometry', () => {
  it.each([
    { angle: 0, holeTilt: undefined, inverted: false, effective: -32 },
    { angle: Math.PI / 6, holeTilt: 35, inverted: true, effective: 65 },
    { angle: -Math.PI / 2, holeTilt: 0, inverted: false, effective: -90 },
  ])('preserves diamond polygon vertices including default/custom tilt and inversion: $effective degrees', (source) => {
    const hole = holeFor({ stitchType: 'diamond', holeW: 0.8, holeL: 2.4, ...source })
    const primitive = createStitchHolePrimitive(hole)
    expect(primitive.kind).toBe('polygon')
    if (primitive.kind !== 'polygon') throw new Error('Expected diamond polygon')
    // Native diamond long axis is X; its four corners precede rotation.
    const expected = [[1.2, 0], [0, 0.4], [-1.2, 0], [0, -0.4]].map(([x, y]) => rotate(x, y, source.effective))
    for (const point of expected) expect(Math.min(...primitive.points.map(actual => Math.hypot(actual.x - point.x, actual.y - point.y)))).toBeLessThan(1e-10)
    const roundTrip = createStitchHolePrimitive(holeFor(exportLcadStitchParameters(hole)))
    expect(roundTrip).toEqual(primitive)
  })

  it.each([
    { stitchType: 'european', expectedAngle: -15, width: 0.25, inverted: false },
    { stitchType: 'european', expectedAngle: 75, width: 0.25, inverted: true },
    { stitchType: 'flat', expectedAngle: 120, width: 0.3, inverted: false },
  ])('preserves $stitchType blade axis and dimensions at $expectedAngle degrees', (source) => {
    const hole = holeFor({ angle: Math.PI / 6, ...source })
    const primitive = createStitchHolePrimitive(hole)
    expect(primitive.kind).toBe('segment')
    if (primitive.kind !== 'segment') throw new Error('Expected blade segment')
    const endpoint = rotate(1, 0, source.expectedAngle)
    expect(primitive.end.x).toBeCloseTo(endpoint.x, 10)
    expect(primitive.end.y).toBeCloseTo(endpoint.y, 10)
    expect(primitive.strokeWidthMm).toBe(source.width)
    const roundTrip = createStitchHolePrimitive(holeFor(exportLcadStitchParameters(hole)))
    expect(roundTrip).toEqual(primitive)
  })

  it('preserves an editor flat blade with a nonzero tilt by folding tilt into native angle', () => {
    const original: StitchHole = { id: 'hole', shapeId: 'anchor', sequence: 0, point: { x: 3, y: 4 }, holeType: 'slit', renderShape: 'flat', angleDeg: 12, tiltDeg: 27, inverted: true, widthMm: 0.7, heightMm: 3 }
    const roundTrip = holeFor(exportLcadStitchParameters(original))
    expect(createStitchHolePrimitive(roundTrip)).toEqual(createStitchHolePrimitive(original))
  })

  it('honors native zero-means-default dimensions and rejects unsupported zero-width export', () => {
    expect(importLcadStitchParameters({ stitchType: 'diamond', holeW: 0, holeL: 0 })).toMatchObject({ widthMm: 0.6, heightMm: 2.2, tiltDeg: -32 })
    const zero = { ...holeFor({ stitchType: 'flat' }), widthMm: 0 }
    expect(() => exportLcadStitchParameters(zero)).toThrow('zero-width stitch blade')
    expect(() => importLcadStitchParameters({ stitchType: 'diamond', holeTilt: 91 })).toThrow('0–90')
  })
})
