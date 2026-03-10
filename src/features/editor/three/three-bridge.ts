import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { sampleShapePoints } from '../cad/cad-geometry'
import type {
  AvatarSpec,
  FoldLine,
  Layer,
  LineType,
  PatternPiece,
  PiecePlacement3D,
  Point,
  SeamConnection,
  Shape,
  StitchHole,
  TextureSource,
  ThreePreviewSettings,
} from '../cad/cad-types'
import { foldDirectionSign, resolveFoldBehavior, type ResolvedFoldBehavior } from '../ops/fold-line-ops'
import { LEATHER_PRESETS } from './material-presets'
import { buildOutlineRegions } from './outline-regions'
import { isPhysicalCutShape, shouldUseOutlineRegions } from './physical-layer-heuristics'
import { buildPhysicalLayerRegions } from './physical-layer-regions'
import { buildPieceMeshes, createPieceShape, projectPiecePoint, type PieceMeshData } from './piece-mesh'

export type OutlinePolygon = {
  polygon: Point[]
  shapeIds: string[]
  layerId: string
}

type ModelTransform = {
  scale: number
  centerX: number
  centerY: number
}

type ShapeSegment = {
  start: THREE.Vector2
  end: THREE.Vector2
  color: string
}

type Bounds2 = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type Bounds3 = {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

const EPSILON = 1e-6
const CUT_LINE_COLOR = '#38bdf8'
const STITCH_LINE_COLOR = '#f97316'
const FOLD_LINE_COLOR = '#fb7185'
const DEFAULT_STITCH_THREAD_COLOR = '#fb923c'
const LAYER_STACK_STEP = 0.012
const COLLISION_SEARCH_STEP_DEG = 1
const COLLISION_CHECK_CUTOFF_DEG = 90
const MIN_OVERLAP_AREA_WORLD = 0.00002
const MIN_OVERLAP_HEIGHT_WORLD = 0.00045
const DEFAULT_THICKNESS_WORLD = 0.005

function disposeObjectGraph(root: THREE.Object3D, preservedMaterials: Set<THREE.Material>) {
  root.traverse((object) => {
    const meshLike = object as THREE.Mesh
    if ('geometry' in meshLike && meshLike.geometry instanceof THREE.BufferGeometry) {
      meshLike.geometry.dispose()
    }

    if ('material' in meshLike) {
      const material = meshLike.material
      if (Array.isArray(material)) {
        for (const entry of material) {
          if (!preservedMaterials.has(entry)) {
            entry.dispose()
          }
        }
      } else if (material instanceof THREE.Material && !preservedMaterials.has(material)) {
        material.dispose()
      }
    }
  })
}

function clearGroup(group: THREE.Group, preservedMaterials: Set<THREE.Material>) {
  while (group.children.length > 0) {
    const child = group.children[0]
    group.remove(child)
    disposeObjectGraph(child, preservedMaterials)
  }
}

function loadTexture(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture: THREE.Texture) => resolve(texture),
      undefined,
      (error: unknown) => reject(error instanceof Error ? error : new Error('Texture load failed')),
    )
  })
}

function sideOfLine(point: THREE.Vector2, lineStart: THREE.Vector2, lineEnd: THREE.Vector2) {
  const direction = lineEnd.clone().sub(lineStart)
  return direction.x * (point.y - lineStart.y) - direction.y * (point.x - lineStart.x)
}

function polygonBounds(points: THREE.Vector2[]): Bounds2 {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, maxX, minY, maxY }
}

function padBounds(bounds: Bounds2, padding: number) {
  return {
    minX: bounds.minX - padding,
    maxX: bounds.maxX + padding,
    minY: bounds.minY - padding,
    maxY: bounds.maxY + padding,
  }
}

function ensureMinSpan(bounds: Bounds2, minSpan: number) {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const halfWidth = Math.max(width, minSpan) / 2
  const halfHeight = Math.max(height, minSpan) / 2
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight,
  }
}

function clipPolygonByLine(points: THREE.Vector2[], lineStart: THREE.Vector2, lineEnd: THREE.Vector2, keepPositive: boolean) {
  if (points.length === 0) {
    return [] as THREE.Vector2[]
  }

  const result: THREE.Vector2[] = []
  const sideCheck = (value: number) => (keepPositive ? value >= -EPSILON : value <= EPSILON)

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const currentSide = sideOfLine(current, lineStart, lineEnd)
    const nextSide = sideOfLine(next, lineStart, lineEnd)
    const currentInside = sideCheck(currentSide)
    const nextInside = sideCheck(nextSide)

    if (currentInside && nextInside) {
      result.push(next.clone())
      continue
    }

    if (currentInside && !nextInside) {
      const denominator = currentSide - nextSide
      if (Math.abs(denominator) > EPSILON) {
        const t = currentSide / denominator
        result.push(current.clone().lerp(next, t))
      }
      continue
    }

    if (!currentInside && nextInside) {
      const denominator = currentSide - nextSide
      if (Math.abs(denominator) > EPSILON) {
        const t = currentSide / denominator
        result.push(current.clone().lerp(next, t))
      }
      result.push(next.clone())
    }
  }

  return result
}

function segmentLengthSquared(a: THREE.Vector2, b: THREE.Vector2) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function lineIntersectionOnSegment(a: THREE.Vector2, b: THREE.Vector2, sideA: number, sideB: number) {
  const denominator = sideA - sideB
  if (Math.abs(denominator) <= EPSILON) {
    return null
  }

  const t = sideA / denominator
  return a.clone().lerp(b, t)
}

function distanceToFoldAxisInWorld(point: THREE.Vector3, foldAxisPoint: THREE.Vector2, foldAxisDirection: THREE.Vector3) {
  const dx = point.x - foldAxisPoint.x
  const dz = point.z - foldAxisPoint.y
  return Math.abs(dx * -foldAxisDirection.z + dz * foldAxisDirection.x)
}

export class ThreeBridge {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private frameId: number | null = null

  private modelRoot = new THREE.Group()
  private staticSideGroup = new THREE.Group()
  private foldingPivot = new THREE.Group()
  private foldingSideGroup = new THREE.Group()
  private foldGuideGroup = new THREE.Group()
  private assembledGroup = new THREE.Group()
  private avatarGroup = new THREE.Group()
  private preservedMaterials: Set<THREE.Material>
  private ambientLight = new THREE.AmbientLight('#ffffff', 0.55)
  private keyLight = new THREE.DirectionalLight('#dbeafe', 0.9)
  private rimLight = new THREE.DirectionalLight('#93c5fd', 0.35)
  private grid = new THREE.GridHelper(4.2, 14, '#334155', '#1e293b')
  private themeMode: 'dark' | 'light' = 'dark'

