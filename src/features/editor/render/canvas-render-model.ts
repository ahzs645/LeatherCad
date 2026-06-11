import { lineTypeStrokeDasharray, resolveLineTypeStrokeWidthMm } from '../cad/line-types'
import type { DimensionLine, FoldLine, HardwareMarker, LineType, Point, Shape, StitchHole } from '../cad/cad-types'
import { sampleShapePoints } from '../cad/cad-geometry'
import type { AnnotationLabel, PiecePlacementGuide, SeamGuide, SketchWorkspaceMode } from '../editor-types'
import type { CanvasInteractionPreview } from '../hooks/useCanvasInteractions'
import type { ConstraintSuggestion } from '../ops/auto-constraint-ops'
import type { OutlineChain } from '../ops/outline-detection'
import { formatDisplayDistance, type DisplayUnit } from '../ops/unit-ops'
import { type Bounds, boundsIntersect, lineBounds, pointInBounds, shapeBounds, withPreviewApplied } from '../components/canvas/canvas-geometry'

export type CanvasRenderGroup = 'base' | 'guide' | 'detail' | 'annotation' | 'preview' | 'overlay'

export type CanvasRenderShapeEntity = {
  id: string
  kind: 'shape'
  role: 'linked' | 'editable' | 'preview'
  shape: Shape
  layerId: string
  stackLevel: number
  order: number
  bounds: Bounds
  paint: {
    className: string
    strokeColor: string
    strokeDasharray?: string
    strokeWidthMm?: number
    opacity: number
    interactive: boolean
    selected: boolean
    previewSource: boolean
  }
}

export type CanvasRenderEntityBase<K extends string, R extends string, Payload> = {
  id: string
  kind: K
  role: R
  payload: Payload
  bounds: Bounds
  order: number
  paint: {
    className?: string
    strokeColor?: string
    fillColor?: string
    opacity: number
    interactive: boolean
  }
}

export type CanvasRenderDimensionLabelPayload = {
  id: string
  x: number
  y: number
  text: string
  fontSizeMm: number
}

export type CanvasRenderDimensionLinePayload = {
  dimension: DimensionLine
  extensionStart: Point
  extensionEnd: Point
  measureStart: Point
  measureEnd: Point
  firstMeasureEnd: Point | null
  secondMeasureStart: Point | null
  label: {
    point: Point
    text: string
    fontSizeMm: number
    rotationDeg: number
    center: boolean
  } | null
}

export type CanvasRenderPieceEdgeLabelPayload = {
  id: string
  x: number
  y: number
  label: string
  active: boolean
}

export type CanvasRenderConstraintGlyphPayload = ConstraintSuggestion & {
  opacity: number
  fontSizePx: number
}

export type CanvasRenderOutlineChainLabelPayload = {
  chainId: string
  centroid: Point
  first: Point
  last: Point
  endpointRadius: number
  labelSize: number
  text: string
}

export type CanvasRenderSeamGuideEntity = CanvasRenderEntityBase<'seam-guide', 'guide', SeamGuide> & {
  paint: CanvasRenderEntityBase<'seam-guide', 'guide', SeamGuide>['paint'] & {
    lineClassName: string
    labelClassName: string
    labelVisible: boolean
    labelText: string
  }
}

export type CanvasRenderDimensionLineEntity = CanvasRenderEntityBase<'dimension-line', 'annotation', CanvasRenderDimensionLinePayload> & {
  paint: CanvasRenderEntityBase<'dimension-line', 'annotation', CanvasRenderDimensionLinePayload>['paint'] & {
    groupClassName: string
    extensionClassName: string
    measureClassName: string
    labelClassName: string
  }
}

export type CanvasRenderEntity =
  | CanvasRenderShapeEntity
  | CanvasRenderEntityBase<'fold-line', 'guide', FoldLine>
  | CanvasRenderEntityBase<'stitch-hole', 'editable', StitchHole>
  | CanvasRenderEntityBase<'hardware-marker', 'editable', HardwareMarker>
  | CanvasRenderDimensionLineEntity
  | CanvasRenderEntityBase<'dimension-label', 'annotation', CanvasRenderDimensionLabelPayload>
  | CanvasRenderEntityBase<'annotation-label', 'annotation', AnnotationLabel>
  | CanvasRenderEntityBase<'piece-edge-label', 'annotation', CanvasRenderPieceEdgeLabelPayload>
  | CanvasRenderEntityBase<'constraint-glyph', 'annotation', CanvasRenderConstraintGlyphPayload>
  | CanvasRenderEntityBase<'outline-chain-label', 'annotation', CanvasRenderOutlineChainLabelPayload>
  | CanvasRenderSeamGuideEntity
  | CanvasRenderEntityBase<'grainline', 'guide', { pieceId: string; start: Point; end: Point }>
  | CanvasRenderEntityBase<'notch', 'guide', { id: string; pieceId: string; start: Point; end: Point; showOnSeam: boolean }>
  | CanvasRenderEntityBase<'placement-guide', 'guide', PiecePlacementGuide>
  | CanvasRenderEntityBase<'selection-box', 'overlay', { start: Point; end: Point; mode: 'crossing' | 'contained' }>
  | CanvasRenderEntityBase<'snap-anchor', 'overlay', { point: Point; reason: string; active: boolean }>
  | CanvasRenderEntityBase<'angle-guide', 'overlay', { start: Point; end: Point }>

