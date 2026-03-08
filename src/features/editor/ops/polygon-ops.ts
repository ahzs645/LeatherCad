/**
 * Shared polygon conversion utilities used by Clipper boolean/offset ops
 * and NFP nesting. Converts LeatherCad shapes to/from polygon point arrays.
 */

import { sampleShapePoints, uid } from '../cad/cad-geometry'
import type { Point, Shape, LineShape } from '../cad/cad-types'

/**
 * A closed polygon represented as an array of vertices in order.
 * The last vertex connects back to the first.
 */
export type Polygon = Point[]

/**
 * Samples a shape into a polyline of points.
 * For lines, returns the two endpoints.
 * For arcs/beziers, samples `segments` points along the curve.
 */
export function shapeToPolyline(shape: Shape, segments = 48): Point[] {
  if (shape.type === 'text') {
    return sampleShapePoints(shape, segments)
  }
  return sampleShapePoints(shape, segments)
}

/**
 * Attempts to chain a set of shapes into closed polygons by connecting
 * endpoints. Returns an array of closed polygons (point arrays).
 *
 * Algorithm:
 *  1. Sample each shape into a polyline
 *  2. Try to chain polylines end-to-end by matching endpoints within tolerance
 *  3. Close the resulting chains
 */
export function shapesToPolygons(shapes: Shape[], tolerance = 0.5): Polygon[] {
  if (shapes.length === 0) return []

  // Sample each shape to a polyline
  const polylines = shapes
    .filter((s) => s.type !== 'text')
    .map((shape) => {
      const pts = shapeToPolyline(shape)
      return pts.length >= 2 ? pts : null
    })
    .filter((p): p is Point[] => p !== null)

  if (polylines.length === 0) return []

  // If only one shape, just return it closed
  if (polylines.length === 1) {
    const poly = polylines[0]
    return [poly]
  }

  // Try to chain polylines together
  const used = new Set<number>()
  const polygons: Polygon[] = []

  function dist(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function findNext(endPoint: Point, exclude: Set<number>): { index: number; reversed: boolean } | null {
    let bestIndex = -1
    let bestDist = tolerance
    let bestReversed = false

    for (let i = 0; i < polylines.length; i++) {
      if (exclude.has(i)) continue
      const pl = polylines[i]
      const dStart = dist(endPoint, pl[0])
      const dEnd = dist(endPoint, pl[pl.length - 1])

      if (dStart < bestDist) {
        bestDist = dStart
        bestIndex = i
        bestReversed = false
      }
      if (dEnd < bestDist) {
        bestDist = dEnd
        bestIndex = i
        bestReversed = true
      }
    }

    return bestIndex >= 0 ? { index: bestIndex, reversed: bestReversed } : null
  }

  for (let startIdx = 0; startIdx < polylines.length; startIdx++) {
    if (used.has(startIdx)) continue

    const chain: Point[] = [...polylines[startIdx]]
    used.add(startIdx)

    // Chain forward
    let iterations = 0
    while (iterations < polylines.length) {
      const next = findNext(chain[chain.length - 1], used)
      if (!next) break
      used.add(next.index)
      const pl = next.reversed ? [...polylines[next.index]].reverse() : polylines[next.index]
      // Skip first point (it's the matching endpoint)
      chain.push(...pl.slice(1))
      iterations++
    }

    polygons.push(chain)
  }

  return polygons
}

/**
 * Converts a closed polygon back to LeatherCad LineShapes.
 */
export function polygonToLineShapes(
  polygon: Polygon,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
  closed = true,
): LineShape[] {
  const shapes: LineShape[] = []
  const count = closed ? polygon.length : polygon.length - 1

  for (let i = 0; i < count; i++) {
    const start = polygon[i]
    const end = polygon[(i + 1) % polygon.length]
    shapes.push({
      id: uid(),
      type: 'line',
      layerId,
      lineTypeId,
      groupId,
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
    })
  }

  return shapes
}

/**
 * Computes the signed area of a polygon. Positive = CCW, Negative = CW.
 */
export function polygonArea(polygon: Polygon): number {
  let area = 0
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    area += polygon[i].x * polygon[j].y
    area -= polygon[j].x * polygon[i].y
  }
  return area / 2
}

/**
 * Ensures polygon is in CCW (counterclockwise) winding order.
 */
export function ensureCCW(polygon: Polygon): Polygon {
  if (polygonArea(polygon) < 0) {
    return [...polygon].reverse()
  }
  return polygon
}

/**
 * Ensures polygon is in CW (clockwise) winding order.
 */
export function ensureCW(polygon: Polygon): Polygon {
  if (polygonArea(polygon) > 0) {
    return [...polygon].reverse()
  }
  return polygon
}

/**
 * Computes the centroid of a polygon.
 */
export function polygonCentroid(polygon: Polygon): Point {
  let cx = 0
  let cy = 0
  for (const p of polygon) {
    cx += p.x
    cy += p.y
  }
  return { x: cx / polygon.length, y: cy / polygon.length }
}

/**
 * Computes axis-aligned bounding box of a polygon.
 */
export function polygonBounds(polygon: Polygon) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of polygon) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * Translates a polygon by (dx, dy).
 */
export function translatePolygon(polygon: Polygon, dx: number, dy: number): Polygon {
  return polygon.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

/**
 * Rotates a polygon around a center point by angleDeg degrees.
 */
export function rotatePolygon(polygon: Polygon, center: Point, angleDeg: number): Polygon {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return polygon.map((p) => {
    const dx = p.x - center.x
    const dy = p.y - center.y
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    }
  })
}
