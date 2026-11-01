import { isNativeCurve, nativeCurveEndpoints as curveEndpoints } from '../cad/native-curve-ops'
import type { Shape as EndpointShape } from '../cad/cad-types'

const endpoints = (shape: EndpointShape) => isNativeCurve(shape) ? curveEndpoints(shape) : { start: shape.start, end: shape.end }
import { describe, expect, it } from 'vitest'
import { sampleShapePoints } from '../cad/cad-geometry'
import { exportLcadDocument, importLcadDocument, isLcadDocument } from './io-lcad'
import { importLccDocument } from './io-lcc'
import { DEFAULT_MANUFACTURING_SETTINGS } from './manufacturing/manufacturing-settings'

const source = (shapes: unknown[], extra = {}) => JSON.stringify({
  version: 2, name: 'Interchange sample', unit_for_view: 'mm', memo: 'Keep this memo',
  layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main',
  shapes: shapes.map((shape, index) => ({ id: `shape-${index}`, layerId: 'main', strokeColor: '#123456', paletteId: 'p1', ...shape as object })),
  groups: [], ...extra,
})

describe('LCAD native interchange', () => {
  it('retains individual appearance and nested groups, and reports omitted manufacturing settings', () => {
    const imported = importLcadDocument(source([{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, groupId: 'child', locked: true, alpha: 0.3 }], { groups: [{ id: 'parent', visible: false }, { id: 'child', parentId: 'parent', locked: true }] }))
    expect(imported.warnings).toEqual([])
    expect(imported.doc.objects[0]).toMatchObject({ locked: true, opacity: 0.3, groupId: 'child' })
    expect(imported.doc.sketchGroups?.[1].parentId).toBe('parent')
    const second = importLcadDocument(exportLcadDocument(imported.doc).text)
    expect(second.doc.objects[0]).toMatchObject({ locked: true, opacity: 0.3, groupId: 'child' })
    expect(second.doc.sketchGroups?.[1].parentId).toBe('parent')
    imported.doc.manufacturing = structuredClone(DEFAULT_MANUFACTURING_SETTINGS)
    expect(exportLcadDocument(imported.doc).warnings.join(' ')).toContain('Manufacturing settings')
    expect(() => importLcadDocument(source([], { groups: [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }] }))).toThrow('cycle')
  })
  it('preserves independent palette defaults and per-shape widths through JSON and LCAD', () => {
    const imported = importLcadDocument(source([
      { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, strokeWidth: 0.25 },
      { type: 'line', x1: 0, y1: 1, x2: 10, y2: 1 },
      { type: 'line', x1: 0, y1: 2, x2: 10, y2: 2, strokeWidth: 0 },
    ], { palettes: [{ id: 'p1', strokeWidth: 0.65 }] })).doc
    expect(imported.lineTypes[0].strokeWidthMm).toBe(0.65)
    expect(imported.objects.map(shape => shape.strokeWidthOverride)).toEqual([0.25, undefined, 0])
    imported.objects[0].strokeWidthOverride = 0.33
    const output = exportLcadDocument(imported)
    const payload = JSON.parse(output.text) as { palettes: Array<{ strokeWidth: number }>; shapes: Array<{ strokeWidth: number }> }
    expect(payload.palettes[0].strokeWidth).toBe(0.65)
    expect(payload.shapes.map((shape: { strokeWidth: number }) => shape.strokeWidth)).toEqual([0.33, 0.65, 0])
    const again = importLcadDocument(output.text).doc
    expect(again.objects.map(shape => shape.strokeWidthOverride)).toEqual([0.33, 0.65, 0])
    expect(() => importLcadDocument(source([{ type: 'line', x1: 0, y1: 0, x2: 1, y2: 1, strokeWidth: -1 }]))).toThrow('stroke width')
  })
  it('imports a reference-shaped four-edge rectangle with its actual coordinates and metadata', () => {
    const lines = [
      { type: 'line', x1: -25, y1: -19, x2: -1, y2: -19 },
      { type: 'line', x1: -1, y1: -19, x2: -1, y2: -3 },
      { type: 'line', x1: -1, y1: -3, x2: -25, y2: -3 },
      { type: 'line', x1: -25, y1: -3, x2: -25, y2: -19 },
    ]
    const result = importLcadDocument(source(lines))
    expect(result.doc.documentName).toBe('Interchange sample')
    expect(result.doc.projectMemo).toBe('Keep this memo')
    expect(result.summary.shapeCount).toBe(4)
    expect(result.doc.objects[0]).toMatchObject({ type: 'line', start: { x: -25, y: -19 }, end: { x: -1, y: -19 } })
    expect(result.warnings).toEqual([])
    expect(result.doc.lineTypes[0].color).toBe('#123456')
  })

  it('maps palette overrides, layer visibility, flat groups, and display-only inch units', () => {
    const result = importLcadDocument(source([{ type: 'line', x1: 0, y1: 0, x2: 25.4, y2: 0, groupId: 'group', strokeDash: 'dotted' }], {
      unit_for_view: 'inch', layers: [{ id: 'main', name: 'Hidden', visible: false, locked: true }],
      groups: [{ id: 'group', name: 'Wallet edge' }], palettes: [{ id: 'p1', name: 'Cutting', colorLight: '#fedcba', strokeDash: 'dashed', visible: false }],
    }))
    expect(result.doc.layers[0]).toMatchObject({ name: 'Hidden', visible: false, locked: true })
    expect(result.doc.objects[0].groupId).toBe(result.doc.sketchGroups?.[0].id)
    expect(result.doc.lineTypes[0]).toMatchObject({ name: 'Cutting', color: '#123456', style: 'dotted', visible: false })
    expect(endpoints(result.doc.objects[0]).end.x).toBe(25.4)
    expect(result.warnings).toContain('Source inch display units were converted to mm display; geometry remains in its original millimetres')
  })

  it('preserves exact circles and the direction of circular arcs', () => {
    const result = importLcadDocument(source([{ type: 'circle', cx: 10, cy: 20, r: 4 }, { type: 'arc', cx: 0, cy: 0, r: 5, startAngle: 0, endAngle: Math.PI / 2, ccw: true }]))
    expect(result.doc.objects).toHaveLength(7)
    for (const shape of result.doc.objects.slice(0, 4)) {
      expect(shape.type).toBe('arc')
      for (const point of sampleShapePoints(shape, 12)) expect(Math.hypot(point.x - 10, point.y - 20)).toBeCloseTo(4, 6)
    }
    expect(endpoints(result.doc.objects[4]).start).toEqual({ x: 5, y: 0 })
    expect(endpoints(result.doc.objects[4]).end.y).toBeCloseTo(-5, 6)
  })

  it('retains native rotated ellipse parameters without tessellation or warnings', () => {
    const result = importLcadDocument(source([{ type: 'ellipse', cx: 0, cy: 0, rx: 20, ry: 4, rotation: Math.PI / 2 }]))
    expect(result.doc.objects).toHaveLength(1)
    expect(result.doc.objects[0]).toMatchObject({ type: 'ellipse', center: { x: 0, y: 0 }, radiusX: 20, radiusY: 4, rotationDeg: 90 })
    expect(result.warnings).toEqual([])
  })

  it('retains native cubic control points and segment chains exactly', () => {
    const points = [{ x: 0, y: 0 }, { x: 0, y: 30 }, { x: 40, y: -20 }, { x: 30, y: 5 }]
    const result = importLcadDocument(source([{ type: 'bezier', points }]))
    expect(result.doc.objects).toHaveLength(1)
    expect(result.doc.objects[0]).toMatchObject({ type: 'cubic', start: points[0], control1: points[1], control2: points[2], end: points[3] })
    const exported = JSON.parse(exportLcadDocument(result.doc).text) as { shapes: Array<{ points: Array<{ x: number; y: number }> }> }
    expect(exported.shapes[0].points).toEqual(points)
    expect(result.warnings).toEqual([])
  })

  it('keeps independent stitch-hole positions, blade dimensions, and run order', () => {
    const result = importLcadDocument(source([
      { type: 'stitch_hole', stitchType: 'diamond', cx: 4, cy: 2, angle: Math.PI / 2, runId: 'run', seq: 2, holeW: 0.8, holeL: 2.4 },
      { type: 'stitch_hole', stitchType: 'european', cx: 0, cy: 2, angle: 0, runId: 'run', seq: 1 },
    ]))
    expect(result.summary.stitchHoleCount).toBe(2)
    const diamond = result.doc.stitchHoles?.find(hole => hole.renderShape === 'diamond')
    expect(diamond).toMatchObject({ point: { x: 4, y: 2 }, angleDeg: 0, tiltDeg: -32, widthMm: 0.8, heightMm: 2.4, chainId: 'run' })
    expect(result.doc.objects.some(shape => shape.id === diamond?.shapeId && shape.type === 'line' && shape.stitchHoleMarker)).toBe(true)
    expect(result.doc.stitchHoles?.find(hole => hole.renderShape === 'french')?.sequence).toBeLessThan(diamond!.sequence)
  })

  it('imports editable path outlines, linear dimensions, text and embedded tracing images', () => {
    const result = importLcadDocument(source([
      { type: 'path', polys: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]], fillOn: true },
      { type: 'dimension', kind: 'linear', x1: 0, y1: 0, x2: 10, y2: 0, offsetDist: 3 },
      { type: 'text', x: 2, y: 3, content: 'Pattern', fontSize: 5, rotation: Math.PI / 2, fontFamily: 'serif' },
      { type: 'tracing_image', imageData: 'data:image/png;base64,AA==', x: 3, y: 4, width: 20, height: 10, rotation: Math.PI / 2, srcWidthPx: 400, srcHeightPx: 200 },
    ]))
    expect(result.doc.objects).toHaveLength(4)
    expect(result.doc.dimensionLines?.[0]).toMatchObject({ offsetMm: 3, start: { x: 0, y: 0 }, end: { x: 10, y: 0 } })
    expect(result.doc.backdrops?.[0]).toMatchObject({ width: 20, height: 10, angleDeg: 90, bitmapWidth: 400 })
    const text = result.doc.objects.find(shape => shape.type === 'text')!
    expect(text.start.x).toBeCloseTo(text.end.x)
    expect(result.warnings).toContain('Filled source paths are imported as editable outlines')
  })

  it('round-trips supported geometry, stitches, groups and document metadata through export', () => {
    const first = importLcadDocument(source([
      { type: 'line', x1: 0, y1: 0, x2: 10, y2: 4, groupId: 'group' },
      { type: 'circle', cx: 5, cy: 6, r: 3 },
      { type: 'text', x: 2, y: 3, content: 'Label', fontSize: 4, rotation: 0 },
      { type: 'stitch_hole', stitchType: 'round', cx: 3, cy: 4, runId: 'holes', seq: 1, holeW: 1.4 },
    ], { groups: [{ id: 'group', name: 'Wallet' }] })).doc
    const output = exportLcadDocument(first)
    expect(output.warnings).toEqual([])
    const second = importLcadDocument(output.text).doc
    expect(second.objects).toHaveLength(first.objects.length)
    expect(second.documentName).toBe(first.documentName)
    expect(second.projectMemo).toBe(first.projectMemo)
    expect(second.sketchGroups?.[0].name).toBe('Wallet')
    expect(second.stitchHoles?.[0]).toMatchObject({ diameterMm: 1.4, point: { x: 3, y: 4 } })
    expect(second.objects.find(shape => shape.type === 'line' && !shape.stitchHoleMarker)).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 10, y: 4 } })
  })

  it('rejects unsupported, corrupt and ambiguous input instead of loading partial geometry', () => {
    expect(() => importLcadDocument(source([{ type: 'svg_image' }]))).toThrow('Unsupported .lcad shape type')
    expect(() => importLcadDocument(source([{ type: 'dot', cx: 2, cy: 3 }]))).toThrow('Unsupported .lcad shape type')
    expect(() => importLcadDocument(source([{ type: 'line', x1: null, y1: 0, x2: 2, y2: 0 }]))).toThrow('finite number')
    expect(() => importLcadDocument(source([{ id: 'duplicate', type: 'line', x1: 0, y1: 0, x2: 2, y2: 0 }, { id: 'duplicate', type: 'line', x1: 0, y1: 0, x2: 2, y2: 0 }]))).toThrow('Duplicate')
    expect(() => importLcadDocument(source([], { version: 3 }))).toThrow('Unsupported .lcad document')
    expect(() => importLcadDocument(source([{ type: 'tracing_image', imageData: 'https://example.test/image.png' }]))).toThrow('embed')
    expect(isLcadDocument(JSON.parse(source([])))).toBe(true)
    expect(isLcadDocument({ meta: { file_type: 'LeathercraftCAD' }, shapes: [] })).toBe(false)
  })

  it('preserves structured community attribution in a named extension without truncating it into memo', () => {
    const original = importLcadDocument(source([{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 }])).doc
    original.communityProvenance = [{ kind: 'community-pattern', patternId: 'source-123', version: 3, title: 'Original wallet', author: 'Original maker', attribution: 'Source credit '.repeat(1000), license: 'CC-BY-NC-4.0' }]
    original.projectMemo = 'Notes '.repeat(2000).slice(0, 8000)
    const output = exportLcadDocument(original)
    const encoded = JSON.parse(output.text) as { leathercad: { version: number; communityProvenance: unknown[] } }
    expect(encoded.leathercad.version).toBe(1)
    expect(encoded.leathercad.communityProvenance).toEqual(original.communityProvenance)
    expect(importLcadDocument(output.text).doc.communityProvenance).toEqual(original.communityProvenance)
    expect(() => importLcadDocument(source([], { leathercad: { version: 2, communityProvenance: original.communityProvenance } }))).toThrow('extension version')
  })
})

