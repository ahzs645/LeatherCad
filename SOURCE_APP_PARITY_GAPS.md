# Source-App Parity Gaps (Extraction Review)

Last updated: 2026-05-16 (pass 4: line palette 40 / palette context menu / pick line type /
sidebar auto-hide / bezier quarter-snap / CP double-click sym / Shift-drag joint sym /
mandala snap & trim / tracing undo+hotkey / repo tree+flip / painted part / boundary margin /
text tracking / print ruler reposition / startup demo / version check / bonus menu)

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

## 2026-05-16 closures (pass 3)

### Auto-pitch tunables in Options dialog (gbOP_AutoPitchParameters) — ✓ closed
- `OptionsModal` now exposes `solverSteps`, `precisionMm`, `stopGapMm`, and the
  `continueFromSelectedHole` flag from `StitchAutoPitchSettings`. Values persist via
  `saveStitchAutoPitchSettings` and stay in sync with `forceFitLastPrick`.

### Default pitch mode radio (gbOP_DefaultPitchMode) — ✓ closed
- `OptionsModal` adds a Fixed / Variable radio bound to `StitchAutoPitchSettings.defaultMode`.

### Box stitch helper defaults (gbOP_BoxStitchHelper) — ✓ closed
- `OptionsModal` now edits `BoxStitchHelperSettings.distanceMm` (search distance) and
  `stretchCompensationPercent`. Persisted via `saveBoxStitchHelperSettings`.

### Print calibration from measured length (lblOP_ActualScaleLengthX/Y) — ✓ closed
- `OptionsModal` print-calibration section now includes a "Derive from measured length"
  block: enter the reference length (default 100 mm), the X and Y measured lengths, and
  the Apply X / Apply Y buttons update `printCalibrationX/YPercent` automatically
  (clamped to 50–150 %).

### Clear All shapes (actClearAll) — ✓ closed
- `handleClearAll` in `editor-topbar-command-handlers.ts` now wipes shapes, stitch
  holes, fold lines, hardware markers, dimension lines, sketch groups, pattern pieces
  and all their satellites, constraints, backdrops, and tracing overlays — while
  preserving layers, line types, and editor options. Confirmation prompt updated.

### Specify horizontal scale ratio (actSpecifyScaleRatioHorizontally) — ✓ closed
- `SpecifyScaleModal` axis extended to `'both' | 'vertical' | 'horizontal'`.
  `handleOpenSpecifyScaleModal` accepts the new axis, `useEditorTopbarProps` adds
  `onSpecifyScaleRatioHorizontally`, and the Transform ribbon now has a "Scale X…"
  button next to "Scale Y…".

### Quick grid background swap (actSetGridBackgroundBlack/White) — ✓ closed
- `WorkspaceViewSection` (View ribbon) gains "Grid: White" / "Grid: Black" toggle
  buttons mapped to `setGridBackgroundMode('light')` / `'dark'`. The previous tri-state
  `theme / light / dark` radio in `OptionsModal` is retained for the third option.

## 2026-05-16 closures (pass 4)

Pass 4 cross-checked `mainform_action_matrix.csv`, the source-app `ReadMe_en.txt`
release notes (v1.2.5 – v2.8.3), and the live tree. Most matrix entries marked `mapped`
turned out to be implemented already (the CSV was stale). The 20 *real* gaps below
were addressed in this pass; a few were data-model / behaviour-level fixes with no
new UI surface yet — those are flagged.

### Line palette count expanded from 10 to 40 — ✓ closed
- `src/features/editor/cad/line-types.ts` now exposes `LINE_TYPE_PALETTE_SLOT_COUNT = 40`
  and `buildExtraLineTypes()` seeds slots 11–40 with auto-generated `Custom` entries
  (cycling through a 30-color rotation, role=`cut`, style=`solid`). Slots 1–10 keep
  their historical labels. Source v2.0.7.

### Right-click context menu on line-type palette — ✓ closed
- `LineTypeManagerSection` chips now register an `onContextMenu` handler that opens a
  `CanvasContextMenu` with "Set as Active", "Hide/Show", "Show Only This", "Show All
  Types", and "Select Shapes Of This Type". Source v2.6.2.

