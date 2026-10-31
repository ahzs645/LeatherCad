import { sampleShapePoints } from '../cad/cad-geometry'
import type { ArcShape, BezierShape, CubicShape, EllipseShape, Layer, LineType, LineTypeStyle, Point, Shape, StitchHole } from '../cad/cad-types'
import { transformNativeCurve } from '../cad/native-curve-ops'
import { completeModernDxf } from './dxf/dxf-export-structure'
import { escapeDxfText } from './dxf/dxf-text'
import { MAX_IMPORT_GEOMETRY } from './import-budget'
import { flattenManufacturingShape } from './manufacturing/manufacturing-curves'
import { createStitchHolePrimitive, type StitchHoleRenderMode } from '../ops/stitch-hole-render'

function assertDxfExportBudget(count: number): void {
  if (count > MAX_IMPORT_GEOMETRY) throw new Error('DXF export exceeds the 200,000 entity budget. Reduce the selection or use a native-curve DXF version.')
}

type DxfVersion = 'r12' | 'r14' | 'r2004'
const TAU = Math.PI * 2
type DxfExportOptions = {
  layers?: Layer[]
  lineTypes?: LineType[]
  curveToleranceMm?: number
  flipY?: boolean
  version?: DxfVersion
  unit?: 'mm' | 'in'
  forceSolidLineStyle?: boolean
  lineTypeStyles?: Record<string, LineTypeStyle>
  stitchHoles?: StitchHole[]
  stitchHoleRenderMode?: StitchHoleRenderMode
  stitchDotRadiusMm?: number
}

type EntityAppearance = { color?: string; strokeWidthMm?: number }
const DXF_LINEWEIGHTS = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211]
function dxfLineweight(widthMm: number): number {
  const value = widthMm * 100
  return DXF_LINEWEIGHTS.reduce((best, weight) => Math.abs(weight - value) < Math.abs(best - value) ? weight : best)
}
type Segment = EntityAppearance & {
  layerName: string
  lineTypeName: 'CONTINUOUS' | 'DASHED' | 'DOTTED' | 'DASHDOTDOT'
  x1: number
  y1: number
  x2: number
  y2: number
}