describe('sealed LCC safety', () => {
  it('rejects the outer compatibility artwork before it can be imported as the drawing', () => {
    const file = JSON.stringify({ meta: { file_type: 'LeathercraftCAD_Sealed', min_reader: '4.2.0' }, shapes: [{ type: 'TEXT', tx: 'Requires a newer reader' }], sealed: { ver: 1, enc: 'zlib+base64', data: 'AA==', mac: 'not-a-valid-signature' } })
    expect(() => importLccDocument(file)).toThrow('Sealed LCC files')
    expect(() => importLccDocument('\uFEFF' + file)).toThrow('current document was not changed')
    expect(() => importLccDocument(JSON.stringify({ meta: { file_type: 'LeathercraftCAD' }, sealed: null, shapes: [] }))).toThrow('Sealed LCC')
  })

  it('rejects attributed LCC export when the format cannot preserve structured source credit', async () => {
    const { exportLccDocument } = await import('./io-lcc')
    const doc = importLcadDocument(source([])).doc
    doc.communityProvenance = [{ kind: 'community-pattern', patternId: 'source-123', version: 1, title: 'Wallet', author: 'Maker', attribution: 'Maker credit', license: 'CC-BY-4.0' }]
    expect(() => exportLccDocument(doc)).toThrow('cannot preserve community source attribution')
  })
})

