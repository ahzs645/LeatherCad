import type { FoldDirection, LineTypeRole, Point, TextTransformMode } from '../cad/cad-types'
import {
  AI_BUILDER_ALLOWED_FOLD_DIRECTIONS,
  AI_BUILDER_ALLOWED_LINE_ROLES,
  AI_BUILDER_ALLOWED_TEXT_TRANSFORMS,
  AI_BUILDER_ENTITY_ALLOWED_KEYS,
  AI_BUILDER_ENTITY_TYPE_ORDER,
  AI_BUILDER_ID_PATTERN,
  AI_BUILDER_LAYER_ALLOWED_KEYS,
  AI_BUILDER_POINT_ALLOWED_KEYS,
  AI_BUILDER_TOP_LEVEL_ALLOWED_KEYS,
} from './ai-builder-schema'
import type {
  AiBuilderDocumentV1,
  AiBuilderEntity,
  AiBuilderLayer,
  AiBuilderParseResult,
  AiBuilderValidationError,
} from './ai-builder-types'

type PlainObject = Record<string, unknown>

const AI_BUILDER_ENTITY_TYPES = new Set<string>(AI_BUILDER_ENTITY_TYPE_ORDER)
const AI_BUILDER_TOP_LEVEL_KEY_SET = new Set<string>(AI_BUILDER_TOP_LEVEL_ALLOWED_KEYS)
const AI_BUILDER_LAYER_KEY_SET = new Set<string>(AI_BUILDER_LAYER_ALLOWED_KEYS)
const AI_BUILDER_POINT_KEY_SET = new Set<string>(AI_BUILDER_POINT_ALLOWED_KEYS)
const AI_BUILDER_LINE_ROLE_SET = new Set<string>(AI_BUILDER_ALLOWED_LINE_ROLES)
const AI_BUILDER_TEXT_TRANSFORM_SET = new Set<string>(AI_BUILDER_ALLOWED_TEXT_TRANSFORMS)
const AI_BUILDER_FOLD_DIRECTION_SET = new Set<string>(AI_BUILDER_ALLOWED_FOLD_DIRECTIONS)

function pushError(errors: AiBuilderValidationError[], path: string, message: string) {
  errors.push({ path, message })
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateAllowedKeys(
  value: PlainObject,
  allowedKeys: ReadonlySet<string>,
  path: string,
  errors: AiBuilderValidationError[],
) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      pushError(errors, `${path}.${key}`, 'is not allowed')
    }
  }
}

function validateId(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    pushError(errors, path, 'must be a non-empty string')
    return null
  }
  if (!AI_BUILDER_ID_PATTERN.test(value)) {
    pushError(errors, path, 'must be snake_case')
    return null
  }
  return value
}

function validateRequiredString(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    pushError(errors, path, 'must be a non-empty string')
    return null
  }
  return value
}

function validateOptionalString(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    pushError(errors, path, 'must be a non-empty string when provided')
    return undefined
  }
  return value
}

function validateFiniteNumber(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushError(errors, path, 'must be a finite number')
    return null
  }
  return value
}

function validateOptionalFiniteNumber(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): number | undefined {
  if (value === undefined) {
    return undefined
  }
  return validateFiniteNumber(value, path, errors) ?? undefined
}

function validatePoint(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): Point | null {
  if (!isPlainObject(value)) {
    pushError(errors, path, 'must be an object')
    return null
  }

  validateAllowedKeys(value, AI_BUILDER_POINT_KEY_SET, path, errors)
  const x = validateFiniteNumber(value.x, `${path}.x`, errors)
  const y = validateFiniteNumber(value.y, `${path}.y`, errors)
  if (x === null || y === null) {
    return null
  }

  return { x, y }
}

function validateLineRole(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): LineTypeRole | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !AI_BUILDER_LINE_ROLE_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_LINE_ROLES.join(', ')}`)
    return undefined
  }
  return value as LineTypeRole
}

function validateTextTransform(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): TextTransformMode | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !AI_BUILDER_TEXT_TRANSFORM_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_TEXT_TRANSFORMS.join(', ')}`)
    return undefined
  }
  return value as TextTransformMode
}

