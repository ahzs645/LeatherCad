import type { LineType, Point, Shape } from '../cad/cad-types'
import { booleanOpPolygons } from '../ops/clipper-ops'
import { pointInPolygon } from '../ops/outline-detection'
import { polygonArea, shapeToPolyline } from '../ops/polygon-ops'
import { buildOutlineRegions } from './outline-regions'

type ClosedOutline = {
  polygon: Point[]
}

export type PhysicalLayerRegion = {
  outer: Point[]
  holes: Point[][]
}

type SplitPoint = {
  point: Point
  t: number
}

type HalfEdge = {
  from: string
  to: string
  angle: number
}

const FACE_AREA_EPSILON = 1
const KEY_PRECISION_DIGITS = 6

function pointsEqual(a: Point, b: Point, tolerance = 1e-6) {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance
}

function pointKey(point: Point) {
  return `${point.x.toFixed(KEY_PRECISION_DIGITS)},${point.y.toFixed(KEY_PRECISION_DIGITS)}`
}

function normalizePolygon(points: Point[]) {
  if (points.length >= 2 && pointsEqual(points[0], points[points.length - 1])) {
    return points.slice(0, -1)
  }
  return [...points]
}

function polygonCentroid(points: Point[]) {
  let accumulatedArea = 0
  let accumulatedX = 0
  let accumulatedY = 0

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const cross = current.x * next.y - next.x * current.y
    accumulatedArea += cross
    accumulatedX += (current.x + next.x) * cross
    accumulatedY += (current.y + next.y) * cross
  }

  if (Math.abs(accumulatedArea) <= 1e-6) {
    const total = points.reduce(
      (accumulator, point) => ({
        x: accumulator.x + point.x,
        y: accumulator.y + point.y,
      }),
      { x: 0, y: 0 },
    )
    return {
      x: total.x / Math.max(points.length, 1),
      y: total.y / Math.max(points.length, 1),
    }
  }

  const scale = 1 / (3 * accumulatedArea)
  return {
    x: accumulatedX * scale,
    y: accumulatedY * scale,
  }
}

function distancePointToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-12) {
    return {
      distance: Math.hypot(point.x - start.x, point.y - start.y),
      t: 0,
    }
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  const clampedT = Math.max(0, Math.min(1, t))
  const closestPoint = {
    x: start.x + dx * clampedT,
    y: start.y + dy * clampedT,
  }

  return {
    distance: Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y),
    t: clampedT,
  }
}

function isPhysicalEdgeShape(shape: Shape, lineTypeById: Map<string, LineType>) {
  if (shape.type === 'text') {
    return false
  }
  const lineType = lineTypeById.get(shape.lineTypeId)
  return !lineType || lineType.role === 'cut' || lineType.role === 'fold'
}

function buildSplitSegments(
  shapes: Shape[],
  lineTypeById: Map<string, LineType>,
  tolerance: number,
) {
  const polylines = shapes
    .filter((shape) => isPhysicalEdgeShape(shape, lineTypeById))
    .map((shape) => shapeToPolyline(shape, shape.type === 'line' ? 2 : 40))
    .filter((points) => points.length >= 2)

  if (polylines.length === 0) {
    return []
  }

  const endpoints = polylines.flatMap((points) => [points[0], points[points.length - 1]])
  const segments: Array<[Point, Point]> = []
  const seenUndirectedSegments = new Set<string>()

  for (const polyline of polylines) {
    for (let index = 0; index < polyline.length - 1; index += 1) {
      const start = polyline[index]
      const end = polyline[index + 1]
      const splitPoints: SplitPoint[] = [
        { point: start, t: 0 },
        { point: end, t: 1 },
      ]

      for (const endpoint of endpoints) {
        if (pointsEqual(endpoint, start, tolerance) || pointsEqual(endpoint, end, tolerance)) {
          continue
        }
        const { distance, t } = distancePointToSegment(endpoint, start, end)
        if (distance <= tolerance && t > 1e-6 && t < 1 - 1e-6) {
          splitPoints.push({ point: endpoint, t })
        }
      }

      splitPoints.sort((left, right) => left.t - right.t)

      const uniqueSplitPoints: SplitPoint[] = []
      for (const splitPoint of splitPoints) {
        if (!uniqueSplitPoints.some((entry) => pointsEqual(entry.point, splitPoint.point, tolerance))) {
          uniqueSplitPoints.push(splitPoint)
        }
      }

      for (let splitIndex = 0; splitIndex < uniqueSplitPoints.length - 1; splitIndex += 1) {
        const splitStart = uniqueSplitPoints[splitIndex].point
        const splitEnd = uniqueSplitPoints[splitIndex + 1].point
        if (pointsEqual(splitStart, splitEnd, tolerance)) {
          continue
        }

        const forwardKey = `${pointKey(splitStart)}|${pointKey(splitEnd)}`
        const reverseKey = `${pointKey(splitEnd)}|${pointKey(splitStart)}`
        if (seenUndirectedSegments.has(forwardKey) || seenUndirectedSegments.has(reverseKey)) {
          continue
        }

        seenUndirectedSegments.add(forwardKey)
        seenUndirectedSegments.add(reverseKey)
        segments.push([splitStart, splitEnd])
      }
    }
  }

  return segments
}

