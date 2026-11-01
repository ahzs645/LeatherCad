import { uid } from '../cad/cad-geometry'
import type { Layer, LineType, LineTypeStyle, Point, Shape } from '../cad/cad-types'
import { bulgeArc, IDENTITY, isSimilarity, multiplyMatrices, sampleCurve, TAU, transformPoint, type DxfMatrix } from './dxf/dxf-geometry'
import { dxfNumber, dxfPoints, dxfValue, parseAsciiDxf, type DxfRecord } from './dxf/dxf-parser'
import { createSplineEvaluator } from './dxf/dxf-spline'
import { transformNativeCurve } from '../cad/native-curve-ops'
import { assertImportLayerBudget, assertImportTextBudget } from './import-budget'

export type DxfImportOptions = {
  units?: 'auto' | 'mm' | 'in' | 'cm' | 'm'
  /** DXF uses Y-up; the editor uses Y-down. Enabled by default. */
  flipY?: boolean
  curveToleranceMm?: number
}
export type DxfImportResult = {
  shapes: Shape[]
  layers: Layer[]
  lineTypes: LineType[]
  warnings: string[]
  summary: { shapeCount: number; layerCount: number; sourceEntityCount: number; skippedEntityCount: number; unitScaleMm: number }
}
const UNIT_SCALES: Record<number, number> = { 1: 25.4, 2: 304.8, 3: 1609344, 4: 1, 5: 10, 6: 1000, 7: 1e6, 8: 0.0000254, 9: 0.0254, 10: 914.4, 11: 1e-7, 12: 1e-6, 13: 0.001, 14: 100, 15: 10000, 16: 100000 }
const ACI: Record<number, string> = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#ffffff', 8: '#808080', 9: '#c0c0c0' }
function lineStyle(name: string): LineTypeStyle {
  const value = name.toUpperCase()
  if (value.includes('DASH') && value.includes('DOT')) return 'dash-dot-dot'
  if (value.includes('DOT')) return 'dotted'
  return /DASH|HIDDEN|CENTER/.test(value) ? 'dashed' : 'solid'
}
function aciColor(index: number): string | undefined {
  if (ACI[index]) return ACI[index]
  if (index >= 250 && index <= 255) {
    const value = [51, 80, 105, 130, 190, 255][index - 250].toString(16).padStart(2, '0')
    return `#${value}${value}${value}`
  }
  if (index < 10 || index > 249) return undefined
  const hue = Math.floor((index - 10) / 10) / 4, saturation = index % 2 ? 0.5 : 1
  const value = [255, 204, 153, 127, 76][Math.floor(index % 10 / 2)]
  const chroma = value * saturation, secondary = chroma * (1 - Math.abs(hue % 2 - 1)), offset = value - chroma
  const channels = hue < 1 ? [chroma, secondary, 0] : hue < 2 ? [secondary, chroma, 0] : hue < 3 ? [0, chroma, secondary] : hue < 4 ? [0, secondary, chroma] : hue < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary]
  return `#${channels.map((channel) => Math.floor(channel + offset).toString(16).padStart(2, '0')).join('')}`
}
function colorFor(record: DxfRecord, fallback: string): string {
  const trueColor = dxfValue(record, 420)
  if (trueColor !== undefined) return `#${(dxfNumber(record, 420) & 0xffffff).toString(16).padStart(6, '0')}`
  return aciColor(Math.abs(dxfNumber(record, 62, 256))) ?? fallback
}
function weightFor(record: DxfRecord, layer: DxfRecord | undefined, inherited?: number): number | undefined {
  const weight = dxfNumber(record, 370, -1)
  if (weight >= 0) return weight / 100
  if (weight === -2 && inherited !== undefined) return inherited
  const layerWeight = layer ? dxfNumber(layer, 370, -3) : -3
  return layerWeight >= 0 ? layerWeight / 100 : undefined
}

