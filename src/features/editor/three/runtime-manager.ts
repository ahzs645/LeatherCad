import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  LineBasicMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type Bounds3 = {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

export type CameraFitMode = 'orbit' | 'pattern'

export class ThreeRuntimeManager {
  readonly renderer: WebGLRenderer
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly controls: OrbitControls
  readonly ambientLight = new AmbientLight('#ffffff', 0.55)
  readonly keyLight = new DirectionalLight('#dbeafe', 0.9)
  readonly rimLight = new DirectionalLight('#93c5fd', 0.35)
  readonly grid = new GridHelper(4.2, 14, '#334155', '#1e293b')
  private frameId: number | null = null
  private themeMode: 'dark' | 'light' = 'dark'

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(Math.max(canvas.clientWidth, 1), Math.max(canvas.clientHeight, 1), false)

    this.scene = new Scene()
    this.scene.background = new Color('#0a1220')

    this.camera = new PerspectiveCamera(50, Math.max(canvas.clientWidth, 1) / Math.max(canvas.clientHeight, 1), 0.01, 100)
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

    this.keyLight.position.set(1.2, 2.2, 1.4)
    this.rimLight.position.set(-1.4, 1.2, -1.4)
    this.grid.position.y = -0.35

    this.scene.add(this.ambientLight)
    this.scene.add(this.keyLight)
    this.scene.add(this.rimLight)
    this.scene.add(this.grid)
    this.setTheme('dark')
  }

  private buildModelBounds3(modelRoot: Group) {
    const box = new Box3().setFromObject(modelRoot)
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

  fitControlsToModel(modelRoot: Group, mode: CameraFitMode = 'orbit') {
    modelRoot.updateMatrixWorld(true)
    const bounds = this.buildModelBounds3(modelRoot)
    if (!bounds) {
      this.controls.target.set(0, 0.18, 0)
      this.controls.update()
      return
    }

    const center = new Vector3(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      (bounds.minZ + bounds.maxZ) / 2,
    )
    const size = new Vector3(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ,
    )
    const radius = Math.max(size.length() * 0.5, 0.6)

    this.controls.target.copy(center)
    this.controls.minDistance = Math.max(0.3, radius * 0.4)
    this.controls.maxDistance = Math.max(5.5, radius * 8)
    if (mode === 'pattern') {
      const aspect = Math.max(this.camera.aspect, 0.1)
      const verticalSpan = Math.max(size.z, 0.8)
      const horizontalSpan = Math.max(size.x / aspect, 0.8)
      const fitSpan = Math.max(verticalSpan, horizontalSpan)
      const distance = Math.max(1.2, (fitSpan * 0.62) / Math.tan((this.camera.fov * Math.PI) / 360))
      this.camera.up.set(0, 0, -1)
      this.camera.position.set(center.x, center.y + distance, center.z + 0.0001)
    } else {
      this.camera.up.set(0, 1, 0)
      this.camera.position.set(center.x + radius * 0.95, center.y + radius * 1.15, center.z + radius * 1.3)
    }
    this.camera.lookAt(center)
    this.controls.update()
  }

  captureModelReviewCollage(modelRoot: Group) {
    modelRoot.updateMatrixWorld(true)
    const bounds = this.buildModelBounds3(modelRoot)
    if (!bounds) {
      return this.renderer.domElement.toDataURL('image/png')
    }

    const center = new Vector3(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      (bounds.minZ + bounds.maxZ) / 2,
    )
    const size = new Vector3(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ,
    )
    const radius = Math.max(size.length() * 0.5, 0.6)
    const originalPosition = this.camera.position.clone()
    const originalUp = this.camera.up.clone()
    const originalTarget = this.controls.target.clone()
    const sourceCanvas = this.renderer.domElement
    const tileWidth = Math.max(sourceCanvas.width, 1)
    const tileHeight = Math.max(sourceCanvas.height, 1)
    const collage = document.createElement('canvas')
    collage.width = tileWidth * 2
    collage.height = tileHeight * 2
    const context = collage.getContext('2d')
    if (!context) {
      return sourceCanvas.toDataURL('image/png')
    }

    const views = [
      { label: 'ISO', position: new Vector3(center.x + radius * 1.2, center.y + radius * 1.1, center.z + radius * 1.35), up: new Vector3(0, 1, 0) },
      { label: 'TOP', position: new Vector3(center.x, center.y + radius * 2.2, center.z + 0.0001), up: new Vector3(0, 0, -1) },
      { label: 'FRONT', position: new Vector3(center.x, center.y + radius * 0.15, center.z + radius * 2.2), up: new Vector3(0, 1, 0) },
      { label: 'SIDE', position: new Vector3(center.x + radius * 2.2, center.y + radius * 0.15, center.z), up: new Vector3(0, 1, 0) },
    ]

    for (const [index, view] of views.entries()) {
      this.camera.up.copy(view.up)
      this.camera.position.copy(view.position)
      this.camera.lookAt(center)
      this.controls.target.copy(center)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      const x = (index % 2) * tileWidth
      const y = Math.floor(index / 2) * tileHeight
      context.drawImage(sourceCanvas, x, y, tileWidth, tileHeight)
      context.fillStyle = 'rgba(15, 23, 42, 0.74)'
      context.fillRect(x + 16, y + 16, 88, 34)
      context.fillStyle = '#f8fafc'
      context.font = 'bold 20px sans-serif'
      context.fillText(view.label, x + 28, y + 39)
    }

    this.camera.position.copy(originalPosition)
    this.camera.up.copy(originalUp)
    this.controls.target.copy(originalTarget)
    this.camera.lookAt(originalTarget)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    return collage.toDataURL('image/png')
  }

  setTheme(themeMode: 'dark' | 'light') {
    this.themeMode = themeMode

    if (this.themeMode === 'light') {
      this.scene.background = new Color('#eef4ff')
      this.ambientLight.intensity = 0.6
      this.keyLight.color.set('#ffffff')
      this.keyLight.intensity = 0.82
      this.rimLight.color.set('#93c5fd')
      this.rimLight.intensity = 0.22
    } else {
      this.scene.background = new Color('#0a1220')
      this.ambientLight.intensity = 0.55
      this.keyLight.color.set('#dbeafe')
      this.keyLight.intensity = 0.9
      this.rimLight.color.set('#93c5fd')
      this.rimLight.intensity = 0.35
    }

    const gridMaterials = Array.isArray(this.grid.material) ? this.grid.material : [this.grid.material]
    for (const [index, material] of gridMaterials.entries()) {
      if (!(material instanceof LineBasicMaterial)) {
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

  enableShadows(enabled: boolean) {
    this.renderer.shadowMap.enabled = enabled
    if (enabled) {
      this.renderer.shadowMap.type = PCFSoftShadowMap
      this.keyLight.castShadow = true
      this.keyLight.shadow.mapSize.width = 1024
      this.keyLight.shadow.mapSize.height = 1024
      this.keyLight.shadow.camera.near = 0.1
      this.keyLight.shadow.camera.far = 10
    } else {
      this.keyLight.castShadow = false
    }
  }

  startAnimation() {
    const animate = () => {
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      this.frameId = requestAnimationFrame(animate)
    }
    animate()
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
    this.controls.dispose()
    this.renderer.dispose()
  }
}
