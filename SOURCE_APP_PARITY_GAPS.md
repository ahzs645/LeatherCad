# Source-App Parity Gaps (Extraction Review)

Date: 2026-02-25

This is a gap review between:
- Extracted source app artifacts in `/home/workspace/workspace/leather-making/extracted-app/...`
- Current LeatherCad web app in this repo (`leathercraft-rebuild`)

## Evidence used
- Extracted action tokens:
  - `/home/workspace/workspace/leather-making/source_app_actions_normalized.txt`
  - `/home/workspace/workspace/leather-making/source_app_actions_core.txt`
- Source app release notes:
  - `/home/workspace/workspace/leather-making/extracted-app/Leathercraft_CAD_v2.8.3_macOS_ARM/LeathercraftCAD.app/Contents/Resources/StartUp/ReadMe_en.txt`
- Existing extraction docs:
  - `/home/workspace/workspace/leather-making/source-app-feature-list.md`
  - `/home/workspace/workspace/leather-making/source-app-pass2-ticket-plan.md`

## Current LeatherCad baseline (already implemented)
- 2D drafting: pan, line, arc, bezier, fold line.
- Layer system: add/rename/delete/reorder/hide/lock, stack level, color continuum.
- JSON save/load.
- SVG export.
- 3D preview bridge: fold angle control, texture URLs, layer visibility in 3D.
- Mobile modes and layout improvements.

## High-priority missing features

### 1) Line Type Palette + Stitch Line Types (highest priority)
Why:
- User workflows rely on line-type-coded operations and visibility.
- Strong source evidence for palette and line-type behavior:
  - `actLinePaletteShowHide`, `actLinePaletteUnselectLineType`, `actLinePaletteSelectAll`
  - release-note entries for line-type selection/hide/show and export grouping by line type.

Missing in current app:
- No first-class `lineType` on shapes.
- No line-type palette UI (color/style/visibility/select-by-type).
- No stitch-vs-cut semantics backed by line-type metadata (current stitch detection is name/id heuristic).

Recommended scope:
- Add `lineTypes` registry to document model (id, name, color, style, visible, role).
- Add `shape.lineTypeId` and migrate existing shapes.
- Add palette UI (toggle visibility, isolate type, assign selected shapes to type).
- Add role presets: `cut`, `stitch`, `fold`, `guide`, `mark`.
- Replace heuristic stitch detection with explicit role.

### 2) Stitch Hole Engine (core leathercraft parity)
Why:
- Source app has deep stitching workflows:
  - hole shapes, manual/auto placement, fixed/variable pitch, count/delete holes, next-hole selection.
  - action evidence: `actChangeStitchingHoleShape`, `actCountNumOfStitchingHolesOnSelectedPaths`, `actDeleteStitchingHolesOnSelectedPaths`, `actSelectNextStitchingHole`.

Missing in current app:
- No stitch-hole entities.
- No pricking iron presets.
- No auto placement or pitch controls.

Recommended scope:
- Introduce `stitchHoles` model + render layer above geometry.
- Implement manual hole placement on stitch-type paths.
- Implement auto placement (fixed pitch first, variable pitch second).
- Add hole counting and delete-on-selected-path tools.

### 3) Stitch Simulator Depth
Why:
- Source app includes thread color, direction hints, and stitch-order correction.

Missing in current app:
- 3D panel is material/fold-focused, not stitch-path simulation.
- No stitch-order model or simulator controls.

Recommended scope:
- Add thread color and thickness controls.
- Add sequence arrows/indices on stitch holes.
- Add “fix order from clicked hole” operation.

### 4) Import/Export parity for production workflows
Why:
- Source app emphasizes practical interoperability and cutting-machine compatibility.

Missing in current app:
- No SVG import.
- No DXF export (R12/R14 compatibility options).
- No “dashed/dotted to solid on export” option.
- No export filtering by line type visibility.

Recommended scope:
- SVG import with explode vs grouped mode.
- DXF export pipeline.
- Export option matrix driven by line-type roles/visibility.

## Medium-priority missing features
- Tracing overlays (PNG/JPEG/PDF import, transform, show/hide).
- Template repository (register reusable parts, place, separate-to-shapes).
- Undo/redo + clipboard workflow.
- Dimension lines + XY ruler/scale toggles.
- Trim/extend and shape-size numeric editing.

## Low-priority / later parity
- Mandala feature family.
- Printing pipeline parity (tiling/calibration/inside-ruler options).
- Secret/bonus tools (out of MVP scope).

## Recommended next implementation order
1. `LP-01` Line type data model + migration (`shape.lineTypeId`, doc `lineTypes`).
2. `LP-02` Line palette UI (assign/select/show-hide/isolate by type).
3. `ST-01` Stitch hole entities + manual placement on stitch-type paths.
4. `ST-02` Auto placement (fixed pitch), then variable pitch.
5. `EX-01` SVG import and DXF export with line-type-aware options.

## Concrete acceptance criteria for stitch line types
- A shape can be assigned to a line type in one click.
- At least 5 default line-type roles exist: cut/stitch/fold/guide/mark.
- Hiding a line type immediately hides all shapes using that type.
- Export can exclude hidden line types.
- Stitch tools operate only on line types marked as stitch role.

## Progress update (2026-02-27)
- `ST-01` baseline started and integrated:
  - Added `stitchHoles` document model and JSON persistence.
  - Added `Stitch Hole` drawing tool that snaps placement to nearest stitch-role path.
  - Added stitch hole rendering overlay in 2D (`round` and `slit` hole types).
  - Added stitch-hole controls for count/delete-on-selected and clear-all.
  - Added modular helpers in `src/stitch-hole-ops.ts` and modular UI in `src/components/StitchHolePanel.tsx`.
- `ST-02` baseline integrated:
  - Added fixed-pitch auto placement for selected stitch paths.
  - Added stitch-hole sequence index persistence and normalization.
  - Added path-based resequence and reverse-order actions.
  - Added optional sequence labels in 2D view.
- Stitch visualization expansion:
  - Added 3D stitch-hole points and thread-path rendering in the Three.js bridge.
- `EX-01` baseline integrated:
  - Added SVG import (line/polyline/polygon/rect/circle/ellipse/path sampled to line segments).
  - Added DXF export (`AC1009`/R12-style `LINE` entities from visible shapes).
- `ST-03` stitch-order tooling integrated:
  - Added variable-pitch auto placement (`from` -> `to` pitch) on selected stitch-role paths.
  - Added stitch-hole selection in Move mode + `Select Next` cycle action.
  - Added order-fix actions from selected hole (`Fix From Selected`, `Fix Reverse`) to align with `actFixStitchingOrder*`.
  - Added selected-hole highlight in 2D for explicit order-start targeting.
- `EX-02` export option parity integrated:
  - Added line-type-aware export filtering by role (`cut/stitch/fold/guide/mark`) and visibility.
  - Added dashed/dotted-to-solid export toggle.
  - Added DXF option surface: `Flip Y`, `R12/R14` version selector.
  - Added DXF linetype table output (`CONTINUOUS`, `DASHED`, `DOTTED`) with per-shape line-type style mapping.
- Next implementation target:
  - `EX-03` SVG/DXF option-depth parity: export selected-only, template/text toggles, and dot-radius/options alignment to recovered `TfrmSVGExportOptions` controls.
