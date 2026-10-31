import { sampleShapePoints, uid } from '../cad/cad-geometry'
import type { Shape, TextShape } from '../cad/cad-types'
import { collectSvgElementTransform, transformSvgShape } from './svg/svg-transform'
import { isNativeCurve, transformNativeCurve } from '../cad/native-curve-ops'
import { parseNativeSvgPath } from './svg/svg-path'
import { assertImportGeometryBudget, assertImportTextBudget } from './import-budget'

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
  if (unit === 'px') {
    return Number.NaN
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
  if (!unit || unit === '%' || unit === 'px') {
    return parsed * documentScaleMm
  }
  const unitScale = unitToMm(unit)
  return Number.isFinite(unitScale) ? parsed * unitScale : fallback
}

function parseFirstLength(value: string | null, fallback = 0, documentScaleMm = 1) {
  if (!value) {
    return fallback
  }
  return parseLength(value.trim().split(/[\s,]+/)[0] ?? '', fallback, documentScaleMm)
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

  assertImportGeometryBudget(Math.max(0, Math.floor(chunks.length / 2) - 1))
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

  const closure = closed && points.length > 2 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) > 1e-6 ? 1 : 0
  assertImportGeometryBudget(points.length - 1 + closure)
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

  return [{ id: uid(), type: 'ellipse', layerId, lineTypeId, center: { x: centerX, y: centerY }, radiusX, radiusY, rotationDeg: 0, startAngleDeg: 0, sweepDeg: 360 }] satisfies Shape[]
}

function parseStyleAttribute(value: string | null) {
  const styles: Record<string, string> = {}
  if (!value) {
    return styles
  }

  value.split(';').forEach((entry) => {
    const separator = entry.indexOf(':')
    if (separator < 0) {
      return
    }
    const key = entry.slice(0, separator).trim().toLowerCase()
    const styleValue = entry.slice(separator + 1).trim()
    if (key.length > 0 && styleValue.length > 0) {
      styles[key] = styleValue
    }
  })
  return styles
}

function unquoteFontFamily(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
    .find((entry) => entry.length > 0) ?? 'sans-serif'
}

function textToShape(textElement: SVGTextElement, layerId: string, lineTypeId: string, documentScaleMm: number): TextShape | null {
  const text = textElement.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  if (text.length === 0) {
    return null
  }

  const styles = parseStyleAttribute(textElement.getAttribute('style'))
  const x = parseFirstLength(textElement.getAttribute('x'), 0, documentScaleMm)
  const y = parseFirstLength(textElement.getAttribute('y'), 0, documentScaleMm)
  const fontSizeMm = parseLength(textElement.getAttribute('font-size') ?? styles['font-size'] ?? null, 12, documentScaleMm)
  const fontFamily = unquoteFontFamily(textElement.getAttribute('font-family') ?? styles['font-family'] ?? 'sans-serif')
  const widthMm = Math.max(fontSizeMm * 0.8, text.length * fontSizeMm * 0.62)

  return {
    id: uid(),
    type: 'text',
    layerId,
    lineTypeId,
    start: { x, y },
    end: { x: x + widthMm, y },
    text,
    fontFamily,
    fontSizeMm,
    transform: 'none',
    radiusMm: 40,
    sweepDeg: 140,
  }
}

