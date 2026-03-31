import type { Point, Shape, LineShape, ArcShape } from '../cad/cad-types'
import { uid, round } from '../cad/cad-geometry'

export type MandalaSettings = {
  segmentCount: number
  center: Point
  radius: number
  mirrorSegments: boolean
}

export type GoldenSpiralParams = {
  center: Point
  startRadius: number
  turns: number
  layerId: string
  lineTypeId: string
}

const DEG_TO_RAD = Math.PI / 180
const PHI = 1.618

export function rotatePoint(point: Point, center: Point, angleDeg: number): Point {
  const rad = angleDeg * DEG_TO_RAD
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: round(center.x + dx * cos - dy * sin),
    y: round(center.y + dx * sin + dy * cos),
  }
}

function mirrorPointAcrossAxis(point: Point, center: Point, axisAngleDeg: number): Point {
  const rad = axisAngleDeg * DEG_TO_RAD
  const dx = point.x - center.x
  const dy = point.y - center.y
  const cos2 = Math.cos(2 * rad)
  const sin2 = Math.sin(2 * rad)
  return {
    x: round(center.x + dx * cos2 + dy * sin2),
    y: round(center.y + dx * sin2 - dy * cos2),
  }
}

export function rotateShape(shape: Shape, center: Point, angleDeg: number): Shape {
  const newId = uid()

  if (shape.type === 'line') {
    return {
      ...shape,
      id: newId,
      type: 'line',
      start: rotatePoint(shape.start, center, angleDeg),
      end: rotatePoint(shape.end, center, angleDeg),
    }
  }

  if (shape.type === 'arc') {
    return {
      ...shape,
      id: newId,
      type: 'arc',
      start: rotatePoint(shape.start, center, angleDeg),
      mid: rotatePoint(shape.mid, center, angleDeg),
      end: rotatePoint(shape.end, center, angleDeg),
    }
  }

  if (shape.type === 'bezier') {
    return {
      ...shape,
      id: newId,
      type: 'bezier',
      start: rotatePoint(shape.start, center, angleDeg),
      control: rotatePoint(shape.control, center, angleDeg),
      end: rotatePoint(shape.end, center, angleDeg),
    }
  }

  // text shape
  return {
    ...shape,
    id: newId,
    type: 'text',
    start: rotatePoint(shape.start, center, angleDeg),
    end: rotatePoint(shape.end, center, angleDeg),
  }
}

export function mirrorMandalaItem(shape: Shape, center: Point, axisAngleDeg: number): Shape {
  const newId = uid()

  if (shape.type === 'line') {
    return {
      ...shape,
      id: newId,
      type: 'line',
      start: mirrorPointAcrossAxis(shape.start, center, axisAngleDeg),
      end: mirrorPointAcrossAxis(shape.end, center, axisAngleDeg),
    }
  }

  if (shape.type === 'arc') {
    return {
      ...shape,
      id: newId,
      type: 'arc',
      start: mirrorPointAcrossAxis(shape.start, center, axisAngleDeg),
      mid: mirrorPointAcrossAxis(shape.mid, center, axisAngleDeg),
      end: mirrorPointAcrossAxis(shape.end, center, axisAngleDeg),
    }
  }

  if (shape.type === 'bezier') {
    return {
      ...shape,
      id: newId,
      type: 'bezier',
      start: mirrorPointAcrossAxis(shape.start, center, axisAngleDeg),
      control: mirrorPointAcrossAxis(shape.control, center, axisAngleDeg),
      end: mirrorPointAcrossAxis(shape.end, center, axisAngleDeg),
    }
  }

  // text shape
  return {
    ...shape,
    id: newId,
    type: 'text',
    start: mirrorPointAcrossAxis(shape.start, center, axisAngleDeg),
    end: mirrorPointAcrossAxis(shape.end, center, axisAngleDeg),
  }
}

export function generateRadialCopies(shapes: Shape[], settings: MandalaSettings): Shape[] {
  const { segmentCount, center, mirrorSegments } = settings
  const angleStep = 360 / segmentCount
  const copies: Shape[] = []

  for (let i = 1; i < segmentCount; i++) {
    const angleDeg = angleStep * i
    const isOdd = i % 2 === 1

    for (const shape of shapes) {
      let copy = rotateShape(shape, center, angleDeg)

      if (mirrorSegments && isOdd) {
        const segmentAxisAngle = angleDeg
        copy = mirrorMandalaItem(copy, center, segmentAxisAngle)
      }

      copies.push(copy)
    }
  }

  return copies
}

