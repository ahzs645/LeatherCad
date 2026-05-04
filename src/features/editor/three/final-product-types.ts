import type { Matrix4, Vector3 } from 'three'
import type { FoldLine, Point, StitchHole } from '../cad/cad-types'

export type FinalProductDiagnosticSeverity = 'info' | 'warning' | 'error'

export type FinalProductDiagnostic = {
  id: string
  code: string
  severity: FinalProductDiagnosticSeverity
  message: string
  chainIds?: string[]
  foldLineIds?: string[]
}

export type StitchChain = {
  id: string
  holes: StitchHole[]
  pointCount: number
  pitchMm: number
  lengthMm: number
  start: Point
  end: Point
  direction: Point
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  explicit: boolean
}

export type StitchPair = {
  id: string
  left: StitchChain
  right: StitchChain
  reversed: boolean
  score: number
  rmsErrorMm: number
  status: 'paired' | 'ambiguous' | 'rejected'
}

export type FoldPanel = {
  id: string
  layerId: string
  stackLevel?: number
  polygon: Point[]
  areaMm2: number
}

export type FoldHinge = {
  id: string
  foldLine: FoldLine
  fromPanelId: string
  toPanelId: string
  angleDeg: number
  signedAngleDeg: number
}

export type SolvedFoldPanel = FoldPanel & {
  transform: Matrix4
  offset: Vector3
}

export type FinalProductSolveResult = {
  panels: SolvedFoldPanel[]
  hinges: FoldHinge[]
  stitchChains: StitchChain[]
  stitchPairs: StitchPair[]
  diagnostics: FinalProductDiagnostic[]
  iterations: number
  converged: boolean
  rmsStitchErrorMm: number
  maxHingeErrorDeg: number
  collisionWarningCount: number
  foldSweepCollisionCount: number
  foldSweepWorstProgress?: number
  foldSweepSampleCount: number
  unpairedChainCount: number
}
