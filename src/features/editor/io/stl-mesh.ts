import { ShapeUtils, Vector2 } from 'three'
import type { Point } from '../cad/cad-types'
import { signedArea, type StlRegion } from './stl-polygons'

export type StlVertex = { x: number; y: number; z: number }
export type StlTriangle = [number, number, number]
export type StlMesh = { vertices: StlVertex[]; triangles: StlTriangle[] }

export function createStlMeshBuilder(extraPoints: Point[] = []) {
  const mesh: StlMesh = { vertices: [], triangles: [] }
  const indexes = new Map<string, number>()
  const addTriangles = (...triangles: StlTriangle[]) => {
    if (mesh.triangles.length + triangles.length > 250_000) throw new Error('STL export exceeds 250,000 triangles. Export fewer outlines or holes at once.')
    mesh.triangles.push(...triangles)
  }
  const vertex = (point: Point, z: number) => {
    const key = `${point.x.toFixed(4)},${point.y.toFixed(4)},${z.toFixed(4)}`
    const found = indexes.get(key)
    if (found !== undefined) return found
    const index = mesh.vertices.length
    mesh.vertices.push({ x: point.x, y: point.y, z })
    indexes.set(key, index)
    return index
  }
  function surface(regions: StlRegion[], elevation: (point: Point) => number, upward: boolean) {
    for (const { outer, holes } of regions) {
      const contour = outer.map((point) => new Vector2(point.x, point.y))
      const cutouts = holes.map((ring) => ring.map((point) => new Vector2(point.x, point.y)))
      const points = [outer, ...holes].flat()
      const unique = new Map([...points, ...extraPoints].map((point) => [`${point.x.toFixed(4)},${point.y.toFixed(4)}`, point]))
      const sorted = [...unique.values()].sort((a, b) => a.x - b.x)
      const edgePoints = (a: Point, b: Point) => {
        const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy
        const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x)
        let low = 0, high = sorted.length
        while (low < high) {
          const middle = (low + high) >>> 1
          if (sorted[middle].x < minX - 1e-8) low = middle + 1
          else high = middle
        }
        const matches: Array<{ point: Point; t: number }> = []
        for (let index = low; index < sorted.length && sorted[index].x <= maxX + 1e-8; index++) {
          const point = sorted[index]
          if (point.y < Math.min(a.y, b.y) - 1e-8 || point.y > Math.max(a.y, b.y) + 1e-8) continue
          const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared
          if (t > 1e-8 && t < 1 - 1e-8 && Math.abs(dx * (point.y - a.y) - dy * (point.x - a.x)) < 1e-8) {
            matches.push({ point, t })
          }
        }
        return matches.sort((left, right) => left.t - right.t).map(({ point }) => point)
      }
      for (const face of ShapeUtils.triangulateShape(contour, cutouts)) {
        const a = points[face[0]], b = points[face[1]], c = points[face[2]]
        if (Math.abs(signedArea([a, b, c])) < 1e-10) continue
        const forward = (signedArea([a, b, c]) > 0) === upward
        const ordered = forward ? [a, b, c] : [a, c, b]
        const boundary = ordered.flatMap((point, index) => [point, ...edgePoints(point, ordered[(index + 1) % 3])])
        if (boundary.length === 3) {
          addTriangles(ordered.map((point) => vertex(point, elevation(point))) as StlTriangle)
        } else {
          // Earcut can bridge aligned holes with a long edge that skips other
          // contour vertices. Split those T-junctions so caps and walls share
          // identical edges, rather than emitting a merely visual closed mesh.
          const center = vertex({ x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }, (elevation(a) + elevation(b) + elevation(c)) / 3)
          const zAt = (point: Point) => {
            // A subdivided cap edge lies on one original triangle edge.
            for (let edge = 0; edge < 3; edge++) {
              const p = ordered[edge], q = ordered[(edge + 1) % 3]
              const dx = q.x - p.x, dy = q.y - p.y
              const t = ((point.x - p.x) * dx + (point.y - p.y) * dy) / (dx * dx + dy * dy)
              if (t >= -1e-8 && t <= 1 + 1e-8 && Math.abs(dx * (point.y - p.y) - dy * (point.x - p.x)) < 1e-8) return elevation(p) + t * (elevation(q) - elevation(p))
            }
            return elevation(point)
          }
          boundary.forEach((point, index) => addTriangles([center, vertex(point, zAt(point)), vertex(boundary[(index + 1) % boundary.length], zAt(boundary[(index + 1) % boundary.length]))]))
        }
      }
    }
  }
  const caps = (regions: StlRegion[], z: number, upward: boolean) => surface(regions, () => z, upward)
  function walls(rings: Point[][], bottom: number, top: number) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]
        const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy
        const middle = extraPoints.map((point) => ({ point, t: ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared }))
          .filter(({ point, t }) => t > 1e-8 && t < 1 - 1e-8 && Math.abs(dx * (point.y - a.y) - dy * (point.x - a.x)) < 1e-8)
          .sort((left, right) => left.t - right.t)
        const split = [a, ...new Map(middle.map(({ point }) => [`${point.x.toFixed(4)},${point.y.toFixed(4)}`, point])).values(), b]
        for (let part = 0; part < split.length - 1; part++) {
          const a0 = vertex(split[part], bottom), b0 = vertex(split[part + 1], bottom), a1 = vertex(split[part], top), b1 = vertex(split[part + 1], top)
          addTriangles([a0, b0, b1], [a0, b1, a1])
        }
      }
    }
  }
  return { mesh, caps, walls, surface }
}