  private leftMaterial = new THREE.MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: THREE.DoubleSide,
  })

  private rightMaterial = new THREE.MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: THREE.DoubleSide,
  })

  private leftTextureMaterial = new THREE.MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: THREE.DoubleSide,
  })

  private rightTextureMaterial = new THREE.MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: THREE.DoubleSide,
  })

  private assembledFrontMaterial = new THREE.MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: THREE.DoubleSide,
  })

  private assembledBackMaterial = new THREE.MeshStandardMaterial({
    color: '#5b4227',
    roughness: 0.92,
    metalness: 0.02,
    side: THREE.DoubleSide,
  })

  private assembledSideMaterial = new THREE.MeshStandardMaterial({
    color: '#6f5030',
    roughness: 0.9,
    metalness: 0.03,
    side: THREE.DoubleSide,
  })

  private textureLoader = new THREE.TextureLoader()
  private currentAlbedo: THREE.Texture | null = null
  private currentNormal: THREE.Texture | null = null
  private currentRoughness: THREE.Texture | null = null
  private texturedShapeIdSet = new Set<string>()
  private threadColor = DEFAULT_STITCH_THREAD_COLOR
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
  private avatarLoadVersion = 0
  private threePreviewSettings: ThreePreviewSettings = {
    mode: 'fold',
    explodedFactor: 0.35,
    thicknessMm: 1.8,
    showSeams: true,
    showEdgeLabels: false,
    showStressOverlay: true,
  }
  private pieceMeshes: PieceMeshData[] = []
  private activeFoldAxis = new THREE.Vector3(0, 0, 1)
  private activeFoldMid = new THREE.Vector2(0, 0)
  private activeFoldBehavior: ResolvedFoldBehavior = resolveFoldBehavior(null)
  private activeFoldAngleDeg = 0
  private staticPanels: THREE.Mesh[] = []
  private foldingPanels: THREE.Mesh[] = []
  private staticPanelBoxes: THREE.Box3[] = []

  private transform: ModelTransform = {
    scale: 1,
    centerX: 0,
    centerY: 0,
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.textureLoader.crossOrigin = 'anonymous'
    this.preservedMaterials = new Set([
      this.leftMaterial,
      this.rightMaterial,
      this.leftTextureMaterial,
      this.rightTextureMaterial,
      this.assembledFrontMaterial,
      this.assembledBackMaterial,
      this.assembledSideMaterial,
    ])

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(Math.max(this.canvas.clientWidth, 1), Math.max(this.canvas.clientHeight, 1), false)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#0a1220')

    this.camera = new THREE.PerspectiveCamera(50, Math.max(this.canvas.clientWidth, 1) / Math.max(this.canvas.clientHeight, 1), 0.01, 100)
    this.camera.position.set(0, 1.2, 2.4)
    this.camera.lookAt(0, 0, 0)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.07
    this.controls.enablePan = true
    this.controls.panSpeed = 0.65
    this.controls.rotateSpeed = 0.8
    this.controls.zoomSpeed = 0.9
    this.controls.minDistance = 0.7
    this.controls.maxDistance = 5.5
    this.controls.target.set(0, 0.22, 0)
    this.controls.update()

    this.setupLights()
    this.setupSceneHelpers()
    this.setTheme('dark')

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
    this.animate()
  }

  private setupLights() {
    this.keyLight.position.set(1.2, 2.2, 1.4)
    this.rimLight.position.set(-1.4, 1.2, -1.4)

    this.scene.add(this.ambientLight)
    this.scene.add(this.keyLight)
    this.scene.add(this.rimLight)
  }

  private setupSceneHelpers() {
    this.grid.position.y = -0.35
    this.scene.add(this.grid)
  }

  private clearAssembledGroups() {
    clearGroup(this.assembledGroup, this.preservedMaterials)
    clearGroup(this.avatarGroup, this.preservedMaterials)
  }

  private projectPoint(point: { x: number; y: number }) {
    return new THREE.Vector2(
      (point.x - this.transform.centerX) * this.transform.scale,
      -(point.y - this.transform.centerY) * this.transform.scale,
    )
  }

  private buildBoundsFromPieceMeshes() {
    if (this.pieceMeshes.length === 0) {
      return null
    }

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (const piece of this.pieceMeshes) {
      minX = Math.min(minX, piece.bounds.minX)
      minY = Math.min(minY, piece.bounds.minY)
      maxX = Math.max(maxX, piece.bounds.maxX)
      maxY = Math.max(maxY, piece.bounds.maxY)
    }

    return { minX, minY, maxX, maxY }
  }

  private buildModelBounds3() {
    const box = new THREE.Box3().setFromObject(this.modelRoot)
    if (box.isEmpty()) {
      return null
    }
    return {
      minX: box.min.x,
      minY: box.min.y,
      minZ: box.min.z,
      maxX: box.max.x,
      maxY: box.max.y,
      maxZ: box.max.z,
    } satisfies Bounds3
  }

  private fitControlsToModel() {
    this.modelRoot.updateMatrixWorld(true)
    const bounds = this.buildModelBounds3()
    if (!bounds) {
      this.controls.target.set(0, 0.18, 0)
      this.controls.update()
      return
    }

    const center = new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      (bounds.minZ + bounds.maxZ) / 2,
    )
    const size = new THREE.Vector3(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ,
    )
    const radius = Math.max(size.length() * 0.5, 0.6)

    this.controls.target.copy(center)
    this.controls.minDistance = Math.max(0.3, radius * 0.4)
    this.controls.maxDistance = Math.max(5.5, radius * 8)
    this.camera.position.set(center.x + radius * 0.95, center.y + radius * 1.15, center.z + radius * 1.3)
    this.camera.lookAt(center)
    this.controls.update()
  }

  private placementForPiece(pieceId: string) {
    return (
      this.piecePlacements3d.find((placement) => placement.pieceId === pieceId) ?? {
        pieceId,
        translationMm: { x: 0, y: 0, z: 0 },
        rotationDeg: { x: 0, y: 0, z: 0 },
        flipped: false,
      }
    )
  }

  private explodedOffsetForIndex(index: number, total: number) {
    if (total <= 1) {
      return new THREE.Vector3(0, 0, 0)
    }
    const angle = (index / total) * Math.PI * 2
    const radiusMm = 70 * this.threePreviewSettings.explodedFactor
    return new THREE.Vector3(
      Math.cos(angle) * radiusMm * this.transform.scale,
      0,
      Math.sin(angle) * radiusMm * this.transform.scale,
    )
  }

  private applyPlacementTransform(group: THREE.Group, placement: PiecePlacement3D, index: number, total: number) {
    const exploded = this.explodedOffsetForIndex(index, total)
    group.position.set(
      placement.translationMm.x * this.transform.scale + exploded.x,
      placement.translationMm.y * this.transform.scale + exploded.y,
      -placement.translationMm.z * this.transform.scale + exploded.z,
    )
    group.rotation.set(
      THREE.MathUtils.degToRad(placement.rotationDeg.x),
      THREE.MathUtils.degToRad(placement.rotationDeg.y),
      THREE.MathUtils.degToRad(placement.rotationDeg.z),
    )
    if (placement.flipped) {
      group.scale.x = -1
    }
  }

  private createProceduralAvatar(scaleWorld: number) {
    const avatar = new THREE.Group()
    const material = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.96,
      metalness: 0.02,
      transparent: true,
      opacity: 0.28,
    })

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.14 * scaleWorld, 0.55 * scaleWorld, 8, 12), material)
    torso.position.set(0, 0.45 * scaleWorld, 0)
    avatar.add(torso)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scaleWorld, 16, 16), material)
    head.position.set(0, 0.92 * scaleWorld, 0)
    avatar.add(head)

    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.05 * scaleWorld, 0.46 * scaleWorld, 6, 10), material)
    leftLeg.position.set(-0.08 * scaleWorld, 0.03 * scaleWorld, 0)
    avatar.add(leftLeg)

    const rightLeg = leftLeg.clone()
    rightLeg.position.x *= -1
    avatar.add(rightLeg)

    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04 * scaleWorld, 0.42 * scaleWorld, 6, 10), material)
    leftArm.position.set(-0.27 * scaleWorld, 0.53 * scaleWorld, 0)
    leftArm.rotation.z = THREE.MathUtils.degToRad(22)
    avatar.add(leftArm)

    const rightArm = leftArm.clone()
    rightArm.position.x *= -1
    rightArm.rotation.z *= -1
    avatar.add(rightArm)

    return avatar
  }

  private activeAvatarSpec() {
    if (this.threePreviewSettings.avatarId) {
      const match = this.avatars.find((entry) => entry.id === this.threePreviewSettings.avatarId)
      if (match) {
        return match
      }
    }
    return this.avatars[0] ?? null
  }

  private styleLoadedAvatar(root: THREE.Object3D) {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!(mesh.geometry instanceof THREE.BufferGeometry)) {
        return
      }

      const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      const material =
        sourceMaterial instanceof THREE.MeshStandardMaterial
          ? sourceMaterial.clone()
          : new THREE.MeshStandardMaterial({
              color: '#94a3b8',
              roughness: 0.92,
              metalness: 0.04,
            })
      material.transparent = true
      material.opacity = Math.min(material.opacity ?? 1, 0.34)
      material.depthWrite = false
      mesh.material = material
    })
  }

  private async loadAvatarAsset(spec: AvatarSpec) {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    const loaded = await loader.loadAsync(spec.sourceUrl)
    const avatar = loaded.scene.clone(true)
    this.styleLoadedAvatar(avatar)

    const bounds = new THREE.Box3().setFromObject(avatar)
    const size = bounds.getSize(new THREE.Vector3())
    const safeHeight = Math.max(size.y, EPSILON)
    const targetHeight = Math.max(spec.scaleMm, 200) * this.transform.scale
    const scale = targetHeight / safeHeight
    avatar.scale.setScalar(scale)

    const scaledBounds = new THREE.Box3().setFromObject(avatar)
    avatar.position.set(0, -scaledBounds.min.y, 0)
    return avatar
  }

  private async rebuildAvatarModel() {
    const mode = this.threePreviewSettings.mode
    const version = ++this.avatarLoadVersion
    clearGroup(this.avatarGroup, this.preservedMaterials)

    if (mode !== 'avatar') {
      return
    }

    const spec = this.activeAvatarSpec()
    if (!spec?.sourceUrl.trim()) {
      const fallback = this.createProceduralAvatar(1.05)
      fallback.position.set(0, 0.22, 0)
      this.avatarGroup.add(fallback)
      this.fitControlsToModel()
      return
    }

    try {
      const avatar = await this.loadAvatarAsset(spec)
      if (version !== this.avatarLoadVersion || this.threePreviewSettings.mode !== 'avatar') {
        disposeObjectGraph(avatar, this.preservedMaterials)
        return
      }
      this.avatarGroup.add(avatar)
      this.fitControlsToModel()
    } catch {
      if (version !== this.avatarLoadVersion || this.threePreviewSettings.mode !== 'avatar') {
        return
      }
      const fallback = this.createProceduralAvatar(1.05)
      fallback.position.set(0, 0.22, 0)
      this.avatarGroup.add(fallback)
      this.fitControlsToModel()
    }
  }

  private foldAxisFromLine(lineStart: THREE.Vector2, lineEnd: THREE.Vector2) {
    const axis = new THREE.Vector3(lineEnd.x - lineStart.x, 0, lineEnd.y - lineStart.y)
    if (axis.lengthSq() <= EPSILON) {
      return new THREE.Vector3(0, 0, 1)
    }
    return axis.normalize()
  }

  private resolvePrimaryFoldBehavior() {
    const foldLine = this.foldLines[0] ?? null
    const behavior = resolveFoldBehavior(foldLine)
    this.activeFoldBehavior = behavior
    return behavior
  }

  private foldLiftWorldForAngle(angleDeg: number, behavior: ResolvedFoldBehavior) {
    const signedAngleDeg = foldDirectionSign(behavior.direction) * angleDeg
    if (Math.abs(signedAngleDeg) <= EPSILON) {
      return 0
    }

    const radians = THREE.MathUtils.degToRad(Math.abs(signedAngleDeg))
    const thicknessWorld = behavior.thicknessMm * this.transform.scale
    const clearanceWorld = behavior.clearanceMm * this.transform.scale
    const radiusWorld = behavior.radiusMm * this.transform.scale
    const neutralAxisAdjustment = (behavior.neutralAxisRatio - 0.5) * thicknessWorld * Math.sin(radians)
    const hingeLift = (thicknessWorld + clearanceWorld) * Math.sin(radians / 2)
    const curvatureLift = radiusWorld * (1 - Math.cos(radians))
    return (hingeLift + curvatureLift + neutralAxisAdjustment) * Math.sign(signedAngleDeg)
  }

  private applyFoldTransform(angleDeg: number, behavior: ResolvedFoldBehavior) {
    const signedRadians = foldDirectionSign(behavior.direction) * THREE.MathUtils.degToRad(angleDeg)
    this.foldingSideGroup.quaternion.setFromAxisAngle(this.activeFoldAxis, signedRadians)
    this.foldingSideGroup.position.set(0, this.foldLiftWorldForAngle(angleDeg, behavior), 0)
    this.modelRoot.updateMatrixWorld(true)
  }

  private rebuildStaticPanelBoxCache() {
    this.staticSideGroup.updateMatrixWorld(true)
    this.staticPanelBoxes = this.staticPanels.map((panel) => new THREE.Box3().setFromObject(panel))
  }

  private hasPanelCollision(behavior: ResolvedFoldBehavior) {
    if (this.staticPanelBoxes.length === 0 || this.foldingPanels.length === 0) {
      return false
    }

    const clearanceWorld = behavior.clearanceMm * this.transform.scale
    const thicknessWorld = behavior.thicknessMm * this.transform.scale
    const hingeAllowance = (behavior.radiusMm + behavior.clearanceMm + behavior.thicknessMm * 0.5) * this.transform.scale
    const overlapHeightThreshold = Math.max(MIN_OVERLAP_HEIGHT_WORLD, clearanceWorld * (0.35 + behavior.stiffness * 0.65))
    const overlapAreaThreshold = Math.max(
      MIN_OVERLAP_AREA_WORLD,
      Math.max(clearanceWorld, thicknessWorld * 0.4) * Math.max(clearanceWorld, thicknessWorld * 0.4),
    )
    const foldingBox = new THREE.Box3()
    const overlapBox = new THREE.Box3()
    const overlapSize = new THREE.Vector3()
    const overlapCenter = new THREE.Vector3()

    for (const foldingPanel of this.foldingPanels) {
      foldingBox.setFromObject(foldingPanel)
      for (const staticBox of this.staticPanelBoxes) {
        if (!foldingBox.intersectsBox(staticBox)) {
          continue
        }

        overlapBox.copy(foldingBox).intersect(staticBox)
        if (overlapBox.isEmpty()) {
          continue
        }

        overlapBox.getSize(overlapSize)
        const overlapArea = overlapSize.x * overlapSize.z
        if (overlapArea <= overlapAreaThreshold || overlapSize.y <= overlapHeightThreshold) {
          continue
        }

        overlapBox.getCenter(overlapCenter)
        const axisDistance = distanceToFoldAxisInWorld(overlapCenter, this.activeFoldMid, this.activeFoldAxis)
        if (axisDistance > hingeAllowance) {
          return true
        }
      }
    }

    return false
  }

  private resolveSafeFoldAngle(targetAngleDeg: number, behavior: ResolvedFoldBehavior) {
    const clampedTarget = THREE.MathUtils.clamp(targetAngleDeg, -behavior.maxAngleDeg, behavior.maxAngleDeg)
    if (Math.abs(clampedTarget) <= EPSILON || this.staticPanels.length === 0 || this.foldingPanels.length === 0) {
      return clampedTarget
    }

    const direction = clampedTarget >= 0 ? 1 : -1
    const targetMagnitude = Math.abs(clampedTarget)
    const guardedMagnitude = Math.min(targetMagnitude, COLLISION_CHECK_CUTOFF_DEG)

    for (let candidateMagnitude = guardedMagnitude; candidateMagnitude >= 0; candidateMagnitude -= COLLISION_SEARCH_STEP_DEG) {
      const candidate = direction * candidateMagnitude
      this.applyFoldTransform(candidate, behavior)
      if (!this.hasPanelCollision(behavior)) {
        if (targetMagnitude > COLLISION_CHECK_CUTOFF_DEG && candidateMagnitude >= guardedMagnitude - EPSILON) {
          return clampedTarget
        }
        return candidate
      }
    }

    return 0
  }

  private updateFoldRotation() {
    const behavior = this.resolvePrimaryFoldBehavior()
    const targetAngle = THREE.MathUtils.clamp(this.activeFoldAngleDeg, -behavior.maxAngleDeg, behavior.maxAngleDeg)
    const safeAngle = this.resolveSafeFoldAngle(targetAngle, behavior)
    this.applyFoldTransform(safeAngle, behavior)
  }

  private shapeColor(shape: Shape) {
    const lineType = this.lineTypes.find((entry) => entry.id === shape.lineTypeId)
    if (lineType?.role === 'stitch') {
      return STITCH_LINE_COLOR
    }
    if (lineType?.role === 'fold') {
      return FOLD_LINE_COLOR
    }

    const layer = this.layers.find((entry) => entry.id === shape.layerId)
    const fallbackFingerprint = `${layer?.name ?? ''} ${shape.id}`.toLowerCase()
    if (
      fallbackFingerprint.includes('stitch') ||
      fallbackFingerprint.includes('seam') ||
      fallbackFingerprint.includes('thread')
    ) {
      return STITCH_LINE_COLOR
    }

    return CUT_LINE_COLOR
  }

  private addSegmentLine(group: THREE.Group, segment: ShapeSegment, pivot: THREE.Vector2 | null, yOffset: number) {
    if (segmentLengthSquared(segment.start, segment.end) <= EPSILON) {
      return
    }

    const offsetX = pivot?.x ?? 0
    const offsetY = pivot?.y ?? 0
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(segment.start.x - offsetX, yOffset + 0.003, segment.start.y - offsetY),
        new THREE.Vector3(segment.end.x - offsetX, yOffset + 0.003, segment.end.y - offsetY),
      ]),
      new THREE.LineBasicMaterial({ color: segment.color }),
    )
    group.add(line)
  }

  private addStitchPoint(group: THREE.Group, point: THREE.Vector2, color: string, pivot: THREE.Vector2 | null, yOffset: number) {
    const offsetX = pivot?.x ?? 0
    const offsetY = pivot?.y ?? 0
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(point.x - offsetX, yOffset + 0.007, point.y - offsetY),
    ])
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color,
        size: 0.025,
        sizeAttenuation: true,
      }),
    )
    group.add(points)
  }

  private createPanelMesh(
    points: THREE.Vector2[],
    material: THREE.MeshStandardMaterial,
    bounds: Bounds2,
    pivot: THREE.Vector2 | null,
    yOffset: number,
    holes?: THREE.Vector2[][],
  ) {
    if (points.length < 3) {
      return null
    }

    const pivotX = pivot?.x ?? 0
    const pivotY = pivot?.y ?? 0
    const width = Math.max(bounds.maxX - bounds.minX, EPSILON)
    const height = Math.max(bounds.maxY - bounds.minY, EPSILON)

    // Use THREE.Shape for proper triangulation (handles concave polygons + holes)
    const shape = new THREE.Shape()
    shape.moveTo(points[0].x - pivotX, points[0].y - pivotY)
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x - pivotX, points[i].y - pivotY)
    }
    shape.closePath()

    if (holes) {
      for (const hole of holes) {
        if (hole.length < 3) continue
        const holePath = new THREE.Path()
        holePath.moveTo(hole[0].x - pivotX, hole[0].y - pivotY)
        for (let i = 1; i < hole.length; i++) {
          holePath.lineTo(hole[i].x - pivotX, hole[i].y - pivotY)
        }
        holePath.closePath()
        shape.holes.push(holePath)
      }
    }

    const shapeGeometry = new THREE.ShapeGeometry(shape)

    // Remap the geometry: ShapeGeometry produces XY plane, we need XZ (y = yOffset)
    const posAttr = shapeGeometry.getAttribute('position')
    const count = posAttr.count
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    for (let i = 0; i < count; i++) {
      const sx = posAttr.getX(i)
      const sy = posAttr.getY(i)
      vertices.push(sx, yOffset, sy)
      normals.push(0, 1, 0)
      // Remap UV based on world bounds
      const worldX = sx + pivotX
      const worldY = sy + pivotY
      uvs.push((worldX - bounds.minX) / width, (worldY - bounds.minY) / height)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(Array.from(shapeGeometry.index?.array ?? []))
    geometry.computeBoundingSphere()

    shapeGeometry.dispose()

    return new THREE.Mesh(geometry, material)
  }

  private addPanelOutline(points: THREE.Vector2[], group: THREE.Group, color: string, pivot: THREE.Vector2 | null, yOffset: number) {
    if (points.length < 2) {
      return
    }

    const offsetX = pivot?.x ?? 0
    const offsetY = pivot?.y ?? 0
    const outlinePoints = points.map((point) => new THREE.Vector3(point.x - offsetX, yOffset + 0.004, point.y - offsetY))
    outlinePoints.push(new THREE.Vector3(points[0].x - offsetX, yOffset + 0.004, points[0].y - offsetY))

    const outline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(outlinePoints),
      new THREE.LineBasicMaterial({ color }),
    )
    group.add(outline)
  }

  private splitSegmentByFold(start: THREE.Vector2, end: THREE.Vector2, foldStart: THREE.Vector2, foldEnd: THREE.Vector2) {
    const sideStart = sideOfLine(start, foldStart, foldEnd)
    const sideEnd = sideOfLine(end, foldStart, foldEnd)
    const onStart = Math.abs(sideStart) <= EPSILON
    const onEnd = Math.abs(sideEnd) <= EPSILON

    if (onStart && onEnd) {
      return {
        positive: [{ start, end }],
        negative: [{ start, end }],
      }
    }

    if ((sideStart >= -EPSILON && sideEnd >= -EPSILON) || (onStart && sideEnd > EPSILON) || (onEnd && sideStart > EPSILON)) {
      return { positive: [{ start, end }], negative: [] as Array<{ start: THREE.Vector2; end: THREE.Vector2 }> }
    }

    if ((sideStart <= EPSILON && sideEnd <= EPSILON) || (onStart && sideEnd < -EPSILON) || (onEnd && sideStart < -EPSILON)) {
      return { positive: [] as Array<{ start: THREE.Vector2; end: THREE.Vector2 }>, negative: [{ start, end }] }
    }

    const intersection = lineIntersectionOnSegment(start, end, sideStart, sideEnd)
    if (!intersection) {
      if (sideStart >= 0) {
        return { positive: [{ start, end }], negative: [] as Array<{ start: THREE.Vector2; end: THREE.Vector2 }> }
      }
      return { positive: [] as Array<{ start: THREE.Vector2; end: THREE.Vector2 }>, negative: [{ start, end }] }
    }

    if (sideStart >= 0) {
      return {
        positive: [{ start, end: intersection }],
        negative: [{ start: intersection, end }],
      }
    }

    return {
      positive: [{ start: intersection, end }],
      negative: [{ start, end: intersection }],
    }
  }

  private buildBoundsFromShapes(shapes: Shape[]) {
    if (shapes.length === 0) {
      return null
    }

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (const shape of shapes) {
      for (const point of sampleShapePoints(shape, shape.type === 'line' ? 1 : 20)) {
        minX = Math.min(minX, point.x)
        maxX = Math.max(maxX, point.x)
        minY = Math.min(minY, point.y)
        maxY = Math.max(maxY, point.y)
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return null
    }

    return { minX, maxX, minY, maxY }
  }

  private buildBoundsFromFoldLines() {
    if (this.foldLines.length === 0) {
      return null
    }

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (const foldLine of this.foldLines) {
      minX = Math.min(minX, foldLine.start.x, foldLine.end.x)
      maxX = Math.max(maxX, foldLine.start.x, foldLine.end.x)
      minY = Math.min(minY, foldLine.start.y, foldLine.end.y)
      maxY = Math.max(maxY, foldLine.start.y, foldLine.end.y)
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return null
    }

    return { minX, maxX, minY, maxY }
  }

  private computeTransform() {
    let bounds = this.buildBoundsFromPieceMeshes()
    if (!bounds) {
      bounds = this.buildBoundsFromShapes(this.shapes)
    }
    if (bounds) {
      bounds = ensureMinSpan(bounds, 80)
    } else {
      const foldBounds = this.buildBoundsFromFoldLines()
      if (foldBounds) {
        bounds = ensureMinSpan(padBounds(foldBounds, 60), 120)
      } else {
        bounds = { minX: -220, maxX: 220, minY: -140, maxY: 140 }
      }
    }

    const width = Math.max(bounds.maxX - bounds.minX, 1)
    const height = Math.max(bounds.maxY - bounds.minY, 1)
    const longest = Math.max(width, height, 1)
    this.transform = {
      scale: 1.65 / longest,
      centerX: (bounds.minX + bounds.maxX) / 2,
      centerY: (bounds.minY + bounds.maxY) / 2,
    }

    return bounds
  }

  private buildShapeSegments(shapes: Shape[], foldStart: THREE.Vector2, foldEnd: THREE.Vector2) {
    const positiveSegments: ShapeSegment[] = []
    const negativeSegments: ShapeSegment[] = []

    for (const shape of shapes) {
      const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 28)
      const color = this.shapeColor(shape)

      for (let index = 0; index < sampled.length - 1; index += 1) {
        const start = this.projectPoint(sampled[index])
        const end = this.projectPoint(sampled[index + 1])
        const split = this.splitSegmentByFold(start, end, foldStart, foldEnd)

        for (const segment of split.positive) {
          if (segmentLengthSquared(segment.start, segment.end) > EPSILON) {
            positiveSegments.push({
              start: segment.start.clone(),
              end: segment.end.clone(),
              color,
            })
          }
        }

        for (const segment of split.negative) {
          if (segmentLengthSquared(segment.start, segment.end) > EPSILON) {
            negativeSegments.push({
              start: segment.start.clone(),
              end: segment.end.clone(),
              color,
            })
          }
        }
      }
    }

    return { positiveSegments, negativeSegments }
  }

  private pieceUsesTexture(piece: PatternPiece) {
    return (
      this.currentAlbedo !== null &&
      [piece.boundaryShapeId, ...piece.internalShapeIds].some((shapeId) => this.texturedShapeIdSet.has(shapeId))
    )
  }

  private addEdgeLabel(group: THREE.Group, text: string, point: THREE.Vector3, color: string) {
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgba(15, 23, 42, 0.85)'
    context.fillRect(6, 8, 148, 48)
    context.strokeStyle = 'rgba(255,255,255,0.2)'
    context.strokeRect(6, 8, 148, 48)
    context.fillStyle = color
    context.font = '28px monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
    const sprite = new THREE.Sprite(material)
    sprite.position.copy(point)
    sprite.scale.set(0.16, 0.064, 1)
    group.add(sprite)
  }

  private addAssembledStitchHoles(group: THREE.Group, piece: PatternPiece, topY: number) {
    const pieceShapeIdSet = new Set([piece.boundaryShapeId, ...piece.internalShapeIds])
    const holes = this.stitchHoles.filter((entry) => pieceShapeIdSet.has(entry.shapeId))
    if (holes.length === 0) {
      return
    }

    const geometry = new THREE.CylinderGeometry(0.006, 0.006, 0.003, 10)
    const material = new THREE.MeshStandardMaterial({
      color: this.threadColor,
      roughness: 0.55,
      metalness: 0.05,
    })
    const instances = new THREE.InstancedMesh(geometry, material, holes.length)
    const matrix = new THREE.Matrix4()

    holes.forEach((hole, index) => {
      const projected = projectPiecePoint(hole.point, this.transform.scale, this.transform.centerX, this.transform.centerY)
      matrix.makeRotationX(Math.PI / 2)
      matrix.setPosition(projected.x, topY + 0.0025, projected.y)
      instances.setMatrixAt(index, matrix)
    })
    instances.instanceMatrix.needsUpdate = true
    group.add(instances)
  }

  private createAssembledPieceGroup(piece: PatternPiece, pieceMesh: PieceMeshData, index: number, total: number) {
    const group = new THREE.Group()
    const pieceShape = createPieceShape(pieceMesh, this.transform.scale, this.transform.centerX, this.transform.centerY)
    const thicknessWorld = Math.max(this.threePreviewSettings.thicknessMm * this.transform.scale, DEFAULT_THICKNESS_WORLD)
    const halfThickness = thicknessWorld / 2
    const usesTexture = this.pieceUsesTexture(piece)
    const frontMaterial = usesTexture ? this.leftTextureMaterial : this.assembledFrontMaterial
    const sideMaterial = this.assembledSideMaterial

    const bodyGeometry = new THREE.ExtrudeGeometry(pieceShape, {
      depth: thicknessWorld,
      bevelEnabled: false,
      steps: 1,
    })
    bodyGeometry.rotateX(-Math.PI / 2)
    bodyGeometry.translate(0, -halfThickness, 0)
    const bodyMesh = new THREE.Mesh(bodyGeometry, [frontMaterial, sideMaterial])
    group.add(bodyMesh)

    const backGeometry = new THREE.ShapeGeometry(pieceShape)
    backGeometry.rotateX(-Math.PI / 2)
    backGeometry.translate(0, -halfThickness - 0.0008, 0)
    const backMesh = new THREE.Mesh(backGeometry, this.assembledBackMaterial)
    group.add(backMesh)

    const outlinePoints = pieceMesh.outer.map((point) => projectPiecePoint(point, this.transform.scale, this.transform.centerX, this.transform.centerY))
    this.addPanelOutline(outlinePoints, group, '#e2e8f0', null, halfThickness + 0.0015)

    if (this.threePreviewSettings.showEdgeLabels) {
      pieceMesh.edges.forEach((edge) => {
        const midpoint = projectPiecePoint(edge.midpoint, this.transform.scale, this.transform.centerX, this.transform.centerY)
        this.addEdgeLabel(group, `${edge.index + 1}`, new THREE.Vector3(midpoint.x, halfThickness + 0.02, midpoint.y), '#f8fafc')
      })
    }

    this.addAssembledStitchHoles(group, piece, halfThickness)

    const placement = this.placementForPiece(piece.id)
    this.applyPlacementTransform(group, placement, index, total)
    group.updateMatrixWorld(true)

    return group
  }

  private edgeMidpointWorld(group: THREE.Group, pieceMesh: PieceMeshData, edgeIndex: number) {
    const edge = pieceMesh.edges[Math.max(0, Math.min(pieceMesh.edges.length - 1, edgeIndex))]
    if (!edge) {
      return null
    }
    const midpoint = projectPiecePoint(edge.midpoint, this.transform.scale, this.transform.centerX, this.transform.centerY)
    const point = new THREE.Vector3(midpoint.x, 0, midpoint.y)
    return point.applyMatrix4(group.matrixWorld)
  }

  private edgeLengthWorld(pieceMesh: PieceMeshData, edgeIndex: number) {
    const edge = pieceMesh.edges[Math.max(0, Math.min(pieceMesh.edges.length - 1, edgeIndex))]
    return edge ? edge.lengthMm * this.transform.scale : 0
  }

  private seamColorForConnection(leftLength: number, rightLength: number, midpointDistance: number) {
    const ratio = Math.abs(leftLength - rightLength) / Math.max(leftLength, rightLength, EPSILON)
    const severity = THREE.MathUtils.clamp(ratio * 1.25 + midpointDistance * 0.9, 0, 1)
    const safe = new THREE.Color('#22c55e')
    const warning = new THREE.Color('#ef4444')
    return safe.lerp(warning, this.threePreviewSettings.showStressOverlay ? severity : 0.18)
  }

  private addSeamGuide(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: THREE.Color,
    dashed: boolean,
  ) {
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.04, gapSize: 0.025 })
      : new THREE.LineBasicMaterial({ color })
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([from, to]),
      material,
    )
    if (line instanceof THREE.Line && 'computeLineDistances' in line) {
      line.computeLineDistances()
    }
    this.assembledGroup.add(line)
  }

  private rebuildAssembledModel() {
    this.clearAssembledGroups()
    clearGroup(this.staticSideGroup, this.preservedMaterials)
    clearGroup(this.foldingSideGroup, this.preservedMaterials)
    clearGroup(this.foldGuideGroup, this.preservedMaterials)
    this.staticPanels = []
    this.foldingPanels = []
    this.staticPanelBoxes = []

    const pieces = this.patternPieces.filter((piece) => this.layers.some((layer) => layer.id === piece.layerId && layer.visible))
    if (pieces.length === 0) {
      this.fitControlsToModel()
      return
    }

    const pieceMeshById = new Map(this.pieceMeshes.map((piece) => [piece.pieceId, piece]))
    const pieceGroupById = new Map<string, THREE.Group>()

    pieces.forEach((piece, index) => {
      const pieceMesh = pieceMeshById.get(piece.id)
      if (!pieceMesh) {
        return
      }
      const group = this.createAssembledPieceGroup(piece, pieceMesh, index, pieces.length)
      pieceGroupById.set(piece.id, group)
      this.assembledGroup.add(group)
    })

    if (this.threePreviewSettings.showSeams) {
      for (const connection of this.seamConnections) {
        const fromGroup = pieceGroupById.get(connection.from.pieceId)
        const toGroup = pieceGroupById.get(connection.to.pieceId)
        const fromPiece = pieceMeshById.get(connection.from.pieceId)
        const toPiece = pieceMeshById.get(connection.to.pieceId)
        if (!fromGroup || !toGroup || !fromPiece || !toPiece) {
          continue
        }

        const fromMid = this.edgeMidpointWorld(fromGroup, fromPiece, connection.from.edgeIndex)
        const toMid = this.edgeMidpointWorld(toGroup, toPiece, connection.to.edgeIndex)
        if (!fromMid || !toMid) {
          continue
        }
        const color = this.seamColorForConnection(
          this.edgeLengthWorld(fromPiece, connection.from.edgeIndex),
          this.edgeLengthWorld(toPiece, connection.to.edgeIndex),
          fromMid.distanceTo(toMid),
        )
        this.addSeamGuide(fromMid, toMid, color, connection.kind !== 'aligned')
      }
    }

    void this.rebuildAvatarModel()
    this.fitControlsToModel()
  }

  private rebuildModel() {
    const chainsByShapeId = new Map<string, { id: string; shapeIds: string[]; polygon: Point[]; isClosed: true; area: number }>()
    for (const outline of this.outlinePolygons) {
      const chain = {
        id: outline.shapeIds[0] ?? outline.layerId,
        shapeIds: outline.shapeIds,
        polygon: outline.polygon,
        isClosed: true as const,
        area: Math.abs(THREE.ShapeUtils.area(outline.polygon.map((point) => new THREE.Vector2(point.x, point.y)))),
      }
      for (const shapeId of outline.shapeIds) {
        chainsByShapeId.set(shapeId, chain)
      }
    }
    this.pieceMeshes = buildPieceMeshes(this.patternPieces, chainsByShapeId)
    if (this.threePreviewSettings.mode === 'assembled' || this.threePreviewSettings.mode === 'avatar') {
      this.computeTransform()
      this.rebuildAssembledModel()
      return
    }

    this.clearAssembledGroups()
    clearGroup(this.staticSideGroup, this.preservedMaterials)
    clearGroup(this.foldingSideGroup, this.preservedMaterials)
    clearGroup(this.foldGuideGroup, this.preservedMaterials)
    this.staticPanels = []
    this.foldingPanels = []
    this.staticPanelBoxes = []

    const documentBounds = this.computeTransform()
    const documentRectangle = [
      this.projectPoint({ x: documentBounds.minX, y: documentBounds.minY }),
      this.projectPoint({ x: documentBounds.maxX, y: documentBounds.minY }),
      this.projectPoint({ x: documentBounds.maxX, y: documentBounds.maxY }),
      this.projectPoint({ x: documentBounds.minX, y: documentBounds.maxY }),
    ]
    const projectedDocumentBounds = polygonBounds(documentRectangle)

    let foldStart =
      this.foldLines.length > 0
        ? this.projectPoint(this.foldLines[0].start)
        : new THREE.Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.minY)
    let foldEnd =
      this.foldLines.length > 0
        ? this.projectPoint(this.foldLines[0].end)
        : new THREE.Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.maxY)

    if (segmentLengthSquared(foldStart, foldEnd) <= EPSILON) {
      foldStart = new THREE.Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.minY)
      foldEnd = new THREE.Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.maxY)
    }

    const foldMid = foldStart.clone().add(foldEnd).multiplyScalar(0.5)
    this.foldingPivot.position.set(foldMid.x, 0, foldMid.y)
    this.activeFoldMid = foldMid.clone()
    this.activeFoldAxis = this.foldAxisFromLine(foldStart, foldEnd)
    this.activeFoldBehavior = resolveFoldBehavior(this.foldLines[0] ?? null)
    const dynamicLayerStep = Math.max(
      LAYER_STACK_STEP,
      (this.activeFoldBehavior.thicknessMm + this.activeFoldBehavior.clearanceMm * 0.5) * this.transform.scale,
    )

    const layerOrder = this.layers.map((layer) => layer.id)
    const layerStackLevels = new Map<string, number>()
    let maxStackLevel = 0
    for (const [index, layer] of this.layers.entries()) {
      const stackLevel =
        typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel)
          ? Math.max(0, Math.round(layer.stackLevel))
          : index
      layerStackLevels.set(layer.id, stackLevel)
      maxStackLevel = Math.max(maxStackLevel, stackLevel)
    }

    const lineTypeById = new Map(this.lineTypes.map((lineType) => [lineType.id, lineType]))
    const layerPhysicalAnchorId = new Map<string, string>()
    const layerSlices: Array<{ layerId: string; shapes: Shape[]; hasPhysicalGeometry: boolean }> = []
    let currentPhysicalLayerId: string | null = null

    for (const layerId of layerOrder) {
      const layerShapes = this.shapes.filter((shape) => shape.layerId === layerId)
      const hasPhysicalGeometry = layerShapes.some((shape) => isPhysicalCutShape(shape, lineTypeById))
      if (hasPhysicalGeometry) {
        currentPhysicalLayerId = layerId
      }
      layerPhysicalAnchorId.set(layerId, currentPhysicalLayerId ?? layerId)
      if (layerShapes.length > 0) {
        layerSlices.push({ layerId, shapes: layerShapes, hasPhysicalGeometry })
      }
    }

    const orphanShapes = this.shapes.filter((shape) => !layerOrder.includes(shape.layerId))
    if (orphanShapes.length > 0) {
      const hasPhysicalGeometry = orphanShapes.some((shape) => isPhysicalCutShape(shape, lineTypeById))
      layerStackLevels.set('__orphan__', maxStackLevel + 1)
      maxStackLevel += 1
      if (hasPhysicalGeometry) {
        currentPhysicalLayerId = '__orphan__'
      }
      layerPhysicalAnchorId.set('__orphan__', currentPhysicalLayerId ?? '__orphan__')
      layerSlices.push({ layerId: '__orphan__', shapes: orphanShapes, hasPhysicalGeometry })
    }

    if (layerSlices.length === 0 && this.shapes.length > 0) {
      const hasPhysicalGeometry = this.shapes.some((shape) => isPhysicalCutShape(shape, lineTypeById))
      layerStackLevels.set('__all__', maxStackLevel + 1)
      maxStackLevel += 1
      layerPhysicalAnchorId.set('__all__', hasPhysicalGeometry ? '__all__' : currentPhysicalLayerId ?? '__all__')
      layerSlices.push({ layerId: '__all__', shapes: this.shapes, hasPhysicalGeometry })
    }

    let maxYOffset = 0
    for (const [index, layerSlice] of layerSlices.entries()) {
      const physicalAnchorId = layerPhysicalAnchorId.get(layerSlice.layerId) ?? layerSlice.layerId
      const stackLevel = layerStackLevels.get(physicalAnchorId) ?? layerStackLevels.get(layerSlice.layerId) ?? index
      const yOffset = stackLevel * dynamicLayerStep
      maxYOffset = Math.max(maxYOffset, yOffset)
      const hasTexturedShape =
        this.currentAlbedo !== null && layerSlice.shapes.some((shape) => this.texturedShapeIdSet.has(shape.id))
      const staticMaterial = hasTexturedShape ? this.leftTextureMaterial : this.leftMaterial
      const foldingMaterial = hasTexturedShape ? this.rightTextureMaterial : this.rightMaterial

      if (layerSlice.hasPhysicalGeometry) {
        const cutShapes = layerSlice.shapes.filter((shape) => isPhysicalCutShape(shape, lineTypeById))
        const layerOutlines = this.outlinePolygons.filter((outline) => outline.layerId === layerSlice.layerId)
        let panelRegions: Array<{ outer: THREE.Vector2[]; holes: THREE.Vector2[][] }>
        let layerProjectedBounds: Bounds2

        const fallbackLayerBounds = this.buildBoundsFromShapes(cutShapes) ?? this.buildBoundsFromShapes(layerSlice.shapes) ?? documentBounds
        const fallbackLayerArea = Math.max(
          0,
          (fallbackLayerBounds.maxX - fallbackLayerBounds.minX) * (fallbackLayerBounds.maxY - fallbackLayerBounds.minY),
        )
        const outlineRegions = layerOutlines.length > 0 ? buildOutlineRegions(layerOutlines) : []
        const canUseDetectedOutlines = shouldUseOutlineRegions({
          cutShapes,
          layerOutlines,
          outlineRegions,
          fallbackBoundsArea: fallbackLayerArea,
        })
        const physicalLayerRegions = canUseDetectedOutlines
          ? []
          : buildPhysicalLayerRegions({
              layerId: layerSlice.layerId,
              shapes: layerSlice.shapes,
              lineTypeById,
              closedCutOutlines: layerOutlines,
            })

        if (canUseDetectedOutlines) {
          const regions = outlineRegions
          panelRegions = regions.map((region) => ({
            outer: region.outer.polygon.map((point) => this.projectPoint(point)),
            holes: region.holes.map((hole) => hole.polygon.map((point) => this.projectPoint(point))),
          }))
          const allPoints = panelRegions.flatMap((region) => [region.outer, ...region.holes]).flat()
          layerProjectedBounds = polygonBounds(allPoints)
        } else if (physicalLayerRegions.length > 0) {
          panelRegions = physicalLayerRegions.map((region) => ({
            outer: region.outer.map((point) => this.projectPoint(point)),
            holes: region.holes.map((hole) => hole.map((point) => this.projectPoint(point))),
          }))
          const allPoints = panelRegions.flatMap((region) => [region.outer, ...region.holes]).flat()
          layerProjectedBounds = polygonBounds(allPoints)
        } else {
          panelRegions = [{
            outer: [
              this.projectPoint({ x: fallbackLayerBounds.minX, y: fallbackLayerBounds.minY }),
              this.projectPoint({ x: fallbackLayerBounds.maxX, y: fallbackLayerBounds.minY }),
              this.projectPoint({ x: fallbackLayerBounds.maxX, y: fallbackLayerBounds.maxY }),
              this.projectPoint({ x: fallbackLayerBounds.minX, y: fallbackLayerBounds.maxY }),
            ],
            holes: [],
          }]
          layerProjectedBounds = polygonBounds(panelRegions[0].outer)
        }

        for (const panelRegion of panelRegions) {
          const panelPoly = panelRegion.outer
          let positivePolygon = clipPolygonByLine(panelPoly, foldStart, foldEnd, true)
          let negativePolygon = clipPolygonByLine(panelPoly, foldStart, foldEnd, false)
          let positiveHoles = panelRegion.holes
            .map((hole) => clipPolygonByLine(hole, foldStart, foldEnd, true))
            .filter((hole) => hole.length >= 3)
          let negativeHoles = panelRegion.holes
            .map((hole) => clipPolygonByLine(hole, foldStart, foldEnd, false))
            .filter((hole) => hole.length >= 3)
          if (positivePolygon.length < 3 && negativePolygon.length < 3) {
            positivePolygon = []
            negativePolygon = panelPoly.map((point) => point.clone())
            positiveHoles = []
            negativeHoles = panelRegion.holes.map((hole) => hole.map((point) => point.clone()))
          }

          if (negativePolygon.length >= 3) {
            const staticPanel = this.createPanelMesh(
              negativePolygon,
              staticMaterial,
              layerProjectedBounds,
              null,
              yOffset,
              negativeHoles,
            )
            if (staticPanel) {
              this.staticPanels.push(staticPanel)
              this.staticSideGroup.add(staticPanel)
              this.addPanelOutline(negativePolygon, this.staticSideGroup, '#e2e8f0', null, yOffset)
            }
          }

          if (positivePolygon.length >= 3) {
            const foldingPanel = this.createPanelMesh(
              positivePolygon,
              foldingMaterial,
              layerProjectedBounds,
              foldMid,
              yOffset,
              positiveHoles,
            )
            if (foldingPanel) {
              this.foldingPanels.push(foldingPanel)
              this.foldingSideGroup.add(foldingPanel)
              this.addPanelOutline(positivePolygon, this.foldingSideGroup, '#e2e8f0', foldMid, yOffset)
            }
          }
        }
      }

      const { positiveSegments, negativeSegments } = this.buildShapeSegments(layerSlice.shapes, foldStart, foldEnd)
      for (const segment of negativeSegments) {
        this.addSegmentLine(this.staticSideGroup, segment, null, yOffset)
      }
      for (const segment of positiveSegments) {
        this.addSegmentLine(this.foldingSideGroup, segment, foldMid, yOffset)
      }

      const layerShapeIds = new Set(layerSlice.shapes.map((shape) => shape.id))
      const layerStitchHoles = this.stitchHoles.filter((stitchHole) => layerShapeIds.has(stitchHole.shapeId))
      const stitchHolesByShape = new Map<string, StitchHole[]>()
      for (const stitchHole of layerStitchHoles) {
        const entries = stitchHolesByShape.get(stitchHole.shapeId) ?? []
        entries.push(stitchHole)
        stitchHolesByShape.set(stitchHole.shapeId, entries)
      }

      for (const stitchHolesOnShape of stitchHolesByShape.values()) {
        const ordered = stitchHolesOnShape
          .slice()
          .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))

        const projectedPoints = ordered.map((stitchHole) => this.projectPoint(stitchHole.point))
        for (const projectedPoint of projectedPoints) {
          if (sideOfLine(projectedPoint, foldStart, foldEnd) > -EPSILON) {
            this.addStitchPoint(this.foldingSideGroup, projectedPoint, this.threadColor, foldMid, yOffset)
          } else {
            this.addStitchPoint(this.staticSideGroup, projectedPoint, this.threadColor, null, yOffset)
          }
        }

        for (let index = 1; index < projectedPoints.length; index += 1) {
          const split = this.splitSegmentByFold(projectedPoints[index - 1], projectedPoints[index], foldStart, foldEnd)
          for (const segment of split.negative) {
            this.addSegmentLine(
              this.staticSideGroup,
              {
                start: segment.start,
                end: segment.end,
                color: this.threadColor,
              },
              null,
              yOffset + 0.0015,
            )
          }
          for (const segment of split.positive) {
            this.addSegmentLine(
              this.foldingSideGroup,
              {
                start: segment.start,
                end: segment.end,
                color: this.threadColor,
              },
              foldMid,
              yOffset + 0.0015,
            )
          }
        }
      }
    }

    const guideYOffset = maxYOffset + 0.006
    for (const foldLine of this.foldLines) {
      const projectedStart = this.projectPoint(foldLine.start)
      const projectedEnd = this.projectPoint(foldLine.end)
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(projectedStart.x, guideYOffset, projectedStart.y),
          new THREE.Vector3(projectedEnd.x, guideYOffset, projectedEnd.y),
        ]),
        new THREE.LineDashedMaterial({
          color: FOLD_LINE_COLOR,
          dashSize: 0.06,
          gapSize: 0.035,
        }),
      )
      line.computeLineDistances()
      this.foldGuideGroup.add(line)
    }

    this.rebuildStaticPanelBoxCache()
    this.updateFoldRotation()
  }

  private animate = () => {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.frameId = requestAnimationFrame(this.animate)
  }

  private applyTextureMaps(albedo: THREE.Texture | null, normal: THREE.Texture | null, roughness: THREE.Texture | null) {
    if (this.currentAlbedo && this.currentAlbedo !== albedo) {
      this.currentAlbedo.dispose()
    }
    if (this.currentNormal && this.currentNormal !== normal) {
      this.currentNormal.dispose()
    }
    if (this.currentRoughness && this.currentRoughness !== roughness) {
      this.currentRoughness.dispose()
    }

    this.currentAlbedo = albedo
    this.currentNormal = normal
    this.currentRoughness = roughness

    for (const material of [
      this.leftTextureMaterial,
      this.rightTextureMaterial,
      this.assembledFrontMaterial,
      this.assembledSideMaterial,
    ]) {
      material.map = albedo
      material.normalMap = normal
      material.roughnessMap = roughness
      material.needsUpdate = true
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
    this.activeFoldBehavior = resolveFoldBehavior(this.foldLines[0] ?? null)
    this.activeFoldAngleDeg = this.activeFoldBehavior.targetAngleDeg
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
    this.activeFoldBehavior = resolveFoldBehavior(this.foldLines[0] ?? null)
    this.activeFoldAngleDeg = this.activeFoldBehavior.targetAngleDeg
    this.rebuildModel()
  }

  setFoldAngle(angleDeg: number) {
    const behavior = this.resolvePrimaryFoldBehavior()
    this.activeFoldAngleDeg = THREE.MathUtils.clamp(angleDeg, -behavior.maxAngleDeg, behavior.maxAngleDeg)
    this.updateFoldRotation()
  }

  setTheme(themeMode: 'dark' | 'light') {
    this.themeMode = themeMode

    if (this.themeMode === 'light') {
      this.scene.background = new THREE.Color('#eef4ff')
      this.ambientLight.intensity = 0.6
      this.keyLight.color.set('#ffffff')
      this.keyLight.intensity = 0.82
      this.rimLight.color.set('#93c5fd')
      this.rimLight.intensity = 0.22
    } else {
      this.scene.background = new THREE.Color('#0a1220')
      this.ambientLight.intensity = 0.55
      this.keyLight.color.set('#dbeafe')
      this.keyLight.intensity = 0.9
      this.rimLight.color.set('#93c5fd')
      this.rimLight.intensity = 0.35
    }

    const gridMaterials = Array.isArray(this.grid.material) ? this.grid.material : [this.grid.material]
    for (const [index, material] of gridMaterials.entries()) {
      if (!(material instanceof THREE.LineBasicMaterial)) {
        continue
      }

      material.color.set(
        this.themeMode === 'light'
          ? index === 0
            ? '#b7c5dc'
            : '#d8e0ee'
          : index === 0
            ? '#334155'
            : '#1e293b',
      )
      material.needsUpdate = true
    }
  }

  async setTexture(texture: TextureSource) {
    const albedo = await loadTexture(this.textureLoader, texture.albedoUrl)
    albedo.colorSpace = THREE.SRGBColorSpace
    albedo.wrapS = THREE.RepeatWrapping
    albedo.wrapT = THREE.RepeatWrapping

    let normal: THREE.Texture | null = null
    let roughness: THREE.Texture | null = null

    if (texture.normalUrl && texture.normalUrl.trim().length > 0) {
      normal = await loadTexture(this.textureLoader, texture.normalUrl)
      normal.wrapS = THREE.RepeatWrapping
      normal.wrapT = THREE.RepeatWrapping
    }

    if (texture.roughnessUrl && texture.roughnessUrl.trim().length > 0) {
      roughness = await loadTexture(this.textureLoader, texture.roughnessUrl)
      roughness.wrapS = THREE.RepeatWrapping
      roughness.wrapT = THREE.RepeatWrapping
    }

    this.applyTextureMaps(albedo, normal, roughness)
    this.rebuildModel()
  }

  useDefaultTexture() {
    this.texturedShapeIdSet.clear()
    this.applyTextureMaps(null, null, null)
    this.rebuildModel()
  }

  setTextureAssignments(shapeIds: string[]) {
    const shapeIdSet = new Set(this.shapes.map((shape) => shape.id))
    this.texturedShapeIdSet = new Set(shapeIds.filter((shapeId) => shapeIdSet.has(shapeId)))
    this.rebuildModel()
  }

  setThreadColor(color: string) {
    if (typeof color !== 'string' || color.trim().length === 0) {
      return
    }
    this.threadColor = color
    this.rebuildModel()
  }

  /**
   * Applies a leather material preset to the 3D model.
   */
  applyLeatherPreset(presetId: string) {
    const preset = LEATHER_PRESETS[presetId]
    if (!preset) return

    const materials = [
      this.leftMaterial,
      this.rightMaterial,
      this.leftTextureMaterial,
      this.rightTextureMaterial,
      this.assembledFrontMaterial,
      this.assembledBackMaterial,
      this.assembledSideMaterial,
    ]

    for (const mat of materials) {
      mat.color.set(preset.color)
      mat.roughness = preset.roughness
      mat.metalness = preset.metalness
      if (mat.normalMap) {
        mat.normalScale.set(preset.normalScale, preset.normalScale)
      }
      mat.envMapIntensity = preset.envMapIntensity
      mat.needsUpdate = true
    }

    this.rebuildModel()
  }

  /**
   * Sets the leather color without changing other material properties.
   */
  setLeatherColor(color: string) {
    if (typeof color !== 'string' || color.trim().length === 0) return

    const materials = [
      this.leftMaterial,
      this.rightMaterial,
      this.leftTextureMaterial,
      this.rightTextureMaterial,
      this.assembledFrontMaterial,
      this.assembledBackMaterial,
      this.assembledSideMaterial,
    ]

    for (const mat of materials) {
      mat.color.set(color)
      mat.needsUpdate = true
    }
  }

  /**
   * Enables shadow casting from the key light.
   */
  enableShadows(enabled: boolean) {
    this.renderer.shadowMap.enabled = enabled
    if (enabled) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
      this.keyLight.castShadow = true
      this.keyLight.shadow.mapSize.width = 1024
      this.keyLight.shadow.mapSize.height = 1024
      this.keyLight.shadow.camera.near = 0.1
      this.keyLight.shadow.camera.far = 10
    } else {
      this.keyLight.castShadow = false
    }
  }

  resize(width: number, height: number) {
    const safeWidth = Math.max(width, 1)
    const safeHeight = Math.max(height, 1)

    this.renderer.setSize(safeWidth, safeHeight, false)
    this.camera.aspect = safeWidth / safeHeight
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
    this.avatarLoadVersion += 1

    clearGroup(this.staticSideGroup, this.preservedMaterials)
    clearGroup(this.foldingSideGroup, this.preservedMaterials)
    clearGroup(this.foldGuideGroup, this.preservedMaterials)
    clearGroup(this.assembledGroup, this.preservedMaterials)
    clearGroup(this.avatarGroup, this.preservedMaterials)

    this.applyTextureMaps(null, null, null)
    this.controls.dispose()
    this.leftMaterial.dispose()
    this.rightMaterial.dispose()
    this.leftTextureMaterial.dispose()
    this.rightTextureMaterial.dispose()
    this.assembledFrontMaterial.dispose()
    this.assembledBackMaterial.dispose()
    this.assembledSideMaterial.dispose()
    this.renderer.dispose()
  }
}
