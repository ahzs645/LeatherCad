# LeatherCad follow-up implementation

This report records the October 31 implementation and its verification. The [November remaining-limits follow-up](REMAINING_LIMITS_IMPLEMENTATION_2026-11-01.md) supersedes its sealed-format, printing, localization and manufacturing boundaries with subsequent tested work.

This implements the recovery, fidelity, interface, manufacturing and connected-workflow changes identified in the [remaining-work analysis](REMAINING_PARITY_ANALYSIS_2026-10-31.md). Six agents implemented separate tracks, then reviewed other tracks and resolved integration failures. The reference informed behavior and interface organization; captured application code and authenticated responses are not included in this repository.

## Interface lessons applied

The reference makes common tools easy to find and leaves a large drawing surface. LeatherCad now applies those ideas while retaining its document browser, assembly tools and 3D workspace:

- **Searchable settings categories:** Workspace, Input, Drawing, Stitching, Output / Print and Language. Scope labels explain where preferences live. Category reset is disabled during a global search so it cannot reset unrelated hidden settings.
- **Canvas-first and named workspace presets:** a compact layout can hide the ribbon/browser/inspector without changing the drawing. Panel layouts and modes remain configurable. The reviewed 1600 × 1000 canvas-first screenshot gives the main surface 1498 × 915 pixels.
- **Input choices:** Auto/Zoom/Pan wheel behavior, smooth trackpad sensitivity, persistent tool order/labels and configurable edge-pick ranges. Existing modifier editing remains available.
- **Direct phone actions:** Open, Save, Export and File tools have named buttons with 44px touch targets. Options retains safe scrolling and no horizontal overflow at a 390px viewport.
- **Consistent dialogs:** Options, Mandala and Change Shape Size have named modal semantics, focus management and numeric feedback. Legacy length controls use existing mm/inch preferences while storing geometry in millimetres. Even-hole-count entry uses a validated form.
- **Useful context:** the inspector exposes native curve parameters and protection/opacity; empty selections no longer show a large disabled context-action grid. Sketch groups form an actual expandable hierarchy with inherited visibility/lock indications.

Screenshots: [canvas first](verification/interface-canvas-first-2026-10-31.png), [desktop Options](verification/interface-options-2026-10-31.png), [phone Options](verification/interface-options-phone-2026-10-31.png), [phone actions](verification/interface-phone-actions-2026-10-31.png), [native inspector](verification/interface-native-inspector-2026-10-31.png). See [INTERFACE_OPTIONS.md](INTERFACE_OPTIONS.md) for controls and persistence.

This pass also corrected a preference-save bug: changing one option used to write unrelated defaults over previously saved options. Partial updates and scoped resets now preserve unrelated preferences.

## Recovery and protection of work

Autosave now waits for a durable acknowledgement before announcing success. Startup offers Recover, Download or Discard; malformed snapshots remain downloadable. Pending recovery prevents a new timer from replacing an unread previous draft. A blocked database is distinguished from an empty store, with retry and explicit recovery choices. Exit flushing protects recent edits when autosave is enabled.

Built-in OIDC sign-in first preserves the latest drawing and local-project identity, even when periodic autosave is disabled. Failure to preserve the draft prevents navigation. Callback success/failure/reload can restore the bridge draft. This is locally tested; actual provider configuration remains external.

New runtime document-session identities distinguish replacement/reset from ordinary edits or background normalization. Pending imports and STL work cannot apply to a replacement document. Late cloud copies are canceled and rolled back after closure, account change or newer document work. Local library backup/restore is available through File tools; database restoration is transactional, while browser-preference rollback has explicitly documented cross-store crash limits.

Shape, group and layer locks protect editing and associated stitch chains. Opacity and hierarchy survive JSON/LCAD roundtrips. Document loading and undo use explicit replacement paths, so locks do not prevent restoration.

See [DRAFT_RECOVERY.md](DRAFT_RECOVERY.md), [OIDC_CLOUD_AUTH.md](OIDC_CLOUD_AUTH.md), and [release/backup guidance](RELEASE_VERIFICATION.md).

## Geometry and interchange

