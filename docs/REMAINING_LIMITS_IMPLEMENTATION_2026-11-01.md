# Further work on the documented remaining limits

**Current product direction:** [local-first, no Convex](LOCAL_FIRST_WORKFLOW.md). The cloud investigation below records earlier optional work; activation is deferred and does not block the current CAD workflow.

This pass continues the source at `a703237` from the [earlier follow-up report](FOLLOWUP_IMPLEMENTATION_2026-10-31.md). The comparison's raw HAR and account data remain outside both repositories. The table separates implemented software from acceptance that requires a configured service, specialist review or physical equipment.

| Area | Result | Acceptance still needed |
| --- | --- | --- |
| Paper output | Physical tile planning, exact US Letter dimensions, consistent overlap, calibrated portrait/landscape geometry and a printable calibration kit. | Measured output from the actual printer/driver/paper. |
| Browser coverage | A repeatable Linux WebKit gate adds a second browser engine, desktop and phone touch flows. | Real Safari/iOS storage, Files, GPU and background/foreground checks. |
| Sealed LCC | Read-only compatibility for the observed v1 format, with verification before decompression/import and normal file review. | Unknown container/reader versions and payload features outside the documented supported subset. |
| Native constraints | Analytic curve directions, lengths, tangency and dimension bindings with measured residuals and lock checks. | Product integration of the optional constraint/dimension engine; it currently has no production callers. |
| Manufacturing | Solid geometry operations extend supported finishing combinations; explicit geometric/resource guards remain. | Intended slicer inspection and physical clearance measurements. |
| Localization | Expanded recovery, native geometry/protection and specialist controls; Japanese print/manufacturing workflows are wired and inventoried. | Remaining workflow translations and native-language technical review. |
| Cloud | Inactive provider-specific source and readiness tooling. | Deferred by product direction; no Convex setup is required for the current local-first workflow. |
| jsmap | Published in [draft PR #6](https://github.com/ahzs645/jsmap/pull/6), commit `d7b953fe4c98db6d22d2a4d5ca1d54d055fdb613`; clean install, 17 suites, lint and build passed, with [CI green](https://github.com/ahzs645/jsmap/actions/runs/41254938916). | Preserved-runtime replay is not recovered standalone source; uncaptured modules remain missing. |

## Paper and device acceptance

Print planning previously mixed viewport padding and bounds fitting with requested physical scale. It now uses paper size, margins and scale directly. Tiling and calibration must be tested together: applying calibration independently inside old tiles can leave gaps or change shared overlap. The same geometry must drive the preview, exported printable window and calibration kit.

The [physical/device walkthrough](PHYSICAL_DEVICE_ACCEPTANCE.md) links editable drawings, A4/Letter PDFs and printable HTML. A second matrix under its `automated/` fixture directory intentionally applies unequal calibration in portrait and landscape. It is for digital regression checks; use the parent directory's 100% sheets to calibrate a printer. Independent `pypdf` checks measure actual PDF path coordinates, and browser checks measure rendered axes, pitch and shared overlaps.

The live Print action is tested through its popup, including populated content and a detached editor opener. The release workflow also runs the WebKit gate. Linux WebKit is a useful browser-engine check; it does not emulate the iOS operating system, physical GPU, storage eviction or print/download destinations.

## Geometry and file compatibility

[Native constraint semantics](NATIVE_CONSTRAINTS.md) define chord/axis direction, true curve length and endpoint tangency. Solver results include complete analytic shape updates. Final residual checks prevent an intermediate projection from being reported as convergence. Locks, ambiguous geometry, impossible collapse and nonconvergent combinations remain explicit. These API tests do not establish a new UI workflow.

The [manufacturing guide](MANUFACTURING_EXPORT.md) documents the supported finishing combinations and their limits. Final manifold/winding/volume checks and independent mesh readers remain necessary after solid operations. Preview materials do not change STL geometry.

The portable [profile verifier](../scripts/verify-manufacturing-profile.mjs) and [numerical evidence](verification/manufacturing-profile-2026-11-01.json) cover 438 evaluations at 310 distinct locations for each finish. At a 0.01mm profile/cutter tolerance, the largest sampled normal errors are 0.003805mm for chamfers and 0.006786mm for fillets. The formerly failing nested-cutout/three-height exports are closed, consistently oriented positive-volume solids. These sampled checks do not establish every point on every possible model or physical printer performance. The [separate fit-gauge workflow](PRINTER_FIT_CALIBRATION.md) provides nominal bores, pocket clearances, plug/pin and a measurement checklist.

Sealed LCC format integrity does not establish authorship, a license or trusted provenance. A globally shipped file-format parameter is separate from user/session credentials. The reader must preserve supported content or reject unsupported records before changing the drawing; a successful MAC never grants additional product permissions. Unknown versions remain outside the tested compatibility contract.

[Sealed compatibility](SEALED_LCC_COMPATIBILITY.md) includes supported v4.2 groups, styles, embedded tracing and linear dimensions. Linear dimensions become reviewed detached annotations; live source associations are not recreated. Radius dimensions, unsupported record types and unpreservable licensed-part provenance reject explicitly. Corrupted files retain the current drawing. Legacy dimension reconstruction has its own 2,048-candidate budget in addition to the shared file/geometry limits.

## Localization coverage

The final static inventory contains 1,002 used keys. Japanese has 914 dictionary entries and resolves 766 inventoried keys, including all 109 inventoried manufacturing controls, 49 print controls and 42 geometry-dialog keys. Recovery decisions/actions and native curve controls are covered in all 19 non-English locales. The [specialist verification](verification/specialist-localization.json) includes Japanese/German phone expansion, preserved numeric/model values and live font-error translation.

These counts do not measure language quality or complete product coverage. The downloaded physical measurement checklist remains English. Deeper community/moderation/diagnostic copy, specialist guidance in the 18 smaller dictionaries, unwired/dynamic copy and native expert review remain documented in [LOCALIZATION.md](LOCALIZATION.md).

## Optional cloud implementation (deferred)

The earlier investigation found no configured secrets, outbound identities or selected Convex/OIDC project. The [activation guide](CLOUD_ACTIVATION.md) and [redacted readiness result](verification/cloud-runtime-readiness.json) record that optional configuration state. The subsequent direction is to use no Convex, so those setup items are deferred. No backend was deployed, account registered or interactive login started. Local protocol tests verify the existing tooling; they are not live-provider acceptance.

Read-only checks run only against configured origins. The mutation smoke additionally requires two distinct test identities, an explicit flag and pinned origin; it creates and cleans uniquely marked test resources and reports incomplete cleanup. Retired publication metadata remains by product design. Real callback registration, token expiry, browser CORS, account isolation and unsaved-draft redirects require the selected service and real browser flow.

## Verification

Final source-freeze checks on November 1 passed:

| Check | Result |
| --- | --- |
| Vitest | 1,352 tests / 187 files |
| Chromium | 61 cases: development, production bundle, tablet and phone |
| Linux WebKit | 26 cases: desktop and phone touch descriptors |
| `/LeatherCad/` production build | 9 worker, WASM, PDF, popup and recovery cases |
| Cloud activation protocol | 11 local transport/configuration tests |
| TypeScript / ESLint / architecture / engine pair | Passed; backend types included |
| PDF measurements | 8 generated PDFs / 14 pages, independently parsed with pypdf 6.10.0 |
| Combined STL rereads | 7 outputs checked independently with trimesh 5.2.0 |
| Localization | Required-key and placeholder audit passed |

Browser runs used fresh dependency caches and zero retries. Local Node was 24.19.0, Chromium 154.0.8037.57 and Playwright WebKit 26.4. The normal CI checks target Node 22. The [machine-readable result](verification/remaining-limits-2026-11-01.json) records the scope and environment details.

The integration run also verifies that unread-store notices remain below import modals while preserving recovery protections, and that a missing lazy modelling module produces an actionable error without masking geometry errors. Production-origin/base-path tests exercise actual file/calibration workers and WASM assets.

Physical printer/device measurements and native-language specialist review remain unperformed. Hosted cloud acceptance is deferred under the local-first direction. The optional native constraint engine still needs its own persistent product UI; unsupported sealed payloads and geometric/resource limits remain explicit in the linked guides.
