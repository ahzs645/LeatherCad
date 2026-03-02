import type {
  FoldLine,
  HardwareMarker,
  Layer,
  LineType,
  LineTypeRole,
  ParametricConstraint,
  Point,
  SeamAllowance,
  Shape,
  SketchGroup,
  SnapSettings,
  StitchHole,
  TracingOverlay,
} from './cad/cad-types'

export type MobileViewMode = 'editor' | 'preview' | 'split'
export type MobileOptionsTab = 'view' | 'layers' | 'file'
export type ThemeMode = 'dark' | 'light'
export type LegendMode = 'layer' | 'stack'
export type DxfVersion = 'r12' | 'r14'
export type DesktopRibbonTab = 'build' | 'edit' | 'stitch' | 'layers' | 'output' | 'view'
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
  seamAllowances: SeamAllowance[]
  hardwareMarkers: HardwareMarker[]
  snapSettings: SnapSettings
  showAnnotations: boolean
  tracingOverlays: TracingOverlay[]
  layerColorOverrides: Record<string, string>
  frontLayerColor: string
  backLayerColor: string
}
