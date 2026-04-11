import type { StitchHoleDefaults, StitchHoleRenderShape, StitchHoleType } from '../cad/cad-types'
import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

export type PrickingIronShape = 'diamond' | 'french' | 'flat' | 'round' | 'custom'

export type PrickingIronGroup = {
  id: string
  name: string
  system: boolean
  order: number
}

export type PrickingIronPreset = {
  id: string
  groupId: string
  name: string
  shape: PrickingIronShape
  pitchMm: number
  numBlades: number
  widthMm: number
  heightMm: number
  tiltDeg: number
  inverted: boolean
  system: boolean
}

export type PrickingIronCatalog = {
  groups: PrickingIronGroup[]
  presets: PrickingIronPreset[]
}

type StoredPrickingIronCatalog = {
  groups?: unknown[]
  presets?: unknown[]
}

export const CUSTOM_PRICKING_IRON_STORAGE_KEY = 'leathercraft-custom-pricking-irons-v2'

const LEGACY_STORAGE_KEY = 'leathercraft-custom-pricking-irons-v1'
const DEFAULT_CUSTOM_GROUP_ID = 'custom-group'
const BASE_PITCHES_MM = [3, 3.38, 3.85, 4]
const BASE_INCH_SPI = [5, 6, 7, 8, 9, 10]
const BUILTIN_GROUPS: Array<{ id: string; name: string; shape: Exclude<PrickingIronShape, 'custom'> }> = [
  { id: 'system-round', name: 'Round', shape: 'round' },
  { id: 'system-diamond', name: 'Diamond', shape: 'diamond' },
  { id: 'system-french', name: 'French', shape: 'french' },
  { id: 'system-flat', name: 'Flat', shape: 'flat' },
]

function clampPitch(value: number) {
  if (!Number.isFinite(value)) {
    return 3
  }
  return Math.max(0.2, Math.min(100, value))
}

function clampPositive(value: number, fallback: number, min = 0.1, max = 100) {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(min, Math.min(max, value))
}

function clampTilt(value: number, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(-89, Math.min(89, value))
}

function defaultGeometry(shape: PrickingIronShape) {
  switch (shape) {
    case 'diamond':
      return { widthMm: 1.4, heightMm: 3.4, tiltDeg: 42, inverted: false }
    case 'french':
      return { widthMm: 1.1, heightMm: 3.8, tiltDeg: 32, inverted: false }
    case 'flat':
      return { widthMm: 0.8, heightMm: 3.6, tiltDeg: 0, inverted: false }
    case 'round':
      return { widthMm: 1.2, heightMm: 1.2, tiltDeg: 0, inverted: false }
    default:
      return { widthMm: 1.2, heightMm: 3.4, tiltDeg: 0, inverted: false }
  }
}