export type CanvasRenderModel = {
  viewBounds: Bounds
  detailPadding: number
  layers: {
    linkedShapes: CanvasRenderShapeEntity[]
    editableShapes: CanvasRenderShapeEntity[]
    previewShapes: CanvasRenderShapeEntity[]
    foldLines: FoldLine[]
    stitchHoles: StitchHole[]
    hardwareMarkers: HardwareMarker[]
    pieceGrainlineSegments: Array<{ pieceId: string; start: Point; end: Point }>
    pieceNotchLines: Array<{ id: string; pieceId: string; start: Point; end: Point; showOnSeam: boolean }>
    placementGuides: PiecePlacementGuide[]
  }
  shapeLayers: {
    linked: CanvasRenderShapeEntity[]
    editable: CanvasRenderShapeEntity[]
    preview: CanvasRenderShapeEntity[]
    all: CanvasRenderShapeEntity[]
  }
  groups: Record<CanvasRenderGroup, CanvasRenderEntity[]>
  entities: {
    foldLines: Extract<CanvasRenderEntity, { kind: 'fold-line' }>[]
    stitchHoles: Extract<CanvasRenderEntity, { kind: 'stitch-hole' }>[]
    hardwareMarkers: Extract<CanvasRenderEntity, { kind: 'hardware-marker' }>[]
    seamGuides: Extract<CanvasRenderEntity, { kind: 'seam-guide' }>[]
    annotationLabels: Extract<CanvasRenderEntity, { kind: 'annotation-label' }>[]
    dimensionLines: Extract<CanvasRenderEntity, { kind: 'dimension-line' }>[]
    dimensionLabels: Extract<CanvasRenderEntity, { kind: 'dimension-label' }>[]
    pieceEdgeLabels: Extract<CanvasRenderEntity, { kind: 'piece-edge-label' }>[]
    constraintGlyphs: Extract<CanvasRenderEntity, { kind: 'constraint-glyph' }>[]
    outlineChainLabels: Extract<CanvasRenderEntity, { kind: 'outline-chain-label' }>[]
    grainlines: Extract<CanvasRenderEntity, { kind: 'grainline' }>[]
    notches: Extract<CanvasRenderEntity, { kind: 'notch' }>[]
    placementGuides: Extract<CanvasRenderEntity, { kind: 'placement-guide' }>[]
    selectionBoxes: Extract<CanvasRenderEntity, { kind: 'selection-box' }>[]
    snapAnchors: Extract<CanvasRenderEntity, { kind: 'snap-anchor' }>[]
    angleGuides: Extract<CanvasRenderEntity, { kind: 'angle-guide' }>[]
    all: CanvasRenderEntity[]
  }
}

type BuildCanvasRenderModelParams = {
  visibleShapes: Shape[]
  linkedShapes: Shape[]
  lineTypesById: Record<string, LineType | undefined>
  layerStackLevels: Record<string, number>
  selectedShapeIdSet: Set<string>
  sketchWorkspaceMode: SketchWorkspaceMode
  shapeStrokeOpacity: number
  highlightActiveLayerId?: string | null
  displayLayerColorsById: Record<string, string>
  fallbackLayerStroke: string
  stitchStrokeColor: string
  foldStrokeColor: string
  cutStrokeColor: string
  viewBounds: Bounds
  detailPadding: number
  interactionPreview: CanvasInteractionPreview | null
  transientPreviewShapes?: Shape[]
  visibleStitchHoles: StitchHole[]
  visibleHardwareMarkers: HardwareMarker[]
  foldLines: FoldLine[]
  seamGuides: SeamGuide[]
  annotationLabels: AnnotationLabel[]
  dimensionLines: DimensionLine[]
  showAnnotations: boolean
  showDimensions: boolean
  showOpenPathLabels: boolean
  viewportScale: number
  displayUnit: DisplayUnit
  snapIndicator: { point: Point; reason: string } | null
  markedSnapPoints: Array<{ point: Point; reason: string; markedAt: number }>
  angleGuideLines: Array<{ id: string; start: Point; end: Point }>
  pieceEdgeLabels: CanvasRenderPieceEdgeLabelPayload[]
  constraintSuggestions: ConstraintSuggestion[]
  outlineChains: OutlineChain[]
  pieceGrainlineSegments: Array<{ pieceId: string; start: Point; end: Point }>
  pieceNotchLines: Array<{ id: string; pieceId: string; start: Point; end: Point; showOnSeam: boolean }>
  piecePlacementGuides: PiecePlacementGuide[]
}

function pointBounds(point: Point): Bounds {
  return { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }
}

function selectionBoxBounds(start: Point, end: Point): Bounds {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  }
}

