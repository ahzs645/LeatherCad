import type { Point, TextShape } from '../cad/cad-types'

const MIN_FONT_SIZE_MM = 2
const MAX_FONT_SIZE_MM = 120
const MIN_RADIUS_MM = 2
const MAX_RADIUS_MM = 2000
const DEFAULT_FONT_SIZE_MM = 12
const DEFAULT_RADIUS_MM = 40
const DEFAULT_SWEEP_ARCH_DEG = 140

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI
}

function safeDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function normalizeText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : 'Text'
}

export function estimateTextWidthMm(text: string, fontSizeMm: number) {
  const safeText = normalizeText(text)
  const safeFontSizeMm = clamp(fontSizeMm || DEFAULT_FONT_SIZE_MM, MIN_FONT_SIZE_MM, MAX_FONT_SIZE_MM)
  return Math.max(safeFontSizeMm * 0.8, safeText.length * safeFontSizeMm * 0.62)
}

export function normalizeTextShape(shape: TextShape): TextShape {
  const normalizedText = normalizeText(shape.text)
  const fontSizeMm = clamp(shape.fontSizeMm || DEFAULT_FONT_SIZE_MM, MIN_FONT_SIZE_MM, MAX_FONT_SIZE_MM)
  const baseLength = safeDistance(shape.start, shape.end)
  const minLength = estimateTextWidthMm(normalizedText, fontSizeMm)
  const safeEnd =
    baseLength > 1e-6
      ? shape.end
      : {
          x: shape.start.x + minLength,
          y: shape.start.y,
        }
  const safeTransform = shape.transform === 'arch' || shape.transform === 'ring' ? shape.transform : 'none'
  const radiusMm = clamp(shape.radiusMm || DEFAULT_RADIUS_MM, MIN_RADIUS_MM, MAX_RADIUS_MM)
  const sweepDeg =
    safeTransform === 'ring'
      ? Math.abs(shape.sweepDeg || 360) < 1 ? 360 : clamp(shape.sweepDeg, -1080, 1080)
      : Math.abs(shape.sweepDeg || DEFAULT_SWEEP_ARCH_DEG) < 1
        ? DEFAULT_SWEEP_ARCH_DEG
        : clamp(shape.sweepDeg, -720, 720)

  return {
    ...shape,
    text: normalizedText,
    fontSizeMm,
    transform: safeTransform,
    radiusMm,
    sweepDeg,
    end: safeEnd,
  }
}

export function textBaselineDirection(shape: TextShape) {
  const normalized = normalizeTextShape(shape)
  const dx = normalized.end.x - normalized.start.x
  const dy = normalized.end.y - normalized.start.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return { x: 1, y: 0 }
  }
  return { x: dx / length, y: dy / length }
}

export function textBaselineAngleDeg(shape: TextShape) {
  const direction = textBaselineDirection(shape)
  return toDegrees(Math.atan2(direction.y, direction.x))
}

export type TextGlyphPlacement = {
  char: string
  x: number
  y: number
  rotationDeg: number
}

export function buildTextGlyphPlacements(shape: TextShape): TextGlyphPlacement[] {
  const normalized = normalizeTextShape(shape)
  const content = normalized.text
  if (content.length === 0) {
    return []
  }

  const baseAngleDeg = textBaselineAngleDeg(normalized)
  if (normalized.transform === 'none') {
    return []
  }

  const safeSweep = normalized.transform === 'ring' ? normalized.sweepDeg || 360 : normalized.sweepDeg || DEFAULT_SWEEP_ARCH_DEG
  const center = normalized.start
  const radius = clamp(normalized.radiusMm || DEFAULT_RADIUS_MM, MIN_RADIUS_MM, MAX_RADIUS_MM)
  const denominator = Math.max(content.length - 1, 1)
  const placements: TextGlyphPlacement[] = []

  for (let index = 0; index < content.length; index += 1) {
    const t = content.length === 1 ? 0.5 : index / denominator
    const angleDeg = baseAngleDeg - safeSweep / 2 + safeSweep * t
    const radians = toRadians(angleDeg)
    placements.push({
      char: content[index],
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
      rotationDeg: angleDeg + 90,
    })
  }

  return placements
}

function rotatePoint(origin: Point, point: Point, angleDeg: number) {
  const radians = toRadians(angleDeg)
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

export function sampleTextShapePoints(shape: TextShape, segments = 24) {
  const normalized = normalizeTextShape(shape)
  const baselineAngle = textBaselineAngleDeg(normalized)
  const width = Math.max(safeDistance(normalized.start, normalized.end), estimateTextWidthMm(normalized.text, normalized.fontSizeMm))
  const height = normalized.fontSizeMm

  if (normalized.transform === 'none') {
    const localCorners: Point[] = [
      { x: normalized.start.x, y: normalized.start.y },
      { x: normalized.start.x + width, y: normalized.start.y },
      { x: normalized.start.x + width, y: normalized.start.y - height },
      { x: normalized.start.x, y: normalized.start.y - height },
    ]
    return localCorners.map((point) => rotatePoint(normalized.start, point, baselineAngle))
  }

  const center = normalized.start
  const safeSweep = normalized.transform === 'ring' ? normalized.sweepDeg || 360 : normalized.sweepDeg || DEFAULT_SWEEP_ARCH_DEG
  const outer = normalized.radiusMm + normalized.fontSizeMm * 0.65
  const inner = Math.max(1, normalized.radiusMm - normalized.fontSizeMm * 0.65)
  const points: Point[] = []
  const safeSegments = Math.max(8, segments)

  for (let index = 0; index <= safeSegments; index += 1) {
    const t = index / safeSegments
    const angleDeg = baselineAngle - safeSweep / 2 + safeSweep * t
    const radians = toRadians(angleDeg)
    points.push({
      x: center.x + Math.cos(radians) * outer,
      y: center.y + Math.sin(radians) * outer,
    })
  }

  for (let index = safeSegments; index >= 0; index -= 1) {
    const t = index / safeSegments
    const angleDeg = baselineAngle - safeSweep / 2 + safeSweep * t
    const radians = toRadians(angleDeg)
    points.push({
      x: center.x + Math.cos(radians) * inner,
      y: center.y + Math.sin(radians) * inner,
    })
  }

  return points
}

