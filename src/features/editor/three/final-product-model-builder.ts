import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  ShapeUtils,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import type { FoldLine, StitchHole } from '../cad/cad-types'
import { buildAssemblyDiagnostics, type AssemblyDiagnostic } from '../assembly/assembly-diagnostics'
import { compileExplicitSeams } from '../assembly/seam-stitch-compiler'
import { clearGroup } from './bridge/scene-lifecycle'
import { findPanelContainingPoint } from './final-product-panel-graph'
import { solveFinalProduct, projectSolvedPointForPreview } from './final-product-solver'
import type { FinalProductDiagnostic, FinalProductSolveResult, SolvedFoldPanel, StitchPair } from './final-product-types'
import { buildFinalProductRegions } from './final-product-regions'
import { relaxFinalProductSeamsWithXpbd, type XpbdFinalProductRelaxation } from './final-product-xpbd-relaxation'
import { buildFoldTimelinePreview, foldOrderRankFromTimeline } from './fold-timeline'
import { analyzeFinalProductFoldSweep, type FinalProductFoldSweepResult } from './final-product-fold-sweep'
import type { CommonRebuildParams } from './model-builder-types'
import {
  buildThreadSegments,
  saddleStitchSegments,
  createThreadMaterial,
  type ThreadSegment,
} from './stitch-thread'

const STITCH_SPHERE_SEGMENTS = 8
const STITCH_SPHERE_RADIUS = 0.006
const STITCH_THREAD_RADIUS = 0.0035
const MIN_PANEL_THICKNESS_SCENE = 0.001

export type RebuildFinalProductModelParams = CommonRebuildParams & {
  finalProductGroup: Group
  staticSideGroup: Group
  foldingSideGroup: Group
  foldGuideGroup: Group
  assembledGroup: Group
  avatarGroup: Group
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

function pushVertex(
  vertices: number[],
  uvs: number[],
  point: Vector3,
  source: { x: number; y: number },
) {
  vertices.push(point.x, point.y, point.z)
  uvs.push(source.x, source.y)
}

function isPointOnSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-8) {
    return false
  }

  const cross = dx * (point.y - start.y) - dy * (point.x - start.x)
  if (Math.abs(cross) > 1e-4) {
    return false
  }

  const dot = (point.x - start.x) * dx + (point.y - start.y) * dy
  return dot >= -1e-4 && dot <= lengthSquared + 1e-4
}

function isFoldEdge(edgeStart: { x: number; y: number }, edgeEnd: { x: number; y: number }, foldLines: FoldLine[]) {
  return foldLines.some(
    (foldLine) =>
      isPointOnSegment(edgeStart, foldLine.start, foldLine.end) &&
      isPointOnSegment(edgeEnd, foldLine.start, foldLine.end),
  )
}

function sideOfFoldLine(point: { x: number; y: number }, foldLine: FoldLine) {
  return (
    (foldLine.end.x - foldLine.start.x) * (point.y - foldLine.start.y) -
    (foldLine.end.y - foldLine.start.y) * (point.x - foldLine.start.x)
  )
}

function foldLineNormal(foldLine: FoldLine) {
  const dx = foldLine.end.x - foldLine.start.x
  const dy = foldLine.end.y - foldLine.start.y
  const length = Math.hypot(dx, dy)
  return {
    x: length <= 1e-6 ? 0 : -dy / length,
    y: length <= 1e-6 ? 0 : dx / length,
  }
}

function panelCentroid(panel: SolvedFoldPanel) {
  if (panel.polygon.length === 0) {
    return { x: 0, y: 0 }
  }
  return {
    x: panel.polygon.reduce((sum, point) => sum + point.x, 0) / panel.polygon.length,
    y: panel.polygon.reduce((sum, point) => sum + point.y, 0) / panel.polygon.length,
  }
}

function foldBandWidthMm(foldLine: FoldLine, thicknessMm: number, maxStackLevel: number) {
  const stackAllowance = thicknessMm * Math.max(1, maxStackLevel + 1)
  return Math.max(foldLine.radiusMm ?? 0, foldLine.clearanceMm ?? 0, stackAllowance, 2)
}

