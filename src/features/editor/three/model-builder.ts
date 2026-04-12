import {
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Material,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Path,
  Points,
  PointsMaterial,
  Shape as ThreeShape,
  ShapeGeometry,
  ShapeUtils,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
} from 'three'
import { sampleShapePoints } from '../cad/cad-geometry'
import type {
  FoldLine,
  Layer,
  LineType,
  PatternPiece,
  PiecePlacement3D,
  Point,
  SeamConnection,
  Shape,
  StitchHole,
  ThreePreviewSettings,
} from '../cad/cad-types'
import { buildOutlineRegions } from './outline-regions'
import { isPhysicalCutShape, shouldUseOutlineRegions } from './physical-layer-heuristics'
import { buildPhysicalLayerRegions } from './physical-layer-regions'
import { buildPieceMeshes, createPieceShape, projectPiecePoint, type PieceMeshData } from './piece-mesh'
import { clearGroup } from './bridge/scene-lifecycle'
import {
  clipPolygonByLine,
  ensureMinSpan,
  lineIntersectionOnSegment,
  padBounds,
  polygonBounds,
  segmentLengthSquared,
  sideOfLine,
  type Bounds2,
} from './bridge/geometry-utils'
import { ThreeFoldManager } from './fold-manager'
import type { OutlinePolygon } from './three-bridge-types'

export type ModelTransform = {
  scale: number
  centerX: number
  centerY: number
}

type ShapeSegment = {
  start: Vector2
  end: Vector2
  color: string
}

type BuildModelLayoutParams = {
  patternPieces: PatternPiece[]
  outlinePolygons: OutlinePolygon[]
  shapes: Shape[]
  foldLines: FoldLine[]
}

type BuildModelLayoutResult = {
  pieceMeshes: PieceMeshData[]
  transform: ModelTransform
  documentBounds: Bounds2
}

type ModelBuilderMaterials = {
  leftMaterial: MeshStandardMaterial
  rightMaterial: MeshStandardMaterial
  leftTextureMaterial: MeshStandardMaterial
  rightTextureMaterial: MeshStandardMaterial
  assembledFrontMaterial: MeshStandardMaterial
  assembledBackMaterial: MeshStandardMaterial
  assembledSideMaterial: MeshStandardMaterial
}

type CommonRebuildParams = {
  layers: Layer[]
  lineTypes: LineType[]
  shapes: Shape[]
  foldLines: FoldLine[]
  stitchHoles: StitchHole[]
  outlinePolygons: OutlinePolygon[]
  patternPieces: PatternPiece[]
  piecePlacements3d: PiecePlacement3D[]
  seamConnections: SeamConnection[]
  previewSettings: ThreePreviewSettings
  pieceMeshes: PieceMeshData[]
  transform: ModelTransform
  documentBounds: Bounds2
  threadColor: string
  texturedShapeIdSet: Set<string>
  hasActiveTexture: boolean
  materials: ModelBuilderMaterials
  preservedMaterials: Set<Material>
  fitControlsToModel: () => void
}

type RebuildAssembledModelParams = CommonRebuildParams & {
  assembledGroup: Group
  staticSideGroup: Group
  foldingSideGroup: Group
  foldGuideGroup: Group
  avatarGroup: Group
  rebuildAvatarModel: () => Promise<void>
}

type RebuildFoldModelParams = CommonRebuildParams & {
  staticSideGroup: Group
  foldingSideGroup: Group
  foldGuideGroup: Group
  assembledGroup: Group
  avatarGroup: Group
  foldingPivot: Group
  modelRoot: Group
  foldManager: ThreeFoldManager
}

const EPSILON = 1e-6
const CUT_LINE_COLOR = '#38bdf8'
const STITCH_LINE_COLOR = '#f97316'
const FOLD_LINE_COLOR = '#fb7185'
const LAYER_STACK_STEP = 0.012
const DEFAULT_THICKNESS_WORLD = 0.005

function projectPoint(point: { x: number; y: number }, transform: ModelTransform) {
  return new Vector2(
    (point.x - transform.centerX) * transform.scale,
    -(point.y - transform.centerY) * transform.scale,
  )
}

