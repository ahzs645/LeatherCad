import type { Point } from '../../cad/cad-types'
import type { StlMesh, StlTriangle, StlVertex } from '../stl-mesh'

/** Refines a height-field surface while preserving its boundary polyline.
 * Internal edge splits propagate to both incident triangles, so no T-junctions
 * are introduced where a ramp meets another ramp or its planar cap. */
export function refineManufacturingSurface(mesh: StlMesh, elevation: (p: Point) => number, errorAt: (p: StlVertex) => number, toleranceMm: number): StlMesh {
  const vertices = mesh.vertices.map(p => ({ ...p }))
  let triangles = mesh.triangles.map(t => [...t] as StlTriangle)
  const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`
  const initialEdges = new Map<string, number>()
  for (const tri of triangles) for (let i = 0; i < 3; i++) { const key = edgeKey(tri[i], tri[(i + 1) % 3]); initialEdges.set(key, (initialEdges.get(key) ?? 0) + 1) }
  const boundary = new Set([...initialEdges].filter(([, count]) => count === 1).map(([key]) => key))
  const boundaryVertices = new Set([...boundary].flatMap(key => key.split(':').map(Number)))
  vertices.forEach((p, i) => { if (!boundaryVertices.has(i)) p.z = elevation(p) })
  const sample = (ids: number[]): StlVertex => {
    const p = ids.reduce((sum, id) => ({ x: sum.x + vertices[id].x, y: sum.y + vertices[id].y, z: sum.z + vertices[id].z }), { x: 0, y: 0, z: 0 })
    return { x: p.x / ids.length, y: p.y / ids.length, z: p.z / ids.length }
  }
  let boundaryError = 0
  for (const edge of boundary) {
    const ids = edge.split(':').map(Number)
    const [a, b] = ids.map(id => vertices[id])
    for (const t of [0, 0.125, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 0.875, 1]) boundaryError = Math.max(boundaryError, errorAt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }))
  }
  if (boundaryError > toleranceMm / 2) throw new Error('A finished boundary could not meet the selected tolerance. Reduce edge size or simplify the outline.')
  const targetError = Math.max(toleranceMm / 4, boundaryError + toleranceMm / 8)
  for (let iteration = 0; iteration < 22; iteration++) {
    const marked = new Map<string, [number, number]>(), centers = new Set<number>()
    for (let i = 0; i < triangles.length; i++) {
      const tri = triangles[i]
      for (let edge = 0; edge < 3; edge++) {
        const a = tri[edge], b = tri[(edge + 1) % 3], key = edgeKey(a, b)
        if (!boundary.has(key) && errorAt(sample([a, b])) > targetError) {
          marked.set(key, [a, b])
        }
      }
      if (errorAt(sample(tri)) > targetError) {
        const candidates = tri.map((a, edge) => [a, tri[(edge + 1) % 3]] as [number, number]).filter(([a, b]) => !boundary.has(edgeKey(a, b)))
        candidates.sort(([a, b], [c, d]) => Math.hypot(vertices[c].x - vertices[d].x, vertices[c].y - vertices[d].y) - Math.hypot(vertices[a].x - vertices[b].x, vertices[a].y - vertices[b].y))
        if (candidates[0]) marked.set(edgeKey(...candidates[0]), candidates[0]); else centers.add(i)
      }
    }
    if (!marked.size && !centers.size) return { vertices, triangles }
    const midpoints = new Map<string, number>()
    for (const [key, ids] of marked) { const p = sample(ids); midpoints.set(key, vertices.length); vertices.push({ ...p, z: elevation(p) }) }
    const next: StlTriangle[] = []
    for (let i = 0; i < triangles.length; i++) {
      const tri = triangles[i]
      const polygon: number[] = []
      for (let edge = 0; edge < 3; edge++) {
        polygon.push(tri[edge]); const midpoint = midpoints.get(edgeKey(tri[edge], tri[(edge + 1) % 3])); if (midpoint !== undefined) polygon.push(midpoint)
      }
      if (polygon.length === 3 && !centers.has(i)) next.push(tri)
      else if (polygon.length > 3) {
        const direction = (vertices[tri[1]].x - vertices[tri[0]].x) * (vertices[tri[2]].y - vertices[tri[0]].y) - (vertices[tri[1]].y - vertices[tri[0]].y) * (vertices[tri[2]].x - vertices[tri[0]].x) > 0 ? 1 : -1
        while (polygon.length > 3) {
          let clipped = false
          for (let at = 0; at < polygon.length; at++) {
            const a = polygon[(at + polygon.length - 1) % polygon.length], b = polygon[at], c = polygon[(at + 1) % polygon.length]
            const p = vertices[a], q = vertices[b], r = vertices[c], dx = r.x - p.x, dy = r.y - p.y, squared = dx * dx + dy * dy
            if (((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) * direction <= 1e-14) continue
            if (polygon.some(id => {
              if (id === a || id === b || id === c) return false
              const v = vertices[id], t = ((v.x - p.x) * dx + (v.y - p.y) * dy) / squared
              return t > 1e-10 && t < 1 - 1e-10 && Math.abs(dx * (v.y - p.y) - dy * (v.x - p.x)) < 1e-10
            })) continue
            next.push([a, b, c]); polygon.splice(at, 1); clipped = true; break
          }
          if (!clipped) throw new Error('The finished surface subdivision became degenerate. Reduce edge size or simplify the outline.')
        }
        next.push(polygon as StlTriangle)
      } else {
        const p = sample(tri), center = vertices.length
        vertices.push({ ...p, z: elevation(p) })
        for (let edge = 0; edge < polygon.length; edge++) next.push([center, polygon[edge], polygon[(edge + 1) % polygon.length]])
      }
      if (next.length > 250_000 || vertices.length > 150_000) throw new Error('Finished surface exceeds its refinement budget at this tolerance. Reduce edge size, simplify the outline, or increase tolerance.')
    }
    triangles = next
  }
  throw new Error('The finished surface could not meet the selected tolerance. Reduce edge size, simplify the outline, or increase tolerance.')
}
