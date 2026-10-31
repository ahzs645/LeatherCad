import { describe, expect, it } from 'vitest'
import type { CubicShape, DocFile, EllipseShape, Point, Shape, SketchGroup } from '../cad/cad-types'
import { isNativeCurve, nativeCurveBounds, nativeCurvePointAt, type NativeCurve } from '../cad/native-curve-ops'
import { detectAutoConstraints, DEFAULT_AUTO_CONSTRAINT_SETTINGS } from './auto-constraint-ops'
import { rotateShape, mirrorMandalaItem } from './mandala-ops'
import { tileSelectionAsStamp } from './stamp-simulator-ops'
import { buildLinkedProjectionShapes } from './sketch-link-ops'
import { flipTemplateEntryShapes, insertTemplateDocIntoCurrent } from '../templates/template-repository'

const appearance = { layerId: 'main', lineTypeId: 'cut', groupId: 'source', locked: true, opacity: 0.4, strokeWidthOverride: 0.35, arrowStart: true }
const cubic: CubicShape = { ...appearance, id: 'cubic', type: 'cubic', start: { x: 2, y: 1 }, control1: { x: 3, y: 8 }, control2: { x: 10, y: -2 }, end: { x: 12, y: 3 } }
const ellipse: EllipseShape = { ...appearance, id: 'ellipse', type: 'ellipse', center: { x: 7, y: 4 }, radiusX: 5, radiusY: 2, rotationDeg: 27, startAngleDeg: 15, sweepDeg: 210 }
function expectCurve(actual: Shape, source: NativeCurve, transform: (point: Point) => Point) {
  expect(isNativeCurve(actual)).toBe(true)
  if (!isNativeCurve(actual)) throw new Error('Expected native curve')
  expect(actual).toMatchObject({ type: source.type, opacity: source.opacity, locked: true, strokeWidthOverride: 0.35, arrowStart: true })
  for (const t of [0, 0.13, 0.5, 0.82, 1]) {
    const expected = transform(nativeCurvePointAt(source, t)), point = nativeCurvePointAt(actual, t)
    expect(point.x).toBeCloseTo(expected.x, 8)
    expect(point.y).toBeCloseTo(expected.y, 8)
  }
}
function drawing(): DocFile {
  return { version: 1, units: 'mm', layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main', lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', style: 'solid', color: '#000000', visible: true }], activeLineTypeId: 'cut', objects: [cubic, ellipse], foldLines: [] }
}
describe('native curve editing workflows', () => {
  it('tiles curves and preserves exact translated geometry and appearance', () => {
    const copies = tileSelectionAsStamp([cubic, ellipse], new Set(['cubic', 'ellipse']), { rows: 2, cols: 1, pitchXMm: 0, pitchYMm: 17 })
    expect(copies).toHaveLength(2)
    for (let index = 0; index < copies.length; index++) {
      const source = [cubic, ellipse][index]
      expectCurve(copies[index], source, point => ({ x: point.x, y: point.y + 17 }))
      expect(copies[index].id).not.toBe(source.id)
      expect(copies[index].groupId).toBe(source.groupId)
    }
  })
  it('rotates and mirrors native shapes without converting their discriminants to text', () => {
    for (const source of [cubic, ellipse]) {
      const center = { x: 2, y: 3 }
      expectCurve(rotateShape(source, center, 90), source, point => ({ x: center.x - (point.y - center.y), y: center.y + point.x - center.x }))
      expectCurve(mirrorMandalaItem(source, center, 0), source, point => ({ x: point.x, y: 2 * center.y - point.y }))
    }
  })
  it('flips and inserts template curves with fresh identities and independent control points', () => {
    const doc = drawing()
    const flipped = flipTemplateEntryShapes({ id: 'template', name: 'Curves', createdAt: '', updatedAt: '', doc }, 'horizontal')
    for (let index = 0; index < doc.objects.length; index++) expectCurve(flipped.doc.objects[index], [cubic, ellipse][index], point => ({ x: -point.x, y: point.y }))
    const inserted = insertTemplateDocIntoCurrent(doc, [], [], [], [], [])
    expect(inserted.shapes).toHaveLength(2)
    for (let index = 0; index < inserted.shapes.length; index++) {
      expectCurve(inserted.shapes[index], [cubic, ellipse][index], point => point)
      expect(inserted.shapes[index].id).not.toBe(doc.objects[index].id)
      expect(inserted.shapes[index].layerId).toBe(inserted.layers[0].id)
    }
    const cloned = inserted.shapes[0]
    if (cloned.type === 'cubic') expect(cloned.control1).not.toBe(cubic.control1)
    expect(cubic.control1).toEqual({ x: 3, y: 8 })
  })
  it('projects linked curves with exact reflections and retained style metadata', () => {
    for (const source of [cubic, ellipse]) {
      const group: SketchGroup = { id: 'linked', name: 'Linked', layerId: 'target', visible: true, locked: false, baseGroupId: 'source', linkMode: 'mirror-x', linkOffsetX: 20, linkOffsetY: 3 }
      const projected = buildLinkedProjectionShapes([source], [group])
      const bounds = nativeCurveBounds(source)
      expect(projected).toHaveLength(1)
      expectCurve(projected[0], source, point => ({ x: bounds.minX + bounds.maxX - point.x + 20, y: point.y + 3 }))
      expect(projected[0]).toMatchObject({ layerId: 'target', groupId: 'linked' })
    }
  })
  it('does not suggest solver constraints for unsupported analytic parameters', () => {
    for (const shape of [cubic, ellipse]) expect(detectAutoConstraints(shape, [], DEFAULT_AUTO_CONSTRAINT_SETTINGS)).toEqual([])
  })
})
