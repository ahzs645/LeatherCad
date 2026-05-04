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
  StitchChain,
  StitchPair,
} from './final-product-types'
import type { OutlinePolygon } from './three-bridge-types'

const DEFAULT_MAX_ITERATIONS = 160
const DEFAULT_STITCH_TOLERANCE_MM = 0.25
const DEFAULT_HINGE_TOLERANCE_DEG = 1
const FOLD_CLEARANCE_START_DEG = 0.5

export type FinalProductSolveOptions = {
  maxIterations?: number
  stitchToleranceMm?: number
  hingeToleranceDeg?: number
}

export type FinalProductSolveInput = {
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  explicitStitchChains?: StitchChain[]
  explicitStitchPairs?: StitchPair[]
  explicitDiagnostics?: FinalProductDiagnostic[]
  regions?: Array<{ layerId: string; stackLevel?: number; polygon: { x: number; y: number }[] }>
  outlinePolygons?: OutlinePolygon[]
  documentBounds: Bounds2
  thicknessMm?: number
  options?: FinalProductSolveOptions
}

function pointToVector(point: { x: number; y: number }) {
  return new Vector3(point.x, 0, point.y)
}

export function solvePanelPoint(panel: SolvedFoldPanel, point: { x: number; y: number }) {
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

function panelCentroid(panel: FoldPanel) {
  if (panel.polygon.length === 0) return { x: 0, y: 0 }
  return {
    x: panel.polygon.reduce((sum, point) => sum + point.x, 0) / panel.polygon.length,
    y: panel.polygon.reduce((sum, point) => sum + point.y, 0) / panel.polygon.length,
  }
}

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const intersects =
      (current.y > point.y) !== (previous.y > point.y) &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || 1e-9) + current.x
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

function inheritStackTransforms(panels: FoldPanel[], transforms: Map<string, Matrix4>) {
  const orderedPanels = [...panels].sort((left, right) => (left.stackLevel ?? 0) - (right.stackLevel ?? 0))

  for (const panel of orderedPanels) {
    const stackLevel = panel.stackLevel ?? 0
    if (stackLevel <= 0) {
      continue
    }

    const center = panelCentroid(panel)
    const carrier = orderedPanels
      .filter((candidate) => transforms.has(candidate.id) && candidate.id !== panel.id && (candidate.stackLevel ?? 0) < stackLevel)
      .sort((left, right) => {
        const stackDelta = (right.stackLevel ?? 0) - (left.stackLevel ?? 0)
        if (stackDelta !== 0) return stackDelta
        return right.areaMm2 - left.areaMm2
      })
      .find((candidate) => pointInPolygon(center, candidate.polygon))

    if (carrier) {
      transforms.set(panel.id, transforms.get(carrier.id)!.clone())
    }
  }
}

function inheritStackClearanceLevels(
  panels: FoldPanel[],
  transforms: Map<string, Matrix4>,
  closedFoldClearanceLevelById: Map<string, number>,
) {
  const orderedPanels = [...panels].sort((left, right) => (left.stackLevel ?? 0) - (right.stackLevel ?? 0))

  for (const panel of orderedPanels) {
    const stackLevel = panel.stackLevel ?? 0
    if (stackLevel <= 0 || closedFoldClearanceLevelById.has(panel.id)) {
      continue
    }

    const center = panelCentroid(panel)
    const carrier = orderedPanels
      .filter((candidate) => transforms.has(candidate.id) && candidate.id !== panel.id && (candidate.stackLevel ?? 0) < stackLevel)
      .sort((left, right) => {
        const stackDelta = (right.stackLevel ?? 0) - (left.stackLevel ?? 0)
        if (stackDelta !== 0) return stackDelta
        return right.areaMm2 - left.areaMm2
      })
      .find((candidate) => pointInPolygon(center, candidate.polygon))

    if (carrier) {
      closedFoldClearanceLevelById.set(panel.id, closedFoldClearanceLevelById.get(carrier.id) ?? 0)
    }
  }
}

function stackOffsetForPanel(
  panel: FoldPanel,
  transform: Matrix4,
  stackStepMm: number,
  closedFoldClearanceLevel: number,
) {
  const stackDistance = (panel.stackLevel ?? 0) * stackStepMm
  const offset = new Vector3(0, closedFoldClearanceLevel * stackStepMm, 0)
  if (stackDistance > 0) {
    const normal = new Vector3(0, 1, 0).applyMatrix4(transform).sub(new Vector3(0, 0, 0).applyMatrix4(transform)).normalize()
    offset.add(normal.multiplyScalar(stackDistance))
  }
  return offset
}

