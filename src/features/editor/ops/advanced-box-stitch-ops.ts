import { uid } from '../cad/cad-geometry'
import type { Point, Shape, StitchHole, StitchHoleDefaults } from '../cad/cad-types'
import { computeBoundsFromShapes } from './pattern-ops'
import { extractBoxStitchGuideLines } from './box-stitch-ops'
import type { BoxStitchHelperSettings } from './box-stitch-settings'
import { hasExtractedBoxStitchSource } from './box-stitch-source'
import { normalizeStitchHoleSequences } from './stitch-hole-ops'

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function cumulativePolylineLengths(points: Point[]) {
  const lengths = [0]
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + distance(points[index - 1], points[index]))
  }
  return lengths
}

function projectPointAtDistance(points: Point[], lengths: number[], targetDistance: number) {
  if (points.length < 2 || lengths.length !== points.length) {
    return null
  }

  const maxDistance = lengths[lengths.length - 1] ?? 0
  const clampedDistance = Math.max(0, Math.min(targetDistance, maxDistance))
  let segmentIndex = 1
  while (segmentIndex < lengths.length && lengths[segmentIndex] < clampedDistance) {
    segmentIndex += 1
  }
  segmentIndex = Math.min(Math.max(segmentIndex, 1), points.length - 1)

  const start = points[segmentIndex - 1]
  const end = points[segmentIndex]
  const segmentStart = lengths[segmentIndex - 1]
  const segmentEnd = lengths[segmentIndex]
  const segmentLength = Math.max(segmentEnd - segmentStart, 1e-9)
  const localT = (clampedDistance - segmentStart) / segmentLength

  return {
    point: {
      x: start.x + (end.x - start.x) * localT,
      y: start.y + (end.y - start.y) * localT,
    },
    angleDeg: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
    segmentIndex: segmentIndex - 1,
  }
}

function generateCenteredStitchHolesAlongGuidePath(
  points: Point[],
  guideLines: Extract<Shape, { type: 'line' }>[],
  stitchPitchMm: number,
  stitchHoleDefaults: StitchHoleDefaults,
) {
  if (points.length < 2 || guideLines.length === 0) {
    return [] as StitchHole[]
  }

  const safePitch = Math.max(0.2, stitchPitchMm)
  const lengths = cumulativePolylineLengths(points)
  const totalLength = lengths[lengths.length - 1] ?? 0
  if (totalLength < 1e-6) {
    return [] as StitchHole[]
  }

  const targets: number[] = []
  if (totalLength <= safePitch) {
    targets.push(totalLength / 2)
  } else {
    const startDistance = Math.min(safePitch / 2, totalLength / 2)
    for (let distanceValue = startDistance; distanceValue < totalLength - 1e-3; distanceValue += safePitch) {
      targets.push(distanceValue)
    }
  }

  return targets.flatMap((distanceValue, sequence) => {
    const projected = projectPointAtDistance(points, lengths, distanceValue)
    if (!projected) {
      return []
    }
    const guideLine = guideLines[Math.min(projected.segmentIndex, guideLines.length - 1)]
    if (!guideLine) {
      return []
    }

    return [{
      id: uid(),
      shapeId: guideLine.id,
      point: projected.point,
      angleDeg: projected.angleDeg,
      holeType: stitchHoleDefaults.holeType,
      sequence,
      renderShape: stitchHoleDefaults.renderShape,
      diameterMm: stitchHoleDefaults.diameterMm,
      widthMm: stitchHoleDefaults.widthMm,
      heightMm: stitchHoleDefaults.heightMm,
      tiltDeg: stitchHoleDefaults.tiltDeg,
      inverted: stitchHoleDefaults.inverted,
      presetId: stitchHoleDefaults.presetId,
      presetName: stitchHoleDefaults.presetName,
    } satisfies StitchHole]
  })
}

