import type { BoxStitchSource, Point, Shape, LineShape, StitchHole } from '../cad/cad-types'
import { uid, distance, sampleShapePoints } from '../cad/cad-geometry'
import type { BoxStitchHelperSettings } from './box-stitch-settings'

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

type BoxStitchSourceShape = Extract<Shape, { type: 'line' | 'arc' | 'bezier' }>

type BoxStitchEdgeCandidate = {
  edge: BoxStitchEdge
  shape: BoxStitchSourceShape
  minParallel: number
  maxParallel: number
}

type BoxStitchSourceMutationResult = {
  nextShapes: Shape[]
  updatedCount: number
}

type SampledGuidePath = {
  points: Point[]
  lengths: number[]
  totalLength: number
  parallelValues: number[]
}

export type BoxStitchGuideGroup = {
  points: Point[]
  guideLines: LineShape[]
}

export type ExtractedBoxStitchGuidesResult = {
  guideLines: LineShape[]
  guideGroups: BoxStitchGuideGroup[]
  extractedEdgeCount: number
  usedFallback: boolean
}

export type BoxStitchGuideProjectionOptions = {
  distanceMm: number
  stretchCompensationPercent?: number
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

function lineLength(start: Point, end: Point) {
  return Math.hypot(end.x - start.x, end.y - start.y)
}

export function isBoxStitchSourceEligibleShape(shape: Shape): shape is BoxStitchSourceShape {
  return shape.type === 'line' || shape.type === 'arc' || shape.type === 'bezier'
}

export function isExtractedBoxStitchSourceValue(
  value: BoxStitchSourceShape['boxStitchSource'] | undefined,
): value is BoxStitchSource {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'extracted' in value &&
      (value as { extracted?: unknown }).extracted === true,
  )
}

export function hasExtractedBoxStitchSource(
  shape: Shape,
): shape is BoxStitchSourceShape & { boxStitchSource: BoxStitchSource } {
  if (!isBoxStitchSourceEligibleShape(shape)) {
    return false
  }
  return isExtractedBoxStitchSourceValue(shape.boxStitchSource)
}

export function markSelectedShapesAsBoxStitchSource(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
): BoxStitchSourceMutationResult {
  let updatedCount = 0
  const nextShapes = shapes.map((shape) => {
    if (!selectedShapeIds.has(shape.id) || !isBoxStitchSourceEligibleShape(shape) || hasExtractedBoxStitchSource(shape)) {
      return shape
    }
    updatedCount += 1
    return {
      ...shape,
      boxStitchSource: { extracted: true as const },
    }
  })

  return {
    nextShapes,
    updatedCount,
  }
}

export function clearSelectedBoxStitchSources(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
): BoxStitchSourceMutationResult {
  let updatedCount = 0
  const nextShapes = shapes.map((shape) => {
    if (!selectedShapeIds.has(shape.id) || !hasExtractedBoxStitchSource(shape)) {
      return shape
    }
    updatedCount += 1
    const { boxStitchSource, ...rest } = shape
    return boxStitchSource ? rest : shape
  })

  return {
    nextShapes,
    updatedCount,
  }
}