function validateFoldDirection(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): FoldDirection | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !AI_BUILDER_FOLD_DIRECTION_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_FOLD_DIRECTIONS.join(', ')}`)
    return undefined
  }
  return value as FoldDirection
}

function reserveId(
  id: string | null,
  path: string,
  seenIds: Set<string>,
  errors: AiBuilderValidationError[],
) {
  if (!id) {
    return
  }
  if (seenIds.has(id)) {
    pushError(errors, path, 'must be unique across layers and entities')
    return
  }
  seenIds.add(id)
}

function validateLayer(
  value: unknown,
  index: number,
  seenIds: Set<string>,
  errors: AiBuilderValidationError[],
): AiBuilderLayer | null {
  const path = `layers[${index}]`
  if (!isPlainObject(value)) {
    pushError(errors, path, 'must be an object')
    return null
  }

  const errorCountBefore = errors.length
  validateAllowedKeys(value, AI_BUILDER_LAYER_KEY_SET, path, errors)

  const id = validateId(value.id, `${path}.id`, errors)
  reserveId(id, `${path}.id`, seenIds, errors)
  const name = validateRequiredString(value.name, `${path}.name`, errors)

  if (errors.length !== errorCountBefore || !id || !name) {
    return null
  }

  return { id, name }
}

function validateLayerReference(
  value: unknown,
  path: string,
  layerIds: Set<string>,
  errors: AiBuilderValidationError[],
): string | null {
  const layerId = validateId(value, path, errors)
  if (!layerId) {
    return null
  }
  if (!layerIds.has(layerId)) {
    pushError(errors, path, 'must reference an existing layer ID')
    return null
  }
  return layerId
}

function validateEntity(
  value: unknown,
  index: number,
  layerIds: Set<string>,
  seenIds: Set<string>,
  errors: AiBuilderValidationError[],
): AiBuilderEntity | null {
  const path = `entities[${index}]`
  if (!isPlainObject(value)) {
    pushError(errors, path, 'must be an object')
    return null
  }

  const id = validateId(value.id, `${path}.id`, errors)
  reserveId(id, `${path}.id`, seenIds, errors)

  if (typeof value.type !== 'string') {
    pushError(errors, `${path}.type`, 'must be a non-empty string')
    return null
  }
  if (!AI_BUILDER_ENTITY_TYPES.has(value.type)) {
    pushError(errors, `${path}.type`, `must be one of ${AI_BUILDER_ENTITY_TYPE_ORDER.join(', ')}`)
    return null
  }

  const entityType = value.type as AiBuilderEntity['type']
  const errorCountBefore = errors.length
  validateAllowedKeys(value, AI_BUILDER_ENTITY_ALLOWED_KEYS[entityType], path, errors)

  if (entityType === 'line') {
    const layer_id = validateLayerReference(value.layer_id, `${path}.layer_id`, layerIds, errors)
    const start = validatePoint(value.start, `${path}.start`, errors)
    const end = validatePoint(value.end, `${path}.end`, errors)
    const line_role = validateLineRole(value.line_role, `${path}.line_role`, errors)
    if (errors.length !== errorCountBefore || !id || !layer_id || !start || !end) {
      return null
    }
    return { id, type: 'line', layer_id, start, end, line_role }
  }

  if (entityType === 'arc') {
    const layer_id = validateLayerReference(value.layer_id, `${path}.layer_id`, layerIds, errors)
    const start = validatePoint(value.start, `${path}.start`, errors)
    const mid = validatePoint(value.mid, `${path}.mid`, errors)
    const end = validatePoint(value.end, `${path}.end`, errors)
    const line_role = validateLineRole(value.line_role, `${path}.line_role`, errors)
    if (errors.length !== errorCountBefore || !id || !layer_id || !start || !mid || !end) {
      return null
    }
    return { id, type: 'arc', layer_id, start, mid, end, line_role }
  }

  if (entityType === 'bezier') {
    const layer_id = validateLayerReference(value.layer_id, `${path}.layer_id`, layerIds, errors)
    const start = validatePoint(value.start, `${path}.start`, errors)
    const control = validatePoint(value.control, `${path}.control`, errors)
    const end = validatePoint(value.end, `${path}.end`, errors)
    const line_role = validateLineRole(value.line_role, `${path}.line_role`, errors)
    if (errors.length !== errorCountBefore || !id || !layer_id || !start || !control || !end) {
      return null
    }
    return { id, type: 'bezier', layer_id, start, control, end, line_role }
  }

  if (entityType === 'rectangle') {
    const layer_id = validateLayerReference(value.layer_id, `${path}.layer_id`, layerIds, errors)
    const x = validateFiniteNumber(value.x, `${path}.x`, errors)
    const y = validateFiniteNumber(value.y, `${path}.y`, errors)
    const width = validateFiniteNumber(value.width, `${path}.width`, errors)
    const height = validateFiniteNumber(value.height, `${path}.height`, errors)
    const line_role = validateLineRole(value.line_role, `${path}.line_role`, errors)
    if (width !== null && width <= 0) {
      pushError(errors, `${path}.width`, 'must be greater than 0')
    }
    if (height !== null && height <= 0) {
      pushError(errors, `${path}.height`, 'must be greater than 0')
    }
    if (errors.length !== errorCountBefore || !id || !layer_id || x === null || y === null || width === null || height === null) {
      return null
    }
    return { id, type: 'rectangle', layer_id, x, y, width, height, line_role }
  }

  if (entityType === 'text') {
    const layer_id = validateLayerReference(value.layer_id, `${path}.layer_id`, layerIds, errors)
    const position = validatePoint(value.position, `${path}.position`, errors)
    const labelValue = validateRequiredString(value.value, `${path}.value`, errors)
    const font_family = validateOptionalString(value.font_family, `${path}.font_family`, errors)
    const font_size_mm = validateOptionalFiniteNumber(value.font_size_mm, `${path}.font_size_mm`, errors)
    const line_role = validateLineRole(value.line_role, `${path}.line_role`, errors)
    const transform = validateTextTransform(value.transform, `${path}.transform`, errors)
    const radius_mm = validateOptionalFiniteNumber(value.radius_mm, `${path}.radius_mm`, errors)
    const sweep_deg = validateOptionalFiniteNumber(value.sweep_deg, `${path}.sweep_deg`, errors)

    if (font_size_mm !== undefined && font_size_mm <= 0) {
      pushError(errors, `${path}.font_size_mm`, 'must be greater than 0')
    }
    if (radius_mm !== undefined && radius_mm <= 0) {
      pushError(errors, `${path}.radius_mm`, 'must be greater than 0')
    }
    if (errors.length !== errorCountBefore || !id || !layer_id || !position || !labelValue) {
      return null
    }
    return {
      id,
      type: 'text',
      layer_id,
      position,
      value: labelValue,
      font_family,
      font_size_mm,
      line_role,
      transform,
      radius_mm,
      sweep_deg,
    }
  }

  const start = validatePoint(value.start, `${path}.start`, errors)
  const end = validatePoint(value.end, `${path}.end`, errors)
  const name = validateOptionalString(value.name, `${path}.name`, errors)
  const direction = validateFoldDirection(value.direction, `${path}.direction`, errors)
  const angle_deg = validateOptionalFiniteNumber(value.angle_deg, `${path}.angle_deg`, errors)
  const max_angle_deg = validateOptionalFiniteNumber(value.max_angle_deg, `${path}.max_angle_deg`, errors)
  const radius_mm = validateOptionalFiniteNumber(value.radius_mm, `${path}.radius_mm`, errors)
  const thickness_mm = validateOptionalFiniteNumber(value.thickness_mm, `${path}.thickness_mm`, errors)
  const neutral_axis_ratio = validateOptionalFiniteNumber(value.neutral_axis_ratio, `${path}.neutral_axis_ratio`, errors)
  const stiffness = validateOptionalFiniteNumber(value.stiffness, `${path}.stiffness`, errors)
  const clearance_mm = validateOptionalFiniteNumber(value.clearance_mm, `${path}.clearance_mm`, errors)

  if (max_angle_deg !== undefined && (max_angle_deg < 10 || max_angle_deg > 180)) {
    pushError(errors, `${path}.max_angle_deg`, 'must be between 10 and 180')
  }
  if (radius_mm !== undefined && radius_mm < 0) {
    pushError(errors, `${path}.radius_mm`, 'must be 0 or greater')
  }
  if (thickness_mm !== undefined && thickness_mm <= 0) {
    pushError(errors, `${path}.thickness_mm`, 'must be greater than 0')
  }
  if (neutral_axis_ratio !== undefined && (neutral_axis_ratio < 0 || neutral_axis_ratio > 1)) {
    pushError(errors, `${path}.neutral_axis_ratio`, 'must be between 0 and 1')
  }
  if (stiffness !== undefined && (stiffness < 0 || stiffness > 1)) {
    pushError(errors, `${path}.stiffness`, 'must be between 0 and 1')
  }
  if (clearance_mm !== undefined && clearance_mm < 0) {
    pushError(errors, `${path}.clearance_mm`, 'must be 0 or greater')
  }
  if (
    angle_deg !== undefined &&
    max_angle_deg !== undefined &&
    Number.isFinite(angle_deg) &&
    Number.isFinite(max_angle_deg) &&
    Math.abs(angle_deg) > max_angle_deg
  ) {
    pushError(errors, `${path}.angle_deg`, 'must not exceed max_angle_deg in absolute value')
  }
  if (errors.length !== errorCountBefore || !id || !start || !end) {
    return null
  }

  return {
    id,
    type: 'fold',
    start,
    end,
    name,
    direction,
    angle_deg,
    max_angle_deg,
    radius_mm,
    thickness_mm,
    neutral_axis_ratio,
    stiffness,
    clearance_mm,
  }
}

export function parseAiBuilderDocument(raw: string): AiBuilderParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          path: '$',
          message: `invalid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`,
        },
      ],
    }
  }

  const errors: AiBuilderValidationError[] = []
  if (!isPlainObject(parsed)) {
    pushError(errors, '$', 'must be a JSON object')
    return { ok: false, errors }
  }

  validateAllowedKeys(parsed, AI_BUILDER_TOP_LEVEL_KEY_SET, '$', errors)

  if (parsed.schema_version !== 1) {
    pushError(errors, '$.schema_version', 'must be 1')
  }

  const documentName = validateRequiredString(parsed.document_name, '$.document_name', errors)
  if (parsed.units !== 'mm') {
    pushError(errors, '$.units', 'must be "mm"')
  }

  const seenIds = new Set<string>()
  const layers: AiBuilderLayer[] = []
  if (!Array.isArray(parsed.layers)) {
    pushError(errors, '$.layers', 'must be a non-empty array')
  } else if (parsed.layers.length === 0) {
    pushError(errors, '$.layers', 'must not be empty')
  } else {
    parsed.layers.forEach((layer, index) => {
      const parsedLayer = validateLayer(layer, index, seenIds, errors)
      if (parsedLayer) {
        layers.push(parsedLayer)
      }
    })
  }

  const layerIds = new Set(layers.map((layer) => layer.id))
  const entities: AiBuilderEntity[] = []
  if (!Array.isArray(parsed.entities)) {
    pushError(errors, '$.entities', 'must be a non-empty array')
  } else if (parsed.entities.length === 0) {
    pushError(errors, '$.entities', 'must not be empty')
  } else {
    parsed.entities.forEach((entity, index) => {
      const parsedEntity = validateEntity(entity, index, layerIds, seenIds, errors)
      if (parsedEntity) {
        entities.push(parsedEntity)
      }
    })
  }

  if (errors.length > 0 || !documentName) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    document: {
      schema_version: 1,
      document_name: documentName,
      units: 'mm',
      layers,
      entities,
    } satisfies AiBuilderDocumentV1,
    errors: [],
  }
}
