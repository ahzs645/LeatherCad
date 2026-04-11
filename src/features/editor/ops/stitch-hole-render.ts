import type { Point, StitchHole, StitchHoleRenderShape } from '../cad/cad-types'

export type StitchHoleRenderMode = 'native' | 'dots' | 'single-lines'

export type StitchHolePrimitive =
  | {
      kind: 'circle'
      center: Point
      radiusMm: number
    }
  | {
      kind: 'segment'
      start: Point
      end: Point
      strokeWidthMm: number
    }
  | {
      kind: 'polygon'
      points: Point[]
    }

function rotateVector(x: number, y: number, angleDeg: number) {
  const radians = (angleDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

function translate(point: Point, delta: { x: number; y: number }): Point {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y,
  }
}

export function resolveStitchHoleRenderShape(stitchHole: StitchHole): StitchHoleRenderShape {
  if (
    stitchHole.renderShape === 'round' ||
    stitchHole.renderShape === 'slit' ||
    stitchHole.renderShape === 'diamond' ||
    stitchHole.renderShape === 'french' ||
    stitchHole.renderShape === 'flat'
  ) {
    return stitchHole.renderShape
  }
  return stitchHole.holeType === 'round' ? 'round' : 'slit'
}

export function resolveStitchHoleRenderAngleDeg(stitchHole: StitchHole) {
  const tilt = Number.isFinite(stitchHole.tiltDeg) ? stitchHole.tiltDeg ?? 0 : 0
  return stitchHole.angleDeg + (stitchHole.inverted ? -tilt : tilt)
}

export function resolveStitchHoleWidthMm(stitchHole: StitchHole) {
  if (Number.isFinite(stitchHole.widthMm) && (stitchHole.widthMm ?? 0) > 0) {
    return stitchHole.widthMm ?? 0
  }
  if (resolveStitchHoleRenderShape(stitchHole) === 'round') {
    return Math.max(0.6, stitchHole.diameterMm ?? 1.2)
  }
  return 1.1
}

export function resolveStitchHoleHeightMm(stitchHole: StitchHole) {
  if (Number.isFinite(stitchHole.heightMm) && (stitchHole.heightMm ?? 0) > 0) {
    return stitchHole.heightMm ?? 0
  }
  if (resolveStitchHoleRenderShape(stitchHole) === 'round') {
    return Math.max(0.6, stitchHole.diameterMm ?? 1.2)
  }
  return 3.4
}

export function resolveStitchHoleRadiusMm(stitchHole: StitchHole, fallbackDotRadiusMm = 0.6) {
  if (resolveStitchHoleRenderShape(stitchHole) === 'round') {
    const diameter = stitchHole.diameterMm ?? stitchHole.widthMm ?? stitchHole.heightMm
    return Math.max(0.2, (diameter ?? fallbackDotRadiusMm * 2) / 2)
  }
  return Math.max(0.2, fallbackDotRadiusMm)
}

function createSegmentPrimitive(stitchHole: StitchHole): StitchHolePrimitive {
  const angle = resolveStitchHoleRenderAngleDeg(stitchHole)
  const halfLength = Math.max(0.25, resolveStitchHoleHeightMm(stitchHole) / 2)
  const delta = rotateVector(halfLength, 0, angle)
  return {
    kind: 'segment',
    start: translate(stitchHole.point, { x: -delta.x, y: -delta.y }),
    end: translate(stitchHole.point, delta),
    strokeWidthMm: Math.max(0.2, resolveStitchHoleWidthMm(stitchHole)),
  }
}

function createDiamondPrimitive(stitchHole: StitchHole): StitchHolePrimitive {
  const angle = resolveStitchHoleRenderAngleDeg(stitchHole)
  const halfWidth = Math.max(0.2, resolveStitchHoleWidthMm(stitchHole) / 2)
  const halfHeight = Math.max(0.2, resolveStitchHoleHeightMm(stitchHole) / 2)
  const offsets = [
    rotateVector(0, -halfHeight, angle),
    rotateVector(halfWidth, 0, angle),
    rotateVector(0, halfHeight, angle),
    rotateVector(-halfWidth, 0, angle),
  ]
  return {
    kind: 'polygon',
    points: offsets.map((offset) => translate(stitchHole.point, offset)),
  }
}

export function createStitchHolePrimitive(
  stitchHole: StitchHole,
  options: {
    mode?: StitchHoleRenderMode
    dotRadiusMm?: number
  } = {},
): StitchHolePrimitive {
  const mode = options.mode ?? 'native'
  if (mode === 'dots') {
    return {
      kind: 'circle',
      center: stitchHole.point,
      radiusMm: resolveStitchHoleRadiusMm(stitchHole, options.dotRadiusMm ?? 0.6),
    }
  }

  if (mode === 'single-lines') {
    return createSegmentPrimitive(stitchHole)
  }

  const renderShape = resolveStitchHoleRenderShape(stitchHole)
  if (renderShape === 'round') {
    return {
      kind: 'circle',
      center: stitchHole.point,
      radiusMm: resolveStitchHoleRadiusMm(stitchHole, options.dotRadiusMm ?? 0.6),
    }
  }

  if (renderShape === 'diamond') {
    return createDiamondPrimitive(stitchHole)
  }

  return createSegmentPrimitive(stitchHole)
}