function applyStretchCompensation(
  range: { start: number; end: number } | null,
  min: number,
  max: number,
  stretchCompensationPercent: number,
) {
  if (!range) {
    return null
  }

  const safeCompensation = clampValue(stretchCompensationPercent, 25, 250) / 100
  const center = (range.start + range.end) / 2
  const halfSpan = ((range.end - range.start) * safeCompensation) / 2
  return {
    start: clampValue(center - halfSpan, min, max),
    end: clampValue(center + halfSpan, min, max),
  }
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

function getBoundsFromPoints(points: Point[]): BoxStitchBounds | null {
  if (points.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
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
    if (!isBoxStitchSourceEligibleShape(shape)) {
      continue
    }

    const points = sampleShapePoints(shape, shape.type === 'line' ? 1 : 64)
    const candidateBounds = getBoundsFromPoints(points)
    if (!candidateBounds) {
      continue
    }
    const spanX = candidateBounds.maxX - candidateBounds.minX
    const spanY = candidateBounds.maxY - candidateBounds.minY

    if (edge === 'top' || edge === 'bottom') {
      if (spanX < Math.max(1, spanY * 0.8)) {
        continue
      }
      const boundaryY = edge === 'top' ? bounds.minY : bounds.maxY
      const edgeDistance = Math.abs((edge === 'top' ? candidateBounds.minY : candidateBounds.maxY) - boundaryY)
      if (edgeDistance > safeSearchDistance) {
        continue
      }
      const score = edgeDistance - spanX * 0.001
      if (score < bestScore) {
        bestScore = score
        best = {
          edge,
          shape,
          minParallel: candidateBounds.minX,
          maxParallel: candidateBounds.maxX,
        }
      }
      continue
    }

    if (spanY < Math.max(1, spanX * 0.8)) {
      continue
    }

    const boundaryX = edge === 'left' ? bounds.minX : bounds.maxX
    const edgeDistance = Math.abs((edge === 'left' ? candidateBounds.minX : candidateBounds.maxX) - boundaryX)
    if (edgeDistance > safeSearchDistance) {
      continue
    }
    const score = edgeDistance - spanY * 0.001
    if (score < bestScore) {
      bestScore = score
      best = {
        edge,
        shape,
        minParallel: candidateBounds.minY,
        maxParallel: candidateBounds.maxY,
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

function buildSampledGuidePath(candidate: BoxStitchEdgeCandidate): SampledGuidePath | null {
  const rawPoints = sampleShapePoints(candidate.shape, candidate.shape.type === 'line' ? 1 : 64)
  if (rawPoints.length < 2) {
    return null
  }

  const isHorizontal = candidate.edge === 'top' || candidate.edge === 'bottom'
  const orderedPoints =
    (isHorizontal ? rawPoints[0].x > rawPoints[rawPoints.length - 1].x : rawPoints[0].y > rawPoints[rawPoints.length - 1].y)
      ? rawPoints.slice().reverse()
      : rawPoints
  const lengths = [0]
  for (let index = 1; index < orderedPoints.length; index += 1) {
    lengths.push(lengths[index - 1] + lineLength(orderedPoints[index - 1], orderedPoints[index]))
  }
  const totalLength = lengths[lengths.length - 1] ?? 0
  if (totalLength < 1e-6) {
    return null
  }

  return {
    points: orderedPoints,
    lengths,
    totalLength,
    parallelValues: orderedPoints.map((point) => (isHorizontal ? point.x : point.y)),
  }
}

function pointAtFraction(path: SampledGuidePath, fraction: number) {
  const targetDistance = clampValue(fraction, 0, 1) * path.totalLength
  let segmentIndex = 1
  while (segmentIndex < path.lengths.length && path.lengths[segmentIndex] < targetDistance) {
    segmentIndex += 1
  }
  segmentIndex = Math.min(Math.max(segmentIndex, 1), path.points.length - 1)

  const previousDistance = path.lengths[segmentIndex - 1]
  const nextDistance = path.lengths[segmentIndex]
  const segmentLength = Math.max(nextDistance - previousDistance, 1e-9)
  const localT = (targetDistance - previousDistance) / segmentLength
  const start = path.points[segmentIndex - 1]
  const end = path.points[segmentIndex]

  return {
    x: start.x + (end.x - start.x) * localT,
    y: start.y + (end.y - start.y) * localT,
  }
}

function resolveFractionAtParallel(path: SampledGuidePath, value: number) {
  const target = clampValue(value, Math.min(...path.parallelValues), Math.max(...path.parallelValues))
  for (let index = 1; index < path.parallelValues.length; index += 1) {
    const start = path.parallelValues[index - 1]
    const end = path.parallelValues[index]
    const min = Math.min(start, end)
    const max = Math.max(start, end)
    if (target < min - 1e-6 || target > max + 1e-6) {
      continue
    }
    const delta = end - start
    const localT = Math.abs(delta) < 1e-9 ? 0 : (target - start) / delta
    const distanceAtTarget =
      path.lengths[index - 1] + (path.lengths[index] - path.lengths[index - 1]) * clampValue(localT, 0, 1)
    return distanceAtTarget / path.totalLength
  }
  return null
}

function polylineToGuideLines(points: Point[], layerId: string, lineTypeId: string, groupId?: string) {
  const guideLines: LineShape[] = []
  for (let index = 1; index < points.length; index += 1) {
    if (lineLength(points[index - 1], points[index]) < 1e-3) {
      continue
    }
    guideLines.push({
      id: uid(),
      type: 'line',
      layerId,
      lineTypeId,
      groupId,
      start: points[index - 1],
      end: points[index],
    })
  }
  return guideLines
}

function buildProjectedGuidePathFromCandidate(
  candidate: BoxStitchEdgeCandidate,
  pairedRange: { start: number; end: number } | null,
) {
  const path = buildSampledGuidePath(candidate)
  if (!path) {
    return [] as Point[]
  }

  const candidateRange = pairedRange ?? candidateParallelRange(candidate)
  const startFraction = resolveFractionAtParallel(path, candidateRange.start)
  const endFraction = resolveFractionAtParallel(path, candidateRange.end)
  if (startFraction === null || endFraction === null) {
    return [] as Point[]
  }

  const start = Math.min(startFraction, endFraction)
  const end = Math.max(startFraction, endFraction)
  if (end - start < 0.01) {
    return [] as Point[]
  }

  const sampleCount = Math.max(3, Math.min(36, Math.ceil((path.totalLength * (end - start)) / 6)))
  const points: Point[] = []
  for (let index = 0; index < sampleCount; index += 1) {
    const fraction = start + ((end - start) * index) / (sampleCount - 1)
    points.push(pointAtFraction(path, fraction))
  }

  return points
}

function shouldUseProjectedGuides(
  candidate: BoxStitchEdgeCandidate | null,
  oppositeCandidate: BoxStitchEdgeCandidate | null,
) {
  if (!candidate) {
    return false
  }
  return candidate.shape.type !== 'line' || oppositeCandidate?.shape.type !== 'line'
}

function createGuidesForEdge(
  edge: BoxStitchEdge,
  candidate: BoxStitchEdgeCandidate | null,
  oppositeCandidate: BoxStitchEdgeCandidate | null,
  pairedRange: { start: number; end: number } | null,
  boundaryShapes: Shape[],
  bounds: BoxStitchBounds,
  offsetMm: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
) {
  if (candidate && shouldUseProjectedGuides(candidate, oppositeCandidate)) {
    const projectedPoints = buildProjectedGuidePathFromCandidate(candidate, pairedRange)
    const projectedGuides = polylineToGuideLines(projectedPoints, layerId, lineTypeId, groupId)
    if (projectedGuides.length > 0 && projectedPoints.length > 1) {
      return {
        guideGroup: {
          points: projectedPoints,
          guideLines: projectedGuides,
        },
        extracted: true,
        usedFallback: false,
      }
    }
  }

  const fallbackGuide = createGuideLineFromCandidate(
    edge,
    candidate,
    pairedRange,
    boundaryShapes,
    bounds,
    offsetMm,
    layerId,
    lineTypeId,
    groupId,
  )

  return {
    guideGroup:
      fallbackGuide.line
        ? {
            points: [fallbackGuide.line.start, fallbackGuide.line.end],
            guideLines: [fallbackGuide.line],
          }
        : null,
    extracted: fallbackGuide.extracted,
    usedFallback: Boolean(fallbackGuide.line) && !fallbackGuide.extracted,
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
  options: BoxStitchGuideProjectionOptions | BoxStitchHelperSettings | number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): ExtractedBoxStitchGuidesResult {
  const bounds = getBoundsFromShapes(boundaryShapes)
  const rawDistance = typeof options === 'number' ? options : options.distanceMm
  const stretchCompensationPercent =
    typeof options === 'number'
      ? 100
      : options.stretchCompensationPercent ?? 100
  const safeDistance = Math.max(0.1, Math.abs(rawDistance))
  if (!bounds) {
    return {
      guideLines: [],
      guideGroups: [],
      extractedEdgeCount: 0,
      usedFallback: false,
    }
  }

  if (bounds.maxX - bounds.minX <= safeDistance * 2 || bounds.maxY - bounds.minY <= safeDistance * 2) {
    return {
      guideLines: [],
      guideGroups: [],
      extractedEdgeCount: 0,
      usedFallback: false,
    }
  }

  const topCandidate = findBestEdgeCandidate(boundaryShapes, 'top', bounds, safeDistance)
  const rightCandidate = findBestEdgeCandidate(boundaryShapes, 'right', bounds, safeDistance)
  const bottomCandidate = findBestEdgeCandidate(boundaryShapes, 'bottom', bounds, safeDistance)
  const leftCandidate = findBestEdgeCandidate(boundaryShapes, 'left', bounds, safeDistance)

  const horizontalPair = applyStretchCompensation(
    resolvePairedParallelRange(topCandidate, bottomCandidate),
    bounds.minX + safeDistance,
    bounds.maxX - safeDistance,
    stretchCompensationPercent,
  )
  const verticalPair = applyStretchCompensation(
    resolvePairedParallelRange(leftCandidate, rightCandidate),
    bounds.minY + safeDistance,
    bounds.maxY - safeDistance,
    stretchCompensationPercent,
  )
  const candidates: Array<
    [BoxStitchEdge, BoxStitchEdgeCandidate | null, BoxStitchEdgeCandidate | null, { start: number; end: number } | null]
  > = [
    ['top', topCandidate, bottomCandidate, horizontalPair],
    ['right', rightCandidate, leftCandidate, verticalPair],
    ['bottom', bottomCandidate, topCandidate, horizontalPair],
    ['left', leftCandidate, rightCandidate, verticalPair],
  ]

  let extractedEdgeCount = 0
  let usedFallback = false
  const guideGroups = candidates
    .flatMap(([edge, candidate, oppositeCandidate, pairedRange]) => {
      const result = createGuidesForEdge(
        edge,
        candidate,
        oppositeCandidate,
        pairedRange,
        boundaryShapes,
        bounds,
        safeDistance,
        layerId,
        lineTypeId,
        groupId,
      )
      if (result.extracted && result.guideGroup && result.guideGroup.guideLines.length > 0) {
        extractedEdgeCount += 1
      } else if (result.usedFallback) {
        usedFallback = true
      }
      return result.guideGroup ? [result.guideGroup] : []
    })
  const guideLines = guideGroups.flatMap((group) => group.guideLines)

  return {
    guideLines,
    guideGroups,
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
