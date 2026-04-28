// TypeScript port of the Garment-Pattern-Generator (maria-korosteleva) pattern
// template schema. This is a DOCUMENT format only - no IO/parser is implemented
// here yet. The shape mirrors docs/template_spec_with_comments.json from that
// repo so a downstream import/export pass can read/write the format unchanged.
//
// Companion mapping notes for how each field lands on the existing LeatherCad
// modules (pattern-pieces, stitching, solver) live in
// src/features/editor/io/PATTERN_TEMPLATE_MAPPING.md.

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export type CurvatureCoordsConvention = 'relative' | 'absolute'

export type PatternTemplateProperties = {
  curvature_coords: CurvatureCoordsConvention
  normalize_panel_translation: boolean
  units_in_meter: number
  normalized_edge_loops?: boolean
}

// ---------------------------------------------------------------------------
// Pattern (panels + stitches)
// ---------------------------------------------------------------------------

export type PanelVertex = [number, number]

export type EdgeCurvature = [number, number]

export type PanelEdge = {
  endpoints: [number, number]
  curvature?: EdgeCurvature
}

export type Vec3 = [number, number, number]

export type Panel = {
  vertices: PanelVertex[]
  edges: PanelEdge[]
  translation: Vec3
  rotation: Vec3
}

export type EdgeLocator = {
  panel: string
  edge: number
}

export type Stitch = [EdgeLocator, EdgeLocator]

export type PatternBody = {
  panels: Record<string, Panel>
  stitches: Stitch[]
  panel_order?: string[]
}

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export type ParameterType = 'length' | 'additive_length' | 'curve'

export type EdgeApplicationDirection = 'start' | 'end' | 'both'

// Edge id can either be a single edge index or a meta-edge (a sequence of
// consecutive edge indices treated as one).
export type EdgeId = number | number[]

export type LengthEdgeInfluence = {
  id: EdgeId
  along?: [number, number]
  direction: EdgeApplicationDirection
}

// 'curve' parameters use a simplified edge_list of bare edge indices.
export type CurveEdgeInfluence = number

export type ParameterPanelInfluence<TEdge> = {
  panel: string
  edge_list: TEdge[]
}

export type LengthParameter = {
  type: 'length'
  value: number
  range: [number, number]
  influence: ParameterPanelInfluence<LengthEdgeInfluence>[]
}

export type AdditiveLengthParameter = {
  type: 'additive_length'
  value: number
  range: [number, number]
  influence: ParameterPanelInfluence<LengthEdgeInfluence>[]
}

// Curve parameters may carry a single scalar (applied to Y of the control
// vertex) or a [x, y] tuple. Range mirrors the value shape.
export type CurveParameter = {
  type: 'curve'
  value: number | [number, number]
  range: [number, number] | [[number, number], [number, number]]
  influence: ParameterPanelInfluence<CurveEdgeInfluence>[]
}

export type PatternParameter = LengthParameter | AdditiveLengthParameter | CurveParameter

// ---------------------------------------------------------------------------
// Constraints (only length_equality is defined in the upstream spec)
// ---------------------------------------------------------------------------

export type LengthEqualityEdgeInfluence = {
  id: EdgeId
  direction: EdgeApplicationDirection
  along?: [number, number]
  // Per-edge scaling factor that was applied to keep the constraint. Authors
  // typically write 1; the solver writes back the value it converged to.
  value: number
}

export type LengthEqualityConstraint = {
  type: 'length_equality'
  influence: ParameterPanelInfluence<LengthEqualityEdgeInfluence>[]
}

export type PatternConstraint = LengthEqualityConstraint

// ---------------------------------------------------------------------------
// Top-level document
// ---------------------------------------------------------------------------

export type PatternTemplateDocument = {
  properties: PatternTemplateProperties
  pattern: PatternBody
  parameters?: Record<string, PatternParameter>
  // Ordered application of parameters. Required if `parameters` is present.
  parameter_order?: string[]
  constraints?: Record<string, PatternConstraint>
  // Ordered application of constraints. Required if `constraints` is present.
  constraint_order?: string[]
}
