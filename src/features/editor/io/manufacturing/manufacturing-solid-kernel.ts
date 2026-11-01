import type { Manifold, ManifoldToplevel } from 'manifold-3d'
import wasmUrl from 'manifold-3d/manifold.wasm?url'
import type { StlMesh } from '../stl-mesh'

let pending: Promise<ManifoldToplevel> | undefined
export function loadManufacturingSolidKernel(): Promise<ManifoldToplevel> {
  pending ??= import('manifold-3d').then(async ({ default: factory }) => {
    // Node's package loader finds its adjacent WASM. Browser workers use Vite's
    // emitted asset URL, including the deployment base path.
    const inNode = typeof process !== 'undefined' && !!process.versions?.node
    const kernel = await factory(inNode ? undefined : { locateFile: () => wasmUrl })
    kernel.setup()
    return kernel
  }).catch(() => { pending = undefined; throw new Error('The solid finishing engine could not load. Save the drawing and reload to try again.') })
  return pending
}

export function createManufacturingSolidSession(kernel: ManifoldToplevel, origin: { x: number; y: number }, toleranceMm: number) {
  const allocated = new Map<Manifold, number>()
  let retainedTriangles = 0
  const track = (solid: Manifold): Manifold => {
    if (allocated.has(solid)) return solid
    allocated.set(solid, 0)
    const status = solid.status()
    if (status !== 'NoError') throw new Error(`The solid finishing operation could not produce a valid closed solid (${status}). Reduce edge size or separate touching features.`)
    const triangles = solid.numTri()
    allocated.set(solid, triangles); retainedTriangles += triangles
    if (triangles > 250_000 || retainedTriangles > 500_000) throw new Error('Combined finishing exceeds its mesh budget. Export fewer regions or holes, or increase tolerance.')
    return solid
  }
  const fromMesh = (mesh: StlMesh): Manifold => {
    const vertices = mesh.vertices.flatMap(p => [p.x - origin.x, p.y - origin.y, p.z])
    // Two float conversions must fit within the numerical portion of the error budget.
    const extent = vertices.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0)
    if (extent * 2 ** -23 > toleranceMm / 8) throw new Error('This model is too large for combined finishing at the chosen tolerance. Increase tolerance or export a smaller selection.')
    const data = new kernel.Mesh({ numProp: 3, vertProperties: Float32Array.from(vertices), triVerts: Uint32Array.from(mesh.triangles.flat()), tolerance: Math.min(toleranceMm / 100, 0.00001) })
    let solid: Manifold
    try { solid = new kernel.Manifold(data) } catch { throw new Error('The solid finishing engine could not construct a closed body. Reduce edge size or separate touching features.') }
    return track(solid)
  }
  const toMesh = (solid: Manifold): StlMesh => {
    const data = solid.getMesh(), parents = Array.from({ length: data.numVert }, (_, i) => i)
    const root = (index: number): number => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index] } return index }
    for (let i = 0; i < data.mergeFromVert.length; i++) parents[root(data.mergeFromVert[i])] = root(data.mergeToVert[i])
    const vertices: StlMesh['vertices'] = [], remap = new Map<number, number>()
    const indexFor = (index: number) => {
      const merged = root(index), found = remap.get(merged)
      if (found !== undefined) return found
      const next = vertices.length
      vertices.push({ x: data.vertProperties[merged * data.numProp] + origin.x, y: data.vertProperties[merged * data.numProp + 1] + origin.y, z: data.vertProperties[merged * data.numProp + 2] })
      remap.set(merged, next); return next
    }
    const triangles: StlMesh['triangles'] = []
    for (let i = 0; i < data.triVerts.length; i += 3) triangles.push([indexFor(data.triVerts[i]), indexFor(data.triVerts[i + 1]), indexFor(data.triVerts[i + 2])])
    return { vertices, triangles }
  }
  const release = (solid: Manifold) => { const count = allocated.get(solid); if (count !== undefined) { retainedTriangles -= count; allocated.delete(solid); solid.delete() } }
  const replace = (previous: Manifold, next: Manifold) => { const result = track(next); if (previous !== result) release(previous); return result }
  return { kernel, track, fromMesh, toMesh, release, replace, dispose: () => { for (const solid of [...allocated.keys()]) release(solid) } }
}