function extractBoundedFaces(
  segments: Array<[Point, Point]>,
) {
  if (segments.length === 0) {
    return []
  }

  const vertexByKey = new Map<string, Point>()
  const outgoingByVertex = new Map<string, HalfEdge[]>()

  for (const [start, end] of segments) {
    const startKey = pointKey(start)
    const endKey = pointKey(end)
    vertexByKey.set(startKey, start)
    vertexByKey.set(endKey, end)

    const forward: HalfEdge = {
      from: startKey,
      to: endKey,
      angle: Math.atan2(end.y - start.y, end.x - start.x),
    }
    const reverse: HalfEdge = {
      from: endKey,
      to: startKey,
      angle: Math.atan2(start.y - end.y, start.x - end.x),
    }

    const startOutgoing = outgoingByVertex.get(startKey) ?? []
    startOutgoing.push(forward)
    outgoingByVertex.set(startKey, startOutgoing)

    const endOutgoing = outgoingByVertex.get(endKey) ?? []
    endOutgoing.push(reverse)
    outgoingByVertex.set(endKey, endOutgoing)
  }

  for (const edges of outgoingByVertex.values()) {
    edges.sort((left, right) => left.angle - right.angle)
  }

  const visited = new Set<string>()
  const boundedFaces: Point[][] = []

  for (const edges of outgoingByVertex.values()) {
    for (const edge of edges) {
      const startEdgeKey = `${edge.from}>${edge.to}`
      if (visited.has(startEdgeKey)) {
        continue
      }

      const face: Point[] = []
      let current = edge
      let guard = 0
      let closed = false

      while (guard < segments.length * 4) {
        guard += 1

        const currentEdgeKey = `${current.from}>${current.to}`
        if (visited.has(currentEdgeKey)) {
          break
        }
        visited.add(currentEdgeKey)
        face.push(vertexByKey.get(current.from)!)

        const outgoing = outgoingByVertex.get(current.to)
        if (!outgoing || outgoing.length === 0) {
          break
        }

        const reverseIndex = outgoing.findIndex((candidate) => candidate.to === current.from)
        if (reverseIndex < 0) {
          break
        }

        const nextIndex = (reverseIndex - 1 + outgoing.length) % outgoing.length
        current = outgoing[nextIndex]

        if (current.from === edge.from && current.to === edge.to) {
          face.push(vertexByKey.get(current.from)!)
          closed = true
          break
        }
      }

      if (!closed) {
        continue
      }

      const normalizedFace = normalizePolygon(face)
      if (normalizedFace.length < 3) {
        continue
      }

      const area = polygonArea(normalizedFace)
      if (area > FACE_AREA_EPSILON) {
        boundedFaces.push(normalizedFace)
      }
    }
  }

  return boundedFaces
}

function subtractInteriorClosedOutlines(
  subjectPolygons: Point[][],
  closedCutOutlines: ClosedOutline[],
) {
  if (subjectPolygons.length === 0 || closedCutOutlines.length === 0) {
    return subjectPolygons
  }

  const subjectAreas = subjectPolygons.map((polygon) => Math.abs(polygonArea(polygon)))
  const holeCandidates = closedCutOutlines
    .map((outline) => normalizePolygon(outline.polygon))
    .filter((polygon) => polygon.length >= 3)
    .filter((polygon) => {
      const area = Math.abs(polygonArea(polygon))
      if (area <= FACE_AREA_EPSILON) {
        return false
      }
      const centroid = polygonCentroid(polygon)
      return subjectPolygons.some(
        (subjectPolygon, index) =>
          subjectAreas[index] > area + FACE_AREA_EPSILON && pointInPolygon(centroid, subjectPolygon),
      )
    })

  if (holeCandidates.length === 0) {
    return subjectPolygons
  }

  return booleanOpPolygons(subjectPolygons, holeCandidates, 'difference')
}

export function buildPhysicalLayerRegions(params: {
  layerId: string
  shapes: Shape[]
  lineTypeById: Map<string, LineType>
  closedCutOutlines?: ClosedOutline[]
  tolerance?: number
}): PhysicalLayerRegion[] {
  const {
    layerId,
    shapes,
    lineTypeById,
    closedCutOutlines = [],
    tolerance = 0.5,
  } = params

  const segments = buildSplitSegments(shapes, lineTypeById, tolerance)
  const boundedFaces = extractBoundedFaces(segments)
  if (boundedFaces.length === 0) {
    return []
  }

  const unionPolygons = booleanOpPolygons(boundedFaces, [], 'union')
    .map(normalizePolygon)
    .filter((polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > FACE_AREA_EPSILON)
  if (unionPolygons.length === 0) {
    return []
  }

  const polygonsWithHoles = subtractInteriorClosedOutlines(unionPolygons, closedCutOutlines)
    .map(normalizePolygon)
    .filter((polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > FACE_AREA_EPSILON)
  if (polygonsWithHoles.length === 0) {
    return []
  }

  return buildOutlineRegions(
    polygonsWithHoles.map((polygon, index) => ({
      layerId,
      polygon,
      shapeIds: [`physical-region-${index}`],
    })),
  ).map((region) => ({
    outer: normalizePolygon(region.outer.polygon),
    holes: region.holes.map((hole) => normalizePolygon(hole.polygon)),
  }))
}
