import type { Point, Shape, LineShape, StitchHole } from '../cad/cad-types'
import { uid, distance } from '../cad/cad-geometry'

export type BoxStitchParams = {
  width: number
  depth: number
  height: number
  stitchPitchMm: number
  cornerMarginMm: number
  materialThicknessMm: number
  layerId: string
  lineTypeId: string
}

export type BoxStitchResult = {
  guideLines: LineShape[]
  stitchHoles: StitchHole[]
}

type BoxStitchEdge = 'top' | 'right' | 'bottom' | 'left'

type BoxStitchBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type BoxStitchEdgeCandidate = {
  edge: BoxStitchEdge
  shape: LineShape
  minParallel: number
  maxParallel: number
}

export type ExtractedBoxStitchGuidesResult = {
  guideLines: LineShape[]
  extractedEdgeCount: number
  usedFallback: boolean
}

function lineAngleDeg(start: Point, end: Point): number {
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
}

function perpendicularAngleDeg(start: Point, end: Point): number {
  return lineAngleDeg(start, end) + 90
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getBoundsFromShapes(shapes: Shape[]): BoxStitchBounds | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const shape of shapes) {
    const points = getShapePointList(shape)
    for (const point of points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }

  return { minX, minY, maxX, maxY }
}

function candidateParallelRange(candidate: BoxStitchEdgeCandidate) {
  return {
    start: Math.min(candidate.minParallel, candidate.maxParallel),
    end: Math.max(candidate.minParallel, candidate.maxParallel),
  }
}

function findBestEdgeCandidate(
  boundaryShapes: Shape[],
  edge: BoxStitchEdge,
  bounds: BoxStitchBounds,
  searchDistanceMm: number,
): BoxStitchEdgeCandidate | null {
  const safeSearchDistance = Math.max(0.1, Math.abs(searchDistanceMm))
  let best: BoxStitchEdgeCandidate | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const shape of boundaryShapes) {
    if (shape.type !== 'line') {
      continue
    }

    const dx = shape.end.x - shape.start.x
    const dy = shape.end.y - shape.start.y
    const spanX = Math.abs(dx)
    const spanY = Math.abs(dy)
    const midX = (shape.start.x + shape.end.x) / 2
    const midY = (shape.start.y + shape.end.y) / 2

    if (edge === 'top' || edge === 'bottom') {
      if (spanX < spanY * 1.5) {
        continue
      }
      const boundaryY = edge === 'top' ? bounds.minY : bounds.maxY
      const edgeDistance = Math.abs(midY - boundaryY)
      if (edgeDistance > safeSearchDistance) {
        continue
      }
      const score = edgeDistance - spanX * 0.001
      if (score < bestScore) {
        bestScore = score
        best = {
          edge,
          shape,
          minParallel: Math.min(shape.start.x, shape.end.x),
          maxParallel: Math.max(shape.start.x, shape.end.x),
        }
      }
      continue
    }

    if (spanY < spanX * 1.5) {
      continue
    }

    const boundaryX = edge === 'left' ? bounds.minX : bounds.maxX
    const edgeDistance = Math.abs(midX - boundaryX)
    if (edgeDistance > safeSearchDistance) {
      continue
    }
    const score = edgeDistance - spanY * 0.001
    if (score < bestScore) {
      bestScore = score
      best = {
        edge,
        shape,
        minParallel: Math.min(shape.start.y, shape.end.y),
        maxParallel: Math.max(shape.start.y, shape.end.y),
      }
    }
  }

  return best
}

function resolvePairedParallelRange(
  first: BoxStitchEdgeCandidate | null,
  second: BoxStitchEdgeCandidate | null,
) {
  if (!first || !second) {
    return null
  }

  const firstRange = candidateParallelRange(first)
  const secondRange = candidateParallelRange(second)
  const start = Math.max(firstRange.start, secondRange.start)
  const end = Math.min(firstRange.end, secondRange.end)
  if (end - start < 1e-3) {
    return null
  }
  return { start, end }
}

