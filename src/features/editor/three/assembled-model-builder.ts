import {
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Line,
  LineSegments,
  MathUtils,
  Material,
  Matrix4,
  Mesh,
  Float32BufferAttribute,
  ShapeGeometry,
  ShapeUtils,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
} from 'three'
import type {
  FoldLine,
  Point,
  PatternPiece,
  PiecePlacement3D,
  SeamConnection,
  StitchHole,
  ThreePreviewSettings,
} from '../cad/cad-types'
import { resolveConnectionSide, seamSideMidpoint } from '../assembly/seam-geometry'
import { scoreSeamStress } from '../assembly/stress-score'
import { DEFAULT_EDGE_PAINT_COLOR } from '../editor-constants'
import { createPolygonShape, projectPiecePoint, type PieceMeshData } from './piece-mesh'
import {
  regionContains,
  splitPieceByFolds,
  type AssembledFoldRegion,
  type FoldHingeStep,
} from './assembled-fold-regions'
import { bendCentre, buildBendGeometry, minimumBendRadiusMm } from './assembled-fold-bend'
import { resolveFoldBehavior } from '../ops/fold-line-ops'
import {
  solveFoldDrape,
  type DrapeFoldInput,
  type DrapeObstacleMesh,
  type FoldDrapeResult,
} from './assembled-fold-drape'
import type { FoldDrapeRequest, FoldDrapeStore } from './fold-drape-store'
import type { SharedMaterials } from './shared-materials'
import { clearGroup } from './bridge/scene-lifecycle'
import { buildStitchChains } from './final-product-stitch-pairing'
import type { ModelBuilderMaterials, ModelTransform, RebuildAssembledModelParams } from './model-builder-types'
import { buildSeamSewPlan, connectionIdForPair, sewnFractionForSeam } from '../assembly/seam-sew-order'
import type { StitchPair } from './final-product-types'
import { buildThreadSegments, saddleStitchSegments } from './stitch-thread'

const DEFAULT_THICKNESS_WORLD = 0.005
/**
 * Outline colours for the piece highlight, cycled by piece order.
 *
 * Deliberately not the piece's own colour: a piece is coloured to look like the
 * leather it will be cut from, so a document's pieces are usually three browns a
 * few degrees of hue apart. Outlining each in its own colour draws three
 * hairlines nobody can tell from each other or from the leather under them.
 * These read against tan and against the grey ground.
 */
const PIECE_OUTLINE_PALETTE = [
  '#38bdf8',
  '#f472b6',
  '#a3e635',
  '#c084fc',
  '#2563eb',
  '#22d3ee',
  '#f87171',
  '#14b8a6',
]
/** Outline colour when piece outlines are off — the neutral hairline this always drew. */
const PIECE_OUTLINE_NEUTRAL_COLOR = '#e2e8f0'
/**
 * Name prefix on the group holding one region's geometry.
 *
 * Everything inside such a group is expressed in the piece's own flat
 * coordinates, so inverting its `matrixWorld` takes a world point straight back
 * to the document — which is what the seam picker needs, and what the piece
 * group cannot give it, because the piece group's local space is offset by the
 * centroid its rotation pivots on.
 */
export const ASSEMBLED_REGION_GROUP_PREFIX = 'assembled-region-'
/** How much burnishing darkens the leather's own colour. */
const BURNISH_DARKEN = 0.45
/** How far off a fold line a boundary edge may sit and still count as its crease. */
const EDGE_ON_FOLD_TOLERANCE_MM = 1e-4

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

/** Vertex average of a polygon — good enough to tell two fold regions apart. */
function polygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) {
    return { x: 0, y: 0 }
  }
  let x = 0
  let y = 0
  for (const point of polygon) {
    x += point.x
    y += point.y
  }
  return { x: x / polygon.length, y: y / polygon.length }
}

/**
 * Which fold region a flat point belongs to.
 *
 * A point on a shared boundary — a stitch hole punched along the crease, a seam
 * midpoint at the root of a flap — can fail the containment test from both
 * sides. Falling back to the nearest region keeps it on the leather instead of
 * dropping it, which is the difference between a fold that carries its stitching
 * and one that appears to shed it.
 */
