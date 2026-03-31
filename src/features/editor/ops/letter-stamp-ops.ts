import type { Point, LineShape, TextShape } from '../cad/cad-types'
import { uid, round } from '../cad/cad-geometry'

export type LetterStampParams = {
  text: string
  stampSizeMm: number
  spacingMm: number
  lineSpacingMm: number
  alignment: 'left' | 'center' | 'right'
  baselineAngleDeg: number
  origin: Point
  fontFamily: string
  layerId: string
  lineTypeId: string
}

export type StampPlacement = {
  character: string
  center: Point
  index: number
  row: number
  column: number
}

export type LetterStampResult = {
  placements: StampPlacement[]
  textShapes: TextShape[]
  guideLines: LineShape[]
  boundingBox: { x: number; y: number; width: number; height: number }
}

export function getDefaultLetterStampParams(): LetterStampParams {
  return {
    text: 'LEATHER',
    stampSizeMm: 10,
    spacingMm: 2,
    lineSpacingMm: 4,
    alignment: 'center',
    baselineAngleDeg: 0,
    origin: { x: 0, y: 0 },
    fontFamily: 'serif',
    layerId: '',
    lineTypeId: '',
  }
}

function rotatePoint(point: Point, origin: Point, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: round(origin.x + dx * cos - dy * sin),
    y: round(origin.y + dx * sin + dy * cos),
  }
}

export function computeStampPlacements(params: LetterStampParams): StampPlacement[] {
  const { text, stampSizeMm, spacingMm, lineSpacingMm, alignment, baselineAngleDeg, origin } = params
  const lines = text.split('\n')
  const placements: StampPlacement[] = []
  let globalIndex = 0

  const maxLineWidth = lines.reduce((max, line) => {
    const charCount = line.length
    if (charCount === 0) return max
    const width = charCount * stampSizeMm + (charCount - 1) * spacingMm
    return Math.max(max, width)
  }, 0)

  for (let row = 0; row < lines.length; row++) {
    const line = lines[row]
    const charCount = line.length
    if (charCount === 0) continue

    const lineWidth = charCount * stampSizeMm + (charCount - 1) * spacingMm

    let alignmentOffset = 0
    if (alignment === 'center') {
      alignmentOffset = (maxLineWidth - lineWidth) / 2
    } else if (alignment === 'right') {
      alignmentOffset = maxLineWidth - lineWidth
    }

    for (let column = 0; column < charCount; column++) {
      const character = line[column]

      if (character === ' ') {
        globalIndex++
        continue
      }

      const x = origin.x + column * (stampSizeMm + spacingMm) + stampSizeMm / 2 + alignmentOffset
      const y = origin.y + row * (stampSizeMm + lineSpacingMm) + stampSizeMm / 2

      let center: Point = { x: round(x), y: round(y) }

      if (baselineAngleDeg !== 0) {
        center = rotatePoint(center, origin, baselineAngleDeg)
      }

      placements.push({
        character,
        center,
        index: globalIndex,
        row,
        column,
      })

      globalIndex++
    }
  }

  return placements
}

export function generateLetterStampPreview(params: LetterStampParams): LetterStampResult {
  const placements = computeStampPlacements(params)

  const textShapes: TextShape[] = placements.map((placement) => ({
    id: uid(),
    type: 'text' as const,
    layerId: params.layerId,
    lineTypeId: params.lineTypeId,
    start: {
      x: round(placement.center.x - params.stampSizeMm / 2),
      y: round(placement.center.y + params.stampSizeMm / 2),
    },
    end: {
      x: round(placement.center.x + params.stampSizeMm / 2),
      y: round(placement.center.y + params.stampSizeMm / 2),
    },
    text: placement.character,
    fontFamily: params.fontFamily,
    fontSizeMm: round(params.stampSizeMm * 0.8),
    transform: 'none' as const,
    radiusMm: 0,
    sweepDeg: 0,
  }))

  const guideLines = generateGuideLines(placements, params)
  const boundingBox = computeBoundingBox(placements, params.stampSizeMm)

  return {
    placements,
    textShapes,
    guideLines,
    boundingBox,
  }
}

