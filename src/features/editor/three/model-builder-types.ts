import type { Group, Material, MeshStandardMaterial } from 'three'
import type {
  FoldLine,
  Layer,
  LineType,
  PatternPiece,
  PiecePlacement3D,
  SeamConnection,
  Shape,
  StitchHole,
  ThreePreviewSettings,
} from '../cad/cad-types'
import type { PieceMeshData } from './piece-mesh'
import { ThreeFoldManager } from './fold-manager'
import type { OutlinePolygon } from './three-bridge-types'
import type { Bounds2 } from './bridge/geometry-utils'

export type ModelTransform = {
  scale: number
  centerX: number
  centerY: number
}

export type BuildModelLayoutParams = {
  patternPieces: PatternPiece[]
  outlinePolygons: OutlinePolygon[]
  shapes: Shape[]
  foldLines: FoldLine[]
}

export type BuildModelLayoutResult = {
  pieceMeshes: PieceMeshData[]
  transform: ModelTransform
  documentBounds: Bounds2
}

export type ModelBuilderMaterials = {
  leftMaterial: MeshStandardMaterial
  rightMaterial: MeshStandardMaterial
  leftTextureMaterial: MeshStandardMaterial
  rightTextureMaterial: MeshStandardMaterial
  assembledFrontMaterial: MeshStandardMaterial
  assembledBackMaterial: MeshStandardMaterial
  assembledSideMaterial: MeshStandardMaterial
}

export type CommonRebuildParams = {
  layers: Layer[]
  lineTypes: LineType[]
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  outlinePolygons: OutlinePolygon[]
  patternPieces: PatternPiece[]
  piecePlacements3d: PiecePlacement3D[]
  seamConnections: SeamConnection[]
  previewSettings: ThreePreviewSettings
  pieceMeshes: PieceMeshData[]
  transform: ModelTransform
  documentBounds: Bounds2
  threadColor: string
  texturedShapeIdSet: Set<string>
  hasActiveTexture: boolean
  materials: ModelBuilderMaterials
  preservedMaterials: Set<Material>
  fitControlsToModel: () => void
}

export type RebuildAssembledModelParams = CommonRebuildParams & {
  assembledGroup: Group
  finalProductGroup: Group
  staticSideGroup: Group
  foldingSideGroup: Group
  foldGuideGroup: Group
  avatarGroup: Group
  rebuildAvatarModel: () => Promise<void>
}

export type RebuildFoldModelParams = CommonRebuildParams & {
  staticSideGroup: Group
  foldingSideGroup: Group
  foldGuideGroup: Group
  assembledGroup: Group
  finalProductGroup: Group
  avatarGroup: Group
  foldingPivot: Group
  modelRoot: Group
  foldManager: ThreeFoldManager
}
