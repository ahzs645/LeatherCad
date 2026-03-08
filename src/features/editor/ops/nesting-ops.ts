/**
 * NFP (No-Fit Polygon) nesting algorithm for optimizing pattern piece
 * placement on irregular leather hides.
 *
 * Implements:
 *  - NFP computation using Minkowski sum approach
 *  - Bottom-left placement heuristic
 *  - Rotation support (0°, 90°, 180°, 270°)
 *  - Hide boundary definition
 *  - Waste percentage calculation
 */

import type { Point, Shape } from '../cad/cad-types'
import {
  type Polygon,
  shapesToPolygons,
  polygonArea,
  polygonBounds,
  polygonCentroid,
  translatePolygon,
  rotatePolygon,
  ensureCCW,
} from './polygon-ops'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NestingPiece = {
  id: string
  polygon: Polygon
  quantity: number
}

export type NestingConfig = {
  /** Allowed rotation angles in degrees */
  rotations: number[]
  /** Spacing between pieces in mm */
  spacing: number
  /** Number of optimization passes */
  iterations: number
}

export type PlacedPiece = {
  id: string
  polygon: Polygon
  position: Point
  rotationDeg: number
}

export type NestingResult = {
  placements: PlacedPiece[]
  bounds: { width: number; height: number }
  usedArea: number
  totalArea: number
  wastePercent: number
  /** Pieces that couldn't be placed */
  unplaced: string[]
}

export const DEFAULT_NESTING_CONFIG: NestingConfig = {
  rotations: [0, 90, 180, 270],
  spacing: 2,
  iterations: 3,
}

// ---------------------------------------------------------------------------
// NFP Computation (simplified Minkowski-sum approach)
// ---------------------------------------------------------------------------

/**
 * Computes a simplified No-Fit Polygon for placing polygon B around
 * a fixed polygon A. The NFP boundary represents positions where B's
 * reference point can be placed such that B exactly touches A.
 *
 * Uses the orbit/sliding approach: trace B around A's boundary.
 */
export function computeNFP(fixed: Polygon, moving: Polygon): Polygon {
  // Use Minkowski sum approach:
  // NFP = Minkowski sum of fixed polygon and negated (reflected) moving polygon
  const fixedCCW = ensureCCW(fixed)
  const centroid = polygonCentroid(moving)

  // Negate the moving polygon around its centroid
  const negated: Polygon = moving.map((p) => ({
    x: -(p.x - centroid.x),
    y: -(p.y - centroid.y),
  }))

  // Simplified: compute convex hull of Minkowski sum
  // For non-convex polygons this is an approximation
  const sumPoints: Point[] = []
  for (const fp of fixedCCW) {
    for (const np of negated) {
      sumPoints.push({
        x: fp.x + np.x,
        y: fp.y + np.y,
      })
    }
  }

  return convexHull(sumPoints)
}

/**
 * Andrew's monotone chain convex hull algorithm. O(n log n).
 */
function convexHull(points: Point[]): Polygon {
  if (points.length < 3) return [...points]

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const n = sorted.length

  // Build lower hull
  const lower: Point[] = []
  for (let i = 0; i < n; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
      lower.pop()
    }
    lower.push(sorted[i])
  }

  // Build upper hull
  const upper: Point[] = []
  for (let i = n - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
      upper.pop()
    }
    upper.push(sorted[i])
  }

  // Remove last point of each half because it's repeated
  lower.pop()
  upper.pop()

  return lower.concat(upper)
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

// ---------------------------------------------------------------------------
// Point-in-polygon test
// ---------------------------------------------------------------------------

function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = polygon[i].y
    const yj = polygon[j].y
    if ((yi > point.y) !== (yj > point.y)) {
      const xi = polygon[i].x
      const xj = polygon[j].x
      const intersectX = ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
      if (point.x < intersectX) {
        inside = !inside
      }
    }
  }
  return inside
}

// ---------------------------------------------------------------------------
// Polygon overlap test (simplified using sampling)
// ---------------------------------------------------------------------------

function polygonsOverlap(a: Polygon, b: Polygon, tolerance: number): boolean {
  // Quick AABB check
  const boundsA = polygonBounds(a)
  const boundsB = polygonBounds(b)

  if (
    boundsA.maxX + tolerance < boundsB.minX ||
    boundsB.maxX + tolerance < boundsA.minX ||
    boundsA.maxY + tolerance < boundsB.minY ||
    boundsB.maxY + tolerance < boundsA.minY
  ) {
    return false
  }

  // Sample points from B and check if any are inside A
  for (const p of b) {
    if (pointInPolygon(p, a)) return true
  }
  for (const p of a) {
    if (pointInPolygon(p, b)) return true
  }

  // Check edge intersections
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i]
    const a2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j]
      const b2 = b[(j + 1) % b.length]
      if (segmentsIntersect(a1, a2, b1, b2)) return true
    }
  }

  return false
}

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const d1 = cross(a1, a2, b1)
  const d2 = cross(a1, a2, b2)
  const d3 = cross(b1, b2, a1)
  const d4 = cross(b1, b2, a2)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Bottom-left placement
// ---------------------------------------------------------------------------

/**
 * Finds the bottom-left position to place a piece within bounds
 * that doesn't overlap with any existing placed pieces.
 */
