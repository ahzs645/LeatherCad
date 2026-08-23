/**
 * Where the seam overlays land.
 *
 * A seam that closes puts each hole on the hole it is sewn to, so the guide
 * lines between them have no length and never show. They were showing: the
 * overlay applied the piece group's matrix to a point that had not been made
 * pivot-relative, which rotates the pivot along with the point. On the imported
 * wallet that drew every one of the 49 pairs about 59 mm out, as a fan of
 * threads trailing off across the grid.
 */

import { describe, expect, it } from 'vitest'
import { Group, Vector3 } from 'three'
import { piecePointWorld } from './assembled-model-builder'
import type { PieceMeshData } from './piece-mesh'
import type { ModelTransform } from './model-builder-types'

const transform: ModelTransform = { scale: 1, centerX: 0, centerY: 0 }

/** A square piece, and the centroid the builder pivots it about. */
function squarePiece(pieceId: string, minX: number, minY: number, size: number): PieceMeshData {
  const outer = [
    { x: minX, y: minY },
    { x: minX + size, y: minY },
    { x: minX + size, y: minY + size },
    { x: minX, y: minY + size },
  ]
  return {
    pieceId,
    name: pieceId,
    outer,
    holes: [],
    shapeSegments: [],
    bounds: { minX, minY, maxX: minX + size, maxY: minY + size, width: size, height: size },
    center: { x: minX + size / 2, y: minY + size / 2 },
    edges: [],
  }
}

/** A piece group placed the way `createAssembledPieceGroup` places one. */
function placedGroup(piece: PieceMeshData, rotationDeg: Vector3, translationMm: Vector3) {
  const n = piece.outer.length
  const centroid = piece.outer.reduce(
    (sum, point) => ({ x: sum.x + point.x / n, y: sum.y + point.y / n }),
    { x: 0, y: 0 },
  )
  // projectPiecePoint then flatToWorld, for scale 1 and no centring.
  const pivot = new Vector3(centroid.x, 0, centroid.y)
  const group = new Group()
  group.rotation.setFromVector3(
    new Vector3(
      (rotationDeg.x * Math.PI) / 180,
      (rotationDeg.y * Math.PI) / 180,
      (rotationDeg.z * Math.PI) / 180,
    ),
  )
  group.position.set(
    pivot.x + translationMm.x,
    pivot.y + translationMm.y,
    pivot.z - translationMm.z,
  )
  group.updateMatrixWorld(true)
  return group
}

describe('piecePointWorld', () => {
  it('puts a point where the piece it belongs to actually is', () => {
    const piece = squarePiece('panel', 0, 0, 100)
    const group = placedGroup(piece, new Vector3(0, 0, 0), new Vector3(0, 0, 0))

    // Unrotated and unmoved, a corner stays on its corner.
    const corner = piecePointWorld({ x: 0, y: 0 }, piece, group, transform)

    expect(corner.x).toBeCloseTo(0, 6)
    expect(corner.z).toBeCloseTo(0, 6)
  })

  it('brings the two sides of a closed seam together', () => {
    // Two 100mm panels. The second is turned a quarter turn and moved so its
    // (0,0) corner lands on the first's (100,0) corner — a seam that closes.
    const left = squarePiece('left', 0, 0, 100)
    const right = squarePiece('right', 300, 0, 100)
    const leftGroup = placedGroup(left, new Vector3(0, 0, 0), new Vector3(0, 0, 0))
    const seam = piecePointWorld({ x: 100, y: 0 }, left, leftGroup, transform)

    // Solve the placement that lands the right panel's corner on that point.
    const rightGroup = placedGroup(right, new Vector3(0, 90, 0), new Vector3(0, 0, 0))
    const landed = piecePointWorld({ x: 300, y: 0 }, right, rightGroup, transform)
    const correction = seam.clone().sub(landed)
    const placed = placedGroup(
      right,
      new Vector3(0, 90, 0),
      new Vector3(correction.x, correction.y, -correction.z),
    )

    const mated = piecePointWorld({ x: 300, y: 0 }, right, placed, transform)
    expect(mated.distanceTo(seam)).toBeLessThan(1e-6)
  })

  it('is not the same as applying the group matrix to a raw point', () => {
    // The bug this replaced. With a rotated placement the two differ by
    // R·pivot - pivot, which is what put the wallet's seam threads 59mm out.
    const piece = squarePiece('panel', 0, 0, 100)
    const group = placedGroup(piece, new Vector3(0, 90, 0), new Vector3(0, 0, 0))
    const point = { x: 0, y: 0 }

    const correct = piecePointWorld(point, piece, group, transform)
    const buggy = new Vector3(point.x, 0, -point.y).applyMatrix4(group.matrixWorld)

    expect(correct.distanceTo(buggy)).toBeGreaterThan(50)
  })
})
