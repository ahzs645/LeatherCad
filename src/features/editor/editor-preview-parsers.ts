import { clamp } from './cad/cad-geometry'
import type { AvatarSpec, PiecePlacement3D, ThreePreviewSettings } from './cad/cad-types'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from './editor-constants'

export function sanitizePiecePlacement3d(value: PiecePlacement3D): PiecePlacement3D {
  const numberOrZero = (candidate: unknown) => (typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0)
  return {
    pieceId: value.pieceId,
    translationMm: {
      x: numberOrZero(value.translationMm?.x),
      y: numberOrZero(value.translationMm?.y),
      z: numberOrZero(value.translationMm?.z),
    },
    rotationDeg: {
      x: numberOrZero(value.rotationDeg?.x),
      y: numberOrZero(value.rotationDeg?.y),
      z: numberOrZero(value.rotationDeg?.z),
    },
    flipped: value.flipped === true,
  }
}

export function parsePiecePlacement3d(value: unknown): PiecePlacement3D | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<PiecePlacement3D>
  if (typeof candidate.pieceId !== 'string' || candidate.pieceId.length === 0) {
    return null
  }

  return sanitizePiecePlacement3d({
    pieceId: candidate.pieceId,
    translationMm: {
      x: typeof candidate.translationMm?.x === 'number' ? candidate.translationMm.x : 0,
      y: typeof candidate.translationMm?.y === 'number' ? candidate.translationMm.y : 0,
      z: typeof candidate.translationMm?.z === 'number' ? candidate.translationMm.z : 0,
    },
    rotationDeg: {
      x: typeof candidate.rotationDeg?.x === 'number' ? candidate.rotationDeg.x : 0,
      y: typeof candidate.rotationDeg?.y === 'number' ? candidate.rotationDeg.y : 0,
      z: typeof candidate.rotationDeg?.z === 'number' ? candidate.rotationDeg.z : 0,
    },
    flipped: candidate.flipped === true,
  })
}

export function sanitizeThreePreviewSettings(value: ThreePreviewSettings): ThreePreviewSettings {
  return {
    mode: value.mode === 'assembled' || value.mode === 'avatar' ? value.mode : 'fold',
    explodedFactor:
      typeof value.explodedFactor === 'number' && Number.isFinite(value.explodedFactor)
        ? clamp(value.explodedFactor, 0, 3)
        : DEFAULT_THREE_PREVIEW_SETTINGS.explodedFactor,
    thicknessMm:
      typeof value.thicknessMm === 'number' && Number.isFinite(value.thicknessMm)
        ? clamp(Math.abs(value.thicknessMm), 0.2, 20)
        : DEFAULT_THREE_PREVIEW_SETTINGS.thicknessMm,
    showSeams: value.showSeams !== false,
    showEdgeLabels: value.showEdgeLabels === true,
    showStressOverlay: value.showStressOverlay !== false,
    avatarId: typeof value.avatarId === 'string' && value.avatarId.trim().length > 0 ? value.avatarId.trim() : undefined,
  }
}

export function parseThreePreviewSettings(value: unknown): ThreePreviewSettings | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<ThreePreviewSettings>
  return sanitizeThreePreviewSettings({
    mode: candidate.mode === 'assembled' || candidate.mode === 'avatar' ? candidate.mode : 'fold',
    explodedFactor:
      typeof candidate.explodedFactor === 'number' ? candidate.explodedFactor : DEFAULT_THREE_PREVIEW_SETTINGS.explodedFactor,
    thicknessMm:
      typeof candidate.thicknessMm === 'number' ? candidate.thicknessMm : DEFAULT_THREE_PREVIEW_SETTINGS.thicknessMm,
    showSeams: candidate.showSeams !== false,
    showEdgeLabels: candidate.showEdgeLabels === true,
    showStressOverlay: candidate.showStressOverlay !== false,
    avatarId: typeof candidate.avatarId === 'string' ? candidate.avatarId : undefined,
  })
}

export function parseAvatarSpec(value: unknown): AvatarSpec | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<AvatarSpec>
  if (typeof candidate.id !== 'string' || candidate.id.length === 0 || typeof candidate.name !== 'string' || candidate.name.length === 0) {
    return null
  }

  return {
    id: candidate.id,
    name: candidate.name,
    sourceUrl: typeof candidate.sourceUrl === 'string' ? candidate.sourceUrl : '',
    scaleMm:
      typeof candidate.scaleMm === 'number' && Number.isFinite(candidate.scaleMm)
        ? Math.max(1, Math.abs(candidate.scaleMm))
        : 1,
  }
}
