import { isNativeCurve, nativeCurvePath } from '../cad/native-curve-ops'
import { arcPath, round } from '../cad/cad-geometry'
import { resolveLineTypeStrokeWidthMm, shouldIgnoreLineTypeInPrint } from '../cad/line-types'
import type { FoldLine, LineType, Shape, StitchHole } from '../cad/cad-types'
import { createStitchHolePrimitive } from '../ops/stitch-hole-render'
import { applyPrintCalibration, resolvePrintCalibrationDpi, type PrintPlan } from './print-preview'
import { buildTextGlyphPlacements, normalizeTextShape, textBaselineAngleDeg } from '../ops/text-shape-ops'

type PrintTileOutputOptions = {
  shapes: Shape[]
  stitchHoles: StitchHole[]
  foldLines: FoldLine[]
  lineTypesById: Record<string, LineType>
  printPlan: PrintPlan
  printInColor: boolean
  printStitchAsDots: boolean
  lineThicknessScalePercent: number
  showIgnoredLineTypes: boolean
  printRulerInside: boolean
  calibrationXPercent: number
  calibrationYPercent: number
}

function escapeXml(value: string) {
  return value.replace(/[<>&"]/g, (char) => {
    if (char === '<') {
      return '&lt;'
    }
    if (char === '>') {
      return '&gt;'
    }
    if (char === '&') {
      return '&amp;'
    }
    return '&quot;'
  })
}

const MAX_PRINT_ITEMS = 1_000_000
const MAX_PRINT_HTML_BYTES = 32 * 1024 * 1024
const PRINT_BUDGET_ERROR = 'Printable output exceeds the processing budget (625 pages, 1,000,000 items or 32 MiB HTML). Reduce the page count or print a smaller selection.'

