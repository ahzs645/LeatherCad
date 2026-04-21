# Web/Desktop Parity Todo

Date: 2026-04-21

This list tracks the remaining parity work found by comparing the current web app with the extracted LeathercraftCAD desktop app in `/Users/ahmadjalil/Downloads/leather-making`.

## Active Tasks

- [x] Improve SVG import fidelity.
  - Add editable SVG text import.
  - Apply inherited and element-level `transform` attributes for imported geometry.
  - Preserve the existing `importSvgAsShapes` API while moving transform behavior into a focused helper module.

- [x] Add line type thickness and print-ignore metadata.
  - Extend the line type model with stroke thickness and ignore-in-print semantics.
  - Surface the settings in the line type palette/manager.
  - Apply the metadata consistently in canvas rendering, print planning, and export filters.

- [x] Harden tracing persistence and PDF page selection.
  - Prefer durable embedded image/PDF raster payloads where browser object URLs are currently used.
  - Replace prompt-based PDF page choice with a proper modal/page picker.
  - Keep tracing/backdrop behavior separated so each module has clear persistence rules.

- [x] Add leather simulator image registration and calibration.
  - Support importing leather images for closed-shape fill simulation.
  - Add DPI sizing, rotation, crop/selection controls, and ruler-based calibration.
  - Keep this separate from the Three.js material URL workflow.

- [x] Deepen print preview parity.
  - Add page add/remove planning controls where useful in the browser flow.
  - Add line-thickness factor and non-print line visibility controls.
  - Keep native-only print setup/execute behavior out of shared CAD logic.

- [x] Polish repository/catalog management.
  - Add sorting/reordering behavior for repository trees.
  - Improve catalog item previews for imported source catalog files.
  - Keep template, catalog, and preset persistence paths explicit and independent.

## Remaining Swarm Gap Backlog

These items were added from the 2026-04-21 swarm review. Each item should be implemented as a narrow module or feature slice, not as a single desktop-parity mega-refactor.

- [ ] `MDL-01` Mandala workflow parity.
  - Add Mandala-specific intersection calculation and clear-intersection commands.
  - Add set-new-center, relative-diameter, no-intersection, and circle-template controls.
  - Wire `mirrorMandalaItem` and source-style help actions into the visible UI.
  - Keep geometry generation in `ops/mandala-ops.ts`; keep modal state in the Mandala UI module; keep controller wiring thin.
  - Progress 2026-04-21: circle-template and division-line guide generation are separated in `ops/mandala-ops.ts`, and the modal now exposes relative diameter plus circle-template/division-line toggles. Remaining work is desktop-style intersection management, set-new-center, no-intersection mode, and help actions.

- [ ] `CAT-01` Catalog editor and catalog export.
  - Add dedicated shop, group, and item editing flows for name, URL, memo, category, unit price, and unit label.
  - Add item image import with DPI, scale, ruler length, rotation, square/max/reset controls.
  - Add catalog export matching the imported `.ctlg` structure where browser-safe.
  - Keep catalog parsing/serialization under `templates/catalog-repository.ts` or a sibling serializer module; keep template repository behavior separate.
  - Progress 2026-04-21: imported source catalogs can now be exported back to browser-safe `.ctlg` JSON via a serializer in `templates/catalog-repository.ts` and an `Export Catalog` action in the catalog tab. Remaining work is dedicated shop/group/item edit forms and richer item image import/calibration controls.

- [x] `GEO-01` Move/copy by distance dialog.
  - Replace prompt-only move/copy by distance with a dedicated reusable form.
  - Support X/Y fields, reset values, and copy-instead-of-move toggle.
  - Keep transform math in selection/geometry ops and expose the dialog as UI only.
  - Completed 2026-04-21: move/copy by distance now opens a reusable dialog from topbar/workbench command surfaces.

