import { describe, expect, it } from 'vitest'
import type { DocFile, Point, Shape } from '../../cad/cad-types'
import { buildAsciiStl, buildStlExport } from '../io-stl'
import { flattenBezier, flattenManufacturingShape } from './manufacturing-curves'
import { DEFAULT_MANUFACTURING_SETTINGS, parseManufacturingSettings } from './manufacturing-settings'
import { createStlMeshBuilder, validateStlMesh } from '../stl-mesh'
import { loadFontFromBuffer } from '../../ops/opentype-ops'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { embedManufacturingFont, manufacturingFontBuffer, parseManufacturingFontData } from './manufacturing-font-data'

function rectangle(x: number, y: number, w: number, h: number, id = 'a'): Shape[] {
  const points = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]
  return points.map((start, i) => ({ id: `${id}${i}`, type: 'line', layerId: 'layer', lineTypeId: 'cut', start, end: points[(i + 1) % 4] }))
}
function document(objects = rectangle(0, 0, 30, 20)): DocFile {
  return { version: 1, units: 'mm', layers: [{ id: 'layer', name: 'Layer', visible: true, locked: false }], activeLayerId: 'layer', lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', style: 'solid', color: '#000000', visible: true }], activeLineTypeId: 'cut', objects, foldLines: [] }
}
function pointDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

describe('manufacturing geometry and versioned options', () => {
  it('bounds a large semicircle in millimetres instead of using fixed segment count', () => {
    const curve: Shape = { id: 'arc', type: 'arc', layerId: 'layer', lineTypeId: 'cut', start: { x: -300, y: 0 }, mid: { x: 0, y: -300 }, end: { x: 300, y: 0 } }
    const points = flattenManufacturingShape(curve, 0.01)
    expect(points.length).toBeGreaterThan(49)
    let error = 0
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1]
      error = Math.max(error, 300 - Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2))
    }
    expect(error).toBeLessThanOrEqual(0.01)
  })
  it('bounds quadratic and cubic curves against independent dense samples', () => {
    for (const controls of [[{ x: 0, y: 0 }, { x: 2000, y: -900 }, { x: 100, y: 0 }], [{ x: 0, y: 0 }, { x: 100, y: -400 }, { x: 200, y: 300 }, { x: 300, y: 0 }]]) {
      const points = flattenBezier(controls, 0.01)
      for (let i = 0; i <= 1000; i++) {
        let level = controls
        const t = i / 1000
        while (level.length > 1) level = level.slice(1).map((p, j) => ({ x: level[j].x * (1 - t) + p.x * t, y: level[j].y * (1 - t) + p.y * t }))
        const distance = Math.min(...points.slice(1).map((p, j) => pointDistance(level[0], points[j], p)))
        expect(distance).toBeLessThanOrEqual(0.010001)
      }
    }
  })
  it('exports native cubics and rotated analytic ellipses with bounded flattening', () => {
    const ellipse: Shape = { id: 'ellipse', type: 'ellipse', layerId: 'layer', lineTypeId: 'cut', center: { x: 0, y: 0 }, radiusX: 300, radiusY: 20, rotationDeg: 30, startAngleDeg: 0, sweepDeg: 360 }
    const points = flattenManufacturingShape(ellipse, 0.01)
    for (let i = 0; i < 500; i++) {
      const angle = i / 500 * Math.PI * 2, rotation = Math.PI / 6
      const p = { x: 300 * Math.cos(angle) * Math.cos(rotation) - 20 * Math.sin(angle) * Math.sin(rotation), y: 300 * Math.cos(angle) * Math.sin(rotation) + 20 * Math.sin(angle) * Math.cos(rotation) }
      expect(Math.min(...points.slice(1).map((end, j) => pointDistance(p, points[j], end)))).toBeLessThanOrEqual(0.010001)
    }
    expect(buildStlExport(document([ellipse]), { stitchHoles: 'none' }).volumeMm3 / (Math.PI * 300 * 20 * 2)).toBeCloseTo(1, 3)
    const cubic: Shape = { id: 'cubic', type: 'cubic', layerId: 'layer', lineTypeId: 'cut', start: { x: 0, y: 0 }, control1: { x: 10, y: -10 }, control2: { x: 20, y: -10 }, end: { x: 30, y: 0 } }
    const base: Shape = { id: 'base', type: 'line', layerId: 'layer', lineTypeId: 'cut', start: cubic.end, end: cubic.start }
    expect(buildStlExport(document([cubic, base])).watertight).toBe(true)
  })
  it('builds explicit-size jigs, signed pocket clearance, finger holes and jig drilling', () => {
    const doc = document(rectangle(0, 0, 20, 10))
    doc.stitchHoles = [{ id: 'h', shapeId: 'a0', point: { x: 15, y: 5 }, angleDeg: 0, holeType: 'round', sequence: 0 }]
    const base = buildStlExport(doc, { mode: 'jig', jigOuterMode: 'dimensions', jigWidthMm: 40, jigHeightMm: 30, jigClearanceMm: 0 })
    expect(base.dimensionsMm).toEqual({ width: 40, height: 30, depth: 5 })
    expect(base.volumeMm3).toBeCloseTo(5400, 5)
    const drilled = buildStlExport(doc, { mode: 'jig', jigOuterMode: 'dimensions', jigWidthMm: 40, jigHeightMm: 30, jigClearanceMm: 0, jigStitchThrough: true, jigStitchDiameterMm: 2, fingerHoles: [{ id: 'f', x: 5, y: 5, diameterMm: 4 }] })
    expect(drilled.volumeMm3).toBeCloseTo(5400 - 2 * Math.PI * 5, -1)
    const fit = buildStlExport(doc, { mode: 'jig', jigClearanceMm: -0.5 })
    expect(fit.volumeMm3).toBeGreaterThan(buildStlExport(doc, { mode: 'jig', jigClearanceMm: 0 }).volumeMm3)
    expect(fit.warnings.join(' ')).toMatch(/interference/)
    expect(() => buildStlExport(doc, { mode: 'jig', jigOuterMode: 'dimensions', jigWidthMm: 10, jigHeightMm: 5 })).toThrow(/dimensions or margin/)
    expect(() => buildStlExport(doc, { mode: 'jig', fingerHoles: [{ id: 'f', x: -100, y: 0, diameterMm: 4 }] })).toThrow(/finger hole crosses/)
  })
  it('makes stepped regions and through regions without coincident internal walls', () => {
    const doc = document([...rectangle(0, 0, 20, 10), ...rectangle(10, 0, 20, 10, 'b')])
    const result = buildStlExport(doc, { stitchHoles: 'none', regions: [{ id: 'left', at: { x: 5, y: 5 }, heightMm: 1, through: false }, { id: 'right', at: { x: 25, y: 5 }, heightMm: 2, through: true }] })
    expect(result.faces).toHaveLength(3)
    expect(result.faces.find((face) => face.id === 'left')?.at).toEqual({ x: 5, y: 5 })
    expect(result.volumeMm3).toBeCloseTo(300, 5)
    expect(result.watertight).toBe(true)
    expect(buildStlExport(doc, { regions: [{ id: 'stale', at: { x: 900, y: 900 }, heightMm: 1, through: false }] }).warnings.join(' ')).toMatch(/no longer matches/)
  })
  it('omits stitch holes wholly removed by through regions and rejects partial crossings', () => {
    const doc = document([...rectangle(0, 0, 20, 10), ...rectangle(10, 0, 20, 10, 'b')])
    doc.stitchHoles = [{ id: 'h', shapeId: 'a0', point: { x: 5, y: 5 }, angleDeg: 0, holeType: 'round', sequence: 0 }]
    const options = { regions: [{ id: 'left', at: { x: 5, y: 5 }, heightMm: 2, through: true }] }
    const result = buildStlExport(doc, options)
    expect(result.stitchHoleCount).toBe(0)
    expect(result.warnings.join(' ')).toMatch(/inside through regions/)
    doc.stitchHoles[0].point.x = 9.8
    expect(() => buildStlExport(doc, options)).toThrow(/cross an outline/)
  })
  it('exports true sloped chamfer faces and selectable fillet subdivisions', () => {
    const chamfer = buildStlExport(document(), { thicknessMm: 4, edgeFinish: 'chamfer', edgeSizeMm: 0.5, stitchHoles: 'none' })
    expect(chamfer.volumeMm3).toBeCloseTo(2400 - 2 * (50 * 0.25 - 4 * 0.125 / 3), 4)
    expect(chamfer.mesh.triangles.some((tri) => {
      const vertices = tri.map((i) => chamfer.mesh.vertices[i])
      return new Set(vertices.map((v) => v.z)).size > 1 && new Set(vertices.map((v) => v.x)).size > 1 && new Set(vertices.map((v) => v.y)).size > 1
    })).toBe(true)
    const fillet = buildStlExport(document(), { thicknessMm: 4, edgeFinish: 'fillet', edgeSizeMm: 0.5, filletSteps: 6, stitchHoles: 'none' })
    expect(fillet.triangleCount).toBeGreaterThan(chamfer.triangleCount)
    expect(fillet.watertight).toBe(true)
    expect(() => buildStlExport(document(), { edgeFinish: 'chamfer', edgeSizeMm: 2 })).toThrow(/less than half/)
  })
  it('preserves geometry when appearance changes and does not mutate the drawing', () => {
    const doc = document(), before = JSON.stringify(doc)
    expect(buildAsciiStl(doc, { previewColor: '#00ff00', materialPreset: 'metal' }).content).toBe(buildAsciiStl(doc, { previewColor: '#ff0000', materialPreset: 'matte' }).content)
    expect(JSON.stringify(doc)).toBe(before)
  })
  it('honours inherited group visibility and fully transparent native shapes', () => {
    const doc = document()
    doc.sketchGroups = [{ id: 'root', name: 'Hidden', layerId: 'layer', visible: false, locked: false }, { id: 'child', parentId: 'root', name: 'Child', layerId: 'layer', visible: true, locked: false }]
    doc.objects = doc.objects.map((shape) => ({ ...shape, groupId: 'child' }))
    expect(() => buildStlExport(doc)).toThrow(/No visible/)
    doc.sketchGroups[0].visible = true
    expect(buildStlExport(doc).volumeMm3).toBeCloseTo(1200)
    doc.objects = doc.objects.map((shape) => ({ ...shape, opacity: 0 }))
    expect(() => buildStlExport(doc)).toThrow(/No visible/)
  })
  it('roundtrips versioned settings and rejects unknown versions or malformed manufacturing values', () => {
    const settings = { ...DEFAULT_MANUFACTURING_SETTINGS, regions: [{ id: 'r', at: { x: 2, y: 3 }, heightMm: 1, through: false }] }
    expect(parseManufacturingSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
    expect(() => parseManufacturingSettings({ version: 2 })).toThrow(/version/)
    expect(() => parseManufacturingSettings({ version: 1, toleranceMm: 0 })).toThrow(/tolerance/)
    expect(() => parseManufacturingSettings({ version: 1, fingerHoles: [{ id: 'h', x: 0, y: 0, diameterMm: NaN }] })).toThrow(/finger/)
  })
  it('engraves top and bottom glyph outlines with counters, actual depth and rotation', () => {
    const fontFile = resolve('src/features/editor/io/manufacturing/fixtures/engraving-test.ttf')
    const bytes = readFileSync(fontFile)
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    loadFontFromBuffer(buffer, 'test-font')
    const doc = document()
    doc.objects.push({ id: 'text', type: 'text', layerId: 'layer', lineTypeId: 'cut', start: { x: 5, y: 15 }, end: { x: 15, y: 15 }, text: 'O', fontFamily: 'DejaVu Sans', fontSizeMm: 8, transform: 'none', radiusMm: 40, sweepDeg: 140 })
    const top = buildStlExport(doc, { textEngrave: 'top', textDepthMm: 0.5, engravingFontKey: 'test-font' })
    const bottom = buildStlExport(doc, { textEngrave: 'bottom', textDepthMm: 0.5, engravingFontKey: 'test-font' })
    expect(top.volumeMm3).toBeLessThan(1200)
    expect(top.volumeMm3).toBeCloseTo(bottom.volumeMm3, 4)
    expect(top.mesh.vertices.some((p) => p.z === 1.5)).toBe(true)
    expect(bottom.mesh.vertices.some((p) => p.z === 0.5)).toBe(true)
    const text = doc.objects.find((shape) => shape.type === 'text')!
    if (text.type === 'text') text.end = { x: 15, y: 10 }
    expect(buildStlExport(doc, { textEngrave: 'top', textDepthMm: 0.5, engravingFontKey: 'test-font' }).volumeMm3).toBeCloseTo(top.volumeMm3, 2)
    expect(() => buildStlExport(doc, { textEngrave: 'top' })).toThrow(/exact.*font/)
    expect(() => buildStlExport(doc, { textEngrave: 'top', textDepthMm: 3, engravingFontKey: 'test-font' })).toThrow(/less than.*thickness/)
    doc.manufacturing = parseManufacturingSettings({ version: 1, textEngrave: 'top', engravingFont: embedManufacturingFont('test.ttf', buffer) })
    const reopened = JSON.parse(JSON.stringify(doc)) as DocFile
    expect(buildStlExport(reopened).volumeMm3).toBeCloseTo(top.volumeMm3, 2)
    expect(new Uint8Array(manufacturingFontBuffer(reopened.manufacturing!.engravingFont!))).toEqual(new Uint8Array(buffer))
    const longName = embedManufacturingFont(`${'x'.repeat(205)}.ttf`, buffer)
    expect(longName.name).toHaveLength(200)
    expect(parseManufacturingFontData(JSON.parse(JSON.stringify(longName)))).toEqual(longName)
    const outside = structuredClone(doc)
    const outsideText = outside.objects.find((shape) => shape.type === 'text')!
    if (outsideText.type === 'text') { outsideText.start = { x: 100, y: 100 }; outsideText.end = { x: 110, y: 100 } }
    expect(buildStlExport(outside).warnings.join(' ')).toMatch(/outside the remaining material/)
    if (outsideText.type === 'text') outsideText.text = 'O'.repeat(2001)
    expect(() => buildStlExport(outside)).toThrow(/2,000 characters/)
    expect(() => parseManufacturingFontData({ name: 'bad.ttf', dataUrl: 'data:text/html;base64,AAAA' })).toThrow(/TTF or OTF/)
  })
  it('rejects a closed component with reversed orientation even if another component is larger', () => {
    const b = createStlMeshBuilder(), ring = [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]]
    b.caps([{ outer: ring[0], holes: [] }], 0, false); b.caps([{ outer: ring[0], holes: [] }], 1, true); b.walls(ring, 0, 1)
    const valid = b.mesh, vertices = [...valid.vertices.map((v) => ({ x: v.x * 2, y: v.y * 2, z: v.z * 2 })), ...valid.vertices.map((v) => ({ ...v, x: v.x + 3 }))]
    const triangles = [...valid.triangles, ...valid.triangles.map(([a, b, c]): [number, number, number] => [a + 8, c + 8, b + 8])]
    expect(() => validateStlMesh({ vertices, triangles })).toThrow(/component|volume/)
  })
  it('rejects a pinched vertex even when every edge has two faces', () => {
    const b = createStlMeshBuilder()
    const rings = [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]]
    const other = rings.map((ring) => ring.map((p) => ({ x: p.x + 1, y: p.y + 1 })))
    for (const [ring, z] of [[rings, 0], [other, 1]] as const) {
      b.caps([{ outer: ring[0], holes: [] }], z, false); b.caps([{ outer: ring[0], holes: [] }], z + 1, true); b.walls([...ring], z, z + 1)
    }
    expect(() => validateStlMesh(b.mesh)).toThrow(/single vertex|non-manifold vertex/)
  })
})