function createGuideLineFromCandidate(
  edge: BoxStitchEdge,
  candidate: BoxStitchEdgeCandidate | null,
  pairedRange: { start: number; end: number } | null,
  boundaryShapes: Shape[],
  bounds: BoxStitchBounds,
  offsetMm: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): { line: LineShape | null; extracted: boolean } {
  const clampedMinX = bounds.minX + offsetMm
  const clampedMaxX = bounds.maxX - offsetMm
  const clampedMinY = bounds.minY + offsetMm
  const clampedMaxY = bounds.maxY - offsetMm

  if (candidate) {
    const candidateRange = pairedRange ?? candidateParallelRange(candidate)
    if (edge === 'top' || edge === 'bottom') {
      const startX = clampValue(candidateRange.start, clampedMinX, clampedMaxX)
      const endX = clampValue(candidateRange.end, clampedMinX, clampedMaxX)
      if (endX - startX > 0.1) {
        return {
          extracted: true,
          line: {
            id: uid(),
            type: 'line',
            layerId,
            lineTypeId,
            groupId,
            start: { x: startX, y: edge === 'top' ? clampedMinY : clampedMaxY },
            end: { x: endX, y: edge === 'top' ? clampedMinY : clampedMaxY },
          },
        }
      }
    } else {
      const startY = clampValue(candidateRange.start, clampedMinY, clampedMaxY)
      const endY = clampValue(candidateRange.end, clampedMinY, clampedMaxY)
      if (endY - startY > 0.1) {
        return {
          extracted: true,
          line: {
            id: uid(),
            type: 'line',
            layerId,
            lineTypeId,
            groupId,
            start: { x: edge === 'left' ? clampedMinX : clampedMaxX, y: startY },
            end: { x: edge === 'left' ? clampedMinX : clampedMaxX, y: endY },
          },
        }
      }
    }
  }

  const fallbackIndex =
    edge === 'top' ? 0 : edge === 'right' ? 1 : edge === 'bottom' ? 2 : 3
  const fallback = extractBoxStitchLine(boundaryShapes, fallbackIndex, offsetMm, layerId, lineTypeId)
  if (!fallback) {
    return { line: null, extracted: false }
  }

  return {
    extracted: false,
    line: groupId ? { ...fallback, groupId } : fallback,
  }
}

export function generateBoxStitchPattern(params: BoxStitchParams): BoxStitchResult {
  const {
    width,
    depth,
    stitchPitchMm,
    cornerMarginMm,
    materialThicknessMm,
    layerId,
    lineTypeId,
  } = params

  const halfW = width / 2
  const halfD = depth / 2

  // Bottom panel is centered at (0,0) with dimensions width x depth.
  // Side panels extend outward from each edge of the bottom.
  // Stitch lines run along the inner face of each side panel,
  // offset inward from the fold by materialThicknessMm.

  // Top edge of bottom: y = -halfD. Side panel extends upward (negative y).
  // Stitch line on top side panel, offset down from fold by materialThicknessMm.
  const topLine: LineShape = {
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: -halfW, y: -halfD - materialThicknessMm },
    end: { x: halfW, y: -halfD - materialThicknessMm },
  }

  // Bottom edge of bottom: y = halfD. Side panel extends downward (positive y).
  const bottomLine: LineShape = {
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: -halfW, y: halfD + materialThicknessMm },
    end: { x: halfW, y: halfD + materialThicknessMm },
  }

  // Left edge of bottom: x = -halfW. Side panel extends left (negative x).
  const leftLine: LineShape = {
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: -halfW - materialThicknessMm, y: -halfD },
    end: { x: -halfW - materialThicknessMm, y: halfD },
  }

  // Right edge of bottom: x = halfW. Side panel extends right (positive x).
  const rightLine: LineShape = {
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: halfW + materialThicknessMm, y: -halfD },
    end: { x: halfW + materialThicknessMm, y: halfD },
  }

  const guideLines = [topLine, rightLine, bottomLine, leftLine]
  const stitchHoles: StitchHole[] = []

  for (const line of guideLines) {
    const holes = generateStitchHolesAlongLine(line, stitchPitchMm, cornerMarginMm)
    stitchHoles.push(...holes)
  }

  return { guideLines, stitchHoles }
}

