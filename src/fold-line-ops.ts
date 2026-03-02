import { clamp } from './cad-geometry'
import type { FoldDirection, FoldLine } from './cad-types'

export const DEFAULT_FOLD_DIRECTION: FoldDirection = 'mountain'
export const DEFAULT_FOLD_RADIUS_MM = 1.2
export const DEFAULT_FOLD_THICKNESS_MM = 1.6
export const DEFAULT_FOLD_NEUTRAL_AXIS_RATIO = 0.5
export const DEFAULT_FOLD_STIFFNESS = 0.3
export const DEFAULT_FOLD_CLEARANCE_MM = 0.25

export type ResolvedFoldBehavior = {
  targetAngleDeg: number
  maxAngleDeg: number
  direction: FoldDirection
  radiusMm: number
  thicknessMm: number
  neutralAxisRatio: number
  stiffness: number
  clearanceMm: number
}

export function parseFoldDirection(value: unknown): FoldDirection | null {
  if (value === 'mountain' || value === 'valley') {
    return value
  }
  return null
}

export function foldDirectionSign(direction: FoldDirection) {
  return direction === 'valley' ? 1 : -1
}

export function resolveFoldBehavior(foldLine: FoldLine | null | undefined): ResolvedFoldBehavior {
  const maxAngleDeg = clamp(foldLine?.maxAngleDeg ?? 180, 10, 180)
  const targetAngleDeg = clamp(foldLine?.angleDeg ?? 0, 0, maxAngleDeg)
  const direction = parseFoldDirection(foldLine?.direction) ?? DEFAULT_FOLD_DIRECTION
  const radiusMm = clamp(foldLine?.radiusMm ?? DEFAULT_FOLD_RADIUS_MM, 0, 30)
  const thicknessMm = clamp(foldLine?.thicknessMm ?? DEFAULT_FOLD_THICKNESS_MM, 0.2, 20)
  const neutralAxisRatio = clamp(foldLine?.neutralAxisRatio ?? DEFAULT_FOLD_NEUTRAL_AXIS_RATIO, 0, 1)
  const stiffness = clamp(foldLine?.stiffness ?? DEFAULT_FOLD_STIFFNESS, 0, 1)
  const clearanceMm = clamp(foldLine?.clearanceMm ?? DEFAULT_FOLD_CLEARANCE_MM, 0, 20)

  return {
    targetAngleDeg,
    maxAngleDeg,
    direction,
    radiusMm,
    thicknessMm,
    neutralAxisRatio,
    stiffness,
    clearanceMm,
  }
}
