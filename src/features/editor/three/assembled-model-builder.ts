import {
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  ShapeGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
} from 'three'
import type { PatternPiece, PiecePlacement3D, StitchHole, ThreePreviewSettings } from '../cad/cad-types'
import { scoreSeamStress } from '../assembly/stress-score'
import { createPieceShape, projectPiecePoint, type PieceMeshData } from './piece-mesh'
import { clearGroup } from './bridge/scene-lifecycle'
import { buildStitchChains } from './final-product-stitch-pairing'
import type { ModelBuilderMaterials, ModelTransform, RebuildAssembledModelParams } from './model-builder-types'
import { addPanelOutline } from './outline-renderer'
import { buildThreadSegments, chainRunSegments } from './stitch-thread'

const DEFAULT_THICKNESS_WORLD = 0.005

/**
 * A projected flat point in viewport coordinates.
 *
 * `createPieceShape` feeds `projectPiecePoint` output into an ExtrudeGeometry
 * that is then rotated -90 degrees about X, which negates the projected Y on the
 * way to world Z. Anything drawn alongside a piece body — its outline, its
 * stitch holes, its edge labels, the seam indicators — has to apply the same
 * negation or it lands mirrored about the document's Y axis. It did not, so on
 * any piece that is not symmetric in document Y those overlays sat on the wrong
 * side of the leather.
 */
function flatToWorld(projected: Vector2, y: number) {
  return new Vector3(projected.x, y, -projected.y)
}

function explodedOffsetForIndex(index: number, total: number, previewSettings: ThreePreviewSettings, transform: ModelTransform) {
  if (total <= 1) {
    return new Vector3(0, 0, 0)
  }
  const angle = (index / total) * Math.PI * 2
  const radiusMm = 70 * previewSettings.explodedFactor
  return new Vector3(
    Math.cos(angle) * radiusMm * transform.scale,
    0,
    Math.sin(angle) * radiusMm * transform.scale,
  )
}

/**
 * Position and orient a piece group.
 *
 * The rotation pivots on the piece's own centroid rather than the group origin.
 * The group origin is the document centre, shared by every piece, so rotating
 * about it swung a piece in an arc around the whole drawing instead of turning
 * it in place — surprising when typed into the inspector, and impossible to
 * solve for, since the required translation would then depend on a document
 * centre that changes as pieces are shown and hidden. A piece with no placement
 * still lands exactly where it did.
 */
function applyPlacementTransform(
  group: Group,
  placement: PiecePlacement3D,
  index: number,
  total: number,
  previewSettings: ThreePreviewSettings,
  transform: ModelTransform,
  pivot: Vector3,
) {
  const exploded = explodedOffsetForIndex(index, total, previewSettings, transform)
  group.position.set(
    pivot.x + placement.translationMm.x * transform.scale + exploded.x,
    pivot.y + placement.translationMm.y * transform.scale + exploded.y,
    pivot.z - placement.translationMm.z * transform.scale + exploded.z,
  )
  group.rotation.set(
    MathUtils.degToRad(placement.rotationDeg.x),
    MathUtils.degToRad(placement.rotationDeg.y),
    MathUtils.degToRad(placement.rotationDeg.z),
  )
  if (placement.flipped) {
    group.scale.x = -1
  }
}

/** The piece's centroid in viewport coordinates — the pivot its rotation uses. */
function pieceCentroidWorld(pieceMesh: PieceMeshData, transform: ModelTransform) {
  if (pieceMesh.outer.length === 0) {
    return new Vector3()
  }
  let x = 0
  let y = 0
  for (const point of pieceMesh.outer) {
    x += point.x
    y += point.y
  }
  const centroid = projectPiecePoint(
    { x: x / pieceMesh.outer.length, y: y / pieceMesh.outer.length },
    transform.scale,
    transform.centerX,
    transform.centerY,
  )
  return flatToWorld(centroid, 0)
}

