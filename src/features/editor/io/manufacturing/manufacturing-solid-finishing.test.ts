import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DocFile, Shape, TextShape } from '../../cad/cad-types'
import { buildStlExportAsync } from '../io-stl'
import { validateStlMesh } from '../stl-mesh'
import { buildFinishedPrism } from './manufacturing-finishing'
import { embedManufacturingFont } from './manufacturing-font-data'

function rectangle(x: number, y: number, width: number, height: number, id = 'a'): Shape[] {
  const p = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]
  return p.map((start, i) => ({ id: `${id}${i}`, type: 'line', layerId: 'layer', lineTypeId: 'cut', start, end: p[(i + 1) % 4] }))
}
function document(objects = rectangle(0, 0, 40, 20)): DocFile {
  return { version: 1, units: 'mm', layers: [{ id: 'layer', name: 'Layer', visible: true, locked: false }], activeLayerId: 'layer', lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', style: 'solid', color: '#000000', visible: true }], activeLineTypeId: 'cut', objects, foldLines: [] }
}
function lettering(x: number, y: number, size = 8): TextShape {
  return { id: `text-${x}`, type: 'text', layerId: 'layer', lineTypeId: 'cut', start: { x, y }, end: { x: x + 10, y }, text: 'O', fontFamily: 'LeatherCad Test', fontSizeMm: size, transform: 'none', radiusMm: 40, sweepDeg: 140 }
}
const bytes = readFileSync(resolve('src/features/editor/io/manufacturing/fixtures/engraving-test.ttf'))
const font = embedManufacturingFont('synthetic-test.otf', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))

