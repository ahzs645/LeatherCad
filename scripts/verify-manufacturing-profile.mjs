#!/usr/bin/env node
// Reproduce the synthetic numerical review without a browser, fonts or a dist build.
// Run: node scripts/verify-manufacturing-profile.mjs --out docs/verification/manufacturing-profile-2026-11-01.json
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
assert(args.length === 0 || args.length === 2 && args[0] === '--out', 'Usage: node scripts/verify-manufacturing-profile.mjs [--out relative-report.json]')
const measuredPaths = [
  'scripts/verify-manufacturing-profile.mjs',
  'src/features/editor/io/io-stl.ts',
  'src/features/editor/io/stl-mesh.ts',
  'src/features/editor/io/stl-polygons.ts',
  ...['curves', 'finishing', 'level-mesh', 'outlines', 'regions', 'settings', 'solid-finishing', 'solid-kernel', 'surface-refinement']
    .map(name => `src/features/editor/io/manufacturing/manufacturing-${name}.ts`),
]
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const sourceDigests = async () => Object.fromEntries(await Promise.all(measuredPaths.map(async name => [name, sha256(await readFile(path.join(repoRoot, name)))])))
const beforeDigests = await sourceDigests()

function rectangle(x, y, width, height) {
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]
}

// Independent analytic point/segment distances. No production distance helper is used.
function boundaryDistance(x, y, rings) {
  let nearest = Infinity
  for (const ring of rings) for (let index = 0; index < ring.length; index++) {
    const a = ring[index], b = ring[(index + 1) % ring.length]
    const dx = b.x - a.x, dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)))
    nearest = Math.min(nearest, Math.hypot(x - a.x - t * dx, y - a.y - t * dy))
  }
  return nearest
}

function profileProbes() {
  const probes = []
  for (const d of [0, 0.005, 0.025, 0.05, 0.125, 0.25, 0.375, 0.475, 0.495]) {
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      probes.push([2 + 5 * t, 5 - d], [2 + 5 * t, 15 + d], [2 - d, 5 + 10 * t], [7 + d, 5 + 10 * t], [20, d], [d, 10])
    }
  }
  for (const d of [0.025, 0.125, 0.25, 0.375, 0.49]) {
    for (const angle of [0, Math.PI / 8, Math.PI / 4, 3 * Math.PI / 8, Math.PI / 2]) {
      probes.push([7 + d * Math.cos(angle), 5 - d * Math.sin(angle)], [2 - d * Math.cos(angle), 15 + d * Math.sin(angle)])
    }
    probes.push([d, d], [40 - d, d])
  }
  assert.equal(probes.length, 438)
  return probes
}

// Project the real triangles into XY and interpolate their highest surface.
function surfaceHeight(mesh, x, y) {
  let top = -Infinity
  for (const triangle of mesh.triangles) {
    const [a, b, c] = triangle.map(index => mesh.vertices[index])
    const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
    if (Math.abs(denominator) < 1e-12) continue
    const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator
    const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator, w = 1 - u - v
    if (Math.min(u, v, w) >= -1e-9) top = Math.max(top, u * a.z + v * b.z + w * c.z)
  }
  return top
}

function signedTriangleVolume(a, b, c) {
  return (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
}

// Standalone ASCII reader and topology/volume check. It does not call the app's
// mesh validator or trust its watertight/volume fields.
function inspectAsciiStl(content) {
  const rows = [...content.matchAll(/\bvertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)].map(match => match.slice(1).map(Number))
  assert(rows.length > 0 && rows.length % 3 === 0, 'Invalid ASCII vertex count')
  const vertices = [], indexes = new Map(), parents = [], edges = new Map(), volumes = []
  const indexFor = point => {
    assert(point.every(Number.isFinite), 'Nonfinite exported vertex')
    const key = point.join(',')
    if (!indexes.has(key)) { indexes.set(key, vertices.length); parents.push(vertices.length); vertices.push(point) }
    return indexes.get(key)
  }
  const root = index => {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index] }
    return index
  }
  let degenerateTriangles = 0
  for (let offset = 0; offset < rows.length; offset += 3) {
    const [a, b, c] = rows.slice(offset, offset + 3), ids = [a, b, c].map(indexFor)
    parents[root(ids[1])] = root(ids[0]); parents[root(ids[2])] = root(ids[0])
    const cross = [
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ]
    if (Math.hypot(...cross) < 1e-10) degenerateTriangles++
    const volume = signedTriangleVolume(a, b, c)
    volumes.push({ vertex: ids[0], volume })
    for (let edge = 0; edge < 3; edge++) {
      const from = ids[edge], to = ids[(edge + 1) % 3], key = `${Math.min(from, to)}:${Math.max(from, to)}`
      const value = edges.get(key) ?? { count: 0, direction: 0 }
      value.count++; value.direction += from < to ? 1 : -1; edges.set(key, value)
    }
  }
  const componentVolumes = new Map()
  for (const { vertex, volume } of volumes) {
    const id = root(vertex)
    componentVolumes.set(id, (componentVolumes.get(id) ?? 0) + volume)
  }
  const openOrMisorientedEdges = [...edges.values()].filter(value => value.count !== 2 || value.direction !== 0).length
  const positiveComponentVolumes = [...componentVolumes.values()].every(volume => volume > 1e-6)
  assert.equal(openOrMisorientedEdges, 0, 'Export contains open or inconsistently directed edges')
  assert.equal(degenerateTriangles, 0, 'Export contains degenerate faces')
  assert(positiveComponentVolumes, 'Export contains a reversed or zero-volume component')
  return { triangleCount: rows.length / 3, vertexCount: vertices.length, openOrMisorientedEdges, degenerateTriangles,
    componentCount: componentVolumes.size, componentVolumesMm3: [...componentVolumes.values()], positiveComponentVolumes,
    signedVolumeMm3: volumes.reduce((sum, item) => sum + item.volume, 0),
    dimensionsMm: [0, 1, 2].map(axis => Math.max(...vertices.map(point => point[axis])) - Math.min(...vertices.map(point => point[axis]))),
    asciiSha256: sha256(content) }
}

