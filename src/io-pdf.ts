import { sampleShapePoints } from './cad-geometry'
import type { LineTypeStyle, Shape } from './cad-types'

const MM_TO_PT = 72 / 25.4
const DEFAULT_MARGIN_MM = 10
const DEFAULT_LINE_WIDTH_PT = 0.8

type PdfExportOptions = {
  marginMm?: number
  lineWidthPt?: number
  lineTypeColors?: Record<string, string>
  lineTypeStyles?: Record<string, LineTypeStyle>
  forceSolidLineStyle?: boolean
}

type StrokeSegment = {
  points: Array<{ x: number; y: number }>
  colorHex: string
  style: LineTypeStyle
}

function clampMin(value: number, minimum: number) {
  if (!Number.isFinite(value)) {
    return minimum
  }
  return Math.max(minimum, value)
}

function toFixedPdf(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : '0.000'
}

function normalizeHex(hex: string | undefined, fallback = '#0f172a') {
  if (typeof hex !== 'string') {
    return fallback
  }
  const trimmed = hex.trim()
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : fallback
}

function hexToRgbUnit(hex: string) {
  const safe = normalizeHex(hex)
  const red = Number.parseInt(safe.slice(1, 3), 16) / 255
  const green = Number.parseInt(safe.slice(3, 5), 16) / 255
  const blue = Number.parseInt(safe.slice(5, 7), 16) / 255
  return { red, green, blue }
}

function dashPattern(style: LineTypeStyle) {
  if (style === 'dashed') {
    return '[8 5] 0 d'
  }
  if (style === 'dotted') {
    return '[1.2 3.2] 0 d'
  }
  return '[] 0 d'
}

function buildSegments(shapes: Shape[], options: Required<Pick<PdfExportOptions, 'lineTypeColors' | 'lineTypeStyles' | 'forceSolidLineStyle'>>) {
  const segments: StrokeSegment[] = []

  for (const shape of shapes) {
    const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 72)
    if (sampled.length < 2) {
      continue
    }

    const style = options.forceSolidLineStyle ? 'solid' : options.lineTypeStyles[shape.lineTypeId] ?? 'solid'
    segments.push({
      points: sampled,
      colorHex: normalizeHex(options.lineTypeColors[shape.lineTypeId]),
      style,
    })
  }

  return segments
}

function buildBounds(segments: StrokeSegment[]) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const segment of segments) {
    for (const point of segment.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  return { minX, minY, maxX, maxY }
}

function makePdf(stream: string, pageWidthPt: number, pageHeightPt: number) {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${toFixedPdf(pageWidthPt)} ${toFixedPdf(pageHeightPt)}] /Contents 4 0 R /Resources << >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
  ]

  let output = '%PDF-1.4\n%\n'
  const offsets: number[] = [0]

  for (const object of objects) {
    offsets.push(output.length)
    output += object
  }

  const xrefStart = output.length
  output += `xref\n0 ${objects.length + 1}\n`
  output += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) {
    output += `${offset.toString().padStart(10, '0')} 00000 n \n`
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return output
}

export function buildPdfFromShapes(shapes: Shape[], options: PdfExportOptions = {}) {
  const lineTypeColors = options.lineTypeColors ?? {}
  const lineTypeStyles = options.lineTypeStyles ?? {}
  const forceSolidLineStyle = options.forceSolidLineStyle ?? false
  const lineWidthPt = clampMin(options.lineWidthPt ?? DEFAULT_LINE_WIDTH_PT, 0.1)
  const marginMm = clampMin(options.marginMm ?? DEFAULT_MARGIN_MM, 1)

  const segments = buildSegments(shapes, {
    lineTypeColors,
    lineTypeStyles,
    forceSolidLineStyle,
  })

  const bounds = buildBounds(segments)
  if (!bounds) {
    return makePdf('0 0 m 1 0 l S\n', 30, 30)
  }

  const marginPt = marginMm * MM_TO_PT
  const widthMm = Math.max(10, bounds.maxX - bounds.minX)
  const heightMm = Math.max(10, bounds.maxY - bounds.minY)
  const pageWidthPt = widthMm * MM_TO_PT + marginPt * 2
  const pageHeightPt = heightMm * MM_TO_PT + marginPt * 2

  const toPdfPoint = (point: { x: number; y: number }) => ({
    x: (point.x - bounds.minX) * MM_TO_PT + marginPt,
    y: pageHeightPt - ((point.y - bounds.minY) * MM_TO_PT + marginPt),
  })

  const commands: string[] = [
    '1 J',
    '1 j',
    `${toFixedPdf(lineWidthPt)} w`,
  ]

  let activeColor = ''
  let activeDash = ''

  for (const segment of segments) {
    const dash = dashPattern(segment.style)
    if (dash !== activeDash) {
      commands.push(dash)
      activeDash = dash
    }

    const { red, green, blue } = hexToRgbUnit(segment.colorHex)
    const colorCommand = `${toFixedPdf(red)} ${toFixedPdf(green)} ${toFixedPdf(blue)} RG`
    if (colorCommand !== activeColor) {
      commands.push(colorCommand)
      activeColor = colorCommand
    }

    const first = toPdfPoint(segment.points[0])
    commands.push(`${toFixedPdf(first.x)} ${toFixedPdf(first.y)} m`)
    for (let index = 1; index < segment.points.length; index += 1) {
      const point = toPdfPoint(segment.points[index])
      commands.push(`${toFixedPdf(point.x)} ${toFixedPdf(point.y)} l`)
    }
    commands.push('S')
  }

  const stream = `${commands.join('\n')}\n`
  return makePdf(stream, pageWidthPt, pageHeightPt)
}