function leatherFoldWidthMm(foldLine: FoldLine, thicknessMm: number) {
  return Math.max(foldLine.radiusMm ?? 0, thicknessMm * 1.5, 1.2)
}

function panelFoldInsetMm(panel: SolvedFoldPanel, foldLine: FoldLine, thicknessMm: number, maxStackLevel: number) {
  if ((panel.stackLevel ?? 0) === 0) {
    return leatherFoldWidthMm(foldLine, thicknessMm)
  }
  return foldBandWidthMm(foldLine, thicknessMm, maxStackLevel)
}

function renderPointForPanel(
  panel: SolvedFoldPanel,
  point: { x: number; y: number },
  foldLines: FoldLine[],
  thicknessMm: number,
  maxStackLevel: number,
) {
  for (const foldLine of foldLines) {
    if (!isPointOnSegment(point, foldLine.start, foldLine.end)) {
      continue
    }
    const side = Math.sign(sideOfFoldLine(panelCentroid(panel), foldLine))
    if (side === 0) {
      continue
    }
    const normal = foldLineNormal(foldLine)
    const insetMm = panelFoldInsetMm(panel, foldLine, thicknessMm, maxStackLevel)
    return {
      x: point.x + normal.x * side * insetMm,
      y: point.y + normal.y * side * insetMm,
    }
  }
  return point
}