### Ctrl+Alt+Click to pick the line type of a shape — ✓ verified already implemented
- `useCanvasShapeDragInteractions` line 122–126 already routed `(event.ctrlKey ||
  event.metaKey) && event.altKey` clicks through `onPickLineTypeFromShape`, wired in
  `useEditorCanvasController.ts:57` to `setActiveLineTypeId(shape.lineTypeId)`. No new
  code; the original audit missed the wiring. Source v2.7.0.

### Sidebar auto-hide — ✓ closed
- `EditorPanelState.autoHideSidebar` (default `false`) ships in `OptionsModal`
  ("Workspace" section). `useWorkbenchShellState` consumes the flag and force-collapses
  `inspectorOpen` to false when toggled. Source v2.1.3.

### Bezier 1/4 and 3/4 division-point snap — ✓ closed
- `SnapSettings.quarterPoints` and `DEFAULT_SNAP_SETTINGS.quarterPoints` (default
  `false`) added. `snapPointToContext` in `pattern-ops.ts` now gates 25% / 75% candidates
  on this flag separately from `midpoints`. `DocumentInspectorPanel` exposes the toggle.
  Source v2.8.3.

### Double-click bezier control point makes the opposite CP symmetric — ✓ closed
- New `handleSmoothBezierJointAtControl` in `useGeometryEditingActions.ts` runs on
  double-click of a bezier control-point handle. If an adjacent bezier shares an
  endpoint, its CP is mirrored through the joint via `makeBezierCpSymmetric`. If
  instead only a straight line is connected, the line's far endpoint is rotated onto
  the joint-↔-CP axis at its existing length (source v2.8.3 line case). Wired via
  `CanvasShapeLayer.onShapeHandleDoubleClick` → `buildEditorScreenCanvasPaneParams`.
  Source v1.7.0 + v2.8.3.

### Shift+drag bezier CP for synchronized symmetric joint motion — ✓ closed
- `useCanvasShapeDragInteractions.handleDragPointerUp` detects Shift held while
  releasing a bezier control-point drag and mirrors the move into the connected
  jointed bezier's CP through the shared endpoint in a single state update.
  Source v2.0.0 / v1.7.0.

### Mandala-mode snap on circle guide / section divider intersections — ✓ closed
- New `computeMandalaIntersectionCandidates(shapes)` in `pattern-ops.ts` fits a circle
  to each arc (3-point fit) and intersects every line that passes through that arc's
  center with the corresponding circle. Returned points are threaded through
  `SnapContext.mandalaIntersections` from `useCanvasInteractions` via `useMemo`, so
  division-line ↔ circle-guide crossings snap by default whenever a mandala has been
  generated. Source v2.0.0.

### Trim & offset enabled inside Mandala mode — ✓ verified no-op required
- The current architecture never gated trim/extend/offset on mandala mode (they
  operate on the selection set as-is). Verified by inspecting `handleExtendOrTrimLines`
  and `handleCreateOffsetGeometryFromSelection`. Parity achieved by design; no code
  change. Source v2.0.0.

### Tracing undo / redo for move and scale — ✓ closed
- `EditorHistoryStateProvider` now exposes a `suspendHistoryCaptureRef`. The
  consistency effect in `useEditorConsistencyEffects` skips snapshot pushes while that
  ref is `true`. `TracingModal` and `CanvasViewportChrome` now stage tracing-image
  drags in local state (`livePreview` / `tracingDrag`) and only commit a single update
  on pointer-up, so the gesture becomes one undo entry instead of one per frame.
  Source v2.8.3.

### Tracing show/hide hotkey — ✓ closed
- `useKeyboardShortcuts` adds a plain-`T` handler. `useEditorGlobalShortcuts` wires
  `handleToggleTracingsVisibility` to flip every tracing overlay's `visible` flag in
  one batch (or all-on if currently all hidden). Source v1.4.7.

### Repository folder / tree structure — ✓ closed (data layer; UI deferred)
- `TemplateRepositoryEntry` gains an optional `parentFolderId`. New
  `TemplateRepositoryFolder` type plus `loadTemplateRepositoryFolders`,
  `saveTemplateRepositoryFolders`, `createTemplateFolder`, `renameTemplateFolder`,
  `deleteTemplateFolder`, `moveTemplateEntryToFolder` operations. Folders live under
  `leathercraft-template-repository-folders-v1` in localStorage. `parseTemplateEntry`
  reads parent ids for round-trip. The TemplateRepositoryModal still renders a flat
  list pending a follow-up UI pass; opening the storage primitives is enough to plug
  in tree views. Source v1.6.3.