/** Import planar ASCII DXF geometry, preserving source layers and styles. */
export function importDxfDocument(raw: string, options: DxfImportOptions = {}): DxfImportResult {
  assertImportTextBudget(raw)
  const source = parseAsciiDxf(raw)
  const warnings = new Set<string>()
  const shapes: Shape[] = [], layers: Layer[] = [], lineTypes: LineType[] = []
  const layerMap = new Map<string, { layer: Layer; record: DxfRecord | undefined }>()
  const styleMap = new Map<string, LineType>()
  const sourceLayers = new Map(source.layers.map((record) => [dxfValue(record, 2) ?? '0', record]))
  let skippedEntityCount = 0
  const explicitScale = { mm: 1, in: 25.4, cm: 10, m: 1000 }
  const scale = options.units && options.units !== 'auto' ? explicitScale[options.units] : UNIT_SCALES[source.unitCode] ?? 1
  if ((!options.units || options.units === 'auto') && !(source.unitCode in UNIT_SCALES)) {
    warnings.add(source.unitCode === 0 ? 'DXF units are unspecified; interpreted as millimetres. Choose a unit override if necessary.' : `Unsupported DXF unit code ${source.unitCode}; interpreted as millimetres.`)
  }
  const tolerance = options.curveToleranceMm ?? 0.05
  if (!(tolerance > 0 && Number.isFinite(tolerance))) throw new Error('DXF curve tolerance must be a positive number')
  const world: DxfMatrix = [scale, 0, 0, options.flipY === false ? scale : -scale, 0, 0]
  const metadata = (record: DxfRecord, inheritedLayer = '0', inheritedColor?: string, inheritedWeight?: number): Pick<Shape, 'layerId' | 'lineTypeId' | 'strokeWidthOverride'> => {
    const rawLayer = dxfValue(record, 8) ?? '0'
    const name = rawLayer === '0' ? inheritedLayer : rawLayer
    let entry = layerMap.get(name)
    if (!entry) {
      assertImportLayerBudget(layers.length + 1)
      const layerRecord = sourceLayers.get(name)
      const flags = layerRecord ? dxfNumber(layerRecord, 70) : 0
      const layer: Layer = { id: uid(), name, visible: !(flags & 1) && (!layerRecord || dxfNumber(layerRecord, 62, 7) >= 0), locked: Boolean(flags & 4), stackLevel: layers.length }
      entry = { layer, record: layerRecord }
      layerMap.set(name, entry)
      layers.push(layer)
    }
    const layerColor = entry.record ? colorFor(entry.record, '#ffffff') : '#ffffff'
    const rawColor = dxfNumber(record, 62, 256)
    const color = rawColor === 0 && inheritedColor ? inheritedColor : colorFor(record, layerColor)
    let styleName = dxfValue(record, 6) ?? 'BYLAYER'
    if (/^BYLAYER$/i.test(styleName)) styleName = entry.record ? dxfValue(entry.record, 6) ?? 'CONTINUOUS' : 'CONTINUOUS'
    const style = lineStyle(styleName)
    const weight = weightFor(record, entry.record, inheritedWeight)
    const key = `${name}|${color}|${style}|${weight ?? 'default'}`
    let lineType = styleMap.get(key)
    if (!lineType) {
      lineType = { id: uid(), name: `${name} (${styleName})`, role: /stitch/i.test(name) ? 'stitch' : /fold/i.test(name) ? 'fold' : 'cut', color, style, visible: true }
      if (weight !== undefined) lineType.strokeWidthMm = weight
      styleMap.set(key, lineType)
      lineTypes.push(lineType)
    }
    return { layerId: entry.layer.id, lineTypeId: lineType.id, ...(weight !== undefined && weight < 0.1 ? { strokeWidthOverride: weight } : {}) }
  }
  const line = (start: Point, end: Point, meta: Pick<Shape, 'layerId' | 'lineTypeId'>) => {
    if (shapes.length >= 200000) throw new Error('DXF exceeds the 200,000 shape import limit')
    if (Math.hypot(end.x - start.x, end.y - start.y) > 1e-10) shapes.push({ id: uid(), type: 'line', ...meta, start, end })
  }
  const polyline = (points: Point[], meta: Pick<Shape, 'layerId' | 'lineTypeId'>) => {
    for (let index = 1; index < points.length; index++) line(points[index - 1], points[index], meta)
  }
  const arc = (center: Point, radius: number, start: number, sweep: number, matrix: DxfMatrix, meta: Pick<Shape, 'layerId' | 'lineTypeId'>) => {
    if (!(radius > 0) || Math.abs(sweep) < 1e-10) throw new Error('Invalid circular DXF entity')
    const evaluate = (t: number) => transformPoint(matrix, { x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) })
    if (isSimilarity(matrix)) {
      // Full circles use four native arcs; a single coincident-endpoint arc is ambiguous.
      const count = Math.ceil(Math.abs(sweep) / (Math.PI / 2))
      if (shapes.length + count > 200000) throw new Error('DXF exceeds the 200,000 shape import limit')
      for (let index = 0; index < count; index++) {
        const from = start + sweep * index / count, to = start + sweep * (index + 1) / count
        shapes.push({ id: uid(), type: 'arc', ...meta, start: evaluate(from), mid: evaluate((from + to) / 2), end: evaluate(to) })
      }
    } else {
      if (shapes.length >= 200000) throw new Error('DXF exceeds the 200,000 shape import limit')
      shapes.push(transformNativeCurve({ id: uid(), type: 'ellipse', ...meta, center, radiusX: radius, radiusY: radius, rotationDeg: 0, startAngleDeg: start * 180 / Math.PI, sweepDeg: sweep * 180 / Math.PI }, matrix))
    }
  }
  const process = (records: DxfRecord[], parent: DxfMatrix, inheritedLayer = '0', blockPath: string[] = [], inheritedColor?: string, inheritedWeight?: number) => {
    for (let index = 0; index < records.length; index++) {
      const record = records[index]
      if (record.type === 'SEQEND' || record.type === 'VERTEX' || record.type === 'ATTRIB') continue
      if (dxfNumber(record, 67) === 1) { skippedEntityCount++; warnings.add('Paper-space entities were skipped; only model space is imported.'); continue }
      const normalX = dxfNumber(record, 210), normalY = dxfNumber(record, 220), normalZ = dxfNumber(record, 230, 1)
      if (Math.abs(normalX) > 1e-8 || Math.abs(normalY) > 1e-8 || Math.abs(Math.abs(normalZ) - 1) > 1e-8) {
        skippedEntityCount++; warnings.add(`${record.type} with a non-planar extrusion normal was skipped.`); continue
      }
      const matrix = normalZ < 0 ? multiplyMatrices(parent, [-1, 0, 0, 1, 0, 0]) : parent
      if (record.type === 'INSERT') {
        const name = dxfValue(record, 2) ?? '', blockKey = name.toUpperCase(), block = source.blocks.get(blockKey)
        if (!block || blockPath.includes(blockKey) || blockPath.length >= 16) {
          skippedEntityCount++; warnings.add(`Block ${name || '(unnamed)'} was missing or recursive; its insert was skipped.`); continue
        }
        const angle = dxfNumber(record, 50) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle)
        const sx = dxfNumber(record, 41, 1), sy = dxfNumber(record, 42, 1)
        if (!sx || !sy) { skippedEntityCount++; warnings.add(`Block ${name} has zero scale and was skipped.`); continue }
        const columns = Math.max(1, Math.floor(dxfNumber(record, 70, 1))), rows = Math.max(1, Math.floor(dxfNumber(record, 71, 1)))
        if (columns * rows > 10000) throw new Error('DXF block array exceeds the 10,000 instance import limit')
        const layer = dxfValue(record, 8) || inheritedLayer
        const layerRecord = sourceLayers.get(layer)
        const color = colorFor(record, inheritedColor ?? (layerRecord ? colorFor(layerRecord, '#ffffff') : '#ffffff'))
        const weight = weightFor(record, layerRecord, inheritedWeight)
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
          const offsetX = column * dxfNumber(record, 44), offsetY = row * dxfNumber(record, 45)
          const insert: DxfMatrix = [cos * sx, sin * sx, -sin * sy, cos * sy, dxfNumber(record, 10) + cos * offsetX - sin * offsetY - cos * sx * block.x + sin * sy * block.y, dxfNumber(record, 20) + sin * offsetX + cos * offsetY - sin * sx * block.x - cos * sy * block.y]
          process(block.records, multiplyMatrices(matrix, insert), layer === '0' ? inheritedLayer : layer, [...blockPath, blockKey], color, weight)
        }
        continue
      }
      const supported = ['LINE', 'ARC', 'CIRCLE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE', 'ELLIPSE']
      if (!supported.includes(record.type)) { skippedEntityCount++; warnings.add(`Unsupported ${record.type} entities were skipped.`); continue }
      const zValues = record.pairs.filter((pair) => pair.code === 30 || (record.type === 'LINE' && pair.code === 31)).map((pair) => Number(pair.value))
      if (zValues.some((value) => !Number.isFinite(value))) throw new Error(`Invalid elevation in ${record.type}`)
      if ((record.type === 'LINE' && Math.abs(dxfNumber(record, 30) - dxfNumber(record, 31)) > 1e-8) || zValues.some((value) => Math.abs(value - (zValues[0] ?? 0)) > 1e-8) || (record.type === 'ELLIPSE' && Math.abs(dxfNumber(record, 31)) > 1e-8)) {
        skippedEntityCount++; warnings.add(`${record.type} with varying Z coordinates was skipped.`); continue
      }
      if (zValues.some((value) => Math.abs(value) > 1e-8)) warnings.add('Constant Z elevations were projected onto the XY plane.')
      const meta = metadata(record, inheritedLayer, inheritedColor, inheritedWeight)
      if (record.type === 'LINE') {
        line(transformPoint(matrix, { x: dxfNumber(record, 10), y: dxfNumber(record, 20) }), transformPoint(matrix, { x: dxfNumber(record, 11), y: dxfNumber(record, 21) }), meta)
      } else if (record.type === 'ARC' || record.type === 'CIRCLE') {
        const start = record.type === 'CIRCLE' ? 0 : dxfNumber(record, 50) * Math.PI / 180
        const end = record.type === 'CIRCLE' ? TAU : dxfNumber(record, 51) * Math.PI / 180
        arc({ x: dxfNumber(record, 10), y: dxfNumber(record, 20) }, dxfNumber(record, 40), start, record.type === 'CIRCLE' ? TAU : ((end - start) % TAU + TAU) % TAU || TAU, matrix, meta)
      } else if (record.type === 'LWPOLYLINE' || record.type === 'POLYLINE') {
        let points = dxfPoints(record)
        if (record.type === 'POLYLINE') {
          const flags = dxfNumber(record, 70)
          if (flags & (8 | 16 | 64)) { skippedEntityCount++; warnings.add('3D/mesh POLYLINE entities were skipped.'); continue }
          points = []
          while (records[index + 1]?.type === 'VERTEX') {
            const vertex = records[++index]
            if (vertex.pairs.some((pair) => [40, 41].includes(pair.code) && Number(pair.value) !== 0)) warnings.add('Polyline widths were ignored; centreline geometry was imported.')
            points.push(...dxfPoints(vertex))
          }
        }
        const closed = Boolean(dxfNumber(record, 70) & 1)
        for (let vertex = 0; vertex < points.length - (closed ? 0 : 1); vertex++) {
          const from = points[vertex], to = points[(vertex + 1) % points.length], curve = bulgeArc(from, to, from.bulge)
          if (curve) arc(curve.center, curve.radius, curve.angle, curve.sweep, matrix, meta)
          else line(transformPoint(matrix, from), transformPoint(matrix, to), meta)
        }
        if (record.pairs.some((pair) => [40, 41, 43].includes(pair.code) && Number(pair.value) !== 0)) warnings.add('Polyline widths were ignored; centreline geometry was imported.')
      } else if (record.type === 'SPLINE') {
        const controls = dxfPoints(record), degree = dxfNumber(record, 71, 3)
        const knots = record.pairs.filter(pair => pair.code === 40).map(pair => Number(pair.value))
        const weights = record.pairs.filter(pair => pair.code === 41).map(pair => Number(pair.value))
        const spline = createSplineEvaluator(record)
        const exactBezier = (degree === 2 || degree === 3) && controls.length === degree + 1 && knots.length === (degree + 1) * 2 && knots.slice(0, degree + 1).every(knot => knot === knots[0]) && knots.slice(degree + 1).every(knot => knot === knots.at(-1)) && (!weights.length || weights.every(weight => weight === weights[0]))
        if (exactBezier) {
          if (shapes.length >= 200000) throw new Error('DXF exceeds the 200,000 shape import limit')
          const points = controls.map(point => transformPoint(matrix, point))
          shapes.push(degree === 2 ? { id: uid(), type: 'bezier', ...meta, start: points[0], control: points[1], end: points[2] } : { id: uid(), type: 'cubic', ...meta, start: points[0], control1: points[1], control2: points[2], end: points[3] })
        } else {
          for (let span = 1; span < spline.spans.length; span++) polyline(sampleCurve((t) => transformPoint(matrix, spline.evaluate(t)), spline.spans[span - 1], spline.spans[span], tolerance), meta)
          warnings.add(`SPLINE curves were approximated with line segments (target tolerance ${tolerance} mm).`)
        }
      } else if (record.type === 'ELLIPSE') {
        const center = { x: dxfNumber(record, 10), y: dxfNumber(record, 20) }, major = { x: dxfNumber(record, 11), y: dxfNumber(record, 21) }
        const ratio = dxfNumber(record, 40), start = dxfNumber(record, 41), end = dxfNumber(record, 42, TAU)
        if (!(ratio > 0) || Math.hypot(major.x, major.y) === 0) throw new Error('Invalid DXF ELLIPSE')
        const sweep = ((end - start) % TAU + TAU) % TAU || TAU
        if (shapes.length >= 200000) throw new Error('DXF exceeds the 200,000 shape import limit')
        const radius = Math.hypot(major.x, major.y)
        shapes.push(transformNativeCurve({ id: uid(), type: 'ellipse', ...meta, center, radiusX: radius, radiusY: radius * ratio, rotationDeg: Math.atan2(major.y, major.x) * 180 / Math.PI, startAngleDeg: start * 180 / Math.PI, sweepDeg: sweep * 180 / Math.PI }, matrix))
      }
    }
  }
  process(source.entities, multiplyMatrices(world, IDENTITY))
  if (!shapes.length) throw new Error(`No supported geometry found in DXF${warnings.size ? `: ${[...warnings].join(' ')}` : ''}`)
  return { shapes, layers, lineTypes, warnings: [...warnings], summary: { shapeCount: shapes.length, layerCount: layers.length, sourceEntityCount: source.entities.filter((entity) => !['VERTEX', 'SEQEND', 'ATTRIB'].includes(entity.type)).length, skippedEntityCount, unitScaleMm: scale } }
}
