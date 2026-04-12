import { uid } from '../../cad/cad-geometry'
import type { ArcShape, Point } from '../../cad/cad-types'

export function ellipseToArcShapes(
  center: Point,
  w: number,
  h: number,
  layerId: string,
  lineTypeId: string,
): ArcShape[] {
  const rx = w / 2
  const ry = h / 2
  const cx = center.x
  const cy = center.y
  const right: Point = { x: cx + rx, y: cy }
  const top: Point = { x: cx, y: cy - ry }
  const left: Point = { x: cx - rx, y: cy }
  const bottom: Point = { x: cx, y: cy + ry }
  const cos45 = Math.SQRT1_2
  const midRT: Point = { x: cx + rx * cos45, y: cy - ry * cos45 }
  const midTL: Point = { x: cx - rx * cos45, y: cy - ry * cos45 }
  const midLB: Point = { x: cx - rx * cos45, y: cy + ry * cos45 }
  const midBR: Point = { x: cx + rx * cos45, y: cy + ry * cos45 }

  return [
    { id: uid(), type: 'arc', layerId, lineTypeId, start: right, mid: midRT, end: top },
    { id: uid(), type: 'arc', layerId, lineTypeId, start: top, mid: midTL, end: left },
    { id: uid(), type: 'arc', layerId, lineTypeId, start: left, mid: midLB, end: bottom },
    { id: uid(), type: 'arc', layerId, lineTypeId, start: bottom, mid: midBR, end: right },
  ]
}

export function ellipseArcToShapes(
  center: Point,
  w: number,
  h: number,
  startAngleDeg: number,
  sweepAngleDeg: number,
  layerId: string,
  lineTypeId: string,
): ArcShape[] {
  const rx = w / 2
  const ry = h / 2
  const cx = center.x
  const cy = center.y
  const toRad = Math.PI / 180

  const startRad = startAngleDeg * toRad
  const endRad = (startAngleDeg + sweepAngleDeg) * toRad
  const midRad = (startRad + endRad) / 2
  const pointAt = (rad: number): Point => ({
    x: cx + rx * Math.cos(rad),
    y: cy + ry * Math.sin(rad),
  })

  return [
    {
      id: uid(),
      type: 'arc',
      layerId,
      lineTypeId,
      start: pointAt(startRad),
      mid: pointAt(midRad),
      end: pointAt(endRad),
    },
  ]
}
