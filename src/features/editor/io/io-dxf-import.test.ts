import { describe, expect, it } from 'vitest'
import { importDxfDocument } from './io-dxf-import'
import { buildDxfFromShapes } from './io-dxf'
import type { ArcShape, LineShape } from '../cad/cad-types'

type Pair = [number, string | number]
const entity = (type: string, values: Pair[] = []): Pair[] => [[0, type], ...values]
const line = (values: Pair[] = []): Pair[] => entity('LINE', [[10, 0], [20, 0], [11, 10], [21, 5], ...values])
const section = (name: string, pairs: Pair[]): Pair[] => [[0, 'SECTION'], [2, name], ...pairs, [0, 'ENDSEC']]
function document(entities: Pair[], options: { units?: number; tables?: Pair[]; blocks?: Pair[] } = {}) {
  return [...section('HEADER', [[9, '$INSUNITS'], [70, options.units ?? 4]]), ...section('TABLES', options.tables ?? []), ...section('BLOCKS', options.blocks ?? []), ...section('ENTITIES', entities), [0, 'EOF']].flat().join('\n') + '\n'
}
function expectPoint(point: { x: number; y: number }, x: number, y: number) {
  expect(point.x).toBeCloseTo(x, 6)
  expect(point.y).toBeCloseTo(y, 6)
}

