# Next parity and interface priorities

Reviewed 2026-10-31 against the implemented source and the previously inspected Coffee Craft CAD web capture (build `2026-10-27`). This is the current follow-up list. Older desktop audit checkboxes are historical evidence; some unchecked entries already have working controls.

The [full remaining-work analysis](REMAINING_PARITY_ANALYSIS_2026-10-31.md) adds six focused reviews, synthetic reproductions, dependencies and completion criteria. Its confirmed recovery/fidelity findings take precedence over the earlier interface-first recommendation.

## Recovery and fidelity first

- Autosave writes snapshots, but startup recovery is not wired; success is announced without awaiting a durable write. Add recovery and truthful failure feedback before relying on autosave.
- Built-in OIDC sign-in redirects without capturing/restoring the unsaved drawing. Add a durable draft/recovery bridge before activating that flow; nonblocking SDK startup does not cover navigation.
- Synthetic checks reproduce silent LCAD stroke-width loss, DXF mixed-lineweight collision, and a legacy LCC cubic with 25 mm midpoint error. Fix these before broader format expansion. See [diagnostic results](verification/remaining-interchange-2026-10-31.json).
- STL cut arcs/quadratics use 48 segments per authored curve without a dimensional error bound. Add adaptive manufacturing tolerance before adding finishing controls.
- Add import review, aggregate expansion/byte budgets and session cancellation for pending LCAD/LCC/JSON reads. Pattern-PDF needs page selection and inference review before replacing a document.

## Interface and options

| Area | Available now | Remaining work | Evidence / classification |
| --- | --- | --- | --- |
| General Options | Titled sections for autosave, workspace, editing behaviors, dimensions, print calibration, zoom/grid, language and translation import. | Add navigable categories, search, section-level reset and explicit global/project scope. Apply named dialogs, focus trapping and consistent validation to older dialogs too. | Reference has six settings tabs; navigable categorization is source-confirmed. Search/reset are recommendations. `OptionsModal.tsx`, `ChangeShapeSizeModal.tsx`, `MandalaModal.tsx` still use older modal structure. |
| Input/display/tool options | Reverse zoom/pan, anchored wheel zoom, modifier editing, fixed tool rail and canonical mm geometry. | Wheel Auto/Zoom/Pan, trackpad sensitivity, configurable tool order, and consistent mm/inch display preference. | Confirmed reference controls and current behavior gaps. Full unit display touches formatting/input and export boundaries; keep geometry in mm. |
| Workspace layout | 2D/3D/Split modes, persisted panel widths, inspector pin/auto-hide and theme selection. | Named drafting/assembly/printing presets, a canvas-first layout, and customizable/reorderable command groups. Keep common file actions easier to reach on phones. | Product recommendations. Existing modes/resizing should not be rebuilt as “missing” features. |
| Geometry/style options | Numeric line length/angle, arc radius/sweep, curved-text controls and shared line types. | Preserve native ellipses/cubic curves where exact editing matters; add per-shape opacity/locking and nested-group fidelity; clarify what numeric edits change. | Confirmed native interchange limitations: current adapter flattens groups/ellipses and warns about opacity/shape locks. |
| STL pattern controls | Pattern/jig modes, global thickness, selected shapes, round/original stitch holes, validated output and preview. | Adaptive tolerance, persisted manufacturing settings, per-face thickness/depth/through regions; top/bottom engraving; chamfer/fillet; export-time nonround hole sizing; material/color preview choices. | Confirmed reference options plus accuracy/reproducibility work. A visible geometry control must change validated output. |
| Jig controls | Solid floor, pocket depth, outer margin and positive clearance. | Finger-hole placement/diameter; stitch-through drilling; pattern-offset vs explicit rectangular outside dimensions; richer pocket/region selection. | Confirmed reference controls; requires geometric and watertight-mesh tests. Negative clearance needs explicit interference-fit validation. |
| Import feedback | DXF units, inline errors/warnings, safe cancellation and document-preserving failures. | Preview imported pieces/layers, surface approximation/loss warnings before committing, and offer layer/style choices where appropriate. | Recommended UI improvement. Do not imply current warning-bearing imports are lossless. |
| Languages | English default; Japanese broad coverage; 18 additional core-shell dictionaries. | Translate advanced inspectors, specialist dialogs and diagnostics; add coverage tracking and native-language review. | Confirmed: Japanese has 555 entries; the 18 smaller dictionaries have 60 entries each. See `LOCALIZATION.md`. |

