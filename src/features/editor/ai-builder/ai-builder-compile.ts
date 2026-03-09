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
  Layer,
  LineTypeRole,
  Shape,
} from '../cad/cad-types'
import {
  DEFAULT_FOLD_CLEARANCE_MM,
  DEFAULT_FOLD_DIRECTION,
  DEFAULT_FOLD_NEUTRAL_AXIS_RATIO,
  DEFAULT_FOLD_RADIUS_MM,
  DEFAULT_FOLD_STIFFNESS,
  DEFAULT_FOLD_THICKNESS_MM,
} from '../ops/fold-line-ops'
import { AI_BUILDER_TEXT_DEFAULTS } from './ai-builder-schema'
import type {
  AiBuilderCompileResult,
  AiBuilderDocumentV1,
  AiBuilderEntity,
} from './ai-builder-types'

const LINE_ROLE_TO_TYPE_ID: Record<LineTypeRole, string> = {
  cut: CUT_LINE_TYPE_ID,
  stitch: STITCH_LINE_TYPE_ID,
  fold: FOLD_LINE_TYPE_ID,
  guide: GUIDE_LINE_TYPE_ID,
  mark: MARK_LINE_TYPE_ID,
}

function resolveLineTypeId(entity: AiBuilderEntity) {
  const role =
    entity.type === 'text'
      ? entity.line_role ?? 'mark'
      : entity.type === 'fold'
        ? 'fold'
        : entity.line_role ?? 'cut'
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

function compileShape(entity: Exclude<AiBuilderEntity, { type: 'fold' }>): Shape[] {
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

  document.entities.forEach((entity) => {
    if (entity.type === 'fold') {
      foldLines.push(compileFoldLine(entity))
      return
    }
    objects.push(...compileShape(entity))
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
  }

  return {
    doc,
    summary: {
      layerCount: document.layers.length,
      entityCount: document.entities.length,
      shapeCount: objects.length,
      foldCount: foldLines.length,
    },
  }
}
