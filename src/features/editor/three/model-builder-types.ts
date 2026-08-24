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
import type { StitchPair } from './final-product-types'
import type { FoldDrapeStore } from './fold-drape-store'
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
  /** Compiled seam stitches, used to draw a seam closing one stitch at a time. */
  stitchPairs?: StitchPair[]
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
  /**
   * Where fold drapes are cached and solved. A rebuild without one solves
   * every fold on the spot, which is the right answer for a test and the
   * wrong one for a slider.
   */
  foldDrape?: FoldDrapeStore
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
