import * as THREE from 'three'
import { getBounds, sampleShapePoints } from './cad-geometry'
import type { FoldLine, Shape, TextureSource } from './cad-types'

type ModelTransform = {
  scale: number
  centerX: number
  centerY: number
}

function clearGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0]
    group.remove(child)

    if ('geometry' in child && child.geometry instanceof THREE.BufferGeometry) {
      child.geometry.dispose()
    }

    if ('material' in child) {
      const material = child.material
      if (Array.isArray(material)) {
        for (const entry of material) {
          entry.dispose()
        }
      } else if (material instanceof THREE.Material) {
        material.dispose()
      }
    }
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

export class ThreeBridge {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private frameId: number | null = null
  private patternGroup = new THREE.Group()
  private foldGroup = new THREE.Group()
  private walletGroup = new THREE.Group()
  private rightFlapPivot = new THREE.Group()
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
  private transform: ModelTransform = {
    scale: 1,
    centerX: 0,
    centerY: 0,
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.textureLoader.crossOrigin = 'anonymous'

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

    this.setupLights()
    this.setupSceneHelpers()
    this.setupWalletProxy()

    this.patternGroup.position.set(0, 0.6, 0)
    this.foldGroup.position.copy(this.patternGroup.position)

    this.scene.add(this.patternGroup)
    this.scene.add(this.foldGroup)
    this.scene.add(this.walletGroup)

    this.animate()
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight('#ffffff', 0.55)
    const key = new THREE.DirectionalLight('#dbeafe', 0.9)
    key.position.set(1.2, 2.2, 1.4)
    const rim = new THREE.DirectionalLight('#93c5fd', 0.35)
    rim.position.set(-1.4, 1.2, -1.4)

    this.scene.add(ambient)
    this.scene.add(key)
    this.scene.add(rim)
  }

  private setupSceneHelpers() {
    const grid = new THREE.GridHelper(4.2, 14, '#334155', '#1e293b')
    grid.position.y = -0.35
    this.scene.add(grid)

    const stand = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.4),
      new THREE.MeshStandardMaterial({
        color: '#172554',
        roughness: 0.96,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
    )
    stand.rotation.x = -Math.PI / 2
    stand.position.y = 0.58
    this.scene.add(stand)
  }

  private setupWalletProxy() {
    this.walletGroup.position.set(0, -0.08, 0.1)
    this.walletGroup.rotation.x = -0.7

    const leftPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.15), this.leftMaterial)
    leftPanel.position.x = -0.475

    const rightPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.15), this.rightMaterial)
    rightPanel.position.x = 0.475

    this.rightFlapPivot.add(rightPanel)

    const seam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.6, 0.001),
        new THREE.Vector3(0, 0.6, 0.001),
      ]),
      new THREE.LineBasicMaterial({ color: '#f97316' }),
    )

    this.walletGroup.add(leftPanel)
    this.walletGroup.add(this.rightFlapPivot)
    this.walletGroup.add(seam)
  }

  private projectPoint(x: number, y: number) {
    return new THREE.Vector3(
      (x - this.transform.centerX) * this.transform.scale,
      0.01,
      -(y - this.transform.centerY) * this.transform.scale,
    )
  }

  private animate = () => {
    this.renderer.render(this.scene, this.camera)
    this.frameId = requestAnimationFrame(this.animate)
  }

  setShapes(shapes: Shape[]) {
    clearGroup(this.patternGroup)

    const bounds = getBounds(shapes)
    const longest = Math.max(bounds.width, bounds.height, 1)

    this.transform = {
      scale: 1.65 / longest,
      centerX: bounds.minX + bounds.width / 2,
      centerY: bounds.minY + bounds.height / 2,
    }

    for (const shape of shapes) {
      const sampled = sampleShapePoints(shape)
      const points = sampled.map((point) => this.projectPoint(point.x, point.y))
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({ color: '#38bdf8' })
      const line = new THREE.Line(geometry, material)
      this.patternGroup.add(line)
    }
  }

  setFoldLines(foldLines: FoldLine[]) {
    clearGroup(this.foldGroup)

    for (const foldLine of foldLines) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          this.projectPoint(foldLine.start.x, foldLine.start.y),
          this.projectPoint(foldLine.end.x, foldLine.end.y),
        ]),
        new THREE.LineDashedMaterial({
          color: '#ef4444',
          dashSize: 0.06,
          gapSize: 0.035,
        }),
      )
      line.computeLineDistances()
      this.foldGroup.add(line)
    }

    if (foldLines.length > 0) {
      this.setFoldAngle(foldLines[0].angleDeg)
    }
  }

  setFoldAngle(angleDeg: number) {
    const clamped = THREE.MathUtils.clamp(angleDeg, 0, 180)
    this.rightFlapPivot.rotation.y = -THREE.MathUtils.degToRad(clamped)
  }

  async setTexture(texture: TextureSource) {
    const albedo = await loadTexture(this.textureLoader, texture.albedoUrl)
    albedo.colorSpace = THREE.SRGBColorSpace

    let normal: THREE.Texture | null = null
    let roughness: THREE.Texture | null = null

    if (texture.normalUrl && texture.normalUrl.trim().length > 0) {
      normal = await loadTexture(this.textureLoader, texture.normalUrl)
    }

    if (texture.roughnessUrl && texture.roughnessUrl.trim().length > 0) {
      roughness = await loadTexture(this.textureLoader, texture.roughnessUrl)
    }

    this.leftMaterial.map = albedo
    this.rightMaterial.map = albedo
    this.leftMaterial.normalMap = normal
    this.rightMaterial.normalMap = normal
    this.leftMaterial.roughnessMap = roughness
    this.rightMaterial.roughnessMap = roughness

    this.leftMaterial.needsUpdate = true
    this.rightMaterial.needsUpdate = true
  }

  useDefaultTexture() {
    this.leftMaterial.map = null
    this.rightMaterial.map = null
    this.leftMaterial.normalMap = null
    this.rightMaterial.normalMap = null
    this.leftMaterial.roughnessMap = null
    this.rightMaterial.roughnessMap = null

    this.leftMaterial.needsUpdate = true
    this.rightMaterial.needsUpdate = true
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

    clearGroup(this.patternGroup)
    clearGroup(this.foldGroup)

    this.leftMaterial.dispose()
    this.rightMaterial.dispose()
    this.renderer.dispose()
  }
}
