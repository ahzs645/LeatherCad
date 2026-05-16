# Source-App Parity Gaps (Extraction Review)

Last updated: 2026-05-16 (pass 2: silver ratio, mandala mirror, per-hole stitch shape, leather-sim
rotate, per-dimension inspector, prickingirons.lccp fixture)

This document tracks parity between the extracted source app (Leathercraft_CAD_v2.8.3) and the
current LeatherCad web app. Items marked ✓ are fully implemented.

## Implemented (complete)

### Core 2D drafting
- ✓ Pan, line, polyline, arc, bezier, circle, ellipse, rectangle, freehand tools
- ✓ Layer system: add/rename/delete/reorder/hide/lock, stack level
- ✓ Dimension lines, fold lines, cut-line shortcut tool

### Line Type Palette (LP-01 / LP-02)
- ✓ First-class `lineType` on all shapes (`lineTypeId`)
- ✓ 5 default roles: `cut`, `stitch`, `fold`, `guide`, `mark`
- ✓ Line palette UI: toggle visibility, isolate by type, assign selected shapes to type
- ✓ Export filtering by line-type role and visibility

### Stitch Hole Engine (ST-01 / ST-02 / ST-03)
- ✓ Stitch hole entities with manual placement, snapping to nearest stitch-role path
- ✓ Auto placement — fixed pitch
- ✓ Auto placement — variable pitch (`from` → `to`)
- ✓ Pricking iron presets (round, diamond, french, flat, custom) stored in localStorage
- ✓ Hole counting and delete-on-selected-path tools
- ✓ Stitch-hole sequence index persistence and normalisation
- ✓ Order-fix actions (`Fix From Selected`, `Fix Reverse`)
- ✓ Stitch chain rebuild from `.lcc` `PrevStId`/`NextStId` linked lists (`chainId` assignment)
- ✓ `sourceStitchIn` / `sourceStitchOut` preserved through JSON save/load
- ✓ `widthMm: 0` (zero-width blade) preserved through JSON save/load

### Stitch Simulator
- ✓ Saddle, running, cross, backstitch modes
- ✓ Thread colour and thickness controls
- ✓ Direction arrows, per-parity (even/odd) visibility toggles
- ✓ Simulator groups by `chainId` when present (imported `.lcc` chains render correctly)

### Import / Export (EX-01 / EX-02)
- ✓ SVG import (line/polyline/polygon/rect/circle/ellipse/path)
- ✓ DXF export (R12/R14), line-type style mapping, Y-flip, selected-only
- ✓ Dashed/dotted-to-solid export toggle
- ✓ `.lcc` import/export with full shape, layer, stitch-hole, and backdrop fidelity
- ✓ Imported S_HOLE marker lines flagged (`stitchHoleMarker`) and skipped in `.lcc` export
- ✓ PDF tracing import with scale/rotation/opacity controls
- ✓ Repository ZIP import/export

### Undo / Redo / Clipboard (LC-MVP-006)
- ✓ Document-level undo/redo (120-item limit), keyboard shortcuts
- ✓ Copy/cut/paste/duplicate/delete with stitch-hole linkage preservation
- ✓ Selection ordering (step forward/back, to front/back)

### Template Repository (LC-MVP-010)
- ✓ Local catalog: save/load/delete templates, insert into document
- ✓ Repository JSON import/export; ID remapping on insert

### Tracing Overlays (LC-P2-012)
- ✓ PNG/JPEG/PDF import with overlay controls (visibility, lock, opacity, scale, rotation, offset)

### Print Workflow (LC-P2-014)
- ✓ Tile/grid controls, overlap, margins, paper size, scale
- ✓ Toggles: selected-only, ruler inside, print in colour, stitch holes as dots

### Generators / Secret Tools
- ✓ Watch strap — all parameters including hardware measurements and tip shape
- ✓ Pass case — stitch pitch, stitch space, compact source mode, flap, pockets
- ✓ Box joint — all lid modes (`none` / `drop-in` / `sliding`), independent thickness, kerf, groove
  - `drop-in` lid is now geometrically inset by wall thickness (distinct from `sliding`)
  - `grooveDepthMm` gates groove lines on `sliding` lid