The interface work should keep command IDs separate from translated labels, preserve user-created names, and use the shared focus helper for new/refactored dialogs. Phone controls should retain 44px touch targets and keyboard/assistive-technology names.

## Interchange and geometry gaps

- **Sealed LCC remains unsupported.** It is rejected before changing the document. Proper support needs a supported, validated reader/version contract; inflating the payload without verifying it is not full compatibility. LCAD or SVG is the working alternative.
- **LCAD is an interchange format, not a complete backup of our model.** Native source provenance/recordings, SVG-image shapes, radius dimensions, per-shape style/locks, and nested groups still need deeper support. Our own structured community provenance survives through a versioned extension, but that does not import the reference service's provenance history.
- **Our advanced state does not all fit LCAD.** Constraints, pattern pieces, seam/assembly connections, seam allowances, hardware and some image/fold settings produce export warnings. Document JSON remains the full project backup. A transfer preview should make these losses obvious before download.
- **DXF scope is planar ASCII geometry.** Text, hatches, dimensions, attributes, meshes/solids and unsupported external references are not converted; nonplanar entities are skipped. Splines/ellipses are approximated with reported tolerance. See `DXF_IMPORT.md`.
- **Broader cross-app fixtures are still valuable.** Add curved and asymmetric parts, linked stitch runs, text/fonts, calibrated images, grouping and physical print measurements. Four-edge rectangle interoperability proves the basic path, not complete file parity.

## Cloud and community gaps

1. **Activate a real deployment and sign-in provider.** Configure Convex, the OIDC authority/client, exact registered redirect URI and matching backend issuer/audience; regenerate Convex types and exercise actual multi-account behavior. The backend and OIDC code are implemented, but no live service or account was configured in this work.
2. **Handle larger drawings and embedded images.** Current remote serialized records are capped at 512 KiB. Move large assets to owner-authorized file storage with upload/progress/retry and size-aware UI.
3. **Complete library UX.** Add a trash browser for the existing restoration capability, clearer sync/conflict recovery, and operational backup/recovery workflows.
4. **Expand community UX where needed.** Attachments, administrator moderation/reporting, notifications, search and automatic live refresh are absent. The implemented board already has topics, private drafts, replies, likes, owner edits/removals, pagination and stale-edit protection.
5. **Treat live collaboration separately.** Concurrent multi-user editing, presence and automatic translation services were not implemented. Billing/membership parity was also outside this pass.

The deeper review also found that the current save button always creates a new cloud copy: updating an existing drawing needs UI association with its remote ID/revision. Delete and visibility actions need stale-revision checks. Client listing eagerly consumes every server page/full document; add incremental metadata loading. Public expansion additionally needs moderation/reporting, quotas and resource policies. These are implementation gaps distinct from configuring a deployment.

## Existing functionality that should not be listed as missing

- Mandala UI already has selection-based centers, rotation, intersection controls and help hooks. Verify behavior/controller wiring for a specific discrepancy instead of reusing the old blanket backlog item.
- Pricking-iron controls already expose group/name editing and preset saving. A remaining even-hole-count operation still uses a browser prompt; replace individual prompt-driven flows with forms when polishing that workflow.
- Sidebar pin/auto-hide, basic print calibration, SVG import scale/grouping and catalog editing already exist. The next step is a behavior/visual parity review, not duplicate controls.

## Recommended next implementation order

1. **Protect and preserve work:** recovery, truthful save status, width/legacy-curve fixes, import review and bounds.
2. **Interface/options pass:** consistent dialogs/validation, settings tabs/scope, wheel/trackpad controls and tool ordering. Search and workspace presets follow.
3. **Manufacturing accuracy and jig options:** adaptive tolerance and persisted settings, then drilling/finger holes/outlines; per-face depths precede engraving/finishing.
4. **Cloud workflow and activation:** update/conflict UI, stale-action checks, incremental loading, real account/deployment tests and image-capable storage.
5. **Exact model fidelity and localization depth:** native curves/style/hierarchy, richer cross-app fixtures and specialist translations.

Record the compatible Atelier revision for releases and verify the built lazy workflows, real supported devices and physical print/fit. Passing Chromium viewport tests do not establish Safari/iOS or physical manufacturing performance.

Reorder exact interchange first if a specific production file is currently blocked. Local verification at this handoff is 1,025 unit tests and 28 cold-cache browser tests passing; live cloud/provider validation remains separate.