function regionIndexForPoint(regions: AssembledFoldRegion[], point: Point) {
  if (regions.length <= 1) {
    return 0
  }
  const containing = regions.findIndex((region) => regionContains(region, point))
  if (containing >= 0) {
    return containing
  }
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  regions.forEach((region, index) => {
    const centre = polygonCentroid(region.polygon)
    const distance = Math.hypot(centre.x - point.x, centre.y - point.y)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

/** A piece region and the object whose frame its geometry lives in. */
export type AssembledPieceFrame = {
  region: AssembledFoldRegion
  object: Group
}

/**
 * A folded piece's simulated surface, and the group whose frame it is drawn
 * in. Overlays prefer this over the rigid region frames when it exists: the
 * drape is where the leather actually is, bend, contact and all.
 */
export type AssembledPieceDrape = {
  solve: FoldDrapeResult
  object: Group
  /** Solved document-frame millimetres → the drape group's local space. */
  toLocal(point: { x: number; y: number; z: number }): Vector3
}

/** The frame a flat point on a piece moves with, once the piece's folds are applied. */
export function frameForPoint(frames: AssembledPieceFrame[], point: Point) {
  if (frames.length === 0) {
    return null
  }
  return frames[regionIndexForPoint(frames.map((frame) => frame.region), point)].object
}

/**
 * Build an extrudable shape from one region of a piece.
 *
 * A region only carries the cutouts that fall inside it. A hole handed to the
 * wrong region sits outside its outline, and the triangulator either ignores it
 * or fans stray faces across the leather.
 */
function createRegionShape(region: AssembledFoldRegion, holes: Point[][], transform: ModelTransform) {
  return createPolygonShape(
    region.polygon,
    holes.filter((hole) => hole.length >= 3 && regionContains(region, polygonCentroid(hole))),
    transform.scale,
    transform.centerX,
    transform.centerY,
  )
}

/**
 * The fold lines that bend this piece.
 *
 * A crease names its piece when the document knows which one it was drawn on.
 * When it does not, the crease belongs to whichever piece it sits inside: the
 * split clips against the infinite line through the crease, so an unattributed
 * crease would otherwise also slice a piece three sheets away that happens to
 * lie in line with it.
 */
function foldLinesForPiece(piece: PatternPiece, foldLines: FoldLine[], pieceMesh: PieceMeshData) {
  const outline: AssembledFoldRegion = { polygon: pieceMesh.outer, hinges: [] }
  return foldLines.filter((foldLine) => {
    if (foldLine.pieceId) {
      return foldLine.pieceId === piece.id
    }
    return regionContains(outline, {
      x: (foldLine.start.x + foldLine.end.x) / 2,
      y: (foldLine.start.y + foldLine.end.y) / 2,
    })
  })
}

/**
 * How much material a fold closes over.
 *
 * Not a search of the flat pattern: pieces are laid out apart on the sheet and
 * only come together once the seams place them, so a pocket and the panel it is
 * sewn to overlap in the assembly and nowhere in the document. What the fold
 * shuts against is what is sewn to the half that stays — for a wallet, the card
 * pocket stitched to the body the flap closes over.
 *
 * Every piece in the preview is cut from the same stock, so this counts those
 * pieces rather than measuring them. A seam landing on the half that swings
 * travels with the fold and is not inside it.
 */
export function wrappedThicknessMm(params: {
  /** The half that swings; a seam on this one moves with the fold. */
  region: AssembledFoldRegion
  pieceId: string
  seamConnections: SeamConnection[]
  pieceMeshById: Map<string, PieceMeshData>
  materialThicknessMm: number
}) {
  const { region, pieceId, seamConnections, pieceMeshById, materialThicknessMm } = params
  const wrapped = new Set<string>()

  for (const connection of seamConnections) {
    const side = connection.from.pieceId === pieceId ? 'from' : connection.to.pieceId === pieceId ? 'to' : null
    if (!side) {
      continue
    }
    const counterpart = side === 'from' ? connection.to.pieceId : connection.from.pieceId
    if (counterpart === pieceId) {
      continue
    }
    const resolved = resolveConnectionSide(pieceMeshById, connection, side)
    // Without a resolvable span the seam's position is unknown; count it, since
    // a fold that turns too wide only looks a little soft and one that turns
    // too tight passes through the leather it should be closing over.
    if (resolved && regionContains(region, seamSideMidpoint(resolved))) {
      continue
    }
    wrapped.add(counterpart)
  }

  return wrapped.size * Math.max(0, materialThicknessMm)
}

/**
 * The radius a hinge actually turns through: what was authored, or enough to
 * clear the fold.
 *
 * The floor is measured on the panel's half thickness even when the crease is
 * skived, which looks like an oversight and is not. It is tempting to let a
 * thinned spine close tighter for it, but this floor is not about how tightly
 * the leather can roll — it is about what the shut fold has to hold. The two
 * halves run a bend diameter apart down their whole length, and everywhere
 * past the bevel they are full-thickness panel, so the panel is what decides
 * how far apart they have to be.
 */
function hingeBendRadiusMm(hinge: FoldHingeStep, wrappedMm: number, halfThicknessMm: number) {
  return Math.max(hinge.bendRadiusMm, minimumBendRadiusMm(halfThicknessMm, wrappedMm))
}

/**
 * A hinge's axis in the piece's flat frame, projected into the scene.
 *
 * The origin is the bend centre, not the crease: with a radius the mid-surface
 * turns about a point a radius off the surface, which is what carries the half
 * that swings clear of the half that stays.
 */
function hingeAxis(hinge: FoldHingeStep, transform: ModelTransform, bendRadiusWorld: number) {
  const start = flatToWorld(projectPiecePoint(hinge.start, transform.scale, transform.centerX, transform.centerY), 0)
  const end = flatToWorld(projectPiecePoint(hinge.end, transform.scale, transform.centerX, transform.centerY), 0)
  const direction = end.clone().sub(start)
  if (direction.lengthSq() <= 0) {
    return null
  }
  return {
    origin: bendCentre(start, MathUtils.degToRad(hinge.angleDeg), bendRadiusWorld),
    crease: start,
    direction: direction.normalize(),
  }
}

/**
 * The frame one region's geometry is drawn in.
 *
 * Every region gets a content group, folded or not, and every content group
 * holds geometry in the piece's own flat coordinates. That uniformity is what
 * lets the seam overlays push a flat point through `matrixWorld` and land on the
 * leather wherever the folds have taken it, instead of needing one rule for the
 * part that stays put and another for the part that swings.
 *
 * The chain is cached by fold-line prefix so a piece folded twice nests one
 * pivot inside the other: the second crease turns in the frame the first left
 * behind, which is what an accordion does and what a flat list of rotations
 * about document-space axes cannot express.
 */
function regionFrame(
  region: AssembledFoldRegion,
  group: Group,
  transform: ModelTransform,
  pivotCache: Map<string, Group>,
  contentCache: Map<string, Group>,
  bendRadiusWorld: (hinge: FoldHingeStep) => number,
) {
  let parent = group
  let parentOrigin = new Vector3()
  let key = ''

  for (const hinge of region.hinges) {
    const axis = hingeAxis(hinge, transform, bendRadiusWorld(hinge))
    if (!axis) {
      continue
    }
    key = key.length > 0 ? `${key}|${hinge.foldLineId}` : hinge.foldLineId
    const cached = pivotCache.get(key)
    if (cached) {
      parent = cached
      parentOrigin = axis.origin
      continue
    }
    const pivot = new Group()
    pivot.name = `assembled-fold-${hinge.foldLineId}`
    pivot.position.copy(axis.origin).sub(parentOrigin)
    pivot.quaternion.setFromAxisAngle(axis.direction, MathUtils.degToRad(hinge.angleDeg))
    parent.add(pivot)
    pivotCache.set(key, pivot)
    parent = pivot
    parentOrigin = axis.origin
  }

  const cachedContent = contentCache.get(key)
  if (cachedContent) {
    return { content: cachedContent, key }
  }
  const content = new Group()
  content.name = `${ASSEMBLED_REGION_GROUP_PREFIX}${key || 'body'}`
  content.position.copy(parentOrigin).negate()
  parent.add(content)
  contentCache.set(key, content)
  return { content, key }
}

/**
 * Whether a boundary edge of a region lies along a crease rather than a cut.
 *
 * The split clips against the infinite line through a fold line, so the shared
 * edge it produces can run past the drawn fold's own endpoints; testing the
 * distance to that line rather than to the segment is what recognises the whole
 * of it. Both this repo's Final Product renderer and PackCAD's turn on the same
 * question: a crease gets no cut band, no edge treatment and no outline,
 * because the leather was never cut there.
 */
function edgeLiesOnFold(a: Point, b: Point, foldLines: FoldLine[]) {
  return foldLines.some((foldLine) => {
    const dx = foldLine.end.x - foldLine.start.x
    const dy = foldLine.end.y - foldLine.start.y
    const length = Math.hypot(dx, dy)
    if (length <= EDGE_ON_FOLD_TOLERANCE_MM) {
      return false
    }
    const distance = (point: Point) =>
      Math.abs((point.x - foldLine.start.x) * dy - (point.y - foldLine.start.y) * dx) / length
    return distance(a) <= EDGE_ON_FOLD_TOLERANCE_MM && distance(b) <= EDGE_ON_FOLD_TOLERANCE_MM
  })
}

/**
 * Point a crease edge the way its fold line runs.
 *
 * A region's boundary winds however the clip left it, so its crease edge can
 * run against the fold line — on the imported wallet it does. The hinge turns
 * the swinging half about the fold line's own direction, and an arc swept about
 * the reverse of that direction turns the other way: it leaves the crease and
 * curves off into space, so the two halves are drawn unjoined with the bend
 * stranded beside them. Both have to sweep about the same axis.
 */
export function orientCreaseEdge(a: Point, b: Point, axisStart: Point, axisEnd: Point): [Point, Point] {
  const along = (b.x - a.x) * (axisEnd.x - axisStart.x) + (b.y - a.y) * (axisEnd.y - axisStart.y)
  return along < 0 ? [b, a] : [a, b]
}

/** The edges of a region that sit on one particular crease, each pointing along it. */
function creaseEdges(region: AssembledFoldRegion, foldLine: FoldLine) {
  const edges: Array<[Point, Point]> = []
  const polygon = region.polygon
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index]
    const b = polygon[(index + 1) % polygon.length]
    if (edgeLiesOnFold(a, b, [foldLine])) {
      edges.push(orientCreaseEdge(a, b, foldLine.start, foldLine.end))
    }
  }
  return edges
}

/**
 * Draw a region's boundary, skipping the creases.
 *
 * `addPanelOutline` closes the loop, which is right for a panel and wrong for a
 * region: a fold is not a boundary, and outlining it draws a line across
 * leather that is continuous there.
 */
function addRegionOutline(
  target: Group,
  region: AssembledFoldRegion,
  foldLines: FoldLine[],
  transform: ModelTransform,
  color: string,
  yOffset: number,
  shared: SharedMaterials,
) {
  const points: Vector3[] = []
  const polygon = region.polygon
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index]
    const b = polygon[(index + 1) % polygon.length]
    if (edgeLiesOnFold(a, b, foldLines)) {
      continue
    }
    const project = (point: Point) =>
      flatToWorld(projectPiecePoint(point, transform.scale, transform.centerX, transform.centerY), yOffset + 0.004)
    points.push(project(a), project(b))
  }
  if (points.length === 0) {
    return
  }
  target.add(
    new LineSegments(new BufferGeometry().setFromPoints(points), shared.outline(color)),
  )
}

