import type { FoldLine, SeamConnection } from '../cad/cad-types'
import type { AssemblyDiagnostic } from './assembly-diagnostics'

export type AssemblyStressBand = 'normal' | 'attention' | 'high'

export type AssemblyStressScore = {
  id: string
  source: 'seam' | 'fold' | 'diagnostic'
  score: number
  band: AssemblyStressBand
  reasons: string[]
}

function bandForScore(score: number): AssemblyStressBand {
  if (score >= 0.72) return 'high'
  if (score >= 0.36) return 'attention'
  return 'normal'
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function scoreSeamStress(params: {
  seam: SeamConnection
  lengthDeltaMm: number
  toleranceMm: number
}) {
  const score = clamp01(params.lengthDeltaMm / Math.max(params.toleranceMm * 4, 1))
  const reasons = params.lengthDeltaMm > params.toleranceMm
    ? [`Length mismatch ${params.lengthDeltaMm.toFixed(1)} mm`]
    : []
  return {
    id: params.seam.id,
    source: 'seam' as const,
    score,
    band: bandForScore(score),
    reasons,
  }
}

export function scoreFoldStress(params: {
  foldLine: FoldLine
  thicknessMm: number
  minRadiusRatio?: number
}) {
  const minRadiusRatio = params.minRadiusRatio ?? 1.5
  const radiusMm = params.foldLine.radiusMm ?? params.foldLine.bendRadiusMm
  const minRadiusMm = params.thicknessMm * minRadiusRatio
  const score = typeof radiusMm === 'number' && Number.isFinite(radiusMm) && radiusMm > 0
    ? clamp01(1 - radiusMm / Math.max(minRadiusMm, 1e-6))
    : 0
  const reasons = score > 0 ? [`Radius below ${minRadiusMm.toFixed(1)} mm`] : []
  return {
    id: params.foldLine.id,
    source: 'fold' as const,
    score,
    band: bandForScore(score),
    reasons,
  }
}

export function scoreDiagnosticStress(diagnostic: AssemblyDiagnostic): AssemblyStressScore {
  const scoreBySeverity = {
    fatal: 1,
    error: 0.86,
    warning: 0.5,
    info: 0.16,
  } satisfies Record<AssemblyDiagnostic['severity'], number>
  const score = scoreBySeverity[diagnostic.severity]
  return {
    id: diagnostic.id,
    source: 'diagnostic',
    score,
    band: bandForScore(score),
    reasons: [diagnostic.message],
  }
}