function buildBoundsFromPieceMeshes(pieceMeshes: PieceMeshData[]) {
  if (pieceMeshes.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const piece of pieceMeshes) {
    minX = Math.min(minX, piece.bounds.minX)
    minY = Math.min(minY, piece.bounds.minY)
    maxX = Math.max(maxX, piece.bounds.maxX)
    maxY = Math.max(maxY, piece.bounds.maxY)
  }

  return { minX, minY, maxX, maxY }
}

function buildBoundsFromShapes(shapes: Shape[]) {
  if (shapes.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const shape of shapes) {
    for (const point of sampleShapePoints(shape, shape.type === 'line' ? 1 : 20)) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null
  }

  return { minX, maxX, minY, maxY }
}

function buildBoundsFromFoldLines(foldLines: FoldLine[]) {
  if (foldLines.length === 0) {
    return null
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const foldLine of foldLines) {
    minX = Math.min(minX, foldLine.start.x, foldLine.end.x)
    maxX = Math.max(maxX, foldLine.start.x, foldLine.end.x)
    minY = Math.min(minY, foldLine.start.y, foldLine.end.y)
    maxY = Math.max(maxY, foldLine.start.y, foldLine.end.y)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null
  }

  return { minX, maxX, minY, maxY }
}

function buildChainsByShapeId(outlinePolygons: OutlinePolygon[]) {
  const chainsByShapeId = new Map<
    string,
    { id: string; shapeIds: string[]; polygon: Point[]; isClosed: true; area: number }
  >()

  for (const outline of outlinePolygons) {
    const chain = {
      id: outline.shapeIds[0] ?? outline.layerId,
      shapeIds: outline.shapeIds,
      polygon: outline.polygon,
      isClosed: true as const,
      area: Math.abs(ShapeUtils.area(outline.polygon.map((point) => new Vector2(point.x, point.y)))),
    }
    for (const shapeId of outline.shapeIds) {
      chainsByShapeId.set(shapeId, chain)
    }
  }

  return chainsByShapeId
}

