import { Group, Material, Raycaster, Vector2 } from 'three'
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
import { rebuildFinalProductModel } from './final-product-model-builder'
import type { FinalProductSolveResult, StitchPair } from './final-product-types'
import {
  buildModelLayout,
  rebuildAssembledModel,
  rebuildFoldModel,
  type ModelTransform,
} from './model-builder'
import { ThreeMaterialManager } from './material-manager'
import type { PieceMeshData } from './piece-mesh'
import { EngineRuntime, type CameraFitMode } from './engine-runtime'
import {
  nearestBoundaryEdge,
  pieceIdForObject,
  pieceFrameForObject,
  worldPointToDocument,
  type PickedSeamEdge,
} from './seam-edge-picking'
import type {
  OutlinePolygon,
  ThreeBridgeDocument,
  ThreeBridgePresentationState,
} from './three-bridge-types'

export type { OutlinePolygon, ThreeBridgeDocument, ThreeBridgePresentationState, ThreeMaterialState } from './three-bridge-types'

/**
 * Settings a timeline scrubber drives. These change on every frame of a drag, so
 * refitting the camera for each one makes the model jump about while the maker
 * is trying to watch one thing move.
 */
const SCRUB_SETTING_KEYS = ['finalFoldProgress', 'sewnStitchCount'] as const

function withoutScrubSettings(settings: ThreePreviewSettings) {
  const rest: Record<string, unknown> = {}
  // Sorted so the comparison does not depend on the order the caller happened to
  // build the object in.
  for (const key of Object.keys(settings).sort()) {
    if ((SCRUB_SETTING_KEYS as readonly string[]).includes(key)) {
      continue
    }
    rest[key] = (settings as unknown as Record<string, unknown>)[key]
  }
  return JSON.stringify(rest)
}

/**
 * The camera the preview frames a mode with.
 *
 * The stored setting is still called `finalFoldCamera` because Final Product
 * mode was the only one that offered it, but which way you look at a model is a
 * property of looking, not of the mode. Assembled mode needs it most of all: a
 * fold read from a three-quarter view is a shape, and read from the side it is
 * an angle you can compare against the one you typed. Fold mode drives its own
 * pivot camera and Avatar mode wants to orbit a figure, so both keep the orbit.
 */
export function cameraForMode(settings: ThreePreviewSettings): CameraFitMode {
  return settings.mode === 'final' || settings.mode === 'assembled' ? settings.finalFoldCamera : 'orbit'
}

export function isOnlyScrubChange(previous: ThreePreviewSettings, next: ThreePreviewSettings) {
  return (
    withoutScrubSettings(previous) === withoutScrubSettings(next) &&
    SCRUB_SETTING_KEYS.some((key) => previous[key] !== next[key])
  )
}

export class ThreeBridge {
  private runtimeManager: EngineRuntime
  private avatarManager = new ThreeAvatarManager()
  private foldManager = new ThreeFoldManager()
  private modelRoot = new Group()
  private staticSideGroup = new Group()
  private foldingPivot = new Group()
  private foldingSideGroup = new Group()
  private foldGuideGroup = new Group()
  private assembledGroup = new Group()
  private avatarGroup = new Group()
  private finalProductGroup = new Group()
  private finalProductSolveResult: FinalProductSolveResult | null = null
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
  private stitchPairs: StitchPair[] = []
  private avatars: AvatarSpec[] = []
  private threePreviewSettings: ThreePreviewSettings = {
    mode: 'fold',
    explodedFactor: 0.35,
    finalFoldProgress: 1,
    finalFoldCamera: 'orbit',
    thicknessMm: 1.8,
    showSeams: true,
    showEdgeLabels: false,
    showPieceOutlines: false,
    showStressOverlay: true,
    usePhysicsRelaxation: true,
  }
  private pieceMeshes: PieceMeshData[] = []
  private readonly seamPickRaycaster = new Raycaster()
  private fitAfterRebuild = true
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
    this.runtimeManager = new EngineRuntime(canvas)
    this.preservedMaterials = this.materialManager.preservedMaterials

    this.foldingPivot.add(this.foldingSideGroup)
    this.modelRoot.add(this.staticSideGroup)
    this.modelRoot.add(this.foldingPivot)
    this.modelRoot.add(this.foldGuideGroup)
    this.modelRoot.add(this.assembledGroup)
    this.modelRoot.add(this.avatarGroup)
    this.modelRoot.add(this.finalProductGroup)
    this.modelRoot.position.set(0, -0.08, 0.1)
    // Not tilted. Every mode but `final` used to lean the whole model 40
    // degrees (-0.7 rad) so a flat pattern was not seen edge-on by a camera
    // that sat in a fixed spot. The camera frames itself now, and the lean cost
    // two things: the leather stopped lying in the plane of the floor grid it
    // is drawn on — which is the one thing a flat pattern is — and it left the
    // default three-quarter offset about a degree off the plate's own plane, so
    // a correctly placed layout framed itself as a hairline.
    this.scene.add(this.modelRoot)