function dimensionLineBounds(dim: DimensionLine): Bounds {
  const dx = dim.end.x - dim.start.x
  const dy = dim.end.y - dim.start.y
  const len = Math.hypot(dx, dy)
  if (len < 0.01) {
    return pointBounds(dim.start)
  }

  const nx = (-dy / len) * dim.offsetMm
  const ny = (dx / len) * dim.offsetMm
  const points = [
    dim.start,
    dim.end,
    { x: dim.start.x + nx, y: dim.start.y + ny },
    { x: dim.end.x + nx, y: dim.end.y + ny },
    ...(dim.labelPoint ? [dim.labelPoint] : []),
  ]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

function pointAlong(from: Point, to: Point, distance: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return { ...from }
  }

  const ratio = Math.max(0, Math.min(1, distance / length))
  return {
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
  }
}

function makeEntity<K extends string, R extends string, Payload>(
  id: string,
  kind: K,
  role: R,
  payload: Payload,
  bounds: Bounds,
  order: number,
  paint: CanvasRenderEntityBase<K, R, Payload>['paint'],
): CanvasRenderEntityBase<K, R, Payload> {
  return { id, kind, role, payload, bounds, order, paint }
}

function stackLevelFor(shape: Shape, layerStackLevels: Record<string, number>, fallbackOrder: number) {
  return layerStackLevels[shape.layerId] ?? fallbackOrder
}

function resolveShapeStrokeColor(
  shape: Shape,
  params: Pick<
    BuildCanvasRenderModelParams,
    'lineTypesById' | 'sketchWorkspaceMode' | 'displayLayerColorsById' | 'fallbackLayerStroke' | 'stitchStrokeColor' | 'foldStrokeColor' | 'cutStrokeColor'
  >,
) {
  const lineType = params.lineTypesById[shape.lineTypeId]
  const lineTypeRole = lineType?.role ?? 'cut'
  if (params.sketchWorkspaceMode === 'assembly') {
    return params.displayLayerColorsById[shape.layerId] ?? params.fallbackLayerStroke
  }
  if (lineType?.color) {
    return lineType.color
  }
  if (lineTypeRole === 'stitch') {
    return params.stitchStrokeColor
  }
  if (lineTypeRole === 'fold') {
    return params.foldStrokeColor
  }
  return lineType?.color ?? params.cutStrokeColor
}

function resolvePaint(
  shape: Shape,
  role: CanvasRenderShapeEntity['role'],
  previewShapeIdSet: Set<string>,
  params: Pick<
    BuildCanvasRenderModelParams,
    | 'lineTypesById'
    | 'selectedShapeIdSet'
    | 'sketchWorkspaceMode'
    | 'shapeStrokeOpacity'
    | 'highlightActiveLayerId'
    | 'displayLayerColorsById'
    | 'fallbackLayerStroke'
    | 'stitchStrokeColor'
    | 'foldStrokeColor'
    | 'cutStrokeColor'
  >,
): CanvasRenderShapeEntity['paint'] {
  const lineType = params.lineTypesById[shape.lineTypeId]
  const selected = params.selectedShapeIdSet.has(shape.id)
  const previewSource = previewShapeIdSet.has(shape.id)
  const strokeColor = resolveShapeStrokeColor(shape, params)
  const strokeDasharray =
    role === 'linked' && params.sketchWorkspaceMode === 'sketch'
      ? '8 5'
      : lineTypeStrokeDasharray(lineType?.style ?? 'solid')
  const strokeWidthMm = resolveLineTypeStrokeWidthMm(lineType)

  if (role === 'preview') {
    return {
      className: shape.type === 'text'
        ? 'annotation-label text-shape text-shape-selected shape-live-preview'
        : 'shape-line shape-selected shape-live-preview',
      strokeColor,
      strokeDasharray,
      strokeWidthMm,
      opacity: Math.max(0.95, params.shapeStrokeOpacity),
      interactive: false,
      selected: true,
      previewSource: false,
    }
  }

  if (role === 'linked') {
    return {
      className: shape.type === 'text'
        ? 'annotation-label text-shape'
        : params.sketchWorkspaceMode === 'sketch'
          ? 'shape-line shape-linked-reference'
          : 'shape-line shape-linked-assembly',
      strokeColor,
      strokeDasharray,
      strokeWidthMm,
      opacity: shape.type === 'text' ? 0.7 : params.shapeStrokeOpacity,
      interactive: false,
      selected: false,
      previewSource: false,
    }
  }

  const className = shape.type === 'text'
    ? `${selected ? 'annotation-label text-shape text-shape-selected' : 'annotation-label text-shape'}${previewSource ? ' shape-preview-source' : ''}`
    : `${selected ? 'shape-line shape-selected' : 'shape-line'}${previewSource ? ' shape-preview-source' : ''}`
  const isOffActiveLayer =
    params.highlightActiveLayerId !== undefined &&
    params.highlightActiveLayerId !== null &&
    shape.layerId !== params.highlightActiveLayerId
  const opacity = previewSource
    ? Math.min(params.shapeStrokeOpacity, 0.2)
    : isOffActiveLayer
      ? Math.min(params.shapeStrokeOpacity, 0.35)
      : params.shapeStrokeOpacity

  return {
    className,
    strokeColor,
    strokeDasharray,
    strokeWidthMm,
    opacity,
    interactive: true,
    selected,
    previewSource,
  }
}

