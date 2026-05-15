import { sampleShapePoints, uid } from '../cad/cad-geometry'
import type { LineType, Point, Shape, StitchHole, StitchHoleDefaults } from '../cad/cad-types'

const LINE_SAMPLE_SEGMENTS = 40

export type AutoPitchGenerationOptions = {
  forceFitLastHole?: boolean
  solverSteps?: number
  precisionMm?: number
  stopGapMm?: number
  startDistanceMm?: number
  endDistanceMm?: number
  includeStartHole?: boolean
}

type StitchAnchor = {
  shapeId: string
  point: Point
  angleDeg: number
}

type FindNearestStitchAnchorOptions = {
  allowNonStitchShapes?: boolean
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

function canAnchorStitchHole(shape: Shape) {
  return shape.type !== 'text'
}

export function parseStitchHole(value: unknown): StitchHole | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as {
    id?: unknown
    shapeId?: unknown
    chainId?: unknown
    point?: unknown
    angleDeg?: unknown
    holeType?: unknown
    sequence?: unknown
    diameterMm?: unknown
    widthMm?: unknown
    heightMm?: unknown
    tiltDeg?: unknown
    inverted?: unknown
    presetId?: unknown
    presetName?: unknown
    renderShape?: unknown
    endHole?: unknown
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
    chainId: typeof candidate.chainId === 'string' && candidate.chainId.trim().length > 0
      ? candidate.chainId.trim()
      : undefined,
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
    diameterMm:
      typeof candidate.diameterMm === 'number' && Number.isFinite(candidate.diameterMm) && candidate.diameterMm > 0
        ? candidate.diameterMm
        : undefined,
    widthMm:
      typeof candidate.widthMm === 'number' && Number.isFinite(candidate.widthMm) && candidate.widthMm > 0
        ? candidate.widthMm
        : undefined,
    heightMm:
      typeof candidate.heightMm === 'number' && Number.isFinite(candidate.heightMm) && candidate.heightMm > 0
        ? candidate.heightMm
        : undefined,
    tiltDeg: typeof candidate.tiltDeg === 'number' && Number.isFinite(candidate.tiltDeg) ? candidate.tiltDeg : undefined,
    inverted: candidate.inverted === true,
    presetId: typeof candidate.presetId === 'string' && candidate.presetId.length > 0 ? candidate.presetId : undefined,
    presetName:
      typeof candidate.presetName === 'string' && candidate.presetName.trim().length > 0
        ? candidate.presetName.trim()
        : undefined,
    renderShape:
      candidate.renderShape === 'round' ||
      candidate.renderShape === 'slit' ||
      candidate.renderShape === 'diamond' ||
      candidate.renderShape === 'french' ||
      candidate.renderShape === 'flat'
        ? candidate.renderShape
        : undefined,
    endHole: candidate.endHole === true,
  }
}

export function getTerminalStitchHoleIdForShape(stitchHoles: StitchHole[], shapeId: string) {
  return (
    stitchHoles
      .filter((stitchHole) => stitchHole.shapeId === shapeId)
      .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
      .find((stitchHole) => stitchHole.endHole === true)?.id ?? null
  )
}

export function setTerminalStitchHole(stitchHoles: StitchHole[], holeId: string) {
  const targetHole = stitchHoles.find((stitchHole) => stitchHole.id === holeId)
  if (!targetHole) {
    return stitchHoles
  }

  return stitchHoles.map((stitchHole) => {
    if (stitchHole.shapeId !== targetHole.shapeId) {
      return stitchHole
    }
    return {
      ...stitchHole,
      endHole: stitchHole.id === holeId,
    }
  })
}

export function clearTerminalStitchHole(stitchHoles: StitchHole[], holeId: string) {
  const targetHole = stitchHoles.find((stitchHole) => stitchHole.id === holeId)
  if (!targetHole) {
    return stitchHoles
  }

  return stitchHoles.map((stitchHole) => {
    if (stitchHole.shapeId !== targetHole.shapeId || stitchHole.endHole !== true) {
      return stitchHole
    }
    return {
      ...stitchHole,
      endHole: false,
    }
  })
}

