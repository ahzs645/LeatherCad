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
  showFiveMmGuide?: boolean
}

type StoredPrickingIronCatalog = {
  groups?: unknown[]
  presets?: unknown[]
  showFiveMmGuide?: unknown
}

type SourcePrickingIronGroup = {
  id?: unknown
  ID?: unknown
  guid?: unknown
  GUID?: unknown
  name?: unknown
  Name?: unknown
  caption?: unknown
  Caption?: unknown
  system?: unknown
  System?: unknown
  order?: unknown
  Order?: unknown
  presets?: unknown
  Presets?: unknown
  items?: unknown
  Items?: unknown
  prickingIrons?: unknown
  PrickingIrons?: unknown
}

type SourcePrickingIronPreset = {
  id?: unknown
  ID?: unknown
  guid?: unknown
  GUID?: unknown
  groupId?: unknown
  GroupId?: unknown
  groupID?: unknown
  GroupID?: unknown
  name?: unknown
  Name?: unknown
  caption?: unknown
  Caption?: unknown
  shape?: unknown
  Shape?: unknown
  type?: unknown
  Type?: unknown
  pitchMm?: unknown
  PitchMm?: unknown
  pitch?: unknown
  Pitch?: unknown
  bladeCount?: unknown
  BladeCount?: unknown
  numBlades?: unknown
  NumBlades?: unknown
  widthMm?: unknown
  WidthMm?: unknown
  width?: unknown
  Width?: unknown
  heightMm?: unknown
  HeightMm?: unknown
  height?: unknown
  Height?: unknown
  tiltDeg?: unknown
  TiltDeg?: unknown
  angleDeg?: unknown
  AngleDeg?: unknown
  rotation?: unknown
  Rotation?: unknown
  inverted?: unknown
  Inverted?: unknown
  invert?: unknown
  Invert?: unknown
  system?: unknown
  System?: unknown
}

export const CUSTOM_PRICKING_IRON_STORAGE_KEY = 'leathercraft-custom-pricking-irons-v2'
export const SOURCE_APP_PRICKING_IRON_FILENAME = 'prickingirons.lccp'
export const SOURCE_APP_PRICKING_IRON_GROUPS_KEY = 'LeathercraftCAD_PrickingIronGroups'
export const SOURCE_APP_PRICKING_IRON_COLLECTION_KEY = 'pricking_iron_groups'

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

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asBoolean(value: unknown): boolean {
  if (value === true) {
    return true
  }
  if (typeof value === 'string') {
    return value === 'true' || value === '-1' || value === '1'
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return false
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const parsed = asString(value)
    if (parsed) {
      return parsed
    }
  }
  return null
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = asNumber(value)
    if (parsed !== null) {
      return parsed
    }
  }
  return null
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

  return { groups, presets, showFiveMmGuide: false }
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
    pitchMm: preset.pitchMm,
    numBlades: preset.numBlades,
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

function parseSourcePrickingIronGroup(value: unknown, index: number): PrickingIronGroup | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as SourcePrickingIronGroup
  const id = firstString(candidate.id, candidate.ID, candidate.guid, candidate.GUID) ?? `source-group-${index + 1}`
  const name = firstString(candidate.name, candidate.Name, candidate.caption, candidate.Caption)
  if (!name) {
    return null
  }

  return {
    id,
    name,
    system: asBoolean(candidate.system ?? candidate.System),
    order: Math.max(0, Math.round(firstNumber(candidate.order, candidate.Order) ?? index)),
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
    widthMm: clampPositive(candidate.widthMm ?? geometry.widthMm, geometry.widthMm, 0),
    heightMm: clampPositive(candidate.heightMm ?? geometry.heightMm, geometry.heightMm),
    tiltDeg: clampTilt(candidate.tiltDeg ?? geometry.tiltDeg, geometry.tiltDeg),
    inverted: candidate.inverted === true,
    system: candidate.system === true,
  }
}

function normalizeSourceShape(value: unknown): PrickingIronShape {
  const shape = asString(value)?.toLowerCase()
  if (shape?.includes('diamond')) {
    return 'diamond'
  }
  if (shape?.includes('french')) {
    return 'french'
  }
  if (shape?.includes('flat')) {
    return 'flat'
  }
  if (shape?.includes('round')) {
    return 'round'
  }
  return parsePrickingIronShape(shape)
}