function compareShapeEntities(left: CanvasRenderShapeEntity, right: CanvasRenderShapeEntity) {
  if (left.stackLevel !== right.stackLevel) {
    return left.stackLevel - right.stackLevel
  }
  if (left.order !== right.order) {
    return left.order - right.order
  }
  return left.id.localeCompare(right.id)
}

function toShapeEntities(
  shapes: Shape[],
  role: CanvasRenderShapeEntity['role'],
  previewShapeIdSet: Set<string>,
  params: BuildCanvasRenderModelParams,
  layerStackLevels: Record<string, number>,
  viewBounds: Bounds,
  detailPadding: number,
) {
  return shapes
    .map((shape, order): CanvasRenderShapeEntity => ({
      id: shape.id,
      kind: 'shape',
      role,
      shape,
      layerId: shape.layerId,
      stackLevel: stackLevelFor(shape, layerStackLevels, order),
      order,
      bounds: shapeBounds(shape),
      paint: resolvePaint(shape, role, previewShapeIdSet, params),
    }))
    .filter((entry) => boundsIntersect(shapeBounds(entry.shape), viewBounds, detailPadding))
    .sort(compareShapeEntities)
}

function buildPreviewShapes(visibleShapes: Shape[], interactionPreview: CanvasInteractionPreview | null, transientPreviewShapes: Shape[] = []) {
  const previews = [...transientPreviewShapes]
  if (!interactionPreview || interactionPreview.kind === 'selection-box') {
    return previews
  }
  const matchesPreviewShape = interactionPreview.kind === 'move'
    ? (shape: Shape) => interactionPreview.shapeIds.includes(shape.id)
    : (shape: Shape) => shape.id === interactionPreview.shapeId
  previews.push(...visibleShapes
    .filter(matchesPreviewShape)
    .map((shape) => withPreviewApplied(shape, interactionPreview)))
  return previews
}

function buildPreviewShapeIdSet(interactionPreview: CanvasInteractionPreview | null, transientPreviewShapes: Shape[] = []) {
  const transientIds = transientPreviewShapes.map((shape) => shape.id)
  if (!interactionPreview || interactionPreview.kind === 'selection-box') {
    return new Set<string>(transientIds)
  }
  if (interactionPreview.kind === 'move') {
    return new Set([...interactionPreview.shapeIds, ...transientIds])
  }
  return new Set([interactionPreview.shapeId, ...transientIds])
}

function buildSelectionBoxEntities(interactionPreview: CanvasInteractionPreview | null) {
  if (!interactionPreview || interactionPreview.kind !== 'selection-box') {
    return [] as Extract<CanvasRenderEntity, { kind: 'selection-box' }>[]
  }
  return [
    makeEntity(
      'selection-box-active',
      'selection-box',
      'overlay',
      {
        start: interactionPreview.start,
        end: interactionPreview.end,
        mode: interactionPreview.mode,
      },
      selectionBoxBounds(interactionPreview.start, interactionPreview.end),
      0,
      {
        className: `selection-box-preview ${interactionPreview.mode}`,
        opacity: 1,
        interactive: false,
      },
    ),
  ]
}

function buildSnapAnchorEntities(
  snapIndicator: BuildCanvasRenderModelParams['snapIndicator'],
  markedSnapPoints: BuildCanvasRenderModelParams['markedSnapPoints'],
  viewBounds: Bounds,
  detailPadding: number,
) {
  const markedEntities = markedSnapPoints
    .map((entry, order) =>
      makeEntity(
        `snap-anchor-${entry.reason}-${entry.point.x.toFixed(3)}-${entry.point.y.toFixed(3)}-${order}`,
        'snap-anchor',
        'overlay',
        { point: entry.point, reason: entry.reason, active: false },
        pointBounds(entry.point),
        order,
        { className: 'marked-snap-anchor', opacity: 1, interactive: false },
      ),
    )
    .filter((entry) => pointInBounds(entry.payload.point, viewBounds, detailPadding))

  const activeEntity = snapIndicator && pointInBounds(snapIndicator.point, viewBounds, detailPadding)
    ? [
        makeEntity(
          'snap-anchor-active',
          'snap-anchor',
          'overlay',
          { point: snapIndicator.point, reason: snapIndicator.reason, active: true },
          pointBounds(snapIndicator.point),
          markedEntities.length,
          { className: 'snap-indicator-active', opacity: 1, interactive: false },
        ),
      ]
    : []

  return [...markedEntities, ...activeEntity]
}