function createPanelGeometry(
  panel: SolvedFoldPanel,
  transform: CommonRebuildParams['transform'],
  thicknessMm: number,
  foldLines: FoldLine[],
  maxStackLevel: number,
) {
  if (panel.polygon.length < 3) {
    return null
  }

  const points2d = panel.polygon.map((point) => new Vector2(point.x, point.y))
  const triangles = ShapeUtils.triangulateShape(points2d, [])
  if (triangles.length === 0) {
    return null
  }

  const renderPolygon = panel.polygon.map((point) => renderPointForPanel(panel, point, foldLines, thicknessMm, maxStackLevel))
  const projected = renderPolygon.map((point) => projectSolvedPointForPreview(panel, point, transform))
  const normal = panelNormal(projected)
  const halfThickness = Math.max(MIN_PANEL_THICKNESS_SCENE, thicknessMm * transform.scale * 0.5)
  const front = projected.map((point) => point.clone().addScaledVector(normal, halfThickness))
  const back = projected.map((point) => point.clone().addScaledVector(normal, -halfThickness))
  const vertices: number[] = []
  const uvs: number[] = []

  for (const triangle of triangles) {
    for (const index of triangle) {
      pushVertex(vertices, uvs, front[index], renderPolygon[index])
    }
    for (const index of [...triangle].reverse()) {
      pushVertex(vertices, uvs, back[index], renderPolygon[index])
    }
  }

  if ((panel.stackLevel ?? 0) === 0) {
    for (let index = 0; index < projected.length; index += 1) {
      const nextIndex = (index + 1) % projected.length
      if (isFoldEdge(panel.polygon[index], panel.polygon[nextIndex], foldLines)) {
        continue
      }
      pushVertex(vertices, uvs, front[index], renderPolygon[index])
      pushVertex(vertices, uvs, back[index], renderPolygon[index])
      pushVertex(vertices, uvs, back[nextIndex], renderPolygon[nextIndex])
      pushVertex(vertices, uvs, front[index], renderPolygon[index])
      pushVertex(vertices, uvs, back[nextIndex], renderPolygon[nextIndex])
      pushVertex(vertices, uvs, front[nextIndex], renderPolygon[nextIndex])
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function addPanelMeshes(
  group: Group,
  result: FinalProductSolveResult,
  material: MeshStandardMaterial,
  transform: CommonRebuildParams['transform'],
  thicknessMm: number,
) {
  const maxStackLevel = Math.max(0, ...result.panels.map((panel) => panel.stackLevel ?? 0))
  for (const panel of result.panels) {
    const geometry = createPanelGeometry(panel, transform, thicknessMm, result.hinges.map((hinge) => hinge.foldLine), maxStackLevel)
    if (!geometry) {
      continue
    }
    const panelMaterial = material.clone()
    panelMaterial.color = material.color.clone()
    panelMaterial.needsUpdate = true
    const mesh = new Mesh(geometry, panelMaterial)
    mesh.name = `final-product-panel-${panel.id}`
    group.add(mesh)
    if ((panel.stackLevel ?? 0) === 0) {
      addPanelEdgeFinishing(group, panel, panelMaterial, transform, thicknessMm, result.hinges.map((hinge) => hinge.foldLine), maxStackLevel)
    }
  }
}

function addPanelEdgeFinishing(
  group: Group,
  panel: SolvedFoldPanel,
  material: MeshStandardMaterial,
  transform: CommonRebuildParams['transform'],
  thicknessMm: number,
  foldLines: FoldLine[],
  maxStackLevel: number,
) {
  if (panel.polygon.length < 2) {
    return
  }

  const projected = panel.polygon
    .map((point) => renderPointForPanel(panel, point, foldLines, thicknessMm, maxStackLevel))
    .map((point) => projectSolvedPointForPreview(panel, point, transform))
  const normal = panelNormal(projected)
  const halfThickness = Math.max(MIN_PANEL_THICKNESS_SCENE, thicknessMm * transform.scale * 0.5)
  const frontOffset = halfThickness + 0.0015
  const backOffset = -halfThickness - 0.0015
  const vertices: number[] = []

  for (let index = 0; index < panel.polygon.length; index += 1) {
    const nextIndex = (index + 1) % panel.polygon.length
    const edgeStart = panel.polygon[index]
    const edgeEnd = panel.polygon[nextIndex]
    if (isFoldEdge(edgeStart, edgeEnd, foldLines)) {
      continue
    }

    const start = projected[index]
    const end = projected[nextIndex]
    const frontStart = start.clone().addScaledVector(normal, frontOffset)
    const frontEnd = end.clone().addScaledVector(normal, frontOffset)
    const backStart = start.clone().addScaledVector(normal, backOffset)
    const backEnd = end.clone().addScaledVector(normal, backOffset)

    vertices.push(frontStart.x, frontStart.y, frontStart.z, frontEnd.x, frontEnd.y, frontEnd.z)
    vertices.push(backStart.x, backStart.y, backStart.z, backEnd.x, backEnd.y, backEnd.z)
  }

  if (vertices.length === 0) {
    return
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  const edgeColor = material.color.clone().multiplyScalar(0.45)
  const line = new LineSegments(geometry, new LineBasicMaterial({ color: edgeColor }))
  line.name = `final-product-edge-finish-${panel.id}`
  group.add(line)
}

function findPanelForHole(result: FinalProductSolveResult, hole: StitchHole) {
  const containingPanel = findPanelContainingPoint(result.panels, hole.point)
  if (containingPanel) {
    return result.panels.find((panel) => panel.id === containingPanel.id) ?? null
  }

  const point = hole.point
  let bestPanel: SolvedFoldPanel | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const panel of result.panels) {
    const center = panel.polygon.reduce(
      (sum, entry) => ({ x: sum.x + entry.x / panel.polygon.length, y: sum.y + entry.y / panel.polygon.length }),
      { x: 0, y: 0 },
    )
    const distance = Math.hypot(center.x - point.x, center.y - point.y)
    if (distance < bestDistance) {
      bestDistance = distance
      bestPanel = panel
    }
  }
  return bestPanel
}

function addStitchHoles(
  group: Group,
  result: FinalProductSolveResult,
  transform: CommonRebuildParams['transform'],
  threadColor: string,
  relaxation: XpbdFinalProductRelaxation | null,
) {
  const material = createThreadMaterial(threadColor)
  const geometry = new SphereGeometry(STITCH_SPHERE_RADIUS, STITCH_SPHERE_SEGMENTS, STITCH_SPHERE_SEGMENTS)
  for (const chain of result.stitchChains) {
    const runPoints: Vector3[] = []
    for (const hole of chain.holes) {
      const panel = findPanelForHole(result, hole)
      if (!panel) {
        continue
      }
      const position = transformedHolePosition(result, hole, transform, relaxation)
      if (!position) {
        continue
      }
      runPoints.push(position)
      const sphere = new Mesh(geometry, material)
      sphere.position.copy(position)
      sphere.castShadow = true
      sphere.name = `final-product-stitch-${hole.id}`
      group.add(sphere)
    }
    // The visible saddle-stitch run between consecutive holes of the chain.
    const runs = buildThreadSegments(
      saddleStitchSegments(runPoints),
      material,
      STITCH_THREAD_RADIUS,
      `final-product-stitch-run-${chain.id}`,
    )
    if (runs) {
      group.add(runs)
    }
  }
}

function pairColor(pair: StitchPair, showStressOverlay: boolean) {
  if (!showStressOverlay) {
    return '#f8fafc'
  }
  if (pair.rmsErrorMm <= 0.25 && pair.score >= 0.75) {
    return '#22c55e'
  }
  if (pair.rmsErrorMm <= 1.5 && pair.score >= 0.62) {
    return '#eab308'
  }
  return '#ef4444'
}

function transformedHolePosition(
  result: FinalProductSolveResult,
  hole: StitchHole,
  transform: CommonRebuildParams['transform'],
  relaxation: XpbdFinalProductRelaxation | null,
) {
  const relaxed = relaxation?.holePositionsById.get(hole.id)
  if (relaxed) {
    return projectSolvedVectorForPreview(relaxed, transform)
  }
  const panel = findPanelForHole(result, hole)
  if (!panel) {
    return null
  }
  return projectSolvedPointForPreview(panel, hole.point, transform)
}

function projectSolvedVectorForPreview(
  solved: Vector3,
  transform: CommonRebuildParams['transform'],
) {
  return new Vector3(
    (solved.x - transform.centerX) * transform.scale,
    solved.y * transform.scale,
    -(solved.z - transform.centerY) * transform.scale,
  )
}

function addSeamGuides(
  group: Group,
  result: FinalProductSolveResult,
  transform: CommonRebuildParams['transform'],
  showStressOverlay: boolean,
  relaxation: XpbdFinalProductRelaxation | null,
  threadColor: string,
) {
  for (const pair of result.stitchPairs) {
    const crossSegments: ThreadSegment[] = []
    const vertices: number[] = []
    const rightHoles = pair.reversed ? [...pair.right.holes].reverse() : pair.right.holes
    for (let index = 0; index < pair.left.holes.length; index += 1) {
      const left = transformedHolePosition(result, pair.left.holes[index], transform, relaxation)
      const right = transformedHolePosition(result, rightHoles[index], transform, relaxation)
      if (!left || !right) {
        continue
      }
      vertices.push(left.x, left.y + 0.004, left.z, right.x, right.y + 0.004, right.z)
      crossSegments.push({ start: left, end: right })
    }
    if (vertices.length === 0) {
      continue
    }
    if (showStressOverlay) {
      // Diagnostic mode: seam quality as colored guide lines, as before.
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
      const line = new LineSegments(geometry, new LineBasicMaterial({ color: pairColor(pair, showStressOverlay) }))
      line.name = `final-product-seam-${pair.id}`
      group.add(line)
      continue
    }
    // Presentation mode: the cross-seam passes are thread, matching the
    // stitch runs, so a closed seam reads as saddle stitching.
    const thread = buildThreadSegments(
      crossSegments,
      createThreadMaterial(threadColor),
      STITCH_THREAD_RADIUS,
      `final-product-seam-${pair.id}`,
    )
    if (thread) {
      group.add(thread)
    }
  }
}

function hingeBandEndpoint(foldLine: FoldLine, panel: SolvedFoldPanel, point: { x: number; y: number }, widthMm: number) {
  const side = Math.sign(sideOfFoldLine(panelCentroid(panel), foldLine))
  const normal = foldLineNormal(foldLine)
  return {
    x: point.x + normal.x * side * widthMm,
    y: point.y + normal.y * side * widthMm,
  }
}

function addHingeBendSurfaces(
  group: Group,
  result: FinalProductSolveResult,
  transform: CommonRebuildParams['transform'],
  thicknessMm: number,
  material: MeshStandardMaterial,
) {
  for (const hinge of result.hinges) {
    const fromPanel = result.panels.find((panel) => panel.id === hinge.fromPanelId)
    const toPanel = result.panels.find((panel) => panel.id === hinge.toPanelId)
    if (!fromPanel || !toPanel) {
      continue
    }

    const widthMm = leatherFoldWidthMm(hinge.foldLine, thicknessMm)
    const fromStart = projectSolvedPointForPreview(fromPanel, hingeBandEndpoint(hinge.foldLine, fromPanel, hinge.foldLine.start, widthMm), transform)
    const fromEnd = projectSolvedPointForPreview(fromPanel, hingeBandEndpoint(hinge.foldLine, fromPanel, hinge.foldLine.end, widthMm), transform)
    const toStart = projectSolvedPointForPreview(toPanel, hingeBandEndpoint(hinge.foldLine, toPanel, hinge.foldLine.start, widthMm), transform)
    const toEnd = projectSolvedPointForPreview(toPanel, hingeBandEndpoint(hinge.foldLine, toPanel, hinge.foldLine.end, widthMm), transform)
    const normal = panelNormal([fromStart, fromEnd, toEnd, toStart])
    const halfThickness = Math.max(MIN_PANEL_THICKNESS_SCENE, thicknessMm * transform.scale * 0.5)
    const frontOffset = halfThickness
    const backOffset = -halfThickness
    const frontA = fromStart.clone().addScaledVector(normal, frontOffset)
    const frontB = fromEnd.clone().addScaledVector(normal, frontOffset)
    const frontC = toEnd.clone().addScaledVector(normal, frontOffset)
    const frontD = toStart.clone().addScaledVector(normal, frontOffset)
    const backA = fromStart.clone().addScaledVector(normal, backOffset)
    const backB = fromEnd.clone().addScaledVector(normal, backOffset)
    const backC = toEnd.clone().addScaledVector(normal, backOffset)
    const backD = toStart.clone().addScaledVector(normal, backOffset)

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      frontA.x, frontA.y, frontA.z,
      frontB.x, frontB.y, frontB.z,
      frontC.x, frontC.y, frontC.z,
      frontA.x, frontA.y, frontA.z,
      frontC.x, frontC.y, frontC.z,
      frontD.x, frontD.y, frontD.z,

      backC.x, backC.y, backC.z,
      backB.x, backB.y, backB.z,
      backA.x, backA.y, backA.z,
      backD.x, backD.y, backD.z,
      backC.x, backC.y, backC.z,
      backA.x, backA.y, backA.z,

      frontA.x, frontA.y, frontA.z,
      backA.x, backA.y, backA.z,
      backB.x, backB.y, backB.z,
      frontA.x, frontA.y, frontA.z,
      backB.x, backB.y, backB.z,
      frontB.x, frontB.y, frontB.z,

      frontD.x, frontD.y, frontD.z,
      frontC.x, frontC.y, frontC.z,
      backC.x, backC.y, backC.z,
      frontD.x, frontD.y, frontD.z,
      backC.x, backC.y, backC.z,
      backD.x, backD.y, backD.z,

      frontA.x, frontA.y, frontA.z,
      frontD.x, frontD.y, frontD.z,
      backD.x, backD.y, backD.z,
      frontA.x, frontA.y, frontA.z,
      backD.x, backD.y, backD.z,
      backA.x, backA.y, backA.z,

      frontB.x, frontB.y, frontB.z,
      backB.x, backB.y, backB.z,
      backC.x, backC.y, backC.z,
      frontB.x, frontB.y, frontB.z,
      backC.x, backC.y, backC.z,
      frontC.x, frontC.y, frontC.z,
    ], 3))
    geometry.computeVertexNormals()
    const band = new Mesh(geometry, material.clone())
    band.name = `final-product-fold-band-${hinge.id}`
    group.add(band)
  }
}

