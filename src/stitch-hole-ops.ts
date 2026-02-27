import { sampleShapePoints, uid } from './cad-geometry'
import type { LineType, Point, Shape, StitchHole, StitchHoleType } from './cad-types'

const LINE_SAMPLE_SEGMENTS = 40

type StitchAnchor = {
  shapeId: string
  point: Point
  angleDeg: number
}

type Projection = {
  point: Point
  distance: number
  angleDeg: number
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}

function projectPointToSegment(point: Point, start: Point, end: Point): Projection {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY

  if (segmentLengthSquared < 1e-9) {
    const dx = point.x - start.x
    const dy = point.y - start.y
    return {
      point: { x: start.x, y: start.y },
      distance: Math.hypot(dx, dy),
      angleDeg: 0,
    }
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / segmentLengthSquared),
  )
  const projectedPoint = {
    x: start.x + segmentX * t,
    y: start.y + segmentY * t,
  }
  const dx = point.x - projectedPoint.x
  const dy = point.y - projectedPoint.y

  return {
    point: projectedPoint,
    distance: Math.hypot(dx, dy),
    angleDeg: radiansToDegrees(Math.atan2(segmentY, segmentX)),
  }
}

function isStitchShape(shape: Shape, lineTypesById: Record<string, LineType>) {
  const lineTypeRole = lineTypesById[shape.lineTypeId]?.role ?? 'cut'
  return lineTypeRole === 'stitch'
}

export function parseStitchHole(value: unknown): StitchHole | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    shapeId?: unknown
    point?: unknown
    angleDeg?: unknown
    holeType?: unknown
    sequence?: unknown
  }

  if (
    typeof candidate.shapeId !== 'string' ||
    typeof candidate.point !== 'object' ||
    candidate.point === null ||
    typeof (candidate.point as { x?: unknown }).x !== 'number' ||
    typeof (candidate.point as { y?: unknown }).y !== 'number'
  ) {
    return null
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : uid(),
    shapeId: candidate.shapeId,
    point: {
      x: (candidate.point as { x: number }).x,
      y: (candidate.point as { y: number }).y,
    },
    angleDeg: typeof candidate.angleDeg === 'number' && Number.isFinite(candidate.angleDeg) ? candidate.angleDeg : 0,
    holeType: candidate.holeType === 'slit' ? 'slit' : 'round',
    sequence:
      typeof candidate.sequence === 'number' && Number.isFinite(candidate.sequence)
        ? Math.max(0, Math.round(candidate.sequence))
        : 0,
  }
}

export function findNearestStitchAnchor(
  point: Point,
  shapes: Shape[],
  lineTypesById: Record<string, LineType>,
  maxDistance: number,
) {
  let best: StitchAnchor | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const shape of shapes) {
    if (!isStitchShape(shape, lineTypesById)) {
      continue
    }

    const sampled = sampleShapePoints(shape, LINE_SAMPLE_SEGMENTS)
    for (let index = 0; index < sampled.length - 1; index += 1) {
      const projection = projectPointToSegment(point, sampled[index], sampled[index + 1])
      if (projection.distance < bestDistance) {
        bestDistance = projection.distance
        best = {
          shapeId: shape.id,
          point: projection.point,
          angleDeg: projection.angleDeg,
        }
      }
    }
  }

  if (!best || bestDistance > maxDistance) {
    return null
  }

  return best
}

export function createStitchHole(anchor: StitchAnchor, holeType: StitchHoleType): StitchHole {
  return {
    id: uid(),
    shapeId: anchor.shapeId,
    point: anchor.point,
    angleDeg: anchor.angleDeg,
    holeType,
    sequence: 0,
  }
}

function lineLength(start: Point, end: Point) {
  return Math.hypot(end.x - start.x, end.y - start.y)
}

function shapePolyline(shape: Shape) {
  const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 80)
  if (sampled.length >= 2) {
    return sampled
  }
  if (sampled.length === 1) {
    return [sampled[0], sampled[0]]
  }
  return [] as Point[]
}

function cumulativeLengths(points: Point[]) {
  const lengths = [0]
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + lineLength(points[index - 1], points[index]))
  }
  return lengths
}