/**
 * Bridge the two halves of a crease with the leather that wraps around it.
 *
 * Built in the frame of the half that stays, where the arc's far end lands
 * exactly on the half that swings — that half's group is the same frame turned
 * by the same signed angle about the same axis.
 */
function addFoldBend(params: {
  parent: Group
  region: AssembledFoldRegion
  hinge: FoldHingeStep
  foldLine: FoldLine
  halfThickness: number
  bendRadiusWorld: number
  transform: ModelTransform
  frontMaterial: Material
  backMaterial: Material
  edgeMaterial: Material
}) {
  const { parent, region, hinge, foldLine, halfThickness, bendRadiusWorld, transform } = params
  const toWorld = (point: Point) =>
    flatToWorld(projectPiecePoint(point, transform.scale, transform.centerX, transform.centerY), 0)

  for (const [a, b] of creaseEdges(region, foldLine).map(([start, end]) =>
    orientCreaseEdge(start, end, hinge.start, hinge.end),
  )) {
    const bend = buildBendGeometry({
      start: toWorld(a),
      end: toWorld(b),
      angleRad: MathUtils.degToRad(hinge.angleDeg),
      halfThickness,
      bendRadius: bendRadiusWorld,
    })
    if (!bend) {
      continue
    }
    const addSurface = (vertices: Vector3[], material: Material) => {
      if (vertices.length === 0) {
        return
      }
      const geometry = new BufferGeometry().setFromPoints(vertices)
      geometry.computeVertexNormals()
      parent.add(new Mesh(geometry, material))
    }
    addSurface(bend.frontTriangles, params.frontMaterial)
    addSurface(bend.backTriangles, params.backMaterial)
    addSurface(bend.capTriangles, params.edgeMaterial)
  }
}

/**
 * A double-sided copy of a surface material, for the bend.
 *
 * The bend's winding flips with the fold's direction, and the reference
 * renderer solves that the same way: make the material double-sided so a fixed
 * triangle order is safe either way.
 */
function bendSurfaceMaterial(source: Material) {
  const material = source.clone()
  material.side = DoubleSide
  return material
}

/** Leather that minds nothing, leather being asked for a lot, leather past it. */
const STRESS_TINT_STOPS = [new Color('#ffffff'), new Color('#eab308'), new Color('#ef4444')]

/**
 * Per-vertex tint for a drape's stress values.
 *
 * Vertex colours multiply the material, so the calm end of the ramp has to be
 * white: the overlay is only allowed to say something where there is something
 * to say, and everywhere else the leather has to come out exactly the colour it
 * was. From there it climbs through the amber and red the seam overlay already
 * warns in, so one glance at a model reads the same way in both.
 */
function stressTintColors(stress: Float32Array) {
  const colors = new Float32Array(stress.length * 3)
  const tint = new Color()
  for (let index = 0; index < stress.length; index += 1) {
    const scaled = MathUtils.clamp(stress[index], 0, 1) * (STRESS_TINT_STOPS.length - 1)
    const stop = Math.min(STRESS_TINT_STOPS.length - 2, Math.floor(scaled))
    tint.copy(STRESS_TINT_STOPS[stop]).lerp(STRESS_TINT_STOPS[stop + 1], scaled - stop)
    colors[index * 3] = tint.r
    colors[index * 3 + 1] = tint.g
    colors[index * 3 + 2] = tint.b
  }
  return colors
}

/**
 * The matrix that carries one piece's flat-frame geometry into the world.
 *
 * `createAssembledPieceGroup` builds children in the piece's flat frame,
 * shifts them by the centroid pivot, and places the group with
 * `applyPlacementTransform`; this reproduces that placement on a throwaway
 * group so another piece's solve can know where this piece's leather sits
 * without the scene existing yet.
 */
function pieceFlatToWorldMatrix(params: {
  pieceId: string
  pieceMesh: PieceMeshData
  index: number
  total: number
  piecePlacements3d: PiecePlacement3D[]
  previewSettings: ThreePreviewSettings
  transform: ModelTransform
}) {
  const proxy = new Group()
  applyPlacementTransform(
    proxy,
    placementForPiece(params.pieceId, params.piecePlacements3d),
    params.index,
    params.total,
    params.previewSettings,
    params.transform,
    pieceCentroidWorld(params.pieceMesh, params.transform),
  )
  proxy.updateMatrix()
  return proxy.matrix
    .clone()
    .multiply(new Matrix4().makeTranslation(pieceCentroidWorld(params.pieceMesh, params.transform).negate()))
}

/** Resample a polygon down to at most `count` points, keeping its shape. */
function decimatePolygon(polygon: Point[], count: number) {
  if (polygon.length <= count) {
    return polygon
  }
  const decimated: Point[] = []
  for (let index = 0; index < count; index += 1) {
    decimated.push(polygon[Math.floor((index * polygon.length) / count)])
  }
  return decimated
}

/**
 * Every other piece's slab, expressed in one piece's document frame, for the
 * fold drape to collide with.
 *
 * This is what makes the fold general: the drape does not ask what a fold is
 * sewn to — it is handed where every piece of leather actually sits, and the
 * flap lands on whatever is in its way. Each slab is its mid-plane sheet plus
 * side walls; contact keeps mid-surfaces a material thickness apart, so the
 * mid-plane is the honest collision surface for stock of one thickness.
 */
