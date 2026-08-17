/**
 * @atelier/viewport-backed runtime for the 3D preview — the engine that also
 * drives Seamer Studio's drape view. The engine owns the renderer, camera rig,
 * post pipeline (GTAO + SMAA), shadow lifecycle, and disposal; this file keeps
 * LeatherCad's bench-specific pieces: the camera fit modes for flat pattern
 * work, the four-view review collage, and the themed stage.
 *
 * Replaces the hand-rolled ThreeRuntimeManager.
 */

import { Box3, Group, PerspectiveCamera, Vector3, WebGLRenderer, type WebGLRendererParameters } from 'three'
import { Viewport } from '@atelier/viewport'
import { LeatherStage, type StageThemeMode } from './leather-stage'

type Bounds3 = {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

export type CameraFitMode = 'orbit' | 'pattern' | 'top' | 'front' | 'side'

export class EngineRuntime {
  readonly viewport: Viewport
  readonly stage: LeatherStage
  private releaseRenderLease: (() => void) | null = null
  private readonly canvas: HTMLCanvasElement
  private readonly container: HTMLElement

  constructor(canvas: HTMLCanvasElement) {
    const container = canvas.parentElement
    if (!container) {
      throw new Error('EngineRuntime requires the preview canvas to be mounted before construction')
    }
    this.canvas = canvas
    this.container = container

    this.viewport = new Viewport({
      container,
      // Bind the engine to the canvas the React panel already owns instead of
      // letting it append a second one.
      rendererFactory: (parameters: WebGLRendererParameters) =>
        new WebGLRenderer({ ...parameters, canvas, alpha: false }),
    })

    // The model builders mutate the scene graph directly and material/texture
    // loads land asynchronously, so hold the render loop open the way the old
    // requestAnimationFrame runtime did. Moving to invalidation-driven frames
    // is a later optimization once every mutation path notifies the viewport.
    this.releaseRenderLease = this.viewport.acquireRenderLease('leathercad-preview')

    const controls = this.viewport.camera.controls
    controls.dampingFactor = 0.07
    controls.panSpeed = 0.65
    controls.rotateSpeed = 0.8
    controls.zoomSpeed = 0.9
    controls.minDistance = 0.7
    controls.maxDistance = 5.5
    controls.target.set(0, 0.22, 0)
    this.camera.position.set(0, 1.2, 2.4)
    this.camera.lookAt(0, 0, 0)
    controls.update()

    // Ambient occlusion is what makes stitch holes, skived edges, and layered
    // panels read as depth instead of decals.
    this.viewport.post.apply({
      ao: { enabled: true, intensity: 0.85, radius: 0.4 },
      smaa: true,
    })

    this.stage = new LeatherStage(this.viewport)
  }

  get scene() {
    return this.viewport.scene
  }

  get renderer() {
    return this.viewport.renderer
  }

  get camera() {
    return this.viewport.camera.camera
  }

  get controls() {
    return this.viewport.camera.controls
  }

  invalidate() {
    this.viewport.invalidate()
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

  private get perspectiveCamera(): PerspectiveCamera | null {
    const camera = this.camera
    return camera instanceof PerspectiveCamera ? camera : null
  }

  fitControlsToModel(modelRoot: Group, mode: CameraFitMode = 'orbit') {
    const camera = this.perspectiveCamera
    if (!camera) {
      return
    }
    const controls = this.controls
    modelRoot.updateMatrixWorld(true)
    const bounds = this.buildModelBounds3(modelRoot)
    if (!bounds) {
      controls.target.set(0, 0.18, 0)
      controls.update()
      this.invalidate()
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

    controls.target.copy(center)
    controls.minDistance = Math.max(0.3, radius * 0.4)
    controls.maxDistance = Math.max(5.5, radius * 8)
    if (mode === 'pattern' || mode === 'top') {
      const aspect = Math.max(camera.aspect, 0.1)
      const verticalSpan = Math.max(size.z, 0.8)
      const horizontalSpan = Math.max(size.x / aspect, 0.8)
      const fitSpan = Math.max(verticalSpan, horizontalSpan)
      const distance = Math.max(1.2, (fitSpan * 0.62) / Math.tan((camera.fov * Math.PI) / 360))
      camera.up.set(0, 0, -1)
      camera.position.set(center.x, center.y + distance, center.z + 0.0001)
    } else if (mode === 'front') {
      camera.up.set(0, 1, 0)
      camera.position.set(center.x, center.y + radius * 0.15, center.z + radius * 2.2)
    } else if (mode === 'side') {
      camera.up.set(0, 1, 0)
      camera.position.set(center.x + radius * 2.2, center.y + radius * 0.15, center.z)
    } else {
      camera.up.set(0, 1, 0)
      camera.position.set(center.x + radius * 0.95, center.y + radius * 1.15, center.z + radius * 1.3)
    }
    camera.lookAt(center)
    controls.update()
    this.invalidate()
  }

  captureModelReviewCollage(modelRoot: Group) {
    const camera = this.perspectiveCamera
    const renderer = this.renderer
    const controls = this.controls
    if (!camera) {
      return renderer.domElement.toDataURL('image/png')
    }
    modelRoot.updateMatrixWorld(true)
    const bounds = this.buildModelBounds3(modelRoot)
    if (!bounds) {
      return renderer.domElement.toDataURL('image/png')
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
    const originalPosition = camera.position.clone()
    const originalUp = camera.up.clone()
    const originalTarget = controls.target.clone()
    const sourceCanvas = renderer.domElement
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
      camera.up.copy(view.up)
      camera.position.copy(view.position)
      camera.lookAt(center)
      controls.target.copy(center)
      controls.update()
      renderer.render(this.scene, camera)
      const x = (index % 2) * tileWidth
      const y = Math.floor(index / 2) * tileHeight
      context.drawImage(sourceCanvas, x, y, tileWidth, tileHeight)
      context.fillStyle = 'rgba(15, 23, 42, 0.74)'
      context.fillRect(x + 16, y + 16, 88, 34)
      context.fillStyle = '#f8fafc'
      context.font = 'bold 20px sans-serif'
      context.fillText(view.label, x + 28, y + 39)
    }

    camera.position.copy(originalPosition)
    camera.up.copy(originalUp)
    controls.target.copy(originalTarget)
    camera.lookAt(originalTarget)
    controls.update()
    this.invalidate()
    return collage.toDataURL('image/png')
  }

  setTheme(themeMode: StageThemeMode) {
    this.stage.setTheme(themeMode)
  }

  enableShadows(enabled: boolean) {
    this.viewport.lighting.setShadows(enabled)
    this.invalidate()
  }

  resize() {
    this.viewport.resize()
  }

  dispose() {
    this.releaseRenderLease?.()
    this.releaseRenderLease = null
    this.stage.dispose()
    this.viewport.dispose()
    // Viewport.dispose() detaches its canvas from the container, but this
    // canvas belongs to React — put it back so the unmount can remove it.
    if (this.canvas.parentElement !== this.container) {
      this.container.appendChild(this.canvas)
    }
  }
}
