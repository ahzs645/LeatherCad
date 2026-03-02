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

function parseLength(value: string | null, fallback = 0) {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return parsed
}

function parsePointList(value: string | null) {
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
    const x = Number.parseFloat(chunks[index])
    const y = Number.parseFloat(chunks[index + 1])
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

function rectToLines(rect: SVGRectElement, layerId: string, lineTypeId: string) {
  const x = parseLength(rect.getAttribute('x'), 0)
  const y = parseLength(rect.getAttribute('y'), 0)
  const width = parseLength(rect.getAttribute('width'), 0)
  const height = parseLength(rect.getAttribute('height'), 0)

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

  const lineElements = parsed.querySelectorAll('line')
  lineElements.forEach((lineElement) => {
    const x1 = parseLength(lineElement.getAttribute('x1'))
    const y1 = parseLength(lineElement.getAttribute('y1'))
    const x2 = parseLength(lineElement.getAttribute('x2'))
    const y2 = parseLength(lineElement.getAttribute('y2'))
    shapes.push(lineShape(layerId, lineTypeId, { x: x1, y: y1 }, { x: x2, y: y2 }))
  })

  const polylineElements = parsed.querySelectorAll('polyline')
  polylineElements.forEach((polylineElement) => {
    const points = parsePointList(polylineElement.getAttribute('points'))
    shapes.push(...polylineToLines(points, false, layerId, lineTypeId))
  })

  const polygonElements = parsed.querySelectorAll('polygon')
  polygonElements.forEach((polygonElement) => {
    const points = parsePointList(polygonElement.getAttribute('points'))
    shapes.push(...polylineToLines(points, true, layerId, lineTypeId))
  })

  const rectElements = parsed.querySelectorAll('rect')
  rectElements.forEach((rectElement) => {
    shapes.push(...rectToLines(rectElement, layerId, lineTypeId))
  })

  const circleElements = parsed.querySelectorAll('circle')
  circleElements.forEach((circleElement) => {
    const centerX = parseLength(circleElement.getAttribute('cx'))
    const centerY = parseLength(circleElement.getAttribute('cy'))
    const radius = parseLength(circleElement.getAttribute('r'))
    shapes.push(...ellipseToLines(centerX, centerY, radius, radius, layerId, lineTypeId))
  })

  const ellipseElements = parsed.querySelectorAll('ellipse')
  ellipseElements.forEach((ellipseElement) => {
    const centerX = parseLength(ellipseElement.getAttribute('cx'))
    const centerY = parseLength(ellipseElement.getAttribute('cy'))
    const radiusX = parseLength(ellipseElement.getAttribute('rx'))
    const radiusY = parseLength(ellipseElement.getAttribute('ry'))
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
      shapes.push(...pathToLines(tempPath, layerId, lineTypeId))
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
