import type { FoldDirection, LineTypeRole, TextTransformMode } from '../cad/cad-types'
import type { AiBuilderEntity } from './ai-builder-types'

type AiBuilderSchemaField = {
  key: string
  required: boolean
  type: string
  description: string
}

type AiBuilderEntitySchema = {
  type: AiBuilderEntity['type']
  description: string
  requiredKeys: readonly string[]
  optionalKeys: readonly string[]
  fields: readonly AiBuilderSchemaField[]
}

export const AI_BUILDER_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/

export const AI_BUILDER_DEFAULT_REQUEST =
  'Create a simple leather pattern using only supported AI Builder primitives.'

export const AI_BUILDER_TOP_LEVEL_ALLOWED_KEYS = [
  'schema_version',
  'document_name',
  'units',
  'layers',
  'entities',
] as const

export const AI_BUILDER_LAYER_ALLOWED_KEYS = ['id', 'name'] as const
export const AI_BUILDER_POINT_ALLOWED_KEYS = ['x', 'y'] as const

export const AI_BUILDER_ALLOWED_LINE_ROLES: readonly LineTypeRole[] = [
  'cut',
  'stitch',
  'fold',
  'guide',
  'mark',
]

export const AI_BUILDER_ALLOWED_TEXT_TRANSFORMS: readonly TextTransformMode[] = [
  'none',
  'arch',
  'ring',
]

export const AI_BUILDER_ALLOWED_FOLD_DIRECTIONS: readonly FoldDirection[] = [
  'mountain',
  'valley',
]

export const AI_BUILDER_UNSUPPORTED_FEATURES = [
  'stitch holes',
  'hardware markers',
  'constraints',
  'pattern pieces',
  'piece labels',
  '3D settings',
  'comments',
  'markdown',
] as const

export const AI_BUILDER_TEXT_DEFAULTS = {
  fontFamily: 'Georgia, serif',
  fontSizeMm: 14,
  transform: 'none' as TextTransformMode,
  radiusMm: 40,
  sweepDeg: 140,
}

export const AI_BUILDER_ENTITY_TYPE_ORDER = [
  'line',
  'arc',
  'bezier',
  'rectangle',
  'text',
  'fold',
] as const satisfies ReadonlyArray<AiBuilderEntity['type']>

export const AI_BUILDER_TOP_LEVEL_FIELDS = [
  {
    key: 'schema_version',
    required: true,
    type: 'literal number',
    description: 'Must be 1.',
  },
  {
    key: 'document_name',
    required: true,
    type: 'string',
    description: 'Human-readable name for the generated pattern document.',
  },
  {
    key: 'units',
    required: true,
    type: 'literal string',
    description: 'Must be "mm".',
  },
  {
    key: 'layers',
    required: true,
    type: 'AiBuilderLayer[]',
    description: 'Non-empty array of layer definitions.',
  },
  {
    key: 'entities',
    required: true,
    type: 'AiBuilderEntity[]',
    description: 'Non-empty array of supported primitive entities.',
  },
] as const satisfies ReadonlyArray<AiBuilderSchemaField>

