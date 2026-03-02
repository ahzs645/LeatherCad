import type { PointerEvent, PointerEventHandler, ReactElement, RefObject, WheelEventHandler } from 'react'
import { arcPath, round } from '../cad/cad-geometry'
import type {
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  Shape,
  StitchHole,
  TracingOverlay,
  Viewport,
} from '../cad/cad-types'
import { lineTypeStrokeDasharray } from '../cad/line-types'
import type { AnnotationLabel, LegendMode, ResolvedThemeMode, SeamGuide, SketchWorkspaceMode } from '../editor-types'
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
  gridLines: ReactElement[]
  tracingOverlays: TracingOverlay[]
  themeMode: ResolvedThemeMode
  showPrintAreas: boolean
  printPlan: PrintPlan | null
  seamGuides: SeamGuide[]
  showAnnotations: boolean
  visibleShapes: Shape[]
  linkedShapes: Shape[]
  sketchWorkspaceMode: SketchWorkspaceMode
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
  gridLines,
  tracingOverlays,
  themeMode,
  showPrintAreas,
  printPlan,
  seamGuides,
  showAnnotations,
  visibleShapes,
  linkedShapes,
  sketchWorkspaceMode,
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

          {tracingOverlays
            .filter((overlay) => overlay.visible)
            .map((overlay) => {
              const scale = Number(overlay.scale.toFixed(4))
              const transform = `translate(${round(overlay.offsetX)} ${round(overlay.offsetY)}) rotate(${round(
                overlay.rotationDeg,
              )}) scale(${scale})`
              const x = round(-overlay.width / 2)
              const y = round(-overlay.height / 2)
              if (overlay.kind === 'image') {
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
              }

              return (
                <g key={overlay.id} transform={transform} opacity={overlay.opacity}>
                  <rect
                    x={x}
                    y={y}
                    width={round(overlay.width)}
                    height={round(overlay.height)}
                    fill={themeMode === 'light' ? '#dbeafe' : '#1e293b'}
                    stroke={themeMode === 'light' ? '#1d4ed8' : '#93c5fd'}
                    strokeWidth={2}
                    strokeDasharray="8 4"
                  />
                  <text x={round(0)} y={round(0)} textAnchor="middle" className="tracing-pdf-label">
                    PDF Trace
                  </text>
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
            const lineTypeRole = lineType?.role ?? 'cut'
            const layerStroke =
              lineTypeRole === 'stitch'
                ? stitchStrokeColor
                : lineTypeRole === 'fold'
                  ? foldStrokeColor
                  : lineType?.color ??
                    (lineTypeRole === 'cut' ? cutStrokeColor : displayLayerColorsById[shape.layerId] ?? cutStrokeColor)
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
                  style={{ stroke: layerStroke, strokeDasharray }}
                />
              )
            }

            if (shape.type === 'arc') {
              return (
                <path
                  key={shape.id}
                  d={arcPath(shape.start, shape.mid, shape.end)}
                  className={linkedClassName}
                  style={{ stroke: layerStroke, strokeDasharray }}
                />
              )
            }

            return (
              <path
                key={shape.id}
                d={`M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(
                  shape.end.x,
                )} ${round(shape.end.y)}`}
                className={linkedClassName}
                style={{ stroke: layerStroke, strokeDasharray }}
              />
            )
          })}

          {visibleShapes.map((shape) => {
            const lineType = lineTypesById[shape.lineTypeId]
            const lineTypeRole = lineType?.role ?? 'cut'
            const isSelected = selectedShapeIdSet.has(shape.id)
            const layerStroke =
              lineTypeRole === 'stitch'
                ? stitchStrokeColor
                : lineTypeRole === 'fold'
                  ? foldStrokeColor
                  : lineType?.color ??
                    (lineTypeRole === 'cut' ? cutStrokeColor : displayLayerColorsById[shape.layerId] ?? cutStrokeColor)
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
                  style={{ stroke: layerStroke, strokeDasharray }}
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
                  style={{ stroke: layerStroke, strokeDasharray }}
                  onPointerDown={(event) => onShapePointerDown(event, shape.id)}
                />
              )
            }

            return (
              <path
                key={shape.id}
                d={`M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(
                  shape.end.x,
                )} ${round(shape.end.y)}`}
                className={isSelected ? 'shape-line shape-selected' : 'shape-line'}
                style={{ stroke: layerStroke, strokeDasharray }}
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

          {previewElement}
        </g>
      </svg>

      <LayerLegendPanel
        show={showLayerLegend}
        legendMode={legendMode}
        onSetLegendMode={onSetLegendMode}
        layers={layers}
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