function scaleShapePoints(shape: Shape, scaleMm: number): Shape {
  if (Math.abs(scaleMm - 1) < 1e-6) {
    return shape
  }

  if (isNativeCurve(shape)) return transformNativeCurve(shape, [scaleMm, 0, 0, scaleMm, 0, 0])

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
  const viewBoxAttr = svgElement.getAttribute('viewBox')
  const widthAttr = svgElement.getAttribute('width')
  const heightAttr = svgElement.getAttribute('height')
  const viewBoxParts = viewBoxAttr
    ?.trim()
    .split(/[\s,]+/)
    .map((entry) => Number.parseFloat(entry))
  const viewBox =
    viewBoxParts && viewBoxParts.length >= 4 && viewBoxParts.every((entry) => Number.isFinite(entry))
      ? { width: viewBoxParts[2], height: viewBoxParts[3] }
      : svgElement.viewBox?.baseVal

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

function transformElementShapes(
  element: Element,
  shapes: Shape[],
  root: SVGSVGElement | null,
  documentScaleMm: number,
) {
  if (shapes.length === 0) {
    return []
  }
  const matrix = collectSvgElementTransform(element, root, documentScaleMm)
  return shapes.map((shape) => transformSvgShape(shape, matrix))
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
  assertImportTextBudget(svgContent)
  const parser = new DOMParser()
  const parsed = parser.parseFromString(svgContent, 'image/svg+xml')
  const parserError = parsed.querySelector('parsererror')
  if (parserError) {
    throw new Error('Invalid SVG file')
  }

  const warnings: string[] = []
  const shapes: Shape[] = []
  const append = (entries: Shape[]) => {
    assertImportGeometryBudget(shapes.length + entries.length)
    for (const shape of entries) shapes.push(shape)
  }
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
    append(transformElementShapes(
      lineElement,
      [lineShape(layerId, lineTypeId, { x: x1, y: y1 }, { x: x2, y: y2 })],
      svgRoot,
      documentScaleMm,
    ))
  })

  const polylineElements = parsed.querySelectorAll('polyline')
  polylineElements.forEach((polylineElement) => {
    const points = parsePointList(polylineElement.getAttribute('points'), documentScaleMm)
    append(transformElementShapes(polylineElement, polylineToLines(points, false, layerId, lineTypeId), svgRoot, documentScaleMm))
  })

  const polygonElements = parsed.querySelectorAll('polygon')
  polygonElements.forEach((polygonElement) => {
    const points = parsePointList(polygonElement.getAttribute('points'), documentScaleMm)
    append(transformElementShapes(polygonElement, polylineToLines(points, true, layerId, lineTypeId), svgRoot, documentScaleMm))
  })

  const rectElements = parsed.querySelectorAll('rect')
  rectElements.forEach((rectElement) => {
    append(transformElementShapes(rectElement, rectToLines(rectElement, layerId, lineTypeId, documentScaleMm), svgRoot, documentScaleMm))
  })

  const circleElements = parsed.querySelectorAll('circle')
  circleElements.forEach((circleElement) => {
    const centerX = parseLength(circleElement.getAttribute('cx'), 0, documentScaleMm)
    const centerY = parseLength(circleElement.getAttribute('cy'), 0, documentScaleMm)
    const radius = parseLength(circleElement.getAttribute('r'), 0, documentScaleMm)
    append(transformElementShapes(
      circleElement,
      ellipseToLines(centerX, centerY, radius, radius, layerId, lineTypeId),
      svgRoot,
      documentScaleMm,
    ))
  })

  const ellipseElements = parsed.querySelectorAll('ellipse')
  ellipseElements.forEach((ellipseElement) => {
    const centerX = parseLength(ellipseElement.getAttribute('cx'), 0, documentScaleMm)
    const centerY = parseLength(ellipseElement.getAttribute('cy'), 0, documentScaleMm)
    const radiusX = parseLength(ellipseElement.getAttribute('rx'), 0, documentScaleMm)
    const radiusY = parseLength(ellipseElement.getAttribute('ry'), 0, documentScaleMm)
    append(transformElementShapes(
      ellipseElement,
      ellipseToLines(centerX, centerY, radiusX, radiusY, layerId, lineTypeId),
      svgRoot,
      documentScaleMm,
    ))
  })

  const pathElements = parsed.querySelectorAll('path')
  pathElements.forEach((pathElement) => {
    const d = pathElement.getAttribute('d')
    if (!d || d.trim().length === 0) {
      return
    }

    let pathShapes: Shape[]
    try {
      const parsedShapes = parseNativeSvgPath(d, layerId, lineTypeId).map((shape) => scaleShapePoints(shape, documentScaleMm))
      pathShapes = transformElementShapes(pathElement, parsedShapes, svgRoot, documentScaleMm)
    } catch {
      warnings.push('Skipped an unsupported path element')
      return
    }
    if (!pathShapes.length) {
      warnings.push('Skipped an unsupported path element')
      return
    }
    // A global expansion failure rejects the import; it must not become a
    // per-element warning followed by a partial document.
    append(pathShapes)
  })

  const textElements = parsed.querySelectorAll('text')
  textElements.forEach((textElement) => {
    const textShape = textToShape(textElement, layerId, lineTypeId, documentScaleMm)
    if (textShape) {
      append(transformElementShapes(textElement, [textShape], svgRoot, documentScaleMm))
    }
  })

  return {
    shapes: shapesToApproximateArcs(shapes),
    warnings,
  }
}