export const AI_BUILDER_ENTITY_SCHEMAS: Record<AiBuilderEntity['type'], AiBuilderEntitySchema> = {
  line: {
    type: 'line',
    description: 'Straight segment between two points on a layer.',
    requiredKeys: ['id', 'type', 'layer_id', 'start', 'end'],
    optionalKeys: ['line_role'],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "line".' },
      { key: 'layer_id', required: true, type: 'snake_case string', description: 'Existing layer ID.' },
      { key: 'start', required: true, type: 'Point', description: 'Start point with x and y in millimeters.' },
      { key: 'end', required: true, type: 'Point', description: 'End point with x and y in millimeters.' },
      {
        key: 'line_role',
        required: false,
        type: 'enum',
        description: `Optional line role. Allowed: ${AI_BUILDER_ALLOWED_LINE_ROLES.join(', ')}.`,
      },
    ],
  },
  arc: {
    type: 'arc',
    description: 'Three-point arc segment on a layer.',
    requiredKeys: ['id', 'type', 'layer_id', 'start', 'mid', 'end'],
    optionalKeys: ['line_role'],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "arc".' },
      { key: 'layer_id', required: true, type: 'snake_case string', description: 'Existing layer ID.' },
      { key: 'start', required: true, type: 'Point', description: 'Start point with x and y in millimeters.' },
      { key: 'mid', required: true, type: 'Point', description: 'Mid point with x and y in millimeters.' },
      { key: 'end', required: true, type: 'Point', description: 'End point with x and y in millimeters.' },
      {
        key: 'line_role',
        required: false,
        type: 'enum',
        description: `Optional line role. Allowed: ${AI_BUILDER_ALLOWED_LINE_ROLES.join(', ')}.`,
      },
    ],
  },
  bezier: {
    type: 'bezier',
    description: 'Quadratic bezier segment with one control point on a layer.',
    requiredKeys: ['id', 'type', 'layer_id', 'start', 'control', 'end'],
    optionalKeys: ['line_role'],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "bezier".' },
      { key: 'layer_id', required: true, type: 'snake_case string', description: 'Existing layer ID.' },
      { key: 'start', required: true, type: 'Point', description: 'Start point with x and y in millimeters.' },
      { key: 'control', required: true, type: 'Point', description: 'Control point with x and y in millimeters.' },
      { key: 'end', required: true, type: 'Point', description: 'End point with x and y in millimeters.' },
      {
        key: 'line_role',
        required: false,
        type: 'enum',
        description: `Optional line role. Allowed: ${AI_BUILDER_ALLOWED_LINE_ROLES.join(', ')}.`,
      },
    ],
  },
  rectangle: {
    type: 'rectangle',
    description: 'Axis-aligned rectangle macro that compiles to four line shapes on a layer.',
    requiredKeys: ['id', 'type', 'layer_id', 'x', 'y', 'width', 'height'],
    optionalKeys: ['line_role'],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "rectangle".' },
      { key: 'layer_id', required: true, type: 'snake_case string', description: 'Existing layer ID.' },
      { key: 'x', required: true, type: 'number', description: 'Left coordinate in millimeters.' },
      { key: 'y', required: true, type: 'number', description: 'Top coordinate in millimeters.' },
      { key: 'width', required: true, type: 'positive number', description: 'Rectangle width in millimeters.' },
      { key: 'height', required: true, type: 'positive number', description: 'Rectangle height in millimeters.' },
      {
        key: 'line_role',
        required: false,
        type: 'enum',
        description: `Optional line role. Allowed: ${AI_BUILDER_ALLOWED_LINE_ROLES.join(', ')}.`,
      },
    ],
  },
  text: {
    type: 'text',
    description: 'Text annotation on a layer. Position is the native text start point.',
    requiredKeys: ['id', 'type', 'layer_id', 'position', 'value'],
    optionalKeys: ['font_family', 'font_size_mm', 'line_role', 'transform', 'radius_mm', 'sweep_deg'],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "text".' },
      { key: 'layer_id', required: true, type: 'snake_case string', description: 'Existing layer ID.' },
      { key: 'position', required: true, type: 'Point', description: 'Text anchor point with x and y in millimeters.' },
      { key: 'value', required: true, type: 'string', description: 'Visible text value.' },
      { key: 'font_family', required: false, type: 'string', description: `Defaults to "${AI_BUILDER_TEXT_DEFAULTS.fontFamily}".` },
      { key: 'font_size_mm', required: false, type: 'positive number', description: `Defaults to ${AI_BUILDER_TEXT_DEFAULTS.fontSizeMm}.` },
      {
        key: 'line_role',
        required: false,
        type: 'enum',
        description: `Optional line role. Allowed: ${AI_BUILDER_ALLOWED_LINE_ROLES.join(', ')}. Defaults to mark for text.`,
      },
      {
        key: 'transform',
        required: false,
        type: 'enum',
        description: `Optional text transform. Allowed: ${AI_BUILDER_ALLOWED_TEXT_TRANSFORMS.join(', ')}.`,
      },
      { key: 'radius_mm', required: false, type: 'number', description: `Optional text radius. Defaults to ${AI_BUILDER_TEXT_DEFAULTS.radiusMm}.` },
      { key: 'sweep_deg', required: false, type: 'number', description: `Optional text sweep. Defaults to ${AI_BUILDER_TEXT_DEFAULTS.sweepDeg}.` },
    ],
  },
  fold: {
    type: 'fold',
    description: 'Fold line behavior that compiles to a native LeatherCad fold line.',
    requiredKeys: ['id', 'type', 'start', 'end'],
    optionalKeys: [
      'name',
      'direction',
      'angle_deg',
      'max_angle_deg',
      'radius_mm',
      'thickness_mm',
      'neutral_axis_ratio',
      'stiffness',
      'clearance_mm',
    ],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "fold".' },
      { key: 'start', required: true, type: 'Point', description: 'Fold start point with x and y in millimeters.' },
      { key: 'end', required: true, type: 'Point', description: 'Fold end point with x and y in millimeters.' },
      { key: 'name', required: false, type: 'string', description: 'Optional fold display name.' },
      {
        key: 'direction',
        required: false,
        type: 'enum',
        description: `Optional fold direction. Allowed: ${AI_BUILDER_ALLOWED_FOLD_DIRECTIONS.join(', ')}.`,
      },
      { key: 'angle_deg', required: false, type: 'number', description: 'Optional target fold angle in degrees.' },
      { key: 'max_angle_deg', required: false, type: 'number', description: 'Optional max fold angle in degrees (10..180).' },
      { key: 'radius_mm', required: false, type: 'number', description: 'Optional fold radius in millimeters.' },
      { key: 'thickness_mm', required: false, type: 'number', description: 'Optional material thickness in millimeters.' },
      {
        key: 'neutral_axis_ratio',
        required: false,
        type: 'number',
        description: 'Optional neutral axis ratio between 0 and 1.',
      },
      { key: 'stiffness', required: false, type: 'number', description: 'Optional stiffness between 0 and 1.' },
      { key: 'clearance_mm', required: false, type: 'number', description: 'Optional clearance in millimeters.' },
    ],
  },
}

export const AI_BUILDER_ENTITY_ALLOWED_KEYS: Record<AiBuilderEntity['type'], ReadonlySet<string>> = {
  line: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.line.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.line.optionalKeys,
  ]),
  arc: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.arc.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.arc.optionalKeys,
  ]),
  bezier: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.bezier.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.bezier.optionalKeys,
  ]),
  rectangle: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.rectangle.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.rectangle.optionalKeys,
  ]),
  text: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.text.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.text.optionalKeys,
  ]),
  fold: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.fold.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.fold.optionalKeys,
  ]),
}