function parseSourcePrickingIronPreset(
  value: unknown,
  fallbackGroupId: string | null,
  index: number,
): PrickingIronPreset | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as SourcePrickingIronPreset
  const groupId = firstString(candidate.groupId, candidate.GroupId, candidate.groupID, candidate.GroupID) ?? fallbackGroupId
  const name = firstString(candidate.name, candidate.Name, candidate.caption, candidate.Caption)
  const pitchMm = firstNumber(candidate.pitchMm, candidate.PitchMm, candidate.pitch, candidate.Pitch)
  if (!groupId || !name || pitchMm === null) {
    return null
  }

  const shape = normalizeSourceShape(candidate.shape ?? candidate.Shape ?? candidate.type ?? candidate.Type)
  const geometry = defaultGeometry(shape)
  return {
    id: firstString(candidate.id, candidate.ID, candidate.guid, candidate.GUID) ?? `source-preset-${index + 1}`,
    groupId,
    name,
    shape,
    pitchMm: clampPitch(pitchMm),
    numBlades: Math.max(
      1,
      Math.round(firstNumber(candidate.numBlades, candidate.NumBlades, candidate.bladeCount, candidate.BladeCount) ?? 2),
    ),
    widthMm: clampPositive(
      firstNumber(candidate.widthMm, candidate.WidthMm, candidate.width, candidate.Width) ?? geometry.widthMm,
      geometry.widthMm,
      0,
    ),
    heightMm: clampPositive(
      firstNumber(candidate.heightMm, candidate.HeightMm, candidate.height, candidate.Height) ?? geometry.heightMm,
      geometry.heightMm,
    ),
    tiltDeg: clampTilt(
      firstNumber(candidate.tiltDeg, candidate.TiltDeg, candidate.angleDeg, candidate.AngleDeg, candidate.rotation, candidate.Rotation)
        ?? geometry.tiltDeg,
      geometry.tiltDeg,
    ),
    inverted: asBoolean(candidate.inverted ?? candidate.Inverted ?? candidate.invert ?? candidate.Invert),
    system: asBoolean(candidate.system ?? candidate.System),
  }
}

function collectSourcePrickingIronEntries(candidate: StoredPrickingIronCatalog | Record<string, unknown>) {
  const rawGroups = Array.isArray(candidate.groups) ? candidate.groups : []
  const rawPresets = Array.isArray(candidate.presets) ? candidate.presets : []
  const sourceGroups = rawGroups
    .map((entry, index) => parseSourcePrickingIronGroup(entry, index))
    .filter((entry): entry is PrickingIronGroup => entry !== null)
  const sourcePresets: PrickingIronPreset[] = rawPresets
    .map((entry, index) => parseSourcePrickingIronPreset(entry, null, index))
    .filter((entry): entry is PrickingIronPreset => entry !== null)

  rawGroups.forEach((entry, groupIndex) => {
    if (typeof entry !== 'object' || entry === null) {
      return
    }
    const group = sourceGroups[groupIndex] ?? parseSourcePrickingIronGroup(entry, groupIndex)
    if (!group) {
      return
    }
    const sourceGroup = entry as SourcePrickingIronGroup
    const nested = sourceGroup.presets ?? sourceGroup.Presets ?? sourceGroup.items ?? sourceGroup.Items ?? sourceGroup.prickingIrons ?? sourceGroup.PrickingIrons
    if (!Array.isArray(nested)) {
      return
    }
    nested.forEach((preset, presetIndex) => {
      const parsed = parseSourcePrickingIronPreset(preset, group.id, sourcePresets.length + presetIndex)
      if (parsed) {
        sourcePresets.push(parsed)
      }
    })
  })

  return { sourceGroups, sourcePresets }
}

function parseJsonPossiblyWrapped(raw: string): unknown {
  const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const parsed = JSON.parse(cleaned) as unknown
  if (typeof parsed === 'string') {
    return JSON.parse(parsed) as unknown
  }
  return parsed
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
  return { groups, presets, showFiveMmGuide: catalog.showFiveMmGuide === true }
}

