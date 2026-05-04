import type {
  FoldDirection,
  HardwareKind,
  LineTypeRole,
  PatternPieceOrientation,
  SeamConnectionKind,
  StitchHoleRenderShape,
  StitchHoleType,
  TextTransformMode,
} from '../cad/cad-types'
import type { AiBuilderEntity, AiBuilderMaterialSide } from './ai-builder-types'

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

export const AI_BUILDER_ALLOWED_STITCH_PATH_TYPES = ['line', 'arc', 'bezier'] as const

export const AI_BUILDER_ALLOWED_STITCH_HOLE_TYPES: readonly StitchHoleType[] = [
  'round',
  'slit',
]

export const AI_BUILDER_ALLOWED_STITCH_RENDER_SHAPES: readonly StitchHoleRenderShape[] = [
  'round',
  'slit',
  'diamond',
  'french',
  'flat',
]

export const AI_BUILDER_ALLOWED_MATERIAL_SIDES: readonly AiBuilderMaterialSide[] = [
  'grain',
  'flesh',
  'either',
]

export const AI_BUILDER_ALLOWED_PATTERN_ORIENTATIONS: readonly PatternPieceOrientation[] = [
  'any',
  'horizontal',
  'vertical',
]

export const AI_BUILDER_ALLOWED_SEAM_CONNECTION_KINDS: readonly SeamConnectionKind[] = [
  'sewn',
  'aligned',
  'hinge',
]

export const AI_BUILDER_ALLOWED_HARDWARE_KINDS: readonly HardwareKind[] = [
  'snap',
  'rivet',
  'buckle',
  'custom',
]