- **Widths:** LCAD preserves palette defaults and shape overrides independently; DXF retains distinct effective weights. A synthetic 0.25/0.8mm pair remains distinct. Explicit zero values retain their semantics.
- **Native curves:** cubic Bézier controls and ellipse centre/radii/rotation/sweep are editable analytic data. Drawing, transforms, selection, clipboard, grading, history and supported constraints preserve primitive identity. Native SVG paths, LCAD and modern DXF use the appropriate analytic representation. Unsupported operations deliberately convert with a stated tolerance or reject; they do not treat new curves as text.
- **Legacy LCC:** explicit cubic controls now import as one exact cubic. The original diagnostic midpoint is correctly `(50,75)`, rather than `(50,50)`. Golden fixture shape counts remain unchanged. The writer degree-elevates quadratics correctly.
- **Preflight:** drawing imports show size, units, content/loss warnings and a preview before replacement. DXF offers layer selection before one append action. Loss-bearing LCAD/LCC/DXF exports expose warnings before download. Cancel preserves the drawing.
- **Bounded parsing:** JSON/LCAD/LCC/DXF heavy parsing runs in cancellable workers. Byte, expanded geometry, nested path, image and entity budgets prevent unbounded expansion. SVG receives aggregate limits too.
- **DXF interoperability:** modern records include required subclass/ownership/table structure, real layer names and Unicode escaping. R2004 carries RGB and supported lineweights; nonstandard widths round to a legal value with a warning. The UI defaults to CAD Y-up coordinates, fixing a default export/reimport mirror; the explicit low-level coordinate option remains available.
- **Pattern PDFs:** page scanning/selection and inference review replace first-page-only immediate application. The maker can inspect physical pitch and uncertainty and remove inferred stitching/folds before confirming.

Independent `ezdxf` and `pypdf` checks complement our adapter tests: R12/R14/R2004 exports open without audit repairs, native modern curves retain their parameters, and PDF cubic commands/alpha states are readable. See [DXF_IMPORT.md](DXF_IMPORT.md), [NATIVE_CURVE_EDITING.md](NATIVE_CURVE_EDITING.md), and [INTERCHANGE_RELIABILITY.md](INTERCHANGE_RELIABILITY.md).

Portable file-reader results: [native-independent-2026-10-31.json](verification/native-independent-2026-10-31.json).

## Manufacturing

STL generation now runs in a cancelable worker with an explicit physical curve tolerance and bounded vertex/triangle budgets. Settings and an uploaded engraving font can be saved with the document and reopened. The preview and download use the same generated mesh.

Implemented controls include:

- Rectangular margin, explicit W × H and pattern-offset jig outlines; signed clearance with containment/wall validation.
- Stitch-through drilling, finger holes, round/original stitch holes, independent nonround sizing and target line roles.
- Selectable face heights and through regions, with shared boundary meshing.
- Uploaded-font top/bottom engraving with depth and clipping/omission diagnostics.
- Real chamfer/fillet geometry and renderer material/color controls. Appearance choices leave STL bytes unchanged.

Mesh checks now include component orientation and vertex links in addition to edge pairing and finite/nondegenerate triangles. Independent mesh/section checks exercised seven exports, including the intended top/bottom engraving slices. Physical print fit is not established by these checks.

Cross-review fixed holes wrongly rejected inside removed material, stale face controls, long font-name failures, silent off-material engraving, inherited settings after document replacement and unnecessary worker restarts on unrelated parent renders. Impossible or unsupported combinations reject with guidance. Finishing currently requires a uniform-thickness pattern without engraving; jig/variable-depth/engraving combinations with finishing are not silently approximated.

See [MANUFACTURING_EXPORT.md](MANUFACTURING_EXPORT.md) and [mesh evidence](verification/manufacturing-mesh-validation-2026-10-31.json).

## Cloud and community

The optional service now has explicit Save new copy / Update selected drawing, revision-aware rename/delete, paged metadata listings, history, Trash, restore and owner/revision-protected permanent purge. Large drawing images/fonts use authorized storage rather than embedded remote record payloads.

