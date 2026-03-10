import type {
  AvatarSpec,
  Layer,
  PatternPiece,
  PieceLabel,
  PieceNotch,
  PiecePlacementLabel,
  PieceSeamAllowance,
  SeamConnection,
  Shape,
  SketchGroup,
  StitchHole,
  HardwareMarker,
  TextureSource,
  TracingOverlay,
} from '../cad/cad-types'

export type WorkbenchRibbonTab = 'draft' | 'modify' | 'piece' | 'stitch' | 'output'
export type WorkspaceMode = '2d' | '3d'
export type SecondaryPreviewMode = 'hidden' | '2d-peek' | '3d-peek'
export type WorkbenchInspectorTab = 'inspect' | 'piece' | 'preview3d' | 'document'
export type WorkbenchIconName =
  | 'ai'
  | 'clear'
  | 'copy'
  | 'delete'
  | 'dimensions'
  | 'dxf'
  | 'export'
  | 'fit'
  | 'help'
  | 'import'
  | 'inspect'
  | 'move'
  | 'nest'
  | 'next'
  | 'notes'
  | 'open'
  | 'paste'
  | 'pdf'
  | 'peek'
  | 'peek-off'
  | 'piece'
  | 'preset'
  | 'print'
  | 'redo'
  | 'reset'
  | 'resequence'
  | 'rotate'
  | 'ruler'
  | 'save'
  | 'scale'
  | 'seam'
  | 'settings'
  | 'stitch'
  | 'stitch-var'
  | 'svg'
  | 'templates'
  | 'tracing'
  | 'undo'

export type DockLayoutState = {
  browserWidth: number
  inspectorWidth: number
  peekWidth: number
  activeInspectorTab: WorkbenchInspectorTab
}

export type DocumentBrowserNodeKind =
  | 'section'
  | 'layer-group'
  | 'piece'
  | 'piece-label'
  | 'pattern-label'
  | 'seam-allowance'
  | 'notch'
  | 'placement-label'
  | 'seam-connection'
  | 'layer'
  | 'sketch'
  | 'tracing-overlay'
  | 'avatar'
  | 'texture-source'
  | 'preview-settings'

export type DocumentBrowserNode = {
  id: string
  kind: DocumentBrowserNodeKind
  label: string
  meta?: string
  selected?: boolean
  dimmed?: boolean
  children?: DocumentBrowserNode[]
}

export type InspectorContext =
  | {
      kind: 'empty'
      title: string
      description: string
    }
  | {
      kind: 'shape'
      title: string
      description: string
      shape: Shape
    }
  | {
      kind: 'shape-multi'
      title: string
      description: string
      shapes: Shape[]
    }
  | {
      kind: 'piece'
      title: string
      description: string
      piece: PatternPiece
    }
  | {
      kind: 'stitch-hole'
      title: string
      description: string
      stitchHole: StitchHole
    }
  | {
      kind: 'hardware'
      title: string
      description: string
      hardwareMarker: HardwareMarker
    }

export type RibbonCommandItem = {
  id: string
  label: string
  icon?: WorkbenchIconName
  disabled?: boolean
}

export type RibbonCommandGroup = {
  id: string
  title: string
  items: RibbonCommandItem[]
}

export type QuickAction = {
  id: string
  label: string
  icon?: WorkbenchIconName
  disabled?: boolean
}

export type DocumentBrowserModelParams = {
  patternPieces: PatternPiece[]
  pieceLabels: PieceLabel[]
  seamAllowances: PieceSeamAllowance[]
  pieceNotches: PieceNotch[]
  piecePlacementLabels: PiecePlacementLabel[]
  seamConnections: SeamConnection[]
  selectedPieceIds: string[]
  layers: Layer[]
  activeLayerId: string
  sketchGroups: SketchGroup[]
  activeSketchGroupId: string | null
  tracingOverlays: TracingOverlay[]
  activeTracingOverlayId: string | null
  avatars: AvatarSpec[]
  threeTextureSource: TextureSource | null
}
