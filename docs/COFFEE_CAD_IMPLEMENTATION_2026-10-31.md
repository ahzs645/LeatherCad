# Coffee Craft CAD follow-up implementation

This implements the remediation work from the [comparison audit](COFFEE_CAD_COMPARISON_2026-10-31.md). Six agents worked on interchange, DXF, STL, localization, cloud/community, and jsmap, followed by independent reviews and integration checks. This report records the implementation-time checks. The LeatherCad source and portable verification summary are included in this branch; the separate jsmap source remains in its own checkout. No cloud deployment was performed.

## File interchange and manufacturing

- Native web `.lcad` import/export now maps geometry, layers, styles/palettes, groups, dimensions, stitch runs and embedded tracing. The actual rectangle created in the captured reference imports and round-trips as four correctly positioned edges. Adaptive curve conversion reports its approximation; unsupported geometry rejects the entire import before replacing the document.
- Sealed LCC containers now reject before their compatibility artwork can be mistaken for a drawing. Their signatures are not verified by this implementation, so their payloads are not imported. Use the original application's LCAD or SVG export. Plain legacy LCC remains supported. Attributed documents cannot be exported through a legacy format that would drop their provenance.
- ASCII DXF import supports lines, circular arcs/circles, classic/LW polylines with bulges, nested block transforms, splines and ellipses, source layers/styles, and file-unit overrides. Approximations and unsupported/nonplanar entities are reported. Parsing finishes before document mutation; pending imports cancel when the dialog or editing session changes. See [DXF_IMPORT.md](DXF_IMPORT.md).
- STL export creates flat patterns or stepped positioning jigs in millimetres, including nested cutouts and round/original stitch holes. Mesh generation checks watertight topology and outward faces; open/self-crossing boundaries and invalid hole intersections fail clearly. The lazily loaded 3D preview shows the generated mesh. Engraving, bevels, fillets and jig finger holes are not implemented.

Desktop actions are on the **Output** ribbon: **DXF In**, **Save LCAD**, **STL / Jig**, **Cloud**, and **File Tools**. The Export Center also offers LCAD and STL. Phone access is through **Options → File → File tools → Apply**.

## Language and interface behavior

The interface has persistent selection for 20 locales. English is the source language, Japanese has broad shell/main-dialog coverage, and 18 additional languages cover the core shell with English fallback for detail controls. Imported TSV/JSON translations still override bundled text and update live. This is not a claim that all 20 languages cover every message. Coverage is recorded in [LOCALIZATION.md](LOCALIZATION.md).

Desktop import/export feedback is now visible in the status bar. New interchange dialogs support initial focus, Tab trapping, Escape and launcher-focus restoration. Phone controls have 44px minimum heights. Pending lazy loads can be closed; failed loads offer a safe close path without forcing a reload of an unsaved drawing.

The stitch test was strengthened with stable IDs and observable state assertions, then a final parallel run established the underlying intermittent failure: Vite discovered linked-engine lazy dependencies and reloaded an already edited document. Explicit startup dependency optimization now prevents that late discovery. The fix is checked with a cold-cache parallel browser run, without sleeps, retries or timeout increases. See [STITCH_BROWSER_RELIABILITY.md](STITCH_BROWSER_RELIABILITY.md).

## Optional cloud and community

The previous throw-only Convex adapter is replaced by a real client and deployable backend, with source-owned UI:

- Private drawing/settings/repository storage, explicit non-overwriting local uploads, revision-based write conflicts and separate local copies.
- Owner-scoped folders, cycle/depth guards and immutable drawing history; restoration creates a new revision. See [CLOUD_WORKSPACE.md](CLOUD_WORKSPACE.md).
- Public/private pattern publishing, immutable published versions, author/license attribution and structured derivative provenance through file saves, editor state and undo/redo. Known inherited licenses cannot be weakened during republishing.
- A public discussion board with authenticated topics, replies and likes; private drafts, owner editing/removal, pagination, content revision checks and idempotent reactions. See [COMMUNITY_BOARD.md](COMMUNITY_BOARD.md).
- Configurable OIDC Authorization Code + PKCE sign-in using an established SDK. Tokens stay in memory; the protocol's temporary redirect state uses session storage. Local drafting starts independently of authentication availability. Existing trusted-host authentication integrations remain supported. See [OIDC_CLOUD_AUTH.md](OIDC_CLOUD_AUTH.md).

Independent review found and corrected private historical-version exposure, stale-write token handling, account-switch caches and late responses, unstable shape IDs, truncated credits, malformed documents, and attribution/provenance loss. Backend checks derive ownership from verified server identity, not client-supplied owner fields.

