import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

import { manualChunks } from './vite-manual-chunks'

// The Atelier engine is consumed as TypeScript source through `link:` symlinks
// into ../atelier, so it needs the same two accommodations Seamer Studio makes.
const ATELIER = [
  '@atelier/core',
  '@atelier/geometry',
  '@atelier/io',
  '@atelier/react',
  '@atelier/render',
  '@atelier/sim',
  '@atelier/viewport',
]

// Linked engine source is excluded from scanning below. Discovering its lazy
// browser dependencies on first use otherwise makes Vite re-optimize and reload
// an already edited document. Include the known runtime imports at startup.
const LAZY_BROWSER_DEPENDENCIES = [
  'clipper-lib', 'dexie', 'opentype.js', 'pdfjs-dist/legacy/build/pdf.mjs', 'three',
  '@atelier/geometry > delaunator',
  'three/addons/controls/OrbitControls.js',
  'three/addons/controls/TransformControls.js',
  'three/addons/environments/RoomEnvironment.js',
  'three/addons/lines/LineMaterial.js',
  'three/addons/lines/LineSegments2.js',
  'three/addons/lines/LineSegmentsGeometry.js',
  'three/addons/loaders/RGBELoader.js',
  'three/addons/postprocessing/BokehPass.js',
  'three/addons/postprocessing/EffectComposer.js',
  'three/addons/postprocessing/GTAOPass.js',
  'three/addons/postprocessing/OutputPass.js',
  'three/addons/postprocessing/Pass.js',
  'three/addons/postprocessing/RenderPass.js',
  'three/addons/postprocessing/SMAAPass.js',
  'three/examples/jsm/controls/OrbitControls.js',
  'three/examples/jsm/exporters/GLTFExporter.js',
  'three/examples/jsm/exporters/OBJExporter.js',
  'three/examples/jsm/exporters/STLExporter.js',
  'three/examples/jsm/loaders/GLTFLoader.js',
]

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  base: process.env.VITE_BASE_PATH || '/',
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    // Two three.js instances break `instanceof` silently — the engine resolves
    // three from atelier/node_modules, this app from its own.
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: LAZY_BROWSER_DEPENDENCIES,
    // The engine ships .ts source with no build step. Vite's dependency
    // optimizer parses linked deps as plain JS and chokes on `import type`,
    // so these must go through the normal source pipeline instead.
    exclude: ATELIER,
  },
  build: {
    rollupOptions: {
      // Kept in its own module so the chunk boundaries can be tested. Drawing
      // one through an import cycle builds cleanly and then throws on load.
      output: { manualChunks },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'vite-manual-chunks.test.ts'],
  },
})