function generateGuideLines(placements: StampPlacement[], params: LetterStampParams): LineShape[] {
  const lines: LineShape[] = []

  if (placements.length === 0) return lines

  const rows = new Map<number, StampPlacement[]>()
  for (const p of placements) {
    const existing = rows.get(p.row)
    if (existing) {
      existing.push(p)
    } else {
      rows.set(p.row, [p])
    }
  }

  let globalMinX = Number.POSITIVE_INFINITY
  let globalMaxX = Number.NEGATIVE_INFINITY

  rows.forEach((rowPlacements) => {
    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let baselineY = 0

    for (const p of rowPlacements) {
      const left = p.center.x - params.stampSizeMm / 2
      const right = p.center.x + params.stampSizeMm / 2
      minX = Math.min(minX, left)
      maxX = Math.max(maxX, right)
      baselineY = p.center.y + params.stampSizeMm / 2
    }

    globalMinX = Math.min(globalMinX, minX)
    globalMaxX = Math.max(globalMaxX, maxX)

    lines.push({
      id: uid(),
      type: 'line',
      layerId: params.layerId,
      lineTypeId: params.lineTypeId,
      start: { x: round(minX), y: round(baselineY) },
      end: { x: round(maxX), y: round(baselineY) },
    })
  })

  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const p of placements) {
    minY = Math.min(minY, p.center.y - params.stampSizeMm / 2)
    maxY = Math.max(maxY, p.center.y + params.stampSizeMm / 2)
  }

  lines.push({
    id: uid(),
    type: 'line',
    layerId: params.layerId,
    lineTypeId: params.lineTypeId,
    start: { x: round(globalMinX), y: round(minY) },
    end: { x: round(globalMinX), y: round(maxY) },
  })

  lines.push({
    id: uid(),
    type: 'line',
    layerId: params.layerId,
    lineTypeId: params.lineTypeId,
    start: { x: round(globalMaxX), y: round(minY) },
    end: { x: round(globalMaxX), y: round(maxY) },
  })

  return lines
}

function computeBoundingBox(
  placements: StampPlacement[],
  stampSizeMm: number,
): { x: number; y: number; width: number; height: number } {
  if (placements.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const half = stampSizeMm / 2
  for (const p of placements) {
    minX = Math.min(minX, p.center.x - half)
    minY = Math.min(minY, p.center.y - half)
    maxX = Math.max(maxX, p.center.x + half)
    maxY = Math.max(maxY, p.center.y + half)
  }

  return {
    x: round(minX),
    y: round(minY),
    width: round(maxX - minX),
    height: round(maxY - minY),
  }
}

export function generateStampGridLines(
  placements: StampPlacement[],
  stampSizeMm: number,
  layerId: string,
  lineTypeId: string,
): LineShape[] {
  const lines: LineShape[] = []
  const half = stampSizeMm / 2

  for (const placement of placements) {
    const cx = placement.center.x
    const cy = placement.center.y

    const topLeft: Point = { x: round(cx - half), y: round(cy - half) }
    const topRight: Point = { x: round(cx + half), y: round(cy - half) }
    const bottomRight: Point = { x: round(cx + half), y: round(cy + half) }
    const bottomLeft: Point = { x: round(cx - half), y: round(cy + half) }

    lines.push({
      id: uid(),
      type: 'line',
      layerId,
      lineTypeId,
      start: topLeft,
      end: topRight,
    })

    lines.push({
      id: uid(),
      type: 'line',
      layerId,
      lineTypeId,
      start: topRight,
      end: bottomRight,
    })

    lines.push({
      id: uid(),
      type: 'line',
      layerId,
      lineTypeId,
      start: bottomRight,
      end: bottomLeft,
    })

    lines.push({
      id: uid(),
      type: 'line',
      layerId,
      lineTypeId,
      start: bottomLeft,
      end: topLeft,
    })
  }

  return lines
}
