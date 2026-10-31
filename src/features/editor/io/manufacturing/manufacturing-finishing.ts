import type { Point } from '../../cad/cad-types'
import { createStlMeshBuilder } from '../stl-mesh'
import { clipRings, offsetRings, regionsFromRings, signedArea } from '../stl-polygons'

function boundaryDistance(point: Point, rings: Point[][]) {
  let best = Infinity
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy))
  }
  return best
}

/** Meshes true sloping bevel bands. Fillets use a selectable polygonal quarter-circle profile. */
export function buildFinishedPattern(material: Point[][], height: number, radius: number, finish: 'chamfer' | 'fillet', steps: number, tolerance: number) {
  if (radius * 2 >= height) throw new Error('Edge size must be less than half the pattern thickness.')
  const requiredSteps = Math.ceil((Math.PI / 2) / (2 * Math.acos(Math.max(-1, 1 - tolerance / 2 / radius))))
  const count = finish === 'chamfer' ? 1 : Math.max(steps, requiredSteps)
  if (count > 32) throw new Error('This fillet needs more than 32 divisions at the chosen tolerance. Reduce its radius or increase tolerance.')
  let vertexCount = 0
  const profiles = Array.from({ length: count + 1 }, (_, i) => {
    const angle = i / count * Math.PI / 2
    const z = finish === 'chamfer' ? radius * i / count : radius * (1 - Math.cos(angle))
    const inset = finish === 'chamfer' ? radius - z : radius * (1 - Math.sin(angle))
    const rings = offsetRings(material, -inset, tolerance / 2)
    vertexCount += rings.reduce((count, ring) => count + ring.length, 0)
    if (vertexCount > 100_000) throw new Error('Edge finishing exceeds the vertex budget. Export fewer outlines or increase curve tolerance.')
    if (!rings.length || rings.filter((ring) => signedArea(ring) > 0).length !== material.filter((ring) => signedArea(ring) > 0).length || rings.length !== material.length) throw new Error('Edge finishing would remove or split a narrow region. Reduce the edge size.')
    return { z, rings }
  })
  const builder = createStlMeshBuilder(profiles.flatMap((profile) => profile.rings.flat()))
  builder.caps(regionsFromRings(profiles[0].rings), 0, false)
  builder.caps(regionsFromRings(profiles[0].rings), height, true)
  builder.walls(material, radius, height - radius)
  for (let i = 0; i < profiles.length - 1; i++) {
    const inner = profiles[i], outer = profiles[i + 1]
    const bands = regionsFromRings(clipRings(outer.rings, inner.rings, true))
    const elevation = (point: Point) => boundaryDistance(point, inner.rings) < boundaryDistance(point, outer.rings) ? inner.z : outer.z
    builder.surface(bands, elevation, false)
    builder.surface(bands, (point) => height - elevation(point), true)
  }
  return builder.mesh
}
