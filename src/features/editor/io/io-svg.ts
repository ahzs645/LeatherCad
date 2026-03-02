import { sampleShapePoints, uid } from '../cad/cad-geometry'
import type { Shape } from '../cad/cad-types'

type SvgImportOptions = {
  layerId: string
  lineTypeId: string
}

type SvgImportResult = {
  shapes: Shape[]
  warnings: string[]
}

function unitToMm(unit: string) {
  if (unit === 'mm') {
    return 1
  }
  if (unit === 'cm') {
    return 10
  }
  if (unit === 'in') {
    return 25.4
  }
  if (unit === 'pt') {
    return 25.4 / 72
  }
  if (unit === 'pc') {
    return (25.4 / 72) * 12
  }
  if (unit === 'm') {
    return 1000
  }
  return 1
}

function parseLength(value: string | null, fallback = 0, documentScaleMm = 1) {
  if (!value) {
    return fallback
  }
  const trimmed = value.trim()
  const match = trimmed.match(/^(-?\d*\.?\d+(?:e[-+]?\d+)?)([a-z%]*)$/i)
  if (!match) {
    return fallback
  }
  const parsed = Number.parseFloat(match[1])
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  const unit = match[2].toLowerCase()
  if (!unit || unit === '%') {
    return parsed * documentScaleMm
  }
  return parsed * unitToMm(unit)
}

function parsePointList(value: string | null, documentScaleMm = 1) {
  if (!value) {
    return [] as Array<{ x: number; y: number }>
  }
  const chunks = value
    .trim()
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter((entry) => entry.length > 0)

  const points: Array<{ x: number; y: number }> = []
  for (let index = 0; index + 1 < chunks.length; index += 2) {
    const x = parseLength(chunks[index], Number.NaN, documentScaleMm)
    const y = parseLength(chunks[index + 1], Number.NaN, documentScaleMm)
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y })
    }
  }
  return points
}

function lineShape(layerId: string, lineTypeId: string, start: { x: number; y: number }, end: { x: number; y: number }): Shape {
  return {
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start,
    end,
  }
}

function polylineToLines(points: Array<{ x: number; y: number }>, closed: boolean, layerId: string, lineTypeId: string) {
  const shapes: Shape[] = []
  if (points.length < 2) {
    return shapes
  }

  for (let index = 1; index < points.length; index += 1) {
    shapes.push(lineShape(layerId, lineTypeId, points[index - 1], points[index]))
  }

  if (closed && points.length > 2) {
    const firstPoint = points[0]
    const lastPoint = points[points.length - 1]
    if (Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y) > 1e-6) {
      shapes.push(lineShape(layerId, lineTypeId, lastPoint, firstPoint))
    }
  }

  return shapes
}

function rectToLines(rect: SVGRectElement, layerId: string, lineTypeId: string, documentScaleMm: number) {
  const x = parseLength(rect.getAttribute('x'), 0, documentScaleMm)
  const y = parseLength(rect.getAttribute('y'), 0, documentScaleMm)
  const width = parseLength(rect.getAttribute('width'), 0, documentScaleMm)
  const height = parseLength(rect.getAttribute('height'), 0, documentScaleMm)

  return polylineToLines(
    [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    true,
    layerId,
    lineTypeId,
  )
}

function ellipseToLines(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  layerId: string,
  lineTypeId: string,
) {
  if (radiusX <= 0 || radiusY <= 0) {
    return [] as Shape[]
  }

  const circumferenceEstimate = 2 * Math.PI * Math.sqrt((radiusX * radiusX + radiusY * radiusY) / 2)
  const segments = Math.max(16, Math.min(160, Math.round(circumferenceEstimate / 8)))
  const points: Array<{ x: number; y: number }> = []
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2
    points.push({
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    })
  }
  return polylineToLines(points, true, layerId, lineTypeId)
}

function pathToLines(pathElement: SVGPathElement, layerId: string, lineTypeId: string) {
  const length = pathElement.getTotalLength()
  if (!Number.isFinite(length) || length <= 0) {
    return [] as Shape[]
  }

  const segments = Math.max(8, Math.min(300, Math.round(length / 8)))
  const points: Array<{ x: number; y: number }> = []
  for (let index = 0; index <= segments; index += 1) {
    const sample = pathElement.getPointAtLength((index / segments) * length)
    points.push({ x: sample.x, y: sample.y })
  }

  const startsClosed =
    points.length > 2 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) <= 1
  return polylineToLines(points, startsClosed, layerId, lineTypeId)
}

function scaleShapePoints(shape: Shape, scaleMm: number): Shape {
  if (Math.abs(scaleMm - 1) < 1e-6) {
    return shape
  }

  if (shape.type === 'line') {
    return {
      ...shape,
      start: { x: shape.start.x * scaleMm, y: shape.start.y * scaleMm },
      end: { x: shape.end.x * scaleMm, y: shape.end.y * scaleMm },
    }
  }

  if (shape.type === 'arc') {
    return {
      ...shape,
      start: { x: shape.start.x * scaleMm, y: shape.start.y * scaleMm },
      mid: { x: shape.mid.x * scaleMm, y: shape.mid.y * scaleMm },
      end: { x: shape.end.x * scaleMm, y: shape.end.y * scaleMm },
    }
  }

  if (shape.type === 'bezier') {
    return {
      ...shape,
      start: { x: shape.start.x * scaleMm, y: shape.start.y * scaleMm },
      control: { x: shape.control.x * scaleMm, y: shape.control.y * scaleMm },
      end: { x: shape.end.x * scaleMm, y: shape.end.y * scaleMm },
    }
  }

  return {
    ...shape,
    start: { x: shape.start.x * scaleMm, y: shape.start.y * scaleMm },
    end: { x: shape.end.x * scaleMm, y: shape.end.y * scaleMm },
  }
}

