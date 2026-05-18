import type { Point, LineShape, ArcShape } from '../../cad/cad-types'
import { distance, uid, round } from '../../cad/cad-geometry'

// ---------------------------------------------------------------------------
// Chamfer / Fillet corner (actMentori — corner beveling)
// ---------------------------------------------------------------------------

function normalizeVector(vx: number, vy: number): { x: number; y: number } | null {
  const len = Math.hypot(vx, vy)
  if (len < 1e-9) return null
  return { x: vx / len, y: vy / len }
}

/**
 * Intersection of two infinite lines (no segment bounds). Returns null when the
 * lines are parallel.
 */
export function infiniteLineIntersection(a: LineShape, b: LineShape): Point | null {
  const x1 = a.start.x
  const y1 = a.start.y
  const x2 = a.end.x
  const y2 = a.end.y
  const x3 = b.start.x
  const y3 = b.start.y
  const x4 = b.end.x
  const y4 = b.end.y
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-10) return null
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }
}

export type FilletResult = {
  trimmedA: LineShape
  trimmedB: LineShape
  arc: ArcShape
}

/**
 * Round the corner where two lines meet (or would meet if extended) with a
 * tangent arc of the given radius. Returns null when the lines are parallel or
 * the radius is too large for the available line lengths.
 */
export function filletCorner(
  lineA: LineShape,
  lineB: LineShape,
  radiusMm: number,
): FilletResult | null {
  if (!Number.isFinite(radiusMm) || radiusMm <= 0) return null

  const corner = infiniteLineIntersection(lineA, lineB)
  if (!corner) return null

  // Pick the "near" endpoint on each line (closer to the corner) as the one to trim.
  const distAStart = distance(lineA.start, corner)
  const distAEnd = distance(lineA.end, corner)
  const awayA = distAStart >= distAEnd ? lineA.start : lineA.end
  const distBStart = distance(lineB.start, corner)
  const distBEnd = distance(lineB.end, corner)
  const awayB = distBStart >= distBEnd ? lineB.start : lineB.end

  const v1 = normalizeVector(awayA.x - corner.x, awayA.y - corner.y)
  const v2 = normalizeVector(awayB.x - corner.x, awayB.y - corner.y)
  if (!v1 || !v2) return null

  const dotProduct = v1.x * v2.x + v1.y * v2.y
  const clampedDot = Math.max(-1, Math.min(1, dotProduct))
  const angle = Math.acos(clampedDot)
  if (angle < 1e-3 || Math.abs(Math.PI - angle) < 1e-3) return null

  const trimDist = radiusMm / Math.tan(angle / 2)
  const maxTrim = Math.min(distance(awayA, corner), distance(awayB, corner))
  if (trimDist >= maxTrim - 1e-6) return null

  const trimA = { x: corner.x + v1.x * trimDist, y: corner.y + v1.y * trimDist }
  const trimB = { x: corner.x + v2.x * trimDist, y: corner.y + v2.y * trimDist }

  const bisector = normalizeVector(v1.x + v2.x, v1.y + v2.y)
  if (!bisector) return null
  const centerDist = radiusMm / Math.sin(angle / 2)
  const arcCenter = {
    x: corner.x + bisector.x * centerDist,
    y: corner.y + bisector.y * centerDist,
  }
  const arcMid = {
    x: arcCenter.x - bisector.x * radiusMm,
    y: arcCenter.y - bisector.y * radiusMm,
  }

  const roundPoint = (point: Point): Point => ({ x: round(point.x), y: round(point.y) })
  return {
    trimmedA: { ...lineA, start: roundPoint(awayA), end: roundPoint(trimA) },
    trimmedB: { ...lineB, start: roundPoint(awayB), end: roundPoint(trimB) },
    arc: {
      id: uid(),
      type: 'arc',
      layerId: lineA.layerId,
      lineTypeId: lineA.lineTypeId,
      groupId: lineA.groupId,
      start: roundPoint(trimA),
      mid: roundPoint(arcMid),
      end: roundPoint(trimB),
    },
  }
}

export type BatchFilletResult = {
  trimmedLinesById: Map<string, LineShape>
  arcs: ArcShape[]
  appliedCornerCount: number
}

/**
 * Source-app v2.3.1: "Supported batch beveling by range-selection." Walks every
 * adjacent endpoint pair across the supplied lines, applying `filletCorner` to
 * each in-place so a single chained selection can be rounded in one shot.
 */
export function filletAdjacentCorners(lines: LineShape[], radiusMm: number): BatchFilletResult {
  const tolerance = 1e-3
  const working = new Map<string, LineShape>(lines.map((line) => [line.id, { ...line }]))
  const arcs: ArcShape[] = []
  const consumedEndpoints = new Set<string>()
  let appliedCornerCount = 0

  const endpointKey = (lineId: string, end: 'start' | 'end') => `${lineId}:${end}`
  const endpointsMatch = (p1: Point, p2: Point) => distance(p1, p2) < tolerance

  const lineIds = Array.from(working.keys())
  for (let i = 0; i < lineIds.length; i += 1) {
    for (let j = i + 1; j < lineIds.length; j += 1) {
      const lineA = working.get(lineIds[i])
      const lineB = working.get(lineIds[j])
      if (!lineA || !lineB) continue

      const aEnds: Array<'start' | 'end'> = ['start', 'end']
      const bEnds: Array<'start' | 'end'> = ['start', 'end']
      let matched = false
      for (const aEnd of aEnds) {
        if (matched) break
        if (consumedEndpoints.has(endpointKey(lineA.id, aEnd))) continue
        for (const bEnd of bEnds) {
          if (consumedEndpoints.has(endpointKey(lineB.id, bEnd))) continue
          if (!endpointsMatch(lineA[aEnd], lineB[bEnd])) continue
          const result = filletCorner(lineA, lineB, radiusMm)
          if (!result) continue
          working.set(lineA.id, result.trimmedA)
          working.set(lineB.id, result.trimmedB)
          arcs.push(result.arc)
          appliedCornerCount += 1
          consumedEndpoints.add(endpointKey(lineA.id, aEnd))
          consumedEndpoints.add(endpointKey(lineB.id, bEnd))
          matched = true
          break
        }
      }
    }
  }

  return { trimmedLinesById: working, arcs, appliedCornerCount }
}
