import { uid } from '../../cad/cad-geometry'
import type { Point, Shape } from '../../cad/cad-types'
import { circularArcs } from '../lcad/lcad-geometry'

export function ellipseToArcShapes(center: Point, w: number, h: number, layerId: string, lineTypeId: string, rotationDeg = 0): Shape[] {
  return ellipseArcToShapes(center, w, h, 0, -360, layerId, lineTypeId, rotationDeg)
}

/** Legacy ellipse parameters map directly to the analytic editor model. */
export function ellipseArcToShapes(center: Point, w: number, h: number, startAngleDeg: number, sweepAngleDeg: number, layerId: string, lineTypeId: string, rotationDeg = 0): Shape[] {
  const rx = w / 2, ry = h / 2
  if (![center.x, center.y, rx, ry, startAngleDeg, sweepAngleDeg, rotationDeg].every(Number.isFinite) || rx <= 0 || ry <= 0 || Math.abs(sweepAngleDeg) > 360) throw new Error('Invalid legacy ellipse dimensions or sweep')
  const start = startAngleDeg * Math.PI / 180, sweep = sweepAngleDeg * Math.PI / 180
  const base = { id: uid(), layerId, lineTypeId }
  const rotation = rotationDeg * Math.PI / 180
  if (Math.abs(rx - ry) <= 1e-10) return circularArcs(center.x, center.y, rx, start + rotation, sweep, base)
  return [{ ...base, type: 'ellipse', center, radiusX: rx, radiusY: ry, rotationDeg, startAngleDeg, sweepDeg: sweepAngleDeg }]
}