function sanitizeLayerName(value: string) {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return 'Layer0'
  }
  return [...trimmed.replace(/[<>/\\":;?*|=,]/g, '_')].map(character => character.charCodeAt(0) < 32 ? '_' : character).join('')
}

function dxfLineTypeFromStyle(style: LineTypeStyle) {
  if (style === 'dash-dot-dot') {
    return 'DASHDOTDOT' as const
  }
  if (style === 'dashed') {
    return 'DASHED' as const
  }
  if (style === 'dotted') {
    return 'DOTTED' as const
  }
  return 'CONTINUOUS' as const
}

function createSegment(
  start: { x: number; y: number },
  end: { x: number; y: number },
  meta: Pick<Segment, 'layerName' | 'lineTypeName' | 'color' | 'strokeWidthMm'>,
  options: Required<Pick<DxfExportOptions, 'flipY'>> & { unit: 'mm' | 'in' },
): Segment {
  const signY = options.flipY ? -1 : 1
  const unitScale = options.unit === 'in' ? 1 / 25.4 : 1
  return {
    ...meta,
    x1: start.x * unitScale,
    y1: start.y * signY * unitScale,
    x2: end.x * unitScale,
    y2: end.y * signY * unitScale,
  }
}

function pointsToSegments(
  points: Array<{ x: number; y: number }>,
  meta: Pick<Segment, 'layerName' | 'lineTypeName' | 'color' | 'strokeWidthMm'>,
  options: Required<Pick<DxfExportOptions, 'flipY'>> & { unit: 'mm' | 'in' },
  close = false,
) {
  const segments: Segment[] = []
  if (points.length < 2) {
    return segments
  }

  for (let index = 1; index < points.length; index += 1) {
    segments.push(createSegment(points[index - 1], points[index], meta, options))
  }

  if (close) {
    segments.push(createSegment(points[points.length - 1], points[0], meta, options))
  }

  return segments
}

function buildShapeSegmentMeta(
  shape: Shape,
  options: Required<Pick<DxfExportOptions, 'forceSolidLineStyle'>> & {
    lineTypeStyles: Record<string, LineTypeStyle>
    layerNames?: Record<string, string>
    typesById?: Record<string, LineType>
  },
) {
  const type = options.typesById?.[shape.lineTypeId]
  const style = options.lineTypeStyles[shape.lineTypeId] ?? type?.style ?? 'solid'
  return {
    layerName: options.layerNames?.[shape.layerId] ?? sanitizeLayerName(shape.layerId),
    color: type?.color,
    strokeWidthMm: shape.strokeWidthOverride ?? type?.strokeWidthMm,
    lineTypeName: options.forceSolidLineStyle ? ('CONTINUOUS' as const) : dxfLineTypeFromStyle(style),
  }
}

function toSegments(shape: Shape, options: Required<Pick<DxfExportOptions, 'flipY' | 'forceSolidLineStyle'>> & {
  unit: 'mm' | 'in'
  lineTypeStyles: Record<string, LineTypeStyle>
  layerNames?: Record<string, string>
  typesById?: Record<string, LineType>
  curveToleranceMm?: number
}) {
  const sampled = shape.type === 'text' ? sampleShapePoints(shape, 72) : flattenManufacturingShape(shape, options.curveToleranceMm ?? 0.02)
  return pointsToSegments(sampled, buildShapeSegmentMeta(shape, options), options)
}

type CircleEntity = EntityAppearance & {
  center: { x: number; y: number }
  radius: number
  layerName: string
}

type ArcEntity = EntityAppearance & {
  center: { x: number; y: number }
  radius: number
  startDeg: number
  endDeg: number
  layerName: string
  lineTypeName: Segment['lineTypeName']
}

type SplineEntity = EntityAppearance & {
  controls: Array<{ x: number; y: number }>
  layerName: string
  lineTypeName: Segment['lineTypeName']
}

function circleThroughPoints(p1: Point, p2: Point, p3: Point) {
  const denominator = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y))
  if (Math.abs(denominator) < 1e-6) {
    return null
  }
  const s1 = p1.x * p1.x + p1.y * p1.y
  const s2 = p2.x * p2.x + p2.y * p2.y
  const s3 = p3.x * p3.x + p3.y * p3.y
  const cx = (s1 * (p2.y - p3.y) + s2 * (p3.y - p1.y) + s3 * (p1.y - p2.y)) / denominator
  const cy = (s1 * (p3.x - p2.x) + s2 * (p1.x - p3.x) + s3 * (p2.x - p1.x)) / denominator
  const radius = Math.hypot(p1.x - cx, p1.y - cy)
  return { center: { x: cx, y: cy }, radius }
}

function arcShapeToArcEntity(
  shape: ArcShape,
  options: { flipY: boolean; unit: 'mm' | 'in' },
  meta: Pick<Segment, 'layerName' | 'lineTypeName' | 'color' | 'strokeWidthMm'>,
): ArcEntity | null {
  const circle = circleThroughPoints(shape.start, shape.mid, shape.end)
  if (!circle || circle.radius < 1e-6) {
    return null
  }
  const signY = options.flipY ? -1 : 1
  const scale = options.unit === 'in' ? 1 / 25.4 : 1
  const toDxf = (p: Point) => ({ x: p.x * scale, y: p.y * signY * scale })
  const center = toDxf(circle.center)
  const start = toDxf(shape.start)
  const mid = toDxf(shape.mid)
  const end = toDxf(shape.end)

  const angleAt = (p: { x: number; y: number }) => Math.atan2(p.y - center.y, p.x - center.x)
  const startA = angleAt(start)
  const midA = angleAt(mid)
  const endA = angleAt(end)
  const ccwDelta = (a: number, b: number) => ((b - a) % TAU + TAU) % TAU
  const startToEnd = ccwDelta(startA, endA)
  const startToMid = ccwDelta(startA, midA)
  const ccwFromStart = startToMid <= startToEnd
  const [rawStart, rawEnd] = ccwFromStart ? [startA, endA] : [endA, startA]
  const norm = (r: number) => ((r * 180) / Math.PI + 360) % 360

  return {
    center,
    radius: circle.radius * scale,
    startDeg: norm(rawStart),
    endDeg: norm(rawEnd),
    ...meta,
  }
}

