/**
 * Turning a click on the assembled model into a seam edge pick.
 *
 * This is the piece that lets a seam be started on the flat canvas and finished
 * on the 3D model, which is how Seamer Studio's seam tool works: one state
 * machine, two views feeding it. The 3D preview had no picking at all — no
 * raycaster anywhere under `three/` — so the model was purely something to look
 * at.
 *
 * The mapping runs the opposite way to rendering. A ray hits a piece's mesh in
 * world space; the piece group's inverse world matrix brings that point back to
 * the flat layout the piece was built from, and from there the boundary edge is
 * the nearest one in plain 2D.
 */

import { Matrix4, Vector3, type Group, type Object3D } from 'three'
import type { PieceMeshData } from './piece-mesh'
import type { ModelTransform } from './model-builder-types'

export type PickedSeamEdge = {
  pieceId: string
  pieceName: string
  edgeIndex: number
  boundaryShapeId?: string
  /** Position along the authored boundary shape the click landed at, 0..1. */
  parameter: number
  /** Distance from the click to the edge, in document millimetres. */
  distanceMm: number
}

/** The piece group an intersected object belongs to, by walking up the tree. */
export function pieceIdForObject(object: Object3D | null): string | null {
  let current: Object3D | null = object
  while (current) {
    const pieceId: unknown = current.userData?.pieceId
    if (typeof pieceId === 'string') {
      return pieceId
    }
    current = current.parent
  }
  return null
}

/**
 * Undo the viewport's flat-to-world mapping for a point on a placed piece.
 *
 * `projectPiecePoint` scales and centres, and the body geometry's -90 degree X
 * rotation negates the projected Y on the way to world Z, so document Y comes
 * back from world Z directly.
 */
export function worldPointToDocument(
  worldPoint: Vector3,
  pieceGroup: Group,
  transform: ModelTransform,
) {
  const local = worldPoint.clone().applyMatrix4(new Matrix4().copy(pieceGroup.matrixWorld).invert())
  const scale = transform.scale === 0 ? 1 : transform.scale
  return {
    x: local.x / scale + transform.centerX,
    y: local.z / scale + transform.centerY,
  }
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 1e-9) {
    return { distance: Math.hypot(point.x - start.x, point.y - start.y), t: 0 }
  }
  const t = Math.min(Math.max(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0), 1)
  return {
    distance: Math.hypot(start.x + dx * t - point.x, start.y + dy * t - point.y),
    t,
  }
}

/**
 * The boundary edge nearest a point in the piece's own flat coordinates, with
 * the position along the authored shape that owns it.
 *
 * A curved side samples to dozens of edges, so the parameter is measured along
 * the whole shape rather than within whichever chord was hit — otherwise the
 * inferred seam direction would be meaningless on a curve.
 */
export function nearestBoundaryEdge(
  piece: PieceMeshData,
  point: { x: number; y: number },
): PickedSeamEdge | null {
  let best: { edgeIndex: number; t: number; distance: number } | null = null
  for (const edge of piece.edges) {
    const { distance, t } = distanceToSegment(point, edge.start, edge.end)
    if (!best || distance < best.distance) {
      best = { edgeIndex: edge.index, t, distance }
    }
  }
  if (!best) {
    return null
  }

  const segment = piece.shapeSegments.find(
    (entry) => best.edgeIndex >= entry.firstEdgeIndex && best.edgeIndex <= entry.lastEdgeIndex,
  )

  let parameter = best.t
  if (segment) {
    const edgeCount = segment.lastEdgeIndex - segment.firstEdgeIndex + 1
    parameter = edgeCount <= 0 ? best.t : (best.edgeIndex - segment.firstEdgeIndex + best.t) / edgeCount
  }

  return {
    pieceId: piece.pieceId,
    pieceName: piece.name,
    edgeIndex: best.edgeIndex,
    boundaryShapeId: segment?.shapeId,
    parameter: Math.min(Math.max(parameter, 0), 1),
    distanceMm: best.distance,
  }
}
