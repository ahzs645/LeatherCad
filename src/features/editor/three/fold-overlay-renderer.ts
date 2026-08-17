import {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import { sampleShapePoints } from '../cad/cad-geometry'
import type { FoldLine, Layer, LineType, Shape, StitchHole } from '../cad/cad-types'
import { lineIntersectionOnSegment, segmentLengthSquared, sideOfLine } from './bridge/geometry-utils'
import type { ModelTransform } from './model-builder-types'
import { projectPoint } from './model-builder-shared'
import { buildThreadSegments, createThreadMaterial, type ThreadSegment } from './stitch-thread'

const EPSILON = 1e-6
const CUT_LINE_COLOR = '#38bdf8'
const STITCH_LINE_COLOR = '#f97316'
const FOLD_LINE_COLOR = '#fb7185'

type ShapeSegment = {
  start: Vector2
  end: Vector2
  color: string
}

function shapeColor(shape: Shape, lineTypes: LineType[], layers: Layer[]) {
  const lineType = lineTypes.find((entry) => entry.id === shape.lineTypeId)
  if (lineType?.role === 'stitch') {
    return STITCH_LINE_COLOR
  }
  if (lineType?.role === 'fold') {
    return FOLD_LINE_COLOR
  }

  const layer = layers.find((entry) => entry.id === shape.layerId)
  const fallbackFingerprint = `${layer?.name ?? ''} ${shape.id}`.toLowerCase()
  if (
    fallbackFingerprint.includes('stitch') ||
    fallbackFingerprint.includes('seam') ||
    fallbackFingerprint.includes('thread')
  ) {
    return STITCH_LINE_COLOR
  }

  return CUT_LINE_COLOR
}

function splitSegmentByFold(start: Vector2, end: Vector2, foldStart: Vector2, foldEnd: Vector2) {
  const sideStart = sideOfLine(start, foldStart, foldEnd)
  const sideEnd = sideOfLine(end, foldStart, foldEnd)
  const onStart = Math.abs(sideStart) <= EPSILON
  const onEnd = Math.abs(sideEnd) <= EPSILON

  if (onStart && onEnd) {
    return {
      positive: [{ start, end }],
      negative: [{ start, end }],
    }
  }

  if ((sideStart >= -EPSILON && sideEnd >= -EPSILON) || (onStart && sideEnd > EPSILON) || (onEnd && sideStart > EPSILON)) {
    return { positive: [{ start, end }], negative: [] as Array<{ start: Vector2; end: Vector2 }> }
  }

  if ((sideStart <= EPSILON && sideEnd <= EPSILON) || (onStart && sideEnd < -EPSILON) || (onEnd && sideStart < -EPSILON)) {
    return { positive: [] as Array<{ start: Vector2; end: Vector2 }>, negative: [{ start, end }] }
  }

  const intersection = lineIntersectionOnSegment(start, end, sideStart, sideEnd)
  if (!intersection) {
    if (sideStart >= 0) {
      return { positive: [{ start, end }], negative: [] as Array<{ start: Vector2; end: Vector2 }> }
    }
    return { positive: [] as Array<{ start: Vector2; end: Vector2 }>, negative: [{ start, end }] }
  }

  if (sideStart >= 0) {
    return {
      positive: [{ start, end: intersection }],
      negative: [{ start: intersection, end }],
    }
  }

  return {
    positive: [{ start: intersection, end }],
    negative: [{ start, end: intersection }],
  }
}

function buildShapeSegments(
  shapes: Shape[],
  foldStart: Vector2,
  foldEnd: Vector2,
  transform: ModelTransform,
  lineTypes: LineType[],
  layers: Layer[],
) {
  const positiveSegments: ShapeSegment[] = []
  const negativeSegments: ShapeSegment[] = []

  for (const shape of shapes) {
    const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 28)
    const color = shapeColor(shape, lineTypes, layers)

    for (let index = 0; index < sampled.length - 1; index += 1) {
      const start = projectPoint(sampled[index], transform)
      const end = projectPoint(sampled[index + 1], transform)
      const split = splitSegmentByFold(start, end, foldStart, foldEnd)

      for (const segment of split.positive) {
        if (segmentLengthSquared(segment.start, segment.end) > EPSILON) {
          positiveSegments.push({
            start: segment.start.clone(),
            end: segment.end.clone(),
            color,
          })
        }
      }

      for (const segment of split.negative) {
        if (segmentLengthSquared(segment.start, segment.end) > EPSILON) {
          negativeSegments.push({
            start: segment.start.clone(),
            end: segment.end.clone(),
            color,
          })
        }
      }
    }
  }

  return { positiveSegments, negativeSegments }
}

function addSegmentLine(group: Group, segment: ShapeSegment, pivot: Vector2 | null, yOffset: number) {
  if (segmentLengthSquared(segment.start, segment.end) <= EPSILON) {
    return
  }

  const offsetX = pivot?.x ?? 0
  const offsetY = pivot?.y ?? 0
  const line = new Line(
    new BufferGeometry().setFromPoints([
      new Vector3(segment.start.x - offsetX, yOffset + 0.003, segment.start.y - offsetY),
      new Vector3(segment.end.x - offsetX, yOffset + 0.003, segment.end.y - offsetY),
    ]),
    new LineBasicMaterial({ color: segment.color }),
  )
  group.add(line)
}

