# LeatherCad on Atelier

How this app consumes the shared [Atelier](https://github.com/ahzs645/atelier) CAD editor
runtime — the same engine behind PackCAD and Seamer Studio — what has been adopted so far,
and the staged plan for the rest. Companion to Atelier's `docs/ARCHITECTURE.md` and
`docs/MIGRATION.md`; the ground rules there apply here verbatim, most importantly
**preserve behavior deliberately** and **one behavioral change per step, at most**.

## Status — 2026-08-17

| Phase | State |
|---|---|
| 0 — foundation (pnpm, `link:` deps, Vite dedupe, sibling-checkout CI) | **Complete** |
| 1 — `@atelier/geometry` | **Complete** for exact-duplicate primitives |
| 2 — `@atelier/io` | Assessed; deferred (see below — not a mechanical swap) |
| 3 — `@atelier/viewport` + `@atelier/render` | **Complete** — engine viewport drives the 3D preview; path-traced studio stills wired |
| 4 — `@atelier/core` | Assessed; deferred (opposite history designs, the big one) |

## Consumption model

Identical to Seamer Studio's, per Atelier MIGRATION §2 Stage A:

- The engine lives in a **sibling checkout** at `../atelier` and is consumed as raw
  TypeScript source through **`link:` dependencies** (`link:`, never `file:` — pnpm copies
  `file:` deps into its store at install time, so engine edits silently stop propagating).
  Verify with `ls -la node_modules/@atelier/geometry` → must point at
  `../../../atelier/packages/geometry`, not into `.pnpm/`.
- **Package manager is pnpm** (`packageManager: pnpm@10.18.1`). The old
  `package-lock.json` is gone; `pnpm-lock.yaml` is the lockfile.
- **three.js**: Atelier declares `three` as an open peer range (`>=0.170.0`), so this
  app's `^0.183.1` satisfies it directly. The real hazard is *two* three instances
  breaking `instanceof` checks silently, so `vite.config.ts` sets
  `resolve.dedupe: ['three']` and excludes `@atelier/*` from `optimizeDeps` (the
  optimizer parses linked deps as plain JS and fails on `import type`).
- **CI** checks out `ahzs645/atelier` next to the app and installs both workspaces —
  see `.github/workflows/ci.yml` and `github-pages.yml`.

## The coordinate-frame question, settled

Atelier's document convention is mathematical **Y-up** (ARCHITECTURE D5). LeatherCad's
document frame is **Y-down**: pointer coordinates map straight through
(`useCanvasInteractions.toWorldPoint`), and `.lcc` files persist Y-down geometry.

This turned out not to require a conversion boundary. The polygon/polyline helpers in
`@atelier/geometry` are **equivariant under a Y flip** — flip the input and the output
flips, nothing else changes. `offsetPolygon` derives its normals from the polygon's own
winding rather than a global convention, so "outward" stays outward in either frame. This
is now a pinned contract in the engine
(`atelier/packages/geometry/src/yAxisConvention.test.ts`), verified for `offsetPolygon`,
`offsetPolygonVariable`, `applyCornerJoins`, `polygonCentroid`, `pointInPolygon`,
`resamplePolyline`, `simplifyPolyline`, `polylineLength`, and `bounds`.

The one convention-dependent value is the **sign of `polygonArea`**: positive means CCW
in Y-up terms, which is *clockwise on screen* in this app's frame. `ensureCCW`/`ensureCW`
in `ops/polygon-ops.ts` are named for the sign, not the on-screen direction; the comment
at `polygonArea` records this.

## Phase 1 — what was adopted

Exact-duplicate implementations replaced by engine calls, all behavior-preserving
(identical algorithms, verified against the existing 549-test suite):

| App site | Engine function |
|---|---|
| `ops/polygon-ops.ts` `polygonArea` | `polygonArea` (same shoelace) |
| `ops/polygon-ops.ts` `polygonCentroid` | `polygonCentroid` (both are vertex averages, not area centroids) |
| `ops/polygon-ops.ts` `polygonBounds` | `bounds` (+ app-side width/height) |
| `ops/outline-detection.ts` `pointInPolygon` | `pointInPolygon` (same ray cast) |
| `ops/nesting-ops.ts` private `convexHull`, `pointInPolygon` | `convexHull`, `pointInPolygon` (same monotone chain / ray cast) |
| `cad/cad-geometry.ts` `distance` | `dist` (same `Math.hypot`) |

Deliberately **kept app-owned**:

- `clipper-ops.ts` — boolean ops and offsetting run on clipper-lib's Vatti algorithm with
  join types (miter/round/square) and open-path support; Atelier's `offsetPolygon` is a
  leaner miter-only offsetter. Different capability envelope, not a duplicate.
- Arc/bezier sampling in `cad-geometry.ts` — the app samples with fixed segment counts;
  Atelier's `arcToPolyline` samples by chord-error tolerance. Same circumcircle math
  (`threePointArc`), different output density → swapping would change every sampled
  polyline downstream.
- Quadratic béziers — the engine's curve module is cubic-only.
- The NFP nesting algorithm itself — Atelier's `nest`/`nestSearch` is a different
  algorithm with different placements. A future swap is a product decision, not a dedup.

## Phase 2 — io, and why it is deferred

`@atelier/io`'s neutral `Drawing` model writes DXF as `LWPOLYLINE` entities and knows
nothing of stitch holes. This app's `io-dxf.ts` emits per-segment `LINE` + `ARC`/`CIRCLE`
entities, carries DXF version switches, per-role dash patterns, mm/in scaling, `flipY`,
and stitch-hole render modes — all pinned by parity tests. Routing through the engine
would change the byte structure of every exported cut file. The same asymmetry holds for
PDF and SVG export. Adopting `@atelier/io` is therefore a *deliberate format change* to
schedule with downstream consumers in mind, or an opportunity to add engine formats the
app lacks (HPGL, cut-file presets) as new features. Import (`fromSVG`, `fromDXF`) is the
softer entry point since parity is against rendered geometry, not byte output.

## Phase 3 — viewport and still rendering (done)

The hand-rolled `three/runtime-manager.ts` is gone. The 3D preview runs on
`@atelier/viewport`'s `Viewport` — the same runtime behind Seamer Studio's drape view —
mounted behind `three-bridge.ts` so the bridge's consumer-facing API did not change:

- **`three/engine-runtime.ts`** constructs the `Viewport` bound to the React-owned canvas
  via `rendererFactory`, holds a permanent render lease (the model builders mutate the
  scene graph directly, so on-demand invalidation is a later optimization), and keeps the
  bench-specific pieces: LeatherCad's camera fit modes (`orbit`/`pattern`/`top`/`front`/
  `side`) and the four-view review collage. On dispose it re-attaches the canvas the
  engine detached, because that node belongs to React.