function addHingeGuides(
  group: Group,
  result: FinalProductSolveResult,
  transform: CommonRebuildParams['transform'],
  thicknessMm: number,
) {
  const centerMaterial = new LineBasicMaterial({ color: '#38bdf8' })
  const bandMaterial = new LineBasicMaterial({ color: '#7dd3fc' })
  for (const hinge of result.hinges) {
    const panel = result.panels.find((entry) => entry.id === hinge.fromPanelId) ?? result.panels[0]
    if (!panel) {
      continue
    }
    const dx = hinge.foldLine.end.x - hinge.foldLine.start.x
    const dy = hinge.foldLine.end.y - hinge.foldLine.start.y
    const length = Math.hypot(dx, dy)
    const maxStackLevel = Math.max(0, ...result.panels.map((entry) => entry.stackLevel ?? 0))
    const bandMm = foldBandWidthMm(hinge.foldLine, thicknessMm, maxStackLevel)
    const nx = length <= 1e-6 ? 0 : -dy / length
    const ny = length <= 1e-6 ? 0 : dx / length
    const offsets = [-bandMm, 0, bandMm]
    const vertices: number[] = []

    for (const offset of offsets) {
      const start = projectSolvedPointForPreview(panel, {
        x: hinge.foldLine.start.x + nx * offset,
        y: hinge.foldLine.start.y + ny * offset,
      }, transform)
      const end = projectSolvedPointForPreview(panel, {
        x: hinge.foldLine.end.x + nx * offset,
        y: hinge.foldLine.end.y + ny * offset,
      }, transform)
      vertices.push(start.x, start.y + 0.008, start.z, end.x, end.y + 0.008, end.z)
    }

    const bandGeometry = new BufferGeometry()
    bandGeometry.setAttribute('position', new Float32BufferAttribute([
      ...vertices.slice(0, 6),
      ...vertices.slice(12, 18),
    ], 3))
    const band = new LineSegments(bandGeometry, bandMaterial)
    band.name = `final-product-fold-area-${hinge.id}`
    group.add(band)

    const centerGeometry = new BufferGeometry()
    centerGeometry.setAttribute('position', new Float32BufferAttribute(vertices.slice(6, 12), 3))
    const center = new Line(centerGeometry, centerMaterial)
    center.name = `final-product-hinge-${hinge.id}`
    group.add(center)
  }
}