function pointAtDistance(points: Point[], lengths: number[], distanceTarget: number) {
  if (points.length < 2 || lengths.length !== points.length) {
    return null
  }

  const totalLength = lengths[lengths.length - 1]
  const target = Math.max(0, Math.min(totalLength, distanceTarget))

  let segmentIndex = 1
  while (segmentIndex < lengths.length && lengths[segmentIndex] < target) {
    segmentIndex += 1
  }
  segmentIndex = Math.min(Math.max(segmentIndex, 1), points.length - 1)

  const prevLength = lengths[segmentIndex - 1]
  const nextLength = lengths[segmentIndex]
  const segmentLength = Math.max(nextLength - prevLength, 1e-9)
  const localT = (target - prevLength) / segmentLength
  const start = points[segmentIndex - 1]
  const end = points[segmentIndex]
  const point = {
    x: start.x + (end.x - start.x) * localT,
    y: start.y + (end.y - start.y) * localT,
  }
  const angleDeg = radiansToDegrees(Math.atan2(end.y - start.y, end.x - start.x))
  return { point, angleDeg }
}

export function normalizeStitchHoleSequences(stitchHoles: StitchHole[]) {
  const byShape = new Map<string, StitchHole[]>()
  for (const stitchHole of stitchHoles) {
    const entries = byShape.get(stitchHole.shapeId) ?? []
    entries.push(stitchHole)
    byShape.set(stitchHole.shapeId, entries)
  }

  const normalized: StitchHole[] = []
  for (const holes of byShape.values()) {
    holes
      .slice()
      .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
      .forEach((stitchHole, index) => {
        normalized.push({
          ...stitchHole,
          sequence: index,
        })
      })
  }

  return normalized
}

function sortStitchHolesBySequence(stitchHoles: StitchHole[]) {
  return stitchHoles
    .slice()
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
}

function projectDistanceOnShape(shape: Shape, point: Point) {
  const points = shapePolyline(shape)
  if (points.length < 2) {
    return 0
  }
  const lengths = cumulativeLengths(points)

  let bestDistance = Number.POSITIVE_INFINITY
  let bestAlongPath = 0
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    const segmentX = end.x - start.x
    const segmentY = end.y - start.y
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY
    if (segmentLengthSquared < 1e-9) {
      continue
    }
    const t = Math.max(
      0,
      Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / segmentLengthSquared),
    )
    const projectedX = start.x + segmentX * t
    const projectedY = start.y + segmentY * t
    const distanceToProjection = Math.hypot(point.x - projectedX, point.y - projectedY)
    if (distanceToProjection < bestDistance) {
      bestDistance = distanceToProjection
      bestAlongPath = lengths[index - 1] + Math.hypot(projectedX - start.x, projectedY - start.y)
    }
  }

  return bestAlongPath
}

export function resequenceStitchHolesOnShape(stitchHoles: StitchHole[], shape: Shape, reverse = false) {
  const ordered = stitchHoles
    .slice()
    .sort((left, right) => projectDistanceOnShape(shape, left.point) - projectDistanceOnShape(shape, right.point))

  if (reverse) {
    ordered.reverse()
  }

  return ordered.map((stitchHole, index) => ({
    ...stitchHole,
    sequence: index,
  }))
}

function stitchDistancesForPitch(totalLength: number, initialPitch: number, endPitch: number) {
  const targets: number[] = []
  if (totalLength < 1e-6) {
    return targets
  }

  const safeInitialPitch = Math.max(0.2, initialPitch)
  const safeEndPitch = Math.max(0.2, endPitch)
  let distanceValue = 0
  let guard = 0

  while (distanceValue < totalLength && guard < 10000) {
    targets.push(distanceValue)
    const progress = totalLength <= 1e-6 ? 0 : distanceValue / totalLength
    const pitchAtDistance = safeInitialPitch + (safeEndPitch - safeInitialPitch) * progress
    distanceValue += Math.max(0.2, pitchAtDistance)
    guard += 1
  }

  const tailPitch = safeInitialPitch + (safeEndPitch - safeInitialPitch) * 0.85
  if (targets.length === 0 || totalLength - targets[targets.length - 1] > Math.max(0.2, tailPitch) * 0.35) {
    targets.push(totalLength)
  }

  return targets
}

