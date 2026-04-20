import { useId, useMemo, type PointerEvent, type PointerEventHandler, type ReactElement, type RefObject } from 'react'
import { sampleShapePoints } from '../cad/cad-geometry'
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
import { buildTextGlyphPlacements, normalizeTextShape, textBaselineAngleDeg } from '../ops/text-shape-ops'
import type { AnnotationLabel, LegendMode, PiecePlacementGuide, SeamGuide, SketchWorkspaceMode } from '../editor-types'
import type { ConstraintSuggestion } from '../ops/auto-constraint-ops'
import { formatDisplayDistance, type DisplayUnit } from '../ops/unit-ops'
import type { PrintPlan } from '../preview/print-preview'
import { GRID_EXTENT } from '../editor-constants'
import { computeAdaptiveSpacing } from '../ops/grid-spacing'
import type { CanvasInteractionPreview } from '../hooks/useCanvasInteractions'
import { LayerLegendPanel } from './LayerLegendPanel'
import { CanvasAnnotationLayer } from './canvas/CanvasAnnotationLayer'
import { CanvasHardwareLayer } from './canvas/CanvasHardwareLayer'
import { CanvasInteractionOverlay } from './canvas/CanvasInteractionOverlay'
import { CanvasShapeLayer } from './canvas/CanvasShapeLayer'
import { CanvasStitchLayer } from './canvas/CanvasStitchLayer'
import { CanvasViewportChrome } from './canvas/CanvasViewportChrome'
import {
  boundsIntersect,
  lineBounds,
  pointInBounds,
  shapeBounds,
  type Bounds,
  withPreviewApplied,
} from './canvas/canvas-geometry'

type StackLegendEntry = {
  stackLevel: number
  layerNames: string[]
  swatchBackground: string
}

type PieceEdgeLabel = {
  id: string
  x: number
  y: number
  label: string
  active: boolean
}

export type EditorCanvasPaneProps = {
  hideCanvasPane: boolean
  svgRef: RefObject<SVGSVGElement | null>
  onPointerDown: PointerEventHandler<SVGSVGElement>
  onPointerMove: PointerEventHandler<SVGSVGElement>
  onPointerUp: PointerEventHandler<SVGSVGElement>
  viewport: Viewport
  displayUnit: DisplayUnit
  gridSpacing: number
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
  pieceEdgeLabels: PieceEdgeLabel[]
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
  simulatedStitchSegments: import('../ops/stitch-simulator-ops').ThreadSegment[]
  stitchSimulatorSettings: import('../ops/stitch-simulator-ops').StitchSimulatorSettings | null
  stitchSimulatorTerminalHoleId: string | null
  visibleHardwareMarkers: HardwareMarker[]
  selectedHardwareMarkerId: string | null
  onHardwarePointerDown: (event: PointerEvent<SVGGElement>, markerId: string) => void
  foldLines: FoldLine[]
  annotationLabels: AnnotationLabel[]
  constraintSuggestions: ConstraintSuggestion[]
  previewElement: ReactElement | null
  interactionPreview: CanvasInteractionPreview | null
  showLayerLegend: boolean
  legendMode: LegendMode
  onSetLegendMode: (mode: LegendMode) => void
  layers: Layer[]
  layerColorsById: Record<string, string>
  fallbackLayerStroke: string
  stackLegendEntries: StackLegendEntry[]
  outlineChains: import('../ops/outline-detection').OutlineChain[]
}

const ESTIMATED_CANVAS_WIDTH_PX = 2600
const ESTIMATED_CANVAS_HEIGHT_PX = 1800

