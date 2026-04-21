import { arcPath, getBounds, round } from '../cad/cad-geometry'
import { lineTypeStrokeDasharray, resolveLineTypeStrokeWidthMm, shouldIgnoreLineTypeInPrint } from '../cad/line-types'
import type { FoldLine, LineType, PatternPiece, Shape, SketchGroup, StitchHole } from '../cad/cad-types'
import { downloadFile } from '../editor-utils'
import { buildAnnotationExportShapes } from '../ops/annotation-export-shapes'
import { createStitchHolePrimitive } from '../ops/stitch-hole-render'
import { buildTextGlyphPlacements, normalizeTextShape, textBaselineAngleDeg } from '../ops/text-shape-ops'
import { MM_PER_INCH, type DisplayUnit } from '../ops/unit-ops'
import { useEditorPanelSelector } from '../state/providers/EditorPanelStateProvider'
import { useEditorUIActions, useEditorUISelector } from '../state/providers/EditorUIStateProvider'

type UseExportActionsParams = {
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  lineTypes: LineType[]
  lineTypesById: Record<string, LineType>
  patternPiecesById: Record<string, PatternPiece | undefined>
  lineTypeStylesById: Record<string, LineType['style']>
  sketchGroupsById: Record<string, SketchGroup>
  selectedShapeIdSet: Set<string>
  visibleLayerIdSet: Set<string>
  showAnnotations: boolean
  annotationLabels: import('../editor-types').AnnotationLabel[]
  pieceGrainlineSegments: Array<{ pieceId: string; start: { x: number; y: number }; end: { x: number; y: number } }>
  pieceNotchLines: Array<{ id: string; pieceId: string; start: { x: number; y: number }; end: { x: number; y: number }; showOnSeam: boolean }>
  piecePlacementGuides: import('../editor-types').PiecePlacementGuide[]
  stitchAlwaysShapeIdSet: Set<string>
  exportUnit: DisplayUnit
}

