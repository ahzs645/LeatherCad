import { Vector3 } from 'three'
import type { StitchHole } from '../cad/cad-types'
import { findPanelContainingPoint } from './final-product-panel-graph'
import { solvePanelPoint } from './final-product-solver'
import type { FinalProductSolveResult, SolvedFoldPanel, StitchPair } from './final-product-types'
import { createClothState, stepXpbdCloth } from '@atelier/sim'
import { buildXpbdSeamDistanceConstraints } from './xpbd-seam-constraints'

export type XpbdFinalProductRelaxation = {
  holePositionsById: Map<string, Vector3>
  constraintCount: number
  rmsBeforeMm: number
  rmsAfterMm: number
}

function findPanelForHole(result: FinalProductSolveResult, hole: StitchHole) {
  const containingPanel = findPanelContainingPoint(result.panels, hole.point)
  if (containingPanel) {
    return result.panels.find((panel) => panel.id === containingPanel.id) ?? null
  }

  let bestPanel: SolvedFoldPanel | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const panel of result.panels) {
    const center = panel.polygon.reduce(
      (sum, entry) => ({ x: sum.x + entry.x / panel.polygon.length, y: sum.y + entry.y / panel.polygon.length }),
      { x: 0, y: 0 },
    )
    const distance = Math.hypot(center.x - hole.point.x, center.y - hole.point.y)
    if (distance < bestDistance) {
      bestDistance = distance
      bestPanel = panel
    }
  }
  return bestPanel
}

function pairRms(pairs: StitchPair[], positionsByHoleId: Map<string, Vector3>) {
  let sum = 0
  let count = 0
  for (const pair of pairs) {
    const rightHoles = pair.reversed ? [...pair.right.holes].reverse() : pair.right.holes
    const holeCount = Math.min(pair.left.holes.length, rightHoles.length)
    for (let index = 0; index < holeCount; index += 1) {
      const left = positionsByHoleId.get(pair.left.holes[index].id)
      const right = positionsByHoleId.get(rightHoles[index].id)
      if (!left || !right) {
        continue
      }
      sum += left.distanceToSquared(right)
      count += 1
    }
  }
  return count === 0 ? 0 : Math.sqrt(sum / count)
}

export function relaxFinalProductSeamsWithXpbd(result: FinalProductSolveResult): XpbdFinalProductRelaxation | null {
  if (result.stitchPairs.length === 0 || result.panels.length === 0) {
    return null
  }

  const holePositionsById = new Map<string, Vector3>()
  const particleIndexByHoleId = new Map<string, number>()

  for (const chain of result.stitchChains) {
    for (const hole of chain.holes) {
      if (particleIndexByHoleId.has(hole.id)) {
        continue
      }
      const panel = findPanelForHole(result, hole)
      if (!panel) {
        continue
      }
      particleIndexByHoleId.set(hole.id, particleIndexByHoleId.size)
      holePositionsById.set(hole.id, solvePanelPoint(panel, hole.point))
    }
  }

  const constraints = buildXpbdSeamDistanceConstraints({
    stitchPairs: result.stitchPairs,
    particleIndexByHoleId,
    compliance: 1e-8,
  })
  if (constraints.length === 0) {
    return null
  }

  const particleCount = particleIndexByHoleId.size
  const seedPositions = new Float32Array(particleCount * 3)
  for (const [holeId, particleIndex] of particleIndexByHoleId) {
    const position = holePositionsById.get(holeId)
    if (!position) {
      continue
    }
    const offset = particleIndex * 3
    seedPositions[offset] = position.x
    seedPositions[offset + 1] = position.y
    seedPositions[offset + 2] = position.z
  }
  const state = createClothState(seedPositions)

  const rmsBeforeMm = pairRms(result.stitchPairs, holePositionsById)
  stepXpbdCloth(state, constraints, {
    dt: 1 / 60,
    substeps: 2,
    iterations: 16,
    damping: 1,
  })

  for (const [holeId, particleIndex] of particleIndexByHoleId) {
    const offset = particleIndex * 3
    holePositionsById.set(holeId, new Vector3(
      state.positions[offset],
      state.positions[offset + 1],
      state.positions[offset + 2],
    ))
  }

  return {
    holePositionsById,
    constraintCount: constraints.length,
    rmsBeforeMm,
    rmsAfterMm: pairRms(result.stitchPairs, holePositionsById),
  }
}
