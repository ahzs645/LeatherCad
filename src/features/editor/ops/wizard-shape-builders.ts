import type { Point, Shape, LineShape, ArcShape, BezierShape } from '../cad/cad-types'
import { uid, round } from '../cad/cad-geometry'

export function makeLine(
  start: Point,
  end: Point,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): LineShape {
  return { id: uid(), type: 'line', start, end, layerId, lineTypeId, groupId }
}

export function makeArc(
  start: Point,
  mid: Point,
  end: Point,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): ArcShape {
  return { id: uid(), type: 'arc', start, mid, end, layerId, lineTypeId, groupId }
}

export function makeBezier(
  start: Point,
  control: Point,
  end: Point,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): BezierShape {
  return { id: uid(), type: 'bezier', start, control, end, layerId, lineTypeId, groupId }
}

export function makeCircleArcs(
  cx: number,
  cy: number,
  r: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): ArcShape[] {
  const p = (x: number, y: number): Point => ({ x: round(x), y: round(y) })
  const top = p(cx, cy - r)
  const right = p(cx + r, cy)
  const bottom = p(cx, cy + r)
  const left = p(cx - r, cy)
  const d = r * Math.SQRT2 / 2
  const tr = p(cx + d, cy - d)
  const br = p(cx + d, cy + d)
  const bl = p(cx - d, cy + d)
  const tl = p(cx - d, cy - d)
  return [
    makeArc(top, tr, right, layerId, lineTypeId, groupId),
    makeArc(right, br, bottom, layerId, lineTypeId, groupId),
    makeArc(bottom, bl, left, layerId, lineTypeId, groupId),
    makeArc(left, tl, top, layerId, lineTypeId, groupId),
  ]
}

export function makeRect(
  x: number,
  y: number,
  w: number,
  h: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): LineShape[] {
  const tl: Point = { x: round(x), y: round(y) }
  const tr: Point = { x: round(x + w), y: round(y) }
  const br: Point = { x: round(x + w), y: round(y + h) }
  const bl: Point = { x: round(x), y: round(y + h) }
  return [
    makeLine(tl, tr, layerId, lineTypeId, groupId),
    makeLine(tr, br, layerId, lineTypeId, groupId),
    makeLine(br, bl, layerId, lineTypeId, groupId),
    makeLine(bl, tl, layerId, lineTypeId, groupId),
  ]
}

export function makeRoundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  cr: number,
  layerId: string,
  lineTypeId: string,
  groupId?: string,
): Shape[] {
  const r = Math.min(cr, w / 2, h / 2)
  if (r <= 0) return makeRect(x, y, w, h, layerId, lineTypeId, groupId)

  const p = (px: number, py: number): Point => ({ x: round(px), y: round(py) })
  const k = r * (Math.SQRT2 - 1)
  const shapes: Shape[] = []

  shapes.push(makeLine(p(x + r, y), p(x + w - r, y), layerId, lineTypeId, groupId))
  shapes.push(makeArc(
    p(x + w - r, y),
    p(x + w - k, y + k),
    p(x + w, y + r),
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(p(x + w, y + r), p(x + w, y + h - r), layerId, lineTypeId, groupId))
  shapes.push(makeArc(
    p(x + w, y + h - r),
    p(x + w - k, y + h - k),
    p(x + w - r, y + h),
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(p(x + w - r, y + h), p(x + r, y + h), layerId, lineTypeId, groupId))
  shapes.push(makeArc(
    p(x + r, y + h),
    p(x + k, y + h - k),
    p(x, y + h - r),
    layerId, lineTypeId, groupId,
  ))
  shapes.push(makeLine(p(x, y + h - r), p(x, y + r), layerId, lineTypeId, groupId))
  shapes.push(makeArc(
    p(x, y + r),
    p(x + k, y + k),
    p(x + r, y),
    layerId, lineTypeId, groupId,
  ))

  return shapes
}