export function buildModelLayout({
  patternPieces,
  outlinePolygons,
  shapes,
  foldLines,
}: BuildModelLayoutParams): BuildModelLayoutResult {
  const pieceMeshes = buildPieceMeshes(patternPieces, buildChainsByShapeId(outlinePolygons))

  let bounds = buildBoundsFromPieceMeshes(pieceMeshes)
  if (!bounds) {
    bounds = buildBoundsFromShapes(shapes)
  }
  if (bounds) {
    bounds = ensureMinSpan(bounds, 80)
  } else {
    const foldBounds = buildBoundsFromFoldLines(foldLines)
    if (foldBounds) {
      bounds = ensureMinSpan(padBounds(foldBounds, 60), 120)
    } else {
      bounds = { minX: -220, maxX: 220, minY: -140, maxY: 140 }
    }
  }

  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const longest = Math.max(width, height, 1)
  const transform = {
    scale: 1.65 / longest,
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerY: (bounds.minY + bounds.maxY) / 2,
  }

  return {
    pieceMeshes,
    transform,
    documentBounds: bounds,
  }
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

function addPanelOutline(points: Vector2[], group: Group, color: string, pivot: Vector2 | null, yOffset: number) {
  if (points.length < 2) {
    return
  }

  const offsetX = pivot?.x ?? 0
  const offsetY = pivot?.y ?? 0
  const outlinePoints = points.map((point) => new Vector3(point.x - offsetX, yOffset + 0.004, point.y - offsetY))
  outlinePoints.push(new Vector3(points[0].x - offsetX, yOffset + 0.004, points[0].y - offsetY))

  const outline = new Line(
    new BufferGeometry().setFromPoints(outlinePoints),
    new LineBasicMaterial({ color }),
  )
  group.add(outline)
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
  addPanelOutline(outlinePoints, group, '#e2e8f0', null, halfThickness + 0.0015)

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
  const line = new Line(
    new BufferGeometry().setFromPoints([from, to]),
    material,
  )
  if (line instanceof Line && 'computeLineDistances' in line) {
    line.computeLineDistances()
  }
  group.add(line)
}

function shapeColor(shape: Shape, lineTypes: LineType[], layers: Layer[]) {
  const lineType = lineTypes.find((entry) => entry.id === shape.lineTypeId)
  if (lineType?.role === 'stitch') {
    return STITCH_LINE_COLOR
  }
  if (lineType?.role === 'fold') {
    return FOLD_LINE_COLOR
  }

  const layer = layers.find((entry) => entry.id === shape.layerId)
  const fallbackFingerprint = `${layer?.name ?? ''} ${shape.id}`.toLowerCase()
  if (
    fallbackFingerprint.includes('stitch') ||
    fallbackFingerprint.includes('seam') ||
    fallbackFingerprint.includes('thread')
  ) {
    return STITCH_LINE_COLOR
  }

  return CUT_LINE_COLOR
}

function addSegmentLine(group: Group, segment: ShapeSegment, pivot: Vector2 | null, yOffset: number) {
  if (segmentLengthSquared(segment.start, segment.end) <= EPSILON) {
    return
  }

  const offsetX = pivot?.x ?? 0
  const offsetY = pivot?.y ?? 0
  const line = new Line(
    new BufferGeometry().setFromPoints([
      new Vector3(segment.start.x - offsetX, yOffset + 0.003, segment.start.y - offsetY),
      new Vector3(segment.end.x - offsetX, yOffset + 0.003, segment.end.y - offsetY),
    ]),
    new LineBasicMaterial({ color: segment.color }),
  )
  group.add(line)
}

function addStitchPoint(group: Group, point: Vector2, color: string, pivot: Vector2 | null, yOffset: number) {
  const offsetX = pivot?.x ?? 0
  const offsetY = pivot?.y ?? 0
  const geometry = new BufferGeometry().setFromPoints([
    new Vector3(point.x - offsetX, yOffset + 0.007, point.y - offsetY),
  ])
  const points = new Points(
    geometry,
    new PointsMaterial({
      color,
      size: 0.025,
      sizeAttenuation: true,
    }),
  )
  group.add(points)
}

function createPanelMesh(
  points: Vector2[],
  material: MeshStandardMaterial,
  bounds: Bounds2,
  pivot: Vector2 | null,
  yOffset: number,
  holes?: Vector2[][],
) {
  if (points.length < 3) {
    return null
  }

  const pivotX = pivot?.x ?? 0
  const pivotY = pivot?.y ?? 0
  const width = Math.max(bounds.maxX - bounds.minX, EPSILON)
  const height = Math.max(bounds.maxY - bounds.minY, EPSILON)

  const shape = new ThreeShape()
  shape.moveTo(points[0].x - pivotX, points[0].y - pivotY)
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x - pivotX, points[i].y - pivotY)
  }
  shape.closePath()

  if (holes) {
    for (const hole of holes) {
      if (hole.length < 3) continue
      const holePath = new Path()
      holePath.moveTo(hole[0].x - pivotX, hole[0].y - pivotY)
      for (let i = 1; i < hole.length; i++) {
        holePath.lineTo(hole[i].x - pivotX, hole[i].y - pivotY)
      }
      holePath.closePath()
      shape.holes.push(holePath)
    }
  }

  const shapeGeometry = new ShapeGeometry(shape)
  const posAttr = shapeGeometry.getAttribute('position')
  const count = posAttr.count
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []

  for (let i = 0; i < count; i++) {
    const sx = posAttr.getX(i)
    const sy = posAttr.getY(i)
    vertices.push(sx, yOffset, sy)
    normals.push(0, 1, 0)
    const worldX = sx + pivotX
    const worldY = sy + pivotY
    uvs.push((worldX - bounds.minX) / width, (worldY - bounds.minY) / height)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(Array.from(shapeGeometry.index?.array ?? []))
  geometry.computeBoundingSphere()

  shapeGeometry.dispose()

  return new Mesh(geometry, material)
}