function findBottomLeftPosition(
  piece: Polygon,
  placedPieces: Polygon[],
  hideBounds: { minX: number; minY: number; maxX: number; maxY: number },
  spacing: number,
  stepSize: number,
): Point | null {
  const pBounds = polygonBounds(piece)
  const pWidth = pBounds.maxX - pBounds.minX
  const pHeight = pBounds.maxY - pBounds.minY

  // Scan from bottom-left
  for (let y = hideBounds.minY + spacing; y + pHeight <= hideBounds.maxY - spacing; y += stepSize) {
    for (let x = hideBounds.minX + spacing; x + pWidth <= hideBounds.maxX - spacing; x += stepSize) {
      const dx = x - pBounds.minX
      const dy = y - pBounds.minY
      const translated = translatePolygon(piece, dx, dy)

      let fits = true
      for (const placed of placedPieces) {
        if (polygonsOverlap(translated, placed, spacing)) {
          fits = false
          break
        }
      }

      if (fits) {
        return { x: dx, y: dy }
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Main nesting algorithm
// ---------------------------------------------------------------------------

/**
 * Nests pieces within a hide boundary using bottom-left placement with
 * rotation optimization.
 *
 * @param pieces - Pattern pieces to nest
 * @param hideBoundary - The hide shape boundary (or null for rectangular area)
 * @param hideWidth - Width of hide in mm (used if no boundary)
 * @param hideHeight - Height of hide in mm (used if no boundary)
 * @param config - Nesting configuration
 */
export function nestPieces(
  pieces: NestingPiece[],
  hideWidth: number,
  hideHeight: number,
  config: NestingConfig = DEFAULT_NESTING_CONFIG,
): NestingResult {
  const hideBounds = {
    minX: 0,
    minY: 0,
    maxX: hideWidth,
    maxY: hideHeight,
  }

  // Expand pieces by quantity
  const expandedPieces: { id: string; polygon: Polygon }[] = []
  for (const piece of pieces) {
    for (let q = 0; q < piece.quantity; q++) {
      expandedPieces.push({
        id: `${piece.id}${piece.quantity > 1 ? `_${q + 1}` : ''}`,
        polygon: piece.polygon,
      })
    }
  }

  // Sort by area (largest first — heuristic)
  expandedPieces.sort((a, b) => {
    return Math.abs(polygonArea(b.polygon)) - Math.abs(polygonArea(a.polygon))
  })

  // Step size for scanning (adaptive based on smallest piece)
  const minDim = Math.min(
    ...expandedPieces.map((p) => {
      const b = polygonBounds(p.polygon)
      return Math.min(b.width, b.height)
    }),
  )
  const stepSize = Math.max(1, Math.min(minDim / 4, 5))

  let bestResult: NestingResult | null = null

  for (let pass = 0; pass < config.iterations; pass++) {
    const placements: PlacedPiece[] = []
    const placedPolygons: Polygon[] = []
    const unplaced: string[] = []

    // Shuffle order slightly for different passes (except first)
    const order = [...expandedPieces]
    if (pass > 0) {
      // Fisher-Yates partial shuffle — swap ~30% of elements
      for (let i = order.length - 1; i > 0; i--) {
        if (Math.random() < 0.3) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[order[i], order[j]] = [order[j], order[i]]
        }
      }
    }

    for (const piece of order) {
      let placed = false

      for (const rotDeg of config.rotations) {
        const centroid = polygonCentroid(piece.polygon)
        const rotated = rotDeg === 0
          ? piece.polygon
          : rotatePolygon(piece.polygon, centroid, rotDeg)

        // Normalize to origin
        const rBounds = polygonBounds(rotated)
        const normalized = translatePolygon(rotated, -rBounds.minX, -rBounds.minY)

        const pos = findBottomLeftPosition(
          normalized,
          placedPolygons,
          hideBounds,
          config.spacing,
          stepSize,
        )

        if (pos) {
          const finalPoly = translatePolygon(normalized, pos.x, pos.y)
          placements.push({
            id: piece.id,
            polygon: finalPoly,
            position: pos,
            rotationDeg: rotDeg,
          })
          placedPolygons.push(finalPoly)
          placed = true
          break
        }
      }

      if (!placed) {
        unplaced.push(piece.id)
      }
    }

    // Calculate metrics
    const usedArea = placements.reduce(
      (sum, p) => sum + Math.abs(polygonArea(p.polygon)),
      0,
    )
    const totalArea = hideWidth * hideHeight
    const wastePercent = totalArea > 0 ? ((totalArea - usedArea) / totalArea) * 100 : 100

    // Find actual bounds used
    let maxUsedX = 0
    let maxUsedY = 0
    for (const p of placements) {
      const b = polygonBounds(p.polygon)
      maxUsedX = Math.max(maxUsedX, b.maxX)
      maxUsedY = Math.max(maxUsedY, b.maxY)
    }

    const result: NestingResult = {
      placements,
      bounds: { width: maxUsedX, height: maxUsedY },
      usedArea,
      totalArea,
      wastePercent,
      unplaced,
    }

    if (!bestResult || result.wastePercent < bestResult.wastePercent) {
      bestResult = result
    }
  }

  return bestResult!
}

/**
 * Converts selected shapes into NestingPieces by grouping by layer.
 * Each layer's shapes are chained into a polygon.
 */
export function shapesToNestingPieces(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
): NestingPiece[] {
  const selectedShapes = shapes.filter((s) => selectedShapeIds.has(s.id))
  if (selectedShapes.length === 0) return []

  // Group by layer
  const byLayer = new Map<string, Shape[]>()
  for (const s of selectedShapes) {
    const arr = byLayer.get(s.layerId) ?? []
    arr.push(s)
    byLayer.set(s.layerId, arr)
  }

  const pieces: NestingPiece[] = []
  for (const [layerId, layerShapes] of byLayer) {
    const polygons = shapesToPolygons(layerShapes)
    for (let i = 0; i < polygons.length; i++) {
      if (polygons[i].length >= 3) {
        pieces.push({
          id: `${layerId}_${i}`,
          polygon: polygons[i],
          quantity: 1,
        })
      }
    }
  }

  return pieces
}