function bezierShapeToSplineEntity(
  shape: BezierShape | CubicShape,
  options: { flipY: boolean; unit: 'mm' | 'in' },
  meta: Pick<Segment, 'layerName' | 'lineTypeName' | 'color' | 'strokeWidthMm'>,
): SplineEntity {
  const signY = options.flipY ? -1 : 1
  const scale = options.unit === 'in' ? 1 / 25.4 : 1
  const toDxf = (p: Point) => ({ x: p.x * scale, y: p.y * signY * scale })
  const s = toDxf(shape.start)
  const c = shape.type === 'bezier' ? toDxf(shape.control) : null
  const e = toDxf(shape.end)
  // Degree-elevate the quadratic into a cubic for broader reader support.
  const c1 = shape.type === 'cubic' ? toDxf(shape.control1) : { x: s.x + (2 / 3) * (c!.x - s.x), y: s.y + (2 / 3) * (c!.y - s.y) }
  const c2 = shape.type === 'cubic' ? toDxf(shape.control2) : { x: e.x + (2 / 3) * (c!.x - e.x), y: e.y + (2 / 3) * (c!.y - e.y) }
  return {
    controls: [s, c1, c2, e],
    ...meta,
  }
}

function stitchHoleToPrimitives(
  stitchHole: StitchHole,
  parentShape: Shape | undefined,
  options: Required<Pick<DxfExportOptions, 'flipY'>> & {
    unit: 'mm' | 'in'
    stitchHoleRenderMode: StitchHoleRenderMode
    stitchDotRadiusMm: number
    layerNames?: Record<string, string>
    typesById?: Record<string, LineType>
  },
): { segments: Segment[]; circles: CircleEntity[] } {
  if (!parentShape) {
    return { segments: [], circles: [] }
  }

  const primitive = createStitchHolePrimitive(stitchHole, {
    mode: options.stitchHoleRenderMode,
    dotRadiusMm: options.stitchDotRadiusMm,
  })
  const layerName = options.layerNames?.[parentShape.layerId] ?? sanitizeLayerName(parentShape.layerId)
  const type = options.typesById?.[parentShape.lineTypeId]
  const meta = { layerName, lineTypeName: 'CONTINUOUS' as const, color: type?.color, strokeWidthMm: parentShape.strokeWidthOverride ?? type?.strokeWidthMm }

  if (primitive.kind === 'circle') {
    const scale = options.unit === 'in' ? 1 / 25.4 : 1
    const y = options.flipY ? -primitive.center.y : primitive.center.y
    return {
      segments: [],
      circles: [
        {
          center: { x: primitive.center.x * scale, y: y * scale },
          radius: primitive.radiusMm * scale,
          ...meta,
        },
      ],
    }
  }

  if (primitive.kind === 'segment') {
    return { segments: [createSegment(primitive.start, primitive.end, meta, options)], circles: [] }
  }

  return { segments: pointsToSegments(primitive.points, meta, options, true), circles: [] }
}

function encodeAppearance(style: EntityAppearance, version: DxfVersion): string[] {
  const result: string[] = []
  if (style.color && /^#[0-9a-f]{6}$/i.test(style.color)) {
    const rgb = parseInt(style.color.slice(1), 16)
    if (version === 'r2004') result.push('420', String(rgb))
    else {
      const colors = [0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff, 0xffffff, 0x808080, 0xc0c0c0]
      const distance = (value: number) => Math.hypot((rgb >> 16) - (value >> 16), ((rgb >> 8) & 255) - ((value >> 8) & 255), (rgb & 255) - (value & 255))
      let best = 0
      for (let index = 1; index < colors.length; index++) if (distance(colors[index]) < distance(colors[best])) best = index
      result.push('62', String(best + 1))
    }
  }
  if (version === 'r2004' && style.strokeWidthMm !== undefined) result.push('370', String(dxfLineweight(style.strokeWidthMm)))
  return result
}

function encodeCircleEntity(circle: CircleEntity, version: DxfVersion) {
  return [
    '0',
    'CIRCLE',
    '8',
    circle.layerName,
    ...encodeAppearance(circle, version),
    '10',
    circle.center.x.toFixed(6),
    '20',
    circle.center.y.toFixed(6),
    '30',
    '0.0',
    '40',
    circle.radius.toFixed(6),
  ]
}