export function generateGoldenSpiral(params: GoldenSpiralParams): ArcShape[] {
  const { center, startRadius, turns, layerId, lineTypeId } = params
  const arcs: ArcShape[] = []
  let currentRadius = startRadius
  let currentAngle = 0

  for (let i = 0; i < turns; i++) {
    const startAngleRad = currentAngle * DEG_TO_RAD
    const midAngleRad = (currentAngle + 45) * DEG_TO_RAD
    const endAngleRad = (currentAngle + 90) * DEG_TO_RAD

    // Each quarter-turn arc center shifts so the arc connects smoothly.
    // The arc starts at the current point and sweeps 90 degrees with the current radius.
    const quarterIndex = i % 4
    let arcCenterX = center.x
    let arcCenterY = center.y

    // Shift the arc center based on which quadrant we're in
    switch (quarterIndex) {
      case 0:
        arcCenterX = center.x
        arcCenterY = center.y
        break
      case 1:
        arcCenterX = center.x
        arcCenterY = center.y
        break
      case 2:
        arcCenterX = center.x
        arcCenterY = center.y
        break
      case 3:
        arcCenterX = center.x
        arcCenterY = center.y
        break
    }

    const startPoint: Point = {
      x: round(arcCenterX + Math.cos(startAngleRad) * currentRadius),
      y: round(arcCenterY + Math.sin(startAngleRad) * currentRadius),
    }
    const midPoint: Point = {
      x: round(arcCenterX + Math.cos(midAngleRad) * currentRadius),
      y: round(arcCenterY + Math.sin(midAngleRad) * currentRadius),
    }
    const endPoint: Point = {
      x: round(arcCenterX + Math.cos(endAngleRad) * currentRadius),
      y: round(arcCenterY + Math.sin(endAngleRad) * currentRadius),
    }

    arcs.push({
      id: uid(),
      type: 'arc',
      layerId,
      lineTypeId,
      start: startPoint,
      mid: midPoint,
      end: endPoint,
    })

    currentAngle += 90
    currentRadius = currentRadius * PHI
  }

  return arcs
}

export function generateMandalaGuideCircle(
  center: Point,
  radius: number,
  segments: number,
  layerId: string,
  lineTypeId: string,
): Shape[] {
  const shapes: Shape[] = []

  // Guide circle approximated as 4 quarter-circle arcs
  const quarterAngles = [0, 90, 180, 270]
  for (const startDeg of quarterAngles) {
    const startRad = startDeg * DEG_TO_RAD
    const midRad = (startDeg + 45) * DEG_TO_RAD
    const endRad = (startDeg + 90) * DEG_TO_RAD

    const arc: ArcShape = {
      id: uid(),
      type: 'arc',
      layerId,
      lineTypeId,
      start: {
        x: round(center.x + Math.cos(startRad) * radius),
        y: round(center.y + Math.sin(startRad) * radius),
      },
      mid: {
        x: round(center.x + Math.cos(midRad) * radius),
        y: round(center.y + Math.sin(midRad) * radius),
      },
      end: {
        x: round(center.x + Math.cos(endRad) * radius),
        y: round(center.y + Math.sin(endRad) * radius),
      },
    }

    shapes.push(arc)
  }

  // Radial division lines from center to guide circle
  const angleStep = 360 / segments
  for (let i = 0; i < segments; i++) {
    const angleDeg = angleStep * i
    const angleRad = angleDeg * DEG_TO_RAD

    const line: LineShape = {
      id: uid(),
      type: 'line',
      layerId,
      lineTypeId,
      start: { x: round(center.x), y: round(center.y) },
      end: {
        x: round(center.x + Math.cos(angleRad) * radius),
        y: round(center.y + Math.sin(angleRad) * radius),
      },
    }

    shapes.push(line)
  }

  return shapes
}

export function generateGoldenRatioGuides(
  center: Point,
  size: number,
  layerId: string,
  lineTypeId: string,
): LineShape[] {
  const half = size / 2
  const left = center.x - half
  const right = center.x + half
  const top = center.y - half
  const bottom = center.y + half

  // Golden ratio divisions along each axis
  // phi proportion from each side: left + size/phi and right - size/phi
  const goldenOffset = size / PHI

  const lines: LineShape[] = []

  // Vertical line at golden ratio from left
  lines.push({
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: round(left + goldenOffset), y: round(top) },
    end: { x: round(left + goldenOffset), y: round(bottom) },
  })

  // Vertical line at golden ratio from right (= size - size/phi from left)
  lines.push({
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: round(right - goldenOffset), y: round(top) },
    end: { x: round(right - goldenOffset), y: round(bottom) },
  })

  // Horizontal line at golden ratio from top
  lines.push({
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: round(left), y: round(top + goldenOffset) },
    end: { x: round(right), y: round(top + goldenOffset) },
  })

  // Horizontal line at golden ratio from bottom
  lines.push({
    id: uid(),
    type: 'line',
    layerId,
    lineTypeId,
    start: { x: round(left), y: round(bottom - goldenOffset) },
    end: { x: round(right), y: round(bottom - goldenOffset) },
  })

  return lines
}
