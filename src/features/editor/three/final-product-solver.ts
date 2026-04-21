import { Matrix4, Vector3 } from 'three'
import type { FoldLine, StitchHole } from '../cad/cad-types'
import type { Bounds2 } from './bridge/geometry-utils'
import { buildFinalProductPanelGraph, findPanelContainingPoint } from './final-product-panel-graph'
import { buildStitchChains, pairStitchChains } from './final-product-stitch-pairing'
import type {
  FinalProductDiagnostic,
  FinalProductSolveResult,
  FoldHinge,
  FoldPanel,
  SolvedFoldPanel,
  StitchPair,
} from './final-product-types'
import type { OutlinePolygon } from './three-bridge-types'

const DEFAULT_MAX_ITERATIONS = 160
const DEFAULT_STITCH_TOLERANCE_MM = 0.25
const DEFAULT_HINGE_TOLERANCE_DEG = 1

export type FinalProductSolveOptions = {
  maxIterations?: number
  stitchToleranceMm?: number
  hingeToleranceDeg?: number
}

export type FinalProductSolveInput = {
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  regions?: Array<{ layerId: string; polygon: { x: number; y: number }[] }>
  outlinePolygons?: OutlinePolygon[]
  documentBounds: Bounds2
  thicknessMm?: number
  options?: FinalProductSolveOptions
}

function pointToVector(point: { x: number; y: number }) {
  return new Vector3(point.x, 0, point.y)
}

function transformPoint(panel: SolvedFoldPanel, point: { x: number; y: number }) {
  return pointToVector(point).applyMatrix4(panel.transform).add(panel.offset)
}

function makeRotationAroundAxis(start: Vector3, end: Vector3, angleRad: number) {
  const axis = end.clone().sub(start)
  if (axis.lengthSq() <= 1e-9 || Math.abs(angleRad) <= 1e-9) {
    return new Matrix4()
  }
  axis.normalize()
  return new Matrix4()
    .makeTranslation(start.x, start.y, start.z)
    .multiply(new Matrix4().makeRotationAxis(axis, angleRad))
    .multiply(new Matrix4().makeTranslation(-start.x, -start.y, -start.z))
}

function buildSolvedPanels(panels: FoldPanel[], hinges: FoldHinge[]) {
  if (panels.length === 0) {
    return [] as SolvedFoldPanel[]
  }

  const transforms = new Map<string, Matrix4>()
  const root = [...panels].sort((left, right) => right.areaMm2 - left.areaMm2)[0]
  transforms.set(root.id, new Matrix4())

  const adjacency = new Map<string, Array<{ hinge: FoldHinge; nextPanelId: string; direction: 1 | -1 }>>()
  for (const hinge of hinges) {
    const fromEntries = adjacency.get(hinge.fromPanelId) ?? []
    fromEntries.push({ hinge, nextPanelId: hinge.toPanelId, direction: 1 })
    adjacency.set(hinge.fromPanelId, fromEntries)

    const toEntries = adjacency.get(hinge.toPanelId) ?? []
    toEntries.push({ hinge, nextPanelId: hinge.fromPanelId, direction: -1 })
    adjacency.set(hinge.toPanelId, toEntries)
  }

  const queue = [root.id]
  while (queue.length > 0) {
    const panelId = queue.shift()!
    const currentTransform = transforms.get(panelId)
    if (!currentTransform) {
      continue
    }

    for (const entry of adjacency.get(panelId) ?? []) {
      if (transforms.has(entry.nextPanelId)) {
        continue
      }
      const axisStart = pointToVector(entry.hinge.foldLine.start).applyMatrix4(currentTransform)
      const axisEnd = pointToVector(entry.hinge.foldLine.end).applyMatrix4(currentTransform)
      const angleRad = (entry.hinge.signedAngleDeg * entry.direction * Math.PI) / 180
      const rotation = makeRotationAroundAxis(axisStart, axisEnd, angleRad)
      transforms.set(entry.nextPanelId, rotation.multiply(currentTransform.clone()))
      queue.push(entry.nextPanelId)
    }
  }

  return panels.map((panel) => ({
    ...panel,
    transform: transforms.get(panel.id) ?? new Matrix4(),
    offset: new Vector3(),
  }))
}

