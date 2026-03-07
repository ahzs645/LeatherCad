import type { StitchHoleType } from '../cad/cad-types'
import { safeLocalStorageGet, safeLocalStorageSet } from './safe-storage'

export type PrickingIronShape = 'diamond' | 'french' | 'flat' | 'round' | 'custom'

export type PrickingIronPreset = {
  id: string
  name: string
  shape: PrickingIronShape
  pitchMm: number
}

export const CUSTOM_PRICKING_IRON_STORAGE_KEY = 'leathercraft-custom-pricking-irons-v1'

const BASE_PITCHES_MM = [3, 3.38, 3.85, 4]
const BASE_INCH_SPI = [5, 6, 7, 8, 9, 10]
const BUILTIN_SHAPES: Array<{ shape: PrickingIronShape; label: string }> = [
  { shape: 'diamond', label: 'Diamond' },
  { shape: 'french', label: 'French' },
  { shape: 'flat', label: 'Flat' },
  { shape: 'round', label: 'Round' },
]

function clampPitch(value: number) {
  if (!Number.isFinite(value)) {
    return 3
  }
  return Math.max(0.2, Math.min(100, value))
}

export function createBuiltinPrickingIrons(): PrickingIronPreset[] {
  const presets: PrickingIronPreset[] = []
  for (const shapeEntry of BUILTIN_SHAPES) {
    for (const pitch of BASE_PITCHES_MM) {
      const pitchLabel = pitch.toFixed(2).replace(/\.00$/, '')
      presets.push({
        id: `${shapeEntry.shape}-${pitchLabel.replace('.', '')}`,
        name: `${shapeEntry.label} ${pitchLabel}`,
        shape: shapeEntry.shape,
        pitchMm: pitch,
      })
    }

    for (const spi of BASE_INCH_SPI) {
      const pitchMm = 25.4 / spi
      presets.push({
        id: `${shapeEntry.shape}-spi-${spi}`,
        name: `${shapeEntry.label} ${spi} SPI`,
        shape: shapeEntry.shape,
        pitchMm,
      })
    }
  }
  return presets
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

export function parsePrickingIronPreset(value: unknown): PrickingIronPreset | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = value as Partial<PrickingIronPreset>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
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

  return {
    id: candidate.id,
    name: candidate.name.trim(),
    shape: candidate.shape,
    pitchMm: clampPitch(candidate.pitchMm),
  }
}

export function loadCustomPrickingIrons(storageKey = CUSTOM_PRICKING_IRON_STORAGE_KEY): PrickingIronPreset[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = safeLocalStorageGet(storageKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .map(parsePrickingIronPreset)
      .filter((entry): entry is PrickingIronPreset => entry !== null)
  } catch {
    return []
  }
}

export function saveCustomPrickingIrons(
  presets: PrickingIronPreset[],
  storageKey = CUSTOM_PRICKING_IRON_STORAGE_KEY,
) {
  if (typeof window === 'undefined') {
    return
  }
  safeLocalStorageSet(storageKey, JSON.stringify(presets))
}

export function createCustomPrickingIron(params: {
  name: string
  shape: PrickingIronShape
  pitchMm: number
}): PrickingIronPreset {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: params.name.trim() || 'Custom Iron',
    shape: params.shape,
    pitchMm: clampPitch(params.pitchMm),
  }
}