describe('combined solid finishing', () => {
  it('keeps actual chamfer and fillet profiles around holes within geometric tolerance', () => {
    const stock = [[{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }], [{ x: 2, y: 5 }, { x: 2, y: 15 }, { x: 7, y: 15 }, { x: 7, y: 5 }]]
    const probes = [{ x: 7.25, y: 8, d: 0.25 }, { x: 4, y: 4.75, d: 0.25 }, { x: 2, y: 4.75, d: 0.25 }, { x: 1.8, y: 4.8, d: Math.hypot(0.2, 0.2) }, { x: 7.2, y: 15.2, d: Math.hypot(0.2, 0.2) }, { x: 0.25, y: 0.25, d: 0.25 }]
    for (const finish of ['chamfer', 'fillet'] as const) {
      const mesh = buildFinishedPrism(stock, 0.5, 0.5, finish, 6, 0.01, { top: true, bottom: false })
      for (const p of probes) {
        let top = -Infinity
        for (const indices of mesh.triangles) {
          const [a, b, c] = indices.map(i => mesh.vertices[i])
          const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
          if (Math.abs(denominator) < 1e-12) continue
          const u = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / denominator
          const v = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / denominator
          if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) top = Math.max(top, u * a.z + v * b.z + (1 - u - v) * c.z)
        }
        expect(Number.isFinite(top)).toBe(true)
        const error = finish === 'chamfer' ? Math.abs(top - p.d) / Math.SQRT2 : Math.abs(Math.hypot(0.5 - p.d, top) - 0.5)
        expect(error).toBeLessThanOrEqual(0.01)
      }
      if (finish === 'chamfer') expect(Math.abs(validateStlMesh(mesh).volumeMm3 - (750 * 0.5 - 150 * 0.5 ** 2 / 2 + (4 - Math.PI) * 0.5 ** 3 / 3))).toBeLessThan(0.25)
    }
  })
  it('combines a nested cutout with three finished heights without mutating the drawing', async () => {
    const doc = document([...rectangle(0, 0, 30, 20), ...rectangle(10, 0, 30, 20, 'b'), ...rectangle(2, 5, 5, 10, 'hole')]), before = JSON.stringify(doc)
    for (const edgeFinish of ['chamfer', 'fillet'] as const) {
      const result = await buildStlExportAsync(doc, { edgeFinish, edgeSizeMm: 0.5, stitchHoles: 'none', regions: [{ id: 'left', at: { x: 1, y: 1 }, heightMm: 2, through: false }, { id: 'middle', at: { x: 15, y: 5 }, heightMm: 4, through: false }, { id: 'right', at: { x: 35, y: 5 }, heightMm: 6, through: false }] })
      expect(result.watertight).toBe(true); expect(result.volumeMm3).toBeLessThan(3100)
      expect(JSON.stringify(doc)).toBe(before)
    }
  })
  it('combines chamfered patterns with top and bottom font engraving at the real recess depth', async () => {
    const doc = document(); doc.objects.push(lettering(5, 15))
    for (const textEngrave of ['top', 'bottom'] as const) {
      const result = await buildStlExportAsync(doc, { thicknessMm: 4, edgeFinish: 'chamfer', edgeSizeMm: 0.5, engravingFont: font, textEngrave, textDepthMm: 0.5 })
      expect(result.volumeMm3).toBeCloseTo(3200 - 2 * (60 * 0.25 - 4 * 0.125 / 3) - 10.56, 3)
      expect(result.dimensionsMm).toEqual({ width: 40, height: 20, depth: 4 })
      expect(result.mesh.vertices.some(p => Math.abs(p.z - (textEngrave === 'top' ? 3.5 : 0.5)) < 1e-6)).toBe(true)
      expect(validateStlMesh(result.mesh).watertight).toBe(true)
    }
  })
  it('finishes unequal regions without cutting an unintended groove beside a taller face', async () => {
    const doc = document([...rectangle(0, 0, 20, 20), ...rectangle(10, 0, 20, 20, 'b')])
    const result = await buildStlExportAsync(doc, { thicknessMm: 4, edgeFinish: 'chamfer', edgeSizeMm: 0.5, regions: [{ id: 'left', at: { x: 5, y: 10 }, heightMm: 2, through: false }] })
    // Bottom whole footprint: 12 1/3; low exposed top: 4 11/12; upper top: 9 5/6 mm³ removed.
    expect(result.volumeMm3).toBeCloseTo(2000 - 12.3333333333 - 4.9166666667 - 9.8333333333, 3)
    expect(result.watertight).toBe(true)
    doc.objects.push(lettering(2, 15), lettering(18, 15))
    const engraved = await buildStlExportAsync(doc, { thicknessMm: 4, edgeFinish: 'fillet', edgeSizeMm: 0.5, regions: [{ id: 'left', at: { x: 5, y: 10 }, heightMm: 2, through: false }], engravingFont: font, textEngrave: 'top', textDepthMm: 0.4 })
    expect(engraved.mesh.vertices.some(p => Math.abs(p.z - 1.6) < 1e-6)).toBe(true)
    expect(engraved.mesh.vertices.some(p => Math.abs(p.z - 3.6) < 1e-6)).toBe(true)
    expect(engraved.watertight).toBe(true)
  })
  it('finishes jig outside edges while preserving the pocket, bores and engraved floor', async () => {
    const doc = document(rectangle(0, 0, 20, 10)); doc.objects.push(lettering(7, 8, 6))
    const result = await buildStlExportAsync(doc, { mode: 'jig', jigClearanceMm: 0, edgeFinish: 'chamfer', edgeSizeMm: 0.5, engravingFont: font, textEngrave: 'top', textDepthMm: 0.5 })
    expect(result.volumeMm3).toBeCloseTo(2400 - 2 * (50 * 0.25 - 4 * 0.125 / 3) - 5.94, 3)
    expect(result.dimensionsMm).toEqual({ width: 30, height: 20, depth: 5 })
    doc.stitchHoles = [{ id: 'h', shapeId: 'a0', point: { x: 4, y: 5 }, angleDeg: 0, holeType: 'round', sequence: 0 }]
    const drilled = await buildStlExportAsync(doc, { mode: 'jig', jigClearanceMm: 0, edgeFinish: 'fillet', edgeSizeMm: 0.5, jigStitchThrough: true, jigStitchDiameterMm: 2, fingerHoles: [{ id: 'finger', x: 15, y: 5, diameterMm: 4 }], engravingFont: font, textEngrave: 'top', textDepthMm: 0.5 })
    expect(drilled.stitchHoleCount).toBe(1)
    expect(drilled.volumeMm3).toBeLessThan(result.volumeMm3)
    expect(drilled.watertight).toBe(true)
  })
  it('allows separated parts with close heights but rejects a radius larger than a shared step', async () => {
    const doc = document([...rectangle(0, 0, 20, 20), ...rectangle(30, 0, 20, 20, 'b')])
    const result = await buildStlExportAsync(doc, { thicknessMm: 2.2, edgeFinish: 'chamfer', edgeSizeMm: 0.5, regions: [{ id: 'left', at: { x: 5, y: 10 }, heightMm: 2, through: false }] })
    expect(result.watertight).toBe(true)
    const joined = document([...rectangle(0, 0, 20, 20), ...rectangle(10, 0, 20, 20, 'b')])
    await expect(buildStlExportAsync(joined, { thicknessMm: 2.2, edgeFinish: 'chamfer', edgeSizeMm: 0.5, regions: [{ id: 'left', at: { x: 5, y: 10 }, heightMm: 2, through: false }] })).rejects.toThrow(/adjacent height step/)
    await expect(buildStlExportAsync(document(rectangle(0, 0, 20, 10)), { mode: 'jig', jigClearanceMm: 0, jigMarginMm: 0.4, edgeFinish: 'chamfer', edgeSizeMm: 0.5 })).rejects.toThrow(/preserve fit/)
  })
  it('clips lettering crossing a bevel and reports the nominal face-plane depth', async () => {
    const doc = document(); doc.objects.push(lettering(-0.6, 15))
    const result = await buildStlExportAsync(doc, { thicknessMm: 4, edgeFinish: 'fillet', edgeSizeMm: 0.5, engravingFont: font, textEngrave: 'top', textDepthMm: 0.3 })
    expect(result.watertight).toBe(true)
    expect(result.warnings.join(' ')).toMatch(/crosses a finished edge/)
  })
})
