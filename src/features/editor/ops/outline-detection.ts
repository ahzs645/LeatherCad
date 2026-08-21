/**
 * Detects closed outlines and open paths from a set of shapes.
 * Groups shapes into endpoint-connected chains and classifies them
 * as closed (piece outlines) or open (surface marks).
 */

import { pointInPolygon as atelierPointInPolygon } from '@atelier/geometry'

import type { Point, Shape, LineType } from '../cad/cad-types'
import { shapeToPolyline, polygonArea } from './polygon-ops'

/**
 * The run of `polygon` vertices contributed by one authored shape, and whether
 * that shape was walked backwards to close the chain.
 *
 * This is the bridge between the sampled polygon and the geometry the user drew.
 * Curves sample to 48 segments, so a four-sided piece with one arc side has 51
 * polygon edges — an `edgeIndex` into it names a 1/48 chord, not a side. Anything
 * that wants to talk about "the edge the user clicked" has to work in shape ids
 * and resolve to indices through here.
 */
export type OutlineChainSegment = {
  shapeId: string
  /** First `polygon` index belonging to this shape. */
  startIndex: number
  /** Last `polygon` index belonging to this shape. */
  endIndex: number
  /** The shape's own direction was flipped to chain it. */
  reversed: boolean
}

export type OutlineChain = {
  id: string
  shapeIds: string[]
  polygon: Point[]
  segments: OutlineChainSegment[]
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
    const segments: OutlineChainSegment[] = [
      {
        shapeId: entries[startIdx].shapeId,
        startIndex: 0,
        endIndex: chain.length - 1,
        reversed: false,
      },
    ]
    used.add(startIdx)

    // Chain forward
    let iterations = 0
    while (iterations < entries.length) {
      const next = findNext(chain[chain.length - 1], used)
      if (!next) break
      used.add(next.index)
      shapeIds.push(entries[next.index].shapeId)
      const pl = next.reversed ? [...entries[next.index].pts].reverse() : entries[next.index].pts
      const startIndex = chain.length - 1
      chain.push(...pl.slice(1))
      segments.push({
        shapeId: entries[next.index].shapeId,
        startIndex,
        endIndex: chain.length - 1,
        reversed: next.reversed,
      })
      iterations++
    }

    const first = chain[0]
    const last = chain[chain.length - 1]
    const isClosed = chain.length >= 3 && dist(first, last) <= tolerance
    const area = isClosed ? Math.abs(polygonArea(chain)) : 0
    const id = shapeIds.slice().sort().join('+')

    chains.push({ id, shapeIds, polygon: chain, segments, isClosed, area })
  }

  return chains
}

/** The segment a given authored shape contributed to a chain, if any. */
export function chainSegmentForShape(
  chain: OutlineChain,
  shapeId: string,
): OutlineChainSegment | null {
  return chain.segments.find((segment) => segment.shapeId === shapeId) ?? null
}

/**
 * The polygon edge indices spanned by one authored shape, as a half-open
 * `[first, last]` inclusive pair. A straight side yields a single index; a
 * sampled curve yields the whole run.
 */
export function edgeRangeForShape(
  chain: OutlineChain,
  shapeId: string,
): { firstEdgeIndex: number; lastEdgeIndex: number } | null {
  const segment = chainSegmentForShape(chain, shapeId)
  if (!segment || segment.endIndex <= segment.startIndex) {
    return null
  }
  return { firstEdgeIndex: segment.startIndex, lastEdgeIndex: segment.endIndex - 1 }
}

/** The authored shape that owns a given polygon edge index. */
export function shapeIdForEdgeIndex(chain: OutlineChain, edgeIndex: number): string | null {
  const segment = chain.segments.find(
    (entry) => edgeIndex >= entry.startIndex && edgeIndex < entry.endIndex,
  )
  return segment?.shapeId ?? null
}

/**
 * Where `edgeIndex`/`t` sits along the authored shape as a whole, in 0..1.
 * Clicking the middle of a sampled arc reports ~0.5 rather than the position
 * within whichever chord happened to be hit.
 */
export function shapeParameterForEdge(
  chain: OutlineChain,
  edgeIndex: number,
  t: number,
): { shapeId: string; parameter: number } | null {
  const segment = chain.segments.find(
    (entry) => edgeIndex >= entry.startIndex && edgeIndex < entry.endIndex,
  )
  if (!segment) {
    return null
  }
  const edgeCount = segment.endIndex - segment.startIndex
  if (edgeCount <= 0) {
    return null
  }
  const local = edgeIndex - segment.startIndex + Math.min(Math.max(t, 0), 1)
  return { shapeId: segment.shapeId, parameter: Math.min(Math.max(local / edgeCount, 0), 1) }
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
  return atelierPointInPolygon(point, polygon)
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
