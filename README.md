# LeatherCad

A web-based 2D CAD tool for leathercraft pattern design, built with React, TypeScript, and Vite.

## Features

- 2D pattern editor with shapes, bezier curves, and text
- Constraint solver for parametric dimensions
- Pattern grading
- Import/export: DXF, SVG, PDF, LCC, and JSON formats
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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
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
