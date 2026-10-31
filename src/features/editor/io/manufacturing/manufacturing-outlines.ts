import type { Point, Shape } from '../../cad/cad-types'
import { cleanRing, validateRing } from '../stl-polygons'
import { flattenManufacturingShape } from './manufacturing-curves'

export function manufacturingOutlines(shapes: Shape[], toleranceMm: number): Point[][] {
  let sampledVertices = 0
  const entries = shapes.filter((shape) => shape.type !== 'text').map((shape) => {
    const points = flattenManufacturingShape(shape, toleranceMm / 2)
    sampledVertices += points.length
    if (sampledVertices > 50_000) throw new Error('Manufacturing exceeds 50,000 outline vertices. Export fewer shapes or increase curve tolerance.')
    return { id: shape.id, points }
  })
  const unused = new Set(entries.map((_, i) => i))
  const rings: Point[][] = []
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  while (unused.size) {
    const first = unused.values().next().value!
    unused.delete(first)
    const points = [...entries[first].points]
    if (points.length < 2) continue
    while (distance(points[0], points[points.length - 1]) > 0.001) {
      const end = points[points.length - 1]
      let match = -1, reverse = false
      for (const i of unused) {
        const candidate = entries[i].points
        if (distance(end, candidate[0]) <= 0.001) { match = i; break }
        if (distance(end, candidate[candidate.length - 1]) <= 0.001) { match = i; reverse = true; break }
      }
      if (match < 0) throw new Error('A manufacturing path is open. Close its endpoints within 0.001 mm, or choose only closed outlines.')
      unused.delete(match)
      const next = reverse ? [...entries[match].points].reverse() : entries[match].points
      points.push(...next.slice(1))
    }
    const ring = cleanRing(points)
    validateRing(ring)
    rings.push(ring)
  }
  return rings
}
