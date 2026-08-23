/**
 * The rounded bend that carries leather across a crease.
 *
 * Rotating one half of a piece about the crease is the right thing to do to the
 * mid-surface and the wrong thing to do to the material. Each half is a slab a
 * material thickness deep, so at the crease the two slabs meet at a square
 * corner: their side walls cross into one another on the compression side and
 * leave a wedge open on the tension side. Rendered, that reads as a speckled
 * seam of z-fighting, and — worse — the crease picks up the piece's cut-edge
 * treatment, so a burnished or painted edge runs around a line where the
 * leather was never cut.
 *
 * The fix is the one PackCAD's renderer uses (`getOffsetPVertexPosition` plus
 * its bend radius) and that this repo's own Final Product mode already respects
 * in `isFoldEdge`: fold the mid-surface, offset each half along its own normal,
 * and bridge the two offset surfaces with an arc swept about the crease. The
 * arc has radius equal to the offset, so it starts exactly on one half's
 * surface and ends exactly on the other's — no gap to close and no inset to
 * tune. It also encloses both slabs' crease walls, which is why nothing has to
 * be cut away from them.
 *
 * Everything here is expressed in the frame of the half that stays put, where
 * the unfolded surface normal is +Y. The half that swings is that frame rotated
 * about the crease by the fold angle, so the arc's far end lands on it by
 * construction.
 */

import { Vector3 } from 'three'

/** Steps across the bend arc. Ten is what PackCAD's renderer sweeps. */
export const BEND_SEGMENTS = 10
/** Surface normal of an unfolded region, in the frame its geometry is drawn in. */
const SURFACE_NORMAL = new Vector3(0, 1, 0)
/** Below this the crease is a point, or the fold is not a fold. */
const EPSILON = 1e-9

export type BendGeometry = {
  /** Triangle vertices for the bend's grain-side surface. */
  frontTriangles: Vector3[]
  /** Triangle vertices for the bend's flesh-side surface. */
  backTriangles: Vector3[]
  /**
   * Triangle vertices closing the bend's cross-section at each end of the
   * crease. Unlike the bend itself these are genuine cut faces — the crease
   * runs out to the edge of the leather, and the material's thickness is on
   * show there — so they take the piece's edge treatment.
   */
  capTriangles: Vector3[]
}

function arcPoint(base: Vector3, axis: Vector3, angleRad: number, offset: number, t: number) {
  return SURFACE_NORMAL.clone()
    .applyAxisAngle(axis, angleRad * t)
    .multiplyScalar(offset)
    .add(base)
}

/** Two triangles spanning the quad a→b→d→c, wound consistently. */
function pushQuad(target: Vector3[], a: Vector3, b: Vector3, c: Vector3, d: Vector3) {
  target.push(a, b, c, a, c, d)
}

/** A triangle fan over a closed outline, from its first vertex. */
function pushFan(target: Vector3[], outline: Vector3[]) {
  for (let index = 1; index < outline.length - 1; index += 1) {
    target.push(outline[0], outline[index], outline[index + 1])
  }
}

/**
 * The bend geometry for one crease.
 *
 * `start` and `end` are the crease's own endpoints on the mid-surface, in the
 * frame of the half that stays. `angleRad` is signed the way the fold turns:
 * the arc sweeps with it, which puts the bulge on the outside of the fold for
 * a mountain and a valley alike.
 *
 * Returns null when there is nothing to draw — a crease of no length, leather
 * of no thickness, or a fold dialled back to flat, where the two halves are
 * already one surface.
 */
export function buildBendGeometry({
  start,
  end,
  angleRad,
  halfThickness,
  segments = BEND_SEGMENTS,
}: {
  start: Vector3
  end: Vector3
  angleRad: number
  halfThickness: number
  segments?: number
}): BendGeometry | null {
  const axisRaw = end.clone().sub(start)
  if (axisRaw.lengthSq() <= EPSILON || halfThickness <= EPSILON || Math.abs(angleRad) <= EPSILON) {
    return null
  }
  const axis = axisRaw.normalize()

  const startFront: Vector3[] = []
  const endFront: Vector3[] = []
  const startBack: Vector3[] = []
  const endBack: Vector3[] = []
  for (let step = 0; step <= segments; step += 1) {
    const t = step / segments
    startFront.push(arcPoint(start, axis, angleRad, halfThickness, t))
    endFront.push(arcPoint(end, axis, angleRad, halfThickness, t))
    startBack.push(arcPoint(start, axis, angleRad, -halfThickness, t))
    endBack.push(arcPoint(end, axis, angleRad, -halfThickness, t))
  }

  const frontTriangles: Vector3[] = []
  const backTriangles: Vector3[] = []
  for (let step = 0; step < segments; step += 1) {
    pushQuad(frontTriangles, startFront[step], endFront[step], endFront[step + 1], startFront[step + 1])
    pushQuad(backTriangles, startBack[step], startBack[step + 1], endBack[step + 1], endBack[step])
  }

  // The crease always runs clear across the piece — it is cut by the line
  // through the fold, not by a segment — so both of its ends are on the
  // boundary and both are open.
  const capTriangles: Vector3[] = []
  pushFan(capTriangles, [...startFront, ...startBack.slice().reverse()])
  pushFan(capTriangles, [...endFront, ...endBack.slice().reverse()])

  return { frontTriangles, backTriangles, capTriangles }
}