function buildAngleGuideEntities(
  angleGuideLines: BuildCanvasRenderModelParams['angleGuideLines'],
  viewBounds: Bounds,
  detailPadding: number,
) {
  return angleGuideLines
    .map((line, order) =>
      makeEntity(
        line.id,
        'angle-guide',
        'overlay',
        { start: line.start, end: line.end },
        lineBounds(line.start, line.end),
        order,
        { className: 'angle-guide-line', opacity: 1, interactive: false },
      ),
    )
    .filter((entry) => boundsIntersect(entry.bounds, viewBounds, detailPadding))
}

function buildSeamGuideEntities(
  seamGuides: SeamGuide[],
  showAnnotations: boolean,
  viewportScale: number,
  viewBounds: Bounds,
  detailPadding: number,
) {
  return seamGuides
    .map((guide, order): Extract<CanvasRenderEntity, { kind: 'seam-guide' }> =>
      ({
        ...makeEntity(
          guide.id,
          'seam-guide',
          'guide',
          guide,
          pointBounds(guide.labelPoint),
          order,
          {
            className: 'seam-guide-line',
            opacity: 1,
            interactive: false,
          },
        ),
        paint: {
          className: 'seam-guide-line',
          lineClassName: 'seam-guide-line',
          labelClassName: 'seam-guide-label',
          labelVisible: showAnnotations && viewportScale >= 0.35 && pointInBounds(guide.labelPoint, viewBounds, detailPadding),
          labelText: `${guide.offsetMm.toFixed(1)}mm seam`,
          opacity: 1,
          interactive: false,
        },
      }))
}

function buildAnnotationLabelEntities(
  annotationLabels: AnnotationLabel[],
  viewportScale: number,
  viewBounds: Bounds,
  detailPadding: number,
) {
  if (viewportScale < 0.35) {
    return [] as Extract<CanvasRenderEntity, { kind: 'annotation-label' }>[]
  }

  return annotationLabels
    .map((label, order) =>
      makeEntity(
        label.id,
        'annotation-label',
        'annotation',
        label,
        pointBounds(label.point),
        order,
        { className: 'annotation-label', opacity: 1, interactive: false },
      ),
    )
    .filter((entry) => pointInBounds(entry.payload.point, viewBounds, detailPadding))
}

function buildDimensionLinePayload(dim: DimensionLine, displayUnit: DisplayUnit): CanvasRenderDimensionLinePayload | null {
  const dx = dim.end.x - dim.start.x
  const dy = dim.end.y - dim.start.y
  const len = Math.hypot(dx, dy)
  if (len < 0.01) return null

  const nx = (-dy / len) * dim.offsetMm
  const ny = (dx / len) * dim.offsetMm
  const measureStart = { x: dim.start.x + nx, y: dim.start.y + ny }
  const measureEnd = { x: dim.end.x + nx, y: dim.end.y + ny }
  const mx = (measureStart.x + measureEnd.x) / 2
  const my = (measureStart.y + measureEnd.y) / 2
  const precision =
    typeof dim.precision === 'number' && Number.isFinite(dim.precision) && dim.precision >= 0
      ? Math.min(6, Math.floor(dim.precision))
      : displayUnit === 'in'
        ? 3
        : 1
  const dimText = dim.text ?? formatDisplayDistance(len, displayUnit, precision)
  const dimensionTextSizeMm = dim.fontSizeMm ?? 3.5
  const measureLen = Math.hypot(measureEnd.x - measureStart.x, measureEnd.y - measureStart.y)
  const labelGapMm = Math.min(
    Math.max(0, measureLen - 2),
    Math.max(dimensionTextSizeMm * 2.4, dimText.length * dimensionTextSizeMm * 0.62 + dimensionTextSizeMm * 1.2),
  )
  const halfGapMm = labelGapMm / 2
  const arrowOnly = dim.arrowOnly === true
  const textInside = dim.textInside !== false
  const singleLine = dim.singleLine === true
  const canGapMeasureLine = !singleLine && !arrowOnly && textInside && measureLen > labelGapMm + 2
  const hasAuthoredLabelPlacement = Boolean(dim.labelPoint)
  const baseLabelPoint = dim.labelPoint ?? { x: mx, y: my }
  const outsideOffsetMm = dimensionTextSizeMm * 1.4
  const labelPoint =
    !textInside && !hasAuthoredLabelPlacement
      ? {
          x: mx + (-dy / len) * (dim.offsetMm > 0 ? outsideOffsetMm : -outsideOffsetMm),
          y: my + (dx / len) * (dim.offsetMm > 0 ? outsideOffsetMm : -outsideOffsetMm),
        }
      : baseLabelPoint
  const labelRotationDeg = dim.labelRotationDeg ?? 0
  const reverseRotation = dim.textReverse ? 180 : 0

  return {
    dimension: dim,
    extensionStart: dim.start,
    extensionEnd: dim.end,
    measureStart,
    measureEnd,
    firstMeasureEnd: canGapMeasureLine ? pointAlong(measureStart, measureEnd, measureLen / 2 - halfGapMm) : null,
    secondMeasureStart: canGapMeasureLine ? pointAlong(measureStart, measureEnd, measureLen / 2 + halfGapMm) : null,
    label: arrowOnly
      ? null
      : {
          point: labelPoint,
          text: dimText,
          fontSizeMm: dimensionTextSizeMm,
          rotationDeg: labelRotationDeg + reverseRotation,
          center: !hasAuthoredLabelPlacement || dim.labelPlacement === 'center',
        },
  }
}

