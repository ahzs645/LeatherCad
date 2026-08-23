import { describe, expect, it } from 'vitest'
import { manualChunks } from './vite-manual-chunks'

const pnpm = (specifier: string) =>
  `/repo/node_modules/.pnpm/${specifier.split('/')[0]}@1.0.0/node_modules/${specifier}`

describe('manualChunks', () => {
  it('splits three into core, examples, loaders, and controls', () => {
    expect(manualChunks(pnpm('three/build/three.module.js'))).toBe('three-core-vendor')
    expect(manualChunks(pnpm('three/examples/jsm/environments/RoomEnvironment.js'))).toBe('three-examples-vendor')
    expect(manualChunks(pnpm('three/examples/jsm/loaders/GLTFLoader.js'))).toBe('three-loaders-vendor')
    expect(manualChunks(pnpm('three/examples/jsm/controls/OrbitControls.js'))).toBe('three-controls-vendor')
  })

  it('keeps packages that merely start with a vendor name out of that vendor chunk', () => {
    // three-mesh-bvh imports three/examples/jsm/utils/BufferGeometryUtils. Filed
    // under three's core chunk it made core depend on examples, which already
    // depended on core — a cycle across chunk boundaries, which builds without
    // complaint and then throws `Cannot access 'Ot' before initialization`
    // before the app renders a single element.
    expect(manualChunks(pnpm('three-mesh-bvh/src/core/MeshBVH.js'))).toBeUndefined()
    expect(manualChunks(pnpm('three-stdlib/misc/Timer.js'))).toBeUndefined()
    expect(manualChunks(pnpm('react-router/dist/index.js'))).toBeUndefined()
  })

  it('gives the heavy leaf dependencies their own chunks', () => {
    expect(manualChunks(pnpm('react/jsx-runtime.js'))).toBe('react-vendor')
    expect(manualChunks(pnpm('react-dom/client.js'))).toBe('react-vendor')
    expect(manualChunks(pnpm('pdfjs-dist/build/pdf.mjs'))).toBe('pdf-vendor')
    expect(manualChunks(pnpm('opentype.js/dist/opentype.mjs'))).toBe('opentype-vendor')
    expect(manualChunks(pnpm('clipper-lib/clipper.js'))).toBe('clipper-vendor')
  })

  it('leaves application code alone', () => {
    expect(manualChunks('/repo/src/features/editor/EditorApp.tsx')).toBeUndefined()
    expect(manualChunks('/repo/../atelier/packages/render/src/index.ts')).toBeUndefined()
  })
})
