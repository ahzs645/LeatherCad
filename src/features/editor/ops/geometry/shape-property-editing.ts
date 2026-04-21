import type { ArcShape, Point } from '../../cad/cad-types'
import { clamp, round } from '../../cad/cad-geometry'
import { circleThroughThreePoints, TAU } from './path-core'

export type ArcGeometry = {
  radiusMm: number
  sweepDeg: number
}

function normalizeAngle(angle: number) {
  return ((angle % TAU) + TAU) % TAU
}

function ccwDelta(start: number, end: number) {
  return normalizeAngle(end - start)
}

function pointOnCircle(center: Point, radius: number, angle: number): Point {
  return {
    x: round(center.x + Math.cos(angle) * radius),
    y: round(center.y + Math.sin(angle) * radius),
  }
}

function getSignedArcSweepRad(arc: ArcShape): number | null {
  const circle = circleThroughThreePoints(arc.start, arc.mid, arc.end)
  if (!circle || circle.radius < 1e-6) {
    return null
  }

  const startAngle = Math.atan2(arc.start.y - circle.center.y, arc.start.x - circle.center.x)
  const midAngle = Math.atan2(arc.mid.y - circle.center.y, arc.mid.x - circle.center.x)
  const endAngle = Math.atan2(arc.end.y - circle.center.y, arc.end.x - circle.center.x)
  const startToEndCcw = ccwDelta(startAngle, endAngle)
  const startToMidCcw = ccwDelta(startAngle, midAngle)
  return startToMidCcw <= startToEndCcw ? startToEndCcw : -(TAU - startToEndCcw)
}

export function getArcGeometry(arc: ArcShape): ArcGeometry | null {
  const circle = circleThroughThreePoints(arc.start, arc.mid, arc.end)
  const signedSweepRad = getSignedArcSweepRad(arc)
  if (!circle || signedSweepRad === null) {
    return null
  }

  return {
    radiusMm: circle.radius,
    sweepDeg: Math.abs((signedSweepRad * 180) / Math.PI),
  }
}

export function setArcGeometry(
  arc: ArcShape,
  radiusMm: number,
  sweepDeg: number,
): ArcShape | null {
  const circle = circleThroughThreePoints(arc.start, arc.mid, arc.end)
  const currentSweepRad = getSignedArcSweepRad(arc)
  if (!circle || currentSweepRad === null) {
    return null
  }
  if (!Number.isFinite(radiusMm) || radiusMm <= 0 || !Number.isFinite(sweepDeg)) {
    return null
  }

  const startAngle = Math.atan2(arc.start.y - circle.center.y, arc.start.x - circle.center.x)
  const currentDirection = currentSweepRad < 0 ? -1 : 1
  const requestedDirection = sweepDeg < 0 ? -1 : currentDirection
  const safeSweepDeg = clamp(Math.abs(sweepDeg), 0.1, 359.9)
  const signedSweepRad = requestedDirection * (safeSweepDeg * Math.PI) / 180

  return {
    ...arc,
    start: pointOnCircle(circle.center, radiusMm, startAngle),
    mid: pointOnCircle(circle.center, radiusMm, startAngle + signedSweepRad / 2),
    end: pointOnCircle(circle.center, radiusMm, startAngle + signedSweepRad),
  }
}
