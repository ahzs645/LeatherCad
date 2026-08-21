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

export function createPieceShape(
  piece: PieceMeshData,
  scale: number,
  centerX: number,
  centerY: number,
) {
  const toVector2 = (point: Point) =>
    new Vector2((point.x - centerX) * scale, -(point.y - centerY) * scale)

  const outer = piece.outer.map(toVector2)
  const shape = new ThreeShape()
  shape.moveTo(outer[0].x, outer[0].y)
  for (let index = 1; index < outer.length; index += 1) {
    shape.lineTo(outer[index].x, outer[index].y)
  }
  shape.closePath()

  for (const hole of piece.holes) {
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

export function projectPiecePoint(
  point: Point,
  scale: number,
  centerX: number,
  centerY: number,
) {
  return new Vector2((point.x - centerX) * scale, -(point.y - centerY) * scale)
}
