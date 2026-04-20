import { sampleShapePoints } from '../cad/cad-geometry'
import type { LineTypeStyle, Shape, StitchHole } from '../cad/cad-types'
import { createStitchHolePrimitive, type StitchHoleRenderMode } from '../ops/stitch-hole-render'

type DxfVersion = 'r12' | 'r14'
type DxfExportOptions = {
  flipY?: boolean
  version?: DxfVersion
  unit?: 'mm' | 'in'
  forceSolidLineStyle?: boolean
  lineTypeStyles?: Record<string, LineTypeStyle>
  stitchHoles?: StitchHole[]
  stitchHoleRenderMode?: StitchHoleRenderMode
  stitchDotRadiusMm?: number
}

type Segment = {
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
  return trimmed.replace(/\s+/g, '_')
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
  meta: Pick<Segment, 'layerName' | 'lineTypeName'>,
  options: Required<Pick<DxfExportOptions, 'flipY'>> & { unit: 'mm' | 'in' },
): Segment {
  const signY = options.flipY ? -1 : 1
  const unitScale = options.unit === 'in' ? 1 / 25.4 : 1
  return {
    layerName: meta.layerName,
    lineTypeName: meta.lineTypeName,
    x1: start.x * unitScale,
    y1: start.y * signY * unitScale,
    x2: end.x * unitScale,
    y2: end.y * signY * unitScale,
  }
}

function pointsToSegments(
  points: Array<{ x: number; y: number }>,
  meta: Pick<Segment, 'layerName' | 'lineTypeName'>,
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
  },
) {
  const style = options.lineTypeStyles[shape.lineTypeId] ?? 'solid'
  return {
    layerName: sanitizeLayerName(shape.layerId),
    lineTypeName: options.forceSolidLineStyle ? ('CONTINUOUS' as const) : dxfLineTypeFromStyle(style),
  }
}

function toSegments(shape: Shape, options: Required<Pick<DxfExportOptions, 'flipY' | 'forceSolidLineStyle'>> & {
  unit: 'mm' | 'in'
  lineTypeStyles: Record<string, LineTypeStyle>
}) {
  const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 72)
  return pointsToSegments(sampled, buildShapeSegmentMeta(shape, options), options)
}

type CircleEntity = {
  center: { x: number; y: number }
  radius: number
  layerName: string
}

function stitchHoleToPrimitives(
  stitchHole: StitchHole,
  parentShape: Shape | undefined,
  options: Required<Pick<DxfExportOptions, 'flipY'>> & {
    unit: 'mm' | 'in'
    stitchHoleRenderMode: StitchHoleRenderMode
    stitchDotRadiusMm: number
  },
): { segments: Segment[]; circles: CircleEntity[] } {
  if (!parentShape) {
    return { segments: [], circles: [] }
  }

  const primitive = createStitchHolePrimitive(stitchHole, {
    mode: options.stitchHoleRenderMode,
    dotRadiusMm: options.stitchDotRadiusMm,
  })
  const layerName = sanitizeLayerName(parentShape.layerId)
  const meta = { layerName, lineTypeName: 'CONTINUOUS' as const }

  if (primitive.kind === 'circle') {
    const scale = options.unit === 'in' ? 1 / 25.4 : 1
    const y = options.flipY ? -primitive.center.y : primitive.center.y
    return {
      segments: [],
      circles: [
        {
          center: { x: primitive.center.x * scale, y: y * scale },
          radius: primitive.radiusMm * scale,
          layerName,
        },
      ],
    }
  }

  if (primitive.kind === 'segment') {
    return { segments: [createSegment(primitive.start, primitive.end, meta, options)], circles: [] }
  }

  return { segments: pointsToSegments(primitive.points, meta, options, true), circles: [] }
}

function encodeCircleEntity(circle: CircleEntity) {
  return [
    '0',
    'CIRCLE',
    '8',
    circle.layerName,
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

function encodeLineEntity(segment: Segment) {
  return [
    '0',
    'LINE',
    '8',
    segment.layerName,
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
  const shapeOptions = { flipY, forceSolidLineStyle, unit, lineTypeStyles }
  const stitchHoleRenderMode = options.stitchHoleRenderMode ?? 'native'
  const stitchDotRadiusMm = options.stitchDotRadiusMm ?? 0.6
  const shapesById = Object.fromEntries(shapes.map((shape) => [shape.id, shape] as const))
  const stitchHolePrimitives = (options.stitchHoles ?? []).map((stitchHole) =>
    stitchHoleToPrimitives(stitchHole, shapesById[stitchHole.shapeId], {
      flipY,
      unit,
      stitchHoleRenderMode,
      stitchDotRadiusMm,
    }),
  )
  const circles: CircleEntity[] = stitchHolePrimitives.flatMap((entry) => entry.circles)
  const segments = [
    ...shapes.flatMap((shape) => toSegments(shape, shapeOptions)),
    ...stitchHolePrimitives.flatMap((entry) => entry.segments),
  ]
  const usedLineTypes = new Set<Segment['lineTypeName']>(segments.map((segment) => segment.lineTypeName))
  usedLineTypes.add('CONTINUOUS')
  const versionCode = version === 'r14' ? 'AC1014' : 'AC1009'
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
    body.push(...encodeLineEntity(segment))
  }

  for (const circle of circles) {
    body.push(...encodeCircleEntity(circle))
  }

  body.push('0', 'ENDSEC', '0', 'EOF')
  return {
    content: body.join('\n') + '\n',
    segmentCount: segments.length,
    circleCount: circles.length,
  }
}