function splitSegmentByFold(start: Vector2, end: Vector2, foldStart: Vector2, foldEnd: Vector2) {
  const sideStart = sideOfLine(start, foldStart, foldEnd)
  const sideEnd = sideOfLine(end, foldStart, foldEnd)
  const onStart = Math.abs(sideStart) <= EPSILON
  const onEnd = Math.abs(sideEnd) <= EPSILON

  if (onStart && onEnd) {
    return {
      positive: [{ start, end }],
      negative: [{ start, end }],
    }
  }

  if ((sideStart >= -EPSILON && sideEnd >= -EPSILON) || (onStart && sideEnd > EPSILON) || (onEnd && sideStart > EPSILON)) {
    return { positive: [{ start, end }], negative: [] as Array<{ start: Vector2; end: Vector2 }> }
  }

  if ((sideStart <= EPSILON && sideEnd <= EPSILON) || (onStart && sideEnd < -EPSILON) || (onEnd && sideStart < -EPSILON)) {
    return { positive: [] as Array<{ start: Vector2; end: Vector2 }>, negative: [{ start, end }] }
  }

  const intersection = lineIntersectionOnSegment(start, end, sideStart, sideEnd)
  if (!intersection) {
    if (sideStart >= 0) {
      return { positive: [{ start, end }], negative: [] as Array<{ start: Vector2; end: Vector2 }> }
    }
    return { positive: [] as Array<{ start: Vector2; end: Vector2 }>, negative: [{ start, end }] }
  }

  if (sideStart >= 0) {
    return {
      positive: [{ start, end: intersection }],
      negative: [{ start: intersection, end }],
    }
  }

  return {
    positive: [{ start: intersection, end }],
    negative: [{ start, end: intersection }],
  }
}