export function useExportActions(params: UseExportActionsParams) {
  const {
    shapes,
    foldLines,
    stitchHoles,
    lineTypes,
    lineTypesById,
    patternPiecesById,
    lineTypeStylesById,
    sketchGroupsById,
    selectedShapeIdSet,
    visibleLayerIdSet,
    showAnnotations,
    annotationLabels,
    pieceGrainlineSegments,
    pieceNotchLines,
    piecePlacementGuides,
    stitchAlwaysShapeIdSet,
    exportUnit,
  } = params
  const {
    exportOnlySelectedShapes,
    exportOnlyVisibleLineTypes,
    exportRoleFilters,
    exportForceSolidStrokes,
    exportStitchHoleRenderMode,
    exportStitchDotRadiusMm,
    dxfFlipY,
    dxfVersion,
  } = useEditorPanelSelector((state) => ({
    exportOnlySelectedShapes: state.exportOnlySelectedShapes,
    exportOnlyVisibleLineTypes: state.exportOnlyVisibleLineTypes,
    exportRoleFilters: state.exportRoleFilters,
    exportForceSolidStrokes: state.exportForceSolidStrokes,
    exportStitchHoleRenderMode: state.exportStitchHoleRenderMode,
    exportStitchDotRadiusMm: state.exportStitchDotRadiusMm,
    dxfFlipY: state.dxfFlipY,
    dxfVersion: state.dxfVersion,
  }))
  const { setStatus } = useEditorUIActions()
  const { exportIncludeText, exportIncludeTemplateMetadata } = useEditorUISelector((state) => ({
    exportIncludeText: state.exportIncludeText,
    exportIncludeTemplateMetadata: state.exportIncludeTemplateMetadata,
  }))

  const shapesById = Object.fromEntries(shapes.map((shape) => [shape.id, shape] as const))

  const isShapeEligibleForExport = (shape: Shape) => {
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
    if (shouldIgnoreLineTypeInPrint(lineType)) {
      return false
    }
    const isVisible = lineType?.visible ?? true
    if (exportOnlyVisibleLineTypes && !isVisible) {
      return false
    }
    return true
  }

  const getExportableShapes = () =>
    shapes.filter((shape) => {
      if (!isShapeEligibleForExport(shape)) {
        return false
      }
      if (!exportIncludeText && shape.type === 'text') {
        return false
      }
      const lineType = lineTypesById[shape.lineTypeId]
      const role = lineType?.role ?? 'cut'
      return exportRoleFilters[role]
    })

  const getExportableStitchHoles = () =>
    stitchHoles.filter((stitchHole) => {
      const shape = shapesById[stitchHole.shapeId]
      if (!shape || !isShapeEligibleForExport(shape)) {
        return false
      }
      const lineTypeRole = lineTypesById[shape.lineTypeId]?.role ?? 'cut'
      return exportRoleFilters.stitch && (lineTypeRole === 'stitch' || stitchAlwaysShapeIdSet.has(shape.id))
    })

  const annotationLineTypeId = lineTypes.find((lineType) => lineType.role === 'mark')?.id ?? lineTypes[0]?.id ?? 'annotation'

  const getExportableAnnotationShapes = () =>
    buildAnnotationExportShapes({
      showAnnotations,
      onlySelected: exportOnlySelectedShapes,
      selectedShapeIdSet,
      patternPiecesById,
      annotationLabels,
      pieceGrainlineSegments,
      pieceNotchLines,
      piecePlacementGuides,
      fallbackLayerId: Array.from(visibleLayerIdSet)[0] ?? shapes[0]?.layerId ?? 'layer-1',
      annotationLineTypeId,
    }).filter(
      (shape) =>
        visibleLayerIdSet.has(shape.layerId) &&
        exportRoleFilters[lineTypesById[shape.lineTypeId]?.role ?? 'mark'] &&
        !shouldIgnoreLineTypeInPrint(lineTypesById[shape.lineTypeId]) &&
        (!exportOnlyVisibleLineTypes || (lineTypesById[shape.lineTypeId]?.visible ?? true)),
    )

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

  const buildExportBounds = (exportShapes: Shape[], exportStitchHoles: StitchHole[], includeFoldLines: boolean) => {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    const includePoint = (x: number, y: number) => {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }

    const includeCircle = (cx: number, cy: number, radius: number) => {
      includePoint(cx - radius, cy - radius)
      includePoint(cx + radius, cy + radius)
    }

    if (exportShapes.length > 0) {
      const shapeBounds = getBounds(exportShapes)
      includePoint(shapeBounds.minX, shapeBounds.minY)
      includePoint(shapeBounds.minX + shapeBounds.width, shapeBounds.minY + shapeBounds.height)
    }

    for (const stitchHole of exportStitchHoles) {
      const primitive = createStitchHolePrimitive(stitchHole, {
        mode: exportStitchHoleRenderMode,
        dotRadiusMm: exportStitchDotRadiusMm,
      })

      if (primitive.kind === 'circle') {
        includeCircle(primitive.center.x, primitive.center.y, primitive.radiusMm)
        continue
      }

      if (primitive.kind === 'segment') {
        includePoint(primitive.start.x, primitive.start.y)
        includePoint(primitive.end.x, primitive.end.y)
        continue
      }

      primitive.points.forEach((point) => includePoint(point.x, point.y))
    }

    if (includeFoldLines) {
      for (const foldLine of foldLines) {
        includePoint(foldLine.start.x, foldLine.start.y)
        includePoint(foldLine.end.x, foldLine.end.y)
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    }
  }

  const shapeToExportSvg = (shape: Shape) => {
    const lineType = lineTypesById[shape.lineTypeId]
    const stroke = lineType?.color ?? '#0f172a'
    const shapeStrokeWidth =
      'strokeWidthOverride' in shape && typeof shape.strokeWidthOverride === 'number'
        ? shape.strokeWidthOverride
        : undefined
    const strokeWidth = round(shapeStrokeWidth ?? resolveLineTypeStrokeWidthMm(lineType))
    const strokeDasharray = exportForceSolidStrokes ? undefined : lineTypeStrokeDasharray(lineType?.style ?? 'solid')
    const dashAttribute = strokeDasharray ? ` stroke-dasharray="${strokeDasharray}"` : ''
    const arrowParts: string[] = []
    if ('arrowStart' in shape && shape.arrowStart) arrowParts.push('marker-start="url(#arrow-start)"')
    if ('arrowEnd' in shape && shape.arrowEnd) arrowParts.push('marker-end="url(#arrow-end)"')
    const arrowAttribute = arrowParts.length > 0 ? ' ' + arrowParts.join(' ') : ''

    if (shape.type === 'line') {
      return `<line x1="${round(shape.start.x)}" y1="${round(shape.start.y)}" x2="${round(shape.end.x)}" y2="${round(shape.end.y)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttribute}${arrowAttribute} />`
    }

    if (shape.type === 'arc') {
      return `<path d="${arcPath(shape.start, shape.mid, shape.end)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttribute}${arrowAttribute} />`
    }

    if (shape.type === 'bezier') {
      return `<path d="M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(shape.end.x)} ${round(shape.end.y)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"${dashAttribute}${arrowAttribute} />`
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

  const stitchHoleToExportSvg = (stitchHole: StitchHole) => {
    const parentShape = shapesById[stitchHole.shapeId]
    const lineType = parentShape ? lineTypesById[parentShape.lineTypeId] : undefined
    const stroke = lineType?.color ?? '#0f172a'
    const primitive = createStitchHolePrimitive(stitchHole, {
      mode: exportStitchHoleRenderMode,
      dotRadiusMm: exportStitchDotRadiusMm,
    })

    if (primitive.kind === 'circle') {
      return `<circle cx="${round(primitive.center.x)}" cy="${round(primitive.center.y)}" r="${round(primitive.radiusMm)}" fill="${stroke}" data-type="stitch-hole" />`
    }

    if (primitive.kind === 'segment') {
      return `<line x1="${round(primitive.start.x)}" y1="${round(primitive.start.y)}" x2="${round(primitive.end.x)}" y2="${round(primitive.end.y)}" stroke="${stroke}" stroke-width="${round(Math.max(0.2, primitive.strokeWidthMm))}" fill="none" stroke-linecap="round" data-type="stitch-hole" />`
    }

    return `<polygon points="${primitive.points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')}" stroke="${stroke}" stroke-width="${round(Math.max(0.2, stitchHole.widthMm ?? 0.9))}" fill="none" stroke-linejoin="round" data-type="stitch-hole" />`
  }

  const handleExportSvg = () => {
    const exportShapes = [...getExportableShapes(), ...getExportableAnnotationShapes()]
    const exportStitchHoles = getExportableStitchHoles()
    if (exportShapes.length === 0 && exportStitchHoles.length === 0) {
      setStatus('No shapes matched the current export filters')
      return
    }

    const includeFoldLines = exportRoleFilters.fold
    const bounds = buildExportBounds(exportShapes, exportStitchHoles, includeFoldLines)
    if (!bounds) {
      setStatus('No shapes matched the current export filters')
      return
    }
    const exportWidth = exportUnit === 'in' ? bounds.width / MM_PER_INCH : bounds.width
    const exportHeight = exportUnit === 'in' ? bounds.height / MM_PER_INCH : bounds.height
    const objectMarkup = exportShapes.map(shapeToExportSvg).join('\n  ')
    const stitchHoleMarkup = exportStitchHoles.map(stitchHoleToExportSvg).join('\n  ')
    const foldMarkup = includeFoldLines
      ? foldLines
          .map(
            (foldLine) =>
              `<line x1="${round(foldLine.start.x)}" y1="${round(foldLine.start.y)}" x2="${round(foldLine.end.x)}" y2="${round(foldLine.end.y)}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6 4" fill="none" data-type="fold-line"/>`,
          )
          .join('\n  ')
      : ''

    const templateMetadata = exportIncludeTemplateMetadata
      ? `<!-- leathercad:template shapes=${exportShapes.length} stitchHoles=${exportStitchHoles.length} folds=${includeFoldLines ? foldLines.length : 0} unit=${exportUnit} -->\n  `
      : ''
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(bounds.minX)} ${round(bounds.minY)} ${round(bounds.width)} ${round(bounds.height)}" width="${round(exportWidth)}${exportUnit}" height="${round(exportHeight)}${exportUnit}">\n  ${templateMetadata}<rect x="${round(bounds.minX)}" y="${round(bounds.minY)}" width="${round(bounds.width)}" height="${round(bounds.height)}" fill="white"/>\n  ${objectMarkup}\n  ${stitchHoleMarkup}\n  ${foldMarkup}\n</svg>`

    downloadFile('leathercraft-export.svg', svg, 'image/svg+xml;charset=utf-8')
    setStatus(
      `Exported SVG (${exportShapes.length} shapes, ${exportStitchHoles.length} stitch holes, ${includeFoldLines ? foldLines.length : 0} folds)`,
    )
  }

  const handleExportDxf = () => {
    const exportShapes = [...getExportableShapes(), ...getExportableAnnotationShapes()]
    const exportStitchHoles = getExportableStitchHoles()
    if (exportShapes.length === 0 && exportStitchHoles.length === 0) {
      setStatus('No shapes matched the current export filters')
      return
    }
    void import('../io/io-dxf')
      .then(({ buildDxfFromShapes }) => {
        const { content, segmentCount } = buildDxfFromShapes(exportShapes, {
          stitchHoles: exportStitchHoles,
          stitchHoleRenderMode: exportStitchHoleRenderMode,
          stitchDotRadiusMm: exportStitchDotRadiusMm,
          flipY: dxfFlipY,
          version: dxfVersion,
          unit: exportUnit,
          forceSolidLineStyle: exportForceSolidStrokes,
          lineTypeStyles: lineTypeStylesById,
        })
        downloadFile('leathercraft-export.dxf', content, 'application/dxf')
        setStatus(
          `Exported DXF ${dxfVersion.toUpperCase()} (${segmentCount} segments, ${exportStitchHoles.length} stitch holes, flipY ${dxfFlipY ? 'on' : 'off'})`,
        )
      })
      .catch(() => {
        setStatus('DXF export tools failed to load')
      })
  }

  const handleExportPdf = () => {
    const exportShapes = [...getExportableShapes(), ...getExportableAnnotationShapes()]
    const exportStitchHoles = getExportableStitchHoles()
    if (exportShapes.length === 0 && exportStitchHoles.length === 0) {
      setStatus('No shapes matched the current export filters')
      return
    }

    void import('../io/io-pdf')
      .then(({ buildPdfFromShapes }) => {
        const pdf = buildPdfFromShapes(exportShapes, {
          stitchHoles: exportStitchHoles,
          stitchHoleRenderMode: exportStitchHoleRenderMode,
          stitchDotRadiusMm: exportStitchDotRadiusMm,
          forceSolidLineStyle: exportForceSolidStrokes,
          lineTypeStyles: lineTypeStylesById,
          lineTypeStrokeWidthsMm: Object.fromEntries(
            lineTypes.map((lineType) => [lineType.id, resolveLineTypeStrokeWidthMm(lineType)]),
          ),
          lineTypeColors: Object.fromEntries(lineTypes.map((lineType) => [lineType.id, lineType.color])),
        })

        downloadFile('leathercraft-export.pdf', pdf, 'application/pdf')
        setStatus(`Exported PDF (${exportShapes.length} shapes, ${exportStitchHoles.length} stitch holes)`)
      })
      .catch(() => {
        setStatus('PDF export tools failed to load')
      })
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
      if (shouldIgnoreLineTypeInPrint(lineType)) {
        return false
      }
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
