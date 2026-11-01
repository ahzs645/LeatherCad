# Remaining LeatherCad work: evidence, priorities and completion criteria

**Historical analysis of `41da8db`:** the subsequent [implementation report](FOLLOWUP_IMPLEMENTATION_2026-10-31.md) records the fixes and current limits. Use [the current priorities](NEXT_PARITY_PRIORITIES.md) for remaining work. The tables below preserve the original findings; they are not a current missing-feature list.

Analysis date: 2026-10-31. Reviewed LeatherCad commit `41da8db1c66bab9fd957c1c1b1658579f64276cb`, the changes in [draft PR #17](https://github.com/ahzs645/LeatherCad/pull/17), and the supplied Coffee Craft CAD web capture, build `2026-10-27`. Six focused agent reviews covered interface/options, interchange, manufacturing, cloud/community, jsmap, and release readiness. This is an analysis and implementation plan; the findings below have not been fixed by this document.

## Assessment

LeatherCad now has working basic LCAD exchange, ASCII DXF import, STL patterns/jigs, language selection, and an optional cloud/community implementation. Its existing constraints, grading, nesting, PDF interpretation, seam assembly and fold simulation remain valuable capabilities. The comparison does not establish whether the reference has equivalents for every one of them.

The next work should start with **recovery and fidelity**, followed by interface consistency and manufacturing accuracy. Three synthetic diagnostics reproduced silent file-transfer defects that the existing rectangle tests do not catch. Source review also found an unwired autosave recovery path and an incomplete cloud editing lifecycle. Optional workspace customization should follow these issues.

There is no defensible single “parity percentage”: a visible control, a backend API, a passing synthetic test, and a physically measured output establish different things.

## Evidence and confidence

| Evidence | What it establishes | Limit |
| --- | --- | --- |
| Recorded implementation verification | 1,025 unit tests in 143 files; 28 cold-cache Chromium browser cases; app/backend types, lint, architecture and build passed. CI passed for `41da8db`. | These results predate this analysis. They cover the tested paths, not every format property or production integration. See [portable results](verification/coffee-cad-2026-10-31.json). |
| New synthetic diagnostics | Reproduced LCAD width loss, DXF lineweight collision and legacy LCC cubic distortion using actual adapters. | Inputs are deliberately small and synthetic. See [results](verification/remaining-interchange-2026-10-31.json) and [reproducer](verification/remaining-interchange-diagnostics.mjs). |
| Current source review | Traces current controls, model fields, persistence calls, geometry paths and backend contracts. | A code-confirmed gap is not a reported live incident. Findings explicitly distinguish missing UI from implemented backend capability. |
| Reference runtime | The captured editor boots, draws four rectangle edges and saves LCAD/sealed LCC. | Original STL generation, live authentication and cloud behavior were not exercised. |
| Reference UI/code | Confirms the named settings and manufacturing options discussed below. | Presence does not prove those operations produce correct geometry. Missing dynamic Three.js assets blocked reference STL output verification. |

The local Atelier checkout is `186feaf7b63e0928c5a27a78f874497e1a8cdfdd`. This records the checkout inspected during this analysis; it is not a substitute for recording the engine revision in every release. The original comparison baseline remains in [the comparison report](COFFEE_CAD_COMPARISON_2026-10-31.md); completed work is in [the implementation report](COFFEE_CAD_IMPLEMENTATION_2026-10-31.md).

## Highest-priority findings

P0 means resolve before relying on the affected durability or production claim. P1 is the next implementation work. P2 expands or improves a supported workflow. P3 is optional polish. Effort is relative: S is localized, M crosses several components/contracts, and L changes a model or substantial geometry/service behavior; these are not calendar estimates.

| ID / priority | Finding and practical effect | Evidence | Completion criteria | Effort |
| --- | --- | --- | --- | --- |
| R1 / P0 | **Autosave recovery is not wired.** Snapshots are written, but the app does not call either recovery reader. The special autosave record is excluded from normal project listings. A later timer can overwrite the single prior snapshot. | [autosave readers](../src/features/editor/ops/autosave.ts#L34), [timer](../src/features/editor/hooks/useAutoSave.ts#L32), [project listing](../src/features/editor/localdb/dexie-data-client.ts#L70). | On reopen, offer Recover / Discard / Download before replacing a prior snapshot. Preserve malformed snapshots for download. Cover IndexedDB and localStorage fallback and an explicitly opened file taking precedence. | M |
| R2 / P0 | **Autosave can announce success without durable success.** The localStorage Boolean result is ignored, IndexedDB is not awaited, and database failures become `null`. | [write path](../src/features/editor/ops/autosave.ts#L26), [swallowed database errors](../src/features/editor/localdb/editor-local-data-client.ts#L16), [success message](../src/features/editor/hooks/useAutoSave.ts#L35). | Announce saved only after a store acknowledges persistence. If both fail, show a nonblocking failure and a download action. Define short-session/exit behavior, retention and the disabled-by-default preference explicitly. | M |
| F1 / P1 | **LCAD silently loses line widths.** A palette width of 0.65 mm and shape width of 0.25 mm import as the default 0.8 mm. Export ignores an existing 0.33 mm shape override and writes 0.8 mm. Both return no warning. | [import style key](../src/features/editor/io/io-lcad.ts#L49), [export style](../src/features/editor/io/lcad/lcad-export.ts#L27), diagnostic results. | Preserve palette defaults and per-shape overrides independently; test shared palettes, mixed widths, explicit zero/default semantics and import/export/reimport. Existing `strokeWidthOverride` can support a localized fix. | S–M |
| F2 / P1 | **DXF lineweights collide in style reuse.** Two otherwise identical same-layer lines with group-370 widths 0.25/0.8 mm both become 0.25 mm. There is no warning. | [DXF style key](../src/features/editor/io/io-dxf-import.ts#L82), diagnostic results. | Include effective width in style identity or use shape overrides; test explicit width plus BYLAYER/BYBLOCK inheritance. Distinct widths must survive one import. | S |
| F3 / P1 | **Legacy plain LCC cubic curves are unbounded approximations.** Averaging two cubic controls produces a quadratic whose midpoint is 25 mm wrong in the diagnostic fixture. No warning is returned. | [legacy conversion](../src/features/editor/io/io-lcc.ts#L312), diagnostic results. | Reuse bounded curve conversion or add native cubic support; test asymmetric curves and error across the whole curve, not only endpoints. Report conversion. Audit the separate legacy export conversion too. | M |
| M1 / P1 | **STL cut curves lack a dimensional tolerance.** Each authored arc/quadratic receives 48 segments regardless of size. Endpoint closure tolerance does not bound curve error. | [STL outline input](../src/features/editor/io/io-stl.ts#L87), [sampling](../src/features/editor/cad/cad-geometry.ts#L151). | Add manufacturing-specific adaptive subdivision with a visible mm tolerance and resource bounds. Verify maximum error across scales and ensure preview/download use the same mesh. | M |
| C1 / P0 for cloud launch | **Live cloud/provider integration is unverified.** Code and in-process tests exist; no real deployment/client is configured. | [setup](CLOUD_COMMUNITY.md), [OIDC contract](OIDC_CLOUD_AUTH.md). | Real production-origin sign-in/out, callback, expiry and failure tests; separate-account and anonymous access tests; local work survives provider failure and redirect. | M + configuration |
| C4 / P0 before OIDC activation | **Sign-in redirect has no unsaved-draft bridge.** The button invokes full-page `signinRedirect` with only a return route. It does not capture/restore the drawing; R1/R2 mean autosave does not fill this gap. | [button](../src/features/editor/components/CloudCommunityDialog.tsx#L114), [wrapper](../src/features/editor/localdb/editor-cloud-connection.ts#L40), [redirect](../src/features/editor/localdb/oidc-cloud-auth.ts#L107). | Await a durable local draft before redirect; use a one-use same-origin recovery marker; restore after callback success/failure. Cover autosave disabled, recent edits, canceled sign-in, blocked storage and callback reload. Retain the draft until recovery succeeds. | M, depends on A |
| C2 / P1 | **Cloud save is currently save-as-copy.** The main button always calls create. No UI associates an edited local copy with an existing remote ID/revision and calls the implemented update path. | [create-only UI](../src/features/editor/components/CloudCommunityDialog.tsx#L123), [backend save](../convex/cloudDocuments.ts#L37). | Explicit Save new cloud copy / Update selected drawing, remote identity and loaded revision, stale-save recovery, and owner-scoped rename/delete. Retain safe non-overwrite bulk upload. | M |
| C3 / P1 | **Some cloud actions lack stale-write checks.** Deletion accepts only ID; visibility changes accept no expected version. A stale owner client can affect newer content. Deletion is soft and history remains. | [remove](../convex/cloudDocuments.ts#L58), [visibility](../convex/community.ts#L77). | Require expected revision/version, reject stale requests with refresh guidance, and test concurrent callers and repeat-request behavior. | S–M |
| PDF1 / P1 | **Pattern-PDF page choice and review are missing.** The action uses default page 1 and applies inferred pieces immediately; individual warnings go to the console. | [file action](../src/features/editor/hooks/useFileActions.ts#L384), [page default](../src/features/editor/ops/pattern-pdf/pattern-pdf-import.ts#L32). | Select/scan pages; preview pieces, stitching, folds/seams and uncertainty before replacing the document. Cancel must preserve current work. | M–L |
| B1 / P1 | **A release can consume a moving Atelier revision.** Source links and sibling setup are intentional, but CI and Pages deployment check out the engine without a fixed ref. | [package dependencies](../package.json), [CI checkout](../.github/workflows/ci.yml#L25), [deployment checkout](../.github/workflows/github-pages.yml#L32). | Record and use the compatible engine revision for validation and deployment; reproduce a clean two-repository Node 22/pnpm 10.18.1 installation. | S–M |

F1–F3 were executed against the current adapters; R1/R2/C2/C3/C4/PDF1/B1 are source-confirmed. Their completion criteria are future acceptance tests, not claims that fixes already exist.

Reproduce the synthetic observations from the repository root after installing dependencies:

```sh
node docs/verification/remaining-interchange-diagnostics.mjs .
```

The checked-in script now asserts the corrected behavior, including exact legacy cubic geometry; its current output is [corrected-interchange-2026-10-31.json](verification/corrected-interchange-2026-10-31.json). The earlier [baseline results](verification/remaining-interchange-2026-10-31.json) retain the reproduced defects at `41da8db`. Desired-behavior regression tests now cover those cases.

## Interface and options

### What is available, and what should change

| Area | Present in LeatherCad | Remaining work / classification | Acceptance |
| --- | --- | --- | --- |
| Options organization | Titled sections already cover autosave, workspace, editing, notch/line/arc/tangent behavior, grid, language, zoom, SVG, dimensions, stitching/auto-pitch, box helper and print. | Reference has Input, Stitching, Display, This drawing, Drawing check and AI tabs. Navigable categories are a confirmed structural difference. Search and category reset are recommendations. | A settings registry with stable IDs, category, default, validator and persistence scope; keyboard navigation, translated labels, search, scoped reset and correct reload/new-project behavior. |
| Input | Reverse zoom/pan and modifier-driven rotate/scale/thickness operations; anchored wheel zoom. | Reference exposes Auto/Zoom/Pan wheel modes and 0.25–2× trackpad sensitivity. These configurable behaviors are missing. | Persistent mode/sensitivity, smooth deltas, horizontal/vertical pan, anchored zoom, preserved modifier edits; test mouse and trackpad. |
| Display units | Canonical mm geometry; source inch display imports with a warning and becomes mm display. | Reference mm/inch display selection is absent as a complete editor preference. | Keep canonical mm internally; consistently parse/format dimensions, inspectors and rulers in the chosen display unit. Prevent double conversion at import, print and export. |
| Tool order | Stable tool IDs in a fixed rail. | Reference supports move up/down/reset and persistence. Arbitrary ribbon favorites/custom groups extend beyond that evidence. | Keyboard-operable reorder/reset; persist IDs, append newly added tools on migration and keep labels independent of IDs. |
| Legacy dialogs | New interchange dialogs have names, focus trapping, Escape and focus restoration. | Options, Mandala and Change Shape Size still use older modal markup. Numeric handlers often reject invalid values without explaining why. | Named modal semantics; shared focus helper; no canvas shortcuts while typing; inline errors, units and bounds; disabled invalid Apply; phone keyboard walkthrough. |
| Phone file actions | File tools and save/export are available through the select/Apply flow. | Add direct common actions to reduce discovery cost. This is a recommendation. | Open/Save/Export/File tools reachable at 360 px, named for assistive technology and with 44 px touch targets. |
| Workspace | 2D/3D/Split, persisted panel widths, inspector pin/auto-hide and theme. | Named Drafting/Assembly/Printing/Canvas presets are recommendations. | Versioned layout-only presets; preserve artwork and user customization; adapt to narrow viewports. |
| Stitch count entry | Full pricking-iron naming/group/preset controls exist. | Even-count operation still uses `window.prompt`. | A validated integer form, minimum 2, clear effect/preview, Cancel and one undoable operation. |
| Language coverage | 20 selectable locales; Japanese has 555 entries; 18 others have 60 core-shell entries and English fallback. | Specialist inspectors/dialogs/diagnostics and much of the parent cloud dialog remain English. | Inventory used UI keys per workflow; translate accessibility and errors too; test expansion and imported overrides; native-language review. Dictionary counts are not coverage percentages. |

Implementation anchors: [Options](../src/features/editor/components/OptionsModal.tsx#L215), [wheel handler](../src/features/editor/hooks/canvas-interactions/useCanvasPanAndZoom.ts#L65), [tool rail](../src/features/editor/workbench/WorkbenchToolRail.tsx#L15), [workspace state](../src/features/editor/workbench/useWorkbenchShellState.ts), [focus helper](../src/features/editor/hooks/useModalDialogFocus.ts#L34), [stitch prompt](../src/features/editor/hooks/useStitchActions.ts#L282), [locales](LOCALIZATION.md).

Reference anchors are in the private formatted bundle: settings tabs `app.formatted.js:29664`, wheel/sensitivity `:29760` and consuming wheel behavior `:56592`, tool ordering `:29811` / `:30061`, display units `:29885`; mm/inch buttons are in `app-affc2f74a7.html:1949`. These are locations for local review, not files shipped in this repository.

### Reference controls needing a focused behavior mapping

The reference also exposes three pick radii, pen-lift guard, tool-label toggle, snap hints, auto loupe, left/right modifier pad, active-layer selection/dimming, recording visibility, tour replay, thumbnail regeneration, fill-boundary palette choice, duplicate tolerance/drawing checks and conditional AI connection/grant controls (`app.formatted.js:29789–29969`). Their reference presence is confirmed; this pass did not establish a complete LeatherCad behavior mapping for each one.

Do not turn this list into blanket missing-feature claims. LeatherCad already has coarse-pointer picking widths, snap indicators, geometry diagnostics and its own AI/automation surfaces. The follow-up is to record each control's default, stored scope, consuming code and observable behavior in both apps, then classify it as equivalent, different, missing or unnecessary. Y-axis direction belongs in this same targeted interaction review.

### Model work is separate from settings polish

The editable shape union is line, three-point arc, quadratic Bézier and text. An ellipse tool does not imply a native editable ellipse record. Ordinary shapes lack individual lock/opacity, and sketch groups lack parent relationships. Layer/group locking and backdrop opacity already exist.

Native cubic/ellipse types, per-shape style/locking and nested groups require coordinated serialization/migration, undo, transforms, hit testing, selection, rendering, constraints, inspectors and exporters. Treat this as L effort. A successful change must preserve exact parameters and hierarchy through edit → save → reopen → transfer; it must also preserve the old document reader. Do not add an inspector control before its state and behavior exist.

## File compatibility and import review

| Format / content | Supported now | Loss, rejection or unresolved work |
| --- | --- | --- |
| LeatherCad document JSON | Full project backup, including assembly state and structured community provenance. | Add broad save/reopen fixtures whenever new model/manufacturing state is introduced. A file backup is separate from whole-library backup. |
| LCAD basic geometry | Lines, rectangle edges, circular arcs, text, layers, styles, flat groups, physical stitches, linear dimensions and embedded raster tracing. | F1 width loss must be fixed. Curved text exports as plain text with a warning. Full reference provenance/recordings are not imported. |
| LCAD cubic / ellipse | Bounded conversion to editable quadratic curves / line segments, reported at 0.01 mm. | Exact native editing is absent. Approximation preserves geometry within its contract, not source primitive identity. |
| LCAD groups/styles | Flat sketch groups and layer locks; warnings for unsupported per-shape lock/opacity. | Nested groups flatten; source fills become outlines; shape width has a separate silent defect. SVG-image shapes and non-linear/radius dimensions reject. |
| LCAD export of advanced LeatherCad state | Exports compatible drawing content and warns about omitted state. | Constraints, pieces, seams, assembly, allowances, hardware and some tracing/fold/image state do not fit. Use JSON for a full backup. Own community attribution uses a versioned extension. |
| Current sealed LCC | Detected and rejected before replacing the open drawing. | No supported signature/version reader exists. Inflating a payload is not a validated reader. Use source LCAD or SVG export. |
| Legacy plain LCC | Reader/writer exists; attributed exports that would drop provenance reject. | F3 cubic distortion and the independent legacy export conversion require review. Legacy ellipse fitting also lacks a dimensional bound. Legacy support must not be described as exact curve compatibility. |
| ASCII planar DXF | Lines, circles/arcs, polyline bulges, nested/array block transforms, splines/ellipses, units and layers/styles. | F2 width collision; curve sampling has a default 0.05 mm target using adaptive sample-point checks, not a certified global bound. Dash patterns map to a small style set. Binary, text, hatches, dimensions, attributes, meshes/solids, unsupported xrefs and nonplanar entities are not converted. See [DXF scope](DXF_IMPORT.md). |
| DXF export | R14 circular arcs and degree-elevated quadratic SPLINE entities; R12 sampled geometry. | Export uses layer IDs rather than document layer names and does not map all color/weight metadata. R12 uses fixed curve sampling. Reimported R14 splines flatten into lines; a roundtrip does not preserve primitive identity. |
| SVG / PDF | Existing SVG exchange, vector pattern-PDF interpretation and raster/PDF tracing. | This analysis does not establish exhaustive SVG/filter/font fidelity. Pattern-PDF needs page choice, confidence and review. Tracing is not editable vector geometry. |

The next shared UI should consume structured adapter results: source units, counts, layers/styles, unsupported content, approximation tolerance and attribution. It should show a preview and loss summary before mutation/download. Cancel must preserve the drawing; applying an append should be one undoable action. Keep full JSON backup discoverable when a format omits project state. SVG already has a pending-review pattern that can inform this work.

**Add aggregate budgets and session protection before expanding file coverage.** DXF already limits bytes, expanded shapes, arrays, recursion and individual curves. LCAD limits top-level input shapes and each curve, but lacks a total budget for expanded paths/curve segments; JSON/LCAD/LCC file reads have no comparable byte cap. Bound total output geometry, nested segments and embedded-image bytes before mutation, and move heavy parsing off the UI thread. Pending LCAD/LCC/JSON reads also need document-session cancellation comparable to DXF, so a slow old file cannot overwrite a newly opened drawing. These are P1/M integration tasks, separate from adding another supported entity type.

Expand fixtures beyond a symmetric rectangle: asymmetric cubic/ellipse parts, mixed widths, nested transforms/groups, linked stitch sequences and orientation, text/fonts, calibrated images, linear/radius dimensions, unit display, corrupted inputs and files near resource limits. Measure curve and stitch positions; matching shape counts alone is insufficient.

For semantic PDF import, use public or synthetic multi-page examples with instructions on page 1 and geometry on a later page. Stitch detection currently uses relative spacing/angle/count filters; it needs confidence review for implausible physical pitch and decorative marks. Thin valid marks must not be rejected solely by diameter. Distinguish folds within a piece from seams joining separate pieces. Historical corpus statistics in [PATTERN_PDF_CORPUS.md](PATTERN_PDF_CORPUS.md) are dated measurements, not current benchmark results.

## Manufacturing: exact next steps

Current STL export already supports mm dimensions, visible/selected cut geometry, unions, concavity, nested cutouts, round/original stitch holes, and a rectangular jig with floor thickness, pocket depth, margin and positive clearance. A real OrbitControls preview, warning display and invalid-geometry download guard exist. Fourteen focused tests plus recorded browser downloads cover basic dimensions, volume, holes and rejection cases.

### Accuracy before additional controls

For a circular arc with radius `r`, sweep `theta` and `N` equal-angle segments, radial chord error is `r * (1 - cos(abs(theta) / (2*N)))`. The current 48-segment semicircle has **0.05354 mm** error at radius 100 mm and **0.16062 mm** at radius 300 mm. A circle authored as two semicircles therefore gets 96 segments. Quadratic error also scales with size; there is no manufacturing error check. The 0.001 mm outline tolerance concerns endpoint matching.

Stitch circles have separate circumference-based sampling capped at 24–192 segments; over the allowed diameters their code-derived radial error is approximately at most 0.0082 mm. Original nonround holes use four straight sides. Prioritize adaptive cut curves instead of indiscriminately replacing hole sampling.

Mesh validation checks finite coordinates, nondegenerate triangles, oppositely paired edges and positive aggregate signed volume. It does not independently prove absence of triangle intersections, outward orientation of every disconnected component, minimum printable walls or physical fit. Maintain those checks and add independent slicer/mesh validation and calibration fixtures as geometry grows.

### Manufacturing backlog and dependencies

| Sequence / effort | Work | Completion criteria |
| --- | --- | --- |
| 1 / M | Adaptive mm tolerance; bounded/cancelable generation for larger documents. | Error below selected tolerance across scales; bounded subdivision; editing stays responsive; superseded work cannot replace a newer preview; preview equals export. |
| 2 / M | Persistent document manufacturing settings and user profiles. | Versioned state survives JSON/cloud/history/reopen; document operations and user defaults have distinct scope; reopening reproduces output. Current modal state disappears when unmounted. |
| 3 / M | Jig stitch-through drilling and finger holes. | Correct diameter/depth and placement, clear clipping/contact rules, no coincident internal faces, valid connected solids. Current jig floor remains solid. |
| 4 / M | Pattern-offset or explicit W × H jig outline; optional signed clearance. | Pocket containment, measurable outside dimensions, minimum wall checks, disconnected patterns/islands; reject impossible fits. Negative clearance is an interference-fit design choice needing validation. |
| 5 / L | Per-face thickness/depth/through regions. | Stable face IDs, selectable regions, persisted assignments and shared boundary meshing; report assignments invalidated by edits; adjacent unequal depths remain closed without internal duplicate faces. |
| 6 / L | Top/bottom engraving and depth. | Font outlines/counters, rotation, bottom mirroring, missing-font feedback, depth below local thickness, visible geometric change in the STL. |
| 7 / L | Chamfer and fillet. | Topology-aware offsets, concave/narrow-wall/hole cases, valid radii/steps and clear rejection of impossible finishes. |
| 8 / S–M | Export-time diamond/european/flat size overrides and explicit target roles. | Geometry changes only for export; preview dimensions equal output; open paths and unsupported roles are explained. |
| 9 / S | Preview material/color choices. | Appearance changes leave mesh geometry/STL unchanged; standard STL does not store these materials. |

The reference's persisted region/settings model, drill/finger-hole/outside-shape controls, engraving and finishing are evidenced in `app.formatted.js:86852`, `:87047`, `:87236`, `:87300`, `:87819`, `:87900` and `:88190`. Original reference output remains unverified.

## Cloud and community: implementation versus service readiness

Implemented foundations include owner-derived authorization, session-bound transport checks, OIDC Code + PKCE, memory-only tokens, owner-scoped folders, immutable history, optimistic content saves, soft deletion/restoration, licensed publication versions and attribution, private board drafts, replies, owner edits/removal, pagination and idempotent likes. Local Dexie editing remains primary.

The remaining sequence is:

1. **Preserve the draft before redirect, complete C2/C3, then run the deployed identity test.** C4 is a source-confirmed functional gap: nonblocking SDK startup does not preserve an unsaved drawing across full-page sign-in. After implementing recovery, configure frontend `VITE_CONVEX_URL`, `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`; backend issuer/audience; a registered public client and exact callback; normal Convex codegen/deployment authorization. Test the actual origin/base path, two accounts and an anonymous browser. Provider discovery/token failure, expiry, reload and sign-out must preserve local work. Memory-only tokens currently mean signing in again after reload; silent renewal is disabled.
2. **Load libraries incrementally.** Server pages exist, but the adapter immediately reads all pages/full documents, and opening the parent dialog loads the full private library plus publication lists. Add metadata-only lists, explicit paging/virtualization and fetch content on open, with stale-navigation cancellation. Server pagination alone does not bound initial client work. See [client](../src/features/editor/localdb/convex-data-client.ts#L9) and [refresh](../src/features/editor/components/CloudCommunityDialog.tsx#L46).
3. **Handle large assets.** Serialized remote records are capped at **512 KiB**; embedded images exceed this easily. Add authorized file storage, deterministic references, upload progress/retry and cleanup that respects retained revisions. Define per-account quota and snapshot retention: each revision currently retains full content.
4. **Expose recovery.** Add a paginated trash browser for existing restore APIs, explicit restore, clear retention/permanent-delete behavior and a tested backup/restore procedure. Soft deletion/history are useful recovery mechanisms; they are not a complete erasure workflow.
5. **Prepare public community operation.** Current moderation is author-controlled. Reporting, server-authorized moderator roles/audit, and write throttles should precede broad public expansion. Search, notifications, attachments and live refresh follow. Attachments depend on the asset authorization model.
6. **Split and translate the large cloud dialog.** Separate account, library/history, publishing/gallery and board navigation; preserve form/focus/pending state. The parent still has many literal English labels. Board aliases are pseudonymous, whereas publications use the identity display name; explain author visibility accurately.

Live multi-user editing/presence, membership/billing and automatic translation services are separate product work. They are not enabled by configuring the current cloud adapter. Provenance preserves known metadata and enforces known inherited licenses; it cannot prove origin if metadata is deliberately removed or content recreated.

## Persistence, release and physical validation

Whole-library export/import functions exist, but no user route calls them. Add a versioned backup UI covering projects/settings/catalog/templates, with validation and merge/replace preview. The current multi-operation import is not an atomic restore transaction; a safe UI must define rollback or transactional behavior. Per-project JSON export already exists.

CI intentionally runs lint, types, units, architecture and build without Playwright. Preserve the repository's explicit browser release gate; a manually triggered release workflow could retain artifacts without forcing every browser scenario onto each PR. All current browser projects use Chromium, including the iPhone viewport emulation. That does not verify Safari/iOS storage, downloads or WebGL.

| Acceptance surface | Required evidence before the corresponding claim |
| --- | --- |
| Recovery | Edited distinctive document → persisted snapshot → reopen → Recover/Discard/Download; malformed data retained; blocked/quota-failed stores show truthful status. |
| File fidelity | F1–F3 desired-behavior regression tests, asymmetric fixtures, source/target mm measurements, warning contract and failed/canceled import preservation. |
| Production bundle | Open built lazy File Tools, STL and Cloud chunks; exercise download and failed-load closure; preserve own document. Current built-bundle cases cover boot and one synthetic PDF import. |
| Geometry/manufacturing | Error-bound fixtures, component orientation/intersections as needed, independent slicer import, dimension/hole/clearance check, one recorded calibration print. |
| Paper patterns | 100 mm calibration, asymmetric tiled pattern and known stitch pitch; exported page dimensions plus physical measurement with browser/printer settings recorded. Existing HTML assertions do not measure paper. |
| Cloud | Exact production callback/base path; independent-account/anonymous tests for documents/folders/settings/history/drafts; stale writes/deletes/visibility; expiry/session change and asset authorization. |
| Browser/device | Desktop mouse/trackpad and keyboard; 360 px phone; real Safari/iOS storage/download/WebGL smoke where those devices are supported. |
| Reproducible release | Paired LeatherCad/Atelier revisions, clean install, recorded runtime/tool versions and artifacts tied to the release commit. |

Existing fold/drape follow-ups are recorded separately in [FOLD_DRAPE_FOLLOW_UPS.md](FOLD_DRAPE_FOLLOW_UPS.md). Their older open items need individual current-code verification before being merged into this web-parity backlog. The two documented upstream shader defects are already fixed in LeatherCad/Atelier; do not list them as local release blockers.

## jsmap: useful evidence tool, separate publication

The separate jsmap checkout remains based on `0b28735bc6974a8047a913c389139620748caf6c`, with 8 modified tracked files and 4 new files, uncommitted/unpushed. LeatherCad PR #17 does not publish them. The saved 16-suite result passes; this analysis also reran the four directly affected capture-path, selected-asset, runtime-tools and HAR-import suites successfully.

The fixes bound hashed filenames, preserve URL/hash provenance, resolve origin-aware CDN imports, allow exact hash-checked application-asset selection and support system Chromium. The original 491-request capture imports; recorded replay boots/draws four edges without runtime errors or failed requests. Selected declarations form 2,382 inspection sections, not reconstructed independent source modules.

Remaining work is a separate jsmap PR, a feature-coverage manifest, replay edge-case tests and an authorized manufacturing capture including missing dynamic assets. Each reference action should record requested/missing modules, console errors and observable output, classified as runtime-tested, code-only or blocked. Do not guess an unknown framework or claim a standalone recovered source app: the level remains **preserved-runtime / inspection-first**. Deeper source recovery is optional for improving LeatherCad.

Raw HARs contain authentication and user response data and remain outside both repositories. The checked-in diagnostic inputs/results are newly generated synthetic geometry only.

## Sequenced implementation packages

| Package | Scope / dependencies | Exit criterion |
| --- | --- | --- |
| A — Protect local work | R1/R2; project/library backup semantics. Independent of cloud setup. | Reopen recovery and truthful persistence status pass with successful, unavailable and quota-failed storage. |
| B — Repair transfer fidelity | F1/F2 first, then F3 using bounded conversion; add structured transfer results. | Widths and curve shape survive measured fixtures; every intentional loss is surfaced. |
| C — Make the interface consistent | Shared legacy-dialog semantics/validation, settings scope/registry/tabs; then wheel modes, sensitivity, tool ordering and transfer preview. | Keyboard/phone flows, persistence scope and warning-before-apply tests pass. Search/presets follow the functional work. |
| D — Make manufacturing reproducible | M1 and saved settings first; then jig drilling/finger holes/outlines. Face regions precede engraving/finishing. | Bounded dimensions, repeatable settings, preview/export agreement and independent output verification. |
| E — Complete connected workflows | C4 draft bridge depends on A; C2/C3, real setup, incremental libraries and trash; asset storage before attachments/image-heavy use. | Deployed account-isolation and conflict/recovery tests pass without disrupting local work. |
| F — Deepen the model and coverage | Native curves, shape style/locking, group hierarchy; workflow localization and broader source fixtures. | Versioned migration and edit/save/transfer coverage for each new model feature. |
| G — Production evidence | Engine pairing, built lazy paths, real-device smoke and physical calibration; run alongside the feature it validates. | Evidence is tied to the shipped commit and supports the stated workflow, rather than only a green aggregate count. |

Packages A and B can proceed independently. C consumes the warning contract from B. D has an internal geometry dependency chain; adding all its controls at once would hide that chain. E has external configuration dependencies, while its local UI/concurrency fixes can proceed immediately. F is a separate model track; it is not required to fix today's width losses or to bound legacy curve conversion.

Recommended first implementation slice: **recovery and truthful save status; LCAD/DXF width fixes; bounded legacy LCC curves; accessible numeric dialogs; adaptive STL tolerance**. Then deliver the named reference input/tool options and the next jig controls. Reorder around a specific production file if it is currently blocking work, using its minimized fixture as the acceptance case.
