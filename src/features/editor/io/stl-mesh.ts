import { ShapeUtils, Vector2 } from 'three'
import type { Point } from '../cad/cad-types'
import { signedArea, type StlRegion } from './stl-polygons'

export type StlVertex = { x: number; y: number; z: number }
export type StlTriangle = [number, number, number]
export type StlMesh = { vertices: StlVertex[]; triangles: StlTriangle[] }

export function createStlMeshBuilder() {
  const mesh: StlMesh = { vertices: [], triangles: [] }
  const indexes = new Map<string, number>()
  const vertex = (point: Point, z: number) => {
    const key = `${point.x.toFixed(4)},${point.y.toFixed(4)},${z.toFixed(4)}`
    const found = indexes.get(key)
    if (found !== undefined) return found
    const index = mesh.vertices.length
    mesh.vertices.push({ x: point.x, y: point.y, z })
    indexes.set(key, index)
    return index
  }
  function caps(regions: StlRegion[], z: number, upward: boolean) {
    for (const { outer, holes } of regions) {
      const contour = outer.map((point) => new Vector2(point.x, point.y))
      const cutouts = holes.map((ring) => ring.map((point) => new Vector2(point.x, point.y)))
      const points = [outer, ...holes].flat()
      const sorted = [...points].sort((a, b) => a.x - b.x)
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
          mesh.triangles.push(ordered.map((point) => vertex(point, z)) as StlTriangle)
        } else {
          // Earcut can bridge aligned holes with a long edge that skips other
          // contour vertices. Split those T-junctions so caps and walls share
          // identical edges, rather than emitting a merely visual closed mesh.
          const center = vertex({ x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }, z)
          boundary.forEach((point, index) => mesh.triangles.push([center, vertex(point, z), vertex(boundary[(index + 1) % boundary.length], z)]))
        }
      }
    }
  }
  function walls(rings: Point[][], bottom: number, top: number) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]
        const a0 = vertex(a, bottom), b0 = vertex(b, bottom), a1 = vertex(a, top), b1 = vertex(b, top)
        mesh.triangles.push([a0, b0, b1], [a0, b1, a1])
      }
    }
  }
  return { mesh, caps, walls }
}

export function validateStlMesh(mesh: StlMesh) {
  if (!mesh.triangles.length) throw new Error('No printable faces were generated.')
  if (mesh.triangles.length > 250_000) throw new Error('STL export exceeds 250,000 triangles. Export fewer outlines or holes at once.')
  const edges = new Map<string, { count: number; direction: number }>()
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
    volumeMm3 += (a.x * (b.y * c.z - b.z * c.y) + a.y * (b.z * c.x - b.x * c.z) + a.z * (b.x * c.y - b.y * c.x)) / 6
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
  if (!(volumeMm3 > 1e-6)) throw new Error('The STL has no positive printable volume.')
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
