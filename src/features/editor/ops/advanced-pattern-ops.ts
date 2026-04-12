import { sampleShapePoints, uid } from '../cad/cad-geometry'
import type { Point, Shape, StitchHole, StitchHoleDefaults } from '../cad/cad-types'
import { computeBoundsFromShapes } from './pattern-ops'
import { extractBoxStitchGuideLines, hasExtractedBoxStitchSource } from './box-stitch-ops'
import type { BoxStitchHelperSettings } from './box-stitch-settings'
import { normalizeStitchHoleSequences } from './stitch-hole-ops'

type CornerPointMatch = {
  corner: Point
  aCornerKey: 'start' | 'end'
  bCornerKey: 'start' | 'end'
}

type CornerOpMode = 'bevel' | 'round'

const POINT_EPSILON = 1e-3

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function pointEquals(a: Point, b: Point) {
  return distance(a, b) <= POINT_EPSILON
}

function moveToward(from: Point, to: Point, amount: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return { ...from }
  }
  return {
    x: from.x + (dx / length) * amount,
    y: from.y + (dy / length) * amount,
  }
}

function findCornerMatch(lineA: Extract<Shape, { type: 'line' }>, lineB: Extract<Shape, { type: 'line' }>): CornerPointMatch | null {
  if (pointEquals(lineA.start, lineB.start)) {
    return { corner: lineA.start, aCornerKey: 'start', bCornerKey: 'start' }
  }
  if (pointEquals(lineA.start, lineB.end)) {
    return { corner: lineA.start, aCornerKey: 'start', bCornerKey: 'end' }
  }
  if (pointEquals(lineA.end, lineB.start)) {
    return { corner: lineA.end, aCornerKey: 'end', bCornerKey: 'start' }
  }
  if (pointEquals(lineA.end, lineB.end)) {
    return { corner: lineA.end, aCornerKey: 'end', bCornerKey: 'end' }
  }
  return null
}

export function applyCornerOnSelectedLines(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  mode: CornerOpMode,
  amountMm: number,
  activeLineTypeId: string,
) {
  const selectedLines = shapes.filter(
    (shape): shape is Extract<Shape, { type: 'line' }> => selectedShapeIds.has(shape.id) && shape.type === 'line',
  )

  if (selectedLines.length !== 2) {
    return {
      ok: false as const,
      message: 'Select exactly two connected lines first',
      nextShapes: shapes,
      createdShapeIds: [] as string[],
    }
  }

  const [lineA, lineB] = selectedLines
  const cornerMatch = findCornerMatch(lineA, lineB)
  if (!cornerMatch) {
    return {
      ok: false as const,
      message: 'Selected lines must share one corner point',
      nextShapes: shapes,
      createdShapeIds: [] as string[],
    }
  }

  const safeAmount = Math.max(0.1, Math.abs(amountMm))
  const otherA = cornerMatch.aCornerKey === 'start' ? lineA.end : lineA.start
  const otherB = cornerMatch.bCornerKey === 'start' ? lineB.end : lineB.start
  const lenA = distance(cornerMatch.corner, otherA)
  const lenB = distance(cornerMatch.corner, otherB)

  if (lenA <= safeAmount * 1.05 || lenB <= safeAmount * 1.05) {
    return {
      ok: false as const,
      message: 'Corner amount is too large for one of the selected lines',
      nextShapes: shapes,
      createdShapeIds: [] as string[],
    }
  }

  const cutA = moveToward(cornerMatch.corner, otherA, safeAmount)
  const cutB = moveToward(cornerMatch.corner, otherB, safeAmount)

  const nextLineA: Shape = {
    ...lineA,
    start: cornerMatch.aCornerKey === 'start' ? cutA : lineA.start,
    end: cornerMatch.aCornerKey === 'end' ? cutA : lineA.end,
  }
  const nextLineB: Shape = {
    ...lineB,
    start: cornerMatch.bCornerKey === 'start' ? cutB : lineB.start,
    end: cornerMatch.bCornerKey === 'end' ? cutB : lineB.end,
  }

  const connectorLineTypeId = activeLineTypeId || lineA.lineTypeId
  const connectorLayerId = lineA.layerId
  const connectorGroupId = lineA.groupId && lineB.groupId && lineA.groupId === lineB.groupId ? lineA.groupId : undefined
  const connector: Shape =
    mode === 'bevel'
      ? {
          id: uid(),
          type: 'line',
          layerId: connectorLayerId,
          lineTypeId: connectorLineTypeId,
          groupId: connectorGroupId,
          start: cutA,
          end: cutB,
        }
      : {
          id: uid(),
          type: 'arc',
          layerId: connectorLayerId,
          lineTypeId: connectorLineTypeId,
          groupId: connectorGroupId,
          start: cutA,
          mid: cornerMatch.corner,
          end: cutB,
        }

  const nextShapes = shapes.map((shape) => {
    if (shape.id === lineA.id) {
      return nextLineA
    }
    if (shape.id === lineB.id) {
      return nextLineB
    }
    return shape
  })

  return {
    ok: true as const,
    message: mode === 'bevel' ? 'Corner bevel applied' : 'Corner rounding applied',
    nextShapes: [...nextShapes, connector],
    createdShapeIds: [connector.id],
  }
}

