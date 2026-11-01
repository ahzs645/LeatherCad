import type { Point } from '../../cad/cad-types'
import { createStlMeshBuilder } from '../stl-mesh'
import { clipRings, offsetRings, regionsFromRings, signedArea } from '../stl-polygons'
import { refineManufacturingSurface } from './manufacturing-surface-refinement'

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
export function buildFinishedPrism(material: Point[][], height: number, radius: number, finish: 'chamfer' | 'fillet', steps: number, tolerance: number, sides = { top: true, bottom: true }) {
  if (sides.top && sides.bottom ? radius * 2 >= height : radius > height + 1e-8) throw new Error('Edge size must be less than half the pattern thickness, or fit a single finished face.')
  const requiredSteps = Math.ceil((Math.PI / 2) / (2 * Math.acos(Math.max(-1, 1 - tolerance / 2 / radius))))
  const count = finish === 'chamfer' ? 1 : Math.max(steps, requiredSteps)
  if (count > 32) throw new Error('This fillet needs more than 32 divisions at the chosen tolerance. Reduce its radius or increase tolerance.')
  let vertexCount = 0
  const profiles = Array.from({ length: count + 1 }, (_, i) => {
    const angle = i / count * Math.PI / 2
    const z = finish === 'chamfer' ? radius * i / count : radius * (1 - Math.cos(angle))
    const inset = finish === 'chamfer' ? radius - z : radius * (1 - Math.sin(angle))
    const rings = offsetRings(material, -inset, tolerance / 32)
    vertexCount += rings.reduce((count, ring) => count + ring.length, 0)
    if (vertexCount > 100_000) throw new Error('Edge finishing exceeds the vertex budget. Export fewer outlines or increase curve tolerance.')
    if (!rings.length || rings.filter((ring) => signedArea(ring) > 0).length !== material.filter((ring) => signedArea(ring) > 0).length || rings.length !== material.length) throw new Error('Edge finishing would remove or split a narrow region. Reduce the edge size.')
    return { z, rings }
  })
  const builder = createStlMeshBuilder(profiles.flatMap((profile) => profile.rings.flat()))
  const topAt = (point: Point) => {
    const distance = Math.min(radius, Math.max(0, boundaryDistance(point, material)))
    return finish === 'chamfer' ? distance : Math.sqrt(Math.max(0, radius * radius - (radius - distance) ** 2))
  }
  const bottomAt = (point: Point) => radius - topAt(point)
  builder.caps(regionsFromRings(sides.bottom ? profiles[0].rings : material), 0, false)
  builder.caps(regionsFromRings(sides.top ? profiles[0].rings : material), height, true)
  const bottom = sides.bottom ? radius : 0, top = sides.top ? height - radius : height
  if (top > bottom + 1e-8) builder.walls(material, bottom, top)
  for (let i = 0; i < profiles.length - 1; i++) {
    const inner = profiles[i], outer = profiles[i + 1]
    const bands = regionsFromRings(clipRings(outer.rings, inner.rings, true))
    const elevation = (point: Point) => boundaryDistance(point, inner.rings) < 1e-8 ? inner.z : boundaryDistance(point, outer.rings) < 1e-8 ? outer.z : bottomAt(point)
    const ramp = createStlMeshBuilder(profiles.flatMap(profile => profile.rings.flat()))
    ramp.surface(bands, elevation, false)
    const errorAt = (point: { x: number; y: number; z: number }) => {
      const d = Math.min(radius, Math.max(0, boundaryDistance(point, material)))
      return finish === 'chamfer' ? Math.abs(radius - point.z - d) / Math.SQRT2 : Math.abs(Math.hypot(radius - d, radius - point.z) - radius)
    }
    const refined = refineManufacturingSurface(ramp.mesh, bottomAt, errorAt, tolerance)
    if (sides.bottom) builder.append(refined)
    if (sides.top) builder.append({ vertices: refined.vertices.map(point => ({ ...point, z: height - point.z })), triangles: refined.triangles.map(([a, b, c]) => [a, c, b]) })
  }
  return builder.mesh
}

export const buildFinishedPattern = (material: Point[][], height: number, radius: number, finish: 'chamfer' | 'fillet', steps: number, tolerance: number) => buildFinishedPrism(material, height, radius, finish, steps, tolerance)
