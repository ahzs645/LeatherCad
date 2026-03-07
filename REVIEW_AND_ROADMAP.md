# LeatherCad Review & Roadmap

## Codebase Health Summary (March 2026)

**Overall Score: 6/10** — Solid foundation needing testing and refactoring.

| Category       | Score | Notes                                        |
|----------------|-------|----------------------------------------------|
| Type Safety    | 9/10  | Strict TS, no `any` escapes, discriminated unions |
| Code Org       | 7/10  | Good modular structure; EditorApp.tsx too large |
| Testing        | 1/10  | Zero tests — critical gap                    |
| Documentation  | 3/10  | Minimal; needs architecture guide            |
| Security       | 8/10  | No vulnerabilities found                     |
| Performance    | 6/10  | State bloat, history cloning, no code splitting |
| Error Handling | 7/10  | Good in I/O; weak in canvas/UI interactions  |

---

## Glaring Issues to Fix

### P0 — Critical

1. **Zero test coverage.** Geometry math (`cad-geometry.ts`), I/O parsing (`io-svg.ts`, `io-dxf.ts`, `io-pdf.ts`), and business ops are completely untested. Add Vitest with coverage targeting `cad/`, `ops/`, and `io/` first.

2. **Monolithic `EditorApp.tsx`.** 1,764 lines with 72 `useState` declarations. Extract into focused hooks: `useEditorState()`, `useViewport()`, `useTools()`, `useLayerState()`, etc.

3. **No error boundaries.** A crash in canvas rendering takes down the entire app with no recovery path.

### P1 — High Priority

4. **localStorage quota not protected.** At least 5 files write to localStorage without catching quota errors. On mobile or incognito, data is silently lost.

5. **History/clipboard memory bloat.** Deep-cloning up to 120 full document snapshots with no size limits. Large patterns risk OOM.

6. **Race conditions in async file operations.** SVG import, JSON load lack concurrency guards — rapid imports could corrupt state.

7. **ESLint type-aware rules not enabled.** `tseslint.configs.recommendedTypeChecked` is mentioned in README but not configured.

### P2 — Medium

8. No code splitting — entire app loads as one bundle.
9. Missing documentation — no architecture guide, sparse comments on complex ops.
10. Fold line calculations don't protect against degenerate cases (collinear points).

---

## Ideas from jsketcher

[jsketcher](https://github.com/nicholasgsmith/jsketcher) is an open-source browser-based parametric 2D/3D CAD modeler (~1.7k stars) using Canvas + THREE.js + OpenCASCADE.

### High Value — Adopt Directly

| Feature | What jsketcher does | LeatherCad benefit |
|---|---|---|
| **Schema-driven tool dialogs** | Schema per tool (fields, types, defaults) auto-generates UI + persistence | Eliminates boilerplate for stitch settings, seam allowance, hardware placement |
| **Workbench architecture** | Feature folders with standardized `index.ts` (id, schema, run) + icon + docs | New tools added without touching core code. Workbenches for Pattern Design, Stitching, Hardware, Cutting |
| **Measurements as constraints** | Dimensioning creates a constraint maintained during edits | 5mm seam allowance stays 5mm when pattern is modified |
| **Auto-constraint snapping** | Near a point → proposes coincident; near-horizontal → proposes horizontal | Less manual work; add grid snapping for leather-specific layouts |

### Medium Value — Adapt for 2D Leather Context

| Feature | LeatherCad application |
|---|---|
| **2D constraint solver** | Coincident, parallel, perpendicular, distance, symmetry for pattern edges and seam allowances |
| **Parametric dimensions** | Named dimensions like "wallet width" re-solve the entire pattern — enables pattern grading |
| **Feature history** | Change a fillet radius from 3 steps ago without undoing everything |

### Not Needed

- 3D BREP / OpenCASCADE (leather is flat sheet material)
- 3D boolean operations
- WASM computation (unless nesting optimization is added later)

---

## Recommended Implementation Order

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Add Vitest + tests for `cad-geometry.ts` and `io/` parsers | Medium | High |
| 2 | Add React error boundaries around canvas and panels | Low | High |
| 3 | Protect all localStorage writes with try/catch | Low | Medium |
| 4 | Cap history size + add size-based eviction | Low | Medium |
| 5 | Extract EditorApp.tsx state into focused hooks | High | High |
| 6 | Enable type-aware ESLint rules | Low | Medium |
| 7 | Schema-driven tool dialogs (from jsketcher) | High | High |
| 8 | 2D constraint solver (distance + coincident first) | High | Very High |
| 9 | Parametric dimensions / pattern grading | High | Very High |
| 10 | Code splitting for modals + Three.js | Medium | Medium |
