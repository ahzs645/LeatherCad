# LeatherCad

A web-based 2D CAD tool for leathercraft pattern design, built with React, TypeScript, and Vite.

## Features

- 2D pattern editor with shapes, bezier curves, and text
- Constraint solver for parametric dimensions
- Pattern grading
- Geometry import: JSON, LCC, and SVG
- Tracing import (reference overlays only, not editable geometry): raster images and PDF
- Export: SVG, PDF, DXF, JSON, and LCC
- 3D preview via Three.js
- Template and leather catalog management
- Stitch hole rendering and cut line tools
- Nesting layout optimization

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Native AI Agent

LeatherCad can also run as a Node-served app with a native live AI Builder agent:

```bash
npm run agent
```

This builds the app, serves `dist/`, and enables the AI Builder's **Native Live Agent** panel. Without `OPENAI_API_KEY`, it streams deterministic local leather-template drafts for testing the live canvas loop. With `OPENAI_API_KEY`, the server also asks the configured OpenAI model to refine the local draft before the final preview.

After a build, the same server can be started directly:

```bash
npm run agent:serve -- --port 4177
```

The package exposes a `leathercad` bin, so local `npx`/package-runner workflows can start the same server entrypoint.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run agent` | Build and run the Node native AI agent server |
| `npm run agent:serve` | Serve an existing build with the native AI agent server |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run test:ai-builder-benchmarks` | Validate AI Builder swarm benchmark outputs |
| `npm run render:ai-builder-benchmarks` | Render swarm benchmark outputs into PNG/HTML previews |
| `npm run test:watch` | Run tests in watch mode |

## Tech Stack

- **React 19** with TypeScript
- **Vite** for bundling and dev server
- **Three.js** for 3D preview
- **Vitest** with happy-dom for testing
- **clipper-lib** for polygon boolean operations
- **opentype.js** for font parsing
- **pdfjs-dist** for PDF import

## Deployment

Automatically deployed to GitHub Pages on push to `main` via GitHub Actions.
