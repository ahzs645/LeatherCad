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
  | 'seam'
  | 'piece-notch'
  | 'text'
  | 'freehand'
  | 'cut-line'
  | 'dimension'

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
  strokeWidthMm?: number
  ignoreInPrint?: boolean
}

export type BoxStitchSource = {
  extracted: true
}

type BaseShape = {
  id: string
  layerId: string
  lineTypeId: string
  groupId?: string
  arrowStart?: boolean
  arrowEnd?: boolean
  boxStitchSource?: BoxStitchSource
  /** Fill color (hex) — renders closed paths as painted regions. Source-app "Painted Part". */
  fillColor?: string
  /** Override stroke width (SVG units). When unset, use the line type default. */
  strokeWidthOverride?: number
}

export type LineShape = {
  id: BaseShape['id']
  type: 'line'
  layerId: BaseShape['layerId']
  lineTypeId: BaseShape['lineTypeId']
  groupId?: BaseShape['groupId']
  arrowStart?: BaseShape['arrowStart']
  arrowEnd?: BaseShape['arrowEnd']
  boxStitchSource?: BaseShape['boxStitchSource']
  strokeWidthOverride?: BaseShape['strokeWidthOverride']
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
  boxStitchSource?: BaseShape['boxStitchSource']
  strokeWidthOverride?: BaseShape['strokeWidthOverride']
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
  boxStitchSource?: BaseShape['boxStitchSource']
  strokeWidthOverride?: BaseShape['strokeWidthOverride']
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
  ignored?: boolean
  independent?: boolean
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
  pieceId?: string
  interfaceId?: string
  angleDeg: number
  maxAngleDeg: number
  direction?: FoldDirection
  radiusMm?: number
  foldAllowanceMm?: number
  bendRadiusMm?: number
  lockedHinge?: boolean
  thicknessMm?: number
  neutralAxisRatio?: number
  stiffness?: number
  clearanceMm?: number
}

export type StitchHoleType = 'round' | 'slit'

export type StitchHoleRenderShape = 'round' | 'slit' | 'diamond' | 'french' | 'flat'

export type StitchHoleDefaults = {
  holeType: StitchHoleType
  renderShape?: StitchHoleRenderShape
  pitchMm?: number
  numBlades?: number
  diameterMm?: number
  widthMm?: number
  heightMm?: number
  tiltDeg?: number
  inverted?: boolean
  presetId?: string
  presetName?: string
}

