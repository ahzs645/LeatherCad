# Source App Extraction Deep Analysis (Pass 3, Validated)

Date: 2026-02-26
Target: `LeathercraftCAD` v2.8.3 macOS ARM (`Leathercraft_CAD_v2.8.3_macOS_ARM`)

## 1) Goal

Build an evidence-backed parity roadmap for LeatherCad by separating:

- what is already extracted with high confidence,
- what is mapped into tickets,
- what still needs extraction before deeper rebuild work.

## 2) Evidence Audited

### Binary and reverse-engineering outputs

- `/home/workspace/workspace/leather-making/extracted-app/Leathercraft_CAD_v2.8.3_macOS_ARM/LeathercraftCAD.app/Contents/MacOS/LeathercraftCAD`
- `/home/workspace/workspace/leather-making/function_sizes.csv`
- `/home/workspace/workspace/leather-making/ghidra_feature_functions_pseudoc.txt`
- `/home/workspace/workspace/leather-making/ghidra_function_10068db64.txt`
- `/home/workspace/workspace/leather-making/ghidra_loader_functions_pseudoc.txt`

### String/action datasets

- `/home/workspace/workspace/leather-making/source_app_actions_raw.txt`
- `/home/workspace/workspace/leather-making/source_app_actions_normalized.txt`
- `/home/workspace/workspace/leather-making/source_app_actions_core.txt`
- `/home/workspace/workspace/leather-making/source_app_action_ticket_map.csv`
- `/home/workspace/workspace/leather-making/feature_string_refs.csv`

### Resource extraction outputs

- `/home/workspace/workspace/leather-making/extracted-rsrc/rsrc_symbols.txt`
- `/home/workspace/workspace/leather-making/extracted-rsrc/rsrc_index.csv`
- `/home/workspace/workspace/leather-making/extracted-rsrc/rsrc_form_inventory.csv`
- `/home/workspace/workspace/leather-making/extracted-rsrc/rsrc_form_details.txt`

### Product/release context

- `/home/workspace/workspace/leather-making/extracted-app/Leathercraft_CAD_v2.8.3_macOS_ARM/LeathercraftCAD.app/Contents/Resources/StartUp/ReadMe_en.txt`
- current web rebuild app source in this repo (`src/*`)

## 3) Binary/Resource Anatomy (Confirmed)

`llvm-objdump --macho --private-headers` confirms a large embedded resource segment:

- Segment: `__RSRC`
- VM addr: `0x0000000101958000`
- VM size: `0x00000000006a4000`
- File offset: `26034176`
- File size: `6963200`

`llvm-nm` confirms **38** RCDATA symbols (`___rsrc_N6RCDATA...`).

Extracted resources include high-value forms:

- `tfrmleat`
- `tfrmleat_macintosh`
- `tfrmoptions`
- `tfrmsvgexportoptions`
- `tfrmstitchingholesettings`
- `tfrmchangestitchingholetype`
- `tfrmeditpallet`
- `tfrmrepository`
- `tfrmpreview`
- `tfrmpdfviewer`

All extracted form blobs are `TPF0` format (FireMonkey form resources).

## 4) Action Surface Analysis (Corrected)

## 4.1 Global action catalogs

- Raw `act*` strings: **565** (`source_app_actions_raw.txt`)
- Normalized list: **403** (`source_app_actions_normalized.txt`)
- Curated core map: **60** (`source_app_actions_core.txt` / `source_app_action_ticket_map.csv`)

Important: the 403 normalized list includes framework/noise bleed (substring artifacts like `acter*`, `action*`, and non-CAD `act*` tokens). It is useful for discovery, but not reliable as a parity surface by itself.

## 4.2 Main-form (`TfrmLeat`) coverage

From `rsrc_form_details.txt`:

- Raw actions in `TfrmLeat`: **228**
- Canonical main-form actions after stripping `Execute` suffix: **134**
- Current mapped overlap (with 60-action ticket map): **45**
- Unticketed main-form actions: **89**
- Main-form mapping coverage: **33.6%**

