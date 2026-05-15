import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBuiltinPrickingIronCatalog,
  createCustomPrickingIron,
  createCustomPrickingIronGroup,
  loadCustomPrickingIronCatalog,
  parsePrickingIronLccp,
  prickingIronPresetToDefaults,
  saveCustomPrickingIronCatalog,
  serializePrickingIronLccp,
  SOURCE_APP_PRICKING_IRON_COLLECTION_KEY,
  SOURCE_APP_PRICKING_IRON_GROUPS_KEY,
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

  it('allows source-app zero-width blade presets', () => {
    const preset = createCustomPrickingIron({
      groupId: 'group-1',
      name: 'Single Line Blade',
      shape: 'flat',
      pitchMm: 4,
      widthMm: 0,
      heightMm: 3,
    })

    expect(preset.widthMm).toBe(0)
    expect(prickingIronPresetToDefaults(preset).widthMm).toBe(0)
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
    expect(JSON.parse(localStorage.getItem(SOURCE_APP_PRICKING_IRON_GROUPS_KEY) ?? '{}')).toMatchObject({
      [SOURCE_APP_PRICKING_IRON_COLLECTION_KEY]: {
        groups: [expect.objectContaining({ id: group.id })],
        presets: [expect.objectContaining({ id: preset.id })],
      },
    })
  })

  it('loads source-app named pricking iron groups when the native key exists', () => {
    localStorage.setItem(
      SOURCE_APP_PRICKING_IRON_GROUPS_KEY,
      JSON.stringify({
        [SOURCE_APP_PRICKING_IRON_COLLECTION_KEY]: {
          groups: [{ id: 'source-group', name: 'Source Custom', system: false, order: 0 }],
          presets: [{
            id: 'source-preset',
            groupId: 'source-group',
            name: 'Source Diamond',
            shape: 'diamond',
            pitchMm: 4,
            numBlades: 4,
            widthMm: 1.2,
            heightMm: 3.4,
            tiltDeg: 42,
            inverted: true,
            system: false,
          }],
        },
        showFiveMmGuide: true,
      }),
    )

    const loaded = loadCustomPrickingIronCatalog(STORAGE_KEY)

    expect(loaded.showFiveMmGuide).toBe(true)
    expect(loaded.groups).toEqual([expect.objectContaining({ id: 'source-group' })])
    expect(loaded.presets).toEqual([expect.objectContaining({ id: 'source-preset', numBlades: 4, inverted: true })])
  })

  it('round-trips browser-safe prickingirons.lccp JSON', () => {
    const group = createCustomPrickingIronGroup('Library', 0)
    const preset = createCustomPrickingIron({
      groupId: group.id,
      name: 'Library Flat',
      shape: 'flat',
      pitchMm: 5,
      widthMm: 0,
    })

    const parsed = parsePrickingIronLccp(serializePrickingIronLccp({
      groups: [group],
      presets: [preset],
      showFiveMmGuide: true,
    }))

    expect(parsed.showFiveMmGuide).toBe(true)
    expect(parsed.groups[0]).toMatchObject({ id: group.id, name: 'Library' })
    expect(parsed.presets[0]).toMatchObject({ id: preset.id, widthMm: 0 })
  })

  it('imports source-shaped prickingirons.lccp payloads with nested PascalCase fields', () => {
    const payload = {
      [SOURCE_APP_PRICKING_IRON_GROUPS_KEY]: JSON.stringify({
        [SOURCE_APP_PRICKING_IRON_COLLECTION_KEY]: {
          groups: [
            {
              GUID: 'group-a',
              Name: 'Source Group',
              Order: '2',
              Items: [
                {
                  GUID: 'iron-a',
                  Name: 'Source Flat',
                  Type: 'Flat',
                  Pitch: '5',
                  BladeCount: '6',
                  Width: '0',
                  Height: '3.5',
                  Rotation: '12',
                  Invert: '-1',
                },
              ],
            },
          ],
        },
        chkShow5mm: true,
      }),
    }

    const parsed = parsePrickingIronLccp('\uFEFF' + JSON.stringify(payload))

    expect(parsed.showFiveMmGuide).toBe(true)
    expect(parsed.groups[0]).toMatchObject({ id: 'group-a', name: 'Source Group', order: 2 })
    expect(parsed.presets[0]).toMatchObject({
      id: 'iron-a',
      groupId: 'group-a',
      name: 'Source Flat',
      shape: 'flat',
      pitchMm: 5,
      numBlades: 6,
      widthMm: 0,
      heightMm: 3.5,
      tiltDeg: 12,
      inverted: true,
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
