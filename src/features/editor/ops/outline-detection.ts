/**
 * Detects closed outlines and open paths from a set of shapes.
 * Groups shapes into endpoint-connected chains and classifies them
 * as closed (piece outlines) or open (surface marks).
 */

import type { Point, Shape, LineType } from '../cad/cad-types'
import { shapeToPolyline, polygonArea } from './polygon-ops'

export type OutlineChain = {
  id: string
  shapeIds: string[]
  polygon: Point[]
  isClosed: boolean
  area: number
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function polylineEndpoints(pts: Point[]): { start: Point; end: Point } | null {
  if (pts.length < 2) return null
  return { start: pts[0], end: pts[pts.length - 1] }
}

/**
 * Chains shapes by endpoint proximity and classifies each chain
 * as closed (first ≈ last point) or open.
 */
export function detectOutlines(
  shapes: Shape[],
  lineTypes: LineType[],
  tolerance = 0.5,
): OutlineChain[] {
  const lineTypeMap = new Map(lineTypes.map((lt) => [lt.id, lt]))

  // Filter to geometric shapes with 'cut' role (piece boundaries)
  const candidates = shapes.filter((s) => {
    if (s.type === 'text') return false
    const lt = lineTypeMap.get(s.lineTypeId)
    // Include shapes with cut role or no role specified
    if (lt && lt.role !== 'cut') return false
    return true
  })

  if (candidates.length === 0) return []

  // Sample each shape into a polyline, keeping track of shape IDs
  const entries = candidates
    .map((shape) => {
      const pts = shapeToPolyline(shape)
      const endpoints = polylineEndpoints(pts)
      if (!endpoints) return null
      return { shapeId: shape.id, pts, start: endpoints.start, end: endpoints.end }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  if (entries.length === 0) return []

  // Chain shapes by matching endpoints
  const used = new Set<number>()
  const chains: OutlineChain[] = []

  function findNext(endPoint: Point, exclude: Set<number>): { index: number; reversed: boolean } | null {
    let bestIndex = -1
    let bestDist = tolerance
    let bestReversed = false

    for (let i = 0; i < entries.length; i++) {
      if (exclude.has(i)) continue
      const e = entries[i]
      const dStart = dist(endPoint, e.start)
      const dEnd = dist(endPoint, e.end)

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

  for (let startIdx = 0; startIdx < entries.length; startIdx++) {
    if (used.has(startIdx)) continue

    const shapeIds: string[] = [entries[startIdx].shapeId]
    const chain: Point[] = [...entries[startIdx].pts]
    used.add(startIdx)

    // Chain forward
    let iterations = 0
    while (iterations < entries.length) {
      const next = findNext(chain[chain.length - 1], used)
      if (!next) break
      used.add(next.index)
      shapeIds.push(entries[next.index].shapeId)
      const pl = next.reversed ? [...entries[next.index].pts].reverse() : entries[next.index].pts
      chain.push(...pl.slice(1))
      iterations++
    }

    const first = chain[0]
    const last = chain[chain.length - 1]
    const isClosed = chain.length >= 3 && dist(first, last) <= tolerance
    const area = isClosed ? Math.abs(polygonArea(chain)) : 0
    const id = shapeIds.slice().sort().join('+')

    chains.push({ id, shapeIds, polygon: chain, isClosed, area })
  }

  return chains
}

/**
 * Returns all shapes that are part of closed outline chains.
 * These shapes define leather piece boundaries.
 */
export function closedOutlineShapeIds(chains: OutlineChain[]): Set<string> {
  const set = new Set<string>()
  for (const chain of chains) {
    if (chain.isClosed) {
      for (const id of chain.shapeIds) set.add(id)
    }
  }
  return set
}

/**
 * Returns all open (non-closed) chains.
 */
export function openPathChains(chains: OutlineChain[]): OutlineChain[] {
  return chains.filter((c) => !c.isClosed)
}

/**
 * Point-in-polygon test (ray casting).
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (
      polygon[i].y > point.y !== polygon[j].y > point.y &&
      point.x < ((polygon[j].x - polygon[i].x) * (point.y - polygon[i].y)) / (polygon[j].y - polygon[i].y) + polygon[i].x
    ) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Computes the centroid of a point array.
 */
export function chainCentroid(pts: Point[]): Point {
  let cx = 0
  let cy = 0
  for (const p of pts) {
    cx += p.x
    cy += p.y
  }
  return { x: cx / pts.length, y: cy / pts.length }
}