export type StitchHole = {
  id: string
  shapeId: string
  chainId?: string
  interfaceId?: string
  connectionId?: string
  pairedHoleId?: string
  point: Point
  angleDeg: number
  holeType: StitchHoleType
  sequence: number
  diameterMm?: number
  widthMm?: number
  heightMm?: number
  tiltDeg?: number
  inverted?: boolean
  presetId?: string
  presetName?: string
  renderShape?: StitchHoleRenderShape
  endHole?: boolean
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

export type PieceEdgeRef = {
  pieceId: string
  edgeIndex: number
}

export type PieceEdgeSpan = PieceEdgeRef & {
  t0: number
  t1: number
  reversed?: boolean
}

export type PieceInterfaceRole = 'seam' | 'fold' | 'hardware' | 'slot' | 'glue' | 'edge-finish'

export type PieceInterface = {
  id: string
  pieceId: string
  name: string
  role: PieceInterfaceRole
  spans: PieceEdgeSpan[]
  side?: 'grain' | 'flesh' | 'either'
  allowanceMm?: number
  easeRatio?: number
}

export type PiecePlacement3D = {
  pieceId: string
  translationMm: {
    x: number
    y: number
    z: number
  }
  rotationDeg: {
    x: number
    y: number
    z: number
  }
  flipped: boolean
}

export type SeamConnectionKind = 'sewn' | 'aligned' | 'hinge'

export type SeamConnection = {
  id: string
  from: PieceEdgeRef
  to: PieceEdgeRef
  fromSpan?: PieceEdgeSpan
  toSpan?: PieceEdgeSpan
  sourceConnectionId?: string
  edgeLengthDeltaMm?: number
  toleranceMm?: number
  stitchSpacingMm?: number
  reversed?: boolean
  kind: SeamConnectionKind
}

export type AssemblyConnectionKind =
  | 'sewn'
  | 'fold-hinge'
  | 'glued'
  | 'riveted'
  | 'snap'
  | 'buckle'
  | 'aligned'

export type AssemblyConnection = {
  id: string
  fromInterfaceId: string
  toInterfaceId: string
  kind: AssemblyConnectionKind
  stitchSpacingMm?: number
  hardwareMarkerIds?: string[]
  layerOffsetMm?: number
  toleranceMm?: number
}

export type ThreePreviewMode = 'fold' | 'assembled' | 'avatar' | 'final'

export type AvatarSpec = {
  id: string
  name: string
  sourceUrl: string
  scaleMm: number
}

export type FoldStepCommand = {
  foldLineId: string
  targetAngleDeg?: number
  duration?: number
  previewOnly?: boolean
  flex?: boolean
  locked?: boolean
}

export type FoldInstructionNode = {
  id: string
  label?: string
  commands?: FoldStepCommand[]
  children?: FoldInstructionNode[]
  default?: boolean
}

export type ThreePreviewSettings = {
  mode: ThreePreviewMode
  explodedFactor: number
  finalFoldProgress: number
  finalFoldCamera: 'orbit' | 'pattern' | 'top' | 'front' | 'side'
  foldTimeline?: FoldInstructionNode[]
  thicknessMm: number
  showSeams: boolean
  showEdgeLabels: boolean
  showStressOverlay: boolean
  usePhysicsRelaxation: boolean
  avatarId?: string
}

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
  anchorInterfaceId?: string
  mateMarkerId?: string
  throughLayerIds?: string[]
  installationSide?: 'grain' | 'flesh' | 'either'
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

/**
 * Backdrop — a persistent image embedded in the document, independent of TracingOverlay.
 * Mirrors the Delphi TBackdrop entity: bitmap bytes embedded as a data URL, custom
 * rotation pivot, DPI for physical sizing, and per-instance undo history.
 */
export type Backdrop = {
  id: string
  name: string
  /** Base64 data URL of the embedded bitmap (image/png, image/jpeg, etc). */
  bitmapDataUrl: string
  /** Native pixel dimensions of the bitmap. */
  bitmapWidth: number
  bitmapHeight: number
  /** Placement top-left in document mm. */
  leftTop: Point
  /** Rendered size in document mm. */
  width: number
  height: number
  /** Rotation angle in degrees. */
  angleDeg: number
  /**
   * Rotation pivot in document mm. When undefined, rotates around the center.
   * Matches TBackdrop.RotationCenter.
   */
  rotationCenter?: Point
  /** Source DPI — optional, mirrors TBackdrop.DPI for physical-size calibration. */
  dpi?: number
  /** Original file path, if provided by the user. */
  fullPath?: string
  visible: boolean
  locked: boolean
  opacity: number
}

export type BackdropUndoEntry = {
  leftTop: Point
  width: number
  height: number
  angleDeg: number
  rotationCenter?: Point
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
  /** Source DPI — when set, used for physical-size calibration (mm per pixel = 25.4 / dpi). */
  dpi?: number
}

export type TextureSource = {
  sourceUrl: string
  license: string
  albedoUrl: string
  normalUrl?: string
  roughnessUrl?: string
}

export type LeatherImageCrop = {
  x: number
  y: number
  width: number
  height: number
}

export type LeatherImageFill = {
  id: string
  name: string
  imageDataUrl: string
  bitmapWidth: number
  bitmapHeight: number
  x: number
  y: number
  widthMm: number
  heightMm: number
  rotationDeg: number
  crop: LeatherImageCrop
  assignedShapeIds: string[]
  visible: boolean
  opacity: number
  dpi?: number
}

export type DimensionLine = {
  id: string
  start: Point
  end: Point
  offsetMm: number
  text?: string
  fontSizeMm?: number
  labelPoint?: Point
  labelRotationDeg?: number
  labelPlacement?: 'baseline' | 'center'
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
  documentName?: string
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
  pieceInterfaces?: PieceInterface[]
  assemblyConnections?: AssemblyConnection[]
  pieceGrainlines?: PieceGrainline[]
  pieceLabels?: PieceLabel[]
  piecePlacementLabels?: PiecePlacementLabel[]
  seamAllowances?: Array<PieceSeamAllowance | LegacySeamAllowance>
  pieceNotches?: PieceNotch[]
  hardwareMarkers?: HardwareMarker[]
  snapSettings?: SnapSettings
  showAnnotations?: boolean
  tracingOverlays?: TracingOverlay[]
  backdrops?: Backdrop[]
  projectMemo?: string
  stitchAlwaysShapeIds?: string[]
  stitchThreadColor?: string
  piecePlacements3d?: PiecePlacement3D[]
  seamConnections?: SeamConnection[]
  threePreviewSettings?: ThreePreviewSettings
  avatars?: AvatarSpec[]
  threeTextureSource?: TextureSource | null
  threeTextureShapeIds?: string[]
  leatherImageFills?: LeatherImageFill[]
  activeLeatherImageFillId?: string | null
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