    // The engine renders while the runtime holds its render lease; no
    // app-side animation loop is needed.
    this.rebuildModel()
  }

  private fitControlsToModel() {
    if (!this.fitAfterRebuild) {
      return
    }
    this.runtimeManager.fitControlsToModel(this.modelRoot, cameraForMode(this.threePreviewSettings))
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
    clearGroup(this.finalProductGroup, this.preservedMaterials)
    this.finalProductSolveResult = null
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

    if (this.threePreviewSettings.mode === 'final') {
      this.finalProductSolveResult = rebuildFinalProductModel({
        layers: this.layers,
        lineTypes: this.lineTypes,
        shapes: this.shapes,
        foldLines: this.foldLines,
        stitchHoles: this.stitchHoles,
        outlinePolygons: this.outlinePolygons,
        patternPieces: this.patternPieces,
        piecePlacements3d: this.piecePlacements3d,
        seamConnections: this.seamConnections,
        stitchPairs: this.stitchPairs,
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
        finalProductGroup: this.finalProductGroup,
        staticSideGroup: this.staticSideGroup,
        foldingSideGroup: this.foldingSideGroup,
        foldGuideGroup: this.foldGuideGroup,
        assembledGroup: this.assembledGroup,
        avatarGroup: this.avatarGroup,
      })
      return
    }

    this.finalProductSolveResult = null

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
        stitchPairs: this.stitchPairs,
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
        finalProductGroup: this.finalProductGroup,
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
      finalProductGroup: this.finalProductGroup,
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
      document.stitchPairs ?? [],
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
      this.fitAfterRebuild = !previous || !isOnlyScrubChange(previous.previewSettings, next.previewSettings)
      try {
        this.threePreviewSettings = { ...next.previewSettings }
        this.rebuildModel()
      } finally {
        this.fitAfterRebuild = true
      }
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
    stitchPairs: StitchPair[] = [],
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
    this.stitchPairs = [...stitchPairs]
    this.avatars = [...avatars]
    this.threePreviewSettings = threePreviewSettings ? { ...threePreviewSettings } : this.threePreviewSettings
    this.fitAfterRebuild = true
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

  getFinalProductSolveResult() {
    return this.finalProductSolveResult
  }

  captureFinalProductReviewCollage() {
    return this.runtimeManager.captureModelReviewCollage(this.modelRoot)
  }

  enableShadows(enabled: boolean) {
    this.runtimeManager.enableShadows(enabled)
  }

  /** Capture a path-traced studio still of the current scene (Seamer Studio's beauty-shot pipeline). */
  async captureStudioStill(options?: {
    width?: number
    height?: number
    samples?: number
    signal?: AbortSignal
    onProgress?: (progress: { stage: string; progress: number }) => void
  }) {
    const { renderStill } = await import('@atelier/render')
    const canvas = this.runtimeManager.renderer.domElement
    const width = options?.width ?? Math.max(canvas.width, 640)
    const height = options?.height ?? Math.max(canvas.height, 640)
    return renderStill(
      { scene: this.scene, camera: this.runtimeManager.camera },
      {
        width,
        height,
        // 128 progressive samples plus the denoiser is a good beauty-shot
        // baseline; machines without hardware GL can take minutes regardless.
        samples: options?.samples ?? 128,
        studio: true,
        autoFrame: true,
        denoise: true,
        signal: options?.signal,
        onProgress: options?.onProgress,
      },
    )
  }

  resize(width?: number, height?: number) {
    void width
    void height
    // The engine viewport measures its own container.
    this.runtimeManager.resize()
  }

  dispose() {
    this.avatarManager.invalidate()
    this.clearAllGroups()
    this.materialManager.dispose()
    this.runtimeManager.dispose()
  }
  /**
   * Resolve a pointer position over the viewport to a boundary edge on the
   * assembled model, or null when the ray misses every piece.
   *
   * This is what lets a seam be started on the flat canvas and finished on the
   * model: both views feed the same seam-tool state machine.
   */
  pickSeamEdgeAt(clientX: number, clientY: number): PickedSeamEdge | null {
    const camera = this.runtimeManager.camera
    const canvas = this.runtimeManager.renderer.domElement
    if (!camera || this.assembledGroup.children.length === 0) {
      return null
    }

    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }
    const pointer = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )

    this.modelRoot.updateMatrixWorld(true)
    this.seamPickRaycaster.setFromCamera(pointer, camera)
    const hits = this.seamPickRaycaster.intersectObject(this.assembledGroup, true)

    for (const hit of hits) {
      const pieceId = pieceIdForObject(hit.object)
      if (!pieceId) {
        continue
      }
      const pieceMesh = this.pieceMeshes.find((entry) => entry.pieceId === pieceId)
      const pieceGroup = this.assembledGroup.children.find(
        (child) => child.userData?.pieceId === pieceId,
      )
      if (!pieceMesh || !pieceGroup) {
        continue
      }
      // The region group the hit landed in, so a click on a folded flap maps
      // back through the fold rather than through the piece's flat pose.
      const frame = pieceFrameForObject(hit.object) ?? pieceGroup
      const documentPoint = worldPointToDocument(hit.point, frame, this.transform)
      const edge = nearestBoundaryEdge(pieceMesh, documentPoint)
      if (edge) {
        return edge
      }
    }
    return null
  }

}
