import {
  BufferGeometry,
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
} from 'three'
import type { StitchHole } from '../cad/cad-types'
import { buildAssemblyDiagnostics, type AssemblyDiagnostic } from '../assembly/assembly-diagnostics'
import { compileExplicitSeams } from '../assembly/seam-stitch-compiler'
import { clearGroup } from './bridge/scene-lifecycle'
import { findPanelContainingPoint } from './final-product-panel-graph'
import { solveFinalProduct, projectSolvedPointForPreview } from './final-product-solver'
import type { FinalProductDiagnostic, FinalProductSolveResult, SolvedFoldPanel, StitchPair } from './final-product-types'
import { buildFinalProductRegions } from './final-product-regions'
import type { CommonRebuildParams } from './model-builder-types'

const STITCH_SPHERE_SEGMENTS = 8
const STITCH_SPHERE_RADIUS = 0.006

export type RebuildFinalProductModelParams = CommonRebuildParams & {
  finalProductGroup: Group
  staticSideGroup: Group
  foldingSideGroup: Group
  foldGuideGroup: Group
  assembledGroup: Group
  avatarGroup: Group
}

function createPanelGeometry(panel: SolvedFoldPanel, transform: CommonRebuildParams['transform']) {
  if (panel.polygon.length < 3) {
    return null
  }

  const points2d = panel.polygon.map((point) => new Vector2(point.x, point.y))
  const triangles = ShapeUtils.triangulateShape(points2d, [])
  if (triangles.length === 0) {
    return null
  }

  const projected = panel.polygon.map((point) => projectSolvedPointForPreview(panel, point, transform))
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []

  for (const triangle of triangles) {
    for (const index of triangle) {
      const point = projected[index]
      const source = panel.polygon[index]
      vertices.push(point.x, point.y, point.z)
      normals.push(0, 1, 0)
      uvs.push(source.x, source.y)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
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
) {
  for (const panel of result.panels) {
    const geometry = createPanelGeometry(panel, transform)
    if (!geometry) {
      continue
    }
    const mesh = new Mesh(geometry, material)
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
) {
  const material = new MeshBasicMaterial({ color: threadColor })
  const geometry = new SphereGeometry(STITCH_SPHERE_RADIUS, STITCH_SPHERE_SEGMENTS, STITCH_SPHERE_SEGMENTS)
  for (const chain of result.stitchChains) {
    for (const hole of chain.holes) {
      const panel = findPanelForHole(result, hole)
      if (!panel) {
        continue
      }
      const position = projectSolvedPointForPreview(panel, hole.point, transform)
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
) {
  const panel = findPanelForHole(result, hole)
  if (!panel) {
    return null
  }
  return projectSolvedPointForPreview(panel, hole.point, transform)
}

function addSeamGuides(
  group: Group,
  result: FinalProductSolveResult,
  transform: CommonRebuildParams['transform'],
  showStressOverlay: boolean,
) {
  for (const pair of result.stitchPairs) {
    const vertices: number[] = []
    const rightHoles = pair.reversed ? [...pair.right.holes].reverse() : pair.right.holes
    for (let index = 0; index < pair.left.holes.length; index += 1) {
      const left = transformedHolePosition(result, pair.left.holes[index], transform)
      const right = transformedHolePosition(result, rightHoles[index], transform)
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

  const result = solveFinalProduct({
    foldLines,
    stitchHoles,
    ...(() => {
      const compiledSeams = compileExplicitSeams({ pieceMeshes, seamConnections })
      const assemblyDiagnostics = buildAssemblyDiagnostics({
        patternPieces,
        pieceMeshes,
        seamConnections,
        foldLines,
        fallbackThicknessMm: previewSettings.thicknessMm,
      })
      return {
        explicitStitchChains: compiledSeams.chains,
        explicitStitchPairs: compiledSeams.pairs,
        explicitDiagnostics: [...compiledSeams.diagnostics, ...assemblyDiagnostics].map(finalDiagnosticFromAssemblyDiagnostic),
      }
    })(),
    regions: buildFinalProductRegions({ layers, lineTypes, shapes, outlinePolygons }),
    outlinePolygons,
    documentBounds,
    thicknessMm: previewSettings.thicknessMm,
  })

  addPanelMeshes(finalProductGroup, result, materials.assembledFrontMaterial, transform)
  addStitchHoles(finalProductGroup, result, transform, threadColor)
  if (previewSettings.showSeams) {
    addSeamGuides(finalProductGroup, result, transform, previewSettings.showStressOverlay)
  }
  if (previewSettings.showStressOverlay) {
    addHingeGuides(finalProductGroup, result, transform)
  }

  fitControlsToModel()
  return result
}