const STITCH_HOLE_RADIUS = 0.006
const STITCH_THREAD_RADIUS = 0.0035
const STITCH_SURFACE_LIFT = 0.006

function stitchWorldPoint(point: Vector2, pivot: Vector2 | null, yOffset: number) {
  const offsetX = pivot?.x ?? 0
  const offsetY = pivot?.y ?? 0
  return new Vector3(point.x - offsetX, yOffset + STITCH_SURFACE_LIFT, point.y - offsetY)
}

export function renderLayerOverlays({
  layerSlice,
  lineTypes,
  layers,
  stitchHoles,
  transform,
  foldStart,
  foldEnd,
  foldMid,
  threadColor,
  yOffset,
  staticSideGroup,
  foldingSideGroup,
}: {
  layerSlice: { layerId: string; shapes: Shape[] }
  lineTypes: LineType[]
  layers: Layer[]
  stitchHoles: StitchHole[]
  transform: ModelTransform
  foldStart: Vector2
  foldEnd: Vector2
  foldMid: Vector2
  threadColor: string
  yOffset: number
  staticSideGroup: Group
  foldingSideGroup: Group
}) {
  const { positiveSegments, negativeSegments } = buildShapeSegments(
    layerSlice.shapes,
    foldStart,
    foldEnd,
    transform,
    lineTypes,
    layers,
  )
  for (const segment of negativeSegments) {
    addSegmentLine(staticSideGroup, segment, null, yOffset)
  }
  for (const segment of positiveSegments) {
    addSegmentLine(foldingSideGroup, segment, foldMid, yOffset)
  }

  const layerShapeIds = new Set(layerSlice.shapes.map((shape) => shape.id))
  const layerStitchHoles = stitchHoles.filter((stitchHole) => layerShapeIds.has(stitchHole.shapeId))
  if (layerStitchHoles.length === 0) {
    return
  }

  const stitchHolesByShape = new Map<string, StitchHole[]>()
  for (const stitchHole of layerStitchHoles) {
    const entries = stitchHolesByShape.get(stitchHole.shapeId) ?? []
    entries.push(stitchHole)
    stitchHolesByShape.set(stitchHole.shapeId, entries)
  }

  // Stitching renders as lit thread — the same look as the final-product and
  // assembled modes — so pricking work shows up live in the fold preview
  // instead of as flat dots and lines.
  const threadMaterial = createThreadMaterial(threadColor)
  const holeGeometry = new SphereGeometry(STITCH_HOLE_RADIUS, 8, 8)
  const staticSegments: ThreadSegment[] = []
  const foldingSegments: ThreadSegment[] = []

  for (const stitchHolesOnShape of stitchHolesByShape.values()) {
    const ordered = stitchHolesOnShape
      .slice()
      .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))

    const projectedPoints = ordered.map((stitchHole) => projectPoint(stitchHole.point, transform))
    for (const projectedPoint of projectedPoints) {
      const onFoldingSide = sideOfLine(projectedPoint, foldStart, foldEnd) > -EPSILON
      const sphere = new Mesh(holeGeometry, threadMaterial)
      sphere.position.copy(stitchWorldPoint(projectedPoint, onFoldingSide ? foldMid : null, yOffset))
      sphere.castShadow = true
      ;(onFoldingSide ? foldingSideGroup : staticSideGroup).add(sphere)
    }

    for (let index = 1; index < projectedPoints.length; index += 1) {
      const split = splitSegmentByFold(projectedPoints[index - 1], projectedPoints[index], foldStart, foldEnd)
      for (const segment of split.negative) {
        staticSegments.push({
          start: stitchWorldPoint(segment.start, null, yOffset),
          end: stitchWorldPoint(segment.end, null, yOffset),
        })
      }
      for (const segment of split.positive) {
        foldingSegments.push({
          start: stitchWorldPoint(segment.start, foldMid, yOffset),
          end: stitchWorldPoint(segment.end, foldMid, yOffset),
        })
      }
    }
  }

  const staticThread = buildThreadSegments(staticSegments, threadMaterial, STITCH_THREAD_RADIUS, 'fold-stitch-thread-static')
  if (staticThread) {
    staticSideGroup.add(staticThread)
  }
  const foldingThread = buildThreadSegments(foldingSegments, threadMaterial, STITCH_THREAD_RADIUS, 'fold-stitch-thread-folding')
  if (foldingThread) {
    foldingSideGroup.add(foldingThread)
  }
}

export function renderFoldGuides({
  foldLines,
  transform,
  guideYOffset,
  foldGuideGroup,
}: {
  foldLines: FoldLine[]
  transform: ModelTransform
  guideYOffset: number
  foldGuideGroup: Group
}) {
  for (const foldLine of foldLines) {
    const projectedStart = projectPoint(foldLine.start, transform)
    const projectedEnd = projectPoint(foldLine.end, transform)
    const line = new Line(
      new BufferGeometry().setFromPoints([
        new Vector3(projectedStart.x, guideYOffset, projectedStart.y),
        new Vector3(projectedEnd.x, guideYOffset, projectedEnd.y),
      ]),
      new LineDashedMaterial({
        color: FOLD_LINE_COLOR,
        dashSize: 0.06,
        gapSize: 0.035,
      }),
    )
    line.computeLineDistances()
    foldGuideGroup.add(line)
  }
}
