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

function lineAngleDeg(start: Point, end: Point): number {
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI
}

function perpendicularAngleDeg(start: Point, end: Point): number {
  return lineAngleDeg(start, end) + 90
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

export function extractBoxStitchLine(
  boundaryShapes: Shape[],
  edgeIndex: number,
  offsetMm: number,
  layerId: string,
  lineTypeId: string,
): LineShape | null {
  if (boundaryShapes.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const shape of boundaryShapes) {
    const points = getShapePointList(shape)
    for (const point of points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null
  }

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