describe('LCAD drawings without their own palette', () => {
  const plain = (shapes: unknown[], extra = {}) => JSON.stringify({
    version: 2, name: 'Plain', layers: [{ id: 'main', name: 'Main' }], activeLayerId: 'main',
    shapes: shapes.map((shape, index) => ({ id: `s${index}`, layerId: 'main', ...shape as object })), ...extra,
  })

  it('maps palette slots to the reference default colours for both surfaces', () => {
    const { doc } = importLcadDocument(plain([
      { type: 'line', paletteId: 'p3', strokeColor: '#ffffff', strokeDash: 'solid', x1: 0, y1: 0, x2: 10, y2: 0 },
      { type: 'line', paletteId: 'p6', strokeColor: '#a0a0a0', strokeDash: 'dash-dot', x1: 0, y1: 5, x2: 10, y2: 5 },
      { type: 'stitch_hole', paletteId: 'p37', strokeColor: '#ffffff', stitchType: 'round', cx: 0, cy: 10 },
      { type: 'line', paletteId: 'p3', strokeColor: '#ff0000', x1: 0, y1: 15, x2: 10, y2: 15 },
    ]))
    const byName = Object.fromEntries(doc.lineTypes.map(type => [type.name + ':' + type.color, type]))
    expect(byName['Palette 3:#ffffff']).toMatchObject({ role: 'cut', colorLight: '#000000', style: 'solid' })
    expect(byName['Palette 6:#a0a0a0']).toMatchObject({ role: 'guide', colorLight: '#707070' })
    expect(byName['Palette 37 · stitch holes:#ffffff']).toMatchObject({ role: 'stitch', colorLight: '#d2691e' })
    // A stroke colour that is not the slot's own stays the shape's colour.
    expect(byName['Palette 3:#ff0000']).toBeDefined()
    expect(byName['Palette 3:#ff0000'].colorLight).toBeUndefined()
  })

  it('imports text at its drawn size with line spacing, and grid visibility', () => {
    const { doc } = importLcadDocument(plain([
      { type: 'text', paletteId: 'p1', x: 0, y: 0, content: '一行目\nsecond', fontSize: 7.2, lineSpacing: 1.5, fontFamily: 'Arial' },
    ], { gridVisible: false }))
    const text = doc.objects[0]
    expect(text.type).toBe('text')
    if (text.type !== 'text') return
    expect(text.text).toBe('一行目\nsecond')
    expect(text.fontSizeMm).toBeCloseTo(7.2 / 0.7188, 6)
    expect(text.lineSpacing).toBe(1.5)
    expect(doc.showGrid).toBe(false)
    const exported = JSON.parse(exportLcadDocument(doc).text) as { gridVisible: boolean; shapes: Array<{ fontSize: number; lineSpacing: number }> }
    expect(exported.gridVisible).toBe(false)
    expect(exported.shapes[0].fontSize).toBeCloseTo(7.2, 6)
    expect(exported.shapes[0].lineSpacing).toBe(1.5)
  })
})
