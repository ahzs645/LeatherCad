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
  Vector3,
} from 'three'
import type { PatternPiece, PiecePlacement3D, StitchHole, ThreePreviewSettings } from '../cad/cad-types'
import { createPieceShape, projectPiecePoint, type PieceMeshData } from './piece-mesh'
import { clearGroup } from './bridge/scene-lifecycle'
import type { ModelBuilderMaterials, ModelTransform, RebuildAssembledModelParams } from './model-builder-types'
import { addPanelOutline } from './outline-renderer'

const EPSILON = 1e-6
const DEFAULT_THICKNESS_WORLD = 0.005

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

function applyPlacementTransform(
  group: Group,
  placement: PiecePlacement3D,
  index: number,
  total: number,
  previewSettings: ThreePreviewSettings,
  transform: ModelTransform,
) {
  const exploded = explodedOffsetForIndex(index, total, previewSettings, transform)
  group.position.set(
    placement.translationMm.x * transform.scale + exploded.x,
    placement.translationMm.y * transform.scale + exploded.y,
    -placement.translationMm.z * transform.scale + exploded.z,
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
    matrix.setPosition(projected.x, topY + 0.0025, projected.y)
    instances.setMatrixAt(index, matrix)
  })
  instances.instanceMatrix.needsUpdate = true
  group.add(instances)
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

  const outlinePoints = pieceMesh.outer.map((point) =>
    projectPiecePoint(point, transform.scale, transform.centerX, transform.centerY),
  )
  addPanelOutline(outlinePoints, group, '#e2e8f0', halfThickness + 0.0015)

  if (previewSettings.showEdgeLabels) {
    pieceMesh.edges.forEach((edge) => {
      const midpoint = projectPiecePoint(edge.midpoint, transform.scale, transform.centerX, transform.centerY)
      addEdgeLabel(group, `${edge.index + 1}`, new Vector3(midpoint.x, halfThickness + 0.02, midpoint.y), '#f8fafc')
    })
  }

  addAssembledStitchHoles(group, piece, halfThickness, stitchHoles, threadColor, transform)

  const placement = placementForPiece(piece.id, piecePlacements3d)
  applyPlacementTransform(group, placement, index, total, previewSettings, transform)
  group.updateMatrixWorld(true)

  return group
}

function edgeMidpointWorld(group: Group, pieceMesh: PieceMeshData, edgeIndex: number, transform: ModelTransform) {
  const edge = pieceMesh.edges[Math.max(0, Math.min(pieceMesh.edges.length - 1, edgeIndex))]
  if (!edge) {
    return null
  }
  const midpoint = projectPiecePoint(edge.midpoint, transform.scale, transform.centerX, transform.centerY)
  const point = new Vector3(midpoint.x, 0, midpoint.y)
  return point.applyMatrix4(group.matrixWorld)
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
) {
  const ratio = Math.abs(leftLength - rightLength) / Math.max(leftLength, rightLength, EPSILON)
  const severity = MathUtils.clamp(ratio * 1.25 + midpointDistance * 0.9, 0, 1)
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
  staticSideGroup,
  foldingSideGroup,
  foldGuideGroup,
  avatarGroup,
  rebuildAvatarModel,
}: RebuildAssembledModelParams) {
  clearGroup(assembledGroup, preservedMaterials)
  clearGroup(avatarGroup, preservedMaterials)
  clearGroup(staticSideGroup, preservedMaterials)
  clearGroup(foldingSideGroup, preservedMaterials)
  clearGroup(foldGuideGroup, preservedMaterials)

  const pieces = patternPieces.filter((piece) => layers.some((layer) => layer.id === piece.layerId && layer.visible))
  if (pieces.length === 0) {
    fitControlsToModel()
    return
  }

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
      )
      addSeamGuide(assembledGroup, fromMid, toMid, color, connection.kind !== 'aligned')
    }
  }

  void rebuildAvatarModel()
  fitControlsToModel()
}
