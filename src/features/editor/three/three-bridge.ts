import { Group, Material } from 'three'
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
import { ThreeAvatarManager } from './avatar-manager'
import { clearGroup } from './bridge/scene-lifecycle'
import { ThreeFoldManager } from './fold-manager'
import {
  buildModelLayout,
  rebuildAssembledModel,
  rebuildFoldModel,
  type ModelTransform,
} from './model-builder'
import { ThreeMaterialManager } from './material-manager'
import type { PieceMeshData } from './piece-mesh'
import { ThreeRuntimeManager } from './runtime-manager'
import type {
  OutlinePolygon,
  ThreeBridgeDocument,
  ThreeBridgePresentationState,
} from './three-bridge-types'

export type { OutlinePolygon, ThreeBridgeDocument, ThreeBridgePresentationState, ThreeMaterialState } from './three-bridge-types'

export class ThreeBridge {
  private runtimeManager: ThreeRuntimeManager
  private avatarManager = new ThreeAvatarManager()
  private foldManager = new ThreeFoldManager()
  private modelRoot = new Group()
  private staticSideGroup = new Group()
  private foldingPivot = new Group()
  private foldingSideGroup = new Group()
  private foldGuideGroup = new Group()
  private assembledGroup = new Group()
  private avatarGroup = new Group()
  private preservedMaterials: Set<Material>
  private materialManager = new ThreeMaterialManager()
  private outlinePolygons: OutlinePolygon[] = []

  private layers: Layer[] = []
  private lineTypes: LineType[] = []
  private shapes: Shape[] = []
  private foldLines: FoldLine[] = []
  private stitchHoles: StitchHole[] = []
  private patternPieces: PatternPiece[] = []
  private piecePlacements3d: PiecePlacement3D[] = []
  private seamConnections: SeamConnection[] = []
  private avatars: AvatarSpec[] = []
  private threePreviewSettings: ThreePreviewSettings = {
    mode: 'fold',
    explodedFactor: 0.35,
    thicknessMm: 1.8,
    showSeams: true,
    showEdgeLabels: false,
    showStressOverlay: true,
  }
  private pieceMeshes: PieceMeshData[] = []
  private transform: ModelTransform = {
    scale: 1,
    centerX: 0,
    centerY: 0,
  }
  private presentationState: ThreeBridgePresentationState | null = null

  private get scene() {
    return this.runtimeManager.scene
  }

  private get texturedShapeIdSet() {
    return this.materialManager.texturedShapeIdSet
  }

  private set texturedShapeIdSet(value: Set<string>) {
    this.materialManager.texturedShapeIdSet = value
  }

  private get threadColor() {
    return this.materialManager.threadColor
  }

  private set threadColor(value: string) {
    this.materialManager.threadColor = value
  }

  constructor(canvas: HTMLCanvasElement) {
    this.runtimeManager = new ThreeRuntimeManager(canvas)
    this.preservedMaterials = this.materialManager.preservedMaterials

    this.foldingPivot.add(this.foldingSideGroup)
    this.modelRoot.add(this.staticSideGroup)
    this.modelRoot.add(this.foldingPivot)
    this.modelRoot.add(this.foldGuideGroup)
    this.modelRoot.add(this.assembledGroup)
    this.modelRoot.add(this.avatarGroup)
    this.modelRoot.position.set(0, -0.08, 0.1)
    this.modelRoot.rotation.x = -0.7
    this.scene.add(this.modelRoot)

    this.rebuildModel()
    this.runtimeManager.startAnimation()
  }

  private fitControlsToModel() {
    this.runtimeManager.fitControlsToModel(this.modelRoot)
  }

  private async rebuildAvatarModel() {
    await this.avatarManager.rebuildAvatarModel({
      avatarGroup: this.avatarGroup,
      avatars: this.avatars,
      previewSettings: this.threePreviewSettings,
      transformScale: this.transform.scale,
      preservedMaterials: this.preservedMaterials,
      fitControlsToModel: () => this.fitControlsToModel(),
    })
  }

  private clearAllGroups() {
    clearGroup(this.staticSideGroup, this.preservedMaterials)
    clearGroup(this.foldingSideGroup, this.preservedMaterials)
    clearGroup(this.foldGuideGroup, this.preservedMaterials)
    clearGroup(this.assembledGroup, this.preservedMaterials)
    clearGroup(this.avatarGroup, this.preservedMaterials)
  }