function mostCommonPanelForChain(pairPanelMap: Map<string, string | null>, holes: StitchHole[]) {
  const counts = new Map<string, number>()
  for (const hole of holes) {
    const panelId = pairPanelMap.get(hole.id)
    if (!panelId) {
      continue
    }
    counts.set(panelId, (counts.get(panelId) ?? 0) + 1)
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
}

function stitchPairRmsForRightHoles(
  pair: StitchPair,
  rightHoles: StitchHole[],
  solvedPanelById: Map<string, SolvedFoldPanel>,
  holePanelMap: Map<string, string | null>,
) {
  let sum = 0
  let count = 0
  for (let index = 0; index < pair.left.holes.length; index += 1) {
    const leftHole = pair.left.holes[index]
    const rightHole = rightHoles[index]
    const leftPanel = solvedPanelById.get(holePanelMap.get(leftHole.id) ?? '')
    const rightPanel = solvedPanelById.get(holePanelMap.get(rightHole.id) ?? '')
    if (!leftPanel || !rightPanel) {
      continue
    }
    const leftPoint = transformPoint(leftPanel, leftHole.point)
    const rightPoint = transformPoint(rightPanel, rightHole.point)
    sum += leftPoint.distanceToSquared(rightPoint)
    count += 1
  }
  return count === 0 ? 0 : Math.sqrt(sum / count)
}

function stitchPairRms(pair: StitchPair, solvedPanelById: Map<string, SolvedFoldPanel>, holePanelMap: Map<string, string | null>) {
  return Math.min(
    stitchPairRmsForRightHoles(pair, pair.right.holes, solvedPanelById, holePanelMap),
    stitchPairRmsForRightHoles(pair, [...pair.right.holes].reverse(), solvedPanelById, holePanelMap),
  )
}

function bestMatchedRightHoles(
  pair: StitchPair,
  solvedPanelById: Map<string, SolvedFoldPanel>,
  holePanelMap: Map<string, string | null>,
) {
  const direct = pair.right.holes
  const reversed = [...pair.right.holes].reverse()
  const directRms = stitchPairRmsForRightHoles(pair, direct, solvedPanelById, holePanelMap)
  const reversedRms = stitchPairRmsForRightHoles(pair, reversed, solvedPanelById, holePanelMap)
  return reversedRms < directRms ? reversed : direct
}

function solveStitchOffsets({
  panels,
  pairs,
  holePanelMap,
  maxIterations,
  toleranceMm,
}: {
  panels: SolvedFoldPanel[]
  pairs: StitchPair[]
  holePanelMap: Map<string, string | null>
  maxIterations: number
  toleranceMm: number
}) {
  const panelById = new Map(panels.map((panel) => [panel.id, panel]))
  let rmsStitchErrorMm = pairs.length === 0 ? 0 : Number.POSITIVE_INFINITY
  let iterations = 0

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    iterations = iteration + 1
    const corrections = new Map<string, { delta: Vector3; count: number }>()
    let sum = 0
    let count = 0

    for (const pair of pairs) {
      const leftPanelId = mostCommonPanelForChain(holePanelMap, pair.left.holes)
      const rightHoles = bestMatchedRightHoles(pair, panelById, holePanelMap)
      const rightPanelId = mostCommonPanelForChain(holePanelMap, rightHoles)
      if (!leftPanelId || !rightPanelId || leftPanelId === rightPanelId) {
        continue
      }
      const leftPanel = panelById.get(leftPanelId)
      const rightPanel = panelById.get(rightPanelId)
      if (!leftPanel || !rightPanel) {
        continue
      }

      const pairDelta = new Vector3()
      let pairCount = 0
      for (let index = 0; index < pair.left.holes.length; index += 1) {
        const leftPoint = transformPoint(leftPanel, pair.left.holes[index].point)
        const rightPoint = transformPoint(rightPanel, rightHoles[index].point)
        const delta = leftPoint.sub(rightPoint)
        pairDelta.add(delta)
        sum += delta.lengthSq()
        count += 1
        pairCount += 1
      }

      if (pairCount > 0) {
        pairDelta.multiplyScalar(1 / pairCount)
        const targetPanelId = rightPanelId
        const correction = corrections.get(targetPanelId) ?? { delta: new Vector3(), count: 0 }
        correction.delta.add(pairDelta)
        correction.count += 1
        corrections.set(targetPanelId, correction)
      }
    }

    rmsStitchErrorMm = count === 0 ? 0 : Math.sqrt(sum / count)
    if (rmsStitchErrorMm <= toleranceMm || corrections.size === 0) {
      break
    }

    for (const [panelId, correction] of corrections) {
      const panel = panelById.get(panelId)
      if (!panel) {
        continue
      }
      panel.offset.add(correction.delta.multiplyScalar(0.45 / correction.count))
    }
  }

  if (pairs.length > 0) {
    let sum = 0
    for (const pair of pairs) {
      const pairRms = stitchPairRms(pair, panelById, holePanelMap)
      pair.rmsErrorMm = pairRms
      sum += pairRms * pairRms
    }
    rmsStitchErrorMm = Math.sqrt(sum / pairs.length)
  }

  return { iterations, rmsStitchErrorMm }
}

