import type {
  FoldDirection,
  HardwareKind,
  LineTypeRole,
  PatternPieceOrientation,
  PieceSeamAllowanceEdgeOverride,
  Point,
  SeamConnectionKind,
  StitchHoleRenderShape,
  StitchHoleType,
  TextTransformMode,
} from '../cad/cad-types'
import {
  AI_BUILDER_ALLOWED_FOLD_DIRECTIONS,
  AI_BUILDER_ALLOWED_HARDWARE_KINDS,
  AI_BUILDER_ALLOWED_LINE_ROLES,
  AI_BUILDER_ALLOWED_MATERIAL_SIDES,
  AI_BUILDER_ALLOWED_PATTERN_ORIENTATIONS,
  AI_BUILDER_ALLOWED_SEAM_CONNECTION_KINDS,
  AI_BUILDER_ALLOWED_STITCH_HOLE_TYPES,
  AI_BUILDER_ALLOWED_STITCH_PATH_TYPES,
  AI_BUILDER_ALLOWED_STITCH_RENDER_SHAPES,
  AI_BUILDER_ALLOWED_TEXT_TRANSFORMS,
  AI_BUILDER_ENTITY_ALLOWED_KEYS,
  AI_BUILDER_ENTITY_TYPE_ORDER,
  AI_BUILDER_ID_PATTERN,
  AI_BUILDER_LAYER_ALLOWED_KEYS,
  AI_BUILDER_POINT_ALLOWED_KEYS,
  AI_BUILDER_TOP_LEVEL_ALLOWED_KEYS,
} from './ai-builder-schema'
import type {
  AiBuilderEdgeRef,
  AiBuilderMaterialSide,
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
const AI_BUILDER_MATERIAL_SIDE_SET = new Set<string>(AI_BUILDER_ALLOWED_MATERIAL_SIDES)
const AI_BUILDER_PATTERN_ORIENTATION_SET = new Set<string>(AI_BUILDER_ALLOWED_PATTERN_ORIENTATIONS)
const AI_BUILDER_SEAM_CONNECTION_KIND_SET = new Set<string>(AI_BUILDER_ALLOWED_SEAM_CONNECTION_KINDS)
const AI_BUILDER_HARDWARE_KIND_SET = new Set<string>(AI_BUILDER_ALLOWED_HARDWARE_KINDS)
const AI_BUILDER_STITCH_PATH_TYPE_SET = new Set<string>(AI_BUILDER_ALLOWED_STITCH_PATH_TYPES)
const AI_BUILDER_STITCH_HOLE_TYPE_SET = new Set<string>(AI_BUILDER_ALLOWED_STITCH_HOLE_TYPES)
const AI_BUILDER_STITCH_RENDER_SHAPE_SET = new Set<string>(AI_BUILDER_ALLOWED_STITCH_RENDER_SHAPES)

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

function validateOptionalBoolean(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): boolean | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'boolean') {
    pushError(errors, path, 'must be a boolean when provided')
    return undefined
  }
  return value
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

function validateOptionalPoint(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): Point | undefined {
  if (value === undefined) {
    return undefined
  }
  return validatePoint(value, path, errors) ?? undefined
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

function validateMaterialSide(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): AiBuilderMaterialSide | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !AI_BUILDER_MATERIAL_SIDE_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_MATERIAL_SIDES.join(', ')}`)
    return undefined
  }
  return value as AiBuilderMaterialSide
}

function validatePatternOrientation(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): PatternPieceOrientation | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !AI_BUILDER_PATTERN_ORIENTATION_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_PATTERN_ORIENTATIONS.join(', ')}`)
    return undefined
  }
  return value as PatternPieceOrientation
}

function validateSeamConnectionKind(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): SeamConnectionKind | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !AI_BUILDER_SEAM_CONNECTION_KIND_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_SEAM_CONNECTION_KINDS.join(', ')}`)
    return undefined
  }
  return value as SeamConnectionKind
}

function validateHardwareKind(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): HardwareKind | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !AI_BUILDER_HARDWARE_KIND_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_HARDWARE_KINDS.join(', ')}`)
    return undefined
  }
  return value as HardwareKind
}

function validateStitchPathType(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): 'line' | 'arc' | 'bezier' | null {
  if (typeof value !== 'string' || !AI_BUILDER_STITCH_PATH_TYPE_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_STITCH_PATH_TYPES.join(', ')}`)
    return null
  }
  return value as 'line' | 'arc' | 'bezier'
}

function validateStitchHoleType(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): StitchHoleType | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !AI_BUILDER_STITCH_HOLE_TYPE_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_STITCH_HOLE_TYPES.join(', ')}`)
    return undefined
  }
  return value as StitchHoleType
}

