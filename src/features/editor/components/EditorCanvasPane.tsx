import type { PointerEvent, PointerEventHandler, ReactElement, RefObject, WheelEventHandler } from 'react'
import { arcPath, round, sampleShapePoints } from '../cad/cad-geometry'
import type {
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  Shape,
  StitchHole,
  TextShape,
  TracingOverlay,
  Viewport,
} from '../cad/cad-types'
import { lineTypeStrokeDasharray } from '../cad/line-types'
import { buildTextGlyphPlacements, normalizeTextShape, textBaselineAngleDeg } from '../ops/text-shape-ops'
import type { AnnotationLabel, LegendMode, SeamGuide, SketchWorkspaceMode } from '../editor-types'
import { formatDisplayDistance, type DisplayUnit } from '../ops/unit-ops'
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
  tracingOverlays: TracingOverlay[]
  showPrintAreas: boolean
  printPlan: PrintPlan | null
  seamGuides: SeamGuide[]
  showAnnotations: boolean
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
  visibleStitchHoles: StitchHole[]
  selectedStitchHoleId: string | null
  showStitchSequenceLabels: boolean
  onStitchHolePointerDown: (event: PointerEvent<SVGElement>, stitchHoleId: string) => void
  visibleHardwareMarkers: HardwareMarker[]
  selectedHardwareMarkerId: string | null
  onHardwarePointerDown: (event: PointerEvent<SVGGElement>, markerId: string) => void
  foldLines: FoldLine[]
  annotationLabels: AnnotationLabel[]
  previewElement: ReactElement | null
  showLayerLegend: boolean
  legendMode: LegendMode
  onSetLegendMode: (mode: LegendMode) => void
  layers: Layer[]
  layerColorsById: Record<string, string>
  fallbackLayerStroke: string
  stackLegendEntries: StackLegendEntry[]
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
  tracingOverlays,
  showPrintAreas,
  printPlan,
  seamGuides,
  showAnnotations,
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
  visibleStitchHoles,
  selectedStitchHoleId,
  showStitchSequenceLabels,
  onStitchHolePointerDown,
  visibleHardwareMarkers,
  selectedHardwareMarkerId,
  onHardwarePointerDown,
  foldLines,
  annotationLabels,
  previewElement,
  showLayerLegend,
  legendMode,
  onSetLegendMode,
  layers,
  layerColorsById,
  fallbackLayerStroke,
  stackLegendEntries,
}: EditorCanvasPaneProps) {
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
              <text x={10} y={-10} className="xy-ruler-origin">
                0,0
              </text>
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
                  style={{ stroke: layerStroke, strokeDasharray, strokeOpacity: shapeStrokeOpacity }}
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
                  style={{ stroke: layerStroke, strokeDasharray, strokeOpacity: shapeStrokeOpacity }}
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
                style={{ stroke: layerStroke, strokeDasharray, strokeOpacity: shapeStrokeOpacity }}
                onPointerDown={(event) => onShapePointerDown(event, shape.id)}
              />
            )
          })}

          {visibleStitchHoles.map((stitchHole) => {
            const isSelected = stitchHole.id === selectedStitchHoleId
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

            return (
              <g key={stitchHole.id}>
                <circle
                  cx={stitchHole.point.x}
                  cy={stitchHole.point.y}
                  r={2.2}
                  className={isSelected ? 'stitch-hole-dot stitch-hole-dot-selected' : 'stitch-hole-dot'}
                  onPointerDown={(event) => onStitchHolePointerDown(event, stitchHole.id)}
                />
                {showStitchSequenceLabels && (
                  <text x={stitchHole.point.x + 3.2} y={stitchHole.point.y - 3.2} className="stitch-hole-sequence-label">
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

          {annotationLabels.map((label) => (
            <text key={label.id} x={label.point.x} y={label.point.y} className="annotation-label">
              {label.text}
            </text>
          ))}

          {dimensionEntries.map((entry) => (
            <text key={`dim-${entry.id}`} x={entry.x} y={entry.y} className="dimension-label">
              {entry.text}
            </text>
          ))}

          {previewElement}
        </g>
      </svg>

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
