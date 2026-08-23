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
 * and bridge the two offset surfaces with an arc swept about the bend.
 *
 * The bend has a radius. Leather does not crease to a point — it rolls, and how
 * tightly depends on the temper and on what is inside the fold — so the fold
 * line carries a `radiusMm` that Fold and Final Product modes already honour.
 * Honouring it here does more than round the spine: the mid-surface follows an
 * arc of that radius, which means the half that swings is carried a bend
 * diameter clear of the half that stays. That gap is what a wallet's flap needs
 * to close over the pocket sewn to its body instead of passing through it.
 *
 * Everything here is expressed in the frame of the half that stays put, where
 * the unfolded surface normal is +Y. The half that swings is that frame rotated
 * about the bend centre by the fold angle, so the arc's far end lands on it by
 * construction. With a radius of zero the centre is the crease itself and this
 * degenerates to the sharp-crease shell PackCAD builds.
 */

import { Vector3 } from 'three'

/** Steps across the bend arc. Ten is what PackCAD's renderer sweeps. */
export const BEND_SEGMENTS = 10
/** Surface normal of an unfolded region, in the frame its geometry is drawn in. */
const SURFACE_NORMAL = new Vector3(0, 1, 0)
/** Below this the crease is a point, or the fold is not a fold. */
const EPSILON = 1e-9

/**
 * The radius a fold has to turn through so it does not close on top of itself.
 *
 * A fold carries the half that swings a bend diameter clear of the half that
 * stays. Fully closed, that gap is all the room there is, so it has to hold the
 * two halves' own thickness plus anything sewn between them: a wallet flap
 * closing over a card pocket needs to clear the pocket, not pass through it.
 *
 * The authored radius wins when it is already generous — a maker who dials a
 * soft roll gets a soft roll — and this is only the floor under it.
 */
export function minimumBendRadiusMm(halfThicknessMm: number, wrappedThicknessMm: number) {
  return Math.max(0, halfThicknessMm) + Math.max(0, wrappedThicknessMm) / 2
}

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

/**
 * Where the bend turns.
 *
 * The material wraps towards the side the swinging half moves to, so the centre
 * of curvature is a radius away on the opposite side of the surface. At radius
 * zero it is the crease itself.
 */
export function bendCentre(creasePoint: Vector3, angleRad: number, bendRadius: number) {
  return SURFACE_NORMAL.clone()
    .multiplyScalar(-Math.sign(angleRad) * bendRadius)
    .add(creasePoint)
}

/**
 * A point on the bend, `offset` from the mid-surface, a fraction `t` through the
 * turn.
 *
 * Measured from the bend centre rather than from the crease, so the surfaces
 * come out at radius `bendRadius ± halfThickness` and the inside of the fold
 * stays inside.
 */
function arcPoint(
  creasePoint: Vector3,
  axis: Vector3,
  angleRad: number,
  bendRadius: number,
  offset: number,
  t: number,
) {
  const centre = bendCentre(creasePoint, angleRad, bendRadius)
  return SURFACE_NORMAL.clone()
    .multiplyScalar(Math.sign(angleRad) * bendRadius + offset)
    .applyAxisAngle(axis, angleRad * t)
    .add(centre)
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
  bendRadius = 0,
  segments = BEND_SEGMENTS,
}: {
  start: Vector3
  end: Vector3
  angleRad: number
  halfThickness: number
  /** Radius of the mid-surface through the turn. Zero creases to a point. */
  bendRadius?: number
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
    startFront.push(arcPoint(start, axis, angleRad, bendRadius, halfThickness, t))
    endFront.push(arcPoint(end, axis, angleRad, bendRadius, halfThickness, t))
    startBack.push(arcPoint(start, axis, angleRad, bendRadius, -halfThickness, t))
    endBack.push(arcPoint(end, axis, angleRad, bendRadius, -halfThickness, t))
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