This means two-thirds of concrete main-form command surface is still unticketed.

## 4.3 Unticketed action clusters from main form

High-confidence unticketed clusters (counts from canonical 89):

- `Transforms` (25): align/rotate/scale/flip/specify-ratio/rotation-center/snap-point/move-copy-distance
- `LineTypePalette` (8): palette show-hide/select/unselect + spelling variants (`LinePalette`/`LinePallet`)
- `GeometryEdit` (10): center line, convert-to-path, reverse path, split-into-N, boundary/golden-spiral, numeric edits
- `SelectionOrdering` (8): select/deselect/delete selected/group/ungroup/order front/back
- `ProjectLifecycle` (8): new/load/save/save as/close/open demo/open options/clear all
- `ViewportDisplay` (6): grid/scale/dimension/reset/grid dark-light/show print areas
- `HelpLinks` (10): release notes, FAQ, website, Twitter, YouTube, donation, license, hotkeys
- `SecretBonus` (7): box joint, jigsaw, cap pattern, dice cup, watch band
- `LayerAdvanced` (2): generic `actLayer`, `actIgnoreLayer`
- `Other` (5): `actAddBackdrop`, `actDesignHelper_GoldenRatio`, `actEditFontList`, `actMakeSelectedLineHorizontal`, `actMakeSelectedLineVertical`

Representative unticketed examples:

- `actLinePaletteShowHide`
- `actLinePaletteUnselectLineType`
- `actOrder_BringToFront`
- `actScaleUp1` / `actScaleUp5` / `actScaleDown1` / `actScaleDown5`
- `actSpecifyScaleRatioHorizontally`
- `actShowHideDimensionLines`
- `actMoveOrCopyWithSetDistance`
- `actDeleteDuplicates`

## 5) Form-Control Schema Extraction (High Signal)

Using `strings` on extracted RCDATA forms, we can recover concrete control IDs (not just guessed feature names).

## 5.1 `TfrmOptions` (33 controls)

Examples:

- `gbOP_DefaultPitchMode`
- `gbOP_AutoPitchParameters`
- `nbOP_AutoPitchPrecision`
- `nbOP_AutoPitchSteps`
- `nbOP_AutoPitchGapAllowance`
- `chkUseAutoSave`
- `gbOP_PrintCalibration`
- `nbPrintCalibrationX` / `nbPrintCalibrationY`
- `chkOP_ReverseZoomDirection`

Implication: auto-pitch, autosave, print calibration, and zoom behavior have explicit option schema.

## 5.2 `TfrmSVGExportOptions` (20 controls)

Examples:

- `chkSVGOPT_ExportOnlySelected`
- `chkSVGOPT_DoNotOutputStrokeDash`
- `chkSVG_Out_Text`
- `chkSVG_Out_Template`
- `chkDXFExportFlipY`
- `rbDxfR14Change`
- `nbSVGDotRadius`

Implication: export behavior is option-rich and line-type aware.

## 5.3 Stitching forms

`TfrmStitchingHoleSettings` (12 controls) and `TfrmChangeStitchingHoleType` (36 controls) expose:

- stitch-hole type combo + inversion
- pricking iron group list and CRUD actions
- blade geometry fields (`nbPitch`, `nbWidth`, `nbHeight`, `nbAngle`)
- blade count/name controls (`edNumOfBlades`, `edPrickingIronName`)

Implication: stitching/pricking logic is a major subsystem, not a simple draw mode.

## 5.4 `TfrmEditPallet` (26 controls)

Examples:

- `cmbLineTypeNum`
- `rbSolid` / `rbDash` / `rbDot` / `rbDashDotDot`
- `nbThickness`
- `chkIgnoreInPrinting`
- RGB fields + color entry (`nbPaletteR/G/B`, `edColor`)