function buildShapeSegments(
  shapes: Shape[],
  foldStart: Vector2,
  foldEnd: Vector2,
  transform: ModelTransform,
  lineTypes: LineType[],
  layers: Layer[],
) {
  const positiveSegments: ShapeSegment[] = []
  const negativeSegments: ShapeSegment[] = []

  for (const shape of shapes) {
    const sampled = sampleShapePoints(shape, shape.type === 'line' ? 1 : 28)
    const color = shapeColor(shape, lineTypes, layers)

    for (let index = 0; index < sampled.length - 1; index += 1) {
      const start = projectPoint(sampled[index], transform)
      const end = projectPoint(sampled[index + 1], transform)
      const split = splitSegmentByFold(start, end, foldStart, foldEnd)

      for (const segment of split.positive) {
        if (segmentLengthSquared(segment.start, segment.end) > EPSILON) {
          positiveSegments.push({
            start: segment.start.clone(),
            end: segment.end.clone(),
            color,
          })
        }
      }

      for (const segment of split.negative) {
        if (segmentLengthSquared(segment.start, segment.end) > EPSILON) {
          negativeSegments.push({
            start: segment.start.clone(),
            end: segment.end.clone(),
            color,
          })
        }
      }
    }
  }

  return { positiveSegments, negativeSegments }
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

export function rebuildFoldModel({
  layers,
  lineTypes,
  shapes,
  foldLines,
  stitchHoles,
  outlinePolygons,
  transform,
  documentBounds,
  threadColor,
  texturedShapeIdSet,
  hasActiveTexture,
  materials,
  preservedMaterials,
  fitControlsToModel,
  staticSideGroup,
  foldingSideGroup,
  foldGuideGroup,
  assembledGroup,
  avatarGroup,
  foldingPivot,
  modelRoot,
  foldManager,
}: RebuildFoldModelParams) {
  clearGroup(assembledGroup, preservedMaterials)
  clearGroup(avatarGroup, preservedMaterials)
  clearGroup(staticSideGroup, preservedMaterials)
  clearGroup(foldingSideGroup, preservedMaterials)
  clearGroup(foldGuideGroup, preservedMaterials)
  foldManager.resetPanels()

  const documentRectangle = [
    projectPoint({ x: documentBounds.minX, y: documentBounds.minY }, transform),
    projectPoint({ x: documentBounds.maxX, y: documentBounds.minY }, transform),
    projectPoint({ x: documentBounds.maxX, y: documentBounds.maxY }, transform),
    projectPoint({ x: documentBounds.minX, y: documentBounds.maxY }, transform),
  ]
  const projectedDocumentBounds = polygonBounds(documentRectangle)

  let foldStart =
    foldLines.length > 0
      ? projectPoint(foldLines[0].start, transform)
      : new Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.minY)
  let foldEnd =
    foldLines.length > 0
      ? projectPoint(foldLines[0].end, transform)
      : new Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.maxY)

  if (segmentLengthSquared(foldStart, foldEnd) <= EPSILON) {
    foldStart = new Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.minY)
    foldEnd = new Vector2((projectedDocumentBounds.minX + projectedDocumentBounds.maxX) / 2, projectedDocumentBounds.maxY)
  }

  const foldMid = foldStart.clone().add(foldEnd).multiplyScalar(0.5)
  const foldBehavior = foldManager.configureFold({
    foldLine: foldLines[0] ?? null,
    foldStart,
    foldEnd,
    foldingPivot,
    transformScale: transform.scale,
  })
  const dynamicLayerStep = Math.max(
    LAYER_STACK_STEP,
    (foldBehavior.thicknessMm + foldBehavior.clearanceMm * 0.5) * transform.scale,
  )

  const layerOrder = layers.map((layer) => layer.id)
  const layerStackLevels = new Map<string, number>()
  let maxStackLevel = 0
  for (const [index, layer] of layers.entries()) {
    const stackLevel =
      typeof layer.stackLevel === 'number' && Number.isFinite(layer.stackLevel)
        ? Math.max(0, Math.round(layer.stackLevel))
        : index
    layerStackLevels.set(layer.id, stackLevel)
    maxStackLevel = Math.max(maxStackLevel, stackLevel)
  }

  const lineTypeById = new Map(lineTypes.map((lineType) => [lineType.id, lineType]))
  const layerPhysicalAnchorId = new Map<string, string>()
  const layerSlices: Array<{ layerId: string; shapes: Shape[]; hasPhysicalGeometry: boolean }> = []
  let currentPhysicalLayerId: string | null = null

  for (const layerId of layerOrder) {
    const layerShapes = shapes.filter((shape) => shape.layerId === layerId)
    const hasPhysicalGeometry = layerShapes.some((shape) => isPhysicalCutShape(shape, lineTypeById))
    if (hasPhysicalGeometry) {
      currentPhysicalLayerId = layerId
    }
    layerPhysicalAnchorId.set(layerId, currentPhysicalLayerId ?? layerId)
    if (layerShapes.length > 0) {
      layerSlices.push({ layerId, shapes: layerShapes, hasPhysicalGeometry })
    }
  }

  const orphanShapes = shapes.filter((shape) => !layerOrder.includes(shape.layerId))
  if (orphanShapes.length > 0) {
    const hasPhysicalGeometry = orphanShapes.some((shape) => isPhysicalCutShape(shape, lineTypeById))
    layerStackLevels.set('__orphan__', maxStackLevel + 1)
    maxStackLevel += 1
    if (hasPhysicalGeometry) {
      currentPhysicalLayerId = '__orphan__'
    }
    layerPhysicalAnchorId.set('__orphan__', currentPhysicalLayerId ?? '__orphan__')
    layerSlices.push({ layerId: '__orphan__', shapes: orphanShapes, hasPhysicalGeometry })
  }

  if (layerSlices.length === 0 && shapes.length > 0) {
    const hasPhysicalGeometry = shapes.some((shape) => isPhysicalCutShape(shape, lineTypeById))
    layerStackLevels.set('__all__', maxStackLevel + 1)
    layerPhysicalAnchorId.set('__all__', hasPhysicalGeometry ? '__all__' : currentPhysicalLayerId ?? '__all__')
    layerSlices.push({ layerId: '__all__', shapes, hasPhysicalGeometry })
  }

  let maxYOffset = 0
  for (const [index, layerSlice] of layerSlices.entries()) {
    const physicalAnchorId = layerPhysicalAnchorId.get(layerSlice.layerId) ?? layerSlice.layerId
    const stackLevel = layerStackLevels.get(physicalAnchorId) ?? layerStackLevels.get(layerSlice.layerId) ?? index
    const yOffset = stackLevel * dynamicLayerStep
    maxYOffset = Math.max(maxYOffset, yOffset)
    const hasTexturedShape =
      hasActiveTexture &&
      layerSlice.shapes.some((shape) => texturedShapeIdSet.has(shape.id))
    const staticMaterial = hasTexturedShape ? materials.leftTextureMaterial : materials.leftMaterial
    const foldingMaterial = hasTexturedShape ? materials.rightTextureMaterial : materials.rightMaterial

    if (layerSlice.hasPhysicalGeometry) {
      const cutShapes = layerSlice.shapes.filter((shape) => isPhysicalCutShape(shape, lineTypeById))
      const layerOutlines = outlinePolygons.filter((outline) => outline.layerId === layerSlice.layerId)
      let panelRegions: Array<{ outer: Vector2[]; holes: Vector2[][] }>
      let layerProjectedBounds: Bounds2

      const fallbackLayerBounds = buildBoundsFromShapes(cutShapes) ?? buildBoundsFromShapes(layerSlice.shapes) ?? documentBounds
      const fallbackLayerArea = Math.max(
        0,
        (fallbackLayerBounds.maxX - fallbackLayerBounds.minX) * (fallbackLayerBounds.maxY - fallbackLayerBounds.minY),
      )
      const outlineRegions = layerOutlines.length > 0 ? buildOutlineRegions(layerOutlines) : []
      const canUseDetectedOutlines = shouldUseOutlineRegions({
        cutShapes,
        layerOutlines,
        outlineRegions,
        fallbackBoundsArea: fallbackLayerArea,
      })
      const physicalLayerRegions = canUseDetectedOutlines
        ? []
        : buildPhysicalLayerRegions({
            layerId: layerSlice.layerId,
            shapes: layerSlice.shapes,
            lineTypeById,
            closedCutOutlines: layerOutlines,
          })

      if (canUseDetectedOutlines) {
        const regions = outlineRegions
        panelRegions = regions.map((region) => ({
          outer: region.outer.polygon.map((point) => projectPoint(point, transform)),
          holes: region.holes.map((hole) => hole.polygon.map((point) => projectPoint(point, transform))),
        }))
        const allPoints = panelRegions.flatMap((region) => [region.outer, ...region.holes]).flat()
        layerProjectedBounds = polygonBounds(allPoints)
      } else if (physicalLayerRegions.length > 0) {
        panelRegions = physicalLayerRegions.map((region) => ({
          outer: region.outer.map((point) => projectPoint(point, transform)),
          holes: region.holes.map((hole) => hole.map((point) => projectPoint(point, transform))),
        }))
        const allPoints = panelRegions.flatMap((region) => [region.outer, ...region.holes]).flat()
        layerProjectedBounds = polygonBounds(allPoints)
      } else {
        panelRegions = [{
          outer: [
            projectPoint({ x: fallbackLayerBounds.minX, y: fallbackLayerBounds.minY }, transform),
            projectPoint({ x: fallbackLayerBounds.maxX, y: fallbackLayerBounds.minY }, transform),
            projectPoint({ x: fallbackLayerBounds.maxX, y: fallbackLayerBounds.maxY }, transform),
            projectPoint({ x: fallbackLayerBounds.minX, y: fallbackLayerBounds.maxY }, transform),
          ],
          holes: [],
        }]
        layerProjectedBounds = polygonBounds(panelRegions[0].outer)
      }

      for (const panelRegion of panelRegions) {
        const panelPoly = panelRegion.outer
        let positivePolygon = clipPolygonByLine(panelPoly, foldStart, foldEnd, true)
        let negativePolygon = clipPolygonByLine(panelPoly, foldStart, foldEnd, false)
        let positiveHoles = panelRegion.holes
          .map((hole) => clipPolygonByLine(hole, foldStart, foldEnd, true))
          .filter((hole) => hole.length >= 3)
        let negativeHoles = panelRegion.holes
          .map((hole) => clipPolygonByLine(hole, foldStart, foldEnd, false))
          .filter((hole) => hole.length >= 3)
        if (positivePolygon.length < 3 && negativePolygon.length < 3) {
          positivePolygon = []
          negativePolygon = panelPoly.map((point) => point.clone())
          positiveHoles = []
          negativeHoles = panelRegion.holes.map((hole) => hole.map((point) => point.clone()))
        }

        if (negativePolygon.length >= 3) {
          const staticPanel = createPanelMesh(
            negativePolygon,
            staticMaterial,
            layerProjectedBounds,
            null,
            yOffset,
            negativeHoles,
          )
          if (staticPanel) {
            foldManager.registerStaticPanel(staticPanel)
            staticSideGroup.add(staticPanel)
            addPanelOutline(negativePolygon, staticSideGroup, '#e2e8f0', null, yOffset)
          }
        }

        if (positivePolygon.length >= 3) {
          const foldingPanel = createPanelMesh(
            positivePolygon,
            foldingMaterial,
            layerProjectedBounds,
            foldMid,
            yOffset,
            positiveHoles,
          )
          if (foldingPanel) {
            foldManager.registerFoldingPanel(foldingPanel)
            foldingSideGroup.add(foldingPanel)
            addPanelOutline(positivePolygon, foldingSideGroup, '#e2e8f0', foldMid, yOffset)
          }
        }
      }
    }

    const { positiveSegments, negativeSegments } = buildShapeSegments(
      layerSlice.shapes,
      foldStart,
      foldEnd,
      transform,
      lineTypes,
      layers,
    )
    for (const segment of negativeSegments) {
      addSegmentLine(staticSideGroup, segment, null, yOffset)
    }
    for (const segment of positiveSegments) {
      addSegmentLine(foldingSideGroup, segment, foldMid, yOffset)
    }

    const layerShapeIds = new Set(layerSlice.shapes.map((shape) => shape.id))
    const layerStitchHoles = stitchHoles.filter((stitchHole) => layerShapeIds.has(stitchHole.shapeId))
    const stitchHolesByShape = new Map<string, StitchHole[]>()
    for (const stitchHole of layerStitchHoles) {
      const entries = stitchHolesByShape.get(stitchHole.shapeId) ?? []
      entries.push(stitchHole)
      stitchHolesByShape.set(stitchHole.shapeId, entries)
    }

    for (const stitchHolesOnShape of stitchHolesByShape.values()) {
      const ordered = stitchHolesOnShape
        .slice()
        .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))

      const projectedPoints = ordered.map((stitchHole) => projectPoint(stitchHole.point, transform))
      for (const projectedPoint of projectedPoints) {
        if (sideOfLine(projectedPoint, foldStart, foldEnd) > -EPSILON) {
          addStitchPoint(foldingSideGroup, projectedPoint, threadColor, foldMid, yOffset)
        } else {
          addStitchPoint(staticSideGroup, projectedPoint, threadColor, null, yOffset)
        }
      }

      for (let index = 1; index < projectedPoints.length; index += 1) {
        const split = splitSegmentByFold(projectedPoints[index - 1], projectedPoints[index], foldStart, foldEnd)
        for (const segment of split.negative) {
          addSegmentLine(
            staticSideGroup,
            {
              start: segment.start,
              end: segment.end,
              color: threadColor,
            },
            null,
            yOffset + 0.0015,
          )
        }
        for (const segment of split.positive) {
          addSegmentLine(
            foldingSideGroup,
            {
              start: segment.start,
              end: segment.end,
              color: threadColor,
            },
            foldMid,
            yOffset + 0.0015,
          )
        }
      }
    }
  }

  const guideYOffset = maxYOffset + 0.006
  for (const foldLine of foldLines) {
    const projectedStart = projectPoint(foldLine.start, transform)
    const projectedEnd = projectPoint(foldLine.end, transform)
    const line = new Line(
      new BufferGeometry().setFromPoints([
        new Vector3(projectedStart.x, guideYOffset, projectedStart.y),
        new Vector3(projectedEnd.x, guideYOffset, projectedEnd.y),
      ]),
      new LineDashedMaterial({
        color: FOLD_LINE_COLOR,
        dashSize: 0.06,
        gapSize: 0.035,
      }),
    )
    line.computeLineDistances()
    foldGuideGroup.add(line)
  }

  foldManager.updateRotation({
    staticSideGroup,
    foldingSideGroup,
    modelRoot,
  })
  fitControlsToModel()
}
