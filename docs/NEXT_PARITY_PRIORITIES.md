# Current follow-up priorities

The recovery/fidelity/interface/manufacturing/cloud implementation from the [remaining-work analysis](REMAINING_PARITY_ANALYSIS_2026-10-31.md) has been worked through. Read the [follow-up implementation report](FOLLOWUP_IMPLEMENTATION_2026-10-31.md) for shipped behavior and verification. The older comparison and unchecked desktop lists are historical evidence, not a current missing-feature inventory.

## Completed in source

- Acknowledged autosave, startup recovery/download/discard, unread-store handling, sign-in draft preservation and backup/restore UI.
- LCAD palette/shape widths, DXF weights and default Y-axis orientation; exact native cubic/ellipse models and legacy LCC cubic controls.
- Import workers/budgets, preflight/layer selection, export loss review and explicit document-session cancellation.
- Settings categories/search/scoped reset, consistent dialogs, wheel/trackpad options, tool ordering, canvas-first presets, phone shortcuts and nested groups.
- Physical STL tolerance, saved settings/fonts, jig outlines/drilling/finger holes, face depths/through cuts, engraving and supported edge finishing.
- Cloud update/save-as-copy, stale-action checks, incremental lists, Trash/purge, image/font storage, quotas, publication retirement, board image attachments, moderation, search and notifications.
- Pinned engine pairing, built-bundle browser checks, independent DXF/PDF/mesh validation and localization inventory.

## Next acceptance work

| Priority | Work | Completion criterion |
| --- | --- | --- |
| P0 for service activation | Configure an actual Convex deployment and registered OIDC client. | Normal codegen/deployment; production-origin callback, expiry and network failure; independent users/anonymous access checks; confirmed draft preservation through real redirects. Follow [the runbook](CLOUD_DEPLOYMENT_RUNBOOK.md). |
| P1 for physical production | Validate paper output and printed tool fit. | Measure a 100mm calibration sheet, tiled asymmetric pattern and known stitch pitch; inspect STL in the intended slicer and measure a printed clearance fixture. Existing automated geometry checks are not physical measurements. |
| P1 for supported devices | Exercise real Safari/iOS storage, download, touch and WebGL. | A device walkthrough using recovery, file review, 2D/3D routes and downloads. Chromium phone emulation establishes a different test surface. |
| P2 | Complete specialist localization by workflow. | Use [the inventory](verification/localization-coverage.json), translate used labels/accessibility/errors, test layout expansion and obtain native-language review. Shared-core checks pass in all 20 locales; the 18 smaller dictionaries still use English fallback outside that core. |
| P2 | Extend supported native constraints and manufacturing combinations where designs require them. | Measured native-curve constraints and topology-safe finishing across engraving/unequal depths/jigs. Current unsupported combinations reject explicitly. |
| P2 | Broaden reference-and-LeatherCad behavioral fixtures. | Matched asymmetric curves, stitches, images, dimensions and physical outputs; classify evidence as runtime-tested, code-only or blocked. Complete the missing reference STL asset capture if available. |

## Explicit format and product boundaries

- Sealed LCC requires a supported signature/version reader; it remains rejected before document mutation. LCAD, SVG or a compatible plain LCC export is the available route.
- Partial ellipses use a warned bounded fallback in LCAD. JSON and modern DXF retain their analytic parameters. General rational/multispan DXF splines have a reported approximation target; unsupported binary/3D/text/hatch entities remain documented in [DXF_IMPORT.md](DXF_IMPORT.md).
- LCAD/legacy LCC do not preserve all LeatherCad manufacturing/assembly/project state. Loss review recommends JSON for the complete project.
- Finishing currently supports uniform-thickness patterns without engraving. The UI explains unsupported combinations; it does not emit a misleading mesh.
- Whole-library database restore is transactional, while database plus browser preferences cannot be made crash-atomic across two stores. Keep a prior backup until checking restoration.
- Live collaboration, billing/membership and account-wide erasure are separate product work. Retained immutable publication credits can eventually require the documented operator allowance/recovery path.

Reference-only controls such as pen-lift guard, loupe/modifier-pad behavior, recording/grant UI and every adjustable picking variant still need a focused behavior mapping before adding controls. LeatherCad already has snap indicators, coarse-pointer picking, existing AI/automation surfaces, print calibration, Mandala controls and pricking-iron groups/presets; do not rebuild them from stale checkboxes.

The separate jsmap fixes and coverage tooling remain in their own checkout. They do not turn the preserved captured runtime into a recovered standalone source application.
