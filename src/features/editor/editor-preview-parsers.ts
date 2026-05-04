import { clamp } from './cad/cad-geometry'
import type { AvatarSpec, FoldInstructionNode, FoldStepCommand, PiecePlacement3D, ThreePreviewSettings } from './cad/cad-types'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from './editor-constants'

function parseThreePreviewMode(value: unknown) {
  return value === 'assembled' || value === 'avatar' || value === 'final' ? value : 'fold'
}

function parseFinalFoldCamera(value: unknown) {
  return value === 'pattern' || value === 'top' || value === 'front' || value === 'side' ? value : 'orbit'
}

function sanitizeOptionalNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return clamp(value, min, max)
}

export function parseFoldStepCommand(value: unknown): FoldStepCommand | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<FoldStepCommand>
  if (typeof candidate.foldLineId !== 'string' || candidate.foldLineId.trim().length === 0) {
    return null
  }

  const command: FoldStepCommand = {
    foldLineId: candidate.foldLineId.trim(),
  }
  const targetAngleDeg = sanitizeOptionalNumber(candidate.targetAngleDeg, -360, 360)
  if (targetAngleDeg !== undefined) {
    command.targetAngleDeg = targetAngleDeg
  }
  const duration = sanitizeOptionalNumber(candidate.duration, 0.1, 100)
  if (duration !== undefined) {
    command.duration = duration
  }
  if (candidate.previewOnly === true) {
    command.previewOnly = true
  }
  if (candidate.flex === true) {
    command.flex = true
  }
  if (candidate.locked === true) {
    command.locked = true
  }
  return command
}

export function parseFoldInstructionNode(value: unknown, depth = 0): FoldInstructionNode | null {
  if (depth > 4 || typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<FoldInstructionNode>
  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return null
  }

  const commands = Array.isArray(candidate.commands)
    ? candidate.commands.map(parseFoldStepCommand).filter((command): command is FoldStepCommand => command !== null)
    : undefined
  const children = Array.isArray(candidate.children)
    ? candidate.children
        .map((child) => parseFoldInstructionNode(child, depth + 1))
        .filter((child): child is FoldInstructionNode => child !== null)
    : undefined

  return {
    id: candidate.id.trim(),
    label: typeof candidate.label === 'string' && candidate.label.trim().length > 0 ? candidate.label.trim().slice(0, 80) : undefined,
    commands,
    children,
    default: candidate.default === true,
  }
}

export function parseFoldTimeline(value: unknown): FoldInstructionNode[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const nodes = value
    .map((node) => parseFoldInstructionNode(node))
    .filter((node): node is FoldInstructionNode => node !== null)
    .slice(0, 48)
  return nodes.length > 0 ? nodes : undefined
}

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
    mode: parseThreePreviewMode(value.mode),
    explodedFactor:
      typeof value.explodedFactor === 'number' && Number.isFinite(value.explodedFactor)
        ? clamp(value.explodedFactor, 0, 3)
        : DEFAULT_THREE_PREVIEW_SETTINGS.explodedFactor,
    finalFoldProgress:
      typeof value.finalFoldProgress === 'number' && Number.isFinite(value.finalFoldProgress)
        ? clamp(value.finalFoldProgress, 0, 1)
        : DEFAULT_THREE_PREVIEW_SETTINGS.finalFoldProgress,
    finalFoldCamera: parseFinalFoldCamera(value.finalFoldCamera),
    foldTimeline: parseFoldTimeline(value.foldTimeline),
    thicknessMm:
      typeof value.thicknessMm === 'number' && Number.isFinite(value.thicknessMm)
        ? clamp(Math.abs(value.thicknessMm), 0.2, 20)
        : DEFAULT_THREE_PREVIEW_SETTINGS.thicknessMm,
    showSeams: value.showSeams !== false,
    showEdgeLabels: value.showEdgeLabels === true,
    showStressOverlay: value.showStressOverlay !== false,
    usePhysicsRelaxation: value.usePhysicsRelaxation !== false,
    avatarId: typeof value.avatarId === 'string' && value.avatarId.trim().length > 0 ? value.avatarId.trim() : undefined,
  }
}

export function parseThreePreviewSettings(value: unknown): ThreePreviewSettings | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<ThreePreviewSettings>
  return sanitizeThreePreviewSettings({
    mode: parseThreePreviewMode(candidate.mode),
    explodedFactor:
      typeof candidate.explodedFactor === 'number' ? candidate.explodedFactor : DEFAULT_THREE_PREVIEW_SETTINGS.explodedFactor,
    finalFoldProgress:
      typeof candidate.finalFoldProgress === 'number' ? candidate.finalFoldProgress : DEFAULT_THREE_PREVIEW_SETTINGS.finalFoldProgress,
    finalFoldCamera: parseFinalFoldCamera(candidate.finalFoldCamera),
    foldTimeline: parseFoldTimeline(candidate.foldTimeline),
    thicknessMm:
      typeof candidate.thicknessMm === 'number' ? candidate.thicknessMm : DEFAULT_THREE_PREVIEW_SETTINGS.thicknessMm,
    showSeams: candidate.showSeams !== false,
    showEdgeLabels: candidate.showEdgeLabels === true,
    showStressOverlay: candidate.showStressOverlay !== false,
    usePhysicsRelaxation: candidate.usePhysicsRelaxation !== false,
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
