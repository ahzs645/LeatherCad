import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// The Atelier engine is consumed as TypeScript source through `link:` symlinks
// into ../atelier, so it needs the same two accommodations Seamer Studio makes.
const ATELIER = [
  '@atelier/core',
  '@atelier/geometry',
  '@atelier/io',
  '@atelier/react',
  '@atelier/render',
  '@atelier/viewport',
]

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    // Two three.js instances break `instanceof` silently — the engine resolves
    // three from atelier/node_modules, this app from its own.
    dedupe: ['three'],
  },
  optimizeDeps: {
    // The engine ships .ts source with no build step. Vite's dependency
    // optimizer parses linked deps as plain JS and chokes on `import type`,
    // so these must go through the normal source pipeline instead.
    exclude: ATELIER,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
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
          if (id.includes('node_modules/three')) {
            return 'three-core-vendor'
          }
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'pdf-vendor'
          }
          if (id.includes('node_modules/opentype.js')) {
            return 'opentype-vendor'
          }
          if (id.includes('node_modules/clipper-lib')) {
            return 'clipper-vendor'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