function buildDimensionLineEntities(
  dimensionLines: DimensionLine[],
  showDimensions: boolean,
  displayUnit: DisplayUnit,
  viewBounds: Bounds,
  detailPadding: number,
) {
  if (!showDimensions) {
    return [] as Extract<CanvasRenderEntity, { kind: 'dimension-line' }>[]
  }

  return dimensionLines
    .map((dim, order): Extract<CanvasRenderEntity, { kind: 'dimension-line' }> | null => {
      const payload = buildDimensionLinePayload(dim, displayUnit)
      if (!payload) return null
      return {
        ...makeEntity(
          dim.id,
          'dimension-line',
          'annotation',
          payload,
          dimensionLineBounds(dim),
          order,
          {
            className: 'dimension-line-group',
            opacity: 1,
            interactive: false,
          },
        ),
        paint: {
          className: 'dimension-line-group',
          groupClassName: 'dimension-line-group',
          extensionClassName: 'dimension-extension-line',
          measureClassName: 'dimension-measure-line',
          labelClassName: 'dimension-label',
          opacity: 1,
          interactive: false,
        },
      }
    })
    .filter((entry): entry is Extract<CanvasRenderEntity, { kind: 'dimension-line' }> => entry !== null)
    .filter((entry) => boundsIntersect(entry.bounds, viewBounds, detailPadding))
}

function buildGeneratedDimensionLabelEntities(
  shapes: Shape[],
  selectedShapeIdSet: Set<string>,
  hasImportedDimensions: boolean,
  showDimensions: boolean,
  viewportScale: number,
  displayUnit: DisplayUnit,
) {
  if (!showDimensions || hasImportedDimensions || viewportScale < 0.45) {
    return [] as Extract<CanvasRenderEntity, { kind: 'dimension-label' }>[]
  }
  const dimensionShapes = selectedShapeIdSet.size > 0
    ? shapes.filter((shape) => selectedShapeIdSet.has(shape.id))
    : shapes.slice(0, 40)

  return dimensionShapes
    .map((shape, order): Extract<CanvasRenderEntity, { kind: 'dimension-label' }> | null => {
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
      const payload = {
        id: shape.id,
        x: mid.x + 4,
        y: mid.y - 4,
        text: formatDisplayDistance(lengthMm, displayUnit, displayUnit === 'in' ? 3 : 1),
        fontSizeMm: 3.5,
      }
      return makeEntity(
        `dimension-label-${shape.id}`,
        'dimension-label',
        'annotation',
        payload,
        pointBounds({ x: payload.x, y: payload.y }),
        order,
        { className: 'dimension-label', opacity: 1, interactive: false },
      )
    })
    .filter((entry): entry is Extract<CanvasRenderEntity, { kind: 'dimension-label' }> => entry !== null)
}

function buildPieceEdgeLabelEntities(
  pieceEdgeLabels: CanvasRenderPieceEdgeLabelPayload[],
  viewportScale: number,
  viewBounds: Bounds,
  detailPadding: number,
) {
  if (viewportScale < 0.55) {
    return [] as Extract<CanvasRenderEntity, { kind: 'piece-edge-label' }>[]
  }

  return pieceEdgeLabels
    .map((label, order) =>
      makeEntity(
        label.id,
        'piece-edge-label',
        'annotation',
        label,
        pointBounds({ x: label.x, y: label.y }),
        order,
        { className: 'piece-edge-label', opacity: 1, interactive: false },
      ),
    )
    .filter((entry) => pointInBounds({ x: entry.payload.x, y: entry.payload.y }, viewBounds, detailPadding))
}

function buildConstraintGlyphEntities(
  constraintSuggestions: ConstraintSuggestion[],
  viewportScale: number,
  viewBounds: Bounds,
  detailPadding: number,
) {
  if (viewportScale < 0.45) {
    return [] as Extract<CanvasRenderEntity, { kind: 'constraint-glyph' }>[]
  }

  return constraintSuggestions
    .map((suggestion, order) => {
      const payload: CanvasRenderConstraintGlyphPayload = {
        ...suggestion,
        opacity: 0.5 + suggestion.confidence * 0.5,
        fontSizePx: 10 / viewportScale,
      }
      return makeEntity(
        `constraint-glyph-${order}-${suggestion.glyph}-${suggestion.glyphPoint.x.toFixed(3)}-${suggestion.glyphPoint.y.toFixed(3)}`,
        'constraint-glyph',
        'annotation',
        payload,
        pointBounds(suggestion.glyphPoint),
        order,
        { className: 'constraint-glyph', opacity: payload.opacity, interactive: false },
      )
    })
    .filter((entry) => pointInBounds(entry.payload.glyphPoint, viewBounds, detailPadding))
}