export function drapeObstaclesForPiece(params: {
  pieceId: string
  pieces: PatternPiece[]
  pieceMeshById: Map<string, PieceMeshData>
  piecePlacements3d: PiecePlacement3D[]
  previewSettings: ThreePreviewSettings
  transform: ModelTransform
}): DrapeObstacleMesh[] {
  const { pieceId, pieces, pieceMeshById, piecePlacements3d, previewSettings, transform } = params
  const total = pieces.length
  const targetIndex = pieces.findIndex((piece) => piece.id === pieceId)
  const targetMesh = pieceMeshById.get(pieceId)
  if (targetIndex < 0 || !targetMesh) {
    return []
  }
  const intoTarget = pieceFlatToWorldMatrix({
    pieceId,
    pieceMesh: targetMesh,
    index: targetIndex,
    total,
    piecePlacements3d,
    previewSettings,
    transform,
  }).invert()
  const scale = transform.scale === 0 ? 1 : transform.scale
  const halfThicknessWorld = Math.max(previewSettings.thicknessMm * scale, DEFAULT_THICKNESS_WORLD) / 2

  const obstacles: DrapeObstacleMesh[] = []
  pieces.forEach((piece, index) => {
    if (piece.id === pieceId) {
      return
    }
    const pieceMesh = pieceMeshById.get(piece.id)
    if (!pieceMesh || pieceMesh.outer.length < 3) {
      return
    }
    const outline = decimatePolygon(pieceMesh.outer, 40)
    const fromPiece = pieceFlatToWorldMatrix({
      pieceId: piece.id,
      pieceMesh,
      index,
      total,
      piecePlacements3d,
      previewSettings,
      transform,
    })
    const toTargetDoc = new Matrix4().multiplyMatrices(intoTarget, fromPiece)
    const localPoint = (point: Point, height: number) =>
      flatToWorld(projectPiecePoint(point, transform.scale, transform.centerX, transform.centerY), height)
        .applyMatrix4(toTargetDoc)
    const docPoint = (point: Point, height: number) => {
      const local = localPoint(point, height)
      return [local.x / scale + transform.centerX, local.y / scale, local.z / scale + transform.centerY]
    }

    const positions: number[] = []
    const triangles: number[] = []
    // Mid-plane sheet: the surface the fold must stay a thickness away from.
    const contour = outline.map((point) =>
      projectPiecePoint(point, transform.scale, transform.centerX, transform.centerY),
    )
    for (const point of outline) {
      positions.push(...docPoint(point, 0))
    }
    for (const face of ShapeUtilsTriangulate(contour)) {
      triangles.push(face[0], face[1], face[2])
    }
    // Side walls between the slab's two faces, so a fold sweeping in sideways
    // meets the slab's edge instead of slipping under its surface.
    const wallBase = positions.length / 3
    for (const point of outline) {
      positions.push(...docPoint(point, halfThicknessWorld))
      positions.push(...docPoint(point, -halfThicknessWorld))
    }
    for (let index2 = 0; index2 < outline.length; index2 += 1) {
      const next = (index2 + 1) % outline.length
      const topA = wallBase + index2 * 2
      const bottomA = topA + 1
      const topB = wallBase + next * 2
      const bottomB = topB + 1
      triangles.push(topA, topB, bottomB, topA, bottomB, bottomA)
    }
    obstacles.push({ positions, triangles })
  })
  return obstacles
}

/** three's ear-clip triangulation over a projected contour, as index triples. */
function ShapeUtilsTriangulate(contour: Vector2[]) {
  return ShapeUtils.triangulateShape(contour, [])
}

/** Name given to drape shell meshes, so picking knows to read their uv maps. */
export const ASSEMBLED_DRAPE_MESH_NAME = 'assembled-drape-shell'

/**
 * The visible leather of a draped piece: the solved mid-surface offset half a
 * thickness each way, with walls along the cut boundary.
 *
 * Unlike the rigid path there is no bend to bridge and no crease to
 * special-case — the mesh is one continuous surface and the arc is simply
 * where the solve bent it. Every boundary edge is a genuine cut, so every
 * wall takes the piece's edge treatment.
 *
 * The offset is a half thickness only where the leather is at full thickness.
 * A fold may be skived — thinned along the crease so a stiff panel can turn at
 * all — and the solve says how much at every vertex, so the shell narrows into
 * the spine and swells back out to the panel exactly as the leather does.
 *
 * Two uv channels: `uv` carries the projected flat coordinates the extrude
 * path exposes to textures, so a texture flows unbroken across the fold;
 * `uv1` carries raw document millimetres, which is what lets a raycast on the
 * deformed surface come straight back as a document point.
 */