  private rebuildModel() {
    const { pieceMeshes, transform, documentBounds } = buildModelLayout({
      patternPieces: this.patternPieces,
      outlinePolygons: this.outlinePolygons,
      shapes: this.shapes,
      foldLines: this.foldLines,
    })

    this.pieceMeshes = pieceMeshes
    this.transform = transform

    if (this.threePreviewSettings.mode === 'assembled' || this.threePreviewSettings.mode === 'avatar') {
      rebuildAssembledModel({
        layers: this.layers,
        lineTypes: this.lineTypes,
        shapes: this.shapes,
        foldLines: this.foldLines,
        stitchHoles: this.stitchHoles,
        outlinePolygons: this.outlinePolygons,
        patternPieces: this.patternPieces,
        piecePlacements3d: this.piecePlacements3d,
        seamConnections: this.seamConnections,
        previewSettings: this.threePreviewSettings,
        pieceMeshes: this.pieceMeshes,
        transform: this.transform,
        documentBounds,
        threadColor: this.threadColor,
        texturedShapeIdSet: this.texturedShapeIdSet,
        hasActiveTexture: this.materialManager.currentAlbedo !== null,
        materials: {
          leftMaterial: this.materialManager.leftMaterial,
          rightMaterial: this.materialManager.rightMaterial,
          leftTextureMaterial: this.materialManager.leftTextureMaterial,
          rightTextureMaterial: this.materialManager.rightTextureMaterial,
          assembledFrontMaterial: this.materialManager.assembledFrontMaterial,
          assembledBackMaterial: this.materialManager.assembledBackMaterial,
          assembledSideMaterial: this.materialManager.assembledSideMaterial,
        },
        preservedMaterials: this.preservedMaterials,
        fitControlsToModel: () => this.fitControlsToModel(),
        assembledGroup: this.assembledGroup,
        staticSideGroup: this.staticSideGroup,
        foldingSideGroup: this.foldingSideGroup,
        foldGuideGroup: this.foldGuideGroup,
        avatarGroup: this.avatarGroup,
        rebuildAvatarModel: () => this.rebuildAvatarModel(),
      })
      return
    }

    rebuildFoldModel({
      layers: this.layers,
      lineTypes: this.lineTypes,
      shapes: this.shapes,
      foldLines: this.foldLines,
      stitchHoles: this.stitchHoles,
      outlinePolygons: this.outlinePolygons,
      patternPieces: this.patternPieces,
      piecePlacements3d: this.piecePlacements3d,
      seamConnections: this.seamConnections,
      previewSettings: this.threePreviewSettings,
      pieceMeshes: this.pieceMeshes,
      transform: this.transform,
      documentBounds,
      threadColor: this.threadColor,
      texturedShapeIdSet: this.texturedShapeIdSet,
      hasActiveTexture: this.materialManager.currentAlbedo !== null,
      materials: {
        leftMaterial: this.materialManager.leftMaterial,
        rightMaterial: this.materialManager.rightMaterial,
        leftTextureMaterial: this.materialManager.leftTextureMaterial,
        rightTextureMaterial: this.materialManager.rightTextureMaterial,
        assembledFrontMaterial: this.materialManager.assembledFrontMaterial,
        assembledBackMaterial: this.materialManager.assembledBackMaterial,
        assembledSideMaterial: this.materialManager.assembledSideMaterial,
      },
      preservedMaterials: this.preservedMaterials,
      fitControlsToModel: () => this.fitControlsToModel(),
      staticSideGroup: this.staticSideGroup,
      foldingSideGroup: this.foldingSideGroup,
      foldGuideGroup: this.foldGuideGroup,
      assembledGroup: this.assembledGroup,
      avatarGroup: this.avatarGroup,
      foldingPivot: this.foldingPivot,
      modelRoot: this.modelRoot,
      foldManager: this.foldManager,
    })
  }

  private textureSignature(texture: TextureSource | null) {
    if (!texture) {
      return ''
    }

    return JSON.stringify({
      sourceUrl: texture.sourceUrl ?? '',
      license: texture.license ?? '',
      albedoUrl: texture.albedoUrl ?? '',
      normalUrl: texture.normalUrl ?? '',
      roughnessUrl: texture.roughnessUrl ?? '',
    })
  }

  updateDocument(document: ThreeBridgeDocument) {
    this.setDocument(
      document.layers,
      document.shapes,
      document.foldLines,
      document.lineTypes,
      document.stitchHoles,
      document.outlinePolygons,
      document.patternPieces,
      document.piecePlacements3d,
      document.seamConnections,
      this.threePreviewSettings,
      document.avatars,
    )
  }

  async updatePresentation(presentation: ThreeBridgePresentationState) {
    const next: ThreeBridgePresentationState = {
      ...presentation,
      previewSettings: { ...presentation.previewSettings },
      textureShapeIds: [...presentation.textureShapeIds],
      material: {
        ...presentation.material,
      },
    }
    const previous = this.presentationState
    this.presentationState = next

    const previewChanged =
      !previous || JSON.stringify(previous.previewSettings) !== JSON.stringify(next.previewSettings)
    const threadChanged = !previous || previous.threadColor !== next.threadColor
    const themeChanged = !previous || previous.themeMode !== next.themeMode
    const textureChanged =
      !previous || this.textureSignature(previous.textureSource) !== this.textureSignature(next.textureSource)
    const textureAssignmentsChanged =
      !previous || JSON.stringify(previous.textureShapeIds) !== JSON.stringify(next.textureShapeIds)
    const presetChanged = !previous || previous.material.presetId !== next.material.presetId
    const leatherColorChanged = !previous || previous.material.leatherColor !== next.material.leatherColor
    const shadowChanged = !previous || previous.material.shadowsEnabled !== next.material.shadowsEnabled

    if (themeChanged) {
      this.setTheme(next.themeMode)
    }

    if (previewChanged) {
      this.threePreviewSettings = { ...next.previewSettings }
      this.rebuildModel()
    }

    if (threadChanged) {
      this.setThreadColor(next.threadColor)
    }

    if (presetChanged && next.material.presetId) {
      this.applyLeatherPreset(next.material.presetId)
    }

    if (leatherColorChanged && next.material.leatherColor) {
      this.setLeatherColor(next.material.leatherColor)
    }

    if (shadowChanged) {
      this.enableShadows(next.material.shadowsEnabled)
    }

    if (textureChanged) {
      if (next.textureSource?.albedoUrl?.trim()) {
        await this.setTexture(next.textureSource)
      } else {
        this.useDefaultTexture()
      }
      this.setTextureAssignments(next.textureShapeIds)
      return
    }

    if (textureAssignmentsChanged) {
      this.setTextureAssignments(next.textureShapeIds)
    }
  }

