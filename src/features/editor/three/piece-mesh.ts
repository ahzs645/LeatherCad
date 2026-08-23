import { Path, Shape as ThreeShape, Vector2 } from 'three'
import type { Point } from '../cad/cad-types'
import type { PieceMeshData } from './piece-mesh-data'

export {
  buildPieceMeshData,
  buildPieceMeshes,
  edgeAtIndex,
  edgesForShape,
  normalizeClosedPolygon,
  type PieceMeshData,
  type PieceOutlineEdge,
  type PieceShapeSegment,
} from './piece-mesh-data'

/**
 * An extrudable shape from a boundary polygon and the cutouts inside it.
 *
 * Split out from `createPieceShape` because a folded piece is drawn one region
 * at a time: the region has a polygon of its own and only some of the piece's
 * cutouts. Both callers project the same way, so they share this rather than
 * each keeping a copy of the mapping.
 */
export function createPolygonShape(
  outer: Point[],
  holes: Point[][],
  scale: number,
  centerX: number,
  centerY: number,
) {
  const toVector2 = (point: Point) =>
    new Vector2((point.x - centerX) * scale, -(point.y - centerY) * scale)

  const projectedOuter = outer.map(toVector2)
  const shape = new ThreeShape()
  shape.moveTo(projectedOuter[0].x, projectedOuter[0].y)
  for (let index = 1; index < projectedOuter.length; index += 1) {
    shape.lineTo(projectedOuter[index].x, projectedOuter[index].y)
  }
  shape.closePath()

  for (const hole of holes) {
    const projected = hole.map(toVector2)
    if (projected.length < 3) {
      continue
    }
    const path = new Path()
    path.moveTo(projected[0].x, projected[0].y)
    for (let index = 1; index < projected.length; index += 1) {
      path.lineTo(projected[index].x, projected[index].y)
    }
    path.closePath()
    shape.holes.push(path)
  }

  return shape
}

export function createPieceShape(
  piece: PieceMeshData,
  scale: number,
  centerX: number,
  centerY: number,
) {
  return createPolygonShape(piece.outer, piece.holes, scale, centerX, centerY)
}

export function projectPiecePoint(
  point: Point,
  scale: number,
  centerX: number,
  centerY: number,
) {
  return new Vector2((point.x - centerX) * scale, -(point.y - centerY) * scale)
}