export function validateStlMesh(mesh: StlMesh) {
  if (!mesh.triangles.length) throw new Error('No printable faces were generated.')
  if (mesh.triangles.length > 250_000) throw new Error('STL export exceeds 250,000 triangles. Export fewer outlines or holes at once.')
  const edges = new Map<string, { count: number; direction: number }>()
  const parent = mesh.vertices.map((_, i) => i)
  const root = (index: number): number => {
    while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index] }
    return index
  }
  const triangleVolumes: Array<{ vertex: number; volume: number }> = []
  const links = new Map<number, Map<number, Set<number>>>()
  let volumeMm3 = 0
  for (const [ia, ib, ic] of mesh.triangles) {
    const a = mesh.vertices[ia], b = mesh.vertices[ib], c = mesh.vertices[ic]
    if ([a, b, c].some((point) => !point || ![point.x, point.y, point.z].every(Number.isFinite))) {
      throw new Error('The STL contains a non-finite coordinate.')
    }
    const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y)
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)
    const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    if (Math.hypot(nx, ny, nz) < 1e-10) throw new Error('The STL contains a zero-area triangle.')
    const volume = (a.x * (b.y * c.z - b.z * c.y) + a.y * (b.z * c.x - b.x * c.z) + a.z * (b.x * c.y - b.y * c.x)) / 6
    volumeMm3 += volume
    parent[root(ib)] = root(ia); parent[root(ic)] = root(ia)
    triangleVolumes.push({ vertex: ia, volume })
    for (const [at, left, right] of [[ia, ib, ic], [ib, ic, ia], [ic, ia, ib]]) {
      const graph = links.get(at) ?? new Map<number, Set<number>>()
      const a = graph.get(left) ?? new Set<number>(), b = graph.get(right) ?? new Set<number>()
      a.add(right); b.add(left); graph.set(left, a); graph.set(right, b); links.set(at, graph)
    }
    for (const [from, to] of [[ia, ib], [ib, ic], [ic, ia]]) {
      const key = `${Math.min(from, to)}:${Math.max(from, to)}`
      const edge = edges.get(key) ?? { count: 0, direction: 0 }
      edge.count++
      edge.direction += from < to ? 1 : -1
      edges.set(key, edge)
    }
  }
  if ([...edges.values()].some((edge) => edge.count !== 2 || edge.direction !== 0)) {
    throw new Error('The mesh is not watertight. Separate touching outlines or repair small/overlapping features.')
  }
  for (const graph of links.values()) {
    if ([...graph.values()].some((neighbors) => neighbors.size !== 2)) throw new Error('The mesh has a non-manifold vertex. Separate touching regions before exporting.')
    const visited = new Set<number>(), pending = [graph.keys().next().value!]
    while (pending.length) { const at = pending.pop()!; if (visited.has(at)) continue; visited.add(at); pending.push(...graph.get(at)!) }
    if (visited.size !== graph.size) throw new Error('The mesh has regions touching at a single vertex. Separate them before exporting.')
  }
  if (!(volumeMm3 > 1e-6)) throw new Error('The STL has no positive printable volume.')
  const componentVolumes = new Map<number, number>()
  for (const triangle of triangleVolumes) { const id = root(triangle.vertex); componentVolumes.set(id, (componentVolumes.get(id) ?? 0) + triangle.volume) }
  if ([...componentVolumes.values()].some((volume) => volume <= 1e-6)) throw new Error('An STL component is reversed or has no positive volume. Repair its orientation before exporting.')
  return { watertight: true as const, volumeMm3 }
}

export function serializeAsciiStl(mesh: StlMesh, name = 'LeatherCad_mm') {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'LeatherCad_mm'
  const number = (value: number) => String(Number(value.toFixed(7)))
  const rows = [`solid ${safeName}`]
  for (const [ia, ib, ic] of mesh.triangles) {
    const a = mesh.vertices[ia], b = mesh.vertices[ib], c = mesh.vertices[ic]
    const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y)
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)
    const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    const length = Math.hypot(nx, ny, nz)
    rows.push(`  facet normal ${number(nx / length)} ${number(ny / length)} ${number(nz / length)}`, '    outer loop')
    for (const point of [a, b, c]) rows.push(`      vertex ${number(point.x)} ${number(point.y)} ${number(point.z)}`)
    rows.push('    endloop', '  endfacet')
  }
  rows.push(`endsolid ${safeName}`)
  return rows.join('\n') + '\n'
}
