import type {
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  LineTypeRole,
  PatternPiece,
  ParametricConstraint,
  PieceGrainline,
  PieceLabel,
  PieceNotch,
  PieceSeamAllowance,
  Point,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  TextureSource,
  TracingOverlay,
} from './cad/cad-types'

export type MobileViewMode = 'editor' | 'preview' | 'split'
export type MobileOptionsTab = 'view' | 'file'
export type ResolvedThemeMode = 'dark' | 'light'
export type ThemeMode = ResolvedThemeMode | 'system'
export type LegendMode = 'layer' | 'stack'
export type DxfVersion = 'r12' | 'r14'
export type DesktopRibbonTab = 'build' | 'edit' | 'stitch' | 'output' | 'view'
export type SidePanelTab = '3d' | 'layers'
export type SketchWorkspaceMode = 'assembly' | 'sketch'
export type ExportRoleFilters = Record<LineTypeRole, boolean>

export type MobileLayerAction =
  | 'add'
  | 'rename'
  | 'toggle-visibility'
  | 'toggle-lock'
  | 'move-up'
  | 'move-down'
  | 'delete'
  | 'colors'

export type MobileFileAction =
  | 'save-json'
  | 'save-lcc'
  | 'load-json'
  | 'import-svg'
  | 'load-preset'
  | 'export-svg'
  | 'export-pdf'
  | 'export-dxf'
  | 'export-options'
  | 'template-repository'
  | 'pattern-tools'
  | 'import-tracing'
  | 'print-preview'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'toggle-3d'
  | 'clear'

export type SeamGuide = {
  id: string
  shapeId: string
  d: string
  labelPoint: Point
  offsetMm: number
}

export type AnnotationLabel = {
  id: string
  text: string
  point: Point
  pieceId?: string
  rotationDeg?: number
  fontSizeMm?: number
  kind?: 'generic' | 'piece' | 'pattern'
}

export type EditorSnapshot = {
  layers: Layer[]
  activeLayerId: string
  sketchGroups: SketchGroup[]
  activeSketchGroupId: string | null
  lineTypes: LineType[]
  activeLineTypeId: string
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  constraints: ParametricConstraint[]
  patternPieces: PatternPiece[]
  pieceGrainlines: PieceGrainline[]
  pieceLabels: PieceLabel[]
  seamAllowances: PieceSeamAllowance[]
  pieceNotches: PieceNotch[]
  hardwareMarkers: HardwareMarker[]
  snapSettings: SnapSettings
  showAnnotations: boolean
  tracingOverlays: TracingOverlay[]
  projectMemo: string
  stitchAlwaysShapeIds: string[]
  stitchThreadColor: string
  threeTextureSource: TextureSource | null
  threeTextureShapeIds: string[]
  showCanvasRuler: boolean
  showDimensions: boolean
  layerColorOverrides: Record<string, string>
  frontLayerColor: string
  backLayerColor: string
}
