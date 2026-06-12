import { useMemo, useState, type PointerEvent, type PointerEventHandler, type ReactElement, type RefObject } from 'react'
import { CanvasContextMenu, type ContextMenuItem } from './CanvasContextMenu'
import type {
  DimensionLine,
  FoldLine,
  HardwareMarker,
  Layer,
  LeatherImageFill,
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
import type { DisplayUnit } from '../ops/unit-ops'
import type { PrintPlan } from '../preview/print-preview'
import { useCanvasGrid } from '../hooks/useCanvasGrid'
import { CanvasEngineV2 } from '../render-v2/CanvasEngineV2'
import { isEngineV2Enabled } from '../render-v2/engine-v2-flags'
import { buildCanvasRenderModel } from '../render/canvas-render-model'
import { useEditorToolSelector } from '../state/providers/EditorToolStateProvider'
import { safeLocalStorageGet } from '../ops/safe-storage'
import type { CanvasInteractionPreview } from '../hooks/useCanvasInteractions'
import { LayerLegendPanel } from './LayerLegendPanel'
import { CanvasAnnotationLayer } from './canvas/CanvasAnnotationLayer'
import { CanvasHardwareLayer } from './canvas/CanvasHardwareLayer'
import { CanvasInteractionOverlay } from './canvas/CanvasInteractionOverlay'
import { CanvasLeatherImageFillLayer } from './canvas/CanvasLeatherImageFillLayer'
import { CanvasShapeLayer } from './canvas/CanvasShapeLayer'
import { CanvasStitchLayer } from './canvas/CanvasStitchLayer'
import { CanvasViewportChrome } from './canvas/CanvasViewportChrome'
import {
  boundsIntersect,
  lineBounds,
  pointInBounds,
  shapeBounds,
  type Bounds,
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
  buildCanvasContextMenuItems?: () => ContextMenuItem[]
  showGrid?: boolean
  gridBackgroundMode?: 'light' | 'dark'
  onTracingOverlayOffset?: (overlayId: string, nextOffsetX: number, nextOffsetY: number) => void
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
  leatherImageFills: LeatherImageFill[]
  backdrops: import('../cad/cad-types').Backdrop[]
  activeBackdropId: string | null
  onBackdropLeftTop?: (backdropId: string, nextX: number, nextY: number) => void
  onSelectBackdrop?: (backdropId: string | null) => void
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
  layerStackLevels: Record<string, number>
  onShapePointerDown: (event: PointerEvent<SVGElement>, shapeId: string) => void
  onShapeHandlePointerDown: (
    event: PointerEvent<SVGCircleElement>,
    shapeId: string,
    pointKey: 'start' | 'mid' | 'control' | 'end',
  ) => void
  onShapeHandleDoubleClick?: (shapeId: string, pointKey: 'start' | 'mid' | 'control' | 'end') => void
  showShapeHandles: boolean
  visibleStitchHoles: StitchHole[]
  selectedStitchHoleId: string | null
  showStitchSequenceLabels: boolean
  onStitchHolePointerDown: (event: PointerEvent<SVGElement>, stitchHoleId: string) => void
  simulatedStitchSegments: import('../ops/stitch-simulator-ops').ThreadSegment[]
  stitchSimulatorSettings: import('../ops/stitch-simulator-ops').StitchSimulatorSettings | null
  stitchSimulatorTerminalHoleId: string | null
  hideRawStitchHoles?: boolean
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
  /** When non-null, off-layer shapes are dimmed (source `chkHighlightActiveLayer`). */
  highlightActiveLayerId?: string | null
  /** Source `chkDrawEdges` — overlay closed-outline chains for cut visualization. */
  drawEdges?: boolean
  /** Source `chkDrawFirstPos` — mark each stitch chain's first hole with a ring. */
  drawFirstPos?: boolean
}

const ESTIMATED_CANVAS_WIDTH_PX = 2600
const ESTIMATED_CANVAS_HEIGHT_PX = 1800

export function EditorCanvasPane({
  hideCanvasPane,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  buildCanvasContextMenuItems,
  showGrid = true,
  gridBackgroundMode = 'light',
  onTracingOverlayOffset,
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
  leatherImageFills,
  backdrops,
  activeBackdropId,
  onBackdropLeftTop,
  onSelectBackdrop,
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
  layerStackLevels,
  onShapePointerDown,
  onShapeHandlePointerDown,
  onShapeHandleDoubleClick,
  showShapeHandles,
  visibleStitchHoles,
  selectedStitchHoleId,
  showStitchSequenceLabels,
  onStitchHolePointerDown,
  simulatedStitchSegments,
  stitchSimulatorSettings,
  stitchSimulatorTerminalHoleId,
  hideRawStitchHoles,
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
  highlightActiveLayerId,
  drawEdges = false,
  drawFirstPos = false,
}: EditorCanvasPaneProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const { angleGuideLines, commandPreviewShapes, markedSnapPoints, snapIndicator } = useEditorToolSelector((state) => ({
    angleGuideLines: state.angleGuideLines,
    commandPreviewShapes: state.commandPreviewShapes,
    markedSnapPoints: state.markedSnapPoints,
    snapIndicator: state.snapIndicator,
  }))
  const { canvasRef: gridCanvasRef } = useCanvasGrid({ viewport, gridSpacing, displayUnit, showGrid, gridBackgroundMode })
  const shapeStrokeOpacity = sketchWorkspaceMode === 'assembly' ? 0.85 : 1
  const detailPadding = Math.max(32, 96 / Math.max(viewport.scale, 0.1))
  const showOpenPathLabels = typeof window !== 'undefined' && safeLocalStorageGet('leathercad_show_open_path_labels') === '1'

  const viewBounds = useMemo<Bounds>(() => {
    return {
      minX: (-viewport.x) / viewport.scale - detailPadding,
      minY: (-viewport.y) / viewport.scale - detailPadding,
      maxX: (ESTIMATED_CANVAS_WIDTH_PX - viewport.x) / viewport.scale + detailPadding,
      maxY: (ESTIMATED_CANVAS_HEIGHT_PX - viewport.y) / viewport.scale + detailPadding,
    }
  }, [detailPadding, viewport.scale, viewport.x, viewport.y])

  const renderModel = useMemo(
    () =>
      buildCanvasRenderModel({
        visibleShapes,
        linkedShapes,
        lineTypesById,
        layerStackLevels,
        selectedShapeIdSet,
        sketchWorkspaceMode,
        shapeStrokeOpacity,
        highlightActiveLayerId,
        displayLayerColorsById,
        fallbackLayerStroke,
        stitchStrokeColor,
        foldStrokeColor,
        cutStrokeColor,
        viewBounds,
        detailPadding,
        interactionPreview,
        transientPreviewShapes: commandPreviewShapes,
        visibleStitchHoles,
        visibleHardwareMarkers,
        foldLines,
        seamGuides,
        annotationLabels,
        dimensionLines,
        showAnnotations,
        showDimensions,
        showOpenPathLabels,
        viewportScale: viewport.scale,
        displayUnit,
        snapIndicator,
        markedSnapPoints,
        angleGuideLines,
        pieceEdgeLabels,
        constraintSuggestions,
        outlineChains,
        pieceGrainlineSegments,
        pieceNotchLines,
        piecePlacementGuides,
      }),
    [
      angleGuideLines,
      detailPadding,
      displayLayerColorsById,
      commandPreviewShapes,
      annotationLabels,
      dimensionLines,
      displayUnit,
      fallbackLayerStroke,
      foldLines,
      foldStrokeColor,
      highlightActiveLayerId,
      interactionPreview,
      layerStackLevels,
      linkedShapes,
      lineTypesById,
      markedSnapPoints,
      pieceGrainlineSegments,
      pieceNotchLines,
      piecePlacementGuides,
      pieceEdgeLabels,
      constraintSuggestions,
      outlineChains,
      seamGuides,
      selectedShapeIdSet,
      shapeStrokeOpacity,
      sketchWorkspaceMode,
      showAnnotations,
      showDimensions,
      showOpenPathLabels,
      snapIndicator,
      stitchStrokeColor,
      cutStrokeColor,
      viewport.scale,
      viewBounds,
      visibleHardwareMarkers,
      visibleShapes,
      visibleStitchHoles,
    ],
  )
  const renderableStitchHoles = renderModel.layers.stitchHoles
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
  const renderableHardwareMarkers = renderModel.layers.hardwareMarkers
  const renderablePieceGrainlineSegments = renderModel.layers.pieceGrainlineSegments
  const renderablePieceNotchLines = renderModel.layers.pieceNotchLines
  const renderablePlacementGuides = renderModel.layers.placementGuides
  const renderableOutlineChains = useMemo(
    () =>
      outlineChains.filter((chain) =>
        chain.polygon.some((point) => pointInBounds(point, viewBounds, detailPadding)),
      ),
    [detailPadding, outlineChains, viewBounds],
  )
  const renderableFoldLines = renderModel.layers.foldLines

  const engineV2 = isEngineV2Enabled()

  return (
    <section className={`canvas-pane ${hideCanvasPane ? 'panel-hidden' : ''}`} style={{ position: 'relative' }}>
      <canvas ref={gridCanvasRef} className="canvas-grid-layer" aria-hidden="true" />
      {engineV2 && (
        <CanvasEngineV2
          viewport={viewport}
          gridSpacing={gridSpacing}
          darkMode={gridBackgroundMode === 'dark'}
          entities={renderModel.entities.all}
          width={ESTIMATED_CANVAS_WIDTH_PX}
          height={ESTIMATED_CANVAS_HEIGHT_PX}
        />
      )}
      <svg
        ref={svgRef}
        className="canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(event) => {
          event.preventDefault()
          if (!buildCanvasContextMenuItems) return
          const items = buildCanvasContextMenuItems()
          if (items.length > 0) {
            setContextMenu({ x: event.clientX, y: event.clientY, items })
          }
        }}
      >
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
          <CanvasViewportChrome
            showCanvasRuler={showCanvasRuler}
            displayUnit={displayUnit}
            tracingOverlays={tracingOverlays}
            onTracingOverlayOffset={onTracingOverlayOffset}
            backdrops={backdrops}
            activeBackdropId={activeBackdropId}
            onBackdropLeftTop={onBackdropLeftTop}
            onSelectBackdrop={onSelectBackdrop}
            viewport={viewport}
            showPrintAreas={showPrintAreas}
            printPlan={printPlan}
            viewBounds={viewBounds}
            detailPadding={detailPadding}
          />

          <CanvasAnnotationLayer
            showAnnotations={showAnnotations}
            viewportScale={viewport.scale}
            pieceEdgeLabelEntities={renderModel.entities.pieceEdgeLabels}
            seamGuideEntities={renderModel.entities.seamGuides}
            annotationLabelEntities={renderModel.entities.annotationLabels}
            dimensionLabelEntities={renderModel.entities.dimensionLabels}
            dimensionLineEntities={renderModel.entities.dimensionLines}
            outlineChainLabelEntities={renderModel.entities.outlineChainLabels}
            constraintGlyphEntities={renderModel.entities.constraintGlyphs}
          />

          <CanvasLeatherImageFillLayer
            leatherImageFills={leatherImageFills}
            editableShapeEntities={renderModel.shapeLayers.editable}
            lineTypesById={lineTypesById}
          />

          <CanvasShapeLayer
            linkedShapeEntities={renderModel.layers.linkedShapes}
            editableShapeEntities={renderModel.layers.editableShapes}
            selectedShapeIdSet={selectedShapeIdSet}
            onShapePointerDown={onShapePointerDown}
            previewShapeEntities={renderModel.layers.previewShapes}
            showShapeHandles={showShapeHandles}
            onShapeHandlePointerDown={onShapeHandlePointerDown}
            onShapeHandleDoubleClick={onShapeHandleDoubleClick}
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
            previewShapeEntities={renderModel.layers.previewShapes.filter((entry) =>
              boundsIntersect(shapeBounds(entry.shape), viewBounds, detailPadding),
            )}
            selectionBoxEntities={renderModel.entities.selectionBoxes}
            snapAnchorEntities={renderModel.entities.snapAnchors}
            angleGuideEntities={renderModel.entities.angleGuides}
            previewElement={previewElement}
            onShapePointerDown={onShapePointerDown}
            buildTextGlyphPlacements={buildTextGlyphPlacements}
            normalizeTextShape={normalizeTextShape as (shape: TextShape) => TextShape}
            textBaselineAngleDeg={textBaselineAngleDeg as (shape: TextShape) => number}
          />

          {drawEdges && renderableOutlineChains.length > 0 ? (
            <g className="canvas-draw-edges-layer" pointerEvents="none">
              {renderableOutlineChains.map((chain, index) => (
                <polygon
                  key={`draw-edge-${index}`}
                  points={chain.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={1.4 / Math.max(viewport.scale, 0.1)}
                  strokeDasharray={`${4 / Math.max(viewport.scale, 0.1)} ${2 / Math.max(viewport.scale, 0.1)}`}
                  opacity={0.85}
                />
              ))}
            </g>
          ) : null}

          {drawFirstPos && renderableStitchHoles.length > 0 ? (
            <g className="canvas-first-pos-markers" pointerEvents="none">
              {(() => {
                const firstByChain = new Map<string, (typeof renderableStitchHoles)[number]>()
                for (const hole of renderableStitchHoles) {
                  const chainKey = hole.chainId ?? hole.shapeId
                  const current = firstByChain.get(chainKey)
                  if (!current || hole.sequence < current.sequence) {
                    firstByChain.set(chainKey, hole)
                  }
                }
                return Array.from(firstByChain.values()).map((hole) => (
                  <circle
                    key={`first-pos-${hole.id}`}
                    cx={hole.point.x}
                    cy={hole.point.y}
                    r={2.4 / Math.max(viewport.scale, 0.1)}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={0.6 / Math.max(viewport.scale, 0.1)}
                  />
                ))
              })()}
            </g>
          ) : null}

          <CanvasStitchLayer
            renderableStitchHoles={renderableStitchHoles}
            selectedStitchHoleId={selectedStitchHoleId}
            showStitchSequenceLabels={showStitchSequenceLabels}
            onStitchHolePointerDown={onStitchHolePointerDown}
            renderableSimulatedSegments={renderableSimulatedSegments}
            stitchSimulatorSettings={stitchSimulatorSettings}
            renderableTerminalHole={renderableTerminalHole}
            renderablePersistedTerminalHoles={renderablePersistedTerminalHoles}
            hideRawStitchHoles={hideRawStitchHoles}
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

      {contextMenu && (
        <CanvasContextMenu
          open
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </section>
  )
}