function addFoldDrapeShell(params: {
  parent: Group
  drape: FoldDrapeResult
  transform: ModelTransform
  halfThickness: number
  frontMaterial: Material
  backMaterial: Material
  edgeMaterial: Material
  outlineColor: string
  shared: SharedMaterials
  /** Tint the leather by how hard the fold is on it. */
  showStress: boolean
}) {
  const { drape, transform, halfThickness } = params
  const scale = transform.scale === 0 ? 1 : transform.scale
  const count = drape.positions.length / 3
  const local = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    local[index * 3] = (drape.positions[index * 3] - transform.centerX) * scale
    local[index * 3 + 1] = drape.positions[index * 3 + 1] * scale
    local[index * 3 + 2] = (drape.positions[index * 3 + 2] - transform.centerY) * scale
  }

  const uv = new Float32Array(count * 2)
  const uvDocument = new Float32Array(count * 2)
  for (let index = 0; index < count; index += 1) {
    uv[index * 2] = (drape.restPositions[index * 2] - transform.centerX) * scale
    uv[index * 2 + 1] = -(drape.restPositions[index * 2 + 1] - transform.centerY) * scale
    uvDocument[index * 2] = drape.restPositions[index * 2]
    uvDocument[index * 2 + 1] = drape.restPositions[index * 2 + 1]
  }

  // Half the leather's thickness at a vertex: the piece's, tapered into
  // whatever the fold is skived to where a crease runs through.
  const halfAt = (vertex: number) => halfThickness * drape.thicknessScale[vertex]

  // Built once and shared by both faces: stress is a property of the
  // mid-surface, so the grain side and the flesh side of a crease are in
  // exactly as much trouble as each other.
  const stressColors = params.showStress ? stressTintColors(drape.stress) : null

  const surface = (side: number, reverse: boolean, material: Material) => {
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const offset = side * halfAt(index)
      positions[index * 3] = local[index * 3] + drape.normals[index * 3] * offset
      positions[index * 3 + 1] = local[index * 3 + 1] + drape.normals[index * 3 + 1] * offset
      positions[index * 3 + 2] = local[index * 3 + 2] + drape.normals[index * 3 + 2] * offset
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uv.slice(), 2))
    geometry.setAttribute('uv1', new Float32BufferAttribute(uvDocument.slice(), 2))
    if (stressColors) {
      geometry.setAttribute('color', new Float32BufferAttribute(stressColors.slice(), 3))
    }
    const order = reverse
      ? drape.triangles.map((_, i, all) => all[i - (i % 3) + (2 - (i % 3))])
      : drape.triangles
    geometry.setIndex(order)
    geometry.computeVertexNormals()
    const mesh = new Mesh(geometry, material)
    mesh.name = ASSEMBLED_DRAPE_MESH_NAME
    params.parent.add(mesh)
  }
  const tinted = (material: Material) =>
    stressColors ? params.shared.vertexTinted(material) : material
  surface(1, false, tinted(params.frontMaterial))
  surface(-1, true, tinted(params.backMaterial))

  // Cut walls: one quad strip per boundary loop, spanning the two surfaces.
  const wallPositions: number[] = []
  const wallUv: number[] = []
  const wallUvDocument: number[] = []
  const wallIndex: number[] = []
  for (const loop of drape.boundaryLoops) {
    for (let index = 0; index < loop.length; index += 1) {
      const a = loop[index]
      const b = loop[(index + 1) % loop.length]
      const base = wallPositions.length / 3
      for (const [vertex, side] of [
        [a, 1],
        [b, 1],
        [b, -1],
        [a, -1],
      ] as Array<[number, number]>) {
        const offset = side * halfAt(vertex)
        wallPositions.push(
          local[vertex * 3] + drape.normals[vertex * 3] * offset,
          local[vertex * 3 + 1] + drape.normals[vertex * 3 + 1] * offset,
          local[vertex * 3 + 2] + drape.normals[vertex * 3 + 2] * offset,
        )
        wallUv.push(uv[vertex * 2], uv[vertex * 2 + 1])
        wallUvDocument.push(uvDocument[vertex * 2], uvDocument[vertex * 2 + 1])
      }
      wallIndex.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }
  if (wallIndex.length > 0) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(wallPositions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(wallUv, 2))
    geometry.setAttribute('uv1', new Float32BufferAttribute(wallUvDocument, 2))
    geometry.setIndex(wallIndex)
    geometry.computeVertexNormals()
    // The loop's winding decides which way the quads face; double-sided keeps
    // the cut visible either way, the same accommodation the bend makes.
    const mesh = new Mesh(geometry, bendSurfaceMaterial(params.edgeMaterial))
    mesh.name = ASSEMBLED_DRAPE_MESH_NAME
    params.parent.add(mesh)
  }

  // The piece outline, following the outer cut edge over the folds.
  const outer = drape.boundaryLoops[0] ?? []
  if (outer.length > 1) {
    const points: Vector3[] = []
    for (let index = 0; index < outer.length; index += 1) {
      for (const vertex of [outer[index], outer[(index + 1) % outer.length]]) {
        const lift = halfAt(vertex) + 0.0015
        points.push(
          new Vector3(
            local[vertex * 3] + drape.normals[vertex * 3] * lift,
            local[vertex * 3 + 1] + drape.normals[vertex * 3 + 1] * lift,
            local[vertex * 3 + 2] + drape.normals[vertex * 3 + 2] * lift,
          ),
        )
      }
    }
    params.parent.add(
      new LineSegments(new BufferGeometry().setFromPoints(points), params.shared.outline(params.outlineColor)),
    )
  }
}

/**
 * Stitch holes and thread runs carried onto the draped surface.
 *
 * The flat-path variant places these at a constant height over a flat piece;
 * here each hole rides the solved surface at its own point, so stitching on a
 * flap stays on the flap through the bend and over whatever it drapes on.
 */
function addDrapedStitchHoles(
  group: Group,
  piece: PatternPiece,
  drape: FoldDrapeResult,
  transform: ModelTransform,
  halfThickness: number,
  holes: StitchHole[],
  threadColor: string,
  shared: SharedMaterials,
) {
  if (holes.length === 0) {
    return
  }
  const scale = transform.scale === 0 ? 1 : transform.scale
  const surfacePoint = (point: Point, extraLift: number) => {
    const solved = drape.mapPoint(point)
    const normal = drape.mapNormal(point)
    const lift = halfThickness + extraLift
    return new Vector3(
      (solved.x - transform.centerX) * scale + normal.x * lift,
      solved.y * scale + normal.y * lift,
      (solved.z - transform.centerY) * scale + normal.z * lift,
    )
  }

  const geometry = new CylinderGeometry(0.006, 0.006, 0.003, 10)
  const material = shared.stitchThread(threadColor)
  const instances = new InstancedMesh(geometry, material, holes.length)
  const matrix = new Matrix4()
  holes.forEach((hole, index) => {
    matrix.makeRotationX(Math.PI / 2)
    const world = surfacePoint(hole.point, 0.0025)
    matrix.setPosition(world.x, world.y, world.z)
    instances.setMatrixAt(index, matrix)
  })
  instances.instanceMatrix.needsUpdate = true
  group.add(instances)

  const { chains } = buildStitchChains(holes)
  for (const chain of chains) {
    const points = chain.holes.map((hole) => surfacePoint(hole.point, 0.0025))
    const runs = buildThreadSegments(saddleStitchSegments(points), material, 0.0035, `assembled-stitch-run-${piece.id}-${chain.id}`)
    if (runs) {
      group.add(runs)
    }
  }
}

/**
 * The material for a piece's cut edges.
 *
 * Burnishing compresses and darkens the leather's own colour; edge paint lays a
 * different colour over it. A piece with no finish keeps the shared side
 * material, so nothing is allocated until someone asks for a finish.
 */
function edgeMaterialForPiece(piece: PatternPiece, materials: ModelBuilderMaterials) {
  const finish = piece.edgeFinish
  if (!finish?.enabled) {
    return materials.assembledSideMaterial
  }
  if (finish.style === 'paint') {
    return materials.shared.edgePaint(new Color(finish.color ?? DEFAULT_EDGE_PAINT_COLOR))
  }
  const base = piece.color ? new Color(piece.color) : materials.assembledSideMaterial.color.clone()
  return materials.shared.burnishedEdge(base.multiplyScalar(BURNISH_DARKEN))
}

function addAssembledStitchHoles(
  group: Group,
  piece: PatternPiece,
  topY: number,
  holes: StitchHole[],
  threadColor: string,
  transform: ModelTransform,
  shared: SharedMaterials,
) {
  if (holes.length === 0) {
    return
  }

  const geometry = new CylinderGeometry(0.006, 0.006, 0.003, 10)
  const material = shared.stitchThread(threadColor)
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
    const runs = buildThreadSegments(saddleStitchSegments(points), material, 0.0035, `assembled-stitch-run-${piece.id}-${chain.id}`)
    if (runs) {
      group.add(runs)
    }
  }
}

