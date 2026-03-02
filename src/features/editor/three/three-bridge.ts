import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { sampleShapePoints } from '../cad/cad-geometry'
import type { FoldLine, Layer, LineType, Shape, StitchHole, TextureSource } from '../cad/cad-types'
import { foldDirectionSign, resolveFoldBehavior, type ResolvedFoldBehavior } from '../ops/fold-line-ops'

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

const EPSILON = 1e-6
const CUT_LINE_COLOR = '#38bdf8'
const STITCH_LINE_COLOR = '#f97316'
const FOLD_LINE_COLOR = '#fb7185'
const STITCH_THREAD_COLOR = '#fb923c'
const LAYER_STACK_STEP = 0.012
const COLLISION_SEARCH_STEP_DEG = 1
const MIN_OVERLAP_AREA_WORLD = 0.00002
const MIN_OVERLAP_HEIGHT_WORLD = 0.00045

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
      (error: unknown) => reject(error),
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

  private textureLoader = new THREE.TextureLoader()
  private currentAlbedo: THREE.Texture | null = null
  private currentNormal: THREE.Texture | null = null
  private currentRoughness: THREE.Texture | null = null

  private layers: Layer[] = []
  private lineTypes: LineType[] = []
  private shapes: Shape[] = []
  private foldLines: FoldLine[] = []
  private stitchHoles: StitchHole[] = []
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
    this.preservedMaterials = new Set([this.leftMaterial, this.rightMaterial])

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

  private projectPoint(point: { x: number; y: number }) {
    return new THREE.Vector2(
      (point.x - this.transform.centerX) * this.transform.scale,
      -(point.y - this.transform.centerY) * this.transform.scale,
    )
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
    const radians = THREE.MathUtils.degToRad(angleDeg)
    const thicknessWorld = behavior.thicknessMm * this.transform.scale
    const clearanceWorld = behavior.clearanceMm * this.transform.scale
    const radiusWorld = behavior.radiusMm * this.transform.scale
    const neutralAxisAdjustment = (behavior.neutralAxisRatio - 0.5) * thicknessWorld * Math.sin(radians)
    const hingeLift = (thicknessWorld + clearanceWorld) * Math.sin(radians / 2)
    const curvatureLift = radiusWorld * (1 - Math.cos(radians))
    return (hingeLift + curvatureLift + neutralAxisAdjustment) * foldDirectionSign(behavior.direction)
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
    const clampedTarget = THREE.MathUtils.clamp(targetAngleDeg, 0, behavior.maxAngleDeg)
    if (clampedTarget <= EPSILON || this.staticPanels.length === 0 || this.foldingPanels.length === 0) {
      return clampedTarget
    }

    for (let candidate = clampedTarget; candidate >= 0; candidate -= COLLISION_SEARCH_STEP_DEG) {
      this.applyFoldTransform(candidate, behavior)
      if (!this.hasPanelCollision(behavior)) {
        return candidate
      }
    }

    return 0
  }

  private updateFoldRotation() {
    const behavior = this.resolvePrimaryFoldBehavior()
    const targetAngle = THREE.MathUtils.clamp(this.activeFoldAngleDeg, 0, behavior.maxAngleDeg)
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
  ) {
    if (points.length < 3) {
      return null
    }

    const pivotX = pivot?.x ?? 0
    const pivotY = pivot?.y ?? 0
    const width = Math.max(bounds.maxX - bounds.minX, EPSILON)
    const height = Math.max(bounds.maxY - bounds.minY, EPSILON)

    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    for (const point of points) {
      vertices.push(point.x - pivotX, yOffset, point.y - pivotY)
      normals.push(0, 1, 0)
      uvs.push((point.x - bounds.minX) / width, (point.y - bounds.minY) / height)
    }

    const indices: number[] = []
    for (let index = 1; index < points.length - 1; index += 1) {
      indices.push(0, index, index + 1)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()

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
    let bounds = this.buildBoundsFromShapes(this.shapes)
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

  private rebuildModel() {
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

    const layerSlices: Array<{ layerId: string; shapes: Shape[] }> = []

    for (const layerId of layerOrder) {
      const layerShapes = this.shapes.filter((shape) => shape.layerId === layerId)
      if (layerShapes.length > 0) {
        layerSlices.push({ layerId, shapes: layerShapes })
      }
    }

    const orphanShapes = this.shapes.filter((shape) => !layerOrder.includes(shape.layerId))
    if (orphanShapes.length > 0) {
      layerStackLevels.set('__orphan__', maxStackLevel + 1)
      maxStackLevel += 1
      layerSlices.push({ layerId: '__orphan__', shapes: orphanShapes })
    }

    if (layerSlices.length === 0 && this.shapes.length > 0) {
      layerStackLevels.set('__all__', maxStackLevel + 1)
      maxStackLevel += 1
      layerSlices.push({ layerId: '__all__', shapes: this.shapes })
    }

    if (layerSlices.length === 0) {
      layerStackLevels.set('__empty__', 0)
      layerSlices.push({ layerId: '__empty__', shapes: [] })
    }

    let maxYOffset = 0
    for (const [index, layerSlice] of layerSlices.entries()) {
      const layerBounds = this.buildBoundsFromShapes(layerSlice.shapes) ?? documentBounds
      const layerRectangle = [
        this.projectPoint({ x: layerBounds.minX, y: layerBounds.minY }),
        this.projectPoint({ x: layerBounds.maxX, y: layerBounds.minY }),
        this.projectPoint({ x: layerBounds.maxX, y: layerBounds.maxY }),
        this.projectPoint({ x: layerBounds.minX, y: layerBounds.maxY }),
      ]
      const layerProjectedBounds = polygonBounds(layerRectangle)

      let positivePolygon = clipPolygonByLine(layerRectangle, foldStart, foldEnd, true)
      let negativePolygon = clipPolygonByLine(layerRectangle, foldStart, foldEnd, false)
      if (positivePolygon.length < 3 && negativePolygon.length < 3) {
        positivePolygon = []
        negativePolygon = layerRectangle.map((point) => point.clone())
      }

      const stackLevel = layerStackLevels.get(layerSlice.layerId) ?? index
      const yOffset = stackLevel * dynamicLayerStep
      maxYOffset = Math.max(maxYOffset, yOffset)

      if (negativePolygon.length >= 3) {
        const staticPanel = this.createPanelMesh(negativePolygon, this.leftMaterial, layerProjectedBounds, null, yOffset)
        if (staticPanel) {
          this.staticPanels.push(staticPanel)
          this.staticSideGroup.add(staticPanel)
          this.addPanelOutline(negativePolygon, this.staticSideGroup, '#e2e8f0', null, yOffset)
        }
      }

      if (positivePolygon.length >= 3) {
        const foldingPanel = this.createPanelMesh(positivePolygon, this.rightMaterial, layerProjectedBounds, foldMid, yOffset)
        if (foldingPanel) {
          this.foldingPanels.push(foldingPanel)
          this.foldingSideGroup.add(foldingPanel)
          this.addPanelOutline(positivePolygon, this.foldingSideGroup, '#e2e8f0', foldMid, yOffset)
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
            this.addStitchPoint(this.foldingSideGroup, projectedPoint, STITCH_THREAD_COLOR, foldMid, yOffset)
          } else {
            this.addStitchPoint(this.staticSideGroup, projectedPoint, STITCH_THREAD_COLOR, null, yOffset)
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
                color: STITCH_THREAD_COLOR,
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
                color: STITCH_THREAD_COLOR,
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

    for (const material of [this.leftMaterial, this.rightMaterial]) {
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
  ) {
    this.layers = [...layers]
    this.lineTypes = [...lineTypes]
    this.shapes = [...shapes]
    this.foldLines = [...foldLines]
    this.stitchHoles = [...stitchHoles]
    this.activeFoldBehavior = resolveFoldBehavior(this.foldLines[0] ?? null)
    this.activeFoldAngleDeg = this.activeFoldBehavior.targetAngleDeg
    this.rebuildModel()
  }

  setLayers(layers: Layer[]) {
    this.layers = [...layers]
    this.rebuildModel()
  }

  setShapes(shapes: Shape[]) {
    this.shapes = [...shapes]
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
    this.activeFoldAngleDeg = THREE.MathUtils.clamp(angleDeg, 0, behavior.maxAngleDeg)
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
  }

  useDefaultTexture() {
    this.applyTextureMaps(null, null, null)
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

    clearGroup(this.staticSideGroup, this.preservedMaterials)
    clearGroup(this.foldingSideGroup, this.preservedMaterials)
    clearGroup(this.foldGuideGroup, this.preservedMaterials)

    this.applyTextureMaps(null, null, null)
    this.controls.dispose()
    this.leftMaterial.dispose()
    this.rightMaterial.dispose()
    this.renderer.dispose()
  }
}