const server = await createServer({
  configFile: false, root: repoRoot, appType: 'custom',
  cacheDir: path.join(repoRoot, 'node_modules/.cache/manufacturing-profile'),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false },
})
try {
  const { buildFinishedPrism } = await server.ssrLoadModule('/src/features/editor/io/manufacturing/manufacturing-finishing.ts')
  const { clipRings, orientNestedRings } = await server.ssrLoadModule('/src/features/editor/io/stl-polygons.ts')
  const { serializeAsciiStl } = await server.ssrLoadModule('/src/features/editor/io/stl-mesh.ts')
  const { buildStlExportAsync } = await server.ssrLoadModule('/src/features/editor/io/io-stl.ts')
  const sourceRings = [rectangle(0, 0, 40, 20), rectangle(2, 5, 5, 10)]
  const rings = clipRings(orientNestedRings(sourceRings)), probes = profileProbes()
  const uniqueProbeCount = new Set(probes.map(point => point.map(value => value.toFixed(9)).join(','))).size
  const radius = 0.5, requestedToleranceMm = 0.01, profiles = []
  for (const finish of ['chamfer', 'fillet']) {
    const before = JSON.stringify(rings)
    const mesh = buildFinishedPrism(rings, radius, radius, finish, 6, requestedToleranceMm, { top: true, bottom: false })
    let worst = { normalErrorMm: 0 }, coveredProbeCount = 0
    for (const [x, y] of probes) {
      const actualZ = surfaceHeight(mesh, x, y)
      assert(Number.isFinite(actualZ), `Missing ${finish} surface at ${x},${y}`)
      coveredProbeCount++
      const d = Math.min(radius, boundaryDistance(x, y, sourceRings))
      const expectedZ = finish === 'chamfer' ? d : Math.sqrt(radius * radius - (radius - d) ** 2)
      const normalErrorMm = finish === 'chamfer' ? Math.abs(actualZ - expectedZ) / Math.SQRT2 : Math.abs(Math.hypot(radius - d, actualZ) - radius)
      if (normalErrorMm > worst.normalErrorMm) worst = { x, y, distanceToBoundaryMm: d, actualZMm: actualZ, expectedZMm: expectedZ, normalErrorMm, verticalErrorMm: Math.abs(actualZ - expectedZ) }
    }
    assert(worst.normalErrorMm <= requestedToleranceMm, `${finish} exceeds requested profile tolerance`)
    const inputUnchanged = JSON.stringify(rings) === before
    assert(inputUnchanged, 'Profile generation mutated its input')
    // This one-sided prism is an internal cutter fixture, not the final export.
    // Check its profile/volume directly; inspect the actual exported solids below.
    const meshSignedVolumeMm3 = mesh.triangles.reduce((sum, triangle) => {
      const [a, b, c] = triangle.map(index => { const p = mesh.vertices[index]; return [p.x, p.y, p.z] })
      return sum + signedTriangleVolume(a, b, c)
    }, 0)
    const analyticVolume = finish === 'chamfer' ? {
      // Integrate offset material area 750 - 150*t + (4-pi)*t^2 over t=0..r.
      expectedMm3: 750 * radius - 150 * radius ** 2 / 2 + (4 - Math.PI) * radius ** 3 / 3,
      acceptanceDifferenceMm3: 0.25,
    } : undefined
    if (analyticVolume) {
      analyticVolume.absoluteDifferenceMm3 = Math.abs(meshSignedVolumeMm3 - analyticVolume.expectedMm3)
      assert(analyticVolume.absoluteDifferenceMm3 < analyticVolume.acceptanceDifferenceMm3, 'Chamfer volume differs from analytic offset integral')
    }
    profiles.push({ finish, requestedToleranceMm, probeCount: probes.length, uniqueProbeCount, coveredProbeCount,
      missingProbeCount: probes.length - coveredProbeCount, maxSampledNormalErrorMm: worst.normalErrorMm, worstProbe: worst,
      inputUnchanged, meshTriangleCount: mesh.triangles.length, meshSignedVolumeMm3, ...(analyticVolume ? { analyticVolume } : {}) })
  }

  const lines = (x, y, width, height, prefix) => {
    const points = rectangle(x, y, width, height)
    return points.map((start, index) => ({ id: `${prefix}${index}`, type: 'line', layerId: 'main', lineTypeId: 'cut', start, end: points[(index + 1) % points.length] }))
  }
  const drawing = {
    version: 1, units: 'mm', documentName: 'Synthetic stepped cutout acceptance',
    layers: [{ id: 'main', name: 'Main', visible: true, locked: false }], activeLayerId: 'main',
    lineTypes: [{ id: 'cut', name: 'Cut', role: 'cut', visible: true, style: 'solid', color: '#000000' }], activeLineTypeId: 'cut',
    objects: [...lines(0, 0, 30, 20, 'a'), ...lines(10, 0, 30, 20, 'b'), ...lines(2, 5, 5, 10, 'hole')], foldLines: [],
  }
  const baseOptions = { stitchHoles: 'none', edgeSizeMm: 0.5, toleranceMm: 0.02, regions: [
    { id: 'left', at: { x: 1, y: 1 }, heightMm: 2, through: false },
    { id: 'mid', at: { x: 15, y: 5 }, heightMm: 4, through: false },
    { id: 'right', at: { x: 35, y: 5 }, heightMm: 6, through: false },
  ] }
  const steppedCutout = []
  for (const edgeFinish of ['none', 'chamfer', 'fillet']) {
    const options = { ...baseOptions, edgeFinish }, input = JSON.stringify({ drawing, options })
    const result = await buildStlExportAsync(drawing, options)
    const exported = inspectAsciiStl(serializeAsciiStl(result.mesh, `synthetic_stepped_cutout_${edgeFinish}`))
    const inputUnchanged = JSON.stringify({ drawing, options }) === input
    assert(inputUnchanged, 'Asynchronous solid finishing mutated the drawing/options')
    assert.equal(exported.triangleCount, result.triangleCount)
    assert.equal(exported.componentCount, 1)
    assert(exported.dimensionsMm.every((value, axis) => Math.abs(value - [40, 20, 6][axis]) < 1e-5), 'Wrong stepped model dimensions')
    assert(Math.abs(exported.signedVolumeMm3 - result.volumeMm3) < 1e-5, 'ASCII volume differs from generated mesh volume')
    if (edgeFinish === 'none') assert(Math.abs(exported.signedVolumeMm3 - 3100) < 1e-5, 'Unexpected unmodified analytic stock volume')
    steppedCutout.push({ edgeFinish, requestedExportToleranceMm: baseOptions.toleranceMm,
      internalCutterToleranceMm: edgeFinish === 'none' ? null : baseOptions.toleranceMm / 2,
      edgeSizeMm: baseOptions.edgeSizeMm, inputUnchanged, generatedVolumeMm3: result.volumeMm3, warnings: result.warnings, exported })
  }
  assert.deepEqual(await sourceDigests(), beforeDigests, 'Measured source changed during verification; rerun on a stable checkout')
  const report = {
    status: 'passed', recordedAtUtc: new Date().toISOString(),
    reproduce: 'node scripts/verify-manufacturing-profile.mjs --out docs/verification/manufacturing-profile-2026-11-01.json',
    runtime: { node: process.version, platform: process.platform, architecture: process.arch, manifold: JSON.parse(await readFile(path.join(repoRoot, 'node_modules/manifold-3d/package.json'), 'utf8')).version },
    execution: 'Node/Vite SSR with actual Manifold WASM for combined solids; no dist build, browser or font fixture',
    measuredModulesSha256: beforeDigests,
    scope: { profile: 'One top-finished 40x20mm prism, 5x10mm cutout at (2,5), height/radius .5mm, fillet divisions6',
      probeSampling: '438 evaluations including repeated locations; distinct count separately reported. Barycentric triangle heights compared with independent analytic line/circle normal distances.',
      normalError: 'Chamfer |z-d|/sqrt(2); fillet |hypot(radius-d,z)-radius|. Vertical error is reported separately and is not the fillet normal-distance acceptance gate.',
      steppedCutout: 'Union of 30x20 rectangles at (0,0) and (10,0), nested 5x10 cutout at (2,5), left/middle/right heights2/4/6mm',
      independentAsciiChecks: 'Standalone reader checks paired/oppositely directed edges, degenerate faces, connected components, signed component volumes and extents; no production mesh-validator call.',
      limitations: 'Finite synthetic numerical acceptance, not a proof over all models or a general self-intersection validator. Browser WASM loading, slicer behavior and physical printer fit are separate gates.' },
    profiles, steppedCutout,
  }
  const content = `${JSON.stringify(report, null, 2)}\n`
  if (args.length) {
    const destination = path.resolve(repoRoot, args[1])
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, content)
  }
  process.stdout.write(content)
} finally {
  await server.close()
}