  setDocument(
    layers: Layer[],
    shapes: Shape[],
    foldLines: FoldLine[],
    lineTypes: LineType[] = [],
    stitchHoles: StitchHole[] = [],
    outlinePolygons: OutlinePolygon[] = [],
    patternPieces: PatternPiece[] = [],
    piecePlacements3d: PiecePlacement3D[] = [],
    seamConnections: SeamConnection[] = [],
    threePreviewSettings?: ThreePreviewSettings,
    avatars: AvatarSpec[] = [],
  ) {
    this.layers = [...layers]
    this.lineTypes = [...lineTypes]
    this.shapes = [...shapes]
    this.foldLines = [...foldLines]
    this.stitchHoles = [...stitchHoles]
    this.outlinePolygons = outlinePolygons
    this.patternPieces = [...patternPieces]
    this.piecePlacements3d = [...piecePlacements3d]
    this.seamConnections = [...seamConnections]
    this.avatars = [...avatars]
    this.threePreviewSettings = threePreviewSettings ? { ...threePreviewSettings } : this.threePreviewSettings
    const shapeIdSet = new Set(this.shapes.map((shape) => shape.id))
    this.texturedShapeIdSet = new Set(Array.from(this.texturedShapeIdSet).filter((shapeId) => shapeIdSet.has(shapeId)))
    this.foldManager.syncFoldLine(this.foldLines[0] ?? null)
    this.rebuildModel()
  }

  setLayers(layers: Layer[]) {
    this.layers = [...layers]
    this.rebuildModel()
  }

  setShapes(shapes: Shape[], outlinePolygons?: OutlinePolygon[]) {
    this.shapes = [...shapes]
    if (outlinePolygons) {
      this.outlinePolygons = outlinePolygons
    }
    const shapeIdSet = new Set(this.shapes.map((shape) => shape.id))
    this.texturedShapeIdSet = new Set(Array.from(this.texturedShapeIdSet).filter((shapeId) => shapeIdSet.has(shapeId)))
    this.rebuildModel()
  }

  setStitchHoles(stitchHoles: StitchHole[]) {
    this.stitchHoles = [...stitchHoles]
    this.rebuildModel()
  }

  setFoldLines(foldLines: FoldLine[]) {
    this.foldLines = [...foldLines]
    this.foldManager.syncFoldLine(this.foldLines[0] ?? null)
    this.rebuildModel()
  }

  setFoldAngle(angleDeg: number) {
    this.foldManager.setAngle(angleDeg)
    this.foldManager.updateRotation({
      staticSideGroup: this.staticSideGroup,
      foldingSideGroup: this.foldingSideGroup,
      modelRoot: this.modelRoot,
    })
  }

  setTheme(themeMode: 'dark' | 'light') {
    this.runtimeManager.setTheme(themeMode)
  }

  async setTexture(texture: TextureSource) {
    await this.materialManager.setTexture(texture)
    this.rebuildModel()
  }

  useDefaultTexture() {
    this.materialManager.useDefaultTexture()
    this.rebuildModel()
  }

  setTextureAssignments(shapeIds: string[]) {
    this.materialManager.setTextureAssignments(shapeIds, this.shapes)
    this.rebuildModel()
  }

  setThreadColor(color: string) {
    if (typeof color !== 'string' || color.trim().length === 0) {
      return
    }
    this.threadColor = color
    this.rebuildModel()
  }

  applyLeatherPreset(presetId: string) {
    this.materialManager.applyLeatherPreset(presetId)
    this.rebuildModel()
  }

  setLeatherColor(color: string) {
    this.materialManager.setLeatherColor(color)
  }

  setLeatherTextureRotationDeg(angleDeg: number) {
    this.materialManager.setTextureRotationDeg(angleDeg)
  }

  getLeatherTextureRotationDeg(): number {
    return (this.materialManager.textureRotationRad * 180) / Math.PI
  }

  enableShadows(enabled: boolean) {
    this.runtimeManager.enableShadows(enabled)
  }

  resize(width: number, height: number) {
    this.runtimeManager.resize(width, height)
  }

  dispose() {
    this.avatarManager.invalidate()
    this.clearAllGroups()
    this.materialManager.dispose()
    this.runtimeManager.dispose()
  }
}
