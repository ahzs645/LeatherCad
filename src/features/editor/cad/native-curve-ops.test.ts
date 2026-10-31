import { describe, expect, it } from 'vitest'
import type { CubicShape, EllipseShape } from './cad-types'
import { nativeCurveBounds, nativeCurvePath, nativeCurvePointAt, nativeCurveToEditable, transformNativeCurve } from './native-curve-ops'
import { parseImportedJsonDocument } from '../editor-json-import'
import { exportLcadDocument, importLcadDocument } from '../io/io-lcad'

const cubic: CubicShape = { id: 'c', type: 'cubic', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, control1: { x: 0, y: 100 }, control2: { x: 100, y: 100 }, end: { x: 100, y: 0 } }
const ellipse: EllipseShape = { id: 'e', type: 'ellipse', layerId: 'layer', lineTypeId: 'cut', center: { x: 5, y: 8 }, radiusX: 10, radiusY: 2, rotationDeg: 45, startAngleDeg: 0, sweepDeg: 360 }

describe('native analytic curve geometry', () => {
  it('evaluates and bounds cubics and rotated ellipses analytically', () => {
    expect(nativeCurvePointAt(cubic, 0.5)).toEqual({ x: 50, y: 75 })
    expect(nativeCurveBounds(cubic)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 75 })
    const bounds = nativeCurveBounds(ellipse), extent = Math.sqrt(52)
    expect(bounds.minX).toBeCloseTo(5 - extent, 10)
    expect(bounds.maxY).toBeCloseTo(8 + extent, 10)
    expect(nativeCurvePath(cubic)).toContain(' C ')
    expect(nativeCurvePath(ellipse).match(/ A /g)).toHaveLength(2)
  })

  it('preserves every sampled point under affine shear, reflection and anisotropic scale', () => {
    for (const shape of [cubic, ellipse, { ...ellipse, startAngleDeg: 31, sweepDeg: -225 }]) {
      for (const matrix of [[1, 0.3, 0.5, 2, 7, -4], [-2, 0, 0, 0.5, 1, 6], [0, 1, -1, 0, 0, 0]] as Array<[number, number, number, number, number, number]>) {
        const transformed = transformNativeCurve(shape, matrix)
        for (let index = 0; index <= 40; index++) {
          const point = nativeCurvePointAt(shape, index / 40), actual = nativeCurvePointAt(transformed, index / 40)
          expect(actual.x).toBeCloseTo(matrix[0] * point.x + matrix[2] * point.y + matrix[4], 8)
          expect(actual.y).toBeCloseTo(matrix[1] * point.x + matrix[3] * point.y + matrix[5], 8)
        }
      }
    }
    expect(() => transformNativeCurve(ellipse, [0, 0, 0, 1, 0, 0])).toThrow('collapses')
  })

  it('converts only on explicit request, preserving physical tolerance and attributes', () => {
    for (const shape of [cubic, { ...ellipse, locked: true, opacity: 0.4 }]) {
      const lines = nativeCurveToEditable(shape, 0.01)
      for (let index = 0; index <= 200; index++) {
        const point = nativeCurvePointAt(shape, index / 200)
        const distance = Math.min(...lines.map(line => {
          const dx = line.end.x - line.start.x, dy = line.end.y - line.start.y
          const t = Math.max(0, Math.min(1, ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / (dx * dx + dy * dy || 1)))
          return Math.hypot(point.x - line.start.x - t * dx, point.y - line.start.y - t * dy)
        }))
        expect(distance).toBeLessThanOrEqual(0.010001)
      }
      expect(lines[0].locked).toBe(shape.locked)
      expect(lines[0].opacity).toBe(shape.opacity)
    }
  })

  it('preserves native parameters through JSON and supported LCAD exchange', () => {
    const doc = importLcadDocument(JSON.stringify({ version: 2, layers: [{ id: 'layer' }], shapes: [] })).doc
    doc.objects = [cubic, ellipse]
    const json = parseImportedJsonDocument(JSON.stringify(doc)).doc
    expect(json.objects[0]).toMatchObject({ type: 'cubic', control1: cubic.control1, control2: cubic.control2 })
    expect(json.objects[1]).toMatchObject({ type: 'ellipse', center: ellipse.center, radiusX: 10, radiusY: 2, rotationDeg: 45 })
    const roundtrip = importLcadDocument(exportLcadDocument(doc).text)
    expect(roundtrip.warnings).toEqual([])
    expect(roundtrip.doc.objects[0]).toMatchObject({ type: 'cubic', control1: cubic.control1, control2: cubic.control2 })
    expect(roundtrip.doc.objects[1]).toMatchObject({ type: 'ellipse', radiusX: 10, radiusY: 2, rotationDeg: 45 })
    expect(() => parseImportedJsonDocument(JSON.stringify({ ...doc, objects: [{ ...ellipse, radiusX: 0 }] }))).toThrow('Invalid shape')
  })
})