function buildSolvedPanels(panels: FoldPanel[], hinges: FoldHinge[], stackStepMm: number) {
  if (panels.length === 0) {
    return [] as SolvedFoldPanel[]
  }

  const transforms = new Map<string, Matrix4>()
  const closedFoldClearanceLevelById = new Map<string, number>()
  const root = [...panels].sort((left, right) => right.areaMm2 - left.areaMm2)[0]
  transforms.set(root.id, new Matrix4())
  closedFoldClearanceLevelById.set(root.id, 0)
  const foldClearanceLevelByLineId = new Map<string, number>()
  for (const hinge of hinges) {
    if (foldClearanceLevelByLineId.has(hinge.foldLine.id)) {
      continue
    }
    const closureFactor = Math.abs(hinge.signedAngleDeg) <= FOLD_CLEARANCE_START_DEG ? 0 : 1
    foldClearanceLevelByLineId.set(hinge.foldLine.id, (foldClearanceLevelByLineId.size + 1) * closureFactor)
  }

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
      const closedFoldRank = foldClearanceLevelByLineId.get(entry.hinge.foldLine.id) ?? 0
      const currentClearanceLevel = closedFoldClearanceLevelById.get(panelId) ?? 0
      closedFoldClearanceLevelById.set(entry.nextPanelId, Math.max(currentClearanceLevel, closedFoldRank))
      queue.push(entry.nextPanelId)
    }
  }

  inheritStackTransforms(panels, transforms)
  inheritStackClearanceLevels(panels, transforms, closedFoldClearanceLevelById)

  return panels.map((panel) => ({
    ...panel,
    transform: transforms.get(panel.id) ?? new Matrix4(),
    offset: stackOffsetForPanel(
      panel,
      transforms.get(panel.id) ?? new Matrix4(),
      stackStepMm,
      closedFoldClearanceLevelById.get(panel.id) ?? 0,
    ),
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
    const leftPoint = solvePanelPoint(leftPanel, leftHole.point)
    const rightPoint = solvePanelPoint(rightPanel, rightHole.point)
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
        const leftPoint = solvePanelPoint(leftPanel, pair.left.holes[index].point)
        const rightPoint = solvePanelPoint(rightPanel, rightHoles[index].point)
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

type SolvedPanelCollisionData = {
  panel: SolvedFoldPanel
  points: Vector3[]
  testPoints: Vector3[]
  normal: Vector3
  basisU: Vector3
  basisV: Vector3
  projectedPolygon: Array<{ x: number; y: number }>
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

function distancePointToSegment2d(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-12) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

function minDistanceToPolygonEdge(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  if (polygon.length === 0) {
    return 0
  }
  let minDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    minDistance = Math.min(minDistance, distancePointToSegment2d(point, polygon[index], polygon[(index + 1) % polygon.length]))
  }
  return minDistance
}

function panelNormal(points: Vector3[]) {
  if (points.length < 3) {
    return new Vector3(0, 1, 0)
  }

  const origin = points[0]
  for (let index = 1; index < points.length - 1; index += 1) {
    const normal = points[index].clone().sub(origin).cross(points[index + 1].clone().sub(origin))
    if (normal.lengthSq() > 1e-10) {
      return normal.normalize()
    }
  }
  return new Vector3(0, 1, 0)
}

function panelBasis(points: Vector3[], normal: Vector3) {
  const origin = points[0] ?? new Vector3()
  const basisU = points
    .slice(1)
    .map((point) => point.clone().sub(origin))
    .find((edge) => edge.lengthSq() > 1e-10)
    ?.normalize() ?? new Vector3(1, 0, 0)
  const basisV = normal.clone().cross(basisU)
  if (basisV.lengthSq() <= 1e-10) {
    return { basisU: new Vector3(1, 0, 0), basisV: new Vector3(0, 0, 1) }
  }
  basisV.normalize()
  return { basisU, basisV }
}

function projectPointToPanelBasis(point: Vector3, origin: Vector3, basisU: Vector3, basisV: Vector3) {
  const local = point.clone().sub(origin)
  return {
    x: local.dot(basisU),
    y: local.dot(basisV),
  }
}

function pointInProjectedPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>, edgeMarginMm = 0) {
  let inside = false
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const intersects =
      (current.y > point.y) !== (previous.y > point.y) &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || 1e-9) + current.x
    if (intersects) {
      inside = !inside
    }
  }
  return inside && (edgeMarginMm <= 0 || minDistanceToPolygonEdge(point, polygon) > edgeMarginMm)
}

