# Combined manufacturing operations

Pattern finishing can combine with unequal region heights, through regions, original/round holes and top or bottom engraving. The exporter cuts closed 3D solids with a lazy Manifold engine and then checks the resulting mesh. It does not join intersecting triangle surfaces by appearance alone.

Pattern top cutters use the union of material reaching each height, clipped to the faces actually exposed at that height. A taller neighbor therefore does not create an unintended groove beside a lower shelf. Bottom finishing uses the complete material footprint. Separated parts can have close heights; a shared height step must have enough depth for the requested edge size.

Jig finishing applies to the outside stock outline. Pockets, drill bores, finger holes and regional through cuts retain their fit geometry rather than acquiring a bevel allowance. A finish reaching a pocket or bore rejects with an instruction to reduce the edge size or increase the outside margin. Engraving depth is measured from each region's flat face plane. Where lettering intersects a finished edge, the recess is clipped to the actual solid and a warning explains that convention.

## Numerical checks and bounds

Bevel ramps follow the distance to the authored polygon boundary. Chamfer error is measured normal to the 45-degree plane; fillet error is radial distance to the quarter-circle profile. A large vertical difference near a fillet tangent is not the geometric-distance error. Refinement preserves contour elevation landmarks, propagates internal edge splits to both neighboring triangles, and leaves cap boundaries conforming. It samples internal edge midpoints, triangle centroids and several positions on each boundary edge, rejecting unresolved sampled error or exhausted budgets. This is sampled surface acceptance, not a proven global bound over every point of every polygon. The analytic conservative bounds used to flatten source circles, ellipses and polynomial curves remain separate.

Advanced combinations reserve additional tolerance for float input/output conversion, use a local coordinate origin and reject dimensions too large for the chosen precision. Limits include 64 distinct heights, 250,000 triangles per solid, 500,000 retained intermediate triangles, bounded surface refinement, and the existing 30-second cancellable worker budget. Superseded solids are deleted after each operation, and all remaining WASM objects are released on success or failure.

The source tests include analytic volume and recess-depth checks, a regression for the former hole-edge profile distortion, separate close-height parts, shared-step guards, nested cutouts with three heights, and jig fit guards. Independent measured results are recorded in [manufacturing-profile-2026-11-01.json](verification/manufacturing-profile-2026-11-01.json): 438 evaluations at 310 distinct locations measured maximum normal errors of approximately 0.003805 mm for chamfers and 0.006786 mm for fillets against a 0.01 mm cutter target. Those sampled maxima describe the tested fixtures. These are software checks; no physical printer was used.

A separate [trimesh reread](verification/manufacturing-combined-mesh-2026-11-01.json) checks seven exported ASCII STLs: top/bottom engraving with finishing, stepped engraving, a drilled/finger-hole jig, both nested-cutout finishes, and the fit gauge. All have closed, consistently oriented positive-volume components and zero reported broken faces. Horizontal sections distinguish engraved recesses, jig bores/pockets and gauge levels. This is an independent mesh-reader check, not acceptance in the intended printer slicer.

## Engine distribution

The dependency is pinned to **manifold-3d 3.5.4**, published from [elalish/manifold](https://github.com/elalish/manifold) under **Apache-2.0**. It is installed from the npm registry with lockfile integrity metadata. No engine code or binary came from the reference application's capture. The distributed license is in [public/licenses/manifold-3d-LICENSE.txt](../public/licenses/manifold-3d-LICENSE.txt).

Only the core JavaScript/WASM entry is imported for advanced finishing; the package's CAD/glTF tools are not imported into the application. The core files are approximately 81 KiB JavaScript and 529 KiB WASM before compression. Vite emits the WASM URL with the deployment base path, and workers load it from that URL. No cross-origin isolation or external modelling service is required. Failed engine loads disable that job while ordinary un-finished exports remain available.

The browser worker calls `buildStlExportAsync`; programmatic combined exports should use `buildStlExportAsync` or `buildAsciiStlAsync`. The synchronous entry points remain available for ordinary extrusions and simple uniform finishing.