function createAssembledPieceGroup({
  piece,
  pieces,
  pieceMesh,
  index,
  total,
  piecePlacements3d,
  previewSettings,
  transform,
  texturedShapeIdSet,
  hasActiveTexture,
  materials,
  foldLines,
  seamConnections,
  pieceMeshById,
  stitchHoles,
  threadColor,
  foldDrape,
}: {
  piece: PatternPiece
  /** Every visible piece, in build order — the fold's collision world. */
  pieces: PatternPiece[]
  pieceMesh: PieceMeshData
  index: number
  total: number
  piecePlacements3d: PiecePlacement3D[]
  previewSettings: ThreePreviewSettings
  transform: ModelTransform
  texturedShapeIdSet: Set<string>
  hasActiveTexture: boolean
  materials: ModelBuilderMaterials
  foldLines: FoldLine[]
  /** Seams and meshes, so a fold can tell what it is closing over. */
  seamConnections: SeamConnection[]
  pieceMeshById: Map<string, PieceMeshData>
  stitchHoles: StitchHole[]
  threadColor: string
  /** Where finished drapes are kept. Absent solves each fold in place. */
  foldDrape?: FoldDrapeStore
}) {
  const group = new Group()
  // Tagged so a raycast hit can be traced back to the piece it belongs to.
  group.userData.pieceId = piece.id
  const thicknessWorld = Math.max(previewSettings.thicknessMm * transform.scale, DEFAULT_THICKNESS_WORLD)
  const halfThickness = thicknessWorld / 2
  const usesTexture = pieceUsesTexture(piece, texturedShapeIdSet, hasActiveTexture)
  const frontMaterial = usesTexture ? materials.leftTextureMaterial : materials.assembledFrontMaterial
  const sideMaterial = usesTexture ? materials.leftTextureMaterial : edgeMaterialForPiece(piece, materials)
  const outlineColor = previewSettings.showPieceOutlines
    ? PIECE_OUTLINE_PALETTE[index % PIECE_OUTLINE_PALETTE.length]
    : PIECE_OUTLINE_NEUTRAL_COLOR

  // A piece with a crease is two pieces of leather that happen to be one: the
  // part the seams hold, and the part that swings. Splitting here means the rest
  // of this function draws each part the way it used to draw the whole piece.
  const pieceFolds = foldLinesForPiece(piece, foldLines, pieceMesh)
  const regions = splitPieceByFolds(pieceMesh.outer, pieceFolds)
  const pieceShapeIdSet = new Set([piece.boundaryShapeId, ...piece.internalShapeIds])
  const pieceHoles = stitchHoles.filter((entry) => pieceShapeIdSet.has(entry.shapeId))
  const holeBuckets = regions.map<StitchHole[]>(() => [])
  for (const hole of pieceHoles) {
    holeBuckets[regionIndexForPoint(regions, hole.point)].push(hole)
  }

  const pivotCache = new Map<string, Group>()
  const contentCache = new Map<string, Group>()
  const frames: AssembledPieceFrame[] = []

  // How far each crease has to turn. Resolved once per piece so the pivot
  // chain, the drape and the bend surface can never disagree about it.
  const halfThicknessMm = Math.max(previewSettings.thicknessMm, 0) / 2
  const radiusMmByFoldId = new Map<string, number>()
  // Kept as well as the radius it feeds, because the drape needs the stack
  // itself: the radius is what the fold draws, the stack is what it may not
  // close tighter than, and the stress map is the difference between them.
  const wrappedMmByFoldId = new Map<string, number>()
  for (const region of regions) {
    for (const hinge of region.hinges) {
      if (radiusMmByFoldId.has(hinge.foldLineId)) {
        continue
      }
      const wrappedMm = wrappedThicknessMm({
        region,
        pieceId: piece.id,
        seamConnections,
        pieceMeshById,
        materialThicknessMm: previewSettings.thicknessMm,
      })
      wrappedMmByFoldId.set(hinge.foldLineId, wrappedMm)
      radiusMmByFoldId.set(hinge.foldLineId, hingeBendRadiusMm(hinge, wrappedMm, halfThicknessMm))
    }
  }
  const bendRadiusWorld = (hinge: FoldHingeStep) =>
    (radiusMmByFoldId.get(hinge.foldLineId) ?? 0) * transform.scale

  // The simulated fold. Each fold that is actually dialled becomes a crease
  // for the drape solver, and every other piece becomes a rigid body in its
  // way; the pivot-chain path below stays as the fallback when the solve
  // cannot run — a degenerate mesh, or a piece too big to settle live.
  const drapeFolds: DrapeFoldInput[] = []
  for (const foldLine of pieceFolds) {
    const swingRegion = regions.find((region) =>
      region.hinges.some((hinge) => hinge.foldLineId === foldLine.id),
    )
    const hinge = swingRegion?.hinges.find((entry) => entry.foldLineId === foldLine.id)
    if (!swingRegion || !hinge || Math.abs(hinge.angleDeg) < 0.5) {
      continue
    }
    // The crease's own material properties travel with it. They are parsed,
    // clamped and on screen in the Bend Controls panel; before this they
    // reached Fold mode and stopped there.
    const behavior = resolveFoldBehavior(foldLine)
    drapeFolds.push({
      foldLineId: foldLine.id,
      start: hinge.start,
      end: hinge.end,
      angleDeg: hinge.angleDeg,
      bendRadiusMm: radiusMmByFoldId.get(foldLine.id) ?? 0,
      swingSample: polygonCentroid(swingRegion.polygon),
      stiffness: behavior.stiffness,
      neutralAxisRatio: behavior.neutralAxisRatio,
      foldThicknessMm: behavior.thicknessMm,
      wrappedThicknessMm: wrappedMmByFoldId.get(foldLine.id) ?? 0,
    })
  }
  const drapeRequest: FoldDrapeRequest | null =
    drapeFolds.length > 0
      ? {
          pieceId: piece.id,
          outer: pieceMesh.outer,
          holes: pieceMesh.holes,
          folds: drapeFolds,
          thicknessMm: Math.max(
            previewSettings.thicknessMm,
            DEFAULT_THICKNESS_WORLD / (transform.scale === 0 ? 1 : transform.scale),
          ),
          obstacles: drapeObstaclesForPiece({
            pieceId: piece.id,
            pieces,
            pieceMeshById,
            piecePlacements3d,
            previewSettings,
            transform,
          }),
        }
      : null
  // With a store the drape may be a cached solve, a warm-started one landing
  // shortly, or the previous one still being drawn; without one the fold
  // solves here and now, which is what a test or a one-shot render wants.
  const drapeSolve = !drapeRequest
    ? null
    : foldDrape
      ? foldDrape.resolve(drapeRequest)
      : solveFoldDrape(drapeRequest)

  regions.forEach((region, regionIndex) => {
    const { content: target } = regionFrame(region, group, transform, pivotCache, contentCache, bendRadiusWorld)
    frames.push({ region, object: target })
    if (drapeSolve) {
      // The frames still exist — picking and overlays fall back to them —
      // but the drape draws the leather.
      return
    }
    const shape = createRegionShape(region, pieceMesh.holes, transform)

    const bodyGeometry = new ExtrudeGeometry(shape, { depth: thicknessWorld, bevelEnabled: false, steps: 1 })
    bodyGeometry.rotateX(-Math.PI / 2)
    bodyGeometry.translate(0, -halfThickness, 0)
    target.add(new Mesh(bodyGeometry, [frontMaterial, sideMaterial]))

    const backGeometry = new ShapeGeometry(shape)
    backGeometry.rotateX(-Math.PI / 2)
    backGeometry.translate(0, -halfThickness - 0.0008, 0)
    target.add(new Mesh(backGeometry, materials.assembledBackMaterial))

    addRegionOutline(
      target,
      region,
      pieceFolds,
      transform,
      outlineColor,
      halfThickness + 0.0015,
      materials.shared,
    )

    addAssembledStitchHoles(
      target,
      piece,
      halfThickness,
      holeBuckets[regionIndex],
      threadColor,
      transform,
      materials.shared,
    )
  })

  let drape: AssembledPieceDrape | null = null
  if (drapeSolve) {
    const drapeGroup = new Group()
    drapeGroup.name = 'assembled-drape'
    group.add(drapeGroup)
    addFoldDrapeShell({
      parent: drapeGroup,
      drape: drapeSolve,
      transform,
      halfThickness,
      frontMaterial,
      backMaterial: materials.assembledBackMaterial,
      edgeMaterial: sideMaterial,
      outlineColor,
      shared: materials.shared,
      showStress: previewSettings.showFoldStressOverlay,
    })
    addDrapedStitchHoles(
      drapeGroup,
      piece,
      drapeSolve,
      transform,
      halfThickness,
      pieceHoles,
      threadColor,
      materials.shared,
    )
    const scale = transform.scale === 0 ? 1 : transform.scale
    drape = {
      solve: drapeSolve,
      object: drapeGroup,
      toLocal: (point) =>
        new Vector3(
          (point.x - transform.centerX) * scale,
          point.y * scale,
          (point.z - transform.centerY) * scale,
        ),
    }
  }

  if (!drapeSolve) {
    // The leather that wraps the crease. It belongs to neither half, so it is
    // built once per crease in the frame of the half that stays; the extruded
    // slabs' own crease walls end up enclosed by it, which is why they are
    // left alone rather than cut away.
    const bendFrontMaterial = bendSurfaceMaterial(frontMaterial)
    const bendBackMaterial = bendSurfaceMaterial(materials.assembledBackMaterial)
    const bendEdgeMaterial = bendSurfaceMaterial(sideMaterial)
    for (const region of regions) {
      const hinge = region.hinges[region.hinges.length - 1]
      if (!hinge) {
        continue
      }
      const foldLine = pieceFolds.find((entry) => entry.id === hinge.foldLineId)
      const parent = contentCache.get(region.hinges.slice(0, -1).map((entry) => entry.foldLineId).join('|'))
      if (!foldLine || !parent) {
        continue
      }
      addFoldBend({
        parent,
        region,
        hinge,
        foldLine,
        halfThickness,
        bendRadiusWorld: bendRadiusWorld(hinge),
        transform,
        frontMaterial: bendFrontMaterial,
        backMaterial: bendBackMaterial,
        edgeMaterial: bendEdgeMaterial,
      })
    }
  }

  if (previewSettings.showEdgeLabels) {
    pieceMesh.edges.forEach((edge) => {
      const midpoint = projectPiecePoint(edge.midpoint, transform.scale, transform.centerX, transform.centerY)
      addEdgeLabel(group, `${edge.index + 1}`, flatToWorld(midpoint, halfThickness + 0.02), '#f8fafc')
    })
  }

  const placement = placementForPiece(piece.id, piecePlacements3d)
  // Offset the contents by the pivot so the group's own origin sits on the
  // piece centroid; applyPlacementTransform adds the pivot back to the position.
  const pivot = pieceCentroidWorld(pieceMesh, transform)
  group.children.forEach((child) => {
    child.position.sub(pivot)
  })
  applyPlacementTransform(group, placement, index, total, previewSettings, transform, pivot)
  group.updateMatrixWorld(true)

  return { group, frames, drape }
}