function buildPanelCollisionData(panel: SolvedFoldPanel): SolvedPanelCollisionData {
  const points = panel.polygon.map((point) => solvePanelPoint(panel, point))
  const center = panelCentroid(panel)
  const centerPoint = solvePanelPoint(panel, center)
  const normal = panelNormal(points)
  const { basisU, basisV } = panelBasis(points, normal)
  const origin = points[0] ?? new Vector3()
  const projectedPolygon = points.map((point) => projectPointToPanelBasis(point, origin, basisU, basisV))
  return {
    panel,
    points,
    testPoints: [...points, centerPoint],
    normal,
    basisU,
    basisV,
    projectedPolygon,
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
    minZ: Math.min(...points.map((point) => point.z)),
    maxZ: Math.max(...points.map((point) => point.z)),
  }
}

function broadPhaseOverlaps(left: SolvedPanelCollisionData, right: SolvedPanelCollisionData, thicknessMm: number) {
  const padding = thicknessMm
  return (
    left.minX - padding <= right.maxX &&
    left.maxX + padding >= right.minX &&
    left.minY - padding <= right.maxY &&
    left.maxY + padding >= right.minY &&
    left.minZ - padding <= right.maxZ &&
    left.maxZ + padding >= right.minZ
  )
}

function pointPenetratesPanel(point: Vector3, panel: SolvedPanelCollisionData, thicknessMm: number) {
  const origin = panel.points[0]
  if (!origin) {
    return false
  }

  const signedDistance = point.clone().sub(origin).dot(panel.normal)
  if (Math.abs(signedDistance) >= thicknessMm * 0.92) {
    return false
  }
  const projected = point.clone().addScaledVector(panel.normal, -signedDistance)
  return pointInProjectedPolygon(
    projectPointToPanelBasis(projected, origin, panel.basisU, panel.basisV),
    panel.projectedPolygon,
    thicknessMm * 0.2,
  )
}

function panelPairHasClearanceCollision(left: SolvedPanelCollisionData, right: SolvedPanelCollisionData, thicknessMm: number) {
  if (!broadPhaseOverlaps(left, right, thicknessMm)) {
    return false
  }
  return (
    left.testPoints.some((point) => pointPenetratesPanel(point, right, thicknessMm)) ||
    right.testPoints.some((point) => pointPenetratesPanel(point, left, thicknessMm))
  )
}

function isIntendedStackPair(left: SolvedFoldPanel, right: SolvedFoldPanel) {
  return (left.stackLevel ?? 0) !== (right.stackLevel ?? 0)
}

function panelComponentIds(panels: SolvedFoldPanel[], hinges: FoldHinge[]) {
  const adjacency = new Map<string, string[]>()
  for (const panel of panels) {
    adjacency.set(panel.id, [])
  }
  for (const hinge of hinges) {
    adjacency.get(hinge.fromPanelId)?.push(hinge.toPanelId)
    adjacency.get(hinge.toPanelId)?.push(hinge.fromPanelId)
  }

  const componentByPanelId = new Map<string, number>()
  let component = 0
  for (const panel of panels) {
    if (componentByPanelId.has(panel.id)) {
      continue
    }
    component += 1
    const queue = [panel.id]
    componentByPanelId.set(panel.id, component)
    while (queue.length > 0) {
      const panelId = queue.shift()!
      for (const nextPanelId of adjacency.get(panelId) ?? []) {
        if (componentByPanelId.has(nextPanelId)) {
          continue
        }
        componentByPanelId.set(nextPanelId, component)
        queue.push(nextPanelId)
      }
    }
  }
  return componentByPanelId
}