function buildOutlineChainLabelEntities(
  outlineChains: OutlineChain[],
  showAnnotations: boolean,
  showOpenPathLabels: boolean,
  viewportScale: number,
  viewBounds: Bounds,
  detailPadding: number,
) {
  if (!showAnnotations || !showOpenPathLabels) {
    return [] as Extract<CanvasRenderEntity, { kind: 'outline-chain-label' }>[]
  }

  return outlineChains
    .map((chain, order): Extract<CanvasRenderEntity, { kind: 'outline-chain-label' }> | null => {
      if (chain.isClosed || chain.polygon.length < 2) {
        return null
      }
      const centroid = chain.polygon.reduce(
        (acc, point) => ({ x: acc.x + point.x / chain.polygon.length, y: acc.y + point.y / chain.polygon.length }),
        { x: 0, y: 0 },
      )
      const first = chain.polygon[0]
      const last = chain.polygon[chain.polygon.length - 1]
      const payload: CanvasRenderOutlineChainLabelPayload = {
        chainId: chain.id,
        centroid,
        first,
        last,
        endpointRadius: 2 / viewportScale,
        labelSize: 3.5 / viewportScale,
        text: 'Open Path',
      }
      return makeEntity(
        `outline-chain-label-${chain.id}`,
        'outline-chain-label',
        'annotation',
        payload,
        {
          minX: Math.min(first.x, last.x, centroid.x),
          minY: Math.min(first.y, last.y, centroid.y),
          maxX: Math.max(first.x, last.x, centroid.x),
          maxY: Math.max(first.y, last.y, centroid.y),
        },
        order,
        { className: 'outline-chain-label', opacity: 0.8, interactive: false },
      )
    })
    .filter((entry): entry is Extract<CanvasRenderEntity, { kind: 'outline-chain-label' }> => entry !== null)
    .filter((entry) => boundsIntersect(entry.bounds, viewBounds, detailPadding))
}