function finalDiagnosticFromAssemblyDiagnostic(diagnostic: AssemblyDiagnostic): FinalProductDiagnostic {
  return {
    id: diagnostic.id,
    code: diagnostic.code,
    severity: diagnostic.severity === 'fatal' ? 'error' : diagnostic.severity,
    message: diagnostic.message,
    chainIds: diagnostic.entityRefs.filter((entry) => entry.kind === 'stitchHole').map((entry) => entry.id),
    foldLineIds: diagnostic.entityRefs.filter((entry) => entry.kind === 'fold').map((entry) => entry.id),
  }
}

// The fold sweep samples the WHOLE timeline, so its result is independent of
// the current fold progress. Scrubbing the progress slider rebuilds the model
// every tick; without this memo each tick re-ran 21 identical solves.
let foldSweepMemo: { signature: string; result: FinalProductFoldSweepResult } | null = null

function memoizedFoldSweep(input: Parameters<typeof analyzeFinalProductFoldSweep>[0]): FinalProductFoldSweepResult {
  const signature = JSON.stringify({
    foldLines: input.foldLines,
    instructions: input.instructions ?? null,
    stitchHoles: input.stitchHoles.map((hole) => ({ id: hole.id, point: hole.point, chainId: hole.chainId ?? null })),
    chains: (input.explicitStitchChains ?? []).map((chain) => chain.id),
    pairs: (input.explicitStitchPairs ?? []).map((pair) => pair.id),
    regions: input.regions ?? null,
    outlinePolygons: input.outlinePolygons,
    documentBounds: input.documentBounds,
    thicknessMm: input.thicknessMm,
    sampleCount: input.sampleCount ?? null,
  })
  if (foldSweepMemo?.signature !== signature) {
    foldSweepMemo = { signature, result: analyzeFinalProductFoldSweep(input) }
  }
  return foldSweepMemo.result
}

