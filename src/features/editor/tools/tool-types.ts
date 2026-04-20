import type {
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
import type { EditorToolSession } from './tool-session'

type HardwareKind = HardwareMarker['kind']

export type CommandParseResult =
  | { ok: true; point: Point }
  | { ok: false; message: string }

export type ToolRuntime = {
  draftPoints: Point[]
  activeLayerId: string
  activeLineTypeId: string
  activeSketchGroup: SketchGroup | null
  viewportScale: number
  lineToolConstraint: 'none' | 'horizontal' | 'vertical'
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
  stitchHoles: StitchHole[]
  pieceNotches: PieceNotch[]
  seamConnections: SeamConnection[]
  setDraftPoints: (updater: Point[] | ((previous: Point[]) => Point[])) => void
  clearDraft: () => void
  setStatus: (status: string) => void
  setShapes: (updater: Shape[] | ((previous: Shape[]) => Shape[])) => void
  setFoldLines: (updater: FoldLine[] | ((previous: FoldLine[]) => FoldLine[])) => void
  setStitchHoles: (updater: StitchHole[] | ((previous: StitchHole[]) => StitchHole[])) => void
  setSelectedStitchHoleId: (value: string | null) => void
  setPieceNotches: (updater: PieceNotch[] | ((previous: PieceNotch[]) => PieceNotch[])) => void
  setSeamConnections: (updater: SeamConnection[] | ((previous: SeamConnection[]) => SeamConnection[])) => void
  setHardwareMarkers: (updater: HardwareMarker[] | ((previous: HardwareMarker[]) => HardwareMarker[])) => void
  setSelectedHardwareMarkerId: (value: string | null) => void
  ensureActiveLayerWritable: () => boolean
  ensureActiveLineTypeWritable: () => boolean
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