function resolveDocumentUnitScaleMm(svgElement: SVGSVGElement) {
  const viewBox = svgElement.viewBox.baseVal
  const widthAttr = svgElement.getAttribute('width')
  const heightAttr = svgElement.getAttribute('height')

  const widthMm = parseLength(widthAttr, Number.NaN, 1)
  const heightMm = parseLength(heightAttr, Number.NaN, 1)
  const widthScale = Number.isFinite(widthMm) && viewBox && viewBox.width > 0 ? widthMm / viewBox.width : Number.NaN
  const heightScale = Number.isFinite(heightMm) && viewBox && viewBox.height > 0 ? heightMm / viewBox.height : Number.NaN

  if (Number.isFinite(widthScale) && Number.isFinite(heightScale)) {
    return (widthScale + heightScale) / 2
  }
  if (Number.isFinite(widthScale)) {
    return widthScale
  }
  if (Number.isFinite(heightScale)) {
    return heightScale
  }

  return 1
}

function shapesToApproximateArcs(shapes: Shape[]) {
  const normalized: Shape[] = []
  for (const shape of shapes) {
    if (shape.type !== 'line') {
      normalized.push(shape)
      continue
    }
    const sampled = sampleShapePoints(shape, 1)
    if (sampled.length < 2) {
      continue
    }
    normalized.push(shape)
  }
  return normalized
}

export function importSvgAsShapes(svgContent: string, options: SvgImportOptions): SvgImportResult {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(svgContent, 'image/svg+xml')
  const parserError = parsed.querySelector('parsererror')
  if (parserError) {
    throw new Error('Invalid SVG file')
  }

  const warnings: string[] = []
  const shapes: Shape[] = []
  const layerId = options.layerId
  const lineTypeId = options.lineTypeId
  const svgRoot = parsed.querySelector('svg')
  const documentScaleMm = svgRoot ? resolveDocumentUnitScaleMm(svgRoot) : 1

  const lineElements = parsed.querySelectorAll('line')
  lineElements.forEach((lineElement) => {
    const x1 = parseLength(lineElement.getAttribute('x1'), 0, documentScaleMm)
    const y1 = parseLength(lineElement.getAttribute('y1'), 0, documentScaleMm)
    const x2 = parseLength(lineElement.getAttribute('x2'), 0, documentScaleMm)
    const y2 = parseLength(lineElement.getAttribute('y2'), 0, documentScaleMm)
    shapes.push(lineShape(layerId, lineTypeId, { x: x1, y: y1 }, { x: x2, y: y2 }))
  })

  const polylineElements = parsed.querySelectorAll('polyline')
  polylineElements.forEach((polylineElement) => {
    const points = parsePointList(polylineElement.getAttribute('points'), documentScaleMm)
    shapes.push(...polylineToLines(points, false, layerId, lineTypeId))
  })

  const polygonElements = parsed.querySelectorAll('polygon')
  polygonElements.forEach((polygonElement) => {
    const points = parsePointList(polygonElement.getAttribute('points'), documentScaleMm)
    shapes.push(...polylineToLines(points, true, layerId, lineTypeId))
  })

  const rectElements = parsed.querySelectorAll('rect')
  rectElements.forEach((rectElement) => {
    shapes.push(...rectToLines(rectElement, layerId, lineTypeId, documentScaleMm))
  })

  const circleElements = parsed.querySelectorAll('circle')
  circleElements.forEach((circleElement) => {
    const centerX = parseLength(circleElement.getAttribute('cx'), 0, documentScaleMm)
    const centerY = parseLength(circleElement.getAttribute('cy'), 0, documentScaleMm)
    const radius = parseLength(circleElement.getAttribute('r'), 0, documentScaleMm)
    shapes.push(...ellipseToLines(centerX, centerY, radius, radius, layerId, lineTypeId))
  })

  const ellipseElements = parsed.querySelectorAll('ellipse')
  ellipseElements.forEach((ellipseElement) => {
    const centerX = parseLength(ellipseElement.getAttribute('cx'), 0, documentScaleMm)
    const centerY = parseLength(ellipseElement.getAttribute('cy'), 0, documentScaleMm)
    const radiusX = parseLength(ellipseElement.getAttribute('rx'), 0, documentScaleMm)
    const radiusY = parseLength(ellipseElement.getAttribute('ry'), 0, documentScaleMm)
    shapes.push(...ellipseToLines(centerX, centerY, radiusX, radiusY, layerId, lineTypeId))
  })

  const pathElements = parsed.querySelectorAll('path')
  pathElements.forEach((pathElement) => {
    const d = pathElement.getAttribute('d')
    if (!d || d.trim().length === 0) {
      return
    }

    try {
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      tempPath.setAttribute('d', d)
      tempSvg.appendChild(tempPath)
      const pathShapes = pathToLines(tempPath, layerId, lineTypeId).map((shape) =>
        scaleShapePoints(shape, documentScaleMm),
      )
      shapes.push(...pathShapes)
    } catch {
      warnings.push('Skipped an unsupported path element')
    }
  })

  const transformedElements = parsed.querySelectorAll('[transform]')
  if (transformedElements.length > 0) {
    warnings.push('Transform attributes were detected and were not fully applied in this baseline import')
  }

  return {
    shapes: shapesToApproximateArcs(shapes),
    warnings,
  }
}