- **`three/leather-stage.ts`** is the SeamerLighting-equivalent app-side stage: the old
  theme hues (dark `#0a1220` / light `#eef4ff`, the blue key/rim pair) retuned for the
  engine's ACES tone mapping, plus room-environment IBL so dyed and burnished leather
  picks up reflections, a shadow-catcher floor, and the themed grid.
- GTAO ambient occlusion + SMAA run through the engine's `PostFX` — occlusion is what
  makes stitch holes, skived edges, and stacked panels read as depth.
- **Stitching renders as thread** (`three/stitch-thread.ts`): lit instanced cylinders
  along consecutive holes of each stitch chain (the visible saddle-stitch run) and across
  seam pairs, in the document's thread color. The stress-tint diagnostic view keeps the
  colored guide lines; presentation mode (stress overlay off) shows thread everywhere.
- **Path-traced studio stills** (`@atelier/render`): the "Studio Render" button in the 3D
  preview drives `renderStill` (scene clone → studio staging → progressive path trace →
  denoise) and downloads a PNG — the same beauty-shot pipeline Seamer Studio ships. Loaded
  lazily so the path tracer stays out of the main bundle.

`@atelier/react`'s `ViewportCanvas` remains available for a later cleanup of the React
mount itself. `@types/three` is pinned to atelier's version (0.184.1) while the runtime
`three` stays the app's own — the same types-ahead-of-runtime arrangement seamer uses;
Vite's `resolve.dedupe` guarantees one runtime copy.

## Phase 4 — core, and why it is deferred

The app's document state is a flat `EditorDocumentState` spread across React context
providers, with a bespoke **delta/operation history** (`ops/operation-history.ts`).
Atelier is `Editor<TContent>` + `CommandRegistry` + **snapshot** history — deliberately
(ARCHITECTURE D4). These are opposite designs; adoption means re-expressing the app's
operations as `CommandDef<EditorDocumentState>` reducers and accepting snapshot memory
costs. That is the same generalization Seamer Studio underwent — and notably it was done
there as a *fork built on the engine from the start*, not an in-place migration. The
mapping when it happens: `EditorDocumentState` → `Doc<T>` content, `operation-history` →
`History<T>` labels + coalescing, the selection providers → one Atelier `Selection`, with
the existing provider hooks becoming compatibility views (exactly the pattern
seamer-studio used for its point/path/piece stores).

## Known engine issue relevant to this app

`@atelier/geometry`'s `triangulate` throws on some *valid, simple, non-convex* polygons
at fine Steiner spacings (non-monotonic in spacing; L-shape fails at 5/10/15 and 30 but
succeeds at 20/25 and 40+). Recorded as expected-fail tests in
`atelier/packages/geometry/src/triangulateRobustness.test.ts`. LeatherCad currently
triangulates via three.js `ShapeUtils.triangulateShape` in one place
(`three/final-product-model-builder.ts`), so it is unaffected — but a Phase-3+ move onto
engine triangulation must wait for (or fix) that defect first.

## Checks

```sh
pnpm lint
pnpm check:architecture
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```