function safePrintColor(value: string | undefined) {
  if (!value || value.length > 100 || !/^(?:#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([0-9+.,%/\s-]+\))$/i.test(value)) return '#111827'
  return escapeXml(value)
}

function checkPrintBudget(options: PrintTileOutputOptions) {
  const { tileX, tileY } = options.printPlan
  const pages = tileX * tileY
  const objects = options.shapes.length + options.stitchHoles.length + options.foldLines.length
  if (![tileX, tileY].every(count => Number.isInteger(count) && count >= 1 && count <= 25) || pages > 625 || options.printPlan.tiles.length > 625 || objects > 200000 || pages * objects > MAX_PRINT_ITEMS) throw new Error(PRINT_BUDGET_ERROR)
  let items = objects, markupBytes = 2048 + options.stitchHoles.length * 512 + options.foldLines.length * 256
  for (const shape of options.shapes) {
    if (shape.type === 'text') {
      const characters = shape.text.length, fontCharacters = shape.fontFamily.length
      items += shape.transform === 'none' ? Math.ceil(characters / 20) : characters
      markupBytes += shape.transform === 'none' ? 400 + (characters + fontCharacters) * 6 : characters * (400 + fontCharacters * 6)
    } else markupBytes += 256
  }
  if (options.printRulerInside) {
    const first = options.printPlan.tiles[0]
    const ticks = first ? Math.ceil(first.width / 10) + Math.ceil(first.height / 10) + 2 : 0
    items += ticks; markupBytes += ticks * 192
  }
  if (pages * items > MAX_PRINT_ITEMS || pages * markupBytes > MAX_PRINT_HTML_BYTES) throw new Error(PRINT_BUDGET_ERROR)
}

function resolveStroke(shape: Shape, lineTypesById: Record<string, LineType>, printInColor: boolean) {
  const lineType = lineTypesById[shape.lineTypeId]
  if (!lineType || !printInColor) {
    return '#111827'
  }
  return safePrintColor(lineType.color)
}

function resolveDash(shape: Shape, lineTypesById: Record<string, LineType>, printStitchAsDots: boolean) {
  const lineType = lineTypesById[shape.lineTypeId]
  if (lineType?.role === 'stitch' && printStitchAsDots) {
    return '1.4 3.2'
  }
  if (lineType?.style === 'dashed') {
    return '8 5'
  }
  if (lineType?.style === 'dotted') {
    return '2 5'
  }
  return ''
}

function shouldPrintShape(shape: Shape, lineTypesById: Record<string, LineType>, showIgnoredLineTypes: boolean) {
  return showIgnoredLineTypes || !shouldIgnoreLineTypeInPrint(lineTypesById[shape.lineTypeId])
}

function resolveStrokeWidth(shape: Shape, lineTypesById: Record<string, LineType>, lineThicknessScalePercent: number) {
  const shapeStrokeWidth =
    'strokeWidthOverride' in shape && typeof shape.strokeWidthOverride === 'number'
      ? shape.strokeWidthOverride
      : undefined
  const baseStrokeWidth = shapeStrokeWidth ?? resolveLineTypeStrokeWidthMm(lineTypesById[shape.lineTypeId])
  return baseStrokeWidth * Math.max(0.05, lineThicknessScalePercent / 100)
}

function arrowAttrs(shape: Shape) {
  const parts: string[] = []
  if ('arrowStart' in shape && shape.arrowStart) parts.push('marker-start="url(#arrow-start)"')
  if ('arrowEnd' in shape && shape.arrowEnd) parts.push('marker-end="url(#arrow-end)"')
  return parts.length > 0 ? ' ' + parts.join(' ') : ''
}

function shapeToSvgMarkup(
  shape: Shape,
  lineTypesById: Record<string, LineType>,
  options: { printInColor: boolean; printStitchAsDots: boolean; lineThicknessScalePercent: number; showIgnoredLineTypes: boolean },
) {
  const lineType = lineTypesById[shape.lineTypeId]
  const stroke = resolveStroke(shape, lineTypesById, options.printInColor)
  const dash = resolveDash(shape, lineTypesById, options.printStitchAsDots)
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ''
  const arrows = arrowAttrs(shape)
  const strokeWidth = round(resolveStrokeWidth(shape, lineTypesById, options.lineThicknessScalePercent))
  const opacity = (shape.opacity ?? 1) * (options.showIgnoredLineTypes && shouldIgnoreLineTypeInPrint(lineType) ? 0.35 : 1)
  const ignoredAttr = `${opacity !== 1 ? ` opacity="${opacity}"` : ''}${options.showIgnoredLineTypes && shouldIgnoreLineTypeInPrint(lineType) ? ' data-non-print="true"' : ''}`

  if (isNativeCurve(shape)) return `<path d="${nativeCurvePath(shape)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr}${arrows}${ignoredAttr} />`
  if (shape.type === 'line') {
    return `<line x1="${round(shape.start.x)}" y1="${round(shape.start.y)}" x2="${round(shape.end.x)}" y2="${round(shape.end.y)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr}${arrows}${ignoredAttr} />`
  }

  if (shape.type === 'arc') {
    return `<path d="${arcPath(shape.start, shape.mid, shape.end)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr}${arrows}${ignoredAttr} />`
  }

  if (shape.type === 'bezier') {
    return `<path d="M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(shape.end.x)} ${round(shape.end.y)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttr}${arrows}${ignoredAttr} />`
  }

  const textShape = normalizeTextShape(shape)
  const fontFamily = escapeXml(textShape.fontFamily)
  const textValue = escapeXml(textShape.text)
  const fontSize = round(textShape.fontSizeMm)
  if (textShape.transform === 'none') {
    const angle = round(textBaselineAngleDeg(textShape))
    return `<text x="${round(textShape.start.x)}" y="${round(textShape.start.y)}" fill="${stroke}" font-size="${fontSize}" font-family="${fontFamily}" transform="rotate(${angle} ${round(textShape.start.x)} ${round(textShape.start.y)})"${ignoredAttr}>${textValue}</text>`
  }
  return buildTextGlyphPlacements(textShape)
    .map(
      (glyph) =>
        `<text x="${round(glyph.x)}" y="${round(glyph.y)}" text-anchor="middle" dominant-baseline="middle" fill="${stroke}" font-size="${fontSize}" font-family="${fontFamily}" transform="rotate(${round(glyph.rotationDeg)} ${round(glyph.x)} ${round(glyph.y)})"${ignoredAttr}>${escapeXml(glyph.char)}</text>`,
    )
    .join('')
}

function stitchHoleToSvgMarkup(
  stitchHole: StitchHole,
  shapesById: Record<string, Shape | undefined>,
  lineTypesById: Record<string, LineType>,
  options: { printInColor: boolean; printStitchAsDots: boolean; lineThicknessScalePercent: number },
) {
  const parentShape = shapesById[stitchHole.shapeId]
  if (!parentShape || shouldIgnoreLineTypeInPrint(lineTypesById[parentShape.lineTypeId])) {
    return ''
  }

  const lineType = lineTypesById[parentShape.lineTypeId]
  const color = options.printInColor ? safePrintColor(lineType?.color) : '#111827'
  const primitive = createStitchHolePrimitive(stitchHole, {
    mode: options.printStitchAsDots ? 'dots' : 'native',
    dotRadiusMm: 0.6,
  })

  if (primitive.kind === 'circle') {
    return `<circle cx="${round(primitive.center.x)}" cy="${round(primitive.center.y)}" r="${round(primitive.radiusMm)}" fill="${color}" data-type="stitch-hole" />`
  }

  if (primitive.kind === 'segment') {
    const strokeWidth = round(Math.max(0.2, primitive.strokeWidthMm * Math.max(0.05, options.lineThicknessScalePercent / 100)))
    return `<line x1="${round(primitive.start.x)}" y1="${round(primitive.start.y)}" x2="${round(primitive.end.x)}" y2="${round(primitive.end.y)}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" data-type="stitch-hole" />`
  }

  const strokeWidth = round(Math.max(0.2, (stitchHole.widthMm ?? 0.9) * Math.max(0.05, options.lineThicknessScalePercent / 100)))
  return `<polygon points="${primitive.points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linejoin="round" data-type="stitch-hole" />`
}

function foldLineMarkup(foldLine: FoldLine, printInColor: boolean) {
  const color = printInColor ? '#dc2626' : '#6b7280'
  return `<line x1="${round(foldLine.start.x)}" y1="${round(foldLine.start.y)}" x2="${round(foldLine.end.x)}" y2="${round(foldLine.end.y)}" stroke="${color}" stroke-width="0.6" stroke-dasharray="6 3" fill="none" />`
}

function rulerMarkup(tile: { minX: number; minY: number; width: number; height: number }) {
  const ticks: string[] = []
  const step = 10
  for (let index = 0; index <= Math.floor(tile.width / step); index++) {
    const x = tile.minX + index * step
    ticks.push(
      `<line x1="${round(x)}" y1="${round(tile.minY)}" x2="${round(x)}" y2="${round(tile.minY + 2)}" stroke="#4b5563" stroke-width="0.3" />`,
    )
  }
  for (let index = 0; index <= Math.floor(tile.height / step); index++) {
    const y = tile.minY + index * step
    ticks.push(
      `<line x1="${round(tile.minX)}" y1="${round(y)}" x2="${round(tile.minX + 2)}" y2="${round(y)}" stroke="#4b5563" stroke-width="0.3" />`,
    )
  }
  return ticks.join('\n')
}

function tileSvg(options: PrintTileOutputOptions, tile: PrintPlan['tiles'][number]) {
  const shapeMarkup = options.shapes
    .filter((shape) => shouldPrintShape(shape, options.lineTypesById, options.showIgnoredLineTypes))
    .map((shape) =>
      shapeToSvgMarkup(shape, options.lineTypesById, {
        printInColor: options.printInColor,
        printStitchAsDots: options.printStitchAsDots,
        lineThicknessScalePercent: options.lineThicknessScalePercent,
        showIgnoredLineTypes: options.showIgnoredLineTypes,
      }),
    )
    .join('\n')
  const shapesById = Object.fromEntries(options.shapes.map((shape) => [shape.id, shape] as const))
  const stitchHoleMarkup = options.stitchHoles
    .map((stitchHole) =>
      stitchHoleToSvgMarkup(stitchHole, shapesById, options.lineTypesById, {
        printInColor: options.printInColor,
        printStitchAsDots: options.printStitchAsDots,
        lineThicknessScalePercent: options.lineThicknessScalePercent,
      }),
    )
    .filter((markup) => markup.length > 0)
    .join('\n')
  const foldMarkup = options.foldLines.map((foldLine) => foldLineMarkup(foldLine, options.printInColor)).join('\n')
  const ruler = options.printRulerInside ? rulerMarkup(tile) : ''

  const { paperWidthMm, paperHeightMm, marginMm } = options.printPlan
  return `<svg class="print-svg" xmlns="http://www.w3.org/2000/svg" width="${paperWidthMm}mm" height="${paperHeightMm}mm" viewBox="0 0 ${paperWidthMm} ${paperHeightMm}">
  <svg x="${marginMm}" y="${marginMm}" width="${paperWidthMm - 2 * marginMm}" height="${paperHeightMm - 2 * marginMm}" viewBox="${tile.minX} ${tile.minY} ${tile.width} ${tile.height}" preserveAspectRatio="none" overflow="hidden">
  <rect x="${round(tile.minX)}" y="${round(tile.minY)}" width="${round(tile.width)}" height="${round(tile.height)}" fill="#ffffff" />
  <g>
    ${shapeMarkup}
    ${stitchHoleMarkup}
    ${foldMarkup}
  </g>
  ${ruler}
  <rect x="${round(tile.minX)}" y="${round(tile.minY)}" width="${round(tile.width)}" height="${round(tile.height)}" fill="none" stroke="#374151" stroke-width="0.35" />
  <text x="${round(tile.minX + 4)}" y="${round(tile.minY + 6)}" font-size="4" fill="#111827">Page ${tile.row + 1}-${tile.col + 1}</text>
</svg></svg>`
}

export function buildPrintableHtml(input: PrintTileOutputOptions) {
  // Callers may have built their preview plan with default calibration. Rebuild
  // its world tiles here so output calibration never creates gaps or applies twice.
  const options = { ...input, printPlan: applyPrintCalibration(input.printPlan, input.calibrationXPercent, input.calibrationYPercent) }
  checkPrintBudget(options)
  const landscape = options.printPlan.orientation === 'landscape'
  const activeDpiX = resolvePrintCalibrationDpi(landscape ? options.calibrationYPercent : options.calibrationXPercent)
  const activeDpiY = resolvePrintCalibrationDpi(landscape ? options.calibrationXPercent : options.calibrationYPercent)
  let generatedBytes = 0
  const pages = options.printPlan.tiles
    .map(
      (tile) => {
        const page = `<section class="print-page">${tileSvg(options, tile)}</section>`
        generatedBytes += new TextEncoder().encode(page).length
        if (generatedBytes > MAX_PRINT_HTML_BYTES) throw new Error(PRINT_BUDGET_ERROR)
        return page
      },
    )
    .join('\n')

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>LeatherCAD Print Tiles</title>
  <style>
    @page {
      size: ${options.printPlan.paperWidthMm}mm ${options.printPlan.paperHeightMm}mm;
      margin: 0;
    }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #f3f4f6;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 5;
      padding: 10px;
      background: #111827;
      color: #f9fafb;
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 12px;
    }
    .toolbar button {
      border: 0;
      border-radius: 6px;
      padding: 8px 10px;
      cursor: pointer;
      background: #f59e0b;
      color: #111827;
      font-weight: 600;
    }
    .print-page {
      width: ${options.printPlan.paperWidthMm}mm;
      height: ${options.printPlan.paperHeightMm}mm;
      margin: 10px auto;
      background: #fff;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.14);
      page-break-after: always;
    }
    .print-page:last-of-type {
      page-break-after: auto;
    }
    .print-svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    @media print {
      body {
        background: transparent;
      }
      .toolbar {
        display: none;
      }
      .print-page {
        margin: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Print</button>
    <span>${options.printPlan.tiles.length} page(s) | calibration ${options.calibrationXPercent.toFixed(2)}% x ${options.calibrationYPercent.toFixed(2)}% | active DPI ${activeDpiX} x ${activeDpiY}</span>
  </div>
  ${pages}
</body>
</html>`
  if (new TextEncoder().encode(html).length > MAX_PRINT_HTML_BYTES) throw new Error(PRINT_BUDGET_ERROR)
  return html
}

export function openPrintTilesWindow(options: PrintTileOutputOptions) {
  if (typeof window === 'undefined') {
    return false
  }
  // Prepare and reject excessive output before opening a window. noopener in
  // window.open's features returns no writable handle in current browsers.
  const html = buildPrintableHtml(options)
  const popup = window.open('', '_blank')
  if (!popup) {
    return false
  }
  try {
    popup.opener = null
    popup.document.open()
    popup.document.write(html)
    popup.document.close()
  } catch (error) { popup.close(); throw error }
  return true
}