export function EditorCanvasPane({
  hideCanvasPane,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  viewport,
  displayUnit,
  gridSpacing,
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
  pieceEdgeLabels,
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
  simulatedStitchSegments,
  stitchSimulatorSettings,
  stitchSimulatorTerminalHoleId,
  visibleHardwareMarkers,
  selectedHardwareMarkerId,
  onHardwarePointerDown,
  foldLines,
  annotationLabels,
  constraintSuggestions,
  previewElement,
  interactionPreview,
  showLayerLegend,
  legendMode,
  onSetLegendMode,
  layers,
  layerColorsById,
  fallbackLayerStroke,
  stackLegendEntries,
  outlineChains,
}: EditorCanvasPaneProps) {
  const patternIdBase = useId().replace(/:/g, '-')
  const minorGridPatternId = `${patternIdBase}-minor-grid`
  const majorGridPatternId = `${patternIdBase}-major-grid`
  const { major: majorGridStep, minor: minorGridStep } = computeAdaptiveSpacing(viewport.scale, gridSpacing)
  const shapeStrokeOpacity = sketchWorkspaceMode === 'assembly' ? 0.85 : 1
  const detailPadding = Math.max(32, 96 / Math.max(viewport.scale, 0.1))

  const viewBounds = useMemo<Bounds>(() => {
    return {
      minX: (-viewport.x) / viewport.scale - detailPadding,
      minY: (-viewport.y) / viewport.scale - detailPadding,
      maxX: (ESTIMATED_CANVAS_WIDTH_PX - viewport.x) / viewport.scale + detailPadding,
      maxY: (ESTIMATED_CANVAS_HEIGHT_PX - viewport.y) / viewport.scale + detailPadding,
    }
  }, [detailPadding, viewport.scale, viewport.x, viewport.y])

  const previewShapeIdSet = interactionPreview
    ? interactionPreview.kind === 'move'
      ? new Set(interactionPreview.shapeIds)
      : new Set([interactionPreview.shapeId])
    : new Set<string>()

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

  const renderableVisibleShapes = useMemo(
    () => visibleShapes.filter((shape) => boundsIntersect(shapeBounds(shape), viewBounds, detailPadding)),
    [detailPadding, viewBounds, visibleShapes],
  )
  const renderableLinkedShapes = useMemo(
    () => linkedShapes.filter((shape) => boundsIntersect(shapeBounds(shape), viewBounds, detailPadding)),
    [detailPadding, linkedShapes, viewBounds],
  )
  const previewShapes = useMemo(() => {
    if (!interactionPreview) {
      return [] as Shape[]
    }
    const matchesPreviewShape = interactionPreview.kind === 'move'
      ? (shape: Shape) => interactionPreview.shapeIds.includes(shape.id)
      : (shape: Shape) => shape.id === interactionPreview.shapeId
    return visibleShapes
      .filter(matchesPreviewShape)
      .map((shape) => withPreviewApplied(shape, interactionPreview))
  }, [interactionPreview, visibleShapes])

  const renderablePieceEdgeLabels = useMemo(
    () =>
      viewport.scale >= 0.55
        ? pieceEdgeLabels.filter((entry) => pointInBounds({ x: entry.x, y: entry.y }, viewBounds, detailPadding))
        : [],
    [detailPadding, pieceEdgeLabels, viewBounds, viewport.scale],
  )
  const renderableStitchHoles = useMemo(
    () => visibleStitchHoles.filter((entry) => pointInBounds(entry.point, viewBounds, detailPadding)),
    [detailPadding, viewBounds, visibleStitchHoles],
  )
  const renderableSimulatedSegments = useMemo(
    () =>
      simulatedStitchSegments.filter((segment) =>
        boundsIntersect(lineBounds(segment.from, segment.to), viewBounds, detailPadding),
      ),
    [detailPadding, simulatedStitchSegments, viewBounds],
  )
  const renderableTerminalHole = useMemo(
    () =>
      renderableStitchHoles.find((hole) => hole.id === stitchSimulatorTerminalHoleId) ??
      visibleStitchHoles.find(
        (hole) => hole.id === stitchSimulatorTerminalHoleId && pointInBounds(hole.point, viewBounds, detailPadding),
      ) ??
      null,
    [detailPadding, renderableStitchHoles, stitchSimulatorTerminalHoleId, viewBounds, visibleStitchHoles],
  )
  const renderablePersistedTerminalHoles = useMemo(
    () => renderableStitchHoles.filter((hole) => hole.endHole === true),
    [renderableStitchHoles],
  )
  const renderableHardwareMarkers = useMemo(
    () => visibleHardwareMarkers.filter((entry) => pointInBounds(entry.point, viewBounds, detailPadding)),
    [detailPadding, viewBounds, visibleHardwareMarkers],
  )
  const renderablePieceGrainlineSegments = useMemo(
    () =>
      pieceGrainlineSegments.filter((segment) => boundsIntersect(lineBounds(segment.start, segment.end), viewBounds, detailPadding)),
    [detailPadding, pieceGrainlineSegments, viewBounds],
  )
  const renderablePieceNotchLines = useMemo(
    () =>
      pieceNotchLines.filter((notch) => boundsIntersect(lineBounds(notch.start, notch.end), viewBounds, detailPadding)),
    [detailPadding, pieceNotchLines, viewBounds],
  )
  const renderablePlacementGuides = useMemo(
    () => piecePlacementGuides.filter((guide) => pointInBounds(guide.point, viewBounds, detailPadding)),
    [detailPadding, piecePlacementGuides, viewBounds],
  )
  const renderableAnnotationLabels = useMemo(
    () =>
      viewport.scale >= 0.35
        ? annotationLabels.filter((label) => pointInBounds(label.point, viewBounds, detailPadding))
        : [],
    [annotationLabels, detailPadding, viewBounds, viewport.scale],
  )
  const renderableConstraintSuggestions = useMemo(
    () =>
      viewport.scale >= 0.45
        ? constraintSuggestions.filter((entry) => pointInBounds(entry.glyphPoint, viewBounds, detailPadding))
        : [],
    [constraintSuggestions, detailPadding, viewBounds, viewport.scale],
  )
  const renderableOutlineChains = useMemo(
    () =>
      outlineChains.filter((chain) =>
        chain.polygon.some((point) => pointInBounds(point, viewBounds, detailPadding)),
      ),
    [detailPadding, outlineChains, viewBounds],
  )
  const renderableFoldLines = useMemo(
    () => foldLines.filter((line) => boundsIntersect(lineBounds(line.start, line.end), viewBounds, detailPadding)),
    [detailPadding, foldLines, viewBounds],
  )

  const hasImportedDimensions = dimensionLines.length > 0
  const dimensionShapes = showDimensions && !hasImportedDimensions
    ? selectedShapeIdSet.size > 0
      ? renderableVisibleShapes.filter((shape) => selectedShapeIdSet.has(shape.id))
      : renderableVisibleShapes.slice(0, 40)
    : []

  const dimensionEntries = viewport.scale >= 0.45
    ? dimensionShapes
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
        onContextMenu={(event) => event.preventDefault()}
      >
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
          <CanvasViewportChrome
            minorGridPatternId={minorGridPatternId}
            majorGridPatternId={majorGridPatternId}
            minorGridStep={minorGridStep}
            gridSpacing={majorGridStep}
            gridExtent={GRID_EXTENT}
            showCanvasRuler={showCanvasRuler}
            displayUnit={displayUnit}
            tracingOverlays={tracingOverlays}
            showPrintAreas={showPrintAreas}
            printPlan={printPlan}
            viewBounds={viewBounds}
            detailPadding={detailPadding}
          />

          <CanvasAnnotationLayer
            seamGuides={seamGuides}
            showAnnotations={showAnnotations}
            viewportScale={viewport.scale}
            viewBounds={viewBounds}
            detailPadding={detailPadding}
            renderablePieceEdgeLabels={renderablePieceEdgeLabels}
            renderableAnnotationLabels={renderableAnnotationLabels}
            renderableOutlineChains={renderableOutlineChains}
            renderableConstraintSuggestions={renderableConstraintSuggestions}
            dimensionEntries={dimensionEntries}
            showDimensions={showDimensions}
            dimensionLines={dimensionLines}
            displayUnit={displayUnit}
          />

          <CanvasShapeLayer
            renderableLinkedShapes={renderableLinkedShapes}
            renderableVisibleShapes={renderableVisibleShapes}
            previewShapeIdSet={previewShapeIdSet}
            selectedShapeIdSet={selectedShapeIdSet}
            lineTypesById={lineTypesById}
            sketchWorkspaceMode={sketchWorkspaceMode}
            resolveShapeStrokeColor={resolveShapeStrokeColor}
            shapeStrokeOpacity={shapeStrokeOpacity}
            onShapePointerDown={onShapePointerDown}
            previewShapes={previewShapes}
            showShapeHandles={showShapeHandles}
            onShapeHandlePointerDown={onShapeHandlePointerDown}
            renderableFoldLines={renderableFoldLines}
            renderablePieceGrainlineSegments={renderablePieceGrainlineSegments}
            renderablePieceNotchLines={renderablePieceNotchLines}
            renderablePlacementGuides={renderablePlacementGuides}
            viewportScale={viewport.scale}
            buildTextGlyphPlacements={buildTextGlyphPlacements}
            normalizeTextShape={normalizeTextShape as (shape: TextShape) => TextShape}
            textBaselineAngleDeg={textBaselineAngleDeg as (shape: TextShape) => number}
          />

          <CanvasInteractionOverlay
            interactionPreview={interactionPreview}
            previewShapes={previewShapes.filter((shape) => boundsIntersect(shapeBounds(shape), viewBounds, detailPadding))}
            previewElement={previewElement}
            lineTypesById={lineTypesById}
            resolveShapeStrokeColor={resolveShapeStrokeColor}
            shapeStrokeOpacity={shapeStrokeOpacity}
            onShapePointerDown={onShapePointerDown}
            buildTextGlyphPlacements={buildTextGlyphPlacements}
            normalizeTextShape={normalizeTextShape as (shape: TextShape) => TextShape}
            textBaselineAngleDeg={textBaselineAngleDeg as (shape: TextShape) => number}
          />

          <CanvasStitchLayer
            renderableStitchHoles={renderableStitchHoles}
            selectedStitchHoleId={selectedStitchHoleId}
            showStitchSequenceLabels={showStitchSequenceLabels}
            onStitchHolePointerDown={onStitchHolePointerDown}
            renderableSimulatedSegments={renderableSimulatedSegments}
            stitchSimulatorSettings={stitchSimulatorSettings}
            renderableTerminalHole={renderableTerminalHole}
            renderablePersistedTerminalHoles={renderablePersistedTerminalHoles}
            viewportScale={viewport.scale}
          />

          <CanvasHardwareLayer
            renderableHardwareMarkers={renderableHardwareMarkers}
            selectedHardwareMarkerId={selectedHardwareMarkerId}
            viewportScale={viewport.scale}
            onHardwarePointerDown={onHardwarePointerDown}
          />
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
