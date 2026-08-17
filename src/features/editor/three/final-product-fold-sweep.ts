import type { FoldInstructionNode, FoldLine, StitchHole } from '../cad/cad-types'
import type { Bounds2 } from './bridge/geometry-utils'
import { foldLinesAtTimelineProgress, foldOrderRankFromTimeline, compileFoldTimeline } from './fold-timeline'
import { solveFinalProduct } from './final-product-solver'
import type { FinalProductDiagnostic, StitchChain, StitchPair } from './final-product-types'
import type { OutlinePolygon } from './three-bridge-types'

export type FinalProductFoldSweepResult = {
  collisionCount: number
  worstProgress?: number
  sampleCount: number
  diagnostics: FinalProductDiagnostic[]
}

export function analyzeFinalProductFoldSweep({
  foldLines,
  instructions,
  stitchHoles,
  explicitStitchChains = [],
  explicitStitchPairs = [],
  regions,
  outlinePolygons,
  documentBounds,
  thicknessMm,
  sampleCount = 21,
}: {
  foldLines: FoldLine[]
  instructions?: FoldInstructionNode[]
  stitchHoles: StitchHole[]
  explicitStitchChains?: StitchChain[]
  explicitStitchPairs?: StitchPair[]
  regions?: Array<{ layerId: string; stackLevel?: number; polygon: { x: number; y: number }[] }>
  outlinePolygons: OutlinePolygon[]
  documentBounds: Bounds2
  thicknessMm: number
  sampleCount?: number
}): FinalProductFoldSweepResult {
  const resolvedSampleCount = Math.max(2, Math.round(sampleCount))
  const timeline = compileFoldTimeline({ foldLines, instructions })
  const foldOrderRank = foldOrderRankFromTimeline(timeline)
  let collisionCount = 0
  let worstProgress: number | undefined
  let worstCollisionCount = 0

  for (let index = 0; index < resolvedSampleCount; index += 1) {
    const progress = index / (resolvedSampleCount - 1)
    const sampledFoldLines = foldLinesAtTimelineProgress(foldLines, timeline, progress)
    const result = solveFinalProduct({
      foldLines: sampledFoldLines,
      stitchHoles,
      explicitStitchChains,
      explicitStitchPairs,
      regions,
      outlinePolygons,
      documentBounds,
      thicknessMm,
      foldOrderRank,
      options: {
        maxIterations: 40,
      },
    })
    collisionCount += result.collisionWarningCount
    if (result.collisionWarningCount > worstCollisionCount) {
      worstCollisionCount = result.collisionWarningCount
      worstProgress = progress
    }
  }

  const diagnostics: FinalProductDiagnostic[] = collisionCount > 0
    ? [{
        id: 'final-product-fold-sweep-collision-warning',
        code: 'fold-sweep-collision-warning',
        severity: 'warning',
        message: `Fold sweep found ${collisionCount} panel clearance warning${collisionCount === 1 ? '' : 's'} across ${resolvedSampleCount} sampled progress states${worstProgress === undefined ? '' : `; worst near ${Math.round(worstProgress * 100)}%`}.`,
      }]
    : []

  return {
    collisionCount,
    worstProgress,
    sampleCount: resolvedSampleCount,
    diagnostics,
  }
}