function encodeArcEntity(arc: ArcEntity, version: DxfVersion) {
  return [
    '0',
    'ARC',
    '8',
    arc.layerName,
    ...encodeAppearance(arc, version),
    '6',
    arc.lineTypeName,
    '10',
    arc.center.x.toFixed(6),
    '20',
    arc.center.y.toFixed(6),
    '30',
    '0.0',
    '40',
    arc.radius.toFixed(6),
    '50',
    arc.startDeg.toFixed(6),
    '51',
    arc.endDeg.toFixed(6),
  ]
}

function encodeSplineEntity(spline: SplineEntity, version: DxfVersion) {
  const out = [
    '0',
    'SPLINE',
    '8',
    spline.layerName,
    ...encodeAppearance(spline, version),
    '6',
    spline.lineTypeName,
    '70',
    '8',
    '71',
    '3',
    '72',
    '8',
    '73',
    '4',
    '74',
    '0',
    '42',
    '0.0000001',
    '43',
    '0.0000001',
    '44',
    '0.0000001',
  ]
  const knots = [0, 0, 0, 0, 1, 1, 1, 1]
  for (const knot of knots) {
    out.push('40', knot.toFixed(6))
  }
  for (const point of spline.controls) {
    out.push('10', point.x.toFixed(6), '20', point.y.toFixed(6), '30', '0.0')
  }
  return out
}

function encodeLineEntity(segment: Segment, version: DxfVersion) {
  return [
    '0',
    'LINE',
    '8',
    segment.layerName,
    ...encodeAppearance(segment, version),
    '6',
    segment.lineTypeName,
    '10',
    segment.x1.toFixed(6),
    '20',
    segment.y1.toFixed(6),
    '30',
    '0.0',
    '11',
    segment.x2.toFixed(6),
    '21',
    segment.y2.toFixed(6),
    '31',
    '0.0',
  ]
}

function encodeLtypeEntry(name: Segment['lineTypeName']) {
  if (name === 'DASHDOTDOT') {
    return [
      '0',
      'LTYPE',
      '2',
      'DASHDOTDOT',
      '70',
      '0',
      '3',
      'Dash dot dot',
      '72',
      '65',
      '73',
      '6',
      '40',
      '1.9',
      '49',
      '1.0',
      '74',
      '0',
      '49',
      '-0.3',
      '74',
      '0',
      '49',
      '0.0',
      '74',
      '0',
      '49',
      '-0.3',
      '74',
      '0',
      '49',
      '0.0',
      '74',
      '0',
      '49',
      '-0.3',
      '74',
      '0',
    ]
  }

  if (name === 'DASHED') {
    return [
      '0',
      'LTYPE',
      '2',
      'DASHED',
      '70',
      '0',
      '3',
      'Dashed',
      '72',
      '65',
      '73',
      '2',
      '40',
      '0.75',
      '49',
      '0.5',
      '74',
      '0',
      '49',
      '-0.25',
      '74',
      '0',
    ]
  }

  if (name === 'DOTTED') {
    return [
      '0',
      'LTYPE',
      '2',
      'DOTTED',
      '70',
      '0',
      '3',
      'Dotted',
      '72',
      '65',
      '73',
      '2',
      '40',
      '0.2',
      '49',
      '0.0',
      '74',
      '0',
      '49',
      '-0.2',
      '74',
      '0',
    ]
  }

  return [
    '0',
    'LTYPE',
    '2',
    'CONTINUOUS',
    '70',
    '0',
    '3',
    'Solid line',
    '72',
    '65',
    '73',
    '0',
    '40',
    '0.0',
  ]
}

