/**
 * Freehand curve fitting operations.
 *
 * Converts raw mouse/touch point arrays from freehand drawing into smooth
 * bezier curves using:
 *  1. Ramer-Douglas-Peucker simplification
 *  2. Quadratic bezier fitting via least-squares
 *
 * Output: Array of BezierShape (quadratic) segments.
 */

import { uid } from '../cad/cad-geometry'
import type { Point, Shape, BezierShape } from '../cad/cad-types'

// ---------------------------------------------------------------------------
// Ramer-Douglas-Peucker simplification
// ---------------------------------------------------------------------------

/**
 * Simplifies a polyline using the Ramer-Douglas-Peucker algorithm.
 *
 * @param points - Input polyline points
 * @param epsilon - Maximum allowed perpendicular distance (mm)
 * @returns Simplified polyline
 */
export function rdpSimplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return [...points]

  // Find the point with the greatest distance from the line
  // between the first and last point
  let maxDist = 0
  let maxIndex = 0

  const start = points[0]
  const end = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end)
    if (d > maxDist) {
      maxDist = d
      maxIndex = i
    }
  }

  if (maxDist > epsilon) {
    // Recursive simplification
    const left = rdpSimplify(points.slice(0, maxIndex + 1), epsilon)
    const right = rdpSimplify(points.slice(maxIndex), epsilon)
    return [...left.slice(0, -1), ...right]
  }

  return [start, end]
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lenSq = dx * dx + dy * dy

  if (lenSq < 1e-12) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y)
  }

  const t = Math.max(0, Math.min(1,
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq,
  ))

  const projX = lineStart.x + t * dx
  const projY = lineStart.y + t * dy

  return Math.hypot(point.x - projX, point.y - projY)
}

// ---------------------------------------------------------------------------
// Quadratic bezier fitting
// ---------------------------------------------------------------------------

/**
 * Fits a quadratic bezier to a set of points.
 *
 * Uses least-squares to find the optimal control point given
 * fixed start and end points.
 *
 * @param points - Points to fit (first and last are start/end)
 * @returns Control point for the quadratic bezier
 */
function fitQuadraticBezier(points: Point[]): Point {
  if (points.length <= 2) {
    // Degenerate case: control = midpoint
    return {
      x: (points[0].x + points[points.length - 1].x) / 2,
      y: (points[0].y + points[points.length - 1].y) / 2,
    }
  }

  const p0 = points[0]
  const p2 = points[points.length - 1]
  const n = points.length

  // Parameterize by chord length
  const t: number[] = [0]
  let totalLen = 0
  for (let i = 1; i < n; i++) {
    totalLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    t.push(totalLen)
  }
  if (totalLen > 0) {
    for (let i = 0; i < n; i++) {
      t[i] /= totalLen
    }
  }

  // Solve for control point P1 using least-squares:
  // B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
  // Minimize sum of |B(t_i) - points[i]|^2
  //
  // d/dP1 = 0 gives:
  // P1 = sum(w_i * (points[i] - (1-t_i)^2*P0 - t_i^2*P2)) / sum(w_i)
  // where w_i = 2*(1-t_i)*t_i

  let sumW = 0
  let sumWx = 0
  let sumWy = 0

  for (let i = 1; i < n - 1; i++) {
    const ti = t[i]
    const b0 = (1 - ti) * (1 - ti)
    const b1 = 2 * (1 - ti) * ti
    const b2 = ti * ti

    const w = b1 * b1 // Weight
    const residX = points[i].x - b0 * p0.x - b2 * p2.x
    const residY = points[i].y - b0 * p0.y - b2 * p2.y

    sumW += w
    sumWx += w * residX / b1
    sumWy += w * residY / b1
  }

  if (sumW < 1e-12) {
    return {
      x: (p0.x + p2.x) / 2,
      y: (p0.y + p2.y) / 2,
    }
  }

  return {
    x: sumWx / sumW,
    y: sumWy / sumW,
  }
}

/**
 * Calculates the maximum fitting error for a quadratic bezier.
 */
function bezierFitError(points: Point[], p0: Point, control: Point, p2: Point): number {
  if (points.length <= 2) return 0

  const n = points.length

  // Parameterize
  const t: number[] = [0]
  let totalLen = 0
  for (let i = 1; i < n; i++) {
    totalLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    t.push(totalLen)
  }
  if (totalLen > 0) {
    for (let i = 0; i < n; i++) t[i] /= totalLen
  }

  let maxError = 0
  for (let i = 1; i < n - 1; i++) {
    const ti = t[i]
    const bx = (1 - ti) * (1 - ti) * p0.x + 2 * (1 - ti) * ti * control.x + ti * ti * p2.x
    const by = (1 - ti) * (1 - ti) * p0.y + 2 * (1 - ti) * ti * control.y + ti * ti * p2.y
    const err = Math.hypot(bx - points[i].x, by - points[i].y)
    maxError = Math.max(maxError, err)
  }

  return maxError
}

// ---------------------------------------------------------------------------
// Main curve fitting
// ---------------------------------------------------------------------------

