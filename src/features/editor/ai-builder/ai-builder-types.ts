import type {
  DocFile,
  FoldDirection,
  LineTypeRole,
  Point,
  TextTransformMode,
} from '../cad/cad-types'

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

export type AiBuilderEntity =
  | AiBuilderLineEntity
  | AiBuilderArcEntity
  | AiBuilderBezierEntity
  | AiBuilderRectangleEntity
  | AiBuilderTextEntity
  | AiBuilderFoldEntity

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
}

export type AiBuilderCompileResult = {
  doc: DocFile
  summary: AiBuilderCompileSummary
}
