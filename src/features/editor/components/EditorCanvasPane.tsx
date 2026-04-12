import { useId, useMemo, type PointerEvent, type PointerEventHandler, type ReactElement, type RefObject } from 'react'
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
import { createStitchHolePrimitive } from '../ops/stitch-hole-render'
import type { StitchSimulatorSettings, ThreadSegment } from '../ops/stitch-simulator-ops'
import { buildTextGlyphPlacements, normalizeTextShape, textBaselineAngleDeg } from '../ops/text-shape-ops'
import type { AnnotationLabel, LegendMode, PiecePlacementGuide, SeamGuide, SketchWorkspaceMode } from '../editor-types'
import type { ConstraintSuggestion } from '../ops/auto-constraint-ops'
import { formatDisplayDistance, type DisplayUnit } from '../ops/unit-ops'
import { chainCentroid, type OutlineChain } from '../ops/outline-detection'
import type { PrintPlan } from '../preview/print-preview'
import { GRID_EXTENT } from '../editor-constants'
import type { CanvasInteractionPreview, HandlePointKey } from '../hooks/useCanvasInteractions'
import { LayerLegendPanel } from './LayerLegendPanel'

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

type EditorCanvasPaneProps = {
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
  simulatedStitchSegments: ThreadSegment[]
  stitchSimulatorSettings: StitchSimulatorSettings | null
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
  outlineChains: OutlineChain[]
}

type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function boundsIntersect(bounds: Bounds, viewportBounds: Bounds, padding = 0) {
  return !(
    bounds.maxX < viewportBounds.minX - padding ||
    bounds.minX > viewportBounds.maxX + padding ||
    bounds.maxY < viewportBounds.minY - padding ||
    bounds.minY > viewportBounds.maxY + padding
  )
}

function pointInBounds(point: Point, viewportBounds: Bounds, padding = 0) {
  return (
    point.x >= viewportBounds.minX - padding &&
    point.x <= viewportBounds.maxX + padding &&
    point.y >= viewportBounds.minY - padding &&
    point.y <= viewportBounds.maxY + padding
  )
}

function shapeBounds(shape: Shape): Bounds {
  if (shape.type === 'line' || shape.type === 'text') {
    return {
      minX: Math.min(shape.start.x, shape.end.x),
      minY: Math.min(shape.start.y, shape.end.y),
      maxX: Math.max(shape.start.x, shape.end.x),
      maxY: Math.max(shape.start.y, shape.end.y),
    }
  }

  if (shape.type === 'arc') {
    return {
      minX: Math.min(shape.start.x, shape.mid.x, shape.end.x),
      minY: Math.min(shape.start.y, shape.mid.y, shape.end.y),
      maxX: Math.max(shape.start.x, shape.mid.x, shape.end.x),
      maxY: Math.max(shape.start.y, shape.mid.y, shape.end.y),
    }
  }

  return {
    minX: Math.min(shape.start.x, shape.control.x, shape.end.x),
    minY: Math.min(shape.start.y, shape.control.y, shape.end.y),
    maxX: Math.max(shape.start.x, shape.control.x, shape.end.x),
    maxY: Math.max(shape.start.y, shape.control.y, shape.end.y),
  }
}

function lineBounds(start: Point, end: Point): Bounds {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  }
}

function pointAlongSegment(from: Point, to: Point, distanceFromEnd: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return { ...to }
  }

  const clampedDistance = Math.max(0, Math.min(length, distanceFromEnd))
  const ratio = (length - clampedDistance) / length
  return {
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
  }
}

function buildDirectionArrowPoints(segment: ThreadSegment, size: number) {
  const dx = segment.to.x - segment.from.x
  const dy = segment.to.y - segment.from.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return null
  }

  const ux = dx / length
  const uy = dy / length
  const tip = pointAlongSegment(segment.from, segment.to, size * 0.8)
  const baseCenter = pointAlongSegment(segment.from, segment.to, size * 2.1)
  const normalX = -uy
  const normalY = ux

  return [
    `${tip.x},${tip.y}`,
    `${baseCenter.x + normalX * size * 0.8},${baseCenter.y + normalY * size * 0.8}`,
    `${baseCenter.x - normalX * size * 0.8},${baseCenter.y - normalY * size * 0.8}`,
  ].join(' ')
}