function toOffsetPolyline(shape: Shape, offsetMm: number) {
  const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 64)
  if (sampled.length < 2) {
    return [] as Point[]
  }

  const shifted: Point[] = []
  for (let index = 0; index < sampled.length; index += 1) {
    const previous = sampled[Math.max(0, index - 1)]
    const current = sampled[index]
    const next = sampled[Math.min(sampled.length - 1, index + 1)]
    const tangent = {
      x: next.x - previous.x,
      y: next.y - previous.y,
    }
    const tangentLength = Math.hypot(tangent.x, tangent.y)
    if (tangentLength < 1e-6) {
      shifted.push({ ...current })
      continue
    }
    const normal = {
      x: -tangent.y / tangentLength,
      y: tangent.x / tangentLength,
    }
    shifted.push({
      x: current.x + normal.x * offsetMm,
      y: current.y + normal.y * offsetMm,
    })
  }
  return shifted
}

function polylineToLineShapes(
  polyline: Point[],
  shape: Shape,
  lineTypeId: string,
) {
  const created: Shape[] = []
  for (let index = 1; index < polyline.length; index += 1) {
    created.push({
      id: uid(),
      type: 'line',
      layerId: shape.layerId,
      lineTypeId: lineTypeId || shape.lineTypeId,
      groupId: shape.groupId,
      start: polyline[index - 1],
      end: polyline[index],
    })
  }
  return created
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

export function createOffsetGeometryForSelection(
  shapes: Shape[],
  selectedShapeIds: Set<string>,
  offsetMm: number,
  lineTypeId: string,
) {
  if (selectedShapeIds.size === 0) {
    return {
      ok: false as const,
      message: 'Select one or more shapes to offset',
      created: [] as Shape[],
    }
  }

  const safeOffset = Math.abs(offsetMm) < 0.001 ? 0 : offsetMm
  if (safeOffset === 0) {
    return {
      ok: false as const,
      message: 'Offset distance must be non-zero',
      created: [] as Shape[],
    }
  }

  const selectedShapes = shapes.filter((shape) => selectedShapeIds.has(shape.id))
  const created: Shape[] = []

  for (const shape of selectedShapes) {
    if (shape.type === 'line') {
      const polyline = toOffsetPolyline(shape, safeOffset)
      if (polyline.length >= 2) {
        created.push({
          id: uid(),
          type: 'line',
          layerId: shape.layerId,
          lineTypeId: lineTypeId || shape.lineTypeId,
          groupId: shape.groupId,
          start: polyline[0],
          end: polyline[polyline.length - 1],
        })
      }
      continue
    }

    if (shape.type === 'text') {
      const directionLength = distance(shape.start, shape.end)
      const direction =
        directionLength < 1e-6
          ? { x: 1, y: 0 }
          : {
              x: (shape.end.x - shape.start.x) / directionLength,
              y: (shape.end.y - shape.start.y) / directionLength,
            }
      const normal = { x: -direction.y, y: direction.x }
      created.push({
        ...shape,
        id: uid(),
        lineTypeId: lineTypeId || shape.lineTypeId,
        start: {
          x: shape.start.x + normal.x * safeOffset,
          y: shape.start.y + normal.y * safeOffset,
        },
        end: {
          x: shape.end.x + normal.x * safeOffset,
          y: shape.end.y + normal.y * safeOffset,
        },
      })
      continue
    }

    const polyline = toOffsetPolyline(shape, safeOffset)
    created.push(...polylineToLineShapes(polyline, shape, lineTypeId))
  }

  if (created.length === 0) {
    return {
      ok: false as const,
      message: 'Could not offset the selected shapes',
      created,
    }
  }

  return {
    ok: true as const,
    message: `Created ${created.length} offset shape${created.length === 1 ? '' : 's'}`,
    created,
  }
}

export function createBoxStitchFromSelection(
  shapes: Shape[],
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
  const stitchHoles = normalizeStitchHoleSequences(
    extracted.guideGroups.flatMap((group) =>
      generateCenteredStitchHolesAlongGuidePath(group.points, group.guideLines, stitchPitchMm, stitchHoleDefaults),
    ),
  )

  return {
    ok: true as const,
    message:
      extractedSources.length > 0
        ? `Box stitch generated from ${extracted.extractedEdgeCount || extractedSources.length} extracted source${(extracted.extractedEdgeCount || extractedSources.length) === 1 ? '' : 's'}${extracted.usedFallback ? ' with fallback guides' : ''}`
        : extracted.extractedEdgeCount > 0
          ? `Box stitch extracted from ${extracted.extractedEdgeCount} candidate edge${extracted.extractedEdgeCount === 1 ? '' : 's'}${extracted.usedFallback ? ' with fallback guides' : ''}`
          : 'Box stitch generated from selection bounds',
    guideLines,
    stitchHoles,
  }
}
