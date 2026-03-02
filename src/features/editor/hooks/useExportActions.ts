import type { Dispatch, SetStateAction } from 'react'
import { arcPath, getBounds, round } from '../cad/cad-geometry'
import { lineTypeStrokeDasharray } from '../cad/line-types'
import type { FoldLine, LineType, Shape, SketchGroup } from '../cad/cad-types'
import type { DxfVersion, ExportRoleFilters } from '../editor-types'
import { buildDxfFromShapes } from '../io/io-dxf'
import { buildPdfFromShapes } from '../io/io-pdf'
import { downloadFile } from '../editor-utils'
import { buildTextGlyphPlacements, normalizeTextShape, textBaselineAngleDeg } from '../ops/text-shape-ops'

type UseExportActionsParams = {
  shapes: Shape[]
  foldLines: FoldLine[]
  lineTypes: LineType[]
  lineTypesById: Record<string, LineType>
  lineTypeStylesById: Record<string, LineType['style']>
  sketchGroupsById: Record<string, SketchGroup>
  selectedShapeIdSet: Set<string>
  visibleLayerIdSet: Set<string>
  exportOnlySelectedShapes: boolean
  exportOnlyVisibleLineTypes: boolean
  exportRoleFilters: ExportRoleFilters
  exportForceSolidStrokes: boolean
  dxfFlipY: boolean
  dxfVersion: DxfVersion
  setStatus: Dispatch<SetStateAction<string>>
}

