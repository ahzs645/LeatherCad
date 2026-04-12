import {
  DoubleSide,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import type { Shape, TextureSource } from '../cad/cad-types'
import { LEATHER_PRESETS } from './material-presets'
import { loadTexture } from './bridge/texture-utils'

const DEFAULT_STITCH_THREAD_COLOR = '#fb923c'

export class ThreeMaterialManager {
  readonly leftMaterial = new MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: DoubleSide,
  })

  readonly rightMaterial = new MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: DoubleSide,
  })

  readonly leftTextureMaterial = new MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: DoubleSide,
  })

  readonly rightTextureMaterial = new MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: DoubleSide,
  })

  readonly assembledFrontMaterial = new MeshStandardMaterial({
    color: '#8a6742',
    roughness: 0.88,
    metalness: 0.05,
    side: DoubleSide,
  })

  readonly assembledBackMaterial = new MeshStandardMaterial({
    color: '#5b4227',
    roughness: 0.92,
    metalness: 0.02,
    side: DoubleSide,
  })

  readonly assembledSideMaterial = new MeshStandardMaterial({
    color: '#6f5030',
    roughness: 0.9,
    metalness: 0.03,
    side: DoubleSide,
  })

  readonly preservedMaterials = new Set([
    this.leftMaterial,
    this.rightMaterial,
    this.leftTextureMaterial,
    this.rightTextureMaterial,
    this.assembledFrontMaterial,
    this.assembledBackMaterial,
    this.assembledSideMaterial,
  ])

  readonly textureLoader = new TextureLoader()
  currentAlbedo: Texture | null = null
  currentNormal: Texture | null = null
  currentRoughness: Texture | null = null
  texturedShapeIdSet = new Set<string>()
  threadColor = DEFAULT_STITCH_THREAD_COLOR

  constructor() {
    this.textureLoader.crossOrigin = 'anonymous'
  }

  applyTextureMaps(albedo: Texture | null, normal: Texture | null, roughness: Texture | null) {
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

  async setTexture(texture: TextureSource) {
    const albedo = await loadTexture(this.textureLoader, texture.albedoUrl)
    albedo.colorSpace = SRGBColorSpace
    albedo.wrapS = RepeatWrapping
    albedo.wrapT = RepeatWrapping

    let normal: Texture | null = null
    let roughness: Texture | null = null

    if (texture.normalUrl && texture.normalUrl.trim().length > 0) {
      normal = await loadTexture(this.textureLoader, texture.normalUrl)
      normal.wrapS = RepeatWrapping
      normal.wrapT = RepeatWrapping
    }

    if (texture.roughnessUrl && texture.roughnessUrl.trim().length > 0) {
      roughness = await loadTexture(this.textureLoader, texture.roughnessUrl)
      roughness.wrapS = RepeatWrapping
      roughness.wrapT = RepeatWrapping
    }

    this.applyTextureMaps(albedo, normal, roughness)
  }

  useDefaultTexture() {
    this.texturedShapeIdSet.clear()
    this.applyTextureMaps(null, null, null)
  }

  setTextureAssignments(shapeIds: string[], shapes: Shape[]) {
    const shapeIdSet = new Set(shapes.map((shape) => shape.id))
    this.texturedShapeIdSet = new Set(shapeIds.filter((shapeId) => shapeIdSet.has(shapeId)))
  }

  applyLeatherPreset(presetId: string) {
    const preset = LEATHER_PRESETS[presetId]
    if (!preset) return

    for (const mat of [
      this.leftMaterial,
      this.rightMaterial,
      this.leftTextureMaterial,
      this.rightTextureMaterial,
      this.assembledFrontMaterial,
      this.assembledBackMaterial,
      this.assembledSideMaterial,
    ]) {
      mat.color.set(preset.color)
      mat.roughness = preset.roughness
      mat.metalness = preset.metalness
      if (mat.normalMap) {
        mat.normalScale.set(preset.normalScale, preset.normalScale)
      }
      mat.envMapIntensity = preset.envMapIntensity
      mat.needsUpdate = true
    }
  }

  setLeatherColor(color: string) {
    if (typeof color !== 'string' || color.trim().length === 0) return

    for (const mat of [
      this.leftMaterial,
      this.rightMaterial,
      this.leftTextureMaterial,
      this.rightTextureMaterial,
      this.assembledFrontMaterial,
      this.assembledBackMaterial,
      this.assembledSideMaterial,
    ]) {
      mat.color.set(color)
      mat.needsUpdate = true
    }
  }

  dispose() {
    this.applyTextureMaps(null, null, null)
    this.leftMaterial.dispose()
    this.rightMaterial.dispose()
    this.leftTextureMaterial.dispose()
    this.rightTextureMaterial.dispose()
    this.assembledFrontMaterial.dispose()
    this.assembledBackMaterial.dispose()
    this.assembledSideMaterial.dispose()
  }
}
