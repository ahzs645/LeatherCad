import { Group, MeshStandardMaterial } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarSpec, ThreePreviewSettings } from '../cad/cad-types'
import { ThreeAvatarManager } from './avatar-manager'

const loadAsyncMock = vi.fn()

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    loadAsync = loadAsyncMock
  },
}))

function createPreviewSettings(overrides: Partial<ThreePreviewSettings> = {}): ThreePreviewSettings {
  return {
    mode: 'avatar',
    explodedFactor: 0.35,
    thicknessMm: 1.8,
    showSeams: true,
    showEdgeLabels: false,
    showStressOverlay: true,
    ...overrides,
  }
}

describe('ThreeAvatarManager', () => {
  beforeEach(() => {
    loadAsyncMock.mockReset()
  })

  it('uses procedural fallback when no avatar source is configured', async () => {
    const manager = new ThreeAvatarManager()
    const avatarGroup = new Group()
    const fitControlsToModel = vi.fn()

    await manager.rebuildAvatarModel({
      avatarGroup,
      avatars: [],
      previewSettings: createPreviewSettings(),
      transformScale: 1,
      preservedMaterials: new Set([new MeshStandardMaterial()]),
      fitControlsToModel,
    })

    expect(avatarGroup.children.length).toBeGreaterThan(0)
    expect(fitControlsToModel).toHaveBeenCalledOnce()
  })

  it('loads the configured avatar asset when a source URL exists', async () => {
    const manager = new ThreeAvatarManager()
    const avatarGroup = new Group()
    const fitControlsToModel = vi.fn()
    const loadedScene = new Group()
    loadAsyncMock.mockResolvedValue({ scene: loadedScene })

    const avatars: AvatarSpec[] = [{
      id: 'avatar-1',
      name: 'Mannequin',
      sourceUrl: 'https://example.com/avatar.glb',
      scaleMm: 1700,
    }]

    await manager.rebuildAvatarModel({
      avatarGroup,
      avatars,
      previewSettings: createPreviewSettings({ avatarId: 'avatar-1' }),
      transformScale: 1,
      preservedMaterials: new Set([new MeshStandardMaterial()]),
      fitControlsToModel,
    })

    expect(loadAsyncMock).toHaveBeenCalledOnce()
    expect(avatarGroup.children.length).toBe(1)
    expect(fitControlsToModel).toHaveBeenCalledOnce()
  })
})