- [ ] `GEO-02` Desktop-depth shape size editing.
  - Extend shape size editing beyond width/height to line length, line angle, arc radius/angle, ellipse X length, text radius, and Mandala rotation where applicable.
  - Reuse existing line/shape editing helpers instead of embedding geometry math in the modal.
  - Preserve the current simple width/height flow as the default path.
  - Progress 2026-04-21: single-line length/angle, single-arc radius/angle, and single-text radius/sweep controls are implemented with geometry helper coverage. Remaining desktop-specific pieces are Mandala rotation and true ellipse X-length if a native ellipse shape model is added.

- [x] `GEO-03` Expose line symmetry.
  - Wire the existing `handleLineSymmetry` operation into the topbar/workbench command surfaces.
  - Add a small command path for choosing the symmetry axis when the selection is ambiguous.
  - Add focused tests around the operation if current coverage does not already protect it.
  - Completed 2026-04-21: topbar/workbench wiring is in place; selecting one line plus other shapes uses that line as the symmetry axis.

- [x] `LAY-01` Layer batch commands.
  - Add Flatten All Layers, Merge Into Below, Hide Other Layers, and Show All Layers.
  - Keep layer mutation helpers in `useLayerActions` or a dedicated layer ops module; avoid folding this into unrelated selection logic.
  - Update UI surfaces in small command additions, with status messages and locked/last-layer guards.
  - Completed 2026-04-21: commands are exposed in layer/topbar surfaces and the workbench document inspector.

- [x] `SVG-01` User-facing SVG import options.
  - Add import width/scale controls before committing imported geometry.
  - Add grouped-vs-exploded import mode where the existing parser can preserve useful grouping metadata.
  - Keep parsing in `io/io-svg.ts` and option/UI orchestration outside the parser.
  - Completed 2026-04-21: SVG import now opens an options modal with width/scale preview and grouped/exploded commit behavior; grouped imports create or reuse a sketch group without changing parser ownership.

- [ ] `STX-01` Full pricking-iron toolbox surface.
  - Add explicit blade count, preset name, group CRUD, group delete guards, and group up/down ordering.
  - Keep builtin/system presets protected from destructive edits.
  - Reuse `ops/pricking-iron-ops.ts` for catalog rules and persistence; keep `StitchHolePanel` from becoming a monolithic editor by extracting toolbox subcomponents.
  - Progress 2026-04-21: blade count is explicit for saved presets, custom groups can be renamed/deleted/reordered, and system presets remain protected. Remaining work is extracting the toolbox controls into subcomponents and replacing prompt-driven save/edit flows with dedicated forms.

- [ ] `PDF-01` PDF/tracing viewer depth.
  - Add a dedicated PDF preview/page picker surface when importing PDF tracing assets.
  - Keep PDF rasterization in tracing/PDF ops and avoid mixing PDF viewer state with generic tracing overlay state.
  - Track what PDFium desktop capabilities are not browser-feasible so parity decisions stay explicit.
  - Progress 2026-04-21: tracing overlays now show a dedicated preview panel with PDF page/count and DPI metadata, while page rasterization remains in tracing/PDF ops. Remaining work is documenting browser-infeasible PDFium parity items.

- [x] `PRN-01` Print preview desktop controls.
  - Add browser-appropriate page add/remove planning controls and active DPI display.
  - Keep native printer setup/execute concepts out of shared CAD logic unless they have a browser equivalent.
  - Preserve the existing print tiling planner as the domain module and wire new controls through it.
  - Completed 2026-04-21: the print preview keeps browser tiling/page controls and now displays active calibrated DPI in preview and printable output.

## Modularity Guardrails

- New work should land in focused modules or helpers before being wired into the screen controller.
- Import/export behavior belongs under `src/features/editor/io/` and `src/features/editor/modules/import-export/`.
- UI state and domain state should not be expanded through one-off controller state unless there is no existing provider/module owner.
- Add focused tests near the changed adapter or operation layer before broad UI wiring.
- Prefer small feature-owned components and operation helpers over expanding `EditorApp`, `useEditorScreenController`, or a single catch-all modal.
- When a desktop form maps to multiple domains, split it by domain first, then compose it in UI.
