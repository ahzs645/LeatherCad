import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBuiltinPrickingIronCatalog,
  createCustomPrickingIron,
  createCustomPrickingIronGroup,
  loadCustomPrickingIronCatalog,
  prickingIronPresetToDefaults,
  saveCustomPrickingIronCatalog,
} from './pricking-iron-ops'

const STORAGE_KEY = 'test-pricking-irons'
const LEGACY_STORAGE_KEY = 'leathercraft-custom-pricking-irons-v1'
const storage = new Map<string, string>()

describe('pricking-iron-ops', () => {
  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    })
  })

  it('builds grouped system presets with geometry defaults', () => {
    const catalog = createBuiltinPrickingIronCatalog()

    expect(catalog.groups.map((group) => group.name)).toEqual(['Round', 'Diamond', 'French', 'Flat'])
    expect(catalog.presets.length).toBeGreaterThan(0)
    expect(catalog.presets.every((preset) => preset.system)).toBe(true)
    expect(catalog.presets.some((preset) => preset.pitchMm === 3.38)).toBe(true)
  })

  it('maps presets into stitch-hole defaults with render-shape geometry', () => {
    const preset = createCustomPrickingIron({
      groupId: 'group-1',
      name: 'French 3.38',
      shape: 'french',
      pitchMm: 3.38,
      widthMm: 1,
      heightMm: 3.8,
      tiltDeg: 32,
      inverted: true,
    })

    expect(prickingIronPresetToDefaults(preset)).toMatchObject({
      holeType: 'slit',
      renderShape: 'french',
      widthMm: 1,
      heightMm: 3.8,
      tiltDeg: 32,
      inverted: true,
      presetId: preset.id,
      presetName: 'French 3.38',
    })
  })

  it('persists and reloads only custom groups and presets', () => {
    const group = createCustomPrickingIronGroup('Shop Favorites', 0)
    const preset = createCustomPrickingIron({
      groupId: group.id,
      name: 'Diamond 4',
      shape: 'diamond',
      pitchMm: 4,
    })
    saveCustomPrickingIronCatalog(
      {
        groups: [group, { id: 'system', name: 'System', order: 1, system: true }],
        presets: [preset, { ...preset, id: 'system-preset', groupId: 'system', system: true }],
      },
      STORAGE_KEY,
    )

    const loaded = loadCustomPrickingIronCatalog(STORAGE_KEY)

    expect(loaded.groups).toEqual([group])
    expect(loaded.presets).toHaveLength(1)
    expect(loaded.presets[0]).toMatchObject({
      id: preset.id,
      groupId: group.id,
      name: 'Diamond 4',
      system: false,
    })
  })

  it('falls back to the legacy preset format when the new catalog is absent', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-preset',
          groupId: 'legacy',
          name: 'Legacy Diamond',
          shape: 'diamond',
          pitchMm: 3.85,
          widthMm: 1.2,
          heightMm: 3.5,
          tiltDeg: 45,
        },
      ]),
    )

    const loaded = loadCustomPrickingIronCatalog(STORAGE_KEY)

    expect(loaded.groups).toHaveLength(1)
    expect(loaded.groups[0].name).toBe('Custom')
    expect(loaded.presets).toHaveLength(1)
    expect(loaded.presets[0]).toMatchObject({
      id: 'legacy-preset',
      name: 'Legacy Diamond',
      groupId: loaded.groups[0].id,
      system: false,
    })
  })
})
