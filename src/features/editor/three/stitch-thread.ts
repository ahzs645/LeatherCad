/**
 * Instanced thread-segment rendering for saddle stitching in the 3D preview.
 *
 * A leather stitch line is thread, not markers: each straight run between two
 * stitch holes (and each cross-seam pass through the leather) is drawn as a
 * thin lit cylinder, so waxed thread catches the key light and reads as
 * stitching the way Seamer Studio's seam rendering does — rather than the
 * unlit dots and flat lines the preview drew before.
 */

import {
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'

export type ThreadSegment = {
  start: Vector3
  end: Vector3
}

const THREAD_RADIAL_SEGMENTS = 6
const UP = new Vector3(0, 1, 0)

export function createThreadMaterial(color: string) {
  // Waxed polyester/linen: mostly diffuse with a slight sheen.
  return new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 })
}

/**
 * Build one instanced mesh containing every thread segment. Unit-height
 * cylinder geometry, scaled to each segment's length and rotated from the
 * Y axis onto the segment direction.
 */
export function buildThreadSegments(
  segments: ThreadSegment[],
  material: MeshStandardMaterial,
  radius: number,
  name: string,
) {
  const visible = segments.filter((segment) => segment.start.distanceToSquared(segment.end) > 1e-12)
  if (visible.length === 0) {
    return null
  }
  const geometry = new CylinderGeometry(radius, radius, 1, THREAD_RADIAL_SEGMENTS, 1)
  const mesh = new InstancedMesh(geometry, material, visible.length)
  mesh.name = name

  const matrix = new Matrix4()
  const quaternion = new Quaternion()
  const direction = new Vector3()
  const midpoint = new Vector3()
  const scale = new Vector3()

  visible.forEach((segment, index) => {
    direction.subVectors(segment.end, segment.start)
    const length = direction.length()
    quaternion.setFromUnitVectors(UP, direction.normalize())
    midpoint.addVectors(segment.start, segment.end).multiplyScalar(0.5)
    scale.set(1, length, 1)
    matrix.compose(midpoint, quaternion, scale)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.castShadow = true
  return mesh
}

/** Consecutive-hole runs along one face of the leather (the visible stitch line). */
export function chainRunSegments(points: Vector3[]): ThreadSegment[] {
  const segments: ThreadSegment[] = []
  for (let index = 0; index + 1 < points.length; index += 1) {
    segments.push({ start: points[index], end: points[index + 1] })
  }
  return segments
}
