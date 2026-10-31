# DXF import

`Import DXF` appends editable geometry and source layers to the current document. The import parses the entire file before changing document state. Invalid files leave the existing document untouched. Closing the import dialog or changing the document identity abandons pending file reads before they can append geometry. Import errors and warnings are shown inside the dialog as well as in the global status bar.

The importer reads ASCII DXF (R12 and later group-code layouts). Binary DXF must be saved as ASCII first. Physical coordinates are converted to millimetres using `$INSUNITS`; unspecified units default to millimetres with a warning. The import control offers millimetre, inch, centimetre and metre overrides. DXF Y-up is converted to the editor's Y-down coordinate system.

| Entity | Treatment |
| --- | --- |
| `LINE` | Native editable line. |
| `CIRCLE`, `ARC` | Native circular arcs. Circles use four quarter arcs. |
| `LWPOLYLINE`, 2D `POLYLINE` / `VERTEX` | Lines and exact signed bulge arcs, including closed paths. Widths are reported and ignored; centreline geometry is retained. |
| `SPLINE` | Valid degree 1–10 B-splines and rational NURBS, evaluated from control points, knots and weights, then flattened to editable line segments. Default target tolerance: 0.05 mm. |
| `ELLIPSE` | Elliptical arcs flattened to editable line segments with the same tolerance. |
| `BLOCK` / `INSERT` | Nested instances with base-point offsets, rotation, mirrored/nonuniform scale, arrays, source layer inheritance and BYBLOCK colour inheritance. Nonuniformly scaled circles become sampled ellipses. |

Layer names, on/off/frozen state, lock state, ACI/true colours, common line styles and line weights are retained. Every imported layer and style receives a fresh editor ID. Approximation and unsupported-entity warnings appear in the import status.

Text, hatches, dimensions, attributes, meshes, solids, external references that have no captured block definition and other unsupported entity families are not converted into invented geometry. Unsupported entities are reported and skipped. Imports containing no supported geometry fail clearly. Paper-space entities and nonplanar extrusion normals are skipped. Constant Z elevations are projected onto XY with a warning; varying-Z lines are skipped. This is a planar pattern importer, not a 3D DXF converter.

Resource limits: 50 MB source file, 200,000 emitted shapes, 10,000 instances per block array, 16 nested blocks and 4,096 samples per flattened curve span. Cyclic blocks are reported and skipped. Curve sampling that cannot satisfy the target tolerance fails rather than silently accepting an inaccurate path.

Regression coverage includes unit conversion, colour/layer state, native circular arcs, positive/negative bulges, classic vertex sequences, nested block transforms, nonuniform circle scaling, rational quarter-circle NURBS, ellipse orientation, unsupported/recursive/nonplanar entities, malformed input and coordinate round trips through the existing DXF exporter.
