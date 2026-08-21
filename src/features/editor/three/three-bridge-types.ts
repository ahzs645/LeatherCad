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
import type { OutlineChainSegment } from '../ops/outline-detection'

export type OutlinePolygon = {
  polygon: { x: number; y: number }[]
  shapeIds: string[]
  layerId: string
  /**
   * Which run of polygon vertices each authored shape contributed. Carried from
   * the outline chain so the 3D path can name a whole side — a curved side is
   * dozens of sampled edges, and a seam that runs across several shapes needs
   * all of them. Dropping it here silently reduced every seam to its first edge.
   */
  segments?: OutlineChainSegment[]
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
