import { describe, expect, it } from 'vitest'
import type { DocFile, Point, Shape, StitchHole } from '../cad/cad-types'
import { buildAsciiStl, buildStlExport } from './io-stl'
import { validateStlMesh } from './stl-mesh'

function polygon(points: Point[], prefix = 'edge'): Shape[] {
  return points.map((start, i) => ({ id: `${prefix}-${i}`, type: 'line', layerId: 'layer', lineTypeId: 'cut', start, end: points[(i + 1) % points.length] }))
}

function rectangle(x: number, y: number, w: number, h: number, prefix = 'edge') {
  return polygon([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], prefix)
}

function document(objects = rectangle(12, 20, 30, 20), stitchHoles: StitchHole[] = []): DocFile {
  return {
    version: 1, units: 'mm', documentName: 'Print fixture',
    layers: [{ id: 'layer', name: 'Main', visible: true, locked: false }], activeLayerId: 'layer',
    lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', visible: true, style: 'solid', color: '#111111' }],
    activeLineTypeId: 'cut', objects, foldLines: [], stitchHoles,
  }
}

function hole(id: string, x: number, y: number, extra: Partial<StitchHole> = {}): StitchHole {
  return { id, shapeId: 'edge-0', point: { x, y }, angleDeg: 0, holeType: 'round', sequence: 0, diameterMm: 2, ...extra }
}

