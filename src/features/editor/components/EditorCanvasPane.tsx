import type { PointerEvent, PointerEventHandler, ReactElement, RefObject, WheelEventHandler } from 'react'
import { arcPath, round, sampleShapePoints } from '../cad/cad-geometry'
import type {
  DimensionLine,
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  Point,
  Shape,
  StitchHole,
  TextShape,
  TracingOverlay,
  Viewport,
} from '../cad/cad-types'
import { lineTypeStrokeDasharray } from '../cad/line-types'
import { buildTextGlyphPlacements, normalizeTextShape, textBaselineAngleDeg } from '../ops/text-shape-ops'
import type { AnnotationLabel, LegendMode, PiecePlacementGuide, SeamGuide, SketchWorkspaceMode } from '../editor-types'
import type { ConstraintSuggestion } from '../ops/auto-constraint-ops'
import { formatDisplayDistance, type DisplayUnit } from '../ops/unit-ops'
import { chainCentroid, type OutlineChain } from '../ops/outline-detection'
import type { PrintPlan } from '../preview/print-preview'
import { LayerLegendPanel } from './LayerLegendPanel'

type StackLegendEntry = {
  stackLevel: number
  layerNames: string[]
  swatchBackground: string
}

type EditorCanvasPaneProps = {
  hideCanvasPane: boolean
  svgRef: RefObject<SVGSVGElement | null>
  onPointerDown: PointerEventHandler<SVGSVGElement>
  onPointerMove: PointerEventHandler<SVGSVGElement>
  onPointerUp: PointerEventHandler<SVGSVGElement>
  onWheel: WheelEventHandler<SVGSVGElement>
  viewport: Viewport
  displayUnit: DisplayUnit
  gridLines: ReactElement[]
  showCanvasRuler: boolean
  showDimensions: boolean
  onZoomOut: () => void
  onZoomIn: () => void
  onFitView: () => void
  onResetView: () => void
  tracingOverlays: TracingOverlay[]
  showPrintAreas: boolean
  dimensionLines: DimensionLine[]
  printPlan: PrintPlan | null
  seamGuides: SeamGuide[]
  showAnnotations: boolean
  pieceGrainlineSegments: Array<{ pieceId: string; start: Point; end: Point }>
  pieceNotchLines: Array<{ id: string; pieceId: string; start: Point; end: Point; showOnSeam: boolean }>
  piecePlacementGuides: PiecePlacementGuide[]
  visibleShapes: Shape[]
  linkedShapes: Shape[]
  sketchWorkspaceMode: SketchWorkspaceMode
  lineTypes: LineType[]
  lineTypesById: Record<string, LineType | undefined>
  selectedShapeIdSet: Set<string>
  stitchStrokeColor: string
  foldStrokeColor: string
  cutStrokeColor: string
  displayLayerColorsById: Record<string, string>
  onShapePointerDown: (event: PointerEvent<SVGElement>, shapeId: string) => void
  onShapeHandlePointerDown: (
    event: PointerEvent<SVGCircleElement>,
    shapeId: string,
    pointKey: 'start' | 'mid' | 'control' | 'end',
  ) => void
  showShapeHandles: boolean
  visibleStitchHoles: StitchHole[]
  selectedStitchHoleId: string | null
  showStitchSequenceLabels: boolean
  onStitchHolePointerDown: (event: PointerEvent<SVGElement>, stitchHoleId: string) => void
  visibleHardwareMarkers: HardwareMarker[]
  selectedHardwareMarkerId: string | null
  onHardwarePointerDown: (event: PointerEvent<SVGGElement>, markerId: string) => void
  foldLines: FoldLine[]
  annotationLabels: AnnotationLabel[]
  constraintSuggestions: ConstraintSuggestion[]
  previewElement: ReactElement | null
  showLayerLegend: boolean
  legendMode: LegendMode
  onSetLegendMode: (mode: LegendMode) => void
  layers: Layer[]
  layerColorsById: Record<string, string>
  fallbackLayerStroke: string
  stackLegendEntries: StackLegendEntry[]
  outlineChains: OutlineChain[]
}

