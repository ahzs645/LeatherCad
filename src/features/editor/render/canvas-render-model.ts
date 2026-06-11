import { lineTypeStrokeDasharray, resolveLineTypeStrokeWidthMm } from '../cad/line-types'
import type { DimensionLine, FoldLine, HardwareMarker, LineType, Point, Shape, StitchHole } from '../cad/cad-types'
import type { AnnotationLabel, PiecePlacementGuide, SeamGuide, SketchWorkspaceMode } from '../editor-types'
import type { CanvasInteractionPreview } from '../hooks/useCanvasInteractions'
import { type Bounds, boundsIntersect, lineBounds, pointInBounds, shapeBounds, withPreviewApplied } from '../components/canvas/canvas-geometry'

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

export type CanvasRenderEntity =
  | CanvasRenderShapeEntity
  | CanvasRenderEntityBase<'fold-line', 'guide', FoldLine>
  | CanvasRenderEntityBase<'stitch-hole', 'editable', StitchHole>
  | CanvasRenderEntityBase<'hardware-marker', 'editable', HardwareMarker>
  | CanvasRenderEntityBase<'dimension-line', 'annotation', DimensionLine>
  | CanvasRenderEntityBase<'annotation-label', 'annotation', AnnotationLabel>
  | CanvasRenderEntityBase<'seam-guide', 'guide', SeamGuide>
  | CanvasRenderEntityBase<'grainline', 'guide', { pieceId: string; start: Point; end: Point }>
  | CanvasRenderEntityBase<'notch', 'guide', { id: string; pieceId: string; start: Point; end: Point; showOnSeam: boolean }>
  | CanvasRenderEntityBase<'placement-guide', 'guide', PiecePlacementGuide>
  | CanvasRenderEntityBase<'selection-box', 'overlay', { start: Point; end: Point; mode: 'crossing' | 'contained' }>
  | CanvasRenderEntityBase<'snap-anchor', 'overlay', { point: Point; reason: string }>
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
  entities: {
    foldLines: Extract<CanvasRenderEntity, { kind: 'fold-line' }>[]
    stitchHoles: Extract<CanvasRenderEntity, { kind: 'stitch-hole' }>[]
    hardwareMarkers: Extract<CanvasRenderEntity, { kind: 'hardware-marker' }>[]
    grainlines: Extract<CanvasRenderEntity, { kind: 'grainline' }>[]
    notches: Extract<CanvasRenderEntity, { kind: 'notch' }>[]
    placementGuides: Extract<CanvasRenderEntity, { kind: 'placement-guide' }>[]
    selectionBoxes: Extract<CanvasRenderEntity, { kind: 'selection-box' }>[]
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
  const selectionBoxEntities = buildSelectionBoxEntities(interactionPreview)
  const allEntities: CanvasRenderEntity[] = [
    ...allShapeEntities,
    ...foldLineEntities,
    ...stitchHoleEntities,
    ...hardwareMarkerEntities,
    ...grainlineEntities,
    ...notchEntities,
    ...placementGuideEntities,
    ...selectionBoxEntities,
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
    entities: {
      foldLines: foldLineEntities,
      stitchHoles: stitchHoleEntities,
      hardwareMarkers: hardwareMarkerEntities,
      grainlines: grainlineEntities,
      notches: notchEntities,
      placementGuides: placementGuideEntities,
      selectionBoxes: selectionBoxEntities,
      all: allEntities,
    },
  }
}