Implication: line-type palette semantics include line style, thickness, color, and print ignore flags.

## 5.5 Other workflow forms

- `TfrmRepository` (18 controls) includes sortable tree interactions (`tvRepository*`, `btnSortTemplate`)
- `TfrmPreview` (27 controls) includes print-tiling/ruler/stitch-dot controls
- `TfrmPDFViewer` includes import/cancel controls

## 6) Release-Note Signal (Prioritization Input)

`ReadMe_en.txt` contains a dense timeline (2024-2026). Tag frequency highlights where feature maturity is deep:

- `Internationalization` 13
- `Printing` 12
- `Tracing` 9
- `Leather Simulator` 9
- `Layer` 9
- `SVG Import` 8
- `Beveling` 7
- `Line Palette` / line-type workflows multiple releases
- `DXF Export` evolution including R14 support

Implication: parity work should prioritize line-type palette behavior, stitch workflows, tracing, and export options rather than treating them as minor extras.

## 7) Current Rebuild vs Source Surface (Snapshot)

From current app code (`src/App.tsx`, `src/three-bridge.ts`, `src/components/*`):

## Already present

- 2D line/arc/bezier/fold drafting
- layer CRUD + stack + legend modes
- line-type model + palette UI + visibility/assignment/select-by-type
- JSON save/load
- SVG export
- mobile editor/preview/split modes
- 3D preview bridge with fold controls, layer visibility toggles, texture URLs

## Missing or shallow vs source

- SVG import (source has robust import surface)
- DXF export (R12/R14 options and toggles)
- stitch-hole entities and auto/manual placement engine
- stitch order correction tools
- print preview/calibration option parity
- tracing import/manipulation (PNG/JPEG/PDF)
- transform/selection/order command surface depth
- undo/redo + clipboard parity depth
- template repository parity

## 8) What Still Needs Extraction (Prioritized)

### P0 (immediate, highest ROI)

1. Build a clean canonical action catalog from `TfrmLeat` + mac variant.
   - Normalize aliases (`LinePalette` vs `LinePallet`, suffix variants).
   - Preserve behavior variants (`ScaleUp1` vs `ScaleUp5`) as separate commands.
   - Output CSV: `action,aliases,source_form,mapped_ticket,group,status`.

2. Expand ticket map from 60 mapped actions to include at least the 89 unticketed main-form actions.

3. Build a menu/control linkage table from main-form controls.
   - Connect `pm*`, `mi*`, `btn*`, `lb*`, and `act*` identifiers.

### P1 (high-value extraction)

4. Build structured form schemas for key dialogs.
   - Options, SVG/DXF export, stitching hole settings, line palette, print preview, repository.
   - Output JSON schema per form with field types, defaults, and enum candidates.

5. Map recovered controls to internal setting keys and pseudocode paths.
   - Example targets: DXF flip Y, R12/R14 mode, auto-pitch params, print calibration, zoom inversion.

### P2 (needed for full behavioral parity)

6. `.lcc` project format extraction from real sample files.
   - Need sample `.lcc` projects from user workflows.
   - Parse container structure and object/layer/line-type persistence.

7. Targeted algorithm decompilation for behavior-critical systems.
   - auto stitching pitch distribution
   - trim/bevel geometry operations
   - line-type-aware export grouping

## 9) Recommended Next Execution Sequence

1. Generate `mainform_action_matrix.csv` from current extraction (P0.1 + P0.2).
2. Generate `form_schema_options_export_stitching.json` (P1.4).
3. Add ticket wave for unticketed transforms + palette + lifecycle + viewport commands.
4. Then continue implementation in modular slices (instead of adding more logic to one file).

## 10) Bottom Line

Extraction quality is now strong at the resource/form level, but parity planning is still under-specified because ticket coverage lags behind recovered command surface.

Best next move is **structured action/form/schema extraction and ticket expansion first**, then targeted algorithm decompilation where behavior is still ambiguous.
