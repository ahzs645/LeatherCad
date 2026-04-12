import type {
  AvatarSpec,
  FoldLine,
  Layer,
  LineType,
  PatternPiece,
  PiecePlacement3D,
  SeamConnection,
  Shape,
  StitchHole,
  TextureSource,
  ThreePreviewSettings,
} from '../cad/cad-types'

export type OutlinePolygon = {
  polygon: { x: number; y: number }[]
  shapeIds: string[]
  layerId: string
}

export type ThreeBridgeDocument = {
  layers: Layer[]
  lineTypes: LineType[]
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  outlinePolygons: OutlinePolygon[]
  patternPieces: PatternPiece[]
  piecePlacements3d: PiecePlacement3D[]
  seamConnections: SeamConnection[]
  avatars: AvatarSpec[]
}

export type ThreeMaterialState = {
  presetId: string | null
  leatherColor: string | null
  shadowsEnabled: boolean
}

export type ThreeBridgePresentationState = {
  themeMode: 'dark' | 'light'
  previewSettings: ThreePreviewSettings
  textureSource: TextureSource | null
  textureShapeIds: string[]
  threadColor: string
  material: ThreeMaterialState
}
