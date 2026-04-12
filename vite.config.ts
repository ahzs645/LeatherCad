import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
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