/**
 * Fits a freehand stroke to a series of quadratic bezier segments.
 *
 * Algorithm:
 *  1. Simplify with RDP to remove noise
 *  2. Split into segments at corners (high curvature points)
 *  3. Fit each segment with a quadratic bezier
 *  4. If error is too high, split and refit
 *
 * @param rawPoints - Raw input points from mouse/touch
 * @param tolerance - Fitting tolerance in mm (lower = more segments)
 * @param layerId - Layer for created shapes
 * @param lineTypeId - Line type for created shapes
 * @param groupId - Optional group ID
 * @returns Array of BezierShape segments
 */
export function fitFreehandCurve(
  rawPoints: Point[],
  tolerance: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): Shape[] {
  if (rawPoints.length < 2) return []

  // Step 1: Remove duplicate/near-duplicate points
  const cleaned: Point[] = [rawPoints[0]]
  for (let i = 1; i < rawPoints.length; i++) {
    const last = cleaned[cleaned.length - 1]
    if (Math.hypot(rawPoints[i].x - last.x, rawPoints[i].y - last.y) > 0.1) {
      cleaned.push(rawPoints[i])
    }
  }

  if (cleaned.length < 2) return []

  // Step 2: RDP simplification (gentle — we want some density for fitting)
  const simplified = rdpSimplify(cleaned, tolerance * 0.3)

  if (simplified.length < 2) return []

  // Step 3: Find corner points (high curvature)
  const corners = findCorners(simplified)

  // Step 4: Split into segments and fit each
  const shapes: Shape[] = []
  let segStart = 0

  for (const cornerIdx of corners) {
    if (cornerIdx > segStart) {
      const segment = simplified.slice(segStart, cornerIdx + 1)
      shapes.push(...fitSegment(segment, tolerance, layerId, lineTypeId, groupId))
    }
    segStart = cornerIdx
  }

  // Fit last segment
  if (segStart < simplified.length - 1) {
    const segment = simplified.slice(segStart)
    shapes.push(...fitSegment(segment, tolerance, layerId, lineTypeId, groupId))
  }

  // If no beziers were generated (very short stroke), create a line
  if (shapes.length === 0 && cleaned.length >= 2) {
    shapes.push({
      id: uid(),
      type: 'line',
      layerId,
      lineTypeId,
      groupId,
      start: cleaned[0],
      end: cleaned[cleaned.length - 1],
    })
  }

  return shapes
}

/**
 * Finds corner indices in a polyline by detecting high curvature.
 */
function findCorners(points: Point[]): number[] {
  const corners: number[] = []

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    // Angle between segments
    const dx1 = curr.x - prev.x
    const dy1 = curr.y - prev.y
    const dx2 = next.x - curr.x
    const dy2 = next.y - curr.y

    const len1 = Math.hypot(dx1, dy1)
    const len2 = Math.hypot(dx2, dy2)

    if (len1 < 1e-6 || len2 < 1e-6) continue

    const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2)
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    const angleDeg = (angle * 180) / Math.PI

    // Sharp corner detection: angle > 45 degrees from straight
    if (angleDeg > 45) {
      corners.push(i)
    }
  }

  return corners
}

/**
 * Fits a single segment to one or more quadratic beziers.
 */
function fitSegment(
  points: Point[],
  tolerance: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): BezierShape[] {
  if (points.length < 2) return []

  if (points.length === 2) {
    // Straight line — use a bezier with control at midpoint
    const mid: Point = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    }
    return [{
      id: uid(),
      type: 'bezier',
      layerId,
      lineTypeId,
      groupId,
      start: points[0],
      control: mid,
      end: points[1],
    }]
  }

  // Try fitting the whole segment
  const control = fitQuadraticBezier(points)
  const error = bezierFitError(points, points[0], control, points[points.length - 1])

  if (error <= tolerance) {
    return [{
      id: uid(),
      type: 'bezier',
      layerId,
      lineTypeId,
      groupId,
      start: points[0],
      control,
      end: points[points.length - 1],
    }]
  }

  // Split at midpoint and recurse
  const mid = Math.floor(points.length / 2)
  const left = fitSegment(points.slice(0, mid + 1), tolerance, layerId, lineTypeId, groupId)
  const right = fitSegment(points.slice(mid), tolerance, layerId, lineTypeId, groupId)

  return [...left, ...right]
}

/**
 * Smooths a set of points using a moving average filter.
 * Useful for reducing jitter in raw input before curve fitting.
 */
export function smoothPoints(points: Point[], windowSize = 3): Point[] {
  if (points.length <= windowSize) return [...points]

  const result: Point[] = [points[0]]
  const half = Math.floor(windowSize / 2)

  for (let i = 1; i < points.length - 1; i++) {
    let sumX = 0
    let sumY = 0
    let count = 0

    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      sumX += points[j].x
      sumY += points[j].y
      count++
    }

    result.push({ x: sumX / count, y: sumY / count })
  }

  result.push(points[points.length - 1])
  return result
}