export function generateFixedPitchStitchHoles(
  shape: Shape,
  pitchMm: number,
  holeType: StitchHoleType,
  sequenceStart = 0,
) {
  const safePitch = Math.max(0.2, pitchMm)
  const polyline = shapePolyline(shape)
  if (polyline.length < 2) {
    return [] as StitchHole[]
  }
  const lengths = cumulativeLengths(polyline)
  const totalLength = lengths[lengths.length - 1]
  if (totalLength < 1e-6) {
    return [] as StitchHole[]
  }

  const holes: StitchHole[] = []
  const distanceTargets = stitchDistancesForPitch(totalLength, safePitch, safePitch)

  for (const [index, distanceValue] of distanceTargets.entries()) {
    const projected = pointAtDistance(polyline, lengths, distanceValue)
    if (!projected) {
      continue
    }
    holes.push({
      id: uid(),
      shapeId: shape.id,
      point: projected.point,
      angleDeg: projected.angleDeg,
      holeType,
      sequence: sequenceStart + index,
    })
  }

  return holes
}

export function generateVariablePitchStitchHoles(
  shape: Shape,
  startPitchMm: number,
  endPitchMm: number,
  holeType: StitchHoleType,
  sequenceStart = 0,
) {
  const safeStartPitch = Math.max(0.2, startPitchMm)
  const safeEndPitch = Math.max(0.2, endPitchMm)
  const polyline = shapePolyline(shape)
  if (polyline.length < 2) {
    return [] as StitchHole[]
  }
  const lengths = cumulativeLengths(polyline)
  const totalLength = lengths[lengths.length - 1]
  if (totalLength < 1e-6) {
    return [] as StitchHole[]
  }

  const holes: StitchHole[] = []
  const distanceTargets = stitchDistancesForPitch(totalLength, safeStartPitch, safeEndPitch)

  for (const [index, distanceValue] of distanceTargets.entries()) {
    const projected = pointAtDistance(polyline, lengths, distanceValue)
    if (!projected) {
      continue
    }
    holes.push({
      id: uid(),
      shapeId: shape.id,
      point: projected.point,
      angleDeg: projected.angleDeg,
      holeType,
      sequence: sequenceStart + index,
    })
  }

  return holes
}

export function selectNextStitchHole(stitchHoles: StitchHole[], currentHoleId: string | null) {
  if (stitchHoles.length === 0) {
    return null
  }
  const ordered = sortStitchHolesBySequence(stitchHoles)
  if (!currentHoleId) {
    return ordered[0] ?? null
  }

  const currentIndex = ordered.findIndex((stitchHole) => stitchHole.id === currentHoleId)
  if (currentIndex < 0) {
    return ordered[0] ?? null
  }

  const nextIndex = (currentIndex + 1) % ordered.length
  return ordered[nextIndex] ?? null
}

export function fixStitchHoleOrderFromHole(
  stitchHoles: StitchHole[],
  shape: Shape,
  startHoleId: string,
  reverse = false,
) {
  if (stitchHoles.length <= 1) {
    return stitchHoles
  }

  const resequenced = resequenceStitchHolesOnShape(stitchHoles, shape, reverse)
  const startIndex = resequenced.findIndex((stitchHole) => stitchHole.id === startHoleId)
  if (startIndex <= 0) {
    return resequenced
  }

  const rotated = [...resequenced.slice(startIndex), ...resequenced.slice(0, startIndex)]
  return rotated.map((stitchHole, index) => ({
    ...stitchHole,
    sequence: index,
  }))
}

export function deleteStitchHolesForShapes(stitchHoles: StitchHole[], shapeIds: Set<string>) {
  if (shapeIds.size === 0) {
    return stitchHoles
  }
  return stitchHoles.filter((stitchHole) => !shapeIds.has(stitchHole.shapeId))
}

export function countStitchHolesByShape(stitchHoles: StitchHole[]) {
  const counts: Record<string, number> = {}
  for (const stitchHole of stitchHoles) {
    counts[stitchHole.shapeId] = (counts[stitchHole.shapeId] ?? 0) + 1
  }
  return counts
}
