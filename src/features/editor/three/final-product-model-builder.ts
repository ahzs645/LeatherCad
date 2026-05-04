import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
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
import { buildFoldTimelinePreview } from './fold-timeline'
import type { CommonRebuildParams } from './model-builder-types'

const STITCH_SPHERE_SEGMENTS = 8
const STITCH_SPHERE_RADIUS = 0.006
const MIN_PANEL_THICKNESS_SCENE = 0.001
const FINAL_LAYER_TINTS = ['#6f4a2e', '#b7834f', '#7f6038', '#a5533e', '#5f6f43', '#8f5f3b']

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

function createPanelGeometry(
  panel: SolvedFoldPanel,
  transform: CommonRebuildParams['transform'],
  thicknessMm: number,
  foldLines: FoldLine[],
) {
  if (panel.polygon.length < 3) {
    return null
  }

  const points2d = panel.polygon.map((point) => new Vector2(point.x, point.y))
  const triangles = ShapeUtils.triangulateShape(points2d, [])
  if (triangles.length === 0) {
    return null
  }

  const projected = panel.polygon.map((point) => projectSolvedPointForPreview(panel, point, transform))
  const normal = panelNormal(projected)
  const halfThickness = Math.max(MIN_PANEL_THICKNESS_SCENE, thicknessMm * transform.scale * 0.5)
  const front = projected.map((point) => point.clone().addScaledVector(normal, halfThickness))
  const back = projected.map((point) => point.clone().addScaledVector(normal, -halfThickness))
  const vertices: number[] = []
  const uvs: number[] = []

  for (const triangle of triangles) {
    for (const index of triangle) {
      pushVertex(vertices, uvs, front[index], panel.polygon[index])
    }
    for (const index of [...triangle].reverse()) {
      pushVertex(vertices, uvs, back[index], panel.polygon[index])
    }
  }

  for (let index = 0; index < projected.length; index += 1) {
    const nextIndex = (index + 1) % projected.length
    if (isFoldEdge(panel.polygon[index], panel.polygon[nextIndex], foldLines)) {
      continue
    }
    pushVertex(vertices, uvs, front[index], panel.polygon[index])
    pushVertex(vertices, uvs, back[index], panel.polygon[index])
    pushVertex(vertices, uvs, back[nextIndex], panel.polygon[nextIndex])
    pushVertex(vertices, uvs, front[index], panel.polygon[index])
    pushVertex(vertices, uvs, back[nextIndex], panel.polygon[nextIndex])
    pushVertex(vertices, uvs, front[nextIndex], panel.polygon[nextIndex])
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
  layerColorById: Map<string, string>,
) {
  for (const panel of result.panels) {
    const geometry = createPanelGeometry(panel, transform, thicknessMm, result.hinges.map((hinge) => hinge.foldLine))
    if (!geometry) {
      continue
    }
    const panelMaterial = material.clone()
    panelMaterial.color = new Color(layerColorById.get(panel.layerId) ?? FINAL_LAYER_TINTS[(panel.stackLevel ?? 0) % FINAL_LAYER_TINTS.length])
    panelMaterial.needsUpdate = true
    const mesh = new Mesh(geometry, panelMaterial)
    mesh.name = `final-product-panel-${panel.id}`
    group.add(mesh)
  }
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
  const material = new MeshBasicMaterial({ color: threadColor })
  const geometry = new SphereGeometry(STITCH_SPHERE_RADIUS, STITCH_SPHERE_SEGMENTS, STITCH_SPHERE_SEGMENTS)
  for (const chain of result.stitchChains) {
    for (const hole of chain.holes) {
      const panel = findPanelForHole(result, hole)
      if (!panel) {
        continue
      }
      const position = transformedHolePosition(result, hole, transform, relaxation)
      if (!position) {
        continue
      }
      const sphere = new Mesh(geometry, material)
      sphere.position.copy(position)
      sphere.name = `final-product-stitch-${hole.id}`
      group.add(sphere)
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
) {
  for (const pair of result.stitchPairs) {
    const vertices: number[] = []
    const rightHoles = pair.reversed ? [...pair.right.holes].reverse() : pair.right.holes
    for (let index = 0; index < pair.left.holes.length; index += 1) {
      const left = transformedHolePosition(result, pair.left.holes[index], transform, relaxation)
      const right = transformedHolePosition(result, rightHoles[index], transform, relaxation)
      if (!left || !right) {
        continue
      }
      vertices.push(left.x, left.y + 0.004, left.z, right.x, right.y + 0.004, right.z)
    }
    if (vertices.length === 0) {
      continue
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    const line = new LineSegments(geometry, new LineBasicMaterial({ color: pairColor(pair, showStressOverlay) }))
    line.name = `final-product-seam-${pair.id}`
    group.add(line)
  }
}

function addHingeGuides(
  group: Group,
  result: FinalProductSolveResult,
  transform: CommonRebuildParams['transform'],
) {
  const material = new LineBasicMaterial({ color: '#38bdf8' })
  for (const hinge of result.hinges) {
    const panel = result.panels.find((entry) => entry.id === hinge.fromPanelId) ?? result.panels[0]
    if (!panel) {
      continue
    }
    const start = projectSolvedPointForPreview(panel, hinge.foldLine.start, transform)
    const end = projectSolvedPointForPreview(panel, hinge.foldLine.end, transform)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([start.x, start.y + 0.006, start.z, end.x, end.y + 0.006, end.z], 3))
    const line = new Line(geometry, material)
    line.name = `final-product-hinge-${hinge.id}`
    group.add(line)
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
  const layerColorById = new Map(
    layers.map((layer, index) => [
      layer.id,
      FINAL_LAYER_TINTS[(typeof layer.stackLevel === 'number' ? layer.stackLevel : index) % FINAL_LAYER_TINTS.length],
    ]),
  )

  const result = solveFinalProduct({
    foldLines: previewFoldLines,
    stitchHoles,
    ...(() => {
      const compiledSeams = compileExplicitSeams({ pieceMeshes, seamConnections })
      const assemblyDiagnostics = buildAssemblyDiagnostics({
        patternPieces,
        pieceMeshes,
        seamConnections,
        foldLines: previewFoldLines,
        fallbackThicknessMm: previewSettings.thicknessMm,
      })
      return {
        explicitStitchChains: compiledSeams.chains,
        explicitStitchPairs: compiledSeams.pairs,
        explicitDiagnostics: [
          ...compiledSeams.diagnostics,
          ...assemblyDiagnostics,
        ].map(finalDiagnosticFromAssemblyDiagnostic).concat(foldTimelinePreview.diagnostics),
      }
    })(),
    regions: buildFinalProductRegions({ layers, lineTypes, shapes, outlinePolygons }),
    outlinePolygons,
    documentBounds,
    thicknessMm: previewSettings.thicknessMm,
  })
  const relaxation = previewSettings.usePhysicsRelaxation ? relaxFinalProductSeamsWithXpbd(result) : null

  if (relaxation && relaxation.rmsAfterMm < relaxation.rmsBeforeMm) {
    result.diagnostics.push({
      id: 'final-product-xpbd-relaxation',
      code: 'xpbd-seam-relaxation',
      severity: 'info',
      message: `XPBD seam relaxation reduced weld RMS from ${relaxation.rmsBeforeMm.toFixed(2)}mm to ${relaxation.rmsAfterMm.toFixed(2)}mm across ${relaxation.constraintCount} constraints.`,
    })
  }

  addPanelMeshes(finalProductGroup, result, materials.assembledFrontMaterial, transform, previewSettings.thicknessMm, layerColorById)
  addStitchHoles(finalProductGroup, result, transform, threadColor, relaxation)
  if (previewSettings.showSeams) {
    addSeamGuides(finalProductGroup, result, transform, previewSettings.showStressOverlay, relaxation)
  }
  if (previewSettings.showStressOverlay) {
    addHingeGuides(finalProductGroup, result, transform)
  }

  fitControlsToModel()
  return result
}
