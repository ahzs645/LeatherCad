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
  | 'seam-multi'
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
  /** True when this line was auto-generated as a visual marker for an imported S_HOLE; skipped during .lcc export. */
  stitchHoleMarker?: boolean
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
  /** Extra space inserted between glyphs (mm). Source-app v2.1.7 "Tracking". */
  trackingMm?: number
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
  /** Source-app `chkReduceOneBlade` — when true, drop one blade per stamp. */
  reduceOneBlade?: boolean
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
  sourceStitchIn?: Point
  sourceStitchOut?: Point
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
  /**
   * Index into the piece's sampled boundary polygon. Positional, and therefore
   * only valid against the geometry it was authored from — inserting a vertex or
   * reversing a path shifts every index after the edit. Treat it as a cache of
   * `boundaryShapeId`, which is the durable half of this reference.
   */
  edgeIndex: number
  /**
   * The authored shape on the piece boundary that owns this edge. Stable across
   * edits, and the only way to name a curved side: curves sample to 48 segments,
   * so an arc side is ~48 consecutive `edgeIndex` values rather than one.
   */
  boundaryShapeId?: string
}

export type PieceEdgeSpan = PieceEdgeRef & {
  /** Start position along the referenced edge, 0..1. */
  t0: number
  /** End position along the referenced edge, 0..1. */
  t1: number
  /**
   * Which end of the side this span was picked from — authoring bookkeeping,
   * not a direction the geometry obeys. Whoever builds a seam out of spans folds
   * it into `SeamConnection.reversed`, and that flag is the only thing resolved
   * seam geometry reads. Setting both used to compose into a no-op.
   */
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

/**
 * One seam: a set of boundary spans on one side stitched to a set on the other.
 *
 * `from`/`to` (and the single `fromSpan`/`toSpan`) are the original one-edge-to-
 * one-edge form and remain the first entry of each side, so documents and code
 * written against them keep working. `fromSpans`/`toSpans` carry the full list
 * when a seam runs across several boundary shapes — a gusset meeting three sides
 * of a panel is one seam, not three. Read both through `resolveSeamSpans`
 * rather than reaching for either field directly.
 */
export type SeamConnection = {
  id: string
  /** Display name. Falls back to a generated description of the joined edges. */
  name?: string
  from: PieceEdgeRef
  to: PieceEdgeRef
  fromSpan?: PieceEdgeSpan
  toSpan?: PieceEdgeSpan
  /** Full span list for this side; when absent, `fromSpan`/`from` is the only span. */
  fromSpans?: PieceEdgeSpan[]
  toSpans?: PieceEdgeSpan[]
  sourceConnectionId?: string
  edgeLengthDeltaMm?: number
  toleranceMm?: number
  stitchSpacingMm?: number
  reversed?: boolean
  /** Position in the sewing order. Lower sews first; ties fall back to array order. */
  sequence?: number
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
  /**
   * Draw every piece's boundary in that piece's own colour, so two pieces of
   * leather stacked flesh-to-grain can be told apart in a render where they are
   * the same tan and a millimetre and a half apart.
   */
  showPieceOutlines: boolean
  showStressOverlay: boolean
  /**
   * Stitches sewn so far, along the axis `buildSeamSewPlan` lays the seams on.
   * Undefined means the whole project is sewn, which is the resting state.
   */
  sewnStitchCount?: number
  usePhysicsRelaxation: boolean
  avatarId?: string
}

/**
 * How a piece's cut edges are finished.
 *
 * Burnishing compresses and darkens the edge; edge paint lays a different
 * colour over it. Both change what the exposed side faces of the leather look
 * like and nothing else, so this is rendering intent attached to the piece
 * rather than geometry.
 */
export type PieceEdgeFinishStyle = 'burnish' | 'paint'

export type PieceEdgeFinish = {
  enabled: boolean
  style: PieceEdgeFinishStyle
  /** Paint colour. Ignored when burnishing, which darkens the piece's own colour. */
  color?: string
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
  edgeFinish?: PieceEdgeFinish
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
  quarterPoints: boolean
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
  arrowOnly?: boolean
  singleLine?: boolean
  textInside?: boolean
  textReverse?: boolean
  precision?: number
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