function placementForPiece(pieceId: string, piecePlacements3d: PiecePlacement3D[]) {
  return (
    piecePlacements3d.find((placement) => placement.pieceId === pieceId) ?? {
      pieceId,
      translationMm: { x: 0, y: 0, z: 0 },
      rotationDeg: { x: 0, y: 0, z: 0 },
      flipped: false,
    }
  )
}

function pieceUsesTexture(piece: PatternPiece, texturedShapeIdSet: Set<string>, hasActiveTexture: boolean) {
  return (
    hasActiveTexture &&
    [piece.boundaryShapeId, ...piece.internalShapeIds].some((shapeId) => texturedShapeIdSet.has(shapeId))
  )
}

function addEdgeLabel(group: Group, text: string, point: Vector3, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(15, 23, 42, 0.85)'
  context.fillRect(6, 8, 148, 48)
  context.strokeStyle = 'rgba(255,255,255,0.2)'
  context.strokeRect(6, 8, 148, 48)
  context.fillStyle = color
  context.font = '28px monospace'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new CanvasTexture(canvas)
  const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new Sprite(material)
  sprite.position.copy(point)
  sprite.scale.set(0.16, 0.064, 1)
  group.add(sprite)
}

function addAssembledStitchHoles(
  group: Group,
  piece: PatternPiece,
  topY: number,
  stitchHoles: StitchHole[],
  threadColor: string,
  transform: ModelTransform,
) {
  const pieceShapeIdSet = new Set([piece.boundaryShapeId, ...piece.internalShapeIds])
  const holes = stitchHoles.filter((entry) => pieceShapeIdSet.has(entry.shapeId))
  if (holes.length === 0) {
    return
  }

  const geometry = new CylinderGeometry(0.006, 0.006, 0.003, 10)
  const material = new MeshStandardMaterial({
    color: threadColor,
    roughness: 0.55,
    metalness: 0.05,
  })
  const instances = new InstancedMesh(geometry, material, holes.length)
  const matrix = new Matrix4()

  holes.forEach((hole, index) => {
    const projected = projectPiecePoint(hole.point, transform.scale, transform.centerX, transform.centerY)
    matrix.makeRotationX(Math.PI / 2)
    const world = flatToWorld(projected, topY + 0.0025)
    matrix.setPosition(world.x, world.y, world.z)
    instances.setMatrixAt(index, matrix)
  })
  instances.instanceMatrix.needsUpdate = true
  group.add(instances)

  // The visible saddle-stitch runs between consecutive holes of each chain.
  const { chains } = buildStitchChains(holes)
  for (const chain of chains) {
    const points = chain.holes.map((hole) => {
      const projected = projectPiecePoint(hole.point, transform.scale, transform.centerX, transform.centerY)
      return flatToWorld(projected, topY + 0.0025)
    })
    const runs = buildThreadSegments(chainRunSegments(points), material, 0.0035, `assembled-stitch-run-${piece.id}-${chain.id}`)
    if (runs) {
      group.add(runs)
    }
  }
}

