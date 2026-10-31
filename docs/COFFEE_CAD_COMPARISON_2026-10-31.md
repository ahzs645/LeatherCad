# Coffee Craft CAD comparison and jsmap test

Reviewed 2026-10-31. The reference is the supplied [Drive file](https://drive.google.com/file/d/1a-pA-GHKp7jzNOTDICV48bWbLQj3FRXj/view), a HAR recording of `cad.coffee-craft.net`, not the older desktop app used by the existing parity audit.

This is the baseline audit. The subsequent [implementation report](COFFEE_CAD_IMPLEMENTATION_2026-10-31.md) records completed fixes, new functionality, verification and remaining limits.

The first priority is file compatibility. A rectangle drawn and exported in the reference cannot be transferred correctly through either its native `.lcad` file or its current sealed `.lcc` export. Our drafting, pattern processing, and assembly features provide a substantial foundation; the reference also exposes DXF import, STL pattern/jig tools, built-in languages, and cloud/community workflows that need separate parity work.

## Scope and evidence

| Input | Version / identity |
| --- | --- |
| LeatherCad | `6b0e70960bcab78f310c193a6102831f3e5b8bc6` |
| [jsmap](https://github.com/ahzs645/jsmap) | `0b28735bc6974a8047a913c389139620748caf6c` |
| HAR | `cadcoffee`, 36,920,302 bytes; SHA-256 `19537cb5a7361b1b366f68fc2e0dc524cb921a34f0e62b295aa7776672f10107` |
| Captured CAD build | `app-affc2f74a7.js`, application version `2026-10-27` |
| CAD bundle | 2,463,949 bytes; SHA-256 `b5830eaade610a428de0776d1989361fc7ddfae9fc2f48e0833f67551af586a1` |

The HAR contains 491 requests across 11 hosts. Only 17 requests are to the CAD host; 398 go to `auth.coffee-craft.net`, which serves both authentication and application/cloud resources. The full CAD JavaScript and HTML body are present under `/storage/v1/object/app/` on that second host.

Runtime evidence below comes from the captured code served locally in Chromium. A documented synthetic HTML entry mounts the already-captured body and module without injecting a user session. Original captured runtime files remain unchanged. All browser traffic is restricted to local replay addresses. Cloud services, community writes, production sign-in, and membership behavior were not exercised.

Local evidence is under [/workspace/scratch/leathercad-comparison](/workspace/scratch/leathercad-comparison). Raw/selected HAR files and captured response bodies remain outside the LeatherCad repository. This document contains no sign-in tokens or user response payloads.

## Feature comparison

“Observed” means exercised locally; “code” means present in captured UI/implementation but not fully validated end to end. Shared feature names do not establish identical geometry or output.

| Workflow | Captured Coffee Craft CAD | Our LeatherCad | Assessment |
| --- | --- | --- | --- |
| 2D drafting | Line, rectangle, circle, ellipse, Bézier, arc, text, offset, trim, dimension, tangent and tracing tools. Rectangle drawing observed: four line entities. | Broad drafting tools, layers, snapping, transforms and dimensions; unit and browser coverage. | Substantial overlap. Numeric geometry parity still needs representative fixtures. |
| Stitching | Stitch tool, hole/pricking-iron and path operations in code. | Fixed/variable pitch, pricking presets, terminal holes, simulator and box stitch helpers. | Existing engine is substantial; the browser stitch test was intermittent in this run. No pitch-by-pitch cross-app equivalence claim. |
| Native document files | `.lcad`, version 2, `shapes`, `name`, `unit_for_view`, groups, provenance and recording. Saved a new rectangle through the UI. | JSON `objects` document model; file action primarily accepts `.json` / `.lcc`. | Native format adapter is missing. Renaming the extension cannot solve schema differences. |
| Desktop LCC exchange | Current reference always exports a `LeathercraftCAD_Sealed` container with minimum reader `4.2.0`; observed export. | Importer implements the older plain LCC structure; exporter declares `2.8.3`. | **Confirmed incorrect import of the sealed reference export.** Details below. |
| SVG / DXF | SVG import/export and DXF import/export in code; DXF input advertises lines, arcs, polylines, splines and blocks. | SVG import/export and DXF export. No DXF importer located. | DXF import is a concrete feature gap. Entity/transform preservation needs its own fixtures. |
| PDF | Import and export UI and implementation. | Tracing plus vector pattern-PDF interpretation into pieces, stitch paths, folds and assembly; built-bundle import test passed. | Our semantic pattern-PDF pipeline is directly verified. Reference PDF behavior was not exercised for comparison. |
| STL / manufacturing jigs | STL dialog observed: 3D Pattern / Positioning Jig, stitch holes, thickness, chamfer/fillet and engraving. | No STL exporter located. | Manufacturing workflow gap. The reference preview requests an uncaptured Three.js module, so STL rendering/download was not verified. |
| Assembled 3D / folds | Captured STL preview implementation; no equivalent assembled drape workflow verified. | Pieces, seam connections, fold simulation, worker-based drape, stress/material controls and 3D/split routes. Worker and route tests passed. | Preserve our assembly workflow; compare it separately from STL extrusion. |
| Constraints / grading / nesting | No matched reference workflow verified. | Dedicated constraint, grading and nesting implementations with unit coverage. | Retain these capabilities; absence from this comparison is not proof the reference lacks them. |
| Languages | 20 language options in the captured editor; switching to English observed. | Translation map parser/storage and `useTranslate` hook exist. No component consumers of that hook were found. | Our translation infrastructure is largely scaffolded; bundled dictionaries and broad UI wiring remain work. |
| Persistence / community | Captured cloud projects/folders, versioning, publishing, licenses, Guild/board, profiles, likes and translations. Code and recorded endpoints only. | Dexie local storage is implemented. Convex data-client methods throw “not implemented yet.” | Cloud/community parity is a separate product/backend project, not a frontend toggle. |
| AI / automation | Captured app exposes `__lcadAI` and recording/MCP-related interfaces in code. | AI Builder, native agent server and template-draft tests. | Both have automation surfaces. No agent-quality or provider benchmark was performed. |

Relevant local implementation: [file loading](/workspace/leathercad/src/features/editor/hooks/useFileActions.ts:180), [JSON parser](/workspace/leathercad/src/features/editor/editor-json-import.ts:126), [LCC importer](/workspace/leathercad/src/features/editor/io/io-lcc.ts:189), [translation hook](/workspace/leathercad/src/features/editor/hooks/useTranslate.ts:12), [cloud stub](/workspace/leathercad/src/features/editor/localdb/convex-data-client.ts:3).

## Reproduced interoperability failures

Using actual reference UI interactions, I drew a rectangle and saved both a native `.lcad` file and a desktop `.lcc` export. These are newly generated local drawings, not documents taken from an account.

| Input to our actual parser | Expected content | Observed result |
| --- | --- | --- |
| Reference `.lcad` JSON | Four line edges | Rejected with `Missing objects array`. |
| Reference sealed `.lcc` | Four line edges | Reported one imported shape: a text compatibility notice. Warning: `Unexpected file_type: LeathercraftCAD_Sealed`. The rectangle edges were not imported. |
| Plain JSON payload extracted from the same sealed container, for diagnosis | Four line edges | All four shapes imported. |

The LCC failure is especially important: a successful-looking import count can represent the outer compatibility notice instead of the drawing. The importer currently continues after recognizing an unexpected file type.

Recommended implementation order:

1. Detect sealed LCC containers before normal shape parsing. Either decode/validate supported containers and versions, or reject clearly before replacing the open document. Do not treat the outer warning artwork as the drawing.
2. Add an explicit `.lcad` adapter for the reference schema. Map layers, palette/style ownership, groups, shape types, stitch holes, units and metadata. Do not merely rename `shapes` to `objects`.
3. Add cross-app fixtures for curves, ellipses, linked stitch runs, text, images and dimensions after the rectangle case. This run proves the basic failures, not a full compatibility specification.

Reproduce the parser checks with:

```sh
node /workspace/scratch/leathercad-comparison/check-interoperability.mjs
```

Results: [interoperability-results.json](/workspace/scratch/leathercad-comparison/interoperability-baseline-results.json). Reference interactions: [reference-interactions.json](/workspace/scratch/leathercad-comparison/reference-interactions.json).

The diagnostic script inflates the test drawing’s payload to isolate the problem. It does not implement production signature validation or constitute a new supported importer.

## jsmap findings

The achieved recovery level is **`preserved-runtime`**, framework route **`inspection-first`**. This is not a standalone source application. The automatic detector remained unknown; no forced Vite/webpack route was used.

| Test / operation | Result |
| --- | --- |
| Full 491-entry HAR import | **Failed:** `ENAMETOOLONG` while materializing a Google sign-in asset URL. |
| Minimal synthetic long-path HAR | Same failure, independent of the private capture. |
| App/static-asset selection, 47 GET entries | Imported successfully, 10 primary-origin files. Request headers/query handling used jsmap’s importer. |
| Recovery generation | Completed with four quality warnings, preserving the loader. |
| Automatic recovery scope | Only the primary-origin loader became a recovery chunk. The real CAD module remains in external replay evidence. Explicit app-owned asset inclusion is needed before source promotion. |
| Default grouped CAD split | One large section, named `vendor-three-runtime.js`; poor app-level separation for this bundle. |
| Explicit declaration split | 2,382 inspectable sections. These are not independently reconstructed application modules. |
| Local editor replay | Booted; drawing and local saves worked after the documented synthetic entry and CDN import mapping. |
| Coverage command | “No webpack chunk map found” / “no problems detected.” This is not completeness evidence: uncaptured Three.js was still requested when opening STL preview. |
| Privacy scan of app/static recovery | Zero high-severity matches and zero invariant violations; 58 review matches, largely vendor code expressions. This does not certify the original HAR safe to share. |

Two reproducible tool defects deserve follow-up:

1. **Unbounded URL path segments.** `safePathname` sanitizes characters but does not bound filesystem component length. The supplied HAR and a synthetic fixture both exceed the filesystem limit. Use deterministic bounded filenames with original URL-to-path provenance and collision tests.
2. **Root-relative imports inside external CDN modules.** Captured `esm.sh/earcut@2.2.4` re-exports `/earcut@2.2.4/es2022/earcut.mjs`. Replay requested that path from the local app root and got a 404 even though the module was captured. An explicit import map in the synthetic comparison entry resolved it without altering either module body. General replay needs importer-origin-aware module URL resolution.

The real CAD bundle is application-owned code despite being served by the auth/storage origin. jsmap should support selecting that asset for analysis while continuing to exclude authentication and user-data replay bodies from source promotion.

Long-path reproduction (expected failure on the reviewed commit):

```sh
cd /workspace/scratch/jsmap
node scripts/jsmap.cjs mitm-import \
  /workspace/scratch/leathercad-comparison/jsmap-long-path-repro.har \
  /workspace/scratch/leathercad-comparison/long-path-repro-new \
  --origin https://app.test
```

The [comparison entry provenance](/workspace/scratch/leathercad-comparison/comparison-entry-provenance.json) records the synthetic wrapper and import-map workaround. A normal recovered login page has no captured browser session; this audit does not claim authentication replay.

## Verification results

| Check | Result |
| --- | --- |
| LeatherCad unit suite | **904 / 904 passed**, 126 files. |
| LeatherCad TypeScript | Passed. |
| LeatherCad production build | Passed; existing large-chunk warnings. |
| LeatherCad browser suite | **20 / 21 passed** with two workers, covering desktop, production build, tablet and mobile. |
| Isolated stitch browser recheck | **Passed.** The initial failure was waiting for the `Simulate` control after terminal stitch editing; treat as intermittent, not a confirmed deterministic product defect. |
| Reference basic workflow | Boot, rectangle drawing, `.lcad` save and sealed `.lcc` export passed locally. |
| Reference STL | Dialog opened; preview blocked by uncaptured `three@0.160.0`. No manufacturing output-quality claim. |
| jsmap CLI regressions | **9 script suites passed:** HAR import/replay, privacy verifier, coverage, framework detection (14 cases), boot readiness, embedded assets, bundle-only rebuild, capture sanitization (7 cases), evidence isolation. |
| jsmap static-runtime test | Environment-blocked: its verifier requires the Playwright-pinned Chromium binary and does not use the installed system Chromium. Separate custom Chromium replay checks passed. |

LeatherCad dependency installation initially reported ignored `esbuild` / `@parcel/watcher` scripts. Installed tools worked directly. The browser runner used the existing tests with only server commands changed from pnpm wrappers to the equivalent Node/Vite entrypoints, plus system Chromium. The temporary repository config and pnpm-generated workspace file were removed afterward. Application source and existing tests were not changed.

Useful evidence: [unit log](/workspace/scratch/leathercad-comparison/leathercad-unit-tests.log), [initial browser log](/workspace/scratch/leathercad-comparison/leathercad-browser-tests.log), [stitch recheck](/workspace/scratch/leathercad-comparison/leathercad-stitch-recheck.log), [browser snapshots and network results](/workspace/scratch/leathercad-comparison/browser-comparison.json), [reusable browser config](/workspace/scratch/leathercad-comparison/playwright.config.ts).

Visual evidence: [reference editor](/workspace/scratch/leathercad-comparison/reference-desktop.png), [our editor](/workspace/scratch/leathercad-comparison/leathercad-desktop.png), [rectangle drawn in the reference](/workspace/scratch/leathercad-comparison/reference-rectangle.png), [reference STL dialog](/workspace/scratch/leathercad-comparison/reference-stl.png).

## Next implementation priorities

1. Prevent misleading sealed LCC imports; then implement `.lcad` interchange.
2. Investigate the intermittent stitch browser test with a trace before deciding whether its cause is application behavior or test timing.
3. Add DXF import with entity-level fixtures.
4. Treat STL pattern/jig export as a separate manufacturing feature; validate thickness, holes, units and mesh topology before claiming parity.
5. Wire localization across actual controls and add dictionaries. Scope cloud/Guild work separately from CAD parity.

The existing desktop parity audit remains useful, but its completed checkboxes should not be treated as proof of compatibility with this newer web build.