function withPreviewApplied(shape: Shape, preview: CanvasInteractionPreview): Shape {
  if (preview.kind === 'move') {
    if (shape.type === 'line') {
      return {
        ...shape,
        start: { x: shape.start.x + preview.deltaX, y: shape.start.y + preview.deltaY },
        end: { x: shape.end.x + preview.deltaX, y: shape.end.y + preview.deltaY },
      }
    }
    if (shape.type === 'arc') {
      return {
        ...shape,
        start: { x: shape.start.x + preview.deltaX, y: shape.start.y + preview.deltaY },
        mid: { x: shape.mid.x + preview.deltaX, y: shape.mid.y + preview.deltaY },
        end: { x: shape.end.x + preview.deltaX, y: shape.end.y + preview.deltaY },
      }
    }
    if (shape.type === 'bezier') {
      return {
        ...shape,
        start: { x: shape.start.x + preview.deltaX, y: shape.start.y + preview.deltaY },
        control: { x: shape.control.x + preview.deltaX, y: shape.control.y + preview.deltaY },
        end: { x: shape.end.x + preview.deltaX, y: shape.end.y + preview.deltaY },
      }
    }
    return {
      ...shape,
      start: { x: shape.start.x + preview.deltaX, y: shape.start.y + preview.deltaY },
      end: { x: shape.end.x + preview.deltaX, y: shape.end.y + preview.deltaY },
    }
  }

  if (shape.id !== preview.shapeId) {
    return shape
  }

  if (shape.type === 'line' || shape.type === 'text') {
    if (preview.pointKey === 'start' || preview.pointKey === 'end') {
      return {
        ...shape,
        [preview.pointKey]: preview.point,
      }
    }
    return shape
  }

  if (shape.type === 'arc') {
    if (preview.pointKey === 'start' || preview.pointKey === 'mid' || preview.pointKey === 'end') {
      return {
        ...shape,
        [preview.pointKey]: preview.point,
      }
    }
    return shape
  }

  if (preview.pointKey === 'start' || preview.pointKey === 'control' || preview.pointKey === 'end') {
    return {
      ...shape,
      [preview.pointKey]: preview.point,
    }
  }

  return shape
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

  const shapeHandleEntries = (shape: Shape): Array<{ key: HandlePointKey; point: Point }> => {
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

  const minorGridStep = Math.max(gridSpacing / (gridSpacing <= 2 ? 2 : 5), 0.1)
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
    () =>
      renderableStitchHoles.filter((hole) => hole.endHole === true),
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

  const renderTextShape = (shape: TextShape, options: { key: string; color: string; className: string; opacity: number; interactive: boolean }) => {
    const normalized = normalizeTextShape(shape)
    const fontSize = Math.max(4, round(normalized.fontSizeMm))

    if (normalized.transform === 'none') {
      const baselineAngle = textBaselineAngleDeg(normalized)
      return (
        <text
          key={options.key}
          x={round(normalized.start.x)}
          y={round(normalized.start.y)}
          className={options.className}
          style={{
            fill: options.color,
            fontFamily: normalized.fontFamily,
            fontSize: `${fontSize}px`,
            opacity: options.opacity,
            pointerEvents: options.interactive ? 'auto' : 'none',
          }}
          transform={`rotate(${round(baselineAngle)} ${round(normalized.start.x)} ${round(normalized.start.y)})`}
          onPointerDown={options.interactive ? (event) => onShapePointerDown(event, shape.id) : undefined}
        >
          {normalized.text}
        </text>
      )
    }

    const glyphs = buildTextGlyphPlacements(normalized)
    return (
      <g key={options.key} style={{ pointerEvents: options.interactive ? 'auto' : 'none' }}>
        {glyphs.map((glyph, index) => (
          <text
            key={`${shape.id}-glyph-${index}`}
            x={round(glyph.x)}
            y={round(glyph.y)}
            className={options.className}
            style={{
              fill: options.color,
              fontFamily: normalized.fontFamily,
              fontSize: `${fontSize}px`,
              opacity: options.opacity,
            }}
            transform={`rotate(${round(glyph.rotationDeg)} ${round(glyph.x)} ${round(glyph.y)})`}
            textAnchor="middle"
            dominantBaseline="middle"
            onPointerDown={options.interactive ? (event) => onShapePointerDown(event, shape.id) : undefined}
          >
            {glyph.char}
          </text>
        ))}
      </g>
    )
  }

  const renderShape = (shape: Shape, options: { key: string; className: string; color: string; strokeDasharray?: string; opacity: number; interactive: boolean }) => {
    if (shape.type === 'text') {
      return renderTextShape(shape, {
        key: options.key,
        color: options.color,
        className: options.className,
        opacity: options.opacity,
        interactive: options.interactive,
      })
    }

    if (shape.type === 'line') {
      return (
        <line
          key={options.key}
          x1={shape.start.x}
          y1={shape.start.y}
          x2={shape.end.x}
          y2={shape.end.y}
          className={options.className}
          style={{ stroke: options.color, strokeDasharray: options.strokeDasharray, strokeOpacity: options.opacity, ...arrowMarkerStyle(shape) }}
          onPointerDown={options.interactive ? (event) => onShapePointerDown(event, shape.id) : undefined}
        />
      )
    }

    if (shape.type === 'arc') {
      return (
        <path
          key={options.key}
          d={arcPath(shape.start, shape.mid, shape.end)}
          className={options.className}
          style={{ stroke: options.color, strokeDasharray: options.strokeDasharray, strokeOpacity: options.opacity, ...arrowMarkerStyle(shape) }}
          onPointerDown={options.interactive ? (event) => onShapePointerDown(event, shape.id) : undefined}
        />
      )
    }

    return (
      <path
        key={options.key}
        d={`M ${round(shape.start.x)} ${round(shape.start.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(
          shape.end.x,
        )} ${round(shape.end.y)}`}
        className={options.className}
        style={{ stroke: options.color, strokeDasharray: options.strokeDasharray, strokeOpacity: options.opacity, ...arrowMarkerStyle(shape) }}
        onPointerDown={options.interactive ? (event) => onShapePointerDown(event, shape.id) : undefined}
      />
    )
  }

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
        onContextMenu={(event) => event.preventDefault()}
      >
        <defs>
          <marker id="arrow-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
            <polygon points="0 0, 10 3.5, 0 7" fill="context-stroke" />
          </marker>
          <marker id="arrow-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto" markerUnits="strokeWidth">
            <polygon points="10 0, 0 3.5, 10 7" fill="context-stroke" />
          </marker>
          <pattern id={minorGridPatternId} width={minorGridStep} height={minorGridStep} patternUnits="userSpaceOnUse">
            <path d={`M ${minorGridStep} 0 L 0 0 0 ${minorGridStep}`} className="grid-line-minor" fill="none" />
          </pattern>
          <pattern id={majorGridPatternId} width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse">
            <rect width={gridSpacing} height={gridSpacing} fill={`url(#${minorGridPatternId})`} />
            <path d={`M ${gridSpacing} 0 L 0 0 0 ${gridSpacing}`} className="grid-line" fill="none" />
          </pattern>
        </defs>
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
          <g className="canvas-grid-layer" style={{ pointerEvents: 'none' }}>
            <rect
              x={-GRID_EXTENT}
              y={-GRID_EXTENT}
              width={GRID_EXTENT * 2}
              height={GRID_EXTENT * 2}
              fill={`url(#${majorGridPatternId})`}
            />
            <line x1={-GRID_EXTENT} y1={0} x2={GRID_EXTENT} y2={0} className="axis-line" />
            <line x1={0} y1={-GRID_EXTENT} x2={0} y2={GRID_EXTENT} className="axis-line" />
          </g>

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

          <g className="canvas-tracing-layer">
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
          </g>

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

          <g className="canvas-guide-layer">
            {seamGuides.map((guide) => (
              <g key={guide.id}>
                <path d={guide.d} className="seam-guide-line" />
                {showAnnotations && viewport.scale >= 0.35 && pointInBounds(guide.labelPoint, viewBounds, detailPadding) && (
                  <text x={guide.labelPoint.x + 5} y={guide.labelPoint.y + 5} className="seam-guide-label">
                    {`${guide.offsetMm.toFixed(1)}mm seam`}
                  </text>
                )}
              </g>
            ))}
            {renderablePieceEdgeLabels.map((entry) => (
              <g key={entry.id} style={{ pointerEvents: 'none' }}>
                <circle
                  cx={entry.x}
                  cy={entry.y}
                  r={5.5}
                  fill={entry.active ? 'rgba(249, 115, 22, 0.92)' : 'rgba(15, 23, 42, 0.8)'}
                  stroke={entry.active ? '#fed7aa' : 'rgba(255,255,255,0.24)'}
                  strokeWidth={0.7}
                />
                <text
                  x={entry.x}
                  y={entry.y + 0.4}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fill: '#f8fafc',
                    fontSize: '5px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}
                >
                  {entry.label}
                </text>
              </g>
            ))}
          </g>

          <g className="canvas-linked-geometry-layer">
            {renderableLinkedShapes.map((shape) => {
              const lineType = lineTypesById[shape.lineTypeId]
              const layerStroke = resolveShapeStrokeColor(shape)
              const strokeDasharray = sketchWorkspaceMode === 'sketch' ? '8 5' : lineTypeStrokeDasharray(lineType?.style ?? 'solid')
              const linkedClassName = shape.type === 'text'
                ? 'annotation-label text-shape'
                : sketchWorkspaceMode === 'sketch'
                  ? 'shape-line shape-linked-reference'
                  : 'shape-line shape-linked-assembly'

              return renderShape(shape, {
                key: shape.id,
                className: linkedClassName,
                color: layerStroke,
                strokeDasharray,
                opacity: shape.type === 'text' ? 0.7 : shapeStrokeOpacity,
                interactive: false,
              })
            })}
          </g>

          <g className="canvas-editable-geometry-layer">
            {renderableVisibleShapes.map((shape) => {
              const lineType = lineTypesById[shape.lineTypeId]
              const isSelected = selectedShapeIdSet.has(shape.id)
              const isPreviewSource = previewShapeIdSet.has(shape.id)
              const layerStroke = resolveShapeStrokeColor(shape)
              const strokeDasharray = lineTypeStrokeDasharray(lineType?.style ?? 'solid')
              const className = shape.type === 'text'
                ? `${isSelected ? 'annotation-label text-shape text-shape-selected' : 'annotation-label text-shape'}${isPreviewSource ? ' shape-preview-source' : ''}`
                : `${isSelected ? 'shape-line shape-selected' : 'shape-line'}${isPreviewSource ? ' shape-preview-source' : ''}`

              return renderShape(shape, {
                key: shape.id,
                className,
                color: layerStroke,
                strokeDasharray,
                opacity: isPreviewSource ? Math.min(shapeStrokeOpacity, 0.2) : shapeStrokeOpacity,
                interactive: true,
              })
            })}
          </g>

          {interactionPreview && (
            <g className="canvas-interaction-preview-layer">
              {previewShapes
                .filter((shape) => boundsIntersect(shapeBounds(shape), viewBounds, detailPadding))
                .map((shape) => {
                  const lineType = lineTypesById[shape.lineTypeId]
                  const layerStroke = resolveShapeStrokeColor(shape)
                  const strokeDasharray = lineTypeStrokeDasharray(lineType?.style ?? 'solid')
                  const className = shape.type === 'text'
                    ? 'annotation-label text-shape text-shape-selected shape-live-preview'
                    : 'shape-line shape-selected shape-live-preview'

                  return renderShape(shape, {
                    key: `${shape.id}-preview`,
                    className,
                    color: layerStroke,
                    strokeDasharray,
                    opacity: 0.95,
                    interactive: false,
                  })
                })}
            </g>
          )}

          {showShapeHandles && (
            <g className="canvas-handle-layer">
              {renderableVisibleShapes
                .filter((shape) => selectedShapeIdSet.has(shape.id) && !previewShapeIdSet.has(shape.id))
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
              {previewShapes
                .filter((shape) => selectedShapeIdSet.has(shape.id))
                .flatMap((shape) =>
                  shapeHandleEntries(shape).map((entry) => (
                    <circle
                      key={`${shape.id}-${entry.key}-preview-handle`}
                      cx={entry.point.x}
                      cy={entry.point.y}
                      r={2.3}
                      className="shape-handle shape-handle-preview"
                      onPointerDown={(event) => onShapeHandlePointerDown(event, shape.id, entry.key)}
                    />
                  )),
                )}
            </g>
          )}

          {/* Stitch connecting lines (drawn first, behind holes) */}
          {!stitchSimulatorSettings?.showSimulatorPattern && (() => {
            const sorted = [...renderableStitchHoles].sort((a, b) => a.sequence - b.sequence)
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

          {stitchSimulatorSettings?.showSimulatorPattern && renderableSimulatedSegments.length > 0 && (
            <g className="stitch-simulator-layer" pointerEvents="none">
              {renderableSimulatedSegments.map((segment) => {
                const color =
                  segment.threadIndex === 0
                    ? stitchSimulatorSettings.threadColor
                    : stitchSimulatorSettings.secondThreadColor
                const strokeWidth = Math.max(0.35, stitchSimulatorSettings.threadWidthMm)
                const arrowPoints = stitchSimulatorSettings.showDirectionArrows
                  ? buildDirectionArrowPoints(segment, Math.max(1.8, strokeWidth * 3.4))
                  : null

                return (
                  <g key={`${segment.threadIndex}-${segment.stepIndex}-${segment.side}-${segment.from.x}-${segment.to.x}`}>
                    <line
                      x1={segment.from.x}
                      y1={segment.from.y}
                      x2={segment.to.x}
                      y2={segment.to.y}
                      stroke={color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeDasharray={segment.side === 'back' ? `${strokeWidth * 2.5} ${strokeWidth * 1.75}` : undefined}
                      opacity={segment.side === 'back' ? 0.58 : 0.94}
                    />
                    {arrowPoints && (
                      <polygon
                        points={arrowPoints}
                        fill={color}
                        opacity={segment.side === 'back' ? 0.7 : 0.95}
                      />
                    )}
                  </g>
                )
              })}
            </g>
          )}

          {renderablePersistedTerminalHoles.map((terminalHole) => {
            const primitive = createStitchHolePrimitive(terminalHole)
            const radius = Math.max(
              1.8,
              primitive.kind === 'circle'
                ? primitive.radiusMm * 3.2
                : 2.8,
            )
            return (
              <g key={`${terminalHole.id}-terminal`} className="stitch-hole-terminal-marker" pointerEvents="none">
                <circle
                  cx={terminalHole.point.x}
                  cy={terminalHole.point.y}
                  r={radius}
                  className="stitch-hole-terminal-ring"
                />
                <line
                  x1={terminalHole.point.x - radius * 0.55}
                  y1={terminalHole.point.y}
                  x2={terminalHole.point.x + radius * 0.55}
                  y2={terminalHole.point.y}
                  className="stitch-hole-terminal-cross"
                />
                <line
                  x1={terminalHole.point.x}
                  y1={terminalHole.point.y - radius * 0.55}
                  x2={terminalHole.point.x}
                  y2={terminalHole.point.y + radius * 0.55}
                  className="stitch-hole-terminal-cross"
                />
              </g>
            )
          })}

          {stitchSimulatorSettings?.showSimulatorPattern &&
            renderableTerminalHole &&
            renderableTerminalHole.endHole !== true && (
              <circle
                cx={renderableTerminalHole.point.x}
                cy={renderableTerminalHole.point.y}
                r={Math.max(
                  1.6,
                  createStitchHolePrimitive(renderableTerminalHole).kind === 'circle'
                    ? (createStitchHolePrimitive(renderableTerminalHole) as Extract<ReturnType<typeof createStitchHolePrimitive>, { kind: 'circle' }>).radiusMm * 3
                    : 2.8,
                )}
                fill="none"
                stroke={stitchSimulatorSettings.threadColor}
                strokeWidth={0.6}
                strokeDasharray="2 1.2"
                pointerEvents="none"
              />
            )}

          {renderableStitchHoles.map((stitchHole) => {
            const isSelected = stitchHole.id === selectedStitchHoleId
            const primitive = createStitchHolePrimitive(stitchHole)
            const r = primitive.kind === 'circle' ? primitive.radiusMm : stitchHole.diameterMm ? stitchHole.diameterMm / 2 : 0.6
            const outerR = r * 2.5
            const crossR = outerR * 1.3

            if (primitive.kind === 'segment') {
              return (
                <line
                  key={stitchHole.id}
                  x1={primitive.start.x}
                  y1={primitive.start.y}
                  x2={primitive.end.x}
                  y2={primitive.end.y}
                  className={isSelected ? 'stitch-hole-slit stitch-hole-slit-selected' : 'stitch-hole-slit'}
                  strokeWidth={Math.max(0.6, primitive.strokeWidthMm)}
                  onPointerDown={(event) => onStitchHolePointerDown(event, stitchHole.id)}
                />
              )
            }

            if (primitive.kind === 'polygon') {
              return (
                <polygon
                  key={stitchHole.id}
                  points={primitive.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  className={isSelected ? 'stitch-hole-slit stitch-hole-slit-selected' : 'stitch-hole-slit'}
                  fill="none"
                  strokeWidth={Math.max(0.6, stitchHole.widthMm ?? 0.9)}
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
                {showStitchSequenceLabels && viewport.scale >= 0.55 && (
                  <text x={cx + 3.2} y={cy - 3.2} className="stitch-hole-sequence-label">
                    {stitchHole.sequence + 1}
                  </text>
                )}
              </g>
            )
          })}

          {renderableHardwareMarkers.map((marker) => {
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
                {viewport.scale >= 0.35 && (
                  <text x={marker.point.x + 4.8} y={marker.point.y - 4.8} className="hardware-marker-label">
                    {`${marker.label} (${marker.holeDiameterMm.toFixed(1)}mm)`}
                  </text>
                )}
              </g>
            )
          })}

          {renderableFoldLines.map((foldLine) => (
            <line
              key={foldLine.id}
              x1={foldLine.start.x}
              y1={foldLine.start.y}
              x2={foldLine.end.x}
              y2={foldLine.end.y}
              className="fold-line"
            />
          ))}

          {renderablePieceGrainlineSegments.map((segment) => (
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

          {renderablePieceNotchLines.map((notch) => (
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

          {renderablePlacementGuides.map((guide) => {
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

          {renderableAnnotationLabels.map((label) => (
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

          {renderableOutlineChains.map((chain) => {
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

          {renderableConstraintSuggestions.map((suggestion, i) => (
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
            dimensionLines
              .filter((dim) => boundsIntersect(lineBounds(dim.start, dim.end), viewBounds, detailPadding))
              .map((dim) => {
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
                  <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" className="dimension-label">
                    {dimText}
                  </text>
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
