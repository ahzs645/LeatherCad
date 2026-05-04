import {
  CUT_LINE_TYPE_ID,
  DEFAULT_ACTIVE_LINE_TYPE_ID,
  FOLD_LINE_TYPE_ID,
  GUIDE_LINE_TYPE_ID,
  MARK_LINE_TYPE_ID,
  STITCH_LINE_TYPE_ID,
  createDefaultLineTypes,
} from '../cad/line-types'
import type {
  DocFile,
  FoldLine,
  HardwareMarker,
  Layer,
  LineTypeRole,
  PatternPiece,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
  StitchHole,
  StitchHoleDefaults,
} from '../cad/cad-types'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
} from '../ops/fold-line-ops'
import { generateFixedPitchStitchHoles } from '../ops/stitch-hole-ops'
import { runAiBuilderPreflight } from './ai-builder-preflight'
import { createLeatherRef } from './ai-builder-refs'
import { AI_BUILDER_TEXT_DEFAULTS } from './ai-builder-schema'
import type {
  AiBuilderCompileResult,
  AiBuilderDocumentV1,
  AiBuilderEntity,
  AiBuilderLeatherRef,
} from './ai-builder-types'

const LINE_ROLE_TO_TYPE_ID: Record<LineTypeRole, string> = {
  cut: CUT_LINE_TYPE_ID,
  stitch: STITCH_LINE_TYPE_ID,
  fold: FOLD_LINE_TYPE_ID,
  guide: GUIDE_LINE_TYPE_ID,
  mark: MARK_LINE_TYPE_ID,
}

function resolveLineTypeId(entity: AiBuilderEntity) {
  let role: LineTypeRole = 'cut'
  if (entity.type === 'text') {
    role = entity.line_role ?? 'mark'
  } else if (entity.type === 'fold') {
    role = 'fold'
  } else if (entity.type === 'stitch_path') {
    role = 'stitch'
  } else if (
    entity.type === 'line' ||
    entity.type === 'arc' ||
    entity.type === 'bezier' ||
    entity.type === 'rectangle'
  ) {
    role = entity.line_role ?? 'cut'
  }
  return LINE_ROLE_TO_TYPE_ID[role]
}

function estimateTextEndX(value: string, fontSizeMm: number) {
  return Math.max(fontSizeMm, value.length * fontSizeMm * 0.62)
}

