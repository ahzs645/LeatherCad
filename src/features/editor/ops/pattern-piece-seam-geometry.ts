import { round } from '../cad/cad-geometry'
import type { PieceSeamAllowance, Point } from '../cad/cad-types'
import type { OutlineChain } from './outline-detection'

export function polygonBounds(points: Point[]) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

function pointsEqual(a: Point, b: Point, epsilon = 1e-6) {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon
}

function normalizeClosedPolygon(points: Point[]) {
  if (points.length >= 2 && pointsEqual(points[0], points[points.length - 1])) {
    return points.slice(0, -1)
  }
  return [...points]
}

function polygonSignedArea(points: Point[]) {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const denominator = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x)
  if (Math.abs(denominator) < 1e-6) {
    return null
  }

  const determinantA = a1.x * a2.y - a1.y * a2.x
  const determinantB = b1.x * b2.y - b1.y * b2.x

  return {
    x: (determinantA * (b1.x - b2.x) - (a1.x - a2.x) * determinantB) / denominator,
    y: (determinantA * (b1.y - b2.y) - (a1.y - a2.y) * determinantB) / denominator,
  }
}

function buildVariableOffsetPolygon(points: Point[], seamAllowance: PieceSeamAllowance) {
  const polygon = normalizeClosedPolygon(points)
  if (polygon.length < 3) {
    return null
  }

  const signedArea = polygonSignedArea(polygon)
  const outwardSign = signedArea >= 0 ? 1 : -1
  const overrideByEdgeIndex = new Map(seamAllowance.edgeOverrides.map((entry) => [entry.edgeIndex, entry.offsetMm]))
  const result: Point[] = []

  for (let index = 0; index < polygon.length; index += 1) {
    const previous = polygon[(index - 1 + polygon.length) % polygon.length]
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]

    const previousOffset = overrideByEdgeIndex.get((index - 1 + polygon.length) % polygon.length) ?? seamAllowance.defaultOffsetMm
    const currentOffset = overrideByEdgeIndex.get(index) ?? seamAllowance.defaultOffsetMm

    const previousDx = current.x - previous.x
    const previousDy = current.y - previous.y
    const currentDx = next.x - current.x
    const currentDy = next.y - current.y
    const previousLength = Math.hypot(previousDx, previousDy)
    const currentLength = Math.hypot(currentDx, currentDy)

    if (previousLength < 1e-6 || currentLength < 1e-6) {
      continue
    }

    const previousNormal = {
      x: (previousDy / previousLength) * outwardSign,
      y: (-previousDx / previousLength) * outwardSign,
    }
    const currentNormal = {
      x: (currentDy / currentLength) * outwardSign,
      y: (-currentDx / currentLength) * outwardSign,
    }

    const previousLineStart = {
      x: previous.x + previousNormal.x * previousOffset,
      y: previous.y + previousNormal.y * previousOffset,
    }
    const previousLineEnd = {
      x: current.x + previousNormal.x * previousOffset,
      y: current.y + previousNormal.y * previousOffset,
    }
    const currentLineStart = {
      x: current.x + currentNormal.x * currentOffset,
      y: current.y + currentNormal.y * currentOffset,
    }
    const currentLineEnd = {
      x: next.x + currentNormal.x * currentOffset,
      y: next.y + currentNormal.y * currentOffset,
    }

    const intersection = lineIntersection(previousLineStart, previousLineEnd, currentLineStart, currentLineEnd)
    if (intersection) {
      result.push(intersection)
      continue
    }

    result.push({
      x: (previousLineEnd.x + currentLineStart.x) / 2,
      y: (previousLineEnd.y + currentLineStart.y) / 2,
    })
  }

  return result.length >= 3 ? result : null
}

function buildRoundedUniformOffsetPolygon(points: Point[], offsetMm: number) {
  const polygon = normalizeClosedPolygon(points)
  if (polygon.length < 3) {
    return null
  }

  const signedArea = polygonSignedArea(polygon)
  const outwardSign = signedArea >= 0 ? 1 : -1
  const safeOffset = Math.max(0.1, Math.abs(offsetMm))
  const result: Point[] = []

  for (let index = 0; index < polygon.length; index += 1) {
    const previous = polygon[(index - 1 + polygon.length) % polygon.length]
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]

    const previousDx = current.x - previous.x
    const previousDy = current.y - previous.y
    const currentDx = next.x - current.x
    const currentDy = next.y - current.y
    const previousLength = Math.hypot(previousDx, previousDy)
    const currentLength = Math.hypot(currentDx, currentDy)

    if (previousLength < 1e-6 || currentLength < 1e-6) {
      continue
    }

    const previousNormal = {
      x: (previousDy / previousLength) * outwardSign,
      y: (-previousDx / previousLength) * outwardSign,
    }
    const currentNormal = {
      x: (currentDy / currentLength) * outwardSign,
      y: (-currentDx / currentLength) * outwardSign,
    }

    const previousOffsetPoint = {
      x: current.x + previousNormal.x * safeOffset,
      y: current.y + previousNormal.y * safeOffset,
    }
    const currentOffsetPoint = {
      x: current.x + currentNormal.x * safeOffset,
      y: current.y + currentNormal.y * safeOffset,
    }

    const bisector = {
      x: previousNormal.x + currentNormal.x,
      y: previousNormal.y + currentNormal.y,
    }
    const bisectorLength = Math.hypot(bisector.x, bisector.y)
    const bisectorPoint =
      bisectorLength < 1e-6
        ? null
        : {
            x: current.x + (bisector.x / bisectorLength) * safeOffset,
            y: current.y + (bisector.y / bisectorLength) * safeOffset,
          }

    for (const point of [previousOffsetPoint, bisectorPoint, currentOffsetPoint]) {
      if (!point) {
        continue
      }
      if (result.length === 0 || !pointsEqual(result[result.length - 1], point, 1e-6)) {
        result.push(point)
      }
    }
  }

  if (result.length >= 2 && pointsEqual(result[0], result[result.length - 1], 1e-6)) {
    result.pop()
  }

  return result.length >= 3 ? result : null
}

export function buildPatternPieceSeamPolygon(chain: OutlineChain, seamAllowance: PieceSeamAllowance): Point[] | null {
  if (!seamAllowance.enabled || chain.polygon.length < 3) {
    return null
  }
  if (seamAllowance.edgeOverrides.length === 0) {
    return buildRoundedUniformOffsetPolygon(chain.polygon, seamAllowance.defaultOffsetMm)
  }
  return buildVariableOffsetPolygon(chain.polygon, seamAllowance)
}

export function polygonCenter(points: Point[]): Point | null {
  const bounds = polygonBounds(points)
  if (!bounds) {
    return null
  }
  return {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  }
}

export function buildPatternPieceSeamPath(chain: OutlineChain, seamAllowance: PieceSeamAllowance): string | null {
  const offset = buildPatternPieceSeamPolygon(chain, seamAllowance)
  if (!offset || offset.length < 2) {
    return null
  }
  return offset
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`)
    .join(' ') + ' Z'
}