- ✓ Jigsaw — deterministic seeded randomisation, flat edges, flattened path
- ✓ Dice cup — frustum unroll, thickness compensation, stitch offsets
- ✓ Cap pattern — `seamMM` now applied to panel and brim geometry (not just description)
- ✓ Letter stamp — `baselineAngleDeg` now rotates text shape endpoints as well as placement centres

### Pattern Pieces & Seam Allowance
- ✓ Pattern piece definitions, seam connections, piece notches
- ✓ Per-edge seam allowance, grain lines, piece labels

### 3D Preview & Fold Simulation
- ✓ Fold angle, mountain/valley direction, material properties
- ✓ XPBD constraint-based relaxation, physics seam stress distribution
- ✓ Exploded view, camera modes, stress overlay, edge labels

### Miscellaneous
- ✓ Mandala radial helper, golden ratio / silver ratio guides
- ✓ Backdrop/reference images with transform controls
- ✓ Hardware markers (snap, rivet, buckle, custom)
- ✓ AI builder integration
- ✓ Nesting / layout
- ✓ Parametric dimensions / constraint solver

---

## Remaining gaps (lower priority)

### Fixture / test coverage
- `backImage.tiff` SHA validation is tied to the local extracted app path — no checked-in hash.
- Checked-in `prickingirons.lccp` fixture at `docs/fixtures/source-app-parity/prickingirons.lccp`
  is exercised by `pricking-iron-ops.test.ts` and represents the source-shaped
  `LeathercraftCAD_PrickingIronGroups` envelope. A genuine native desktop sample would still be
  preferable for byte-level guarantees, but parser parity is now under test.
- Generator tests include geometry invariants for cap seam (incl. apex), box lid (drop-in vs
  sliding), box joint groove slots, letter stamp rotation, and watch strap holes.
  Additional per-generator coordinate invariants can be added over time.
- AllLCC test now skips gracefully when corpus directory is absent (CI-safe) and asserts
  S_HOLE count preservation through export round-trip instead of total shape count (which
  was fragile due to DOT→4×ARC expansion).

