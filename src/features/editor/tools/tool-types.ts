import type {
  DimensionLine,
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  PatternPiece,
  PieceNotch,
  Point,
  SeamConnection,
  Shape,
  SketchGroup,
  StitchHole,
  StitchHoleDefaults,
  TextTransformMode,
  Tool,
} from '../cad/cad-types'
import type { DimensionDefaults } from '../state/editor-domain-types'
import type { EditorToolSession } from './tool-session'

type HardwareKind = HardwareMarker['kind']

export type CommandParseResult =
  | { ok: true; point: Point }
  | { ok: false; message: string }

export type ToolRuntime = {
  draftPoints: Point[]
  cursorPoint: Point | null
  activeLayerId: string
  activeLineTypeId: string
  activeSketchGroup: SketchGroup | null
  viewportScale: number
  lineToolConstraint: 'none' | 'horizontal' | 'vertical' | 'relative-angle'
  relativeAngleStepDeg: number
  lastLineAngleRad: number | null
  tangentCircleMode: boolean
  arcDrawMode?: 'three-point' | 'radius' | 'half-moon'
  arcRadiusMm?: number
  arcHalfMoonRatio?: number
  stitchHoleDefaults: StitchHoleDefaults
  hardwarePreset: HardwareKind
  customHardwareDiameterMm: number
  customHardwareSpacingMm: number
  textDraftValue: string
  textFontFamily: string
  textFontSizeMm: number
  textTransformMode: TextTransformMode
  textRadiusMm: number
  textSweepDeg: number
  stitchTargetShapes: Shape[]
  patternPieces: PatternPiece[]
  lineTypesById: Record<string, LineType>
  shapesById: Record<string, Shape>
  layers: Layer[]
  selectedShapeIds: string[]
  cadCommandMode: 'trim' | 'extend' | null
  stitchHoles: StitchHole[]
  pieceNotches: PieceNotch[]
  seamConnections: SeamConnection[]
  dimensionDefaults: DimensionDefaults
  dimensionLineTypeId?: string | null
  setDraftPoints: (updater: Point[] | ((previous: Point[]) => Point[])) => void
  clearDraft: () => void
  setActiveTool: (tool: Tool) => void
  setCadCommandMode: (mode: 'trim' | 'extend' | null) => void
  setStatus: (status: string) => void
  setShapes: (updater: Shape[] | ((previous: Shape[]) => Shape[])) => void
  setSelectedShapeIds: (updater: string[] | ((previous: string[]) => string[])) => void
  setFoldLines: (updater: FoldLine[] | ((previous: FoldLine[]) => FoldLine[])) => void
  setStitchHoles: (updater: StitchHole[] | ((previous: StitchHole[]) => StitchHole[])) => void
  setSelectedStitchHoleId: (value: string | null) => void
  setPieceNotches: (updater: PieceNotch[] | ((previous: PieceNotch[]) => PieceNotch[])) => void
  setSeamConnections: (updater: SeamConnection[] | ((previous: SeamConnection[]) => SeamConnection[])) => void
  setHardwareMarkers: (updater: HardwareMarker[] | ((previous: HardwareMarker[]) => HardwareMarker[])) => void
  setSelectedHardwareMarkerId: (value: string | null) => void
  setDimensionLines: (updater: DimensionLine[] | ((previous: DimensionLine[]) => DimensionLine[])) => void
  ensureActiveLayerWritable: () => boolean
  ensureActiveLineTypeWritable: () => boolean
  setLastLineAngleRad?: (value: number | null) => void
  toolSession: EditorToolSession
}

export type ToolCommandContext = {
  tool: Tool
  runtime: ToolRuntime
  referencePoint: Point
}

export interface ToolDefinition {
  onPointerDown: (point: Point, runtime: ToolRuntime) => void
  onCommand?: (command: string, context: ToolCommandContext) => string
  getHint?: (draftPoints: Point[]) => string | null
  resetSession?: (session: EditorToolSession, nextTool: Tool) => void
  isAvailable?: (runtime: ToolRuntime) => boolean
}
