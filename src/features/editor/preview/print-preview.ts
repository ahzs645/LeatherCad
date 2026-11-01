import type { Shape } from '../cad/cad-types'
import { getBounds, round } from '../cad/cad-geometry'

export type PrintPaper = 'letter' | 'a4'
export type PrintOrientation = 'portrait' | 'landscape'

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
  orientation: PrintOrientation
  paperWidthMm: number
  paperHeightMm: number
  marginMm: number
  overlapMm: number
  tileX: number
  tileY: number
  scalePercent: number
  calibrationXPercent: number
  calibrationYPercent: number
  effectiveScaleX: number
  effectiveScaleY: number
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
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
}

const PRINT_CSS_BASE_DPI = 96

export function resolvePrintCalibrationDpi(calibrationPercent: number, baseDpi = PRINT_CSS_BASE_DPI) {
  const safeCalibration = safeCalibrationPercent(calibrationPercent) / 100
  return round(baseDpi * safeCalibration)
}

function safeCalibrationPercent(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(50, Math.min(200, value)) : 100
}

function effectiveCalibration(orientation: PrintOrientation, scalePercent: number, x: number | undefined, y: number | undefined) {
  const calibrationXPercent = safeCalibrationPercent(x), calibrationYPercent = safeCalibrationPercent(y)
  return {
    calibrationXPercent, calibrationYPercent,
    effectiveScaleX: scalePercent / 100 * (orientation === 'landscape' ? calibrationYPercent : calibrationXPercent) / 100,
    effectiveScaleY: scalePercent / 100 * (orientation === 'landscape' ? calibrationXPercent : calibrationYPercent) / 100,
  }
}

function makeTiles(originX: number, originY: number, paperWidthMm: number, paperHeightMm: number, marginMm: number,
  overlapMm: number, tileX: number, tileY: number, effectiveScaleX: number, effectiveScaleY: number): PrintTile[] {
  const printableWidth = paperWidthMm - 2 * marginMm, printableHeight = paperHeightMm - 2 * marginMm
  const width = printableWidth / effectiveScaleX, height = printableHeight / effectiveScaleY
  const stepX = (printableWidth - overlapMm) / effectiveScaleX, stepY = (printableHeight - overlapMm) / effectiveScaleY
  if (![tileX, tileY].every(count => Number.isInteger(count) && count >= 1 && count <= 25)) throw new Error('Printing supports 1–25 pages per axis')
  const tiles: PrintTile[] = []
  for (let row = 0; row < tileY; row++) for (let col = 0; col < tileX; col++) tiles.push({
    id: `tile-${row}-${col}`, row, col, minX: originX + col * stepX, minY: originY + row * stepY, width, height,
  })
  return tiles
}

/** Rebuild world coverage from physical page settings, without accumulating calibration. */
export function applyPrintCalibration(plan: PrintPlan, calibrationXPercent: number, calibrationYPercent: number): PrintPlan {
  const calibration = effectiveCalibration(plan.orientation, plan.scalePercent, calibrationXPercent, calibrationYPercent)
  return { ...plan, ...calibration, tiles: makeTiles(plan.tiles[0]?.minX ?? plan.sourceBounds.minX,
    plan.tiles[0]?.minY ?? plan.sourceBounds.minY, plan.paperWidthMm, plan.paperHeightMm, plan.marginMm,
    plan.overlapMm, plan.tileX, plan.tileY, calibration.effectiveScaleX, calibration.effectiveScaleY) }
}

export function buildPrintPlan(
  shapes: Shape[],
  options: {
    paper: PrintPaper
    orientation?: PrintOrientation
    marginMm: number
    overlapMm: number
    tileX: number
    tileY: number
    scalePercent: number
    calibrationXPercent?: number
    calibrationYPercent?: number
  },
): PrintPlan | null {
  if (shapes.length === 0) {
    return null
  }

  const bounds = getBounds(shapes, 0)
  const safeTileX = Math.max(1, Math.min(25, Math.round(Number.isFinite(options.tileX) ? options.tileX : 1)))
  const safeTileY = Math.max(1, Math.min(25, Math.round(Number.isFinite(options.tileY) ? options.tileY : 1)))
  const safeScale = Math.max(1, Number.isFinite(options.scalePercent) ? options.scalePercent : 100)
  const orientation: PrintOrientation = options.orientation ?? 'portrait'
  const rawPaperSize = PAPER_SIZES_MM[options.paper]
  const paperSize =
    orientation === 'landscape'
      ? { width: rawPaperSize.height, height: rawPaperSize.width }
      : rawPaperSize
  const safeMargin = Math.min(Math.max(0, options.marginMm), (Math.min(paperSize.width, paperSize.height) - 1) / 2)
  const printableWidth = paperSize.width - safeMargin * 2
  const printableHeight = paperSize.height - safeMargin * 2
  const safeOverlap = Math.min(Math.max(0, options.overlapMm), Math.min(printableWidth, printableHeight) - 1)

  const calibration = effectiveCalibration(orientation, safeScale, options.calibrationXPercent, options.calibrationYPercent)
  const contentWidthMm = Math.max(1, (paperSize.width - safeMargin * 2) * safeTileX - safeOverlap * (safeTileX - 1))
  const contentHeightMm = Math.max(1, (paperSize.height - safeMargin * 2) * safeTileY - safeOverlap * (safeTileY - 1))
  const sourceWidth = Math.max(bounds.width, 1)
  const sourceHeight = Math.max(bounds.height, 1)
  // Paper and overlap stay in physical mm; each axis maps source mm through
  // user scale and its orientation-adjusted printer calibration exactly once.
  const tiles = makeTiles(bounds.minX, bounds.minY, paperSize.width, paperSize.height,
    safeMargin, safeOverlap, safeTileX, safeTileY, calibration.effectiveScaleX, calibration.effectiveScaleY)

  return {
    paper: options.paper,
    orientation,
    paperWidthMm: paperSize.width,
    paperHeightMm: paperSize.height,
    marginMm: safeMargin,
    overlapMm: safeOverlap,
    tileX: safeTileX,
    tileY: safeTileY,
    scalePercent: safeScale,
    ...calibration,
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
