# Current follow-up priorities

The remaining limits from the previous implementation have been worked through in the [November follow-up report](REMAINING_LIMITS_IMPLEMENTATION_2026-11-01.md). Read that report and the linked format/manufacturing guides for tested support. The older comparison and unchecked desktop lists are historical evidence, not a current missing-feature inventory.

The current product direction is [local-first](LOCAL_FIRST_WORKFLOW.md), with no Convex deployment selected. Hosted sync, accounts and community activation are deferred; cloud configuration is not a release prerequisite for the CAD editor. A future hosted service would need a separate backend choice.

## Implemented software

- Acknowledged autosave, startup recovery/download/discard, unread-store handling, sign-in draft preservation and transactional database backup/restore UI.
- Exact native cubic/ellipse models and editing, LCAD/legacy LCC fidelity, modern DXF structure, bounded import workers, staged reviews, layer selection and export loss warnings.
- Verified read-only compatibility for the observed sealed LCC v1 subset. Unknown versions and unrepresentable content remain explicit errors.
- Settings categories/search/scoped reset, wheel/trackpad and tool options, workspace presets, phone shortcuts, nested groups and lock/opacity controls.
- Correct physical print scale, calibrated portrait/landscape tiling, constant physical overlap, guarded populated print popups and a reproducible calibration kit.
- Saved manufacturing settings/fonts, jigs, drilling/finger holes, per-face depth/through cuts, engraving and expanded finishing support with geometric checks.
- Analytic native constraint/dimension engine combinations, complete shape updates, locks and measured final residuals. This engine still needs product UI integration.
- Inactive optional cloud ownership/revision/quota/asset/community workflows and provider-specific readiness tooling, outside the current local-first acceptance scope.
- Expanded specialist translations, placeholder/workflow audits, Linux WebKit checks, pinned engine pairing and independent PDF/DXF/mesh validation.
- The separate jsmap changes are pushed in [PR #6](https://github.com/ahzs645/jsmap/pull/6), with all 17 suites and CI passing. Captured runtime replay remains distinct from recovered standalone source.

## Next acceptance and product work

| Priority | Work | Completion criterion |
| --- | --- | --- |
| P1 for physical production | Measure paper output and printed tool fit. | Use the [paper/device kit](PHYSICAL_DEVICE_ACCEPTANCE.md) and STL calibration workflow. Record printer/driver/paper, 100mm axes, pitch, asymmetric tiling, intended slicer and measured clearance. Digital geometry checks are not physical measurements. |
| P1 for supported devices | Exercise real Safari/iOS storage, Files, touch and WebGL. | Follow the device walkthrough on actual hardware, including recovery, file review, downloads, 2D/3D routes and background/foreground behavior. Linux WebKit and Chromium phone descriptors cover different test surfaces. |
| P2 | Finish localization by workflow and obtain technical language review. | Use [the inventory](verification/localization-coverage.json) and [coverage guide](LOCALIZATION.md). Recovery/native controls and Japanese specialist dialogs have expanded; deeper cloud/moderation, other specialist workflows and the 18 smaller dictionaries still need work. |
| P2 | Integrate the optional constraint/dimension engine into the product. | A persistent, accessible UI applies complete analytic shape updates through normal locks/history, reports conflicts, and saves constraints. [Current engine semantics](NATIVE_CONSTRAINTS.md) are tested; new solver UI is not implemented. |
| P2 | Broaden supported interchange and reference fixtures. | Preserve licensed-part provenance and additional v4.2 records before accepting them; extend unknown sealed versions only with a tested contract. Match asymmetric curves, stitches, images, dimensions and physical outputs. Missing reference STL dependencies still limit original-runtime manufacturing comparisons. |

## Explicit boundaries

- Sealed format integrity is not authorship or license verification. Supported content is reviewed before applying; unsupported payload features reject without changing the drawing.
- Partial ellipses still use a warned bounded fallback in LCAD. JSON and modern DXF retain analytic parameters; general DXF splines have a reported approximation target. See [DXF support](DXF_IMPORT.md).
- LCAD/legacy LCC do not preserve all manufacturing/assembly/project state. Loss review recommends JSON for the complete project.
- Finishing support and geometric/resource guards are specified in [the manufacturing guide](MANUFACTURING_EXPORT.md). An invalid or unsupported combination must report an error rather than emit an inaccurate mesh.
- Whole-library database restore is transactional; database plus browser preferences cannot be crash-atomic across two stores. Retain a prior backup until checking restoration.
- Live collaboration, billing/membership and account-wide erasure remain separate product work. Retained immutable publication credits can require the documented operator allowance/recovery path.

Reference-only controls such as pen-lift guard, loupe/modifier-pad behavior, recording/grant UI and every adjustable picking variant still need focused behavior mapping before implementation. LeatherCad already has snap indicators, coarse-pointer picking, AI/automation surfaces, print calibration, Mandala controls and pricking-iron groups/presets; use current code and evidence instead of stale checkboxes.