function projectExistingStitchHolesAlongGuidePath(
  sourceHoles: StitchHole[],
  sourceShapes: Shape[],
  points: Point[],
  guideLines: Extract<Shape, { type: 'line' }>[],
) {
  if (sourceHoles.length === 0 || sourceShapes.length === 0 || points.length < 2 || guideLines.length === 0) {
    return [] as StitchHole[]
  }

  const sourceBounds = computeBoundsFromShapes(sourceShapes)
  if (!sourceBounds) {
    return [] as StitchHole[]
  }
  const sourceSpan = Math.max(sourceBounds.maxX - sourceBounds.minX, sourceBounds.maxY - sourceBounds.minY, 1e-9)
  const useX = sourceBounds.maxX - sourceBounds.minX >= sourceBounds.maxY - sourceBounds.minY
  const guideLengths = cumulativePolylineLengths(points)
  const guideTotalLength = guideLengths[guideLengths.length - 1] ?? 0
  if (guideTotalLength < 1e-6) {
    return [] as StitchHole[]
  }

  return sourceHoles
    .slice()
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
    .flatMap((sourceHole, sequence) => {
      const sourceAlong = useX
        ? (sourceHole.point.x - sourceBounds.minX) / sourceSpan
        : (sourceHole.point.y - sourceBounds.minY) / sourceSpan
      const projected = projectPointAtDistance(points, guideLengths, guideTotalLength * Math.max(0, Math.min(1, sourceAlong)))
      if (!projected) {
        return []
      }
      const guideLine = guideLines[Math.min(projected.segmentIndex, guideLines.length - 1)]
      if (!guideLine) {
        return []
      }
      return [{
        ...sourceHole,
        id: uid(),
        shapeId: guideLine.id,
        point: projected.point,
        angleDeg: projected.angleDeg,
        sequence,
        endHole: false,
      } satisfies StitchHole]
    })
}

export function createBoxStitchFromSelection(
  shapes: Shape[],
  stitchHoles: StitchHole[],
  selectedShapeIds: Set<string>,
  settings: BoxStitchHelperSettings,
  stitchLineTypeId: string,
  fallbackLayerId: string | null,
  stitchPitchMm: number,
  stitchHoleDefaults: StitchHoleDefaults,
) {
  const selected = shapes.filter((shape) => selectedShapeIds.has(shape.id))
  if (selected.length === 0) {
    return {
      ok: false as const,
      message: 'Select one or more shapes to create a box stitch',
      guideLines: [] as Extract<Shape, { type: 'line' }>[],
      stitchHoles: [] as StitchHole[],
    }
  }

  const firstShape = selected[0]
  const layerId = firstShape?.layerId ?? fallbackLayerId ?? ''
  if (!layerId) {
    return {
      ok: false as const,
      message: 'No target layer available for box stitch',
      guideLines: [] as Extract<Shape, { type: 'line' }>[],
      stitchHoles: [] as StitchHole[],
    }
  }

  const groupId = firstShape?.groupId
  const lineType = stitchLineTypeId || firstShape?.lineTypeId || ''
  const extractedSources = selected.filter((shape) => hasExtractedBoxStitchSource(shape))
  const helperSourceShapes = extractedSources.length > 0 ? extractedSources : selected
  const extracted = extractBoxStitchGuideLines(helperSourceShapes, settings, layerId, lineType, groupId)
  if (extracted.guideLines.length === 0) {
    const bounds = computeBoundsFromShapes(helperSourceShapes)
    const safeDistance = Math.max(0.1, Math.abs(settings.distanceMm))
    if (
      !bounds ||
      bounds.maxX - bounds.minX <= safeDistance * 2 ||
      bounds.maxY - bounds.minY <= safeDistance * 2
    ) {
      return {
        ok: false as const,
        message: 'Box stitch distance is too large for the selected bounds',
        guideLines: [] as Extract<Shape, { type: 'line' }>[],
        stitchHoles: [] as StitchHole[],
      }
    }
  }

  const guideLines = extracted.guideLines
  const selectedSourceHoles = stitchHoles.filter((hole) => selectedShapeIds.has(hole.shapeId))
  const projectedHoles = selectedSourceHoles.length > 0
    ? extracted.guideGroups.flatMap((group) =>
        projectExistingStitchHolesAlongGuidePath(selectedSourceHoles, helperSourceShapes, group.points, group.guideLines),
      )
    : []
  const generatedHoles = extracted.guideGroups.flatMap((group) =>
    generateCenteredStitchHolesAlongGuidePath(group.points, group.guideLines, stitchPitchMm, stitchHoleDefaults),
  )
  const createdStitchHoles = normalizeStitchHoleSequences(projectedHoles.length > 0 ? projectedHoles : generatedHoles)

  return {
    ok: true as const,
    message:
      extractedSources.length > 0
        ? `Box stitch generated from ${extracted.extractedEdgeCount || extractedSources.length} extracted source${(extracted.extractedEdgeCount || extractedSources.length) === 1 ? '' : 's'}${extracted.usedFallback ? ' with fallback guides' : ''}`
        : extracted.extractedEdgeCount > 0
          ? `Box stitch extracted from ${extracted.extractedEdgeCount} candidate edge${extracted.extractedEdgeCount === 1 ? '' : 's'}${extracted.usedFallback ? ' with fallback guides' : ''}`
          : 'Box stitch generated from selection bounds',
    guideLines,
    stitchHoles: createdStitchHoles,
  }
}