function serializeBuiltinPresetId(shape: Exclude<PrickingIronShape, 'custom'>, label: string) {
  return `${shape}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
}

export function createBuiltinPrickingIronCatalog(): PrickingIronCatalog {
  const groups: PrickingIronGroup[] = BUILTIN_GROUPS.map((entry, index) => ({
    id: entry.id,
    name: entry.name,
    system: true,
    order: index,
  }))

  const presets: PrickingIronPreset[] = []
  for (const groupEntry of BUILTIN_GROUPS) {
    const geometry = defaultGeometry(groupEntry.shape)
    for (const pitch of BASE_PITCHES_MM) {
      const pitchLabel = pitch.toFixed(2).replace(/\.00$/, '')
      presets.push({
        id: serializeBuiltinPresetId(groupEntry.shape, pitchLabel),
        groupId: groupEntry.id,
        name: `${groupEntry.name} ${pitchLabel}`,
        shape: groupEntry.shape,
        pitchMm: pitch,
        numBlades: 2,
        widthMm: geometry.widthMm,
        heightMm: geometry.heightMm,
        tiltDeg: geometry.tiltDeg,
        inverted: geometry.inverted,
        system: true,
      })
    }

    for (const spi of BASE_INCH_SPI) {
      const pitchMm = 25.4 / spi
      presets.push({
        id: serializeBuiltinPresetId(groupEntry.shape, `${spi}-spi`),
        groupId: groupEntry.id,
        name: `${groupEntry.name} ${spi} SPI`,
        shape: groupEntry.shape,
        pitchMm,
        numBlades: 2,
        widthMm: geometry.widthMm,
        heightMm: geometry.heightMm,
        tiltDeg: geometry.tiltDeg,
        inverted: geometry.inverted,
        system: true,
      })
    }
  }

  return { groups, presets }
}

export function createDefaultCustomPrickingIronGroup(order = 0): PrickingIronGroup {
  return {
    id: DEFAULT_CUSTOM_GROUP_ID,
    name: 'Custom',
    system: false,
    order,
  }
}

export function parsePrickingIronShape(value: string | null | undefined): PrickingIronShape {
  if (value === 'diamond' || value === 'french' || value === 'flat' || value === 'round') {
    return value
  }
  return 'custom'
}

export function prickingIronToHoleType(shape: PrickingIronShape): StitchHoleType {
  return shape === 'round' ? 'round' : 'slit'
}

export function prickingIronToRenderShape(shape: PrickingIronShape): StitchHoleRenderShape {
  if (shape === 'round') {
    return 'round'
  }
  if (shape === 'diamond' || shape === 'french' || shape === 'flat') {
    return shape
  }
  return 'slit'
}

export function prickingIronPresetToDefaults(preset: PrickingIronPreset): StitchHoleDefaults {
  return {
    holeType: prickingIronToHoleType(preset.shape),
    renderShape: prickingIronToRenderShape(preset.shape),
    diameterMm: preset.shape === 'round' ? preset.widthMm : undefined,
    widthMm: preset.widthMm,
    heightMm: preset.heightMm,
    tiltDeg: preset.tiltDeg,
    inverted: preset.inverted,
    presetId: preset.id,
    presetName: preset.name,
  }
}

function parsePrickingIronGroup(value: unknown): PrickingIronGroup | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<PrickingIronGroup>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    return null
  }

  return {
    id: candidate.id,
    name: candidate.name.trim(),
    system: candidate.system === true,
    order: typeof candidate.order === 'number' && Number.isFinite(candidate.order) ? Math.max(0, Math.round(candidate.order)) : 0,
  }
}

export function parsePrickingIronPreset(value: unknown): PrickingIronPreset | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<PrickingIronPreset>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }
  if (typeof candidate.groupId !== 'string' || candidate.groupId.length === 0) {
    return null
  }
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    return null
  }
  if (
    candidate.shape !== 'diamond' &&
    candidate.shape !== 'french' &&
    candidate.shape !== 'flat' &&
    candidate.shape !== 'round' &&
    candidate.shape !== 'custom'
  ) {
    return null
  }
  if (typeof candidate.pitchMm !== 'number') {
    return null
  }

  const geometry = defaultGeometry(candidate.shape)

  return {
    id: candidate.id,
    groupId: candidate.groupId,
    name: candidate.name.trim(),
    shape: candidate.shape,
    pitchMm: clampPitch(candidate.pitchMm),
    numBlades:
      typeof candidate.numBlades === 'number' && Number.isFinite(candidate.numBlades)
        ? Math.max(1, Math.round(candidate.numBlades))
        : 2,
    widthMm: clampPositive(candidate.widthMm ?? geometry.widthMm, geometry.widthMm),
    heightMm: clampPositive(candidate.heightMm ?? geometry.heightMm, geometry.heightMm),
    tiltDeg: clampTilt(candidate.tiltDeg ?? geometry.tiltDeg, geometry.tiltDeg),
    inverted: candidate.inverted === true,
    system: candidate.system === true,
  }
}

function mergeCatalog(catalog: PrickingIronCatalog): PrickingIronCatalog {
  const groupsById = new Map<string, PrickingIronGroup>()
  for (const group of catalog.groups) {
    groupsById.set(group.id, group)
  }

  const presets = catalog.presets
    .filter((preset) => groupsById.has(preset.groupId))
    .sort((left, right) => left.name.localeCompare(right.name))

  const groups = Array.from(groupsById.values()).sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
  return { groups, presets }
}

function loadLegacyCustomPresets(): PrickingIronCatalog {
  if (typeof window === 'undefined') {
    return { groups: [], presets: [] }
  }

  try {
    const raw = safeLocalStorageGet(LEGACY_STORAGE_KEY)
    if (!raw) {
      return { groups: [], presets: [] }
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return { groups: [], presets: [] }
    }

    const group = createDefaultCustomPrickingIronGroup(0)
    const presets = parsed
      .map(parsePrickingIronPreset)
      .filter((entry): entry is PrickingIronPreset => entry !== null)
      .map((entry) => ({
        ...entry,
        groupId: group.id,
        system: false,
      }))

    return presets.length > 0 ? { groups: [group], presets } : { groups: [], presets: [] }
  } catch {
    return { groups: [], presets: [] }
  }
}

export function loadCustomPrickingIronCatalog(storageKey = CUSTOM_PRICKING_IRON_STORAGE_KEY): PrickingIronCatalog {
  if (typeof window === 'undefined') {
    return { groups: [], presets: [] }
  }

  try {
    const raw = safeLocalStorageGet(storageKey)
    if (!raw) {
      return loadLegacyCustomPresets()
    }

    const parsed = JSON.parse(raw) as StoredPrickingIronCatalog
    const groups = Array.isArray(parsed.groups)
      ? parsed.groups.map(parsePrickingIronGroup).filter((entry): entry is PrickingIronGroup => entry !== null && !entry.system)
      : []
    const presets = Array.isArray(parsed.presets)
      ? parsed.presets
          .map(parsePrickingIronPreset)
          .filter((entry): entry is PrickingIronPreset => entry !== null && !entry.system)
      : []

    return mergeCatalog({ groups, presets })
  } catch {
    return loadLegacyCustomPresets()
  }
}

export function saveCustomPrickingIronCatalog(
  catalog: PrickingIronCatalog,
  storageKey = CUSTOM_PRICKING_IRON_STORAGE_KEY,
) {
  if (typeof window === 'undefined') {
    return
  }

  const customGroups = catalog.groups.filter((group) => !group.system)
  const customGroupIds = new Set(customGroups.map((group) => group.id))
  const customPresets = catalog.presets.filter((preset) => !preset.system && customGroupIds.has(preset.groupId))
  safeLocalStorageSet(storageKey, JSON.stringify({ groups: customGroups, presets: customPresets }))
}

export function createCustomPrickingIronGroup(name: string, order: number): PrickingIronGroup {
  return {
    id: `custom-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Custom Group',
    system: false,
    order: Math.max(0, Math.round(order)),
  }
}

export function createCustomPrickingIron(params: {
  groupId: string
  name: string
  shape: PrickingIronShape
  pitchMm: number
  numBlades?: number
  widthMm?: number
  heightMm?: number
  tiltDeg?: number
  inverted?: boolean
}): PrickingIronPreset {
  const geometry = defaultGeometry(params.shape)
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    groupId: params.groupId,
    name: params.name.trim() || 'Custom Iron',
    shape: params.shape,
    pitchMm: clampPitch(params.pitchMm),
    numBlades:
      typeof params.numBlades === 'number' && Number.isFinite(params.numBlades)
        ? Math.max(1, Math.round(params.numBlades))
        : 2,
    widthMm: clampPositive(params.widthMm ?? geometry.widthMm, geometry.widthMm),
    heightMm: clampPositive(params.heightMm ?? geometry.heightMm, geometry.heightMm),
    tiltDeg: clampTilt(params.tiltDeg ?? geometry.tiltDeg, geometry.tiltDeg),
    inverted: params.inverted === true,
    system: false,
  }
}