export function buildCanvasRenderModel({
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
  transientPreviewShapes = [],
  visibleStitchHoles,
  visibleHardwareMarkers,
  foldLines,
  seamGuides,
  annotationLabels,
  dimensionLines,
  showAnnotations,
  showDimensions,
  showOpenPathLabels,
  viewportScale,
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
}: BuildCanvasRenderModelParams): CanvasRenderModel {
  const previewShapeIdSet = buildPreviewShapeIdSet(interactionPreview, transientPreviewShapes)
  const params: BuildCanvasRenderModelParams = {
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
    transientPreviewShapes,
    visibleStitchHoles,
    visibleHardwareMarkers,
    foldLines,
    seamGuides,
    annotationLabels,
    dimensionLines,
    showAnnotations,
    showDimensions,
    showOpenPathLabels,
    viewportScale,
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
  }
  const linkedShapeEntities = toShapeEntities(linkedShapes, 'linked', previewShapeIdSet, params, layerStackLevels, viewBounds, detailPadding)
  const editableShapeEntities = toShapeEntities(visibleShapes, 'editable', previewShapeIdSet, params, layerStackLevels, viewBounds, detailPadding)
  const previewShapeEntities = toShapeEntities(
    buildPreviewShapes(visibleShapes, interactionPreview, transientPreviewShapes),
    'preview',
    previewShapeIdSet,
    params,
    layerStackLevels,
    viewBounds,
    detailPadding,
  )
  const allShapeEntities = [
    ...linkedShapeEntities,
    ...editableShapeEntities,
    ...previewShapeEntities,
  ]
  const foldLineEntities = foldLines
    .map((line, order) =>
      makeEntity(
        line.id,
        'fold-line',
        'guide',
        line,
        lineBounds(line.start, line.end),
        order,
        { className: 'fold-line', opacity: 1, interactive: false },
      ),
    )
    .filter((entry) => boundsIntersect(entry.bounds, viewBounds, detailPadding))
  const stitchHoleEntities = visibleStitchHoles
    .map((hole, order) =>
      makeEntity(
        hole.id,
        'stitch-hole',
        'editable',
        hole,
        pointBounds(hole.point),
        order,
        { opacity: 1, interactive: true },
      ),
    )
    .filter((entry) => pointInBounds(entry.payload.point, viewBounds, detailPadding))
  const hardwareMarkerEntities = visibleHardwareMarkers
    .map((marker, order) =>
      makeEntity(
        marker.id,
        'hardware-marker',
        'editable',
        marker,
        pointBounds(marker.point),
        order,
        { className: 'hardware-marker', opacity: 1, interactive: true },
      ),
    )
    .filter((entry) => pointInBounds(entry.payload.point, viewBounds, detailPadding))
  const grainlineEntities = pieceGrainlineSegments
    .map((segment, order) =>
      makeEntity(
        `grainline-${segment.pieceId}`,
        'grainline',
        'guide',
        segment,
        lineBounds(segment.start, segment.end),
        order,
        { strokeColor: '#0f766e', opacity: 1, interactive: false },
      ),
    )
    .filter((entry) => boundsIntersect(entry.bounds, viewBounds, detailPadding))
  const notchEntities = pieceNotchLines
    .map((notch, order) =>
      makeEntity(
        notch.id,
        'notch',
        'guide',
        notch,
        lineBounds(notch.start, notch.end),
        order,
        { strokeColor: notch.showOnSeam ? '#7c2d12' : '#0f172a', opacity: 1, interactive: false },
      ),
    )
    .filter((entry) => boundsIntersect(entry.bounds, viewBounds, detailPadding))
  const placementGuideEntities = piecePlacementGuides
    .map((guide, order) =>
      makeEntity(
        guide.id,
        'placement-guide',
        'guide',
        guide,
        pointBounds(guide.point),
        order,
        { opacity: 1, interactive: false },
      ),
    )
    .filter((entry) => pointInBounds(entry.payload.point, viewBounds, detailPadding))
  const seamGuideEntities = buildSeamGuideEntities(seamGuides, showAnnotations, viewportScale, viewBounds, detailPadding)
  const annotationLabelEntities = buildAnnotationLabelEntities(annotationLabels, viewportScale, viewBounds, detailPadding)
  const dimensionLineEntities = buildDimensionLineEntities(dimensionLines, showDimensions, displayUnit, viewBounds, detailPadding)
  const dimensionLabelEntities = buildGeneratedDimensionLabelEntities(
    editableShapeEntities.map((entry) => entry.shape),
    selectedShapeIdSet,
    dimensionLines.length > 0,
    showDimensions,
    viewportScale,
    displayUnit,
  )
  const selectionBoxEntities = buildSelectionBoxEntities(interactionPreview)
  const snapAnchorEntities = buildSnapAnchorEntities(snapIndicator, markedSnapPoints, viewBounds, detailPadding)
  const angleGuideEntities = buildAngleGuideEntities(angleGuideLines, viewBounds, detailPadding)
  const pieceEdgeLabelEntities = buildPieceEdgeLabelEntities(pieceEdgeLabels, viewportScale, viewBounds, detailPadding)
  const constraintGlyphEntities = buildConstraintGlyphEntities(constraintSuggestions, viewportScale, viewBounds, detailPadding)
  const outlineChainLabelEntities = buildOutlineChainLabelEntities(outlineChains, showAnnotations, showOpenPathLabels, viewportScale, viewBounds, detailPadding)
  const groups: Record<CanvasRenderGroup, CanvasRenderEntity[]> = {
    base: [...linkedShapeEntities, ...editableShapeEntities],
    guide: [
      ...foldLineEntities,
      ...grainlineEntities,
      ...notchEntities,
      ...placementGuideEntities,
      ...seamGuideEntities,
    ],
    detail: [
      ...stitchHoleEntities,
      ...hardwareMarkerEntities,
    ],
    annotation: [
      ...annotationLabelEntities,
      ...dimensionLabelEntities,
      ...dimensionLineEntities,
      ...pieceEdgeLabelEntities,
      ...constraintGlyphEntities,
      ...outlineChainLabelEntities,
    ],
    preview: [...previewShapeEntities],
    overlay: [
    ...selectionBoxEntities,
    ...angleGuideEntities,
    ...snapAnchorEntities,
    ],
  }
  const allEntities: CanvasRenderEntity[] = [
    ...groups.base,
    ...groups.guide,
    ...groups.detail,
    ...groups.annotation,
    ...groups.preview,
    ...groups.overlay,
  ]

  return {
    viewBounds,
    detailPadding,
    layers: {
      linkedShapes: linkedShapeEntities,
      editableShapes: editableShapeEntities,
      previewShapes: previewShapeEntities,
      foldLines: foldLineEntities.map((entry) => entry.payload),
      stitchHoles: stitchHoleEntities.map((entry) => entry.payload),
      hardwareMarkers: hardwareMarkerEntities.map((entry) => entry.payload),
      pieceGrainlineSegments: grainlineEntities.map((entry) => entry.payload),
      pieceNotchLines: notchEntities.map((entry) => entry.payload),
      placementGuides: placementGuideEntities.map((entry) => entry.payload),
    },
    shapeLayers: {
      linked: linkedShapeEntities,
      editable: editableShapeEntities,
      preview: previewShapeEntities,
      all: allShapeEntities,
    },
    groups,
    entities: {
      foldLines: foldLineEntities,
      stitchHoles: stitchHoleEntities,
      hardwareMarkers: hardwareMarkerEntities,
      seamGuides: seamGuideEntities,
      annotationLabels: annotationLabelEntities,
      dimensionLines: dimensionLineEntities,
      dimensionLabels: dimensionLabelEntities,
      pieceEdgeLabels: pieceEdgeLabelEntities,
      constraintGlyphs: constraintGlyphEntities,
      outlineChainLabels: outlineChainLabelEntities,
      grainlines: grainlineEntities,
      notches: notchEntities,
      placementGuides: placementGuideEntities,
      selectionBoxes: selectionBoxEntities,
      snapAnchors: snapAnchorEntities,
      angleGuides: angleGuideEntities,
      all: allEntities,
    },
  }
}