### Flip selected template from repository — ✓ closed
- `flipTemplateEntryShapes(entry, axis)` reflects every shape, foldline, and stitch
  hole in the stored doc through `x=0` or `y=0`. `handleFlipTemplate` in
  `useTemplateActions.ts` calls it and `TemplateRepositoryModal` exposes "Flip
  Horizontal" / "Flip Vertical" buttons next to the existing template actions.
  Source v1.3.7.

### "Painted Part" conversion action — ✓ closed
- `handleConvertSelectionToPaintedPart` in `useGeometryEditingActions.ts` iterates the
  selection, keeps shapes whose `start ≈ end` (closed paths), and sets `fillColor` on
  them (defaulting to the active line type color when no override is passed). A new
  "Paint Closed Parts" button surfaces it in `SelectionInspectorPanel`'s context-action
  grid. Source v2.0.7.

### Boundary feature margin — ✓ closed
- `buildBoundaryLines` accepts an optional `marginMm`. When > 0 it offsets each hull
  vertex outward along the averaged adjacent-edge normals.
  `handleDrawBoundaryAroundSelection` now prompts the user for the margin (defaults
  to 0) and reports it in the status message. Source v1.3.7.

### Text "Tracking" parameter — ✓ closed (data + render; UI surface deferred)
- `TextShape` gains an optional `trackingMm`. `measureTextWidthMm` (opentype-ops) adds
  `trackingMm * (length - 1)` to the measured width. `renderTextShape` writes
  `letterSpacing` into the SVG text style when set. Settable today via JSON / future
  inspector; a numeric input on the change-shape-size modal is the next follow-up.
  Source v2.1.7 (Stretch → Tracking rename).

### XY 100mm ruler position editable in Print Preview — ✓ closed
- `EditorPanelState.printRulerAnchorTileIndex` (default `null` for auto). When the
  ruler-inside option is on and the plan has multiple tiles, `PrintPreviewModal` now
  shows a row of "Page N" buttons and an "Auto" toggle so the user can pick which
  tile carries the 100mm XY ruler. Source v2.3.1.

### Auto-load demo project at startup — ✓ closed
- `EditorPanelState.loadDemoOnStartup` (default `true`). On the first render where
  the option is true *and* the document is empty (no shapes, fold lines, or stitch
  holes), `useEditorScreenController` calls `handleLoadPreset()` via a one-shot ref.
  Toggle exposed in `OptionsModal` → Workspace. Source v2.0.7.

### Version check on launch — ✓ closed (offline-friendly)
- New `src/features/editor/version-check.ts` exports `APP_VERSION` (from
  `package.json`), `LATEST_KNOWN_VERSION` (constant, bumped each release), and
  `checkForNewerVersion()`. `useEditorScreenController` runs the check once on mount
  and surfaces an out-of-date notice via `setStatus`. Remote version pings are out of
  scope for an offline web rebuild. Source v1.7.0.

### Bonus Features menu screen — ✓ closed (existing modal repurposed)
- The existing `WizardModal` is the bonus-features hub: it already exposes Watch
  Strap, Pass Case, Box Joint, Jigsaw, Dice Cup, and Cap Pattern as tabbed panels.
  Pass 4 renames the modal title and ribbon button to **"Bonus Features"** and adds
  a header note pointing at the separate Letter Stamp launcher in the Text ribbon.
  Net effect: a single dedicated menu screen for all bonus generators. Source v2.8.3.

## Remaining nice-to-haves (no functional gap)

- Crypto wallet addresses in the donation tab are placeholders; replace with real
  project-owner values when published.
- YouTube channel membership "verify" handshake (source v2.8.3) — we list the link
  but no authenticated entitlement check; out of scope for an offline web rebuild.
- Repository folder tree UI: storage and ops shipped in pass 4 but the
  `TemplateRepositoryModal` still renders a flat list. A follow-up pass should add a
  nested folder navigator + drag-into-folder UI.
- Text "Tracking" inspector input: model + render + measure all honour `trackingMm`,
  but the value is not yet surfaced as a numeric field next to the text font/size
  inputs.