/**
 * A point on a piece, in world space.
 *
 * `createAssembledPieceGroup` subtracts the piece centroid from every child and
 * `applyPlacementTransform` adds it back through the group's own position, so
 * the group's matrix expects pivot-relative input. Handing it an unpivoted
 * point rotates the pivot along with the point and lands it `R·pivot - pivot`
 * away — which is why the seam overlays used to trail off across the grid
 * instead of sitting on the seam.
 */
export function piecePointWorld(
  point: Point,
  pieceMesh: PieceMeshData,
  group: Group,
  transform: ModelTransform,
) {
  const projected = projectPiecePoint(point, transform.scale, transform.centerX, transform.centerY)
  return flatToWorld(projected, 0)
    .sub(pieceCentroidWorld(pieceMesh, transform))
    .applyMatrix4(group.matrixWorld)
}

/**
 * A point on a piece, in world space, on the part of the piece it actually sits
 * on.
 *
 * Every region's content group holds geometry in the piece's own flat
 * coordinates, so a flat point pushed through the right group's `matrixWorld`
 * lands wherever the folds have carried that part of the leather. Reading the
 * piece group instead would draw a seam to where the flap would be if it were
 * still lying open — the stitches would leave the leather the moment the fold
 * moved.
 */
export function pieceFramePointWorld(
  point: Point,
  frames: AssembledPieceFrame[],
  pieceMesh: PieceMeshData,
  group: Group,
  transform: ModelTransform,
  drape?: AssembledPieceDrape | null,
) {
  if (drape) {
    return drape.toLocal(drape.solve.mapPoint(point)).applyMatrix4(drape.object.matrixWorld)
  }
  const frame = frameForPoint(frames, point)
  if (!frame) {
    return piecePointWorld(point, pieceMesh, group, transform)
  }
  const projected = projectPiecePoint(point, transform.scale, transform.centerX, transform.centerY)
  return flatToWorld(projected, 0).applyMatrix4(frame.matrixWorld)
}

function edgeMidpointWorld(
  group: Group,
  frames: AssembledPieceFrame[],
  pieceMesh: PieceMeshData,
  edgeIndex: number,
  transform: ModelTransform,
  drape?: AssembledPieceDrape | null,
) {
  const edge = pieceMesh.edges[Math.max(0, Math.min(pieceMesh.edges.length - 1, edgeIndex))]
  if (!edge) {
    return null
  }
  return pieceFramePointWorld(edge.midpoint, frames, pieceMesh, group, transform, drape)
}

function edgeLengthWorld(pieceMesh: PieceMeshData, edgeIndex: number, transform: ModelTransform) {
  const edge = pieceMesh.edges[Math.max(0, Math.min(pieceMesh.edges.length - 1, edgeIndex))]
  return edge ? edge.lengthMm * transform.scale : 0
}

/**
 * Where one side of a seam actually sits, and how long it actually is.
 *
 * The guide and the stress tint used to read `connection.from` / `connection.to`
 * — the legacy single-edge references, which name a whole boundary shape. A seam
 * authored as a portion of one, such as a 47mm pocket side sewn to the lower
 * 47mm of a 70mm panel side, then drew its guide between two points that are not
 * on the seam, and compared 70mm against 47mm and painted a well-matched seam
 * red. Resolving the side gives the span that is really sewn.
 */
