export type Tool = 'pan' | 'line' | 'arc' | 'bezier' | 'fold' | 'stitch-hole' | 'hardware'

export type Point = {
  x: number
  y: number
}

export type LineTypeRole = 'cut' | 'stitch' | 'fold' | 'guide' | 'mark'

export type LineTypeStyle = 'solid' | 'dashed' | 'dotted'

export type LineType = {
  id: string
  name: string
  role: LineTypeRole
  style: LineTypeStyle
  color: string
  visible: boolean
}

type BaseShape = {
  id: string
  layerId: string
  lineTypeId: string
  groupId?: string
}

export type LineShape = {
  id: BaseShape['id']
  type: 'line'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
  groupId?: BaseShape['groupId']
  start: Point
  end: Point
}

export type ArcShape = {
  id: BaseShape['id']
  type: 'arc'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
  groupId?: BaseShape['groupId']
  start: Point
  mid: Point
  end: Point
}

export type BezierShape = {
  id: BaseShape['id']
  type: 'bezier'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
  groupId?: BaseShape['groupId']
  start: Point
  control: Point
  end: Point
}

export type Shape = LineShape | ArcShape | BezierShape

export type Layer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  stackLevel?: number
  annotation?: string
}

export type SketchGroup = {
  id: string
  name: string
  layerId: string
  visible: boolean
  locked: boolean
  annotation?: string
  baseGroupId?: string
  linkMode?: 'copy' | 'mirror-x' | 'mirror-y'
  linkOffsetX?: number
  linkOffsetY?: number
}

export type FoldDirection = 'mountain' | 'valley'

export type FoldLine = {
  id: string
  name: string
  start: Point
  end: Point
  angleDeg: number
  maxAngleDeg: number
  direction?: FoldDirection
  radiusMm?: number
  thicknessMm?: number
  neutralAxisRatio?: number
  stiffness?: number
  clearanceMm?: number
}

export type StitchHoleType = 'round' | 'slit'

export type StitchHole = {
  id: string
  shapeId: string
  point: Point
  angleDeg: number
  holeType: StitchHoleType
  sequence: number
}

export type ConstraintAnchor = 'start' | 'end' | 'mid' | 'center'

export type ConstraintEdge = 'left' | 'right' | 'top' | 'bottom'

export type ConstraintAxis = 'x' | 'y' | 'both'

export type EdgeOffsetConstraint = {
  id: string
  name: string
  type: 'edge-offset'
  enabled: boolean
  shapeId: string
  referenceLayerId: string
  edge: ConstraintEdge
  anchor: ConstraintAnchor
  offsetMm: number
}

export type AlignConstraint = {
  id: string
  name: string
  type: 'align'
  enabled: boolean
  shapeId: string
  referenceShapeId: string
  axis: ConstraintAxis
  anchor: ConstraintAnchor
  referenceAnchor: ConstraintAnchor
}

export type ParametricConstraint = EdgeOffsetConstraint | AlignConstraint

export type SeamAllowance = {
  id: string
  shapeId: string
  offsetMm: number
}

export type HardwareKind = 'snap' | 'rivet' | 'buckle' | 'custom'

export type HardwareMarker = {
  id: string
  layerId: string
  groupId?: string
  point: Point
  kind: HardwareKind
  label: string
  holeDiameterMm: number
  spacingMm: number
  notes?: string
  visible: boolean
}

export type SnapSettings = {
  enabled: boolean
  grid: boolean
  gridStep: number
  endpoints: boolean
  midpoints: boolean
  guides: boolean
  hardware: boolean
}

export type TracingOverlayKind = 'image' | 'pdf'

export type TracingOverlay = {
  id: string
  name: string
  kind: TracingOverlayKind
  sourceUrl: string
  visible: boolean
  locked: boolean
  opacity: number
  scale: number
  rotationDeg: number
  offsetX: number
  offsetY: number
  width: number
  height: number
  isObjectUrl?: boolean
}

export type DocFile = {
  version: 1
  units: 'mm'
  layers: Layer[]
  activeLayerId: string
  sketchGroups?: SketchGroup[]
  activeSketchGroupId?: string | null
  lineTypes: LineType[]
  activeLineTypeId: string
  objects: Shape[]
  foldLines: FoldLine[]
  stitchHoles?: StitchHole[]
  constraints?: ParametricConstraint[]
  seamAllowances?: SeamAllowance[]
  hardwareMarkers?: HardwareMarker[]
  snapSettings?: SnapSettings
  showAnnotations?: boolean
  tracingOverlays?: TracingOverlay[]
}

export type Viewport = {
  x: number
  y: number
  scale: number
}

export type TextureSource = {
  sourceUrl: string
  license: string
  albedoUrl: string
  normalUrl?: string
  roughnessUrl?: string
}
