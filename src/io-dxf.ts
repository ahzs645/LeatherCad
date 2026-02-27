import { sampleShapePoints } from './cad-geometry'
import type { LineTypeStyle, Shape } from './cad-types'

type DxfVersion = 'r12' | 'r14'
type DxfExportOptions = {
  flipY?: boolean
  version?: DxfVersion
  forceSolidLineStyle?: boolean
  lineTypeStyles?: Record<string, LineTypeStyle>
}

type Segment = {
  layerName: string
  lineTypeName: 'CONTINUOUS' | 'DASHED' | 'DOTTED'
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
  if (style === 'dashed') {
    return 'DASHED' as const
  }
  if (style === 'dotted') {
    return 'DOTTED' as const
  }
  return 'CONTINUOUS' as const
}

function toSegments(shape: Shape, options: Required<Pick<DxfExportOptions, 'flipY' | 'forceSolidLineStyle'>> & {
  lineTypeStyles: Record<string, LineTypeStyle>
}) {
  const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 72)
  const segments: Segment[] = []
  if (sampled.length < 2) {
    return segments
  }

  const signY = options.flipY ? -1 : 1
  const style = options.lineTypeStyles[shape.lineTypeId] ?? 'solid'
  const lineTypeName = options.forceSolidLineStyle ? 'CONTINUOUS' : dxfLineTypeFromStyle(style)
  for (let index = 1; index < sampled.length; index += 1) {
    const start = sampled[index - 1]
    const end = sampled[index]
    segments.push({
      layerName: sanitizeLayerName(shape.layerId),
      lineTypeName,
      x1: start.x,
      y1: start.y * signY,
      x2: end.x,
      y2: end.y * signY,
    })
  }

  return segments
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
  const lineTypeStyles = options.lineTypeStyles ?? {}
  const segments = shapes.flatMap((shape) => toSegments(shape, { flipY, forceSolidLineStyle, lineTypeStyles }))
  const usedLineTypes = new Set<Segment['lineTypeName']>(segments.map((segment) => segment.lineTypeName))
  usedLineTypes.add('CONTINUOUS')
  const versionCode = version === 'r14' ? 'AC1014' : 'AC1009'

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
    '4',
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

  body.push('0', 'ENDSEC', '0', 'EOF')
  return {
    content: body.join('\n') + '\n',
    segmentCount: segments.length,
  }
}
