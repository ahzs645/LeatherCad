# Manufacturing export

STL / Jig creates millimetre meshes from visible closed geometry. It runs in a cancellable worker: changing a geometry option terminates the old job, and closing the dialog cancels it. Download stays disabled until the current job succeeds. A job exceeding 30 seconds stops with a simplification/tolerance message.

## Geometry and controls

- Pattern thickness, target line roles, selected shapes, nested cutouts, overlapping outline unions, and round/original stitch holes.
- Export-only diamond, European and flat hole length/width overrides. The drawing's hole definitions remain unchanged.
- Rectangular jigs by margin or explicit width/height, or an outside boundary offset from the pattern; floor and pocket dimensions; signed fitting clearance; through-floor stitch drilling; positioned finger holes.
- Selectable planar regions with independent remaining thickness or a through cut. Stored interior-point assignments report unmatched regions after drawing edits; reset or reassign those settings before manufacturing.
- Uploaded OpenType/TrueType font outlines engraved from the top or bottom to the requested depth, including glyph counters and rotated/arched text placement. Missing glyphs and depths reaching through the local material reject.
- Sloping 45-degree chamfers and polygonal fillets, including cutout/hole boundaries, region steps and engraving. Jig finishing follows the outside stock outline while preserving pocket and bore fit geometry. Fillet divisions and sampled, conforming surface refinement adapt to the selected tolerance within bounded budgets.
- Material/color preview controls. Standard STL contains geometry and does not encode the preview materials.

Curve tolerance is a physical millimetre value (0.001–1 mm), default 0.02 mm. Circular/elliptical steps use a conservative chord bound; polynomial curves use convex-hull subdivision. Half the tolerance is reserved for curve flattening and half for rounding/offset work. Endpoint closure remains a separate 0.001 mm requirement. Excessive geometry rejects rather than relaxing the tolerance silently.

## Saved settings and fonts

`DocFile.manufacturing` is a validated, versioned settings object. Use **Save manufacturing settings**, or download an STL, to save the dialog settings with the drawing. Selection is session state and is not embedded.

An uploaded engraving font is embedded as a validated `font/ttf` or `font/otf` data URL with its filename, limited to 4 MiB decoded. Reopening the drawing restores that exact font for repeatable engraving. Font data increases document size; cloud upload must use the configured asset-storage workflow or reject a record exceeding its payload limit. Exporting another file format must warn or preserve the manufacturing extension rather than silently claiming a complete backup.

## Validation and limits

The mesh validator checks finite coordinates, nonzero triangle areas, paired directed edges, a connected cycle at each vertex, and positive signed volume for every disconnected component. It rejects open/self-crossing outlines, edge-crossing stitch holes, outside jig holes, offsets that remove every pocket, insufficient jig margins, and operations leaving no material.

Resource limits include 2,000 source shapes, 1,000 stitch holes, 100 finger holes, 200 region overrides, 50,000 sampled outline/hole/font-path vertices, 100,000 cumulative vertices across depth/finishing levels, 2,000 engraved characters, and 250,000 triangles. Limits reject with a simplification message rather than increasing geometric error. Holes already inside through regions are omitted with a warning; partial stitch-hole boundary crossings still reject. Outside or clipped lettering is reported explicitly.

Finishing combines with unequal heights and text engraving through a lazy solid modeller. Edge size must fit the finished thickness and any shared height step; finishes touching jig pockets/bores or changing narrow-feature topology reject clearly. Lettering crossing a finished edge is clipped to the actual body, with depth measured from the region's flat face plane. Details, precision bounds and engine provenance are in [Combined manufacturing operations](MANUFACTURING_SOLID_ENGINE.md). This is flat manufacturing export, separate from the assembled/folded preview.

The dialog also provides a [printer fit gauge and measurement checklist](PRINTER_FIT_CALIBRATION.md). Its nominal holes, pocket clearances, plug, pin and measurement bar support later physical checks; printing remains unperformed.

Unit tests exercise physical dimensions and volumes, independent dense curve-error samples, native cubics/ellipses, steps and through regions, drilling/finger holes, actual font parsing and counters, top/bottom depth, sloped finishes, stale region feedback, preserved appearance-independent STL bytes, worker cancellation, and manifold/orientation rejection.

Independent verification loaded seven exported STL files into trimesh 5.2.0 and checked watertightness, winding, positive volume, disconnected components, broken faces and horizontal section contours. Engraved sections occur on the chosen side. The portable results are in [manufacturing-mesh-validation-2026-10-31.json](verification/manufacturing-mesh-validation-2026-10-31.json). These checks do not establish slicer output or physical printer fit; no external slicer or printer was available in this environment.
