import * as THREE from 'three'

const EPSILON = 1e-6

export type Bounds2 = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function sideOfLine(point: THREE.Vector2, lineStart: THREE.Vector2, lineEnd: THREE.Vector2) {
  const direction = lineEnd.clone().sub(lineStart)
  return direction.x * (point.y - lineStart.y) - direction.y * (point.x - lineStart.x)
}

export function polygonBounds(points: THREE.Vector2[]): Bounds2 {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, maxX, minY, maxY }
}

export function padBounds(bounds: Bounds2, padding: number) {
  return {
    minX: bounds.minX - padding,
    maxX: bounds.maxX + padding,
    minY: bounds.minY - padding,
    maxY: bounds.maxY + padding,
  }
}

export function ensureMinSpan(bounds: Bounds2, minSpan: number) {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const halfWidth = Math.max(width, minSpan) / 2
  const halfHeight = Math.max(height, minSpan) / 2
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight,
  }
}

export function clipPolygonByLine(points: THREE.Vector2[], lineStart: THREE.Vector2, lineEnd: THREE.Vector2, keepPositive: boolean) {
  if (points.length === 0) {
    return [] as THREE.Vector2[]
  }

  const result: THREE.Vector2[] = []
  const sideCheck = (value: number) => (keepPositive ? value >= -EPSILON : value <= EPSILON)

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const currentSide = sideOfLine(current, lineStart, lineEnd)
    const nextSide = sideOfLine(next, lineStart, lineEnd)
    const currentInside = sideCheck(currentSide)
    const nextInside = sideCheck(nextSide)

    if (currentInside && nextInside) {
      result.push(next.clone())
      continue
    }

    if (currentInside && !nextInside) {
      const denominator = currentSide - nextSide
      if (Math.abs(denominator) > EPSILON) {
        const t = currentSide / denominator
        result.push(current.clone().lerp(next, t))
      }
      continue
    }

    if (!currentInside && nextInside) {
      const denominator = currentSide - nextSide
      if (Math.abs(denominator) > EPSILON) {
        const t = currentSide / denominator
        result.push(current.clone().lerp(next, t))
      }
      result.push(next.clone())
    }
  }

  return result
}

export function segmentLengthSquared(a: THREE.Vector2, b: THREE.Vector2) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function lineIntersectionOnSegment(a: THREE.Vector2, b: THREE.Vector2, sideA: number, sideB: number) {
  const denominator = sideA - sideB
  if (Math.abs(denominator) <= EPSILON) {
    return null
  }

  const t = sideA / denominator
  return a.clone().lerp(b, t)
}

export function distanceToFoldAxisInWorld(point: THREE.Vector3, foldAxisPoint: THREE.Vector2, foldAxisDirection: THREE.Vector3) {
  const dx = point.x - foldAxisPoint.x
  const dz = point.z - foldAxisPoint.y
  return Math.abs(dx * -foldAxisDirection.z + dz * foldAxisDirection.x)
}