Uploads use an authenticated HTTP endpoint that bounds and validates bytes, MIME signatures and hashes **before storage**. An unrestricted storage-upload capability is not exposed. Reservation leases, deduplication, retries and cleanup are tested. Logical JSON accounting covers private drawings/history/settings, publication content/credits and board content, with a default 128MiB allowance and 256-drawing limit. Separate file quotas and retained revision policies apply. Legacy accounting has bounded resumable phases.

Community features include image attachments with upload progress/retry, private-draft/current-parent access checks, reporting, server-authorized moderation and audit, indexed search, notifications and refresh. Owner-controlled publication retirement removes downloadable payloads/assets while retaining licensing/provenance metadata. Existing distributed copies retain their licenses.

Independent review resolved quota bypasses, dedup retry starvation, full-budget deletion/history failures, uncharged metadata, and late copy application. These are backend/transport/component test results; no real deployment, provider registration or live multi-account service was configured here.

Activation, exact environment values, moderator configuration, HTTP origins, backup/retention and operator recovery are in [CLOUD_DEPLOYMENT_RUNBOOK.md](CLOUD_DEPLOYMENT_RUNBOOK.md). Live collaboration, billing and account-wide erasure are separate product work.

## Integration failures resolved

The browser suite exposed a real ordering bug: an automatic preset queued its React document update, a newer file read began, and the older update then committed and canceled that read. A trace established the order. The async preset/project application now commits atomically before another file event can begin; intent priority and explicit session checks remain. The same four production manufacturing flows then passed together without retries or timeout increases. Import review also uses a portal so it appears and receives focus above an already open STL dialog.

The previous [Vite optimizer reload fix](STITCH_BROWSER_RELIABILITY.md) remains in place. Cold-cache parallel testing is still part of the integration gate.

## Verification and remaining boundaries

Final consolidated results are recorded in [follow-up verification](verification/followup-2026-10-31.json). This includes unit/type/lint/build/browser outcomes and independent file/mesh checks; individual agent counts overlap and must not be summed.

| Final local gate | Result |
| --- | --- |
| Unit tests | 1,220 passed across 178 files. |
| Fresh-cache browser suite | 47 passed, two workers, no retries. |
| `/LeatherCad/` production-path checks | Four passed. Preview now receives the same base path as the built app. |
| Frontend/backend TypeScript, ESLint, architecture and engine pairing | Passed. |
| Production build | Passed; existing chunk-size warnings remain. |
| Shared localization core | Passed for all 20 locales. |
| Separate jsmap regressions | 17 suites passed. |

These local gates used Node 24.19.0 and system Chromium. The repository's Node 22 CI remains a separate check on the published branch. No failing case was skipped to obtain the final browser result.

Remaining boundaries:

1. Live Convex/OIDC activation, exact production-origin callback and deployed account-isolation checks require real service configuration.
2. Paper calibration, printer fit/clearance and real supported-device Safari/iOS behavior require those devices/equipment. Chromium phone emulation does not establish them.
3. Sealed LCC decoding still needs a supported verifiable reader contract. Partial ellipses use a warned LCAD fallback; JSON and modern DXF preserve their analytic parameters. General DXF spline approximation and supported-entity limits are documented.
4. Native directional/tangent and ellipse-dimension engine combinations now have measured acceptance cases; these APIs have no production interface callers. Ambiguous or nonconvergent relations still reject. See [NATIVE_CONSTRAINTS.md](NATIVE_CONSTRAINTS.md). Some finishing combinations remain unsupported.
5. Localization has a used-key inventory and a passing shared-core check for all 20 locales; specialist coverage remains uneven. Japanese is broader; the other 18 dictionaries cover the core shell with English fallback. Native-language review is still needed. See [LOCALIZATION.md](LOCALIZATION.md).
6. Reference behavior blocked by uncaptured dynamic assets is still code/UI evidence. jsmap remains an inspection/replay tool; separate jsmap improvements pass 17 suites and remain in their own checkout.

Raw captures, authenticated responses, credentials and private cloud records are excluded. The screenshots, fixtures and reproduction results checked in here use authored synthetic drawings.