function loadLegacyCustomPresets(): PrickingIronCatalog {
  if (typeof window === 'undefined') {
    return { groups: [], presets: [] }
  }

  try {
    const raw = safeLocalStorageGet(LEGACY_STORAGE_KEY)
    if (!raw) {
      return { groups: [], presets: [], showFiveMmGuide: false }
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return { groups: [], presets: [], showFiveMmGuide: false }
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

    return presets.length > 0 ? { groups: [group], presets, showFiveMmGuide: false } : { groups: [], presets: [], showFiveMmGuide: false }
  } catch {
    return { groups: [], presets: [], showFiveMmGuide: false }
  }
}

export function loadCustomPrickingIronCatalog(storageKey = CUSTOM_PRICKING_IRON_STORAGE_KEY): PrickingIronCatalog {
  if (typeof window === 'undefined') {
    return { groups: [], presets: [], showFiveMmGuide: false }
  }

  try {
    const raw = safeLocalStorageGet(storageKey) ?? safeLocalStorageGet(SOURCE_APP_PRICKING_IRON_GROUPS_KEY)
    if (!raw) {
      return loadLegacyCustomPresets()
    }

    const imported = parsePrickingIronLccp(raw)
    if (imported.groups.length > 0 || imported.presets.length > 0 || imported.showFiveMmGuide === true) {
      return imported
    }

    const parsed = JSON.parse(raw) as StoredPrickingIronCatalog
    const sourceCollection = (parsed as Record<string, unknown>)[SOURCE_APP_PRICKING_IRON_COLLECTION_KEY]
    const rawGroups: unknown[] = Array.isArray(parsed.groups)
      ? parsed.groups
      : typeof sourceCollection === 'object' && sourceCollection !== null && Array.isArray((sourceCollection as StoredPrickingIronCatalog).groups)
        ? (sourceCollection as StoredPrickingIronCatalog).groups ?? []
        : []
    const rawPresets: unknown[] = Array.isArray(parsed.presets)
      ? parsed.presets
      : typeof sourceCollection === 'object' && sourceCollection !== null && Array.isArray((sourceCollection as StoredPrickingIronCatalog).presets)
        ? (sourceCollection as StoredPrickingIronCatalog).presets ?? []
        : []
    const groups = rawGroups.length > 0
      ? rawGroups.map(parsePrickingIronGroup).filter((entry): entry is PrickingIronGroup => entry !== null && !entry.system)
      : []
    const presets = rawPresets.length > 0
      ? rawPresets
          .map(parsePrickingIronPreset)
          .filter((entry): entry is PrickingIronPreset => entry !== null && !entry.system)
      : []

    return mergeCatalog({ groups, presets, showFiveMmGuide: parsed.showFiveMmGuide === true })
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
  const payload = {
    groups: customGroups,
    presets: customPresets,
    showFiveMmGuide: catalog.showFiveMmGuide === true,
    sourceApp: {
      filename: SOURCE_APP_PRICKING_IRON_FILENAME,
      groupsKey: SOURCE_APP_PRICKING_IRON_GROUPS_KEY,
      collectionKey: SOURCE_APP_PRICKING_IRON_COLLECTION_KEY,
    },
  }
  safeLocalStorageSet(storageKey, JSON.stringify(payload))
  safeLocalStorageSet(SOURCE_APP_PRICKING_IRON_GROUPS_KEY, JSON.stringify({
    [SOURCE_APP_PRICKING_IRON_COLLECTION_KEY]: {
      groups: customGroups,
      presets: customPresets,
    },
    showFiveMmGuide: catalog.showFiveMmGuide === true,
  }))
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
    widthMm: clampPositive(params.widthMm ?? geometry.widthMm, geometry.widthMm, 0),
    heightMm: clampPositive(params.heightMm ?? geometry.heightMm, geometry.heightMm),
    tiltDeg: clampTilt(params.tiltDeg ?? geometry.tiltDeg, geometry.tiltDeg),
    inverted: params.inverted === true,
    system: false,
  }
}

export function serializePrickingIronLccp(catalog: PrickingIronCatalog): string {
  const customGroups = catalog.groups.filter((group) => !group.system)
  const customGroupIds = new Set(customGroups.map((group) => group.id))
  const customPresets = catalog.presets.filter((preset) => !preset.system && customGroupIds.has(preset.groupId))
  return JSON.stringify(
    {
      file: SOURCE_APP_PRICKING_IRON_FILENAME,
      [SOURCE_APP_PRICKING_IRON_COLLECTION_KEY]: {
        groups: customGroups,
        presets: customPresets,
      },
      showFiveMmGuide: catalog.showFiveMmGuide === true,
    },
    null,
    2,
  )
}

export function parsePrickingIronLccp(raw: string): PrickingIronCatalog {
  const parsed = parseJsonPossiblyWrapped(raw)
  if (typeof parsed !== 'object' || parsed === null) {
    return { groups: [], presets: [], showFiveMmGuide: false }
  }

  const root = parsed as Record<string, unknown>
  const keyedPayload = root[SOURCE_APP_PRICKING_IRON_GROUPS_KEY]
  const keyedParsed = typeof keyedPayload === 'string'
    ? parseJsonPossiblyWrapped(keyedPayload)
    : keyedPayload
  const effectiveRoot = typeof keyedParsed === 'object' && keyedParsed !== null
    ? keyedParsed as Record<string, unknown>
    : root
  const sourceCollection = effectiveRoot[SOURCE_APP_PRICKING_IRON_COLLECTION_KEY]
  const candidate = typeof sourceCollection === 'object' && sourceCollection !== null
    ? sourceCollection as StoredPrickingIronCatalog
    : effectiveRoot as StoredPrickingIronCatalog
  const sourceEntries = collectSourcePrickingIronEntries(candidate)
  const groups = sourceEntries.sourceGroups.filter((entry) => !entry.system)
  const presets = sourceEntries.sourcePresets.filter((entry) => !entry.system)
  return mergeCatalog({
    groups,
    presets,
    showFiveMmGuide: effectiveRoot.showFiveMmGuide === true || effectiveRoot.chkShow5mm === true || root.showFiveMmGuide === true,
  })
}
