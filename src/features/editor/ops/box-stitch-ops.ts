import type { Point, Shape, LineShape, StitchHole } from '../cad/cad-types'
import { uid, distance } from '../cad/cad-geometry'
import {
  hasExtractedBoxStitchSource,
  isBoxStitchSourceEligibleShape,
} from './box-stitch-source'
export { extractBoxStitchGuideLines, extractBoxStitchLine } from './box-stitch-guide-ops'
export type {
  BoxStitchGuideGroup,
  BoxStitchGuideProjectionOptions,
  ExtractedBoxStitchGuidesResult,
} from './box-stitch-guide-ops'

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

type BoxStitchSourceMutationResult = {
  nextShapes: Shape[]
  updatedCount: number
}

function lineAngleDeg(start: Point, end: Point): number {
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
}

function perpendicularAngleDeg(start: Point, end: Point): number {
  return lineAngleDeg(start, end) + 90
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