function collisionDiagnostics(panels: SolvedFoldPanel[], thicknessMm: number) {
  const diagnostics: FinalProductDiagnostic[] = []
  let count = 0

  const bounds = panels.map((panel) => {
    const points = panel.polygon.map((point) => transformPoint(panel, point))
    return {
      panel,
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)),
      maxY: Math.max(...points.map((point) => point.y)),
      minZ: Math.min(...points.map((point) => point.z)),
      maxZ: Math.max(...points.map((point) => point.z)),
    }
  })

  for (let leftIndex = 0; leftIndex < bounds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < bounds.length; rightIndex += 1) {
      const left = bounds[leftIndex]
      const right = bounds[rightIndex]
      const planarOverlap =
        left.minX <= right.maxX &&
        left.maxX >= right.minX &&
        left.minZ <= right.maxZ &&
        left.maxZ >= right.minZ
      const verticalOverlap = left.minY - thicknessMm <= right.maxY && left.maxY + thicknessMm >= right.minY
      if (planarOverlap && verticalOverlap) {
        count += 1
      }
    }
  }

  if (count > 0) {
    diagnostics.push({
      id: 'final-product-collision-warning',
      code: 'panel-clearance-warning',
      severity: 'warning',
      message: `${count} panel overlap/clearance warning${count === 1 ? '' : 's'} found in the settled state.`,
    })
  }

  return { count, diagnostics }
}

function assignHolesToPanels(panels: FoldPanel[], stitchHoles: StitchHole[]) {
  const result = new Map<string, string | null>()
  for (const hole of stitchHoles) {
    result.set(hole.id, findPanelContainingPoint(panels, hole.point)?.id ?? null)
  }
  return result
}

export function solveFinalProduct({
  foldLines,
  stitchHoles,
  regions,
  outlinePolygons,
  documentBounds,
  thicknessMm = 1.8,
  options = {},
}: FinalProductSolveInput): FinalProductSolveResult {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const stitchToleranceMm = options.stitchToleranceMm ?? DEFAULT_STITCH_TOLERANCE_MM
  const hingeToleranceDeg = options.hingeToleranceDeg ?? DEFAULT_HINGE_TOLERANCE_DEG
  const diagnostics: FinalProductDiagnostic[] = []

  const panelGraph = buildFinalProductPanelGraph({ foldLines, regions, outlinePolygons, documentBounds })
  diagnostics.push(...panelGraph.diagnostics)

  const { chains, diagnostics: chainDiagnostics } = buildStitchChains(stitchHoles)
  diagnostics.push(...chainDiagnostics)

  const { pairs, diagnostics: pairDiagnostics } = pairStitchChains(chains)
  diagnostics.push(...pairDiagnostics)

  if (foldLines.length === 0) {
    diagnostics.push({
      id: 'final-product-no-folds',
      code: 'no-fold-lines',
      severity: 'warning',
      message: 'Final Product mode needs fold lines to build a folded-state panel graph.',
    })
  }

  if (stitchHoles.length > 0 && pairs.length === 0) {
    diagnostics.push({
      id: 'final-product-no-stitch-pairs',
      code: 'no-stitch-pairs',
      severity: 'warning',
      message: 'No stitch chains could be paired automatically.',
    })
  }

  const solvedPanels = buildSolvedPanels(panelGraph.panels, panelGraph.hinges)
  const holePanelMap = assignHolesToPanels(panelGraph.panels, stitchHoles)
  const { iterations, rmsStitchErrorMm } = solveStitchOffsets({
    panels: solvedPanels,
    pairs,
    holePanelMap,
    maxIterations,
    toleranceMm: stitchToleranceMm,
  })

  const maxHingeErrorDeg = 0
  const { count: collisionWarningCount, diagnostics: collisionWarnings } = collisionDiagnostics(solvedPanels, thicknessMm)
  diagnostics.push(...collisionWarnings)

  if (pairs.length > 0 && rmsStitchErrorMm > stitchToleranceMm) {
    diagnostics.push({
      id: 'final-product-stitch-rms-high',
      code: 'stitch-rms-high',
      severity: 'warning',
      message: `Paired stitch RMS is ${rmsStitchErrorMm.toFixed(2)}mm after settling.`,
    })
  }

  const unpairedChainCount = Math.max(0, chains.length - pairs.length * 2)
  const hasBlockingDiagnostics = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  const converged =
    !hasBlockingDiagnostics &&
    pairs.length > 0 &&
    unpairedChainCount === 0 &&
    rmsStitchErrorMm <= stitchToleranceMm &&
    maxHingeErrorDeg <= hingeToleranceDeg

  return {
    panels: solvedPanels,
    hinges: panelGraph.hinges,
    stitchChains: chains,
    stitchPairs: pairs,
    diagnostics,
    iterations,
    converged,
    rmsStitchErrorMm,
    maxHingeErrorDeg,
    collisionWarningCount,
    unpairedChainCount,
  }
}

export function projectSolvedPointForPreview(
  panel: SolvedFoldPanel,
  point: { x: number; y: number },
  transform: { scale: number; centerX: number; centerY: number },
) {
  const solved = transformPoint(panel, point)
  return new Vector3(
    (solved.x - transform.centerX) * transform.scale,
    solved.y * transform.scale,
    -(solved.z - transform.centerY) * transform.scale,
  )
}