export function rebuildFinalProductModel({
  layers,
  lineTypes,
  shapes,
  finalProductGroup,
  staticSideGroup,
  foldingSideGroup,
  foldGuideGroup,
  assembledGroup,
  avatarGroup,
  foldLines,
  stitchHoles,
  outlinePolygons,
  patternPieces,
  pieceMeshes,
  seamConnections,
  documentBounds,
  previewSettings,
  transform,
  threadColor,
  materials,
  preservedMaterials,
  fitControlsToModel,
}: RebuildFinalProductModelParams) {
  clearGroup(staticSideGroup, preservedMaterials)
  clearGroup(foldingSideGroup, preservedMaterials)
  clearGroup(foldGuideGroup, preservedMaterials)
  clearGroup(assembledGroup, preservedMaterials)
  clearGroup(avatarGroup, preservedMaterials)
  clearGroup(finalProductGroup, preservedMaterials)

  const foldTimelinePreview = buildFoldTimelinePreview({
    foldLines,
    instructions: previewSettings.foldTimeline,
    progress: previewSettings.finalFoldProgress,
  })
  const previewFoldLines = foldTimelinePreview.foldLines
  const regions = buildFinalProductRegions({ layers, lineTypes, shapes, outlinePolygons })
  const compiledSeams = compileExplicitSeams({ pieceMeshes, seamConnections })
  const assemblyDiagnostics = buildAssemblyDiagnostics({
    patternPieces,
    pieceMeshes,
    seamConnections,
    foldLines: previewFoldLines,
    fallbackThicknessMm: previewSettings.thicknessMm,
  })
  const explicitDiagnostics = [
    ...compiledSeams.diagnostics,
    ...assemblyDiagnostics,
  ].map(finalDiagnosticFromAssemblyDiagnostic).concat(foldTimelinePreview.diagnostics)

  const foldOrderRank = foldOrderRankFromTimeline(foldTimelinePreview.timeline)
  const result = solveFinalProduct({
    foldLines: previewFoldLines,
    stitchHoles,
    explicitStitchChains: compiledSeams.chains,
    explicitStitchPairs: compiledSeams.pairs,
    explicitDiagnostics,
    regions,
    outlinePolygons,
    documentBounds,
    thicknessMm: previewSettings.thicknessMm,
    foldOrderRank,
  })
  const foldSweep = memoizedFoldSweep({
    foldLines,
    instructions: previewSettings.foldTimeline,
    stitchHoles,
    explicitStitchChains: compiledSeams.chains,
    explicitStitchPairs: compiledSeams.pairs,
    regions,
    outlinePolygons,
    documentBounds,
    thicknessMm: previewSettings.thicknessMm,
    sampleCount: 21,
  })
  result.foldSweepCollisionCount = foldSweep.collisionCount
  result.foldSweepWorstProgress = foldSweep.worstProgress
  result.foldSweepSampleCount = foldSweep.sampleCount
  result.diagnostics.push(...foldSweep.diagnostics)
  const relaxation = previewSettings.usePhysicsRelaxation ? relaxFinalProductSeamsWithXpbd(result) : null

  if (relaxation && relaxation.rmsAfterMm < relaxation.rmsBeforeMm) {
    result.diagnostics.push({
      id: 'final-product-xpbd-relaxation',
      code: 'xpbd-seam-relaxation',
      severity: 'info',
      message: `XPBD seam relaxation reduced weld RMS from ${relaxation.rmsBeforeMm.toFixed(2)}mm to ${relaxation.rmsAfterMm.toFixed(2)}mm across ${relaxation.constraintCount} constraints.`,
    })
  }

  addPanelMeshes(finalProductGroup, result, materials.assembledFrontMaterial, transform, previewSettings.thicknessMm)
  addStitchHoles(finalProductGroup, result, transform, threadColor, relaxation)
  addHingeBendSurfaces(finalProductGroup, result, transform, previewSettings.thicknessMm, materials.assembledFrontMaterial)
  if (previewSettings.showSeams) {
    addSeamGuides(finalProductGroup, result, transform, previewSettings.showStressOverlay, relaxation, threadColor)
    addHingeGuides(finalProductGroup, result, transform, previewSettings.thicknessMm)
  }

  fitControlsToModel()
  return result
}