export function findNearestStitchAnchor(
  point: Point,
  shapes: Shape[],
  lineTypesById: Record<string, LineType>,
  maxDistance: number,
  options: FindNearestStitchAnchorOptions = {},
) {
  const findBestAnchor = (matches: (shape: Shape) => boolean) => {
    let best: StitchAnchor | null = null
    let bestDistance = Number.POSITIVE_INFINITY

    for (const shape of shapes) {
      if (!matches(shape)) {
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

  const stitchAnchor = findBestAnchor((shape) => canAnchorStitchHole(shape) && isStitchShape(shape, lineTypesById))
  if (stitchAnchor) {
    return stitchAnchor
  }

  if (!options.allowNonStitchShapes) {
    return null
  }

  return findBestAnchor((shape) => canAnchorStitchHole(shape))
}

function applyStitchHoleDefaults(anchor: StitchAnchor, defaults: StitchHoleDefaults): StitchHole {
  return {
    id: uid(),
    shapeId: anchor.shapeId,
    point: anchor.point,
    angleDeg: anchor.angleDeg,
    holeType: defaults.holeType,
    sequence: 0,
    diameterMm: defaults.diameterMm,
    widthMm: defaults.widthMm,
    heightMm: defaults.heightMm,
    tiltDeg: defaults.tiltDeg,
    inverted: defaults.inverted === true,
    presetId: defaults.presetId,
    presetName: defaults.presetName,
    renderShape: defaults.renderShape,
  }
}

export function createStitchHole(anchor: StitchAnchor, defaults: StitchHoleDefaults): StitchHole {
  return applyStitchHoleDefaults(anchor, defaults)
}

function lineLength(start: Point, end: Point) {
  return Math.hypot(end.x - start.x, end.y - start.y)
}

function shapePolyline(shape: Shape, solverSteps = 6) {
  const curveSegments = shape.type === 'line' ? 1 : Math.max(24, Math.min(240, Math.round(solverSteps) * 12))
  const sampled = sampleShapePoints(shape, curveSegments)
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
    const groupKey = stitchHole.chainId ? `chain:${stitchHole.chainId}` : `shape:${stitchHole.shapeId}`
    const entries = byShape.get(groupKey) ?? []
    entries.push(stitchHole)
    byShape.set(groupKey, entries)
  }

  const normalized: StitchHole[] = []
  for (const holes of byShape.values()) {
    let assignedEndHole = false
    holes
      .slice()
      .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
      .forEach((stitchHole, index) => {
        const isTerminal = stitchHole.endHole === true && !assignedEndHole
        if (isTerminal) {
          assignedEndHole = true
        }
        normalized.push({
          ...stitchHole,
          sequence: index,
          endHole: isTerminal,
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

export function projectDistanceOnShape(shape: Shape, point: Point) {
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

  let assignedEndHole = false
  return ordered.map((stitchHole, index) => {
    const isTerminal = stitchHole.endHole === true && !assignedEndHole
    if (isTerminal) {
      assignedEndHole = true
    }
    return {
      ...stitchHole,
      sequence: index,
      endHole: isTerminal,
    }
  })
}

function stitchDistancesForPitch(
  totalLength: number,
  initialPitch: number,
  endPitch: number,
  options: AutoPitchGenerationOptions = {},
) {
  const targets: number[] = []
  if (totalLength < 1e-6) {
    return targets
  }

  const safeInitialPitch = Math.max(0.2, initialPitch)
  const safeEndPitch = Math.max(0.2, endPitch)
  const precisionMm = Math.max(0.01, options.precisionMm ?? 0.1)
  const stopGapMm = Math.max(precisionMm, options.stopGapMm ?? Math.max(safeInitialPitch, safeEndPitch) * 0.35)
  const startDistanceMm = Math.max(0, Math.min(totalLength, options.startDistanceMm ?? 0))
  const includeStartHole = options.includeStartHole !== false
  const availableLength = totalLength - startDistanceMm

  if (availableLength <= precisionMm) {
    return includeStartHole ? [startDistanceMm] : []
  }

  if (Math.abs(safeInitialPitch - safeEndPitch) <= precisionMm && options.forceFitLastHole) {
    const intervalCount = Math.max(1, Math.round(availableLength / safeInitialPitch))
    const actualPitch = availableLength / intervalCount
    const startIndex = includeStartHole ? 0 : 1
    for (let index = startIndex; index <= intervalCount; index += 1) {
      targets.push(startDistanceMm + actualPitch * index)
    }
    return targets
  }

  let distanceValue = startDistanceMm
  let guard = 0
  if (includeStartHole) {
    targets.push(startDistanceMm)
  } else {
    distanceValue += safeInitialPitch
  }

  while (distanceValue < totalLength - precisionMm && guard < 10000) {
    if (distanceValue > startDistanceMm + precisionMm && distanceValue < totalLength - precisionMm) {
      targets.push(distanceValue)
    }
    const progress = availableLength <= 1e-6 ? 0 : (distanceValue - startDistanceMm) / availableLength
    const pitchAtDistance = safeInitialPitch + (safeEndPitch - safeInitialPitch) * progress
    distanceValue += Math.max(0.2, pitchAtDistance)
    guard += 1
  }

  const lastTarget = targets[targets.length - 1] ?? startDistanceMm
  if (options.forceFitLastHole) {
    if (totalLength - lastTarget > precisionMm) {
      targets.push(totalLength)
    }
    return targets
  }

  if (totalLength - lastTarget <= stopGapMm && totalLength - lastTarget > precisionMm) {
    targets.push(totalLength)
  }

  return targets
}

/**
 * Place exactly `count` stitch holes evenly across the entire length of a path
 * (or a segment of it, if `startDistanceMm` / `endDistanceMm` are provided).
 * Source-app: "evenly place a specified number of stitching holes along a
 * specified section" (v2.5.6 release notes).
 */
export function generateEvenlySpacedStitchHoles(
  shape: Shape,
  count: number,
  defaults: StitchHoleDefaults,
  sequenceStart = 0,
  options: AutoPitchGenerationOptions & {
    startDistanceMm?: number
    endDistanceMm?: number
  } = {},
) {
  if (!Number.isInteger(count) || count < 2) {
    return [] as StitchHole[]
  }
  const polyline = shapePolyline(shape, options.solverSteps ?? 6)
  if (polyline.length < 2) {
    return [] as StitchHole[]
  }
  const lengths = cumulativeLengths(polyline)
  const totalLength = lengths[lengths.length - 1]
  if (totalLength < 1e-6) {
    return [] as StitchHole[]
  }

  const startDist = Math.max(0, Math.min(totalLength, options.startDistanceMm ?? 0))
  const endDist = Math.max(startDist, Math.min(totalLength, options.endDistanceMm ?? totalLength))
  const span = endDist - startDist
  if (span < 1e-6) {
    return [] as StitchHole[]
  }

  const holes: StitchHole[] = []
  for (let i = 0; i < count; i++) {
    const d = startDist + (span * i) / (count - 1)
    const projected = pointAtDistance(polyline, lengths, d)
    if (!projected) continue
    holes.push({
      ...applyStitchHoleDefaults(
        {
          shapeId: shape.id,
          point: projected.point,
          angleDeg: projected.angleDeg,
        },
        defaults,
      ),
      sequence: sequenceStart + i,
    })
  }

  return holes
}

export function generateFixedPitchStitchHoles(
  shape: Shape,
  pitchMm: number,
  defaults: StitchHoleDefaults,
  sequenceStart = 0,
  options: AutoPitchGenerationOptions = {},
) {
  const safePitch = Math.max(0.2, pitchMm)
  const polyline = shapePolyline(shape, options.solverSteps ?? 6)
  if (polyline.length < 2) {
    return [] as StitchHole[]
  }
  const lengths = cumulativeLengths(polyline)
  const totalLength = lengths[lengths.length - 1]
  if (totalLength < 1e-6) {
    return [] as StitchHole[]
  }
  const endDistanceMm = Math.max(0, Math.min(totalLength, options.endDistanceMm ?? totalLength))
  if (endDistanceMm <= (options.startDistanceMm ?? 0)) {
    return [] as StitchHole[]
  }

  const holes: StitchHole[] = []
  const distanceTargets = stitchDistancesForPitch(endDistanceMm, safePitch, safePitch, options)

  for (const [index, distanceValue] of distanceTargets.entries()) {
    const projected = pointAtDistance(polyline, lengths, distanceValue)
    if (!projected) {
      continue
    }
    holes.push({
      ...applyStitchHoleDefaults(
        {
          shapeId: shape.id,
          point: projected.point,
          angleDeg: projected.angleDeg,
        },
        defaults,
      ),
      sequence: sequenceStart + index,
    })
  }

  return holes
}

export function generateVariablePitchStitchHoles(
  shape: Shape,
  startPitchMm: number,
  endPitchMm: number,
  defaults: StitchHoleDefaults,
  sequenceStart = 0,
  options: AutoPitchGenerationOptions = {},
) {
  const safeStartPitch = Math.max(0.2, startPitchMm)
  const safeEndPitch = Math.max(0.2, endPitchMm)
  const polyline = shapePolyline(shape, options.solverSteps ?? 6)
  if (polyline.length < 2) {
    return [] as StitchHole[]
  }
  const lengths = cumulativeLengths(polyline)
  const totalLength = lengths[lengths.length - 1]
  if (totalLength < 1e-6) {
    return [] as StitchHole[]
  }
  const endDistanceMm = Math.max(0, Math.min(totalLength, options.endDistanceMm ?? totalLength))
  if (endDistanceMm <= (options.startDistanceMm ?? 0)) {
    return [] as StitchHole[]
  }

  const holes: StitchHole[] = []
  const distanceTargets = stitchDistancesForPitch(endDistanceMm, safeStartPitch, safeEndPitch, options)

  for (const [index, distanceValue] of distanceTargets.entries()) {
    const projected = pointAtDistance(polyline, lengths, distanceValue)
    if (!projected) {
      continue
    }
    holes.push({
      ...applyStitchHoleDefaults(
        {
          shapeId: shape.id,
          point: projected.point,
          angleDeg: projected.angleDeg,
        },
        defaults,
      ),
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