function createAssembledPieceGroup({
  piece,
  pieceMesh,
  index,
  total,
  piecePlacements3d,
  previewSettings,
  transform,
  texturedShapeIdSet,
  hasActiveTexture,
  materials,
  stitchHoles,
  threadColor,
}: {
  piece: PatternPiece
  pieceMesh: PieceMeshData
  index: number
  total: number
  piecePlacements3d: PiecePlacement3D[]
  previewSettings: ThreePreviewSettings
  transform: ModelTransform
  texturedShapeIdSet: Set<string>
  hasActiveTexture: boolean
  materials: ModelBuilderMaterials
  stitchHoles: StitchHole[]
  threadColor: string
}) {
  const group = new Group()
  const pieceShape = createPieceShape(pieceMesh, transform.scale, transform.centerX, transform.centerY)
  const thicknessWorld = Math.max(previewSettings.thicknessMm * transform.scale, DEFAULT_THICKNESS_WORLD)
  const halfThickness = thicknessWorld / 2
  const usesTexture = pieceUsesTexture(piece, texturedShapeIdSet, hasActiveTexture)
  const frontMaterial = usesTexture ? materials.leftTextureMaterial : materials.assembledFrontMaterial
  const sideMaterial = materials.assembledSideMaterial

  const bodyGeometry = new ExtrudeGeometry(pieceShape, {
    depth: thicknessWorld,
    bevelEnabled: false,
    steps: 1,
  })
  bodyGeometry.rotateX(-Math.PI / 2)
  bodyGeometry.translate(0, -halfThickness, 0)
  const bodyMesh = new Mesh(bodyGeometry, [frontMaterial, sideMaterial])
  group.add(bodyMesh)

  const backGeometry = new ShapeGeometry(pieceShape)
  backGeometry.rotateX(-Math.PI / 2)
  backGeometry.translate(0, -halfThickness - 0.0008, 0)
  const backMesh = new Mesh(backGeometry, materials.assembledBackMaterial)
  group.add(backMesh)

  const outlinePoints = pieceMesh.outer.map((point) => {
    const projected = projectPiecePoint(point, transform.scale, transform.centerX, transform.centerY)
    // addPanelOutline maps (x, y) to (x, yOffset, y) and the fold builder
    // depends on that, so the negation happens here rather than in the shared
    // helper.
    return new Vector2(projected.x, -projected.y)
  })
  addPanelOutline(outlinePoints, group, '#e2e8f0', halfThickness + 0.0015)

  if (previewSettings.showEdgeLabels) {
    pieceMesh.edges.forEach((edge) => {
      const midpoint = projectPiecePoint(edge.midpoint, transform.scale, transform.centerX, transform.centerY)
      addEdgeLabel(group, `${edge.index + 1}`, flatToWorld(midpoint, halfThickness + 0.02), '#f8fafc')
    })
  }

  addAssembledStitchHoles(group, piece, halfThickness, stitchHoles, threadColor, transform)

  const placement = placementForPiece(piece.id, piecePlacements3d)
  // Offset the contents by the pivot so the group's own origin sits on the
  // piece centroid; applyPlacementTransform adds the pivot back to the position.
  const pivot = pieceCentroidWorld(pieceMesh, transform)
  group.children.forEach((child) => {
    child.position.sub(pivot)
  })
  applyPlacementTransform(group, placement, index, total, previewSettings, transform, pivot)
  group.updateMatrixWorld(true)

  return group
}

function edgeMidpointWorld(group: Group, pieceMesh: PieceMeshData, edgeIndex: number, transform: ModelTransform) {
  const edge = pieceMesh.edges[Math.max(0, Math.min(pieceMesh.edges.length - 1, edgeIndex))]
  if (!edge) {
    return null
  }
  const midpoint = projectPiecePoint(edge.midpoint, transform.scale, transform.centerX, transform.centerY)
  return flatToWorld(midpoint, 0).applyMatrix4(group.matrixWorld)
}

function edgeLengthWorld(pieceMesh: PieceMeshData, edgeIndex: number, transform: ModelTransform) {
  const edge = pieceMesh.edges[Math.max(0, Math.min(pieceMesh.edges.length - 1, edgeIndex))]
  return edge ? edge.lengthMm * transform.scale : 0
}

function seamColorForConnection(
  leftLength: number,
  rightLength: number,
  midpointDistance: number,
  previewSettings: ThreePreviewSettings,
  toleranceMm: number,
) {
  const lengthDelta = Math.abs(leftLength - rightLength)
  const stress = scoreSeamStress({
    seam: {
      id: 'preview',
      from: { pieceId: 'preview-left', edgeIndex: 0 },
      to: { pieceId: 'preview-right', edgeIndex: 0 },
      kind: 'sewn',
    },
    lengthDeltaMm: lengthDelta,
    toleranceMm,
  })
  const distanceSeverity = MathUtils.clamp(midpointDistance * 0.9, 0, 1)
  const severity = MathUtils.clamp(Math.max(stress.score, distanceSeverity), 0, 1)
  const safe = new Color('#22c55e')
  const warning = new Color('#ef4444')
  return safe.lerp(warning, previewSettings.showStressOverlay ? severity : 0.18)
}