### Export option depth (EX-03) — ✓ closed
- `exportIncludeText` and `exportIncludeTemplateMetadata` are now surfaced in
  `ExportOptionsModal` with checkboxes ("Include text shapes", "Include template / painted
  parts"). Previously they were only reachable through the global OptionsModal (settings).

### PDF tracing depth (LC-P2-012 pass 2) — ✓ closed
- `renderPdfPageToTracingImage` (pdfjs) rasterizes the chosen page into a PNG `sourceUrl`. The
  `TracingModal` preview now binds pointer drag (preview pane and on-canvas chrome both update
  `offsetX/offsetY`), exposes Previous/Next page controls, and supports DPI/ruler calibration.

### Box joint assembly geometry — ✓ closed
- Side panels now include bottom-panel groove slots (pairs of parallel guide lines at
  `grooveOffsetMm` from the bottom-adjacent edge, spaced by `bottomThicknessMm`) when
  `grooveDepthMm > 0`. Previously grooves only appeared on the sliding lid.

### Cap pattern — ✓ closed
- Apex seam is now modelled: the crown panel apex is raised by `seamMM` (moved to `y = -s`)
  so all four edges of each panel receive seam allowance. Previously only left/right/bottom
  edges were expanded.

## 2026-05-16 closures

### Quick rotate / scale (Edit ribbon) — ✓ closed
- `Rotate ±1` / `Rotate ±5` and `Scale ±1%` / `Scale ±5%` buttons live in the Edit ribbon
  and honour the `customRotationPivot` when one is set (matches `actRotateCW1Deg`,
  `actScaleUp1`, etc.).

### Set rotation pivot / snap anchor — ✓ closed
- "Set Pivot" / "Clear Pivot" and "Set Snap Pt" / "Clear Snap Pt" toolbar buttons store the
  selection center; quick and Specify rotation/scale handlers now use it.

### Separate template into shapes — ✓ closed
- Inserting a template wraps the inserted shapes in a SketchGroup whose annotation begins
  with `Template:`. A new "Separate Template Into Shapes" button in the Template Repository
  modal dissolves any such group covering the current selection (`actSeparateTemplateIntoShapes`).

### Dimension formatting controls — ✓ closed
- `DimensionLine` now carries optional `arrowOnly`, `singleLine`, `textInside`, `textReverse`,
  and `precision` fields, all consumed by `CanvasAnnotationLayer`. Defaults for new
  dimensions are configurable in `OptionsModal` ("Dimension defaults" section), backed by
  `EditorPanelState.dimensionDefaults` and routed through the construction-tool runtime.

### Force-fit last pricking-iron tooth — ✓ closed
- Surfaced in `OptionsModal` as "Force last pricking iron tooth to land on path endpoint".
  The toggle writes through to `stitchAutoPitchSettings.forceFitLastHole`, so auto-pitch
  generators already honour it.

### Global print calibration — ✓ closed
- `printCalibrationX/YPercent` are now editable from `OptionsModal` ("Print calibration"
  section), backed by `EditorPanelState`. The Print Preview modal continues to read the
  same values, so they survive session boundaries as workshop calibration.

### PDF tracing drag handles — ✓ closed
- `TracingModal` preview pane is now a drag surface: pointer-drag updates `offsetX/offsetY`
  in-place. Pointer-capture keeps drags responsive, and the cursor switches to `grabbing`
  during interaction. Page selection, DPI calibration, and ruler-derived calibration were
  already implemented.

### Help / Documents tabs — ✓ closed
- `HelpModal` now has tabs for About, Shortcuts, ReadMe, License, Donation (with crypto
  wallets and copy-to-clipboard), and Resources/External links — matching the source
  `TfrmDocuments` and `TfrmAbout` layouts.

---

## 2026-05-16 closures (pass 2)

### Per-hole stitch shape override (actChangeStitchingHoleShape) — ✓ closed
- `SelectionInspectorPanel` already lets a single selected hole pick its `renderShape`. A new
  batch path (`changeStitchHoleShapesOnShapes` in `stitch-hole-ops.ts`,
  `handleChangeStitchHoleShapeOnSelectedShapes` in `useStitchActions.ts`) and a "Change Shape"
  dropdown in `StitchHolePanel` apply a shape to every hole on the selected shapes.

### Silver-ratio (actDesignHelper_WhiteSilverRatio) — ✓ closed
- `generateWhiteSilverGuides` (1:√2) sits alongside `generateGoldenRatioGuides` in
  `mandala-ops.ts` and is exposed in `MandalaModal` as the **White-Silver** tab.

### Mandala mirror (actMirrorMandalaItem) — ✓ closed
- `mirrorSelectionAcrossAxis` in `transform-ops.ts` mirrors selected shapes across any axis
  through the current rotation pivot (or selection centroid). `MandalaModal` adds a "Mirror Item"
  tab with quick-axis presets (0/45/90/135°).

### Leather sim rotate image (actLeatherSim_RotateImage) — ✓ closed
- `LeatherImageFillSection` now exposes quick-rotate buttons (±90°, ±1°) next to the numeric
  rotation field for the active leather image fill.

### Per-dimension inspector — ✓ closed
- New `DimensionInspectorModal` lists all dimensions and edits per-instance fields
  (`arrowOnly`, `singleLine`, `textInside`, `textReverse`, `precision`, `fontSizeMm`, `offsetMm`,
  custom `text`). Opened from `OptionsModal` → Dimension defaults → "Open per-dimension
  inspector…". `setShowDimensionInspectorModal` is wired through the standard overlay chain.

## Remaining nice-to-haves (no functional gap)

- Crypto wallet addresses in the donation tab are placeholders; replace with real
  project-owner values when published.