function validateStitchRenderShape(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): StitchHoleRenderShape | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !AI_BUILDER_STITCH_RENDER_SHAPE_SET.has(value)) {
    pushError(errors, path, `must be one of ${AI_BUILDER_ALLOWED_STITCH_RENDER_SHAPES.join(', ')}`)
    return undefined
  }
  return value as StitchHoleRenderShape
}

function validateOptionalIdArray(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): string[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value)) {
    pushError(errors, path, 'must be an array when provided')
    return undefined
  }
  const result: string[] = []
  value.forEach((entry, index) => {
    const id = validateId(entry, `${path}[${index}]`, errors)
    if (id) {
      result.push(id)
    }
  })
  return result
}

function validateEdgeOverrides(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): PieceSeamAllowanceEdgeOverride[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value)) {
    pushError(errors, path, 'must be an array when provided')
    return undefined
  }

  const result: PieceSeamAllowanceEdgeOverride[] = []
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`
    if (!isPlainObject(entry)) {
      pushError(errors, entryPath, 'must be an object')
      return
    }
    const edgeIndex = validateFiniteNumber(entry.edgeIndex, `${entryPath}.edgeIndex`, errors)
    const offsetMm = validateFiniteNumber(entry.offsetMm, `${entryPath}.offsetMm`, errors)
    if (edgeIndex !== null && (!Number.isInteger(edgeIndex) || edgeIndex < 0)) {
      pushError(errors, `${entryPath}.edgeIndex`, 'must be a non-negative integer')
    }
    if (offsetMm !== null && offsetMm < 0) {
      pushError(errors, `${entryPath}.offsetMm`, 'must be 0 or greater')
    }
    if (edgeIndex !== null && offsetMm !== null) {
      result.push({ edgeIndex, offsetMm })
    }
  })
  return result
}

function validateAiBuilderEdgeRef(
  value: unknown,
  path: string,
  errors: AiBuilderValidationError[],
): AiBuilderEdgeRef | null {
  if (!isPlainObject(value)) {
    pushError(errors, path, 'must be an object')
    return null
  }
  const piece_id = validateId(value.piece_id, `${path}.piece_id`, errors)
  const edgeIndex = validateFiniteNumber(value.edge_index, `${path}.edge_index`, errors)
  const t0 = validateOptionalFiniteNumber(value.t0, `${path}.t0`, errors)
  const t1 = validateOptionalFiniteNumber(value.t1, `${path}.t1`, errors)
  const reversed = validateOptionalBoolean(value.reversed, `${path}.reversed`, errors)

  if (edgeIndex !== null && (!Number.isInteger(edgeIndex) || edgeIndex < 0)) {
    pushError(errors, `${path}.edge_index`, 'must be a non-negative integer')
  }
  for (const [key, value] of [['t0', t0], ['t1', t1]] as const) {
    if (value !== undefined && (value < 0 || value > 1)) {
      pushError(errors, `${path}.${key}`, 'must be between 0 and 1')
    }
  }
  if (t0 !== undefined && t1 !== undefined && t1 < t0) {
    pushError(errors, `${path}.t1`, 'must be greater than or equal to t0')
  }
  if (!piece_id || edgeIndex === null) {
    return null
  }
  return {
    piece_id,
    edge_index: edgeIndex,
    t0,
    t1,
    reversed,
  }
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

  if (entityType === 'stitch_path') {
    const layer_id = validateLayerReference(value.layer_id, `${path}.layer_id`, layerIds, errors)
    const path_type = validateStitchPathType(value.path_type, `${path}.path_type`, errors)
    const start = validatePoint(value.start, `${path}.start`, errors)
    const end = validatePoint(value.end, `${path}.end`, errors)
    const mid = validateOptionalPoint(value.mid, `${path}.mid`, errors)
    const control = validateOptionalPoint(value.control, `${path}.control`, errors)
    const pitch_mm = validateFiniteNumber(value.pitch_mm, `${path}.pitch_mm`, errors)
    const hole_type = validateStitchHoleType(value.hole_type, `${path}.hole_type`, errors)
    const render_shape = validateStitchRenderShape(value.render_shape, `${path}.render_shape`, errors)
    const diameter_mm = validateOptionalFiniteNumber(value.diameter_mm, `${path}.diameter_mm`, errors)
    const width_mm = validateOptionalFiniteNumber(value.width_mm, `${path}.width_mm`, errors)
    const height_mm = validateOptionalFiniteNumber(value.height_mm, `${path}.height_mm`, errors)
    const tilt_deg = validateOptionalFiniteNumber(value.tilt_deg, `${path}.tilt_deg`, errors)
    const inverted = validateOptionalBoolean(value.inverted, `${path}.inverted`, errors)
    const include_start_hole = validateOptionalBoolean(value.include_start_hole, `${path}.include_start_hole`, errors)
    const force_fit_last_hole = validateOptionalBoolean(value.force_fit_last_hole, `${path}.force_fit_last_hole`, errors)

    if (path_type === 'arc' && !mid) {
      pushError(errors, `${path}.mid`, 'is required when path_type is arc')
    }
    if (path_type !== 'arc' && value.mid !== undefined) {
      pushError(errors, `${path}.mid`, 'is only allowed when path_type is arc')
    }
    if (path_type === 'bezier' && !control) {
      pushError(errors, `${path}.control`, 'is required when path_type is bezier')
    }
    if (path_type !== 'bezier' && value.control !== undefined) {
      pushError(errors, `${path}.control`, 'is only allowed when path_type is bezier')
    }
    if (pitch_mm !== null && pitch_mm <= 0) {
      pushError(errors, `${path}.pitch_mm`, 'must be greater than 0')
    }
    if (diameter_mm !== undefined && diameter_mm <= 0) {
      pushError(errors, `${path}.diameter_mm`, 'must be greater than 0')
    }
    if (width_mm !== undefined && width_mm <= 0) {
      pushError(errors, `${path}.width_mm`, 'must be greater than 0')
    }
    if (height_mm !== undefined && height_mm <= 0) {
      pushError(errors, `${path}.height_mm`, 'must be greater than 0')
    }

    if (errors.length !== errorCountBefore || !id || !layer_id || !path_type || !start || !end || pitch_mm === null) {
      return null
    }

    return {
      id,
      type: 'stitch_path',
      layer_id,
      path_type,
      start,
      mid,
      control,
      end,
      pitch_mm,
      hole_type,
      render_shape,
      diameter_mm,
      width_mm,
      height_mm,
      tilt_deg,
      inverted,
      include_start_hole,
      force_fit_last_hole,
    }
  }

  if (entityType === 'pattern_piece') {
    const layer_id = validateLayerReference(value.layer_id, `${path}.layer_id`, layerIds, errors)
    const boundary_entity_id = validateId(value.boundary_entity_id, `${path}.boundary_entity_id`, errors)
    const internal_entity_ids = validateOptionalIdArray(value.internal_entity_ids, `${path}.internal_entity_ids`, errors)
    const name = validateRequiredString(value.name, `${path}.name`, errors)
    const quantity = validateOptionalFiniteNumber(value.quantity, `${path}.quantity`, errors)
    const code = validateOptionalString(value.code, `${path}.code`, errors)
    const annotation = validateOptionalString(value.annotation, `${path}.annotation`, errors)
    const material = validateOptionalString(value.material, `${path}.material`, errors)
    const material_side = validateMaterialSide(value.material_side, `${path}.material_side`, errors)
    const notes = validateOptionalString(value.notes, `${path}.notes`, errors)
    const on_fold = validateOptionalBoolean(value.on_fold, `${path}.on_fold`, errors)
    const mirror_pair = validateOptionalBoolean(value.mirror_pair, `${path}.mirror_pair`, errors)
    const orientation = validatePatternOrientation(value.orientation, `${path}.orientation`, errors)
    const allow_flip = validateOptionalBoolean(value.allow_flip, `${path}.allow_flip`, errors)
    const include_in_layout = validateOptionalBoolean(value.include_in_layout, `${path}.include_in_layout`, errors)
    const color = validateOptionalString(value.color, `${path}.color`, errors)
    const fill = validateOptionalString(value.fill, `${path}.fill`, errors)

    if (quantity !== undefined && (!Number.isInteger(quantity) || quantity <= 0)) {
      pushError(errors, `${path}.quantity`, 'must be a positive integer')
    }
    if (errors.length !== errorCountBefore || !id || !layer_id || !boundary_entity_id || !name) {
      return null
    }

    return {
      id,
      type: 'pattern_piece',
      layer_id,
      boundary_entity_id,
      internal_entity_ids,
      name,
      quantity,
      code,
      annotation,
      material,
      material_side,
      notes,
      on_fold,
      mirror_pair,
      orientation,
      allow_flip,
      include_in_layout,
      color,
      fill,
    }
  }

  if (entityType === 'seam_allowance') {
    const piece_id = validateId(value.piece_id, `${path}.piece_id`, errors)
    const default_offset_mm = validateFiniteNumber(value.default_offset_mm, `${path}.default_offset_mm`, errors)
    const enabled = validateOptionalBoolean(value.enabled, `${path}.enabled`, errors)
    const edge_overrides = validateEdgeOverrides(value.edge_overrides, `${path}.edge_overrides`, errors)

    if (default_offset_mm !== null && default_offset_mm < 0) {
      pushError(errors, `${path}.default_offset_mm`, 'must be 0 or greater')
    }
    if (errors.length !== errorCountBefore || !id || !piece_id || default_offset_mm === null) {
      return null
    }

    return {
      id,
      type: 'seam_allowance',
      piece_id,
      default_offset_mm,
      enabled,
      edge_overrides,
    }
  }

  if (entityType === 'seam_connection') {
    const from = validateAiBuilderEdgeRef(value.from, `${path}.from`, errors)
    const to = validateAiBuilderEdgeRef(value.to, `${path}.to`, errors)
    const kind = validateSeamConnectionKind(value.kind, `${path}.kind`, errors)
    const stitch_spacing_mm = validateOptionalFiniteNumber(value.stitch_spacing_mm, `${path}.stitch_spacing_mm`, errors)
    const tolerance_mm = validateOptionalFiniteNumber(value.tolerance_mm, `${path}.tolerance_mm`, errors)
    const reversed = validateOptionalBoolean(value.reversed, `${path}.reversed`, errors)

    if (stitch_spacing_mm !== undefined && stitch_spacing_mm <= 0) {
      pushError(errors, `${path}.stitch_spacing_mm`, 'must be greater than 0')
    }
    if (tolerance_mm !== undefined && tolerance_mm < 0) {
      pushError(errors, `${path}.tolerance_mm`, 'must be 0 or greater')
    }
    if (errors.length !== errorCountBefore || !id || !from || !to) {
      return null
    }

    return {
      id,
      type: 'seam_connection',
      from,
      to,
      kind,
      stitch_spacing_mm,
      tolerance_mm,
      reversed,
    }
  }

  if (entityType === 'hardware_marker') {
    const layer_id = validateLayerReference(value.layer_id, `${path}.layer_id`, layerIds, errors)
    const point = validatePoint(value.point, `${path}.point`, errors)
    const kind = validateHardwareKind(value.kind, `${path}.kind`, errors)
    const label = validateOptionalString(value.label, `${path}.label`, errors)
    const hole_diameter_mm = validateOptionalFiniteNumber(value.hole_diameter_mm, `${path}.hole_diameter_mm`, errors)
    const spacing_mm = validateOptionalFiniteNumber(value.spacing_mm, `${path}.spacing_mm`, errors)
    const installation_side = validateMaterialSide(value.installation_side, `${path}.installation_side`, errors)
    const notes = validateOptionalString(value.notes, `${path}.notes`, errors)
    const visible = validateOptionalBoolean(value.visible, `${path}.visible`, errors)

    if (hole_diameter_mm !== undefined && hole_diameter_mm <= 0) {
      pushError(errors, `${path}.hole_diameter_mm`, 'must be greater than 0')
    }
    if (spacing_mm !== undefined && spacing_mm < 0) {
      pushError(errors, `${path}.spacing_mm`, 'must be 0 or greater')
    }
    if (errors.length !== errorCountBefore || !id || !layer_id || !point) {
      return null
    }

    return {
      id,
      type: 'hardware_marker',
      layer_id,
      point,
      kind,
      label,
      hole_diameter_mm,
      spacing_mm,
      installation_side,
      notes,
      visible,
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

function validateEntityReferences(entities: AiBuilderEntity[], errors: AiBuilderValidationError[]) {
  const shapeEntityIds = new Set(
    entities
      .filter((entity) =>
        entity.type === 'line' ||
        entity.type === 'arc' ||
        entity.type === 'bezier' ||
        entity.type === 'rectangle' ||
        entity.type === 'text' ||
        entity.type === 'stitch_path',
      )
      .map((entity) => entity.id),
  )
  const patternPieceEntityIds = new Set(
    entities
      .filter((entity): entity is Extract<AiBuilderEntity, { type: 'pattern_piece' }> => entity.type === 'pattern_piece')
      .map((entity) => entity.id),
  )

  entities.forEach((entity, index) => {
    const path = `entities[${index}]`
    if (entity.type === 'pattern_piece') {
      if (!shapeEntityIds.has(entity.boundary_entity_id)) {
        pushError(errors, `${path}.boundary_entity_id`, 'must reference a generated shape entity')
      }
      entity.internal_entity_ids?.forEach((entityId, internalIndex) => {
        if (!shapeEntityIds.has(entityId)) {
          pushError(errors, `${path}.internal_entity_ids[${internalIndex}]`, 'must reference a generated shape entity')
        }
      })
      return
    }

    if (entity.type === 'seam_allowance') {
      if (!patternPieceEntityIds.has(entity.piece_id)) {
        pushError(errors, `${path}.piece_id`, 'must reference a pattern_piece entity')
      }
      return
    }

    if (entity.type === 'seam_connection') {
      if (!patternPieceEntityIds.has(entity.from.piece_id)) {
        pushError(errors, `${path}.from.piece_id`, 'must reference a pattern_piece entity')
      }
      if (!patternPieceEntityIds.has(entity.to.piece_id)) {
        pushError(errors, `${path}.to.piece_id`, 'must reference a pattern_piece entity')
      }
    }
  })
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

  validateEntityReferences(entities, errors)

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