function humanizeId(value: string) {
  return value
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

type ShapeEntity = Extract<
  AiBuilderEntity,
  { type: 'line' | 'arc' | 'bezier' | 'rectangle' | 'text' | 'stitch_path' }
>

function compileShape(entity: ShapeEntity): Shape[] {
  const lineTypeId = resolveLineTypeId(entity)

  if (entity.type === 'line') {
    return [
      {
        id: `line__${entity.id}`,
        type: 'line',
        layerId: entity.layer_id,
        lineTypeId,
        start: { ...entity.start },
        end: { ...entity.end },
      },
    ]
  }

  if (entity.type === 'arc') {
    return [
      {
        id: `arc__${entity.id}`,
        type: 'arc',
        layerId: entity.layer_id,
        lineTypeId,
        start: { ...entity.start },
        mid: { ...entity.mid },
        end: { ...entity.end },
      },
    ]
  }

  if (entity.type === 'bezier') {
    return [
      {
        id: `bezier__${entity.id}`,
        type: 'bezier',
        layerId: entity.layer_id,
        lineTypeId,
        start: { ...entity.start },
        control: { ...entity.control },
        end: { ...entity.end },
      },
    ]
  }

  if (entity.type === 'rectangle') {
    const minX = entity.x
    const minY = entity.y
    const maxX = entity.x + entity.width
    const maxY = entity.y + entity.height

    return [
      {
        id: `rect__${entity.id}__top`,
        type: 'line',
        layerId: entity.layer_id,
        lineTypeId,
        start: { x: minX, y: minY },
        end: { x: maxX, y: minY },
      },
      {
        id: `rect__${entity.id}__right`,
        type: 'line',
        layerId: entity.layer_id,
        lineTypeId,
        start: { x: maxX, y: minY },
        end: { x: maxX, y: maxY },
      },
      {
        id: `rect__${entity.id}__bottom`,
        type: 'line',
        layerId: entity.layer_id,
        lineTypeId,
        start: { x: maxX, y: maxY },
        end: { x: minX, y: maxY },
      },
      {
        id: `rect__${entity.id}__left`,
        type: 'line',
        layerId: entity.layer_id,
        lineTypeId,
        start: { x: minX, y: maxY },
        end: { x: minX, y: minY },
      },
    ]
  }

  if (entity.type === 'stitch_path') {
    if (entity.path_type === 'arc') {
      return [
        {
          id: `stitch__${entity.id}`,
          type: 'arc',
          layerId: entity.layer_id,
          lineTypeId,
          start: { ...entity.start },
          mid: { ...(entity.mid ?? entity.start) },
          end: { ...entity.end },
        },
      ]
    }

    if (entity.path_type === 'bezier') {
      return [
        {
          id: `stitch__${entity.id}`,
          type: 'bezier',
          layerId: entity.layer_id,
          lineTypeId,
          start: { ...entity.start },
          control: { ...(entity.control ?? entity.start) },
          end: { ...entity.end },
        },
      ]
    }

    return [
      {
        id: `stitch__${entity.id}`,
        type: 'line',
        layerId: entity.layer_id,
        lineTypeId,
        start: { ...entity.start },
        end: { ...entity.end },
      },
    ]
  }

  const fontFamily = entity.font_family ?? AI_BUILDER_TEXT_DEFAULTS.fontFamily
  const fontSizeMm = entity.font_size_mm ?? AI_BUILDER_TEXT_DEFAULTS.fontSizeMm
  const transform = entity.transform ?? AI_BUILDER_TEXT_DEFAULTS.transform
  const radiusMm = entity.radius_mm ?? AI_BUILDER_TEXT_DEFAULTS.radiusMm
  const sweepDeg = entity.sweep_deg ?? AI_BUILDER_TEXT_DEFAULTS.sweepDeg

  return [
    {
      id: `text__${entity.id}`,
      type: 'text',
      layerId: entity.layer_id,
      lineTypeId,
      start: { ...entity.position },
      end: {
        x: entity.position.x + estimateTextEndX(entity.value, fontSizeMm),
        y: entity.position.y,
      },
      text: entity.value,
      fontFamily,
      fontSizeMm,
      transform,
      radiusMm,
      sweepDeg,
    },
  ]
}

function compileFoldLine(entity: Extract<AiBuilderEntity, { type: 'fold' }>): FoldLine {
  return {
    id: `fold__${entity.id}`,
    name: entity.name ?? humanizeId(entity.id),
    start: { ...entity.start },
    end: { ...entity.end },
    angleDeg: entity.angle_deg ?? 0,
    maxAngleDeg: entity.max_angle_deg ?? 180,
    direction: entity.direction ?? DEFAULT_FOLD_DIRECTION,
    radiusMm: entity.radius_mm ?? DEFAULT_FOLD_RADIUS_MM,
    thicknessMm: entity.thickness_mm ?? DEFAULT_FOLD_THICKNESS_MM,
    neutralAxisRatio: entity.neutral_axis_ratio ?? DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
    stiffness: entity.stiffness ?? DEFAULT_FOLD_STIFFNESS,
    clearanceMm: entity.clearance_mm ?? DEFAULT_FOLD_CLEARANCE_MM,
  }
}

function compileStitchHoleDefaults(entity: Extract<AiBuilderEntity, { type: 'stitch_path' }>): StitchHoleDefaults {
  const holeType = entity.hole_type ?? 'round'
  return {
    holeType,
    renderShape: entity.render_shape,
    diameterMm: entity.diameter_mm ?? (holeType === 'round' ? 0.9 : undefined),
    widthMm: entity.width_mm ?? (holeType === 'slit' ? 1.3 : undefined),
    heightMm: entity.height_mm ?? (holeType === 'slit' ? 0.55 : undefined),
    tiltDeg: entity.tilt_deg,
    inverted: entity.inverted,
  }
}

function compileStitchHoles(
  entity: Extract<AiBuilderEntity, { type: 'stitch_path' }>,
  shape: Shape,
  sequenceStart: number,
): StitchHole[] {
  return generateFixedPitchStitchHoles(
    shape,
    entity.pitch_mm,
    compileStitchHoleDefaults(entity),
    sequenceStart,
    {
      includeStartHole: entity.include_start_hole ?? true,
      forceFitLastHole: entity.force_fit_last_hole ?? true,
    },
  ).map((hole, index) => ({
    ...hole,
    id: `stitch_hole__${entity.id}__${index + 1}`,
  }))
}

function isShapeEntity(entity: AiBuilderEntity): entity is ShapeEntity {
  return (
    entity.type === 'line' ||
    entity.type === 'arc' ||
    entity.type === 'bezier' ||
    entity.type === 'rectangle' ||
    entity.type === 'text' ||
    entity.type === 'stitch_path'
  )
}

function firstMappedShapeId(entityId: string, entityShapeIds: Map<string, string[]>) {
  return entityShapeIds.get(entityId)?.[0] ?? null
}

function compilePatternPiece(
  entity: Extract<AiBuilderEntity, { type: 'pattern_piece' }>,
  entityShapeIds: Map<string, string[]>,
): PatternPiece | null {
  const boundaryShapeId = firstMappedShapeId(entity.boundary_entity_id, entityShapeIds)
  if (!boundaryShapeId) {
    return null
  }

  const internalShapeIds = (entity.internal_entity_ids ?? [])
    .flatMap((entityId) => entityShapeIds.get(entityId) ?? [])
    .filter((shapeId) => shapeId !== boundaryShapeId)

  return {
    id: `piece__${entity.id}`,
    name: entity.name,
    boundaryShapeId,
    internalShapeIds,
    layerId: entity.layer_id,
    quantity: entity.quantity ?? 1,
    code: entity.code,
    annotation: entity.annotation,
    material: entity.material,
    materialSide: entity.material_side ?? 'either',
    notes: entity.notes,
    onFold: entity.on_fold === true,
    mirrorPair: entity.mirror_pair === true,
    orientation: entity.orientation ?? 'any',
    allowFlip: entity.allow_flip ?? true,
    includeInLayout: entity.include_in_layout ?? true,
    locked: false,
    color: entity.color,
    fill: entity.fill,
  }
}

function compileSeamAllowance(
  entity: Extract<AiBuilderEntity, { type: 'seam_allowance' }>,
  pieceIdMap: Map<string, string>,
): PieceSeamAllowance | null {
  const pieceId = pieceIdMap.get(entity.piece_id)
  if (!pieceId) {
    return null
  }
  return {
    id: `seam_allowance__${entity.id}`,
    pieceId,
    enabled: entity.enabled ?? true,
    defaultOffsetMm: entity.default_offset_mm,
    edgeOverrides: (entity.edge_overrides ?? []).map((override) => ({ ...override })),
  }
}

function compileSeamConnection(
  entity: Extract<AiBuilderEntity, { type: 'seam_connection' }>,
  pieceIdMap: Map<string, string>,
): SeamConnection | null {
  const fromPieceId = pieceIdMap.get(entity.from.piece_id)
  const toPieceId = pieceIdMap.get(entity.to.piece_id)
  if (!fromPieceId || !toPieceId) {
    return null
  }
  const from = {
    pieceId: fromPieceId,
    edgeIndex: entity.from.edge_index,
  }
  const to = {
    pieceId: toPieceId,
    edgeIndex: entity.to.edge_index,
  }
  return {
    id: `seam_connection__${entity.id}`,
    from,
    to,
    fromSpan:
      entity.from.t0 !== undefined || entity.from.t1 !== undefined || entity.from.reversed !== undefined
        ? {
            ...from,
            t0: entity.from.t0 ?? 0,
            t1: entity.from.t1 ?? 1,
            reversed: entity.from.reversed,
          }
        : undefined,
    toSpan:
      entity.to.t0 !== undefined || entity.to.t1 !== undefined || entity.to.reversed !== undefined
        ? {
            ...to,
            t0: entity.to.t0 ?? 0,
            t1: entity.to.t1 ?? 1,
            reversed: entity.to.reversed,
          }
        : undefined,
    toleranceMm: entity.tolerance_mm,
    stitchSpacingMm: entity.stitch_spacing_mm,
    reversed: entity.reversed,
    kind: entity.kind ?? 'sewn',
  }
}

function compileHardwareMarker(entity: Extract<AiBuilderEntity, { type: 'hardware_marker' }>): HardwareMarker {
  return {
    id: `hardware__${entity.id}`,
    layerId: entity.layer_id,
    point: { ...entity.point },
    kind: entity.kind ?? 'custom',
    label: entity.label ?? humanizeId(entity.id),
    installationSide: entity.installation_side ?? 'either',
    holeDiameterMm: entity.hole_diameter_mm ?? 4,
    spacingMm: entity.spacing_mm ?? 0,
    notes: entity.notes,
    visible: entity.visible ?? true,
  }
}

export function compileAiBuilderDocument(document: AiBuilderDocumentV1): AiBuilderCompileResult {
  const layers: Layer[] = document.layers.map((layer, index) => ({
    id: layer.id,
    name: layer.name,
    visible: true,
    locked: false,
    stackLevel: index,
  }))

  const objects: Shape[] = []
  const foldLines: FoldLine[] = []
  const stitchHoles: StitchHole[] = []
  const patternPieces: PatternPiece[] = []
  const seamAllowances: PieceSeamAllowance[] = []
  const seamConnections: SeamConnection[] = []
  const hardwareMarkers: HardwareMarker[] = []
  const refs: AiBuilderLeatherRef[] = []
  const entityShapeIds = new Map<string, string[]>()
  const pieceIdMap = new Map<string, string>()

  document.entities.forEach((entity) => {
    if (entity.type === 'fold') {
      const foldLine = compileFoldLine(entity)
      foldLines.push(foldLine)
      refs.push(createLeatherRef('entity', entity.id, entity.id))
      refs.push(createLeatherRef('fold', foldLine.id, foldLine.name))
      return
    }

    if (isShapeEntity(entity)) {
      const compiledShapes = compileShape(entity)
      entityShapeIds.set(entity.id, compiledShapes.map((shape) => shape.id))
      objects.push(...compiledShapes)
      refs.push(createLeatherRef('entity', entity.id, entity.id))
      compiledShapes.forEach((shape) => refs.push(createLeatherRef('shape', shape.id, shape.id)))
      if (entity.type === 'stitch_path' && compiledShapes[0]) {
        const generatedHoles = compileStitchHoles(entity, compiledShapes[0], stitchHoles.length)
        stitchHoles.push(...generatedHoles)
        generatedHoles.forEach((hole) => refs.push(createLeatherRef('stitch_hole', hole.id, hole.id)))
      }
      return
    }
  })

  document.entities.forEach((entity) => {
    if (entity.type !== 'pattern_piece') {
      return
    }
    const piece = compilePatternPiece(entity, entityShapeIds)
    if (!piece) {
      return
    }
    patternPieces.push(piece)
    pieceIdMap.set(entity.id, piece.id)
    refs.push(createLeatherRef('entity', entity.id, entity.id))
    refs.push(createLeatherRef('pattern_piece', piece.id, piece.name))
  })

  document.entities.forEach((entity) => {
    if (entity.type === 'seam_allowance') {
      const seamAllowance = compileSeamAllowance(entity, pieceIdMap)
      if (seamAllowance) {
        seamAllowances.push(seamAllowance)
        refs.push(createLeatherRef('entity', entity.id, entity.id))
        refs.push(createLeatherRef('seam_allowance', seamAllowance.id, seamAllowance.id))
      }
      return
    }

    if (entity.type === 'seam_connection') {
      const seamConnection = compileSeamConnection(entity, pieceIdMap)
      if (seamConnection) {
        seamConnections.push(seamConnection)
        refs.push(createLeatherRef('entity', entity.id, entity.id))
        refs.push(createLeatherRef('seam_connection', seamConnection.id, seamConnection.id))
      }
      return
    }

    if (entity.type === 'hardware_marker') {
      const hardwareMarker = compileHardwareMarker(entity)
      hardwareMarkers.push(hardwareMarker)
      refs.push(createLeatherRef('entity', entity.id, entity.id))
      refs.push(createLeatherRef('hardware_marker', hardwareMarker.id, hardwareMarker.label))
    }
  })

  const doc: DocFile = {
    version: 1,
    units: 'mm',
    layers,
    activeLayerId: layers[0]?.id ?? 'layer_1',
    lineTypes: createDefaultLineTypes(),
    activeLineTypeId: DEFAULT_ACTIVE_LINE_TYPE_ID,
    objects,
    foldLines,
    stitchHoles,
    patternPieces,
    seamAllowances,
    seamConnections,
    hardwareMarkers,
  }

  const preflight = runAiBuilderPreflight(doc, refs)

  return {
    doc,
    summary: {
      layerCount: document.layers.length,
      entityCount: document.entities.length,
      shapeCount: objects.length,
      foldCount: foldLines.length,
      stitchHoleCount: stitchHoles.length,
      patternPieceCount: patternPieces.length,
      seamAllowanceCount: seamAllowances.length,
      seamConnectionCount: seamConnections.length,
      hardwareMarkerCount: hardwareMarkers.length,
      preflightErrorCount: preflight.filter((issue) => issue.severity === 'error').length,
      preflightWarningCount: preflight.filter((issue) => issue.severity === 'warning').length,
    },
    refs,
    preflight,
  }
}