export function EditorCanvasPane({
  hideCanvasPane,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  viewport,
  displayUnit,
  gridLines,
  showCanvasRuler,
  showDimensions,
  onZoomOut,
  onZoomIn,
  onFitView,
  onResetView,
  tracingOverlays,
  showPrintAreas,
  dimensionLines,
  printPlan,
  seamGuides,
  showAnnotations,
  pieceGrainlineSegments,
  pieceNotchLines,
  piecePlacementGuides,
  visibleShapes,
  linkedShapes,
  sketchWorkspaceMode,
  lineTypes,
  lineTypesById,
  selectedShapeIdSet,
  stitchStrokeColor,
  foldStrokeColor,
  cutStrokeColor,
  displayLayerColorsById,
  onShapePointerDown,
  onShapeHandlePointerDown,
  showShapeHandles,
  visibleStitchHoles,
  selectedStitchHoleId,
  showStitchSequenceLabels,
  onStitchHolePointerDown,
  visibleHardwareMarkers,
  selectedHardwareMarkerId,
  onHardwarePointerDown,
  foldLines,
  annotationLabels,
  constraintSuggestions,
  previewElement,
  showLayerLegend,
  legendMode,
  onSetLegendMode,
  layers,
  layerColorsById,
  fallbackLayerStroke,
  stackLegendEntries,
  outlineChains,
}: EditorCanvasPaneProps) {
  const arrowMarkerStyle = (shape: Shape): Record<string, string> => {
    const style: Record<string, string> = {}
    if ('arrowStart' in shape && shape.arrowStart) {
      style.markerStart = 'url(#arrow-start)'
    }
    if ('arrowEnd' in shape && shape.arrowEnd) {
      style.markerEnd = 'url(#arrow-end)'
    }
    return style
  }

  const shapeHandleEntries = (shape: Shape): Array<{ key: 'start' | 'mid' | 'control' | 'end'; point: Point }> => {
    if (shape.type === 'line' || shape.type === 'text') {
      return [
        { key: 'start', point: shape.start },
        { key: 'end', point: shape.end },
      ]
    }
    if (shape.type === 'arc') {
      return [
        { key: 'start', point: shape.start },
        { key: 'mid', point: shape.mid },
        { key: 'end', point: shape.end },
      ]
    }
    return [
      { key: 'start', point: shape.start },
      { key: 'control', point: shape.control },
      { key: 'end', point: shape.end },
    ]
  }

  const resolveShapeStrokeColor = (shape: Shape) => {
    const lineType = lineTypesById[shape.lineTypeId]
    const lineTypeRole = lineType?.role ?? 'cut'
    if (sketchWorkspaceMode === 'assembly') {
      return displayLayerColorsById[shape.layerId] ?? fallbackLayerStroke
    }
    if (lineType?.color) {
      return lineType.color
    }
    if (lineTypeRole === 'stitch') {
      return stitchStrokeColor
    }
    if (lineTypeRole === 'fold') {
      return foldStrokeColor
    }
    return lineType?.color ?? cutStrokeColor
  }

  const shapeStrokeOpacity = sketchWorkspaceMode === 'assembly' ? 0.85 : 1

  const renderTextShape = (shape: TextShape, options: { key: string; color: string; selected: boolean; linked: boolean }) => {
    const normalized = normalizeTextShape(shape)
    const fontSize = Math.max(4, round(normalized.fontSizeMm))
    const className = options.selected ? 'annotation-label text-shape text-shape-selected' : 'annotation-label text-shape'

    if (normalized.transform === 'none') {
      const baselineAngle = textBaselineAngleDeg(normalized)
      return (
        <text
          key={options.key}
          x={round(normalized.start.x)}
          y={round(normalized.start.y)}
          className={className}
          style={{
            fill: options.color,
            fontFamily: normalized.fontFamily,
            fontSize: `${fontSize}px`,
            opacity: options.linked ? 0.7 : shapeStrokeOpacity,
            pointerEvents: options.linked ? 'none' : 'auto',
          }}
          transform={`rotate(${round(baselineAngle)} ${round(normalized.start.x)} ${round(normalized.start.y)})`}
          onPointerDown={
            options.linked
              ? undefined
              : (event) => {
                  onShapePointerDown(event, shape.id)
                }
          }
        >
          {normalized.text}
        </text>
      )
    }

    const glyphs = buildTextGlyphPlacements(normalized)
    return (
      <g key={options.key} style={{ pointerEvents: options.linked ? 'none' : 'auto' }}>
        {glyphs.map((glyph, index) => (
          <text
            key={`${shape.id}-glyph-${index}`}
            x={round(glyph.x)}
            y={round(glyph.y)}
            className={className}
            style={{
              fill: options.color,
              fontFamily: normalized.fontFamily,
              fontSize: `${fontSize}px`,
              opacity: options.linked ? 0.7 : shapeStrokeOpacity,
            }}
            transform={`rotate(${round(glyph.rotationDeg)} ${round(glyph.x)} ${round(glyph.y)})`}
            textAnchor="middle"
            dominantBaseline="middle"
            onPointerDown={
              options.linked
                ? undefined
                : (event) => {
                    onShapePointerDown(event, shape.id)
                  }
            }
          >
            {glyph.char}
          </text>
        ))}
      </g>
    )
  }

  const dimensionShapes = showDimensions
    ? selectedShapeIdSet.size > 0
      ? visibleShapes.filter((shape) => selectedShapeIdSet.has(shape.id))
      : visibleShapes.slice(0, 40)
    : []

  const dimensionEntries = dimensionShapes
    .map((shape) => {
      const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 36)
      if (sampled.length < 2) {
        return null
      }

      let lengthMm = 0
      for (let index = 1; index < sampled.length; index += 1) {
        const dx = sampled[index].x - sampled[index - 1].x
        const dy = sampled[index].y - sampled[index - 1].y
        lengthMm += Math.hypot(dx, dy)
      }

      if (!Number.isFinite(lengthMm) || lengthMm <= 0.01) {
        return null
      }

      const mid = sampled[Math.floor(sampled.length / 2)]
      return {
        id: shape.id,
        x: mid.x + 4,
        y: mid.y - 4,
        text: formatDisplayDistance(lengthMm, displayUnit, displayUnit === 'in' ? 3 : 1),
      }
    })
    .filter((entry): entry is { id: string; x: number; y: number; text: string } => entry !== null)

  const rulerTickValues = showCanvasRuler
    ? Array.from({ length: 81 }, (_, index) => (index - 40) * 50)
    : []

  return (
    <section className={`canvas-pane ${hideCanvasPane ? 'panel-hidden' : ''}`}>
      <svg
        ref={svgRef}
        className="canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(event) => event.preventDefault()}
      >
        <defs>
          <marker id="arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
            <polygon points="0 0, 10 3.5, 0 7" fill="context-stroke" />
          </marker>
          <marker id="arrow-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto" markerUnits="strokeWidth">
            <polygon points="10 0, 0 3.5, 10 7" fill="context-stroke" />
          </marker>
        </defs>
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
          {gridLines}

          {showCanvasRuler && (
            <g className="xy-ruler-overlay">
              <line x1={-2400} y1={0} x2={2400} y2={0} className="xy-ruler-axis" />
              <line x1={0} y1={-2400} x2={0} y2={2400} className="xy-ruler-axis" />
              {rulerTickValues.map((value) => {
                const major = value % 200 === 0
                const tick = major ? 7 : 4
                return (
                  <g key={`ruler-x-${value}`}>
                    <line x1={value} y1={-tick} x2={value} y2={tick} className="xy-ruler-tick" />
                    {major && value !== 0 && (
                      <text x={value + 2} y={-9} className="xy-ruler-label">
                        {formatDisplayDistance(value, displayUnit, displayUnit === 'in' ? 2 : 0)}
                      </text>
                    )}
                  </g>
                )
              })}
              {rulerTickValues.map((value) => {
                const major = value % 200 === 0
                const tick = major ? 7 : 4
                return (
                  <g key={`ruler-y-${value}`}>
                    <line x1={-tick} y1={value} x2={tick} y2={value} className="xy-ruler-tick" />
                    {major && value !== 0 && (
                      <text x={8} y={value - 2} className="xy-ruler-label">
                        {formatDisplayDistance(-value, displayUnit, displayUnit === 'in' ? 2 : 0)}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )}

          {tracingOverlays
            .filter((overlay) => overlay.visible)
            .map((overlay) => {
              const scale = Number(overlay.scale.toFixed(4))
              const transform = `translate(${round(overlay.offsetX)} ${round(overlay.offsetY)}) rotate(${round(
                overlay.rotationDeg,
              )}) scale(${scale})`
              const x = round(-overlay.width / 2)
              const y = round(-overlay.height / 2)
              return (
                <g key={overlay.id} transform={transform} opacity={overlay.opacity}>
                  <image
                    href={overlay.sourceUrl}
                    x={x}
                    y={y}
                    width={round(overlay.width)}
                    height={round(overlay.height)}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>
              )
            })}

          {showPrintAreas &&
            printPlan &&
            printPlan.tiles.map((tile) => (
              <g key={tile.id} className="print-area-group">
                <rect x={tile.minX} y={tile.minY} width={tile.width} height={tile.height} className="print-area-rect" />
                <text x={tile.minX + 8} y={tile.minY + 16} className="print-area-label">
                  {`P${tile.row + 1}-${tile.col + 1}`}
                </text>
              </g>
            ))}

          {seamGuides.map((guide) => (
            <g key={guide.id}>
              <path d={guide.d} className="seam-guide-line" />
              {showAnnotations && (
                <text x={guide.labelPoint.x + 5} y={guide.labelPoint.y + 5} className="seam-guide-label">
                  {`${guide.offsetMm.toFixed(1)}mm seam`}
                </text>
              )}
            </g>
          ))}

          {linkedShapes.map((shape) => {
            const lineType = lineTypesById[shape.lineTypeId]
            const layerStroke = resolveShapeStrokeColor(shape)
            const strokeDasharray = sketchWorkspaceMode === 'sketch' ? '8 5' : lineTypeStrokeDasharray(lineType?.style ?? 'solid')
            const linkedClassName = sketchWorkspaceMode === 'sketch' ? 'shape-line shape-linked-reference' : 'shape-line shape-linked-assembly'

            if (shape.type === 'line') {
              return (
                <line
                  key={shape.id}
                  x1={shape.start.x}
                  y1={shape.start.y}
                  x2={shape.end.x}
                  y2={shape.end.y}
                  className={linkedClassName}
                  style={{ stroke: layerStroke, strokeDasharray, strokeOpacity: shapeStrokeOpacity }}
                />
              )
            }

            if (shape.type === 'arc') {
              return (
                <path
                  key={shape.id}
                  d={arcPath(shape.start, shape.mid, shape.end)}
                  className={linkedClassName}
                  style={{ stroke: layerStroke, strokeDasharray, strokeOpacity: shapeStrokeOpacity }}
                />
              )
            }

            if (shape.type === 'text') {
              return renderTextShape(shape, {
                key: shape.id,
                color: layerStroke,
                selected: false,
                linked: true,
              })
            }

            return (
              <path
                key={shape.id}
                d={`M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(
                  shape.end.x,
                )} ${round(shape.end.y)}`}
                className={linkedClassName}
                style={{ stroke: layerStroke, strokeDasharray, strokeOpacity: shapeStrokeOpacity }}
              />
            )
          })}

          {visibleShapes.map((shape) => {
            const lineType = lineTypesById[shape.lineTypeId]
            const isSelected = selectedShapeIdSet.has(shape.id)
            const layerStroke = resolveShapeStrokeColor(shape)
            const strokeDasharray = lineTypeStrokeDasharray(lineType?.style ?? 'solid')
            if (shape.type === 'line') {
              return (
                <line
                  key={shape.id}
                  x1={shape.start.x}
                  y1={shape.start.y}
                  x2={shape.end.x}
                  y2={shape.end.y}
                  className={isSelected ? 'shape-line shape-selected' : 'shape-line'}
                  style={{ stroke: layerStroke, strokeDasharray, strokeOpacity: shapeStrokeOpacity, ...arrowMarkerStyle(shape) }}
                  onPointerDown={(event) => onShapePointerDown(event, shape.id)}
                />
              )
            }

            if (shape.type === 'arc') {
              return (
                <path
                  key={shape.id}
                  d={arcPath(shape.start, shape.mid, shape.end)}
                  className={isSelected ? 'shape-line shape-selected' : 'shape-line'}
                  style={{ stroke: layerStroke, strokeDasharray, strokeOpacity: shapeStrokeOpacity, ...arrowMarkerStyle(shape) }}
                  onPointerDown={(event) => onShapePointerDown(event, shape.id)}
                />
              )
            }

            if (shape.type === 'text') {
              return renderTextShape(shape, {
                key: shape.id,
                color: layerStroke,
                selected: isSelected,
                linked: false,
              })
            }

            return (
              <path
                key={shape.id}
                d={`M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(
                  shape.end.x,
                )} ${round(shape.end.y)}`}
                className={isSelected ? 'shape-line shape-selected' : 'shape-line'}
                style={{ stroke: layerStroke, strokeDasharray, strokeOpacity: shapeStrokeOpacity, ...arrowMarkerStyle(shape) }}
                onPointerDown={(event) => onShapePointerDown(event, shape.id)}
              />
            )
          })}

          {showShapeHandles &&
            visibleShapes
              .filter((shape) => selectedShapeIdSet.has(shape.id))
              .flatMap((shape) =>
                shapeHandleEntries(shape).map((entry) => (
                  <circle
                    key={`${shape.id}-${entry.key}-handle`}
                    cx={entry.point.x}
                    cy={entry.point.y}
                    r={2.3}
                    className="shape-handle"
                    onPointerDown={(event) => onShapeHandlePointerDown(event, shape.id, entry.key)}
                  />
                )),
              )}

          {/* Stitch connecting lines (drawn first, behind holes) */}
          {(() => {
            const sorted = [...visibleStitchHoles].sort((a, b) => a.sequence - b.sequence)
            const pathParts: string[] = []
            for (let i = 1; i < sorted.length; i++) {
              const prev = sorted[i - 1]
              const curr = sorted[i]
              if (curr.sequence === prev.sequence + 1) {
                pathParts.push(`M${prev.point.x},${prev.point.y}L${curr.point.x},${curr.point.y}`)
              }
            }
            return pathParts.length > 0 ? (
              <path d={pathParts.join('')} className="stitch-thread-line" />
            ) : null
          })()}

          {visibleStitchHoles.map((stitchHole) => {
            const isSelected = stitchHole.id === selectedStitchHoleId
            const r = stitchHole.diameterMm ? stitchHole.diameterMm / 2 : 0.6
            const outerR = r * 2.5
            const crossR = outerR * 1.3

            if (stitchHole.holeType === 'slit') {
              const radians = (stitchHole.angleDeg * Math.PI) / 180
              const dx = Math.cos(radians) * 3
              const dy = Math.sin(radians) * 3
              return (
                <line
                  key={stitchHole.id}
                  x1={stitchHole.point.x - dx}
                  y1={stitchHole.point.y - dy}
                  x2={stitchHole.point.x + dx}
                  y2={stitchHole.point.y + dy}
                  className={isSelected ? 'stitch-hole-slit stitch-hole-slit-selected' : 'stitch-hole-slit'}
                  onPointerDown={(event) => onStitchHolePointerDown(event, stitchHole.id)}
                />
              )
            }

            const cx = stitchHole.point.x
            const cy = stitchHole.point.y

            return (
              <g key={stitchHole.id} onPointerDown={(event) => onStitchHolePointerDown(event, stitchHole.id)} style={{ cursor: 'pointer' }}>
                {/* Dashed outline circle */}
                <circle cx={cx} cy={cy} r={outerR} className="stitch-hole-outline" />
                {/* Crosshair lines */}
                <line x1={cx - crossR} y1={cy} x2={cx + crossR} y2={cy} className="stitch-hole-crosshair" />
                <line x1={cx} y1={cy - crossR} x2={cx} y2={cy + crossR} className="stitch-hole-crosshair" />
                {/* Center dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  className={isSelected ? 'stitch-hole-dot stitch-hole-dot-selected' : 'stitch-hole-dot'}
                />
                {showStitchSequenceLabels && (
                  <text x={cx + 3.2} y={cy - 3.2} className="stitch-hole-sequence-label">
                    {stitchHole.sequence + 1}
                  </text>
                )}
              </g>
            )
          })}

          {visibleHardwareMarkers.map((marker) => {
            const isSelected = marker.id === selectedHardwareMarkerId
            return (
              <g
                key={marker.id}
                className={isSelected ? 'hardware-marker hardware-marker-selected' : 'hardware-marker'}
                onPointerDown={(event) => onHardwarePointerDown(event, marker.id)}
              >
                <circle cx={marker.point.x} cy={marker.point.y} r={3.2} />
                <line x1={marker.point.x - 4.2} y1={marker.point.y} x2={marker.point.x + 4.2} y2={marker.point.y} />
                <line x1={marker.point.x} y1={marker.point.y - 4.2} x2={marker.point.x} y2={marker.point.y + 4.2} />
                <text x={marker.point.x + 4.8} y={marker.point.y - 4.8} className="hardware-marker-label">
                  {`${marker.label} (${marker.holeDiameterMm.toFixed(1)}mm)`}
                </text>
              </g>
            )
          })}

          {foldLines.map((foldLine) => (
            <line
              key={foldLine.id}
              x1={foldLine.start.x}
              y1={foldLine.start.y}
              x2={foldLine.end.x}
              y2={foldLine.end.y}
              className="fold-line"
            />
          ))}

          {pieceGrainlineSegments.map((segment) => (
            <g key={`piece-grainline-${segment.pieceId}`} className="piece-grainline" style={{ pointerEvents: 'none' }}>
              <line
                x1={segment.start.x}
                y1={segment.start.y}
                x2={segment.end.x}
                y2={segment.end.y}
                stroke="#0f766e"
                strokeWidth={1.25 / viewport.scale}
                strokeDasharray={`${6 / viewport.scale} ${4 / viewport.scale}`}
              />
              <polyline
                points={`${segment.end.x},${segment.end.y} ${segment.end.x - 3 / viewport.scale},${segment.end.y - 1.5 / viewport.scale} ${segment.end.x - 3 / viewport.scale},${segment.end.y + 1.5 / viewport.scale}`}
                fill="none"
                stroke="#0f766e"
                strokeWidth={1.25 / viewport.scale}
              />
            </g>
          ))}

          {pieceNotchLines.map((notch) => (
            <line
              key={notch.id}
              x1={notch.start.x}
              y1={notch.start.y}
              x2={notch.end.x}
              y2={notch.end.y}
              stroke={notch.showOnSeam ? '#7c2d12' : '#0f172a'}
              strokeWidth={1.4 / viewport.scale}
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {piecePlacementGuides.map((guide) => {
            const radians = (guide.rotationDeg * Math.PI) / 180
            const halfWidth = guide.widthMm / 2
            const halfHeight = guide.heightMm / 2
            const rotatePoint = (x: number, y: number) => ({
              x: guide.point.x + x * Math.cos(radians) - y * Math.sin(radians),
              y: guide.point.y + x * Math.sin(radians) + y * Math.cos(radians),
            })

            if (guide.kind === 'text') {
              return (
                <text
                  key={guide.id}
                  x={guide.point.x}
                  y={guide.point.y}
                  className="annotation-label"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${round(guide.rotationDeg)} ${guide.point.x} ${guide.point.y})`}
                  style={{ pointerEvents: 'none', fontSize: `${Math.max(4, guide.heightMm)}px` }}
                >
                  {guide.text ?? guide.id}
                </text>
              )
            }

            if (guide.kind === 'circle') {
              return (
                <circle
                  key={guide.id}
                  cx={guide.point.x}
                  cy={guide.point.y}
                  r={Math.max(1, halfWidth)}
                  stroke="#1d4ed8"
                  fill="none"
                  strokeWidth={1.2 / viewport.scale}
                  style={{ pointerEvents: 'none' }}
                />
              )
            }

            if (guide.kind === 'box') {
              const corners = [
                rotatePoint(-halfWidth, -halfHeight),
                rotatePoint(halfWidth, -halfHeight),
                rotatePoint(halfWidth, halfHeight),
                rotatePoint(-halfWidth, halfHeight),
              ]
              return (
                <polygon
                  key={guide.id}
                  points={corners.map((point) => `${point.x},${point.y}`).join(' ')}
                  stroke="#1d4ed8"
                  fill="none"
                  strokeWidth={1.2 / viewport.scale}
                  style={{ pointerEvents: 'none' }}
                />
              )
            }

            const horizontalStart = rotatePoint(-halfWidth, 0)
            const horizontalEnd = rotatePoint(halfWidth, 0)
            const verticalStart = rotatePoint(0, -halfHeight)
            const verticalEnd = rotatePoint(0, halfHeight)
            return (
              <g key={guide.id} style={{ pointerEvents: 'none' }}>
                <line
                  x1={horizontalStart.x}
                  y1={horizontalStart.y}
                  x2={horizontalEnd.x}
                  y2={horizontalEnd.y}
                  stroke="#1d4ed8"
                  strokeWidth={1.2 / viewport.scale}
                />
                <line
                  x1={verticalStart.x}
                  y1={verticalStart.y}
                  x2={verticalEnd.x}
                  y2={verticalEnd.y}
                  stroke="#1d4ed8"
                  strokeWidth={1.2 / viewport.scale}
                />
              </g>
            )
          })}

          {annotationLabels.map((label) => (
            <text
              key={label.id}
              x={label.point.x}
              y={label.point.y}
              className="annotation-label"
              style={label.fontSizeMm ? { fontSize: `${Math.max(4, label.fontSizeMm)}px` } : undefined}
              transform={label.rotationDeg ? `rotate(${round(label.rotationDeg)} ${label.point.x} ${label.point.y})` : undefined}
            >
              {label.text}
            </text>
          ))}

          {outlineChains.map((chain) => {
            const centroid = chainCentroid(chain.polygon)
            const labelSize = 3.5 / viewport.scale
            if (chain.isClosed) return null
            // Render open-path endpoint indicators and label
            const first = chain.polygon[0]
            const last = chain.polygon[chain.polygon.length - 1]
            const endpointR = 2 / viewport.scale
            return (
              <g key={`outline-${chain.id}`} className="outline-chain-label" style={{ pointerEvents: 'none' }}>
                <circle cx={first.x} cy={first.y} r={endpointR} className="open-path-endpoint" style={{ strokeWidth: 1.2 / viewport.scale }} />
                <circle cx={last.x} cy={last.y} r={endpointR} className="open-path-endpoint" style={{ strokeWidth: 1.2 / viewport.scale }} />
                <text
                  x={centroid.x}
                  y={centroid.y - 4 / viewport.scale}
                  style={{
                    fontSize: labelSize,
                    fill: '#f97316',
                    fontWeight: 600,
                    textAnchor: 'middle',
                    opacity: 0.8,
                  }}
                >
                  Open Path
                </text>
              </g>
            )
          })}

          {constraintSuggestions.map((suggestion, i) => (
            <text
              key={`cs-${i}`}
              x={suggestion.glyphPoint.x}
              y={suggestion.glyphPoint.y - 4}
              className="constraint-glyph"
              style={{
                fontSize: 10 / viewport.scale,
                fill: '#22d3ee',
                fontWeight: 700,
                textAnchor: 'middle',
                pointerEvents: 'none',
                opacity: 0.5 + suggestion.confidence * 0.5,
              }}
            >
              {suggestion.glyph}
            </text>
          ))}

          {dimensionEntries.map((entry) => (
            <text key={`dim-${entry.id}`} x={entry.x} y={entry.y} className="dimension-label">
              {entry.text}
            </text>
          ))}

          {showDimensions &&
            dimensionLines.map((dim) => {
              const dx = dim.end.x - dim.start.x
              const dy = dim.end.y - dim.start.y
              const len = Math.hypot(dx, dy)
              if (len < 0.01) return null
              const nx = (-dy / len) * dim.offsetMm
              const ny = (dx / len) * dim.offsetMm
              const s = { x: dim.start.x + nx, y: dim.start.y + ny }
              const e = { x: dim.end.x + nx, y: dim.end.y + ny }
              const mx = (s.x + e.x) / 2
              const my = (s.y + e.y) / 2
              const dimText = dim.text ?? `${round(len)}mm`
              return (
                <g key={`dimline-${dim.id}`} className="dimension-line-group">
                  <line x1={dim.start.x} y1={dim.start.y} x2={s.x} y2={s.y} className="dimension-extension-line" />
                  <line x1={dim.end.x} y1={dim.end.y} x2={e.x} y2={e.y} className="dimension-extension-line" />
                  <line
                    x1={s.x} y1={s.y} x2={e.x} y2={e.y}
                    className="dimension-measure-line"
                    style={{ markerStart: 'url(#arrow-start)', markerEnd: 'url(#arrow-end)' }}
                  />
                  <text x={mx + 3} y={my - 3} className="dimension-label">{dimText}</text>
                </g>
              )
            })}

          {previewElement}
        </g>
      </svg>

      <div className="canvas-view-controls" role="group" aria-label="2D view controls">
        <button onClick={onZoomOut} aria-label="Zoom out">
          -
        </button>
        <button onClick={onZoomIn} aria-label="Zoom in">
          +
        </button>
        <button onClick={onFitView}>Fit</button>
        <button onClick={onResetView}>Reset</button>
      </div>

      <LayerLegendPanel
        show={showLayerLegend}
        legendMode={legendMode}
        onSetLegendMode={onSetLegendMode}
        sketchWorkspaceMode={sketchWorkspaceMode}
        layers={layers}
        lineTypes={lineTypes}
        layerColorsById={layerColorsById}
        fallbackLayerStroke={fallbackLayerStroke}
        stackLegendEntries={stackLegendEntries}
        cutStrokeColor={cutStrokeColor}
        stitchStrokeColor={stitchStrokeColor}
        foldStrokeColor={foldStrokeColor}
      />
    </section>
  )
}