function seamSideWorld(params: {
  group: Group
  frames: AssembledPieceFrame[]
  piece: PieceMeshData
  pieceMeshById: Map<string, PieceMeshData>
  connection: SeamConnection
  side: 'from' | 'to'
  transform: ModelTransform
  drape?: AssembledPieceDrape | null
}) {
  const { group, frames, piece, pieceMeshById, connection, side, transform, drape } = params
  const resolved = resolveConnectionSide(pieceMeshById, connection, side)
  if (!resolved) {
    const edgeIndex = connection[side].edgeIndex
    const midpoint = edgeMidpointWorld(group, frames, piece, edgeIndex, transform, drape)
    return midpoint ? { midpoint, lengthWorld: edgeLengthWorld(piece, edgeIndex, transform) } : null
  }
  return {
    midpoint: pieceFramePointWorld(seamSideMidpoint(resolved), frames, piece, group, transform, drape),
    lengthWorld: resolved.lengthMm * transform.scale,
  }
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

function addSeamGuide(
  group: Group,
  from: Vector3,
  to: Vector3,
  color: Color,
  dashed: boolean,
  shared: SharedMaterials,
) {
  const material = shared.seamGuide(color, dashed)
  const line = new Line(new BufferGeometry().setFromPoints([from, to]), material)
  if (line instanceof Line && 'computeLineDistances' in line) {
    line.computeLineDistances()
  }
  group.add(line)
}

/**
 * Draw a seam's stitching as links between the paired holes on its two sides,
 * clipped to the portion sewn so far.
 *
 * The holes are compiled in the pieces' own flat coordinates, so each side is
 * projected and then pushed through its piece group's world matrix — the pieces
 * have moved by the time this runs.
 */
function addSeamStitching(
  group: Group,
  params: {
    pairs: StitchPair[]
    fromGroup: Group
    toGroup: Group
    fromFrames: AssembledPieceFrame[]
    toFrames: AssembledPieceFrame[]
    fromPiece: PieceMeshData
    toPiece: PieceMeshData
    transform: ModelTransform
    color: Color
    sewnFraction: number
    fromDrape?: AssembledPieceDrape | null
    toDrape?: AssembledPieceDrape | null
    shared: SharedMaterials
  },
) {
  const { pairs, fromGroup, toGroup, fromFrames, toFrames, fromPiece, toPiece, transform, color, sewnFraction, fromDrape, toDrape, shared } = params
  if (pairs.length === 0 || sewnFraction <= 0) {
    return
  }

  const points: Vector3[] = []
  for (const pair of pairs) {
    const count = Math.min(pair.left.holes.length, pair.right.holes.length)
    const sewnCount = Math.max(1, Math.round(count * Math.min(sewnFraction, 1)))
    for (let index = 0; index < sewnCount; index += 1) {
      // On a closed seam these two land on top of each other, so the segment
      // between them is invisible. A visible one means the sides have not met.
      const left = pieceFramePointWorld(pair.left.holes[index].point, fromFrames, fromPiece, fromGroup, transform, fromDrape)
      const right = pieceFramePointWorld(pair.right.holes[index].point, toFrames, toPiece, toGroup, transform, toDrape)
      points.push(left, right)
    }
  }
  if (points.length === 0) {
    return
  }

  group.add(new LineSegments(new BufferGeometry().setFromPoints(points), shared.seamStitch(color)))
}

export function rebuildAssembledModel({
  layers,
  patternPieces,
  piecePlacements3d,
  seamConnections,
  foldLines,
  stitchPairs,
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
  foldDrape,
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
    const pieceFramesById = new Map<string, AssembledPieceFrame[]>()
    const pieceDrapeById = new Map<string, AssembledPieceDrape | null>()

    pieces.forEach((piece, index) => {
      const pieceMesh = pieceMeshById.get(piece.id)
      if (!pieceMesh) {
        return
      }
      const { group, frames, drape } = createAssembledPieceGroup({
        piece,
        pieces,
        pieceMesh,
        index,
        total: pieces.length,
        piecePlacements3d,
        previewSettings,
        transform,
        texturedShapeIdSet,
        hasActiveTexture,
        materials,
        foldLines,
        seamConnections,
        pieceMeshById,
        stitchHoles,
        threadColor,
        foldDrape,
      })
      pieceGroupById.set(piece.id, group)
      pieceFramesById.set(piece.id, frames)
      pieceDrapeById.set(piece.id, drape)
      assembledGroup.add(group)
    })

    if (previewSettings.showSeams) {
      // Seams are laid end to end on one stitch axis, so a partly-sewn project
      // shows its finished seams whole, the seam under the needle part-way, and
      // the rest not yet joined.
      const sewPlan = buildSeamSewPlan({ seamConnections, stitchPairs: stitchPairs ?? [] })
      for (const connection of seamConnections) {
        const fromGroup = pieceGroupById.get(connection.from.pieceId)
        const toGroup = pieceGroupById.get(connection.to.pieceId)
        const fromPiece = pieceMeshById.get(connection.from.pieceId)
        const toPiece = pieceMeshById.get(connection.to.pieceId)
        if (!fromGroup || !toGroup || !fromPiece || !toPiece) {
          continue
        }

        const fromFrames = pieceFramesById.get(connection.from.pieceId) ?? []
        const toFrames = pieceFramesById.get(connection.to.pieceId) ?? []
        const fromDrape = pieceDrapeById.get(connection.from.pieceId) ?? null
        const toDrape = pieceDrapeById.get(connection.to.pieceId) ?? null
        const fromSide = seamSideWorld({ group: fromGroup, frames: fromFrames, piece: fromPiece, pieceMeshById, connection, side: 'from', transform, drape: fromDrape })
        const toSide = seamSideWorld({ group: toGroup, frames: toFrames, piece: toPiece, pieceMeshById, connection, side: 'to', transform, drape: toDrape })
        if (!fromSide || !toSide) {
          continue
        }
        const sewnFraction = sewnFractionForSeam(sewPlan, connection.id, previewSettings.sewnStitchCount)
        if (sewnFraction <= 0) {
          continue
        }
        const color = seamColorForConnection(
          fromSide.lengthWorld,
          toSide.lengthWorld,
          fromSide.midpoint.distanceTo(toSide.midpoint),
          previewSettings,
          (connection.toleranceMm ?? 1) * transform.scale,
        )
        addSeamGuide(
          assembledGroup,
          fromSide.midpoint,
          toSide.midpoint,
          color,
          connection.kind !== 'aligned',
          materials.shared,
        )
        addSeamStitching(assembledGroup, {
          pairs: (stitchPairs ?? []).filter((pair) => connectionIdForPair(pair) === connection.id),
          fromGroup,
          toGroup,
          fromFrames,
          toFrames,
          fromPiece,
          toPiece,
          transform,
          color,
          sewnFraction,
          fromDrape,
          toDrape,
          shared: materials.shared,
        })
      }
    }
  }

  // The avatar manager clears `avatarGroup` and then no-ops unless the preview is in
  // Avatar mode, so Assembled mode still renders pattern geometry only. Its procedural
  // fallback is added synchronously, which keeps the fit below framing the mannequin.
  void rebuildAvatarModel()
  fitControlsToModel()
}
