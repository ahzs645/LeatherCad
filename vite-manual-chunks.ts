/**
 * Which vendor chunk a module belongs in.
 *
 * Split out of `vite.config.ts` so it can be tested, because the rule that
 * matters here is invisible in the built output until the app fails to start:
 * a chunk boundary drawn through a cycle produces a bundle that throws
 * `Cannot access '…' before initialization` on load, and nothing in the build
 * warns about it.
 *
 * The specific trap is substring matching on paths. `three-mesh-bvh` sits at
 * `node_modules/three-mesh-bvh/`, so a test for `node_modules/three` matched
 * it, filed it under three's core chunk, and — because it imports
 * `three/examples/jsm/utils/BufferGeometryUtils` — made the core chunk depend
 * on the examples chunk that already depended on core. Every package path here
 * therefore ends in a slash.
 */

export function manualChunks(id: string): string | undefined {
  if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
    return 'react-vendor'
  }
  if (id.includes('node_modules/three/examples/jsm/loaders/')) {
    return 'three-loaders-vendor'
  }
  if (id.includes('node_modules/three/examples/jsm/controls/')) {
    return 'three-controls-vendor'
  }
  if (id.includes('node_modules/three/examples/jsm/')) {
    return 'three-examples-vendor'
  }
  if (id.includes('node_modules/three/')) {
    return 'three-core-vendor'
  }
  if (id.includes('node_modules/pdfjs-dist/')) {
    return 'pdf-vendor'
  }
  if (id.includes('node_modules/opentype.js/')) {
    return 'opentype-vendor'
  }
  if (id.includes('node_modules/clipper-lib/')) {
    return 'clipper-vendor'
  }
  return undefined
}