describe('importDxfDocument', () => {
  it('converts inches and Y-up coordinates while preserving source layers, visibility and style', () => {
    const raw = document(line([[8, 'stitch holes']]), { units: 1, tables: entity('LAYER', [[2, 'stitch holes'], [62, -3], [70, 4], [6, 'DASHED'], [370, 25]]) })
    const result = importDxfDocument(raw)
    expectPoint(result.shapes[0].end, 254, -127)
    expect(result.layers[0]).toMatchObject({ name: 'stitch holes', visible: false, locked: true })
    expect(result.lineTypes[0]).toMatchObject({ role: 'stitch', style: 'dashed', color: '#00ff00', strokeWidthMm: 0.25 })
    expect(result.shapes[0].layerId).toBe(result.layers[0].id)
    expect(result.shapes[0].lineTypeId).toBe(result.lineTypes[0].id)
    expect(result.warnings).toEqual([])
  })

  it('handles true colours, unit override, and unspecified units explicitly', () => {
    const raw = document(line([[420, 0x12abcd]]), { units: 0 })
    expect(importDxfDocument(raw).warnings[0]).toContain('unspecified')
    const result = importDxfDocument(raw, { units: 'cm', flipY: false })
    expectPoint(result.shapes[0].end, 100, 50)
    expect(result.lineTypes[0].color).toBe('#12abcd')
    expect(result.warnings).toEqual([])
  })

  it('keeps circular geometry as exact native arcs including arcs that cross zero degrees', () => {
    const raw = document([...entity('CIRCLE', [[10, 3], [20, 4], [40, 2]]), ...entity('ARC', [[10, 0], [20, 0], [40, 10], [50, 350], [51, 10]])])
    const result = importDxfDocument(raw, { flipY: false })
    expect(result.shapes).toHaveLength(5)
    const circle = result.shapes.slice(0, 4) as ArcShape[]
    expect(circle.every((shape) => shape.type === 'arc')).toBe(true)
    expectPoint(circle[0].start, 5, 4)
    expectPoint(circle[3].end, 5, 4)
    expectPoint((result.shapes[4] as ArcShape).mid, 10, 0)
  })

  it('imports closed lightweight polylines and positive/negative bulges without losing their direction', () => {
    const result = importDxfDocument(document(entity('LWPOLYLINE', [[70, 1], [10, 0], [20, 0], [42, 1], [10, 10], [20, 0], [42, -1]])), { flipY: false })
    expect(result.shapes).toHaveLength(4)
    expect(result.shapes.every((shape) => shape.type === 'arc')).toBe(true)
    const arcs = result.shapes as ArcShape[]
    expectPoint(arcs[0].start, 0, 0)
    expectPoint(arcs[1].end, 10, 0)
    expectPoint(arcs[2].start, 10, 0)
    expectPoint(arcs[3].end, 0, 0)
    expect(arcs[0].mid.y).toBeLessThan(0)
    expect(arcs[2].mid.y).toBeLessThan(0)
  })

  it('consumes classic POLYLINE vertices without swallowing the following entity', () => {
    const raw = document([...entity('POLYLINE', [[70, 1]]), ...entity('VERTEX', [[10, 0], [20, 0]]), ...entity('VERTEX', [[10, 10], [20, 0]]), ...entity('VERTEX', [[10, 10], [20, 10]]), ...entity('SEQEND'), ...line()])
    const result = importDxfDocument(raw)
    expect(result.shapes).toHaveLength(4)
    expect(result.summary.sourceEntityCount).toBe(2)
  })

  it('applies nested block origin, rotation, scale, inherited layer, and BYBLOCK colour', () => {
    const blocks = [...entity('BLOCK', [[2, 'edge'], [10, 2], [20, 1]]), ...entity('LINE', [[8, '0'], [62, 0], [10, 2], [20, 1], [11, 3], [21, 1]]), ...entity('ENDBLK'), ...entity('BLOCK', [[2, 'parent']]), ...entity('INSERT', [[2, 'edge'], [10, 4], [20, 0], [41, 2], [42, 2]]), ...entity('ENDBLK')]
    const raw = document(entity('INSERT', [[2, 'parent'], [8, 'Outer'], [62, 1], [10, 10], [20, 20], [50, 90]]), { blocks })
    const result = importDxfDocument(raw, { flipY: false })
    expect(result.layers[0].name).toBe('Outer')
    expect(result.lineTypes[0].color).toBe('#ff0000')
    expectPoint(result.shapes[0].start, 10, 24)
    expectPoint(result.shapes[0].end, 10, 26)
  })

  it('approximates nonuniformly scaled circles as ellipses rather than incorrect circular arcs', () => {
    const blocks = [...entity('BLOCK', [[2, 'round']]), ...entity('CIRCLE', [[40, 5]]), ...entity('ENDBLK')]
    const result = importDxfDocument(document(entity('INSERT', [[2, 'round'], [41, 2], [42, 1]]), { blocks }), { flipY: false })
    expect(result.shapes.every((shape) => shape.type === 'line')).toBe(true)
    const points = result.shapes.flatMap((shape) => [shape.start, shape.end])
    expect(Math.max(...points.map((point) => point.x))).toBeCloseTo(10)
    expect(Math.max(...points.map((point) => point.y))).toBeCloseTo(5)
    expect(result.warnings.join(' ')).toContain('non-uniform')
  })

  it('samples rational splines using their knots and weights, not their control polygon', () => {
    const raw = document(entity('SPLINE', [[71, 2], [40, 0], [40, 0], [40, 0], [40, 1], [40, 1], [40, 1], [10, 1], [20, 0], [41, 1], [10, 1], [20, 1], [41, Math.SQRT1_2], [10, 0], [20, 1], [41, 1]]))
    const result = importDxfDocument(raw, { flipY: false, curveToleranceMm: 0.001 })
    expect(result.shapes.length).toBeGreaterThan(8)
    for (const shape of result.shapes) expect(Math.hypot(shape.start.x, shape.start.y)).toBeCloseTo(1, 6)
    expectPoint(result.shapes[0].start, 1, 0)
    expectPoint(result.shapes[result.shapes.length - 1].end, 0, 1)
    expect(result.warnings.join(' ')).toContain('SPLINE')
  })

  it('imports elliptical arcs with transformed axes and explicit approximation warnings', () => {
    const result = importDxfDocument(document(entity('ELLIPSE', [[10, 10], [20, 20], [11, 0], [21, 8], [40, 0.5], [41, 0], [42, Math.PI / 2]])), { flipY: false })
    expectPoint(result.shapes[0].start, 10, 28)
    expectPoint(result.shapes[result.shapes.length - 1].end, 6, 20)
    expect(result.warnings.join(' ')).toContain('ELLIPSE')
  })

  it('warns about unsupported, recursive, and non-planar geometry while retaining supported entities', () => {
    const blocks = [...entity('BLOCK', [[2, 'cycle']]), ...entity('INSERT', [[2, 'cycle']]), ...entity('ENDBLK')]
    const result = importDxfDocument(document([...entity('TEXT', [[1, 'text']]), ...entity('INSERT', [[2, 'cycle']]), ...line([[210, 1]]), ...line()], { blocks }))
    expect(result.shapes).toHaveLength(1)
    expect(result.summary.skippedEntityCount).toBe(3)
    expect(result.warnings.join(' ')).toMatch(/TEXT.*recursive.*non-planar/)
  })

  it('skips tilted 3D lines and reports constant elevation projection', () => {
    const result = importDxfDocument(document([...line([[31, 8]]), ...line([[30, 3], [31, 3]])]))
    expect(result.shapes).toHaveLength(1)
    expect(result.warnings.join(' ')).toContain('varying Z')
    expect(result.warnings.join(' ')).toContain('Constant Z')
  })

  it('resolves block names case-insensitively and preserves extended ACI colours', () => {
    const blocks = [...entity('BLOCK', [[2, 'MiXeD']]), ...line([[62, 20]]), ...entity('ENDBLK')]
    const result = importDxfDocument(document(entity('INSERT', [[2, 'mixed']]), { blocks }))
    expect(result.shapes).toHaveLength(1)
    expect(result.lineTypes[0].color).toBe('#ff3f00')
  })

  it('fails clearly for binary, malformed, invalid numeric, and empty unsupported input', () => {
    expect(() => importDxfDocument('AutoCAD Binary DXF\r\n\0')).toThrow(/Binary DXF/)
    expect(() => importDxfDocument('0\nSECTION\n2')).toThrow(/incomplete/)
    expect(() => importDxfDocument('bad\nSECTION\n')).toThrow(/group code/)
    expect(() => importDxfDocument(document(entity('LINE', [[10, 'NaN']])))).toThrow(/numeric/)
    expect(() => importDxfDocument(document(entity('SPLINE', [[71, 3]])))).toThrow(/SPLINE/)
    expect(() => importDxfDocument(document(entity('TEXT')))).toThrow(/No supported geometry.*TEXT/)
  })

  it('round-trips our DXF export coordinates and physical units', () => {
    const original: LineShape = { id: 'a', type: 'line', layerId: 'Cut', lineTypeId: 'cut', start: { x: 25.4, y: 50.8 }, end: { x: 76.2, y: 101.6 } }
    const result = importDxfDocument(buildDxfFromShapes([original], { flipY: true, unit: 'in' }).content)
    expectPoint(result.shapes[0].start, original.start.x, original.start.y)
    expectPoint(result.shapes[0].end, original.end.x, original.end.y)
  })
})