describe('STL manufacturing export', () => {
  it('exports a watertight prism at real millimetre dimensions with outward faces', () => {
    const result = buildAsciiStl(document(), { thicknessMm: 3, stitchHoles: 'none' })
    expect(result.dimensionsMm).toEqual({ width: 30, height: 20, depth: 3 })
    expect(result.triangleCount).toBe(12)
    expect(result.volumeMm3).toBeCloseTo(1800, 6)
    expect(result.mesh.vertices.every((v) => v.x >= 0 && v.y >= 0 && v.z >= 0)).toBe(true)
    expect(result.content.match(/facet normal/g)).toHaveLength(12)
    expect(result.content.startsWith('solid Print_fixture_mm\n')).toBe(true)
    expect(validateStlMesh(result.mesh).watertight).toBe(true)
  })

  it('preserves a concave outer outline and a nested cutout regardless of winding', () => {
    const outer = polygon([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 30 }, { x: 0, y: 30 }])
    const cutout = rectangle(2, 12, 4, 6, 'hole')
    const result = buildStlExport(document([...outer, ...cutout]), { thicknessMm: 2, stitchHoles: 'none' })
    expect(result.volumeMm3).toBeCloseTo((500 - 24) * 2, 5)
    expect(result.watertight).toBe(true)
  })

  it('unions overlapping outlines instead of exporting overlapping solids', () => {
    const result = buildStlExport(document([...rectangle(0, 0, 20, 20), ...rectangle(10, 0, 20, 20, 'b')]), { thicknessMm: 1 })
    expect(result.dimensionsMm.width).toBe(30)
    expect(result.volumeMm3).toBeCloseTo(600, 5)
  })

  it('cuts circular through holes with the requested manufacturing diameter', () => {
    const result = buildStlExport(document(undefined, [hole('a', 20, 28)]), { thicknessMm: 2, roundHoleDiameterMm: 4 })
    expect(result.stitchHoleCount).toBe(1)
    expect(result.volumeMm3).toBeCloseTo((600 - Math.PI * 4) * 2, 0)
    expect(result.watertight).toBe(true)
  })

  it('preserves diamond and slit hole dimensions and merges overlapping holes', () => {
    const result = buildStlExport(document(undefined, [
      hole('a', 20, 28, { renderShape: 'diamond', holeType: 'slit', widthMm: 2, heightMm: 4 }),
      hole('b', 30, 28, { renderShape: 'flat', holeType: 'slit', widthMm: 1, heightMm: 3 }),
      hole('duplicate', 30, 28, { renderShape: 'flat', holeType: 'slit', widthMm: 1, heightMm: 3 }),
    ]), { thicknessMm: 1, stitchHoles: 'original' })
    expect(result.volumeMm3).toBeCloseTo(600 - 4 - 3, 5)
    expect(result.watertight).toBe(true)
  })

  it('builds one connected stepped jig without coincident internal faces', () => {
    const result = buildStlExport(document(rectangle(0, 0, 20, 10)), {
      mode: 'jig', jigBaseThicknessMm: 2, jigWallHeightMm: 3, jigMarginMm: 5, jigClearanceMm: 0,
    })
    expect(result.dimensionsMm).toEqual({ width: 30, height: 20, depth: 5 })
    expect(result.volumeMm3).toBeCloseTo(30 * 20 * 5 - 20 * 10 * 3, 5)
    expect(result.mesh.vertices.some((v) => v.z === 2)).toBe(true)
    expect(result.watertight).toBe(true)
  })

  it('adds fitting clearance to the jig pocket, including rounded offset corners', () => {
    const baseline = buildStlExport(document(rectangle(0, 0, 20, 10)), { mode: 'jig', jigClearanceMm: 0 })
    const clearance = buildStlExport(document(rectangle(0, 0, 20, 10)), { mode: 'jig', jigClearanceMm: 0.5 })
    expect(clearance.volumeMm3).toBeLessThan(baseline.volumeMm3)
    expect(clearance.watertight).toBe(true)
  })

  it('keeps nested cutout islands and multiple pockets connected through a jig floor', () => {
    const doc = document([
      ...rectangle(0, 0, 20, 10), ...rectangle(8, 3, 4, 4, 'island'), ...rectangle(30, 0, 5, 10, 'second'),
    ])
    const result = buildStlExport(doc, { mode: 'jig', jigClearanceMm: 0, jigMarginMm: 5, jigBaseThicknessMm: 2, jigWallHeightMm: 3 })
    expect(result.dimensionsMm).toEqual({ width: 45, height: 20, depth: 5 })
    expect(result.volumeMm3).toBeCloseTo(45 * 20 * 5 - (200 - 16 + 50) * 3, 5)
    expect(result.watertight).toBe(true)
  })

  it('samples curved cut boundaries into a closed printable mesh', () => {
    const doc = document([
      { id: 'curve', type: 'bezier', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, control: { x: 10, y: -10 }, end: { x: 20, y: 0 } },
      { id: 'base', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: { x: 20, y: 0 }, end: { x: 0, y: 0 } },
    ])
    const result = buildStlExport(doc, { thicknessMm: 2 })
    expect(result.volumeMm3).toBeGreaterThan(133.2)
    expect(result.volumeMm3).toBeLessThan(133.4)
    expect(result.watertight).toBe(true)
  })

  it('rejects a slit that crosses a cutout even when every slit corner is in material', () => {
    const doc = document([...rectangle(12, 20, 30, 20), ...rectangle(24, 24, 1, 4, 'cutout')], [
      hole('slit', 23, 26, { holeType: 'slit', renderShape: 'flat', widthMm: 1, heightMm: 6 }),
    ])
    expect(() => buildStlExport(doc, { stitchHoles: 'original' })).toThrow(/cross an outline or cutout/)
  })

  it('refuses a non-manifold contact between two outlines instead of exporting touching shells', () => {
    const doc = document([...rectangle(0, 0, 10, 10), ...rectangle(10, 10, 10, 10, 'touch')])
    expect(() => buildStlExport(doc)).toThrow(/watertight|open|cross/)
  })

  it('rejects open, self-intersecting, non-finite and edge-crossing-hole input', () => {
    expect(() => buildStlExport(document(rectangle(0, 0, 20, 20).slice(0, 3)))).toThrow(/open/)
    expect(() => buildStlExport(document(polygon([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }])))).toThrow(/area|cross/)
    const bad = rectangle(0, 0, 20, 20)
    bad[0].start.x = Number.NaN
    expect(() => buildStlExport(document(bad))).toThrow()
    expect(() => buildStlExport(document(undefined, [hole('edge', 12.1, 28)]), { roundHoleDiameterMm: 2 })).toThrow(/cross an outline/)
  })

  it('rejects impossible thickness, clearance and empty selection', () => {
    expect(() => buildStlExport(document(), { thicknessMm: 0 })).toThrow(/Thickness/)
    expect(() => buildStlExport(document(), { thicknessMm: Number.NaN })).toThrow(/Thickness/)
    expect(() => buildStlExport(document(), { mode: 'jig', jigClearanceMm: 6 })).toThrow(/margin/)
    expect(() => buildStlExport(document(), { selectedShapeIds: new Set() })).toThrow(/No visible cut outlines/)
  })

  it('honours hidden layers, selection and non-cut lines without changing the document', () => {
    const doc = document([...rectangle(0, 0, 20, 20), ...rectangle(50, 0, 10, 10, 'other')])
    const before = JSON.stringify(doc)
    const result = buildStlExport(doc, { selectedShapeIds: new Set(['edge-0', 'edge-1', 'edge-2', 'edge-3']) })
    expect(result.dimensionsMm.width).toBe(20)
    expect(JSON.stringify(doc)).toBe(before)
    doc.layers[0].visible = false
    expect(() => buildStlExport(doc)).toThrow(/No visible/)
  })
})