export function collisionDiagnostics(panels: SolvedFoldPanel[], hinges: FoldHinge[], thicknessMm: number) {
  const diagnostics: FinalProductDiagnostic[] = []
  let count = 0
  const hingedPanelPairs = new Set(
    hinges.map((hinge) => [hinge.fromPanelId, hinge.toPanelId].sort().join('|')),
  )
  const componentByPanelId = panelComponentIds(panels, hinges)

  const bounds = panels.map(buildPanelCollisionData)

  for (let leftIndex = 0; leftIndex < bounds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < bounds.length; rightIndex += 1) {
      const left = bounds[leftIndex]
      const right = bounds[rightIndex]
      if (hingedPanelPairs.has([left.panel.id, right.panel.id].sort().join('|'))) {
        continue
      }
      if (isIntendedStackPair(left.panel, right.panel)) {
        continue
      }
      if (
        left.panel.layerId === right.panel.layerId &&
        componentByPanelId.get(left.panel.id) === componentByPanelId.get(right.panel.id)
      ) {
        continue
      }

      if (panelPairHasClearanceCollision(left, right, thicknessMm)) {
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
  explicitStitchChains = [],
  explicitStitchPairs = [],
  explicitDiagnostics = [],
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
  diagnostics.push(...explicitDiagnostics)

  const panelGraph = buildFinalProductPanelGraph({ foldLines, regions, outlinePolygons, documentBounds })
  diagnostics.push(...panelGraph.diagnostics)

  const { chains, diagnostics: chainDiagnostics } = buildStitchChains(stitchHoles)
  diagnostics.push(...chainDiagnostics)

  const { pairs, diagnostics: pairDiagnostics } = pairStitchChains(chains)
  diagnostics.push(...pairDiagnostics)
  const allChains = [...explicitStitchChains, ...chains]
  const allPairs = [...explicitStitchPairs, ...pairs]

  if (foldLines.length === 0) {
    diagnostics.push({
      id: 'final-product-no-folds',
      code: 'no-fold-lines',
      severity: 'warning',
      message: 'Final Product mode needs fold lines to build a folded-state panel graph.',
    })
  }

  if (stitchHoles.length > 0 && allPairs.length === 0) {
    diagnostics.push({
      id: 'final-product-no-stitch-pairs',
      code: 'no-stitch-pairs',
      severity: 'warning',
      message: 'No stitch chains could be paired automatically.',
    })
  }

  const solvedPanels = buildSolvedPanels(panelGraph.panels, panelGraph.hinges, thicknessMm)
  const allHoles = allChains.flatMap((chain) => chain.holes)
  const holePanelMap = assignHolesToPanels(panelGraph.panels, allHoles)
  const { iterations, rmsStitchErrorMm } = solveStitchOffsets({
    panels: solvedPanels,
    pairs: allPairs,
    holePanelMap,
    maxIterations,
    toleranceMm: stitchToleranceMm,
  })

  const maxHingeErrorDeg = 0
  const { count: collisionWarningCount, diagnostics: collisionWarnings } = collisionDiagnostics(
    solvedPanels,
    panelGraph.hinges,
    thicknessMm,
  )
  diagnostics.push(...collisionWarnings)

  if (allPairs.length > 0 && rmsStitchErrorMm > stitchToleranceMm) {
    diagnostics.push({
      id: 'final-product-stitch-rms-high',
      code: 'stitch-rms-high',
      severity: 'warning',
      message: `Paired stitch RMS is ${rmsStitchErrorMm.toFixed(2)}mm after settling.`,
    })
  }

  const unpairedChainCount = Math.max(0, allChains.length - allPairs.length * 2)
  const hasBlockingDiagnostics = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  const converged =
    !hasBlockingDiagnostics &&
    allPairs.length > 0 &&
    unpairedChainCount === 0 &&
    rmsStitchErrorMm <= stitchToleranceMm &&
    maxHingeErrorDeg <= hingeToleranceDeg

  return {
    panels: solvedPanels,
    hinges: panelGraph.hinges,
    stitchChains: allChains,
    stitchPairs: allPairs,
    diagnostics,
    iterations,
    converged,
    rmsStitchErrorMm,
    maxHingeErrorDeg,
    collisionWarningCount,
    foldSweepCollisionCount: 0,
    foldSweepSampleCount: 0,
    unpairedChainCount,
  }
}

export function projectSolvedPointForPreview(
  panel: SolvedFoldPanel,
  point: { x: number; y: number },
  transform: { scale: number; centerX: number; centerY: number },
) {
  const solved = solvePanelPoint(panel, point)
  return new Vector3(
    (solved.x - transform.centerX) * transform.scale,
    solved.y * transform.scale,
    -(solved.z - transform.centerY) * transform.scale,
  )
}