function addSeamGuide(group: Group, from: Vector3, to: Vector3, color: Color, dashed: boolean) {
  const material = dashed
    ? new LineDashedMaterial({ color, dashSize: 0.04, gapSize: 0.025 })
    : new LineBasicMaterial({ color })
  const line = new Line(new BufferGeometry().setFromPoints([from, to]), material)
  if (line instanceof Line && 'computeLineDistances' in line) {
    line.computeLineDistances()
  }
  group.add(line)
}

export function rebuildAssembledModel({
  layers,
  patternPieces,
  piecePlacements3d,
  seamConnections,
  stitchHoles,
  previewSettings,
  pieceMeshes,
  transform,
  threadColor,
  texturedShapeIdSet,
  hasActiveTexture,
  materials,
  preservedMaterials,
  fitControlsToModel,
  assembledGroup,
  finalProductGroup,
  staticSideGroup,
  foldingSideGroup,
  foldGuideGroup,
  avatarGroup,
  rebuildAvatarModel,
}: RebuildAssembledModelParams) {
  clearGroup(assembledGroup, preservedMaterials)
  clearGroup(finalProductGroup, preservedMaterials)
  clearGroup(avatarGroup, preservedMaterials)
  clearGroup(staticSideGroup, preservedMaterials)
  clearGroup(foldingSideGroup, preservedMaterials)
  clearGroup(foldGuideGroup, preservedMaterials)

  const pieces = patternPieces.filter((piece) => layers.some((layer) => layer.id === piece.layerId && layer.visible))

  // A document with no pattern pieces is a valid empty state, not a failure: keep
  // going so the avatar rebuild below still runs. Bailing out here used to leave
  // Avatar mode with a bare grid instead of its mannequin.
  if (pieces.length > 0) {
    const pieceMeshById = new Map(pieceMeshes.map((piece) => [piece.pieceId, piece]))
    const pieceGroupById = new Map<string, Group>()

    pieces.forEach((piece, index) => {
      const pieceMesh = pieceMeshById.get(piece.id)
      if (!pieceMesh) {
        return
      }
      const group = createAssembledPieceGroup({
        piece,
        pieceMesh,
        index,
        total: pieces.length,
        piecePlacements3d,
        previewSettings,
        transform,
        texturedShapeIdSet,
        hasActiveTexture,
        materials,
        stitchHoles,
        threadColor,
      })
      pieceGroupById.set(piece.id, group)
      assembledGroup.add(group)
    })

    if (previewSettings.showSeams) {
      for (const connection of seamConnections) {
        const fromGroup = pieceGroupById.get(connection.from.pieceId)
        const toGroup = pieceGroupById.get(connection.to.pieceId)
        const fromPiece = pieceMeshById.get(connection.from.pieceId)
        const toPiece = pieceMeshById.get(connection.to.pieceId)
        if (!fromGroup || !toGroup || !fromPiece || !toPiece) {
          continue
        }

        const fromMid = edgeMidpointWorld(fromGroup, fromPiece, connection.from.edgeIndex, transform)
        const toMid = edgeMidpointWorld(toGroup, toPiece, connection.to.edgeIndex, transform)
        if (!fromMid || !toMid) {
          continue
        }
        const color = seamColorForConnection(
          edgeLengthWorld(fromPiece, connection.from.edgeIndex, transform),
          edgeLengthWorld(toPiece, connection.to.edgeIndex, transform),
          fromMid.distanceTo(toMid),
          previewSettings,
          (connection.toleranceMm ?? 1) * transform.scale,
        )
        addSeamGuide(assembledGroup, fromMid, toMid, color, connection.kind !== 'aligned')
      }
    }
  }

  // The avatar manager clears `avatarGroup` and then no-ops unless the preview is in
  // Avatar mode, so Assembled mode still renders pattern geometry only. Its procedural
  // fallback is added synchronously, which keeps the fit below framing the mannequin.
  void rebuildAvatarModel()
  fitControlsToModel()
}
