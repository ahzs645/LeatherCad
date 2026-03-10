import type { Point } from '../cad/cad-types'
import { pointInPolygon } from '../ops/outline-detection'
import type { OutlinePolygon } from './three-bridge'

export type OutlineRegion = {
  outer: OutlinePolygon
  holes: OutlinePolygon[]
}

type IndexedOutline = {
  index: number
  outline: OutlinePolygon
  points: Point[]
  area: number
  centroid: Point
  parentIndex: number | null
}

const EPSILON = 1e-6

function pointsEqual(a: Point, b: Point) {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON
}

function normalizePolygon(points: Point[]) {
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

  if (Math.abs(accumulatedArea) <= EPSILON) {
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

export function buildOutlineRegions(outlines: OutlinePolygon[]): OutlineRegion[] {
  const indexed: IndexedOutline[] = outlines
    .map((outline, index) => {
      const points = normalizePolygon(outline.polygon)
      return {
        index,
        outline,
        points,
        area: Math.abs(polygonSignedArea(points)),
        centroid: polygonCentroid(points),
        parentIndex: null,
      }
    })
    .filter((entry) => entry.points.length >= 3 && entry.area > EPSILON)

  for (const candidate of indexed) {
    let bestParentIndex: number | null = null
    let bestParentArea = Number.POSITIVE_INFINITY

    for (const container of indexed) {
      if (container.index === candidate.index) {
        continue
      }
      if (container.area <= candidate.area + EPSILON) {
        continue
      }
      if (!pointInPolygon(candidate.centroid, container.points)) {
        continue
      }
      if (container.area < bestParentArea) {
        bestParentArea = container.area
        bestParentIndex = container.index
      }
    }

    candidate.parentIndex = bestParentIndex
  }

  const indexedById = new Map(indexed.map((entry) => [entry.index, entry]))
  const depthByIndex = new Map<number, number>()
  const getDepth = (index: number): number => {
    const cached = depthByIndex.get(index)
    if (typeof cached === 'number') {
      return cached
    }
    const current = indexedById.get(index)
    if (!current || current.parentIndex === null) {
      depthByIndex.set(index, 0)
      return 0
    }
    const depth = getDepth(current.parentIndex) + 1
    depthByIndex.set(index, depth)
    return depth
  }

  const regions: OutlineRegion[] = []
  const regionByOuterIndex = new Map<number, OutlineRegion>()

  for (const entry of indexed) {
    if (getDepth(entry.index) % 2 !== 0) {
      continue
    }
    const region: OutlineRegion = {
      outer: entry.outline,
      holes: [],
    }
    regions.push(region)
    regionByOuterIndex.set(entry.index, region)
  }

  for (const entry of indexed) {
    if (getDepth(entry.index) % 2 === 0 || entry.parentIndex === null) {
      continue
    }
    regionByOuterIndex.get(entry.parentIndex)?.holes.push(entry.outline)
  }

  return regions
}
