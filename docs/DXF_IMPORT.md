# DXF exchange

`Import DXF` parses in a disposable worker and opens **Review DXF import** before changing the document. The review shows physical units, counts, unsupported content and a bounded preview. Select source layers and choose **Append selected layers**, or cancel without changing artwork. Closing the importer, opening/resetting another document or starting another read cancels obsolete work. Changes to the same document's immutable arrays do not cancel a read: the app uses a separate document-session counter.

ASCII DXF R12 and later group-code layouts are supported. Binary files must first be saved as ASCII. `$INSUNITS` converts geometry to canonical millimetres; unspecified units default to millimetres with a warning. The control offers mm/in/cm/m overrides. DXF Y-up maps to the editor's Y-down coordinate system.

| Entity | Treatment |
| --- | --- |
| `LINE` | Editable line. |
| `CIRCLE`, `ARC` | Exact circular arcs. Full circles use four quarter arcs. Nonuniform block transforms produce analytic ellipses/elliptical arcs. |
| `LWPOLYLINE`, 2D `POLYLINE` / `VERTEX` | Lines and signed bulge arcs, including closed paths. Polyline widths are reported and ignored; centreline geometry is retained. |
| `SPLINE` | Clamped single-span nonrational quadratic/cubic Béziers preserve control points as native curves. Other valid degree 1–10 B-splines and positive-weight rational NURBS are evaluated then flattened to lines, with a default **0.05 mm target**. This fallback uses adaptive sample-point checks, not a certified global bound. |
| `ELLIPSE` | Analytic centre, axes, rotation and partial sweep, including affine block transforms. |
| `BLOCK` / `INSERT` | Expanded nested instances with base-point offsets, rotation, mirrored/nonuniform scale, arrays and source layer/BYBLOCK attribute inheritance. Block instance identity is not retained. |

Layer names, visibility/frozen state, locks, ACI/true colours, common dash styles and distinct effective lineweights are imported. Explicit lineweight, BYLAYER and BYBLOCK cases have regression coverage. Unicode DXF name escapes decode on import. Imported layers/styles receive fresh editor IDs. Unsupported families such as text, hatch, dimensions, attributes, meshes/solids and unavailable xrefs are reported and skipped; a file with no supported geometry fails. Paper-space/nonplanar entities are skipped, constant Z elevations project to XY with a warning, and varying-Z lines are skipped.

## Export

- **R12 / AC1009:** bounded line conversion for curves, default **0.02 mm** physical tolerance. This uses the same convex-hull/circular-error sampling as manufacturing, with vertex limits; it does not use a fixed segment count.
- **R14 / AC1014:** native circular `ARC`, cubic `SPLINE` and `ELLIPSE` entities. Quadratics are degree-elevated exactly to cubic controls. Indexed colours remain a format limitation.
- **R2004 / AC1018:** native curves plus RGB colours and standard lineweight metadata. DXF lineweights use an enumerated set; unsupported editor widths are rounded to the nearest supported value with an explicit warning. Use this option when preserving those attributes matters.

The exporter uses document layer names and preserves layer visibility/locks. Sanitized colliding names receive deterministic suffixes. Unicode names use ASCII DXF escapes for pre-2007 code pages. Modern files include required subclass markers, handles, owners, symbol tables and model/paper block records so independent readers can load native entities. Coordinates are serialized with finite numeric precision; “native” means preserving curve parameters rather than flattening, not bit-identical floating-point transfer.

Warnings identify indexed-colour/lineweight loss, sampled annotation text, per-shape opacity/lock/group omissions and R12 flattening. Standard DXF arc/ellipse entities have their own traversal convention; this is geometry exchange rather than a full project backup. **Document JSON** retains the complete editor model and manufacturing settings.

Limits: **50 MB** input, **200,000** emitted shapes, **2,000** imported layers, **10,000** instances per block array, **16** nested blocks, and **4,096** samples per fallback spline span. Cyclic blocks are reported/skipped. Unsupported precision/complexity fails before applying the import.

Tests cover mixed lineweights, unit conversion, Unicode names, colours/layer state, bulges, nested transforms, native ellipses/cubics, rational splines, malformed/unsupported input, staged cancellation and large-arc physical error. Native output is also checked with an independent DXF reader during release verification.