export function useExportActions(params: UseExportActionsParams) {
  const {
    shapes,
    foldLines,
    lineTypes,
    lineTypesById,
    lineTypeStylesById,
    sketchGroupsById,
    selectedShapeIdSet,
    visibleLayerIdSet,
    exportOnlySelectedShapes,
    exportOnlyVisibleLineTypes,
    exportRoleFilters,
    exportForceSolidStrokes,
    dxfFlipY,
    dxfVersion,
    setStatus,
  } = params

  const getExportableShapes = () =>
    shapes.filter((shape) => {
      if (exportOnlySelectedShapes && !selectedShapeIdSet.has(shape.id)) {
        return false
      }
      if (!visibleLayerIdSet.has(shape.layerId)) {
        return false
      }
      if (shape.groupId) {
        const group = sketchGroupsById[shape.groupId]
        if (group && !group.visible) {
          return false
        }
      }
      const lineType = lineTypesById[shape.lineTypeId]
      const role = lineType?.role ?? 'cut'
      const isVisible = lineType?.visible ?? true
      if (exportOnlyVisibleLineTypes && !isVisible) {
        return false
      }
      return exportRoleFilters[role]
    })

  const escapeXml = (value: string) =>
    value.replace(/[<>&"]/g, (char) => {
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

  const shapeToExportSvg = (shape: Shape) => {
    const lineType = lineTypesById[shape.lineTypeId]
    const stroke = lineType?.color ?? '#0f172a'
    const strokeDasharray = exportForceSolidStrokes ? undefined : lineTypeStrokeDasharray(lineType?.style ?? 'solid')
    const dashAttribute = strokeDasharray ? ` stroke-dasharray="${strokeDasharray}"` : ''

    if (shape.type === 'line') {
      return `<line x1="${round(shape.start.x)}" y1="${round(shape.start.y)}" x2="${round(shape.end.x)}" y2="${round(shape.end.y)}" stroke="${stroke}" stroke-width="2" fill="none"${dashAttribute} />`
    }

    if (shape.type === 'arc') {
      return `<path d="${arcPath(shape.start, shape.mid, shape.end)}" stroke="${stroke}" stroke-width="2" fill="none"${dashAttribute} />`
    }

    if (shape.type === 'bezier') {
      return `<path d="M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(shape.end.x)} ${round(shape.end.y)}" stroke="${stroke}" stroke-width="2" fill="none"${dashAttribute} />`
    }

    const textShape = normalizeTextShape(shape)
    const fontFamily = textShape.fontFamily.replace(/"/g, '&quot;')
    const content = textShape.text.replace(/[<>&]/g, (char) => (char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&amp;'))
    const fontSize = Math.max(4, round(textShape.fontSizeMm))

    if (textShape.transform === 'none') {
      const angle = round(textBaselineAngleDeg(textShape))
      return `<text x="${round(textShape.start.x)}" y="${round(textShape.start.y)}" fill="${stroke}" font-size="${fontSize}" font-family="${fontFamily}" transform="rotate(${angle} ${round(textShape.start.x)} ${round(textShape.start.y)})">${content}</text>`
    }

    const glyphs = buildTextGlyphPlacements(textShape)
    return glyphs
      .map(
        (glyph) =>
          `<text x="${round(glyph.x)}" y="${round(glyph.y)}" text-anchor="middle" dominant-baseline="middle" fill="${stroke}" font-size="${fontSize}" font-family="${fontFamily}" transform="rotate(${round(glyph.rotationDeg)} ${round(glyph.x)} ${round(glyph.y)})">${glyph.char.replace(/[<>&]/g, (char) => (char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&amp;'))}</text>`,
      )
      .join('')
  }

  const handleExportSvg = () => {
    const exportShapes = getExportableShapes()
    if (exportShapes.length === 0) {
      setStatus('No shapes matched the current export filters')
      return
    }

    const bounds = getBounds(exportShapes)
    const objectMarkup = exportShapes.map(shapeToExportSvg).join('\n  ')
    const includeFoldLines = exportRoleFilters.fold
    const foldMarkup = includeFoldLines
      ? foldLines
          .map(
            (foldLine) =>
              `<line x1="${round(foldLine.start.x)}" y1="${round(foldLine.start.y)}" x2="${round(foldLine.end.x)}" y2="${round(foldLine.end.y)}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6 4" fill="none" data-type="fold-line"/>`,
          )
          .join('\n  ')
      : ''

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(bounds.minX)} ${round(bounds.minY)} ${round(bounds.width)} ${round(bounds.height)}">\n  <rect x="${round(bounds.minX)}" y="${round(bounds.minY)}" width="${round(bounds.width)}" height="${round(bounds.height)}" fill="white"/>\n  ${objectMarkup}\n  ${foldMarkup}\n</svg>`

    downloadFile('leathercraft-export.svg', svg, 'image/svg+xml;charset=utf-8')
    setStatus(`Exported SVG (${exportShapes.length} shapes, ${includeFoldLines ? foldLines.length : 0} folds)`)
  }

  const handleExportDxf = () => {
    const exportShapes = getExportableShapes()
    if (exportShapes.length === 0) {
      setStatus('No shapes matched the current export filters')
      return
    }

    const { content, segmentCount } = buildDxfFromShapes(exportShapes, {
      flipY: dxfFlipY,
      version: dxfVersion,
      forceSolidLineStyle: exportForceSolidStrokes,
      lineTypeStyles: lineTypeStylesById,
    })
    downloadFile('leathercraft-export.dxf', content, 'application/dxf')
    setStatus(
      `Exported DXF ${dxfVersion.toUpperCase()} (${segmentCount} segments, flipY ${dxfFlipY ? 'on' : 'off'})`,
    )
  }

  const handleExportPdf = () => {
    const exportShapes = getExportableShapes()
    if (exportShapes.length === 0) {
      setStatus('No shapes matched the current export filters')
      return
    }

    const pdf = buildPdfFromShapes(exportShapes, {
      forceSolidLineStyle: exportForceSolidStrokes,
      lineTypeStyles: lineTypeStylesById,
      lineTypeColors: Object.fromEntries(lineTypes.map((lineType) => [lineType.id, lineType.color])),
    })

    downloadFile('leathercraft-export.pdf', pdf, 'application/pdf')
    setStatus(`Exported PDF (${exportShapes.length} shapes)`)
  }

  const handleExportLaserSvg = () => {
    const laserRoleSet = new Set(['cut', 'stitch', 'mark'])
    const exportShapes = shapes.filter((shape) => {
      if (!visibleLayerIdSet.has(shape.layerId)) {
        return false
      }
      if (shape.groupId) {
        const group = sketchGroupsById[shape.groupId]
        if (group && !group.visible) {
          return false
        }
      }
      const lineType = lineTypesById[shape.lineTypeId]
      const role = lineType?.role ?? 'cut'
      return laserRoleSet.has(role)
    })

    if (exportShapes.length === 0) {
      setStatus('No cut/stitch/mark shapes available for laser export')
      return
    }

    const bounds = getBounds(exportShapes)
    const shapeMarkup = exportShapes
      .map((shape) => {
        if (shape.type === 'line') {
          return `<line x1="${round(shape.start.x)}" y1="${round(shape.start.y)}" x2="${round(shape.end.x)}" y2="${round(shape.end.y)}" stroke="#000000" stroke-width="0.1" fill="none" />`
        }
        if (shape.type === 'arc') {
          return `<path d="${arcPath(shape.start, shape.mid, shape.end)}" stroke="#000000" stroke-width="0.1" fill="none" />`
        }
        if (shape.type === 'bezier') {
          return `<path d="M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(shape.end.x)} ${round(shape.end.y)}" stroke="#000000" stroke-width="0.1" fill="none" />`
        }
        const textShape = normalizeTextShape(shape)
        const fontSize = Math.max(4, round(textShape.fontSizeMm))
        const fontFamily = escapeXml(textShape.fontFamily)
        if (textShape.transform === 'none') {
          const angle = round(textBaselineAngleDeg(textShape))
          return `<text x="${round(textShape.start.x)}" y="${round(textShape.start.y)}" font-size="${fontSize}" fill="none" stroke="#000000" stroke-width="0.1" font-family="${fontFamily}" transform="rotate(${angle} ${round(textShape.start.x)} ${round(textShape.start.y)})">${escapeXml(textShape.text)}</text>`
        }

        return buildTextGlyphPlacements(textShape)
          .map(
            (glyph) =>
              `<text x="${round(glyph.x)}" y="${round(glyph.y)}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" fill="none" stroke="#000000" stroke-width="0.1" font-family="${fontFamily}" transform="rotate(${round(glyph.rotationDeg)} ${round(glyph.x)} ${round(glyph.y)})">${escapeXml(glyph.char)}</text>`,
          )
          .join('')
      })
      .join('\n  ')

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(bounds.minX)} ${round(bounds.minY)} ${round(bounds.width)} ${round(bounds.height)}">\n  ${shapeMarkup}\n</svg>`
    downloadFile('leathercraft-laser-export.svg', svg, 'image/svg+xml;charset=utf-8')
    setStatus(`Exported laser SVG (${exportShapes.length} shapes)`)
  }

  return {
    handleExportSvg,
    handleExportDxf,
    handleExportPdf,
    handleExportLaserSvg,
  }
}
