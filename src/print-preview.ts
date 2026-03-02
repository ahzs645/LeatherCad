import type { Shape } from './cad-types'
import { getBounds, round } from './cad-geometry'

export type PrintPaper = 'letter' | 'a4'

export type PrintTile = {
  id: string
  row: number
  col: number
  minX: number
  minY: number
  width: number
  height: number
}

export type PrintPlan = {
  paper: PrintPaper
  paperWidthMm: number
  paperHeightMm: number
  marginMm: number
  overlapMm: number
  tileX: number
  tileY: number
  scalePercent: number
  contentWidthMm: number
  contentHeightMm: number
  sourceBounds: {
    minX: number
    minY: number
    width: number
    height: number
  }
  tiles: PrintTile[]
}

const PAPER_SIZES_MM: Record<PrintPaper, { width: number; height: number }> = {
  letter: { width: 216, height: 279 },
  a4: { width: 210, height: 297 },
}

export function buildPrintPlan(
  shapes: Shape[],
  options: {
    paper: PrintPaper
    marginMm: number
    overlapMm: number
    tileX: number
    tileY: number
    scalePercent: number
  },
): PrintPlan | null {
  if (shapes.length === 0) {
    return null
  }

  const bounds = getBounds(shapes)
  const safeTileX = Math.max(1, Math.round(options.tileX))
  const safeTileY = Math.max(1, Math.round(options.tileY))
  const safeScale = Math.max(1, options.scalePercent)
  const safeMargin = Math.max(0, options.marginMm)
  const safeOverlap = Math.max(0, options.overlapMm)
  const paperSize = PAPER_SIZES_MM[options.paper]

  const scaleFactor = safeScale / 100
  const contentWidthMm = Math.max(1, (paperSize.width - safeMargin * 2) * safeTileX - safeOverlap * (safeTileX - 1))
  const contentHeightMm = Math.max(1, (paperSize.height - safeMargin * 2) * safeTileY - safeOverlap * (safeTileY - 1))
  const worldCoverageWidth = contentWidthMm / scaleFactor
  const worldCoverageHeight = contentHeightMm / scaleFactor

  const sourceWidth = Math.max(bounds.width, 1)
  const sourceHeight = Math.max(bounds.height, 1)
  const widthScale = worldCoverageWidth / sourceWidth
  const heightScale = worldCoverageHeight / sourceHeight

  const normalizedWidth = sourceWidth * Math.min(widthScale, 1)
  const normalizedHeight = sourceHeight * Math.min(heightScale, 1)
  const tileWorldWidth = normalizedWidth / safeTileX
  const tileWorldHeight = normalizedHeight / safeTileY
  const overlapWorld = safeOverlap / scaleFactor

  const tiles: PrintTile[] = []
  for (let row = 0; row < safeTileY; row += 1) {
    for (let col = 0; col < safeTileX; col += 1) {
      tiles.push({
        id: `tile-${row}-${col}`,
        row,
        col,
        minX: round(bounds.minX + col * tileWorldWidth - (col > 0 ? overlapWorld : 0)),
        minY: round(bounds.minY + row * tileWorldHeight - (row > 0 ? overlapWorld : 0)),
        width: round(tileWorldWidth + (col > 0 ? overlapWorld : 0)),
        height: round(tileWorldHeight + (row > 0 ? overlapWorld : 0)),
      })
    }
  }

  return {
    paper: options.paper,
    paperWidthMm: paperSize.width,
    paperHeightMm: paperSize.height,
    marginMm: safeMargin,
    overlapMm: safeOverlap,
    tileX: safeTileX,
    tileY: safeTileY,
    scalePercent: safeScale,
    contentWidthMm: round(contentWidthMm),
    contentHeightMm: round(contentHeightMm),
    sourceBounds: {
      minX: round(bounds.minX),
      minY: round(bounds.minY),
      width: round(sourceWidth),
      height: round(sourceHeight),
    },
    tiles,
  }
}
