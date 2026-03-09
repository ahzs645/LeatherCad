export type Tool =
  | 'pan'
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'arc'
  | 'bezier'
  | 'fold'
  | 'stitch-hole'
  | 'hardware'
  | 'piece-notch'
  | 'text'
  | 'freehand'
  | 'cut-line'

export type Point = {
  x: number
  y: number
}

export type LineTypeRole = 'cut' | 'stitch' | 'fold' | 'guide' | 'mark'

export type LineTypeStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot-dot'

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
  arrowStart?: boolean
  arrowEnd?: boolean
}

export type LineShape = {
  id: BaseShape['id']
  type: 'line'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
  groupId?: BaseShape['groupId']
  arrowStart?: BaseShape['arrowStart']
  arrowEnd?: BaseShape['arrowEnd']
  start: Point
  end: Point
}

export type ArcShape = {
  id: BaseShape['id']
  type: 'arc'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
  groupId?: BaseShape['groupId']
  arrowStart?: BaseShape['arrowStart']
  arrowEnd?: BaseShape['arrowEnd']
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
  arrowStart?: BaseShape['arrowStart']
  arrowEnd?: BaseShape['arrowEnd']
  start: Point
  control: Point
  end: Point
}

export type TextTransformMode = 'none' | 'arch' | 'ring'

export type TextShape = {
  id: BaseShape['id']
  type: 'text'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
  groupId?: BaseShape['groupId']
  start: Point
  end: Point
  text: string
  fontFamily: string
  fontSizeMm: number
  transform: TextTransformMode
  radiusMm: number
  sweepDeg: number
}

export type Shape = LineShape | ArcShape | BezierShape | TextShape

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
  diameterMm?: number
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

export type PatternPieceOrientation = 'any' | 'horizontal' | 'vertical'

export type PatternPiece = {
  id: string
  name: string
  boundaryShapeId: string
  internalShapeIds: string[]
  layerId: string
  quantity: number
  code?: string
  annotation?: string
  material?: string
  materialSide?: 'grain' | 'flesh' | 'either'
  notes?: string
  onFold: boolean
  mirrorPair?: boolean
  orientation: PatternPieceOrientation
  allowFlip: boolean
  includeInLayout: boolean
  locked: boolean
  color?: string
  fill?: string
}

export type PieceGrainline = {
  pieceId: string
  visible: boolean
  mode: 'auto' | 'fixed'
  lengthMm?: number
  rotationDeg: number
  anchor: 'center'
}

export type PieceLabelKind = 'piece' | 'pattern'

export type PieceLabel = {
  id: string
  pieceId: string
  visible: boolean
  kind: PieceLabelKind
  textTemplate: string
  rotationDeg: number
  anchor: 'center'
  offsetX: number
  offsetY: number
  fontSizeMm: number
}

export type PiecePlacementLabelKind = 'cross' | 'box' | 'circle' | 'text'

export type PiecePlacementLabelAnchor = 'center' | 'edge'

export type PiecePlacementLabel = {
  id: string
  pieceId: string
  name: string
  visible: boolean
  kind: PiecePlacementLabelKind
  anchor: PiecePlacementLabelAnchor
  edgeIndex: number
  t: number
  offsetX: number
  offsetY: number
  widthMm: number
  heightMm: number
  rotationDeg: number
  text?: string
  showOnSeam: boolean
}

export type PieceSeamAllowanceEdgeOverride = {
  edgeIndex: number
  offsetMm: number
}

export type PieceSeamAllowance = {
  id: string
  pieceId: string
  enabled: boolean
  defaultOffsetMm: number
  edgeOverrides: PieceSeamAllowanceEdgeOverride[]
}

export type PieceNotchStyle = 'single' | 'double' | 'v'

export type PieceNotch = {
  id: string
  pieceId: string
  edgeIndex: number
  t: number
  style: PieceNotchStyle
  lengthMm: number
  widthMm: number
  angleMode: 'normal' | 'fixed'
  angleDeg?: number
  showOnSeam: boolean
}

export type LegacySeamAllowance = {
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
  pdfSourceUrl?: string
  pdfPageNumber?: number
  pdfPageCount?: number
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

export type TextureSource = {
  sourceUrl: string
  license: string
  albedoUrl: string
  normalUrl?: string
  roughnessUrl?: string
}

export type DimensionLine = {
  id: string
  start: Point
  end: Point
  offsetMm: number
  text?: string
  layerId: string
  lineTypeId: string
}

export type PrintArea = {
  id: string
  offsetX: number
  offsetY: number
  widthMm: number
  heightMm: number
  scalePercent: number
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
  patternPieces?: PatternPiece[]
  pieceGrainlines?: PieceGrainline[]
  pieceLabels?: PieceLabel[]
  piecePlacementLabels?: PiecePlacementLabel[]
  seamAllowances?: Array<PieceSeamAllowance | LegacySeamAllowance>
  pieceNotches?: PieceNotch[]
  hardwareMarkers?: HardwareMarker[]
  snapSettings?: SnapSettings
  showAnnotations?: boolean
  tracingOverlays?: TracingOverlay[]
  projectMemo?: string
  stitchAlwaysShapeIds?: string[]
  stitchThreadColor?: string
  threeTextureSource?: TextureSource | null
  threeTextureShapeIds?: string[]
  showCanvasRuler?: boolean
  showDimensions?: boolean
  dimensionLines?: DimensionLine[]
  printAreas?: PrintArea[]
}

export type Viewport = {
  x: number
  y: number
  scale: number
}
