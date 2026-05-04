import type {
  HardwareKind,
  DocFile,
  FoldDirection,
  LineTypeRole,
  PatternPieceOrientation,
  PieceSeamAllowanceEdgeOverride,
  Point,
  SeamConnectionKind,
  StitchHoleRenderShape,
  StitchHoleType,
  TextTransformMode,
} from '../cad/cad-types'

export type AiBuilderMaterialSide = 'grain' | 'flesh' | 'either'

export type AiBuilderLayer = {
  id: string
  name: string
}

export type AiBuilderLineEntity = {
  id: string
  type: 'line'
  layer_id: string
  start: Point
  end: Point
  line_role?: LineTypeRole
}

export type AiBuilderArcEntity = {
  id: string
  type: 'arc'
  layer_id: string
  start: Point
  mid: Point
  end: Point
  line_role?: LineTypeRole
}

export type AiBuilderBezierEntity = {
  id: string
  type: 'bezier'
  layer_id: string
  start: Point
  control: Point
  end: Point
  line_role?: LineTypeRole
}

export type AiBuilderRectangleEntity = {
  id: string
  type: 'rectangle'
  layer_id: string
  x: number
  y: number
  width: number
  height: number
  line_role?: LineTypeRole
}

export type AiBuilderTextEntity = {
  id: string
  type: 'text'
  layer_id: string
  position: Point
  value: string
  font_family?: string
  font_size_mm?: number
  line_role?: LineTypeRole
  transform?: TextTransformMode
  radius_mm?: number
  sweep_deg?: number
}

export type AiBuilderFoldEntity = {
  id: string
  type: 'fold'
  start: Point
  end: Point
  name?: string
  direction?: FoldDirection
  angle_deg?: number
  max_angle_deg?: number
  radius_mm?: number
  thickness_mm?: number
  neutral_axis_ratio?: number
  stiffness?: number
  clearance_mm?: number
}

export type AiBuilderStitchPathEntity = {
  id: string
  type: 'stitch_path'
  layer_id: string
  path_type: 'line' | 'arc' | 'bezier'
  start: Point
  mid?: Point
  control?: Point
  end: Point
  pitch_mm: number
  hole_type?: StitchHoleType
  render_shape?: StitchHoleRenderShape
  diameter_mm?: number
  width_mm?: number
  height_mm?: number
  tilt_deg?: number
  inverted?: boolean
  include_start_hole?: boolean
  force_fit_last_hole?: boolean
}

export type AiBuilderPatternPieceEntity = {
  id: string
  type: 'pattern_piece'
  layer_id: string
  boundary_entity_id: string
  internal_entity_ids?: string[]
  name: string
  quantity?: number
  code?: string
  annotation?: string
  material?: string
  material_side?: AiBuilderMaterialSide
  notes?: string
  on_fold?: boolean
  mirror_pair?: boolean
  orientation?: PatternPieceOrientation
  allow_flip?: boolean
  include_in_layout?: boolean
  color?: string
  fill?: string
}

export type AiBuilderSeamAllowanceEntity = {
  id: string
  type: 'seam_allowance'
  piece_id: string
  default_offset_mm: number
  enabled?: boolean
  edge_overrides?: PieceSeamAllowanceEdgeOverride[]
}

export type AiBuilderEdgeRef = {
  piece_id: string
  edge_index: number
  t0?: number
  t1?: number
  reversed?: boolean
}

export type AiBuilderSeamConnectionEntity = {
  id: string
  type: 'seam_connection'
  from: AiBuilderEdgeRef
  to: AiBuilderEdgeRef
  kind?: SeamConnectionKind
  stitch_spacing_mm?: number
  tolerance_mm?: number
  reversed?: boolean
}

export type AiBuilderHardwareMarkerEntity = {
  id: string
  type: 'hardware_marker'
  layer_id: string
  point: Point
  kind?: HardwareKind
  label?: string
  hole_diameter_mm?: number
  spacing_mm?: number
  installation_side?: AiBuilderMaterialSide
  notes?: string
  visible?: boolean
}

export type AiBuilderEntity =
  | AiBuilderLineEntity
  | AiBuilderArcEntity
  | AiBuilderBezierEntity
  | AiBuilderRectangleEntity
  | AiBuilderTextEntity
  | AiBuilderFoldEntity
  | AiBuilderStitchPathEntity
  | AiBuilderPatternPieceEntity
  | AiBuilderSeamAllowanceEntity
  | AiBuilderSeamConnectionEntity
  | AiBuilderHardwareMarkerEntity

export type AiBuilderDocumentV1 = {
  schema_version: 1
  document_name: string
  units: 'mm'
  layers: AiBuilderLayer[]
  entities: AiBuilderEntity[]
}

export type AiBuilderValidationError = {
  path: string
  message: string
}

export type AiBuilderParseResult =
  | {
      ok: true
      document: AiBuilderDocumentV1
      errors: []
    }
  | {
      ok: false
      document?: undefined
      errors: AiBuilderValidationError[]
    }

export type AiBuilderCompileSummary = {
  layerCount: number
  entityCount: number
  shapeCount: number
  foldCount: number
  stitchHoleCount: number
  patternPieceCount: number
  seamAllowanceCount: number
  seamConnectionCount: number
  hardwareMarkerCount: number
  preflightErrorCount: number
  preflightWarningCount: number
}

export type AiBuilderLeatherRefKind =
  | 'entity'
  | 'shape'
  | 'fold'
  | 'stitch_hole'
  | 'pattern_piece'
  | 'seam_allowance'
  | 'seam_connection'
  | 'hardware_marker'

export type AiBuilderLeatherRef = {
  ref: string
  kind: AiBuilderLeatherRefKind
  id: string
  label: string
}

export type AiBuilderPreflightSeverity = 'error' | 'warning' | 'info'

export type AiBuilderPreflightIssue = {
  severity: AiBuilderPreflightSeverity
  code: string
  message: string
  ref?: string
}

export type AiBuilderCompileResult = {
  doc: DocFile
  summary: AiBuilderCompileSummary
  refs: AiBuilderLeatherRef[]
  preflight: AiBuilderPreflightIssue[]
}