export function extractBoxStitchGuideLines(
  boundaryShapes: Shape[],
  distanceMm: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): ExtractedBoxStitchGuidesResult {
  const bounds = getBoundsFromShapes(boundaryShapes)
  const safeDistance = Math.max(0.1, Math.abs(distanceMm))
  if (!bounds) {
    return {
      guideLines: [],
      extractedEdgeCount: 0,
      usedFallback: false,
    }
  }

  if (bounds.maxX - bounds.minX <= safeDistance * 2 || bounds.maxY - bounds.minY <= safeDistance * 2) {
    return {
      guideLines: [],
      extractedEdgeCount: 0,
      usedFallback: false,
    }
  }

  const topCandidate = findBestEdgeCandidate(boundaryShapes, 'top', bounds, safeDistance)
  const rightCandidate = findBestEdgeCandidate(boundaryShapes, 'right', bounds, safeDistance)
  const bottomCandidate = findBestEdgeCandidate(boundaryShapes, 'bottom', bounds, safeDistance)
  const leftCandidate = findBestEdgeCandidate(boundaryShapes, 'left', bounds, safeDistance)

  const horizontalPair = resolvePairedParallelRange(topCandidate, bottomCandidate)
  const verticalPair = resolvePairedParallelRange(leftCandidate, rightCandidate)
  const candidates: Array<[BoxStitchEdge, BoxStitchEdgeCandidate | null, { start: number; end: number } | null]> = [
    ['top', topCandidate, horizontalPair],
    ['right', rightCandidate, verticalPair],
    ['bottom', bottomCandidate, horizontalPair],
    ['left', leftCandidate, verticalPair],
  ]

  let extractedEdgeCount = 0
  let usedFallback = false
  const guideLines = candidates
    .map(([edge, candidate, pairedRange]) => {
      const result = createGuideLineFromCandidate(
        edge,
        candidate,
        pairedRange,
        boundaryShapes,
        bounds,
        safeDistance,
        layerId,
        lineTypeId,
        groupId,
      )
      if (result.extracted) {
        extractedEdgeCount += 1
      } else if (result.line) {
        usedFallback = true
      }
      return result.line
    })
    .filter((line): line is LineShape => line !== null)

  return {
    guideLines,
    extractedEdgeCount,
    usedFallback,
  }
}

export function extractBoxStitchLine(
  boundaryShapes: Shape[],
  edgeIndex: number,
  offsetMm: number,
  layerId: string,
  lineTypeId: string,
): LineShape | null {
  const bounds = getBoundsFromShapes(boundaryShapes)
  if (!bounds) {
    return null
  }
  const { minX, minY, maxX, maxY } = bounds

  let start: Point
  let end: Point

  // 0=top, 1=right, 2=bottom, 3=left — offset inward
  switch (edgeIndex) {
    case 0:
      start = { x: minX + offsetMm, y: minY + offsetMm }
      end = { x: maxX - offsetMm, y: minY + offsetMm }
      break
    case 1:
      start = { x: maxX - offsetMm, y: minY + offsetMm }
      end = { x: maxX - offsetMm, y: maxY - offsetMm }
      break
    case 2:
      start = { x: maxX - offsetMm, y: maxY - offsetMm }
      end = { x: minX + offsetMm, y: maxY - offsetMm }
      break
    case 3:
      start = { x: minX + offsetMm, y: maxY - offsetMm }
      end = { x: minX + offsetMm, y: minY + offsetMm }
      break
    default:
      return null
  }

  return {
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start,
    end,
  }
}

export function generateStitchHolesAlongLine(
  line: LineShape,
  pitchMm: number,
  marginMm: number,
): StitchHole[] {
  const totalLength = distance(line.start, line.end)
  const usableLength = totalLength - marginMm * 2

  if (usableLength <= 0 || pitchMm <= 0) {
    return []
  }

  const holeCount = Math.floor(usableLength / pitchMm) + 1
  const actualPitch = holeCount > 1 ? usableLength / (holeCount - 1) : 0

  const dx = line.end.x - line.start.x
  const dy = line.end.y - line.start.y
  const perpAngle = perpendicularAngleDeg(line.start, line.end)

  const holes: StitchHole[] = []

  for (let i = 0; i < holeCount; i++) {
    const t = totalLength > 0 ? (marginMm + actualPitch * i) / totalLength : 0

    holes.push({
      id: uid(),
      shapeId: line.id,
      point: {
        x: line.start.x + dx * t,
        y: line.start.y + dy * t,
      },
      angleDeg: perpAngle,
      holeType: 'round',
      sequence: i,
    })
  }

  return holes
}

function getShapePointList(shape: Shape): Point[] {
  if (shape.type === 'line') {
    return [shape.start, shape.end]
  }
  if (shape.type === 'arc') {
    return [shape.start, shape.mid, shape.end]
  }
  if (shape.type === 'bezier') {
    return [shape.start, shape.control, shape.end]
  }
  return [shape.start, shape.end]
}