export const AI_BUILDER_UNSUPPORTED_FEATURES = [
  'constraints',
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
  'stitch_path',
  'pattern_piece',
  'seam_allowance',
  'seam_connection',
  'hardware_marker',
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
  stitch_path: {
    type: 'stitch_path',
    description: 'Stitching path that compiles to a native stitch line plus generated stitch holes along that path.',
    requiredKeys: ['id', 'type', 'layer_id', 'path_type', 'start', 'end', 'pitch_mm'],
    optionalKeys: [
      'mid',
      'control',
      'hole_type',
      'render_shape',
      'diameter_mm',
      'width_mm',
      'height_mm',
      'tilt_deg',
      'inverted',
      'include_start_hole',
      'force_fit_last_hole',
    ],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "stitch_path".' },
      { key: 'layer_id', required: true, type: 'snake_case string', description: 'Existing layer ID.' },
      {
        key: 'path_type',
        required: true,
        type: 'enum',
        description: `Allowed: ${AI_BUILDER_ALLOWED_STITCH_PATH_TYPES.join(', ')}. Arc paths require "mid"; bezier paths require "control".`,
      },
      { key: 'start', required: true, type: 'Point', description: 'Path start point with x and y in millimeters.' },
      { key: 'mid', required: false, type: 'Point', description: 'Required only when path_type is "arc".' },
      { key: 'control', required: false, type: 'Point', description: 'Required only when path_type is "bezier".' },
      { key: 'end', required: true, type: 'Point', description: 'Path end point with x and y in millimeters.' },
      { key: 'pitch_mm', required: true, type: 'positive number', description: 'Target spacing between stitch holes in millimeters.' },
      {
        key: 'hole_type',
        required: false,
        type: 'enum',
        description: `Optional native hole type. Allowed: ${AI_BUILDER_ALLOWED_STITCH_HOLE_TYPES.join(', ')}. Defaults to round.`,
      },
      {
        key: 'render_shape',
        required: false,
        type: 'enum',
        description: `Optional visual/cutter shape. Allowed: ${AI_BUILDER_ALLOWED_STITCH_RENDER_SHAPES.join(', ')}.`,
      },
      { key: 'diameter_mm', required: false, type: 'positive number', description: 'Round hole diameter in millimeters.' },
      { key: 'width_mm', required: false, type: 'positive number', description: 'Slit or punch width in millimeters.' },
      { key: 'height_mm', required: false, type: 'positive number', description: 'Slit or punch height in millimeters.' },
      { key: 'tilt_deg', required: false, type: 'number', description: 'Hole tilt angle in degrees.' },
      { key: 'inverted', required: false, type: 'boolean', description: 'Whether to invert angled stitch marks.' },
      { key: 'include_start_hole', required: false, type: 'boolean', description: 'Defaults to true.' },
      { key: 'force_fit_last_hole', required: false, type: 'boolean', description: 'Defaults to true so the path has a terminal hole.' },
    ],
  },
  pattern_piece: {
    type: 'pattern_piece',
    description: 'Leather pattern piece metadata bound to an already generated closed boundary entity.',
    requiredKeys: ['id', 'type', 'layer_id', 'boundary_entity_id', 'name'],
    optionalKeys: [
      'internal_entity_ids',
      'quantity',
      'code',
      'annotation',
      'material',
      'material_side',
      'notes',
      'on_fold',
      'mirror_pair',
      'orientation',
      'allow_flip',
      'include_in_layout',
      'color',
      'fill',
    ],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "pattern_piece".' },
      { key: 'layer_id', required: true, type: 'snake_case string', description: 'Existing layer ID.' },
      { key: 'boundary_entity_id', required: true, type: 'snake_case string', description: 'Entity ID for a closed cut boundary, usually a rectangle or closed chain starter.' },
      { key: 'internal_entity_ids', required: false, type: 'string[]', description: 'Optional entity IDs for internal stitch, guide, mark, or cut features inside the piece.' },
      { key: 'name', required: true, type: 'string', description: 'Human-readable piece name.' },
      { key: 'quantity', required: false, type: 'positive integer', description: 'Defaults to 1.' },
      { key: 'code', required: false, type: 'string', description: 'Optional piece code.' },
      { key: 'annotation', required: false, type: 'string', description: 'Optional production annotation.' },
      { key: 'material', required: false, type: 'string', description: 'Optional material name.' },
      {
        key: 'material_side',
        required: false,
        type: 'enum',
        description: `Allowed: ${AI_BUILDER_ALLOWED_MATERIAL_SIDES.join(', ')}. Defaults to either.`,
      },
      { key: 'notes', required: false, type: 'string', description: 'Optional maker notes.' },
      { key: 'on_fold', required: false, type: 'boolean', description: 'Whether the piece is cut on fold.' },
      { key: 'mirror_pair', required: false, type: 'boolean', description: 'Whether the piece should be mirrored as a pair.' },
      {
        key: 'orientation',
        required: false,
        type: 'enum',
        description: `Allowed: ${AI_BUILDER_ALLOWED_PATTERN_ORIENTATIONS.join(', ')}. Defaults to any.`,
      },
      { key: 'allow_flip', required: false, type: 'boolean', description: 'Defaults to true.' },
      { key: 'include_in_layout', required: false, type: 'boolean', description: 'Defaults to true.' },
      { key: 'color', required: false, type: 'string', description: 'Optional display color.' },
      { key: 'fill', required: false, type: 'string', description: 'Optional fill color.' },
    ],
  },
  seam_allowance: {
    type: 'seam_allowance',
    description: 'Seam allowance attached to a generated pattern piece.',
    requiredKeys: ['id', 'type', 'piece_id', 'default_offset_mm'],
    optionalKeys: ['enabled', 'edge_overrides'],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "seam_allowance".' },
      { key: 'piece_id', required: true, type: 'snake_case string', description: 'ID of a pattern_piece entity.' },
      { key: 'default_offset_mm', required: true, type: 'positive number', description: 'Default seam allowance offset in millimeters.' },
      { key: 'enabled', required: false, type: 'boolean', description: 'Defaults to true.' },
      { key: 'edge_overrides', required: false, type: 'array', description: 'Optional { edgeIndex, offsetMm } overrides using native LeatherCad field names.' },
    ],
  },
  seam_connection: {
    type: 'seam_connection',
    description: 'Connection between two pattern piece edges for sewn, aligned, or hinge assembly intent.',
    requiredKeys: ['id', 'type', 'from', 'to'],
    optionalKeys: ['kind', 'stitch_spacing_mm', 'tolerance_mm', 'reversed'],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "seam_connection".' },
      { key: 'from', required: true, type: 'EdgeRef', description: 'Object with piece_id, edge_index, optional t0/t1/reversed.' },
      { key: 'to', required: true, type: 'EdgeRef', description: 'Object with piece_id, edge_index, optional t0/t1/reversed.' },
      {
        key: 'kind',
        required: false,
        type: 'enum',
        description: `Allowed: ${AI_BUILDER_ALLOWED_SEAM_CONNECTION_KINDS.join(', ')}. Defaults to sewn.`,
      },
      { key: 'stitch_spacing_mm', required: false, type: 'positive number', description: 'Optional intended stitch spacing.' },
      { key: 'tolerance_mm', required: false, type: 'positive number', description: 'Optional edge length mismatch tolerance.' },
      { key: 'reversed', required: false, type: 'boolean', description: 'Whether the edge orientation is reversed.' },
    ],
  },
  hardware_marker: {
    type: 'hardware_marker',
    description: 'Hardware placement marker such as a snap, rivet, buckle, or custom fitting.',
    requiredKeys: ['id', 'type', 'layer_id', 'point'],
    optionalKeys: ['kind', 'label', 'hole_diameter_mm', 'spacing_mm', 'installation_side', 'notes', 'visible'],
    fields: [
      { key: 'id', required: true, type: 'snake_case string', description: 'Unique entity identifier.' },
      { key: 'type', required: true, type: 'literal string', description: 'Must be "hardware_marker".' },
      { key: 'layer_id', required: true, type: 'snake_case string', description: 'Existing layer ID.' },
      { key: 'point', required: true, type: 'Point', description: 'Hardware center point with x and y in millimeters.' },
      {
        key: 'kind',
        required: false,
        type: 'enum',
        description: `Allowed: ${AI_BUILDER_ALLOWED_HARDWARE_KINDS.join(', ')}. Defaults to custom.`,
      },
      { key: 'label', required: false, type: 'string', description: 'Optional marker label.' },
      { key: 'hole_diameter_mm', required: false, type: 'positive number', description: 'Defaults to 4.' },
      { key: 'spacing_mm', required: false, type: 'positive number', description: 'Defaults to 0.' },
      {
        key: 'installation_side',
        required: false,
        type: 'enum',
        description: `Allowed: ${AI_BUILDER_ALLOWED_MATERIAL_SIDES.join(', ')}. Defaults to either.`,
      },
      { key: 'notes', required: false, type: 'string', description: 'Optional hardware notes.' },
      { key: 'visible', required: false, type: 'boolean', description: 'Defaults to true.' },
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
  stitch_path: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.stitch_path.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.stitch_path.optionalKeys,
  ]),
  pattern_piece: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.pattern_piece.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.pattern_piece.optionalKeys,
  ]),
  seam_allowance: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.seam_allowance.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.seam_allowance.optionalKeys,
  ]),
  seam_connection: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.seam_connection.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.seam_connection.optionalKeys,
  ]),
  hardware_marker: new Set([
    ...AI_BUILDER_ENTITY_SCHEMAS.hardware_marker.requiredKeys,
    ...AI_BUILDER_ENTITY_SCHEMAS.hardware_marker.optionalKeys,
  ]),
}
