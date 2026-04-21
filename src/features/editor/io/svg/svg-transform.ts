import type { Point, Shape } from '../../cad/cad-types'

export type SvgMatrix = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

const IDENTITY: SvgMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
const TRANSFORM_PATTERN = /([a-zA-Z]+)\(([^)]*)\)/g
const ARG_SPLIT_PATTERN = /[\s,]+/

function numberOr(value: string | undefined, fallback: number) {
  if (value === undefined) {
    return fallback
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseArgs(value: string) {
  return value
    .trim()
    .split(ARG_SPLIT_PATTERN)
    .filter((entry) => entry.length > 0)
}

function lengthArg(value: string | undefined, documentScaleMm: number, fallback = 0) {
  if (value === undefined) {
    return fallback
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed * documentScaleMm : fallback
}

export function multiplySvgMatrices(left: SvgMatrix, right: SvgMatrix): SvgMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  }
}

function translateMatrix(x: number, y: number): SvgMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y }
}

function rotateMatrix(angleDeg: number): SvgMatrix {
  const radians = (angleDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
}

function parseSingleTransform(name: string, rawArgs: string, documentScaleMm: number): SvgMatrix {
  const args = parseArgs(rawArgs)
  const normalized = name.toLowerCase()

  if (normalized === 'matrix') {
    return {
      a: numberOr(args[0], 1),
      b: numberOr(args[1], 0),
      c: numberOr(args[2], 0),
      d: numberOr(args[3], 1),
      e: lengthArg(args[4], documentScaleMm, 0),
      f: lengthArg(args[5], documentScaleMm, 0),
    }
  }

  if (normalized === 'translate') {
    return translateMatrix(lengthArg(args[0], documentScaleMm, 0), lengthArg(args[1], documentScaleMm, 0))
  }

  if (normalized === 'scale') {
    const x = numberOr(args[0], 1)
    const y = numberOr(args[1], x)
    return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }
  }

  if (normalized === 'rotate') {
    const angle = numberOr(args[0], 0)
    const rotation = rotateMatrix(angle)
    if (args.length >= 3) {
      const cx = lengthArg(args[1], documentScaleMm, 0)
      const cy = lengthArg(args[2], documentScaleMm, 0)
      return multiplySvgMatrices(multiplySvgMatrices(translateMatrix(cx, cy), rotation), translateMatrix(-cx, -cy))
    }
    return rotation
  }

  if (normalized === 'skewx') {
    return { a: 1, b: 0, c: Math.tan((numberOr(args[0], 0) * Math.PI) / 180), d: 1, e: 0, f: 0 }
  }

  if (normalized === 'skewy') {
    return { a: 1, b: Math.tan((numberOr(args[0], 0) * Math.PI) / 180), c: 0, d: 1, e: 0, f: 0 }
  }

  return IDENTITY
}

export function parseSvgTransform(value: string | null, documentScaleMm: number): SvgMatrix {
  if (!value || value.trim().length === 0) {
    return IDENTITY
  }

  let result = IDENTITY
  for (const match of value.matchAll(TRANSFORM_PATTERN)) {
    result = multiplySvgMatrices(result, parseSingleTransform(match[1], match[2], documentScaleMm))
  }
  return result
}

export function collectSvgElementTransform(
  element: Element,
  root: SVGSVGElement | null,
  documentScaleMm: number,
): SvgMatrix {
  const chain: Element[] = []
  let current: Element | null = element
  while (current) {
    chain.unshift(current)
    if (current === root) {
      break
    }
    current = current.parentElement
  }

  return chain.reduce(
    (matrix, entry) => multiplySvgMatrices(matrix, parseSvgTransform(entry.getAttribute('transform'), documentScaleMm)),
    IDENTITY,
  )
}

export function transformSvgPoint(matrix: SvgMatrix, point: Point): Point {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  }
}

export function svgMatrixScaleFactor(matrix: SvgMatrix) {
  const scaleX = Math.hypot(matrix.a, matrix.b)
  const scaleY = Math.hypot(matrix.c, matrix.d)
  const average = (scaleX + scaleY) / 2
  return Number.isFinite(average) && average > 0 ? average : 1
}

export function transformSvgShape(shape: Shape, matrix: SvgMatrix): Shape {
  if (shape.type === 'line') {
    return {
      ...shape,
      start: transformSvgPoint(matrix, shape.start),
      end: transformSvgPoint(matrix, shape.end),
    }
  }

  if (shape.type === 'arc') {
    return {
      ...shape,
      start: transformSvgPoint(matrix, shape.start),
      mid: transformSvgPoint(matrix, shape.mid),
      end: transformSvgPoint(matrix, shape.end),
    }
  }

  if (shape.type === 'bezier') {
    return {
      ...shape,
      start: transformSvgPoint(matrix, shape.start),
      control: transformSvgPoint(matrix, shape.control),
      end: transformSvgPoint(matrix, shape.end),
    }
  }

  return {
    ...shape,
    start: transformSvgPoint(matrix, shape.start),
    end: transformSvgPoint(matrix, shape.end),
    fontSizeMm: shape.fontSizeMm * svgMatrixScaleFactor(matrix),
  }
}