export function buildDxfFromShapes(shapes: Shape[], options: DxfExportOptions = {}) {
  const flipY = options.flipY ?? false
  const forceSolidLineStyle = options.forceSolidLineStyle ?? false
  const version = options.version ?? 'r12'
  const unit = options.unit ?? 'mm'
  const lineTypeStyles = options.lineTypeStyles ?? {}
  const curveToleranceMm = options.curveToleranceMm ?? 0.02
  if (!Number.isFinite(curveToleranceMm) || curveToleranceMm <= 0) throw new Error('DXF curve tolerance must be a positive mm value')
  const usedNames = new Set<string>()
  const layerNames: Record<string, string> = {}
  for (const layer of options.layers ?? []) {
    const base = sanitizeLayerName(layer.name)
    let name = base, suffix = 2
    while (usedNames.has(name.toLowerCase())) name = `${base}_${suffix++}`
    usedNames.add(name.toLowerCase()); layerNames[layer.id] = name
  }
  const typesById = Object.fromEntries((options.lineTypes ?? []).map(type => [type.id, type]))
  const shapeOptions = { flipY, forceSolidLineStyle, unit, lineTypeStyles, layerNames, typesById, curveToleranceMm }
  const stitchHoleRenderMode = options.stitchHoleRenderMode ?? 'native'
  const stitchDotRadiusMm = options.stitchDotRadiusMm ?? 0.6
  const shapesById = Object.fromEntries(shapes.map((shape) => [shape.id, shape] as const))
  assertDxfExportBudget(shapes.length + (options.stitchHoles?.length ?? 0))
  const stitchHolePrimitives: Array<ReturnType<typeof stitchHoleToPrimitives>> = []
  let stitchEntityCount = 0
  for (const stitchHole of options.stitchHoles ?? []) {
    const primitive = stitchHoleToPrimitives(stitchHole, shapesById[stitchHole.shapeId], { flipY, unit, stitchHoleRenderMode, stitchDotRadiusMm, layerNames, typesById })
    stitchEntityCount += primitive.segments.length + primitive.circles.length
    assertDxfExportBudget(stitchEntityCount)
    stitchHolePrimitives.push(primitive)
  }
  const circles: CircleEntity[] = stitchHolePrimitives.flatMap((entry) => entry.circles)
  const arcs: ArcEntity[] = []
  const splines: SplineEntity[] = []
  const ellipses: Array<{ shape: EllipseShape; meta: ReturnType<typeof buildShapeSegmentMeta> }> = []
  const shapeSegments: Segment[] = []
  const useNativeCurves = version !== 'r12'

  for (const shape of shapes) {
    assertDxfExportBudget(shapeSegments.length + circles.length + arcs.length + splines.length + ellipses.length)
    if (useNativeCurves && shape.type === 'arc') {
      const meta = buildShapeSegmentMeta(shape, shapeOptions)
      const arc = arcShapeToArcEntity(shape, { flipY, unit }, meta)
      if (arc) {
        arcs.push(arc)
        continue
      }
    }
    if (useNativeCurves && (shape.type === 'bezier' || shape.type === 'cubic')) {
      const meta = buildShapeSegmentMeta(shape, shapeOptions)
      splines.push(bezierShapeToSplineEntity(shape, { flipY, unit }, meta))
      continue
    }
    if (useNativeCurves && shape.type === 'ellipse') {
      const scale = unit === 'in' ? 1 / 25.4 : 1
      const transformed = transformNativeCurve(shape, [scale, 0, 0, flipY ? -scale : scale, 0, 0])
      if (transformed.type !== 'ellipse') throw new Error('Invalid ellipse transform')
      ellipses.push({ shape: transformed, meta: buildShapeSegmentMeta(shape, shapeOptions) })
      continue
    }
    shapeSegments.push(...toSegments(shape, shapeOptions))
  }
  assertDxfExportBudget(shapeSegments.length + circles.length + arcs.length + splines.length + ellipses.length + stitchHolePrimitives.reduce((sum, entry) => sum + entry.segments.length, 0))

  const segments = [
    ...shapeSegments,
    ...stitchHolePrimitives.flatMap((entry) => entry.segments),
  ]
  const usedLineTypes = new Set<Segment['lineTypeName']>([...segments, ...arcs, ...splines, ...ellipses.map(entry => entry.meta)].map(entity => entity.lineTypeName))
  usedLineTypes.add('CONTINUOUS')
  const versionCode = version === 'r2004' ? 'AC1018' : version === 'r14' ? 'AC1014' : 'AC1009'
  const insertUnitsCode = unit === 'in' ? '1' : '4'

  const body: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    versionCode,
    '9',
    '$DWGCODEPAGE',
    '3',
    'ANSI_1252',
    '9',
    '$INSUNITS',
    '70',
    insertUnitsCode,
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LTYPE',
    '70',
    String(usedLineTypes.size),
  ]

  for (const lineTypeName of usedLineTypes) {
    body.push(...encodeLtypeEntry(lineTypeName))
  }

  body.push('0', 'ENDTAB')
  const layerIds = new Set(shapes.map(shape => shape.layerId))
  const hasDefaultLayer = [...layerIds].some(id => (layerNames[id] ?? sanitizeLayerName(id)) === '0')
  body.push('0', 'TABLE', '2', 'LAYER', '70', String(layerIds.size + (hasDefaultLayer ? 0 : 1)))
  if (!hasDefaultLayer) body.push('0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS')
  for (const id of layerIds) {
    const layer = options.layers?.find(layer => layer.id === id)
    body.push('0', 'LAYER', '2', layerNames[id] ?? sanitizeLayerName(id), '70', layer?.locked ? '4' : '0', '62', layer?.visible === false ? '-7' : '7', '6', 'CONTINUOUS')
  }
  body.push(
    '0',
    'ENDTAB',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  )

  for (const segment of segments) {
    body.push(...encodeLineEntity(segment, version))
  }

  for (const arc of arcs) {
    body.push(...encodeArcEntity(arc, version))
  }

  for (const spline of splines) {
    body.push(...encodeSplineEntity(spline, version))
  }

  for (const { shape, meta } of ellipses) {
    const rotation = shape.rotationDeg * Math.PI / 180
    const start = shape.startAngleDeg * Math.PI / 180
    const sweep = shape.sweepDeg * Math.PI / 180
    const from = sweep < 0 ? start + sweep : start
    const to = sweep < 0 ? start : start + sweep
    body.push('0', 'ELLIPSE', '8', meta.layerName, '6', meta.lineTypeName, ...encodeAppearance(meta, version),
      '10', shape.center.x.toFixed(9), '20', shape.center.y.toFixed(9), '30', '0',
      '11', (shape.radiusX * Math.cos(rotation)).toFixed(9), '21', (shape.radiusX * Math.sin(rotation)).toFixed(9), '31', '0',
      '40', (shape.radiusY / shape.radiusX).toPrecision(15), '41', from.toPrecision(15), '42', to.toPrecision(15))
  }
  for (const circle of circles) {
    body.push(...encodeCircleEntity(circle, version))
  }

  body.push('0', 'ENDSEC', '0', 'EOF')
  for (let index = 0; index < body.length; index += 2) if (['2', '3', '6', '7', '8'].includes(body[index])) body[index + 1] = escapeDxfText(body[index + 1])
  const warnings: string[] = []
  if (version === 'r2004') {
    const rounded = new Map<number, number>()
    for (const shape of shapes) {
      const width = shape.strokeWidthOverride ?? typesById[shape.lineTypeId]?.strokeWidthMm
      if (width !== undefined && Math.abs(dxfLineweight(width) / 100 - width) > 1e-9) rounded.set(width, dxfLineweight(width) / 100)
    }
    if (rounded.size) warnings.push(`DXF lineweights use a fixed set; widths were rounded to supported values: ${[...rounded].slice(0, 8).map(([from, to]) => `${from}→${to} mm`).join(', ')}${rounded.size > 8 ? '…' : ''}. JSON/LCAD retain exact stroke widths.`)
  }
  if (version !== 'r2004' && options.lineTypes?.length) warnings.push('R12/R14 use indexed colors and cannot preserve lineweight metadata; choose R2004 for RGB colors and lineweights.')
  if (shapes.some(shape => shape.locked || shape.groupId || (shape.opacity !== undefined && shape.opacity !== 1))) warnings.push('DXF does not retain per-shape locks, opacity or sketch group relationships; use Document JSON for a complete backup.')
  if (shapes.some(shape => shape.type === 'text')) warnings.push('Text is exported as sampled annotation geometry, not editable DXF TEXT or font outlines.')
  if (version === 'r12' && shapes.some(shape => shape.type !== 'line' && shape.type !== 'text')) warnings.push(`R12 curves are converted to line segments with a ${curveToleranceMm} mm tolerance.`)
  return {
    content: (version === 'r12' ? body : completeModernDxf(body)).join('\n') + '\n',
    segmentCount: segments.length,
    circleCount: circles.length,
    arcCount: arcs.length,
    splineCount: splines.length,
    ellipseCount: ellipses.length,
    curveToleranceMm,
    warnings,
  }
}
