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

## Modularity Guardrails

- New work should land in focused modules or helpers before being wired into the screen controller.
- Import/export behavior belongs under `src/features/editor/io/` and `src/features/editor/modules/import-export/`.
- UI state and domain state should not be expanded through one-off controller state unless there is no existing provider/module owner.
- Add focused tests near the changed adapter or operation layer before broad UI wiring.