**Activation remains external setup:** no Convex deployment, OIDC issuer or registered client is configured in this workspace. Live sign-in and deployed access have not been verified. Missing configuration leaves the local editor available and cloud UI explicit about availability. Setup and limits are in [CLOUD_COMMUNITY.md](CLOUD_COMMUNITY.md). Large embedded-image drawings remain local when they exceed the documented remote payload limit; billing, automatic translation services and live collaboration are outside this implementation.

## jsmap fixes

Changes are in [/workspace/scratch/jsmap](/workspace/scratch/jsmap), based on commit `0b28735bc6974a8047a913c389139620748caf6c`:

1. Deterministic bounded filenames for long, Unicode and deep URL paths, retaining URL/hash provenance.
2. Origin-aware root-relative CDN module resolution in the generated replay harness.
3. Exact opt-in `--include-captured-asset` analysis selection with hashes, keeping authentication/user-data replay metadata out of source promotion.
4. A system-Chromium executable override for browser verification.

The original 491-request HAR and the minimal long-path reproducer now import. The captured editor boots and draws four rectangle edges without the prior import-map workaround, runtime errors or failed requests. The selected CAD bundle yields 2,382 inspection sections. **Recovery remains `preserved-runtime` / `inspection-first`; this is not a recovered standalone source application.** Uncaptured optional modules remain capture gaps.

Sixteen jsmap regression suites pass. Evidence: [test results](/workspace/scratch/leathercad-comparison/jsmap-fix-tests/results-final.json), [browser check](/workspace/scratch/leathercad-comparison/jsmap-fixed-browser.json), [asset selection provenance](/workspace/scratch/leathercad-comparison/fixed-selected-recovery/recovery/APP_ASSET_SELECTION.json). Raw HARs and captured response bodies remain outside both source repositories.

## Integration verification

| Check | Final result |
| --- | --- |
| LeatherCad unit suite | **1,025 passed**, 143 test files. |
| Cold-cache browser suite | **28 passed**, two parallel workers; desktop, production build, tablet and phone. |
| Frontend and Convex backend TypeScript | Passed. |
| ESLint and architecture guardrails | Passed. |
| Production build | Passed; existing chunk-size warnings remain. |
| jsmap regression suites | **16 passed**. |
| Live deployment / provider sign-in | Not performed; configuration is absent. |

The browser checks include native import/export preservation, safe sealed rejection, DXF appending, STL pattern/jig dimensions/download and rendered previews, tool-load failure recovery, language persistence, and phone focus/touch behavior. Geometry and backend tests exercise real implementations rather than only UI stubs. No failing cases were skipped and no test retry was used to obtain the cold-cache result.

Verification ran on Node 24.19.0 with the installed system Chromium. The host's pnpm wrapper reported ignored native build scripts, so checks used the installed tools' direct Node entrypoints and a reusable Playwright configuration with equivalent dev/preview commands. The cold run used a fresh `VITE_CACHE_DIR`; the developer's existing cache was retained.

Evidence: [verification summary](verification/coffee-cad-2026-10-31.json), [unit log](/workspace/scratch/leathercad-comparison/final-unit-tests.log), [cold-cache browser log](/workspace/scratch/leathercad-comparison/final-cold-browser-tests.log), [ESLint log](/workspace/scratch/leathercad-comparison/final-lint.log), [optimizer diagnosis](/workspace/scratch/leathercad-comparison/vite-optimizer-diagnosis.json).

Rendered outputs: [40 × 20 × 2 mm pattern preview](verification/stl-pattern-preview.png), [50 × 30 × 5 mm jig preview](verification/stl-jig-preview.png).

Current interoperability evidence: [interoperability-results.json](/workspace/scratch/leathercad-comparison/interoperability-results.json). The original failed-import evidence is preserved separately as [interoperability-baseline-results.json](/workspace/scratch/leathercad-comparison/interoperability-baseline-results.json).

Source review snapshots: [LeatherCad patch](/workspace/scratch/leathercad-comparison/leathercad-parity.patch), [jsmap patch](/workspace/scratch/leathercad-comparison/jsmap-fixes.patch). These are local implementation snapshots. LeatherCad source publication is separate from jsmap, and neither operation activates a cloud deployment.

Current follow-up work is prioritized in [NEXT_PARITY_PRIORITIES.md](NEXT_PARITY_PRIORITIES.md). Links beginning with `/workspace/` refer to retained local evidence and are not files hosted by GitHub; raw captures and authenticated responses are not included in the repository.
