import { Texture } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TextureSource } from '../cad/cad-types'
import { ThreeMaterialManager } from './material-manager'

const loadTextureMock = vi.fn<(url: string) => Promise<Texture>>()

vi.mock('./bridge/texture-utils', () => ({
  loadTexture: (...args: Parameters<typeof loadTextureMock>) => loadTextureMock(...args),
}))

function createTexture() {
  return new Texture()
}

describe('ThreeMaterialManager', () => {
  beforeEach(() => {
    loadTextureMock.mockReset()
  })

  it('filters texture assignments to existing shapes', () => {
    const manager = new ThreeMaterialManager()

    manager.setTextureAssignments(['shape-1', 'missing'], [
      { id: 'shape-1' },
      { id: 'shape-2' },
    ] as never)

    expect(Array.from(manager.texturedShapeIdSet)).toEqual(['shape-1'])
  })

  it('resets texture maps and assignments when default material is requested', () => {
    const manager = new ThreeMaterialManager()
    manager.texturedShapeIdSet = new Set(['shape-1'])
    const albedo = createTexture()
    manager.applyTextureMaps(albedo, null, null)

    manager.useDefaultTexture()

    expect(manager.texturedShapeIdSet.size).toBe(0)
    expect(manager.leftTextureMaterial.map).toBeNull()
    expect(manager.assembledFrontMaterial.map).toBeNull()
  })

  it('applies leather preset properties across all managed materials', () => {
    const manager = new ThreeMaterialManager()

    manager.applyLeatherPreset('veg-tan')

    expect(manager.leftMaterial.roughness).toBeGreaterThan(0)
    expect(manager.rightTextureMaterial.metalness).toBeGreaterThanOrEqual(0)
    expect(manager.assembledFrontMaterial.color.getHexString()).not.toBe('8a6742')
  })

  it('disposes replaced textures when a new texture set is applied', () => {
    const manager = new ThreeMaterialManager()
    const oldAlbedo = createTexture()
    const oldDispose = vi.spyOn(oldAlbedo, 'dispose')
    manager.applyTextureMaps(oldAlbedo, null, null)

    const nextAlbedo = createTexture()
    manager.applyTextureMaps(nextAlbedo, null, null)

    expect(oldDispose).toHaveBeenCalledOnce()
    expect(manager.currentAlbedo).toBe(nextAlbedo)
  })

  it('loads and applies a texture set through the loader utility', async () => {
    const manager = new ThreeMaterialManager()
    const textures = [createTexture(), createTexture(), createTexture()]
    loadTextureMock
      .mockResolvedValueOnce(textures[0])
      .mockResolvedValueOnce(textures[1])
      .mockResolvedValueOnce(textures[2])

    const source: TextureSource = {
      sourceUrl: 'https://textures.example/leather',
      license: 'cc0',
      albedoUrl: 'https://textures.example/albedo.jpg',
      normalUrl: 'https://textures.example/normal.jpg',
      roughnessUrl: 'https://textures.example/roughness.jpg',
    }

    await manager.setTexture(source)

    expect(loadTextureMock).toHaveBeenCalledTimes(3)
    expect(manager.leftTextureMaterial.map).toBe(textures[0])
    expect(manager.leftTextureMaterial.normalMap).toBe(textures[1])
    expect(manager.leftTextureMaterial.roughnessMap).toBe(textures[2])
  })
})
