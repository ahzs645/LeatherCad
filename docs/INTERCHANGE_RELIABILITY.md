# Drawing transfer and native curves

The editor stores cubic Béziers and rotated/partial ellipses as analytic shapes. A cubic has `start`, `control1`, `control2`, `end`; an ellipse has `center`, `radiusX`, `radiusY`, `rotationDeg`, `startAngleDeg`, `sweepDeg`. Ellipses do not duplicate derived endpoints. Geometry remains in millimetres; angles use degrees in the document's Y-down coordinate system.

`cad/native-curve-ops.ts` supplies point/tangent evaluation, analytic bounds, SVG paths and affine transforms. Ellipse transforms recover axes with a 2×2 SVD, including shear, nonuniform scale and reflection. Explicit conversion to lines has a physical error bound and a vertex budget. Manufacturing flattens analytic curves only when producing the mesh. Destructive tools that cannot retain an analytic primitive must explicitly convert or decline that operation; a sampled preview is not the persisted source curve.

## Formats

| Format | Native geometry and retained state | Limits |
| --- | --- | --- |
| Document JSON | Native control points/ellipse parameters, widths, shape opacity/locks, nested groups, structured attribution and versioned manufacturing settings. | Complete project backup, separate from whole-library backup. |
| Modern LCAD | Native cubic controls, full rotated ellipses, compatible drawing/stitch/dimension/tracing content, palette widths and shape overrides, opacity/locks and group parents. | Partial ellipses export to lines within 0.01 mm with a warning because the reference ellipse record represents a full ellipse. Filled paths become outlines; unsupported shape families reject. Source recordings/provenance and advanced LeatherCad project state are not a complete interchange contract. |
| Plain legacy LCC | Explicit cubic controls become native cubics; eccentric/rotated ellipse parameters become native ellipses. Genuine circles remain exact circular arcs. Export degree-elevates quadratics correctly and writes native cubic controls. | Widths, shape appearance/group relationships and advanced project settings have explicit export warnings. Unknown legacy shape families can be skipped with warnings. |
| Current sealed LCC | Detected before compatibility artwork can load. | Rejected; no signature/version reader is implemented. Save LCAD/SVG from the source app. |
| ASCII DXF | Native analytic curves where supported, distinct lineweights and source layers/units; general spline fallback reports its target tolerance. | See [DXF exchange](DXF_IMPORT.md) for supported families, export versions and losses. |

## Review and cancellation

JSON/LCAD/LCC reads open **Review drawing import** with counts, layers, dimensions, warnings and a preview. **Replace current drawing** is the only commit action; cancel preserves current work. DXF uses the same review component and allows selecting layers to append. Existing SVG review now exposes warning details. Pattern PDF review separately scans pages and exposes inferred geometry before acceptance.

Lossy LCAD/LCC exports show their warning summary before download. The shared review route also accepts export preflight results. Exporting a project through a drawing format is separate from saving full Document JSON.

Browser document/DXF parsing runs in a disposable module worker. Abort terminates that worker rather than merely ignoring its result. Each operation also checks a document-session epoch and request generation before staging/applying. New file/project intent supersedes older work; startup demo loading is lower priority than an explicit file operation. A late database save cannot associate a newer drawing with an older project record.

Budgets apply before document mutation: **50 MB** serialized input, **200,000** total expanded geometry, **2,000** layers, **20 MB** aggregate embedded raster data, parsed nesting depth **64** and **2 million** parsed tree nodes. Format-specific curve/block limits also apply. Large assets and excessive geometry fail with an actionable error, retaining the open drawing. The worker fallback used by unit tests/SSR is synchronous; supported browsers take the worker path.

## Verification

The synthetic regressions exercise the former silent failures: LCAD palette/shape width separation, mixed DXF lineweights and an asymmetric legacy cubic whose midpoint was previously wrong by 25 mm. Run:

```sh
node docs/verification/remaining-interchange-diagnostics.mjs .
```

The script now asserts corrected behavior. [Corrected results](verification/corrected-interchange-2026-10-31.json) are newly generated synthetic data; the earlier dated defect observations remain historical evidence. Tests additionally cover analytic bounds, affine point agreement, exact native save/reopen, explicit conversion tolerance, resource rejection, pre-apply cancellation, database-ID assignment during a read, and file intent winning over late demo loading.
